import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const getDefaultKey = (raw: string | undefined, fallback: string) => {
  if (!raw) return fallback
  try {
    const parsed = JSON.parse(raw)
    return parsed?.default || fallback
  } catch {
    return fallback
  }
}

type MapelStatus = 'aktif' | 'nonaktif'
type MapelKategori = 'wajib' | 'pilihan' | 'ekstrakurikuler' | 'asrama'

interface ImportMapelRow {
  rowNumber: number
  kodeMapel?: string
  nama: string
  kategori: MapelKategori
  status?: MapelStatus
  kkm?: number
  kelasId?: string
  kelasNama?: string
  tahunAjaran?: string
  pengampuId?: string
  pengampuEmployeeId?: string
  pengampuEmail?: string
}

interface ImportRequest {
  rows: ImportMapelRow[]
  dryRun?: boolean
}

interface ImportResult {
  rowNumber: number
  kodeMapel?: string
  nama?: string
  action?: 'created' | 'updated'
  success: boolean
  error?: string
  mapelId?: string
}

const normalizeText = (v: unknown) => {
  if (v === null || v === undefined) return ''
  return String(v).trim()
}

const normalizeEmployeeId = (v: unknown) => {
  const s = normalizeText(v)
  return s.replace(/\.0$/, '').replace(/\s+/g, '')
}

const isValidKategori = (v: string): v is MapelKategori => {
  return v === 'wajib' || v === 'pilihan' || v === 'ekstrakurikuler' || v === 'asrama'
}

const isValidStatus = (v: string): v is MapelStatus => {
  return v === 'aktif' || v === 'nonaktif'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized - No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const token = authHeader.replace('Bearer ', '')

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const anonKey = getDefaultKey(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? undefined, Deno.env.get('SUPABASE_ANON_KEY') ?? '')
    const serviceRoleKey = getDefaultKey(Deno.env.get('SUPABASE_SECRET_KEYS') ?? undefined, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')

    const supabaseAuth = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: { user: callerUser }, error: authError } = await supabaseAuth.auth.getUser(token)
    if (authError || !callerUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized - Invalid or expired token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: callerRole, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', callerUser.id)
      .eq('role', 'admin')
      .maybeSingle()

    if (roleError) {
      return new Response(JSON.stringify({ error: 'Failed to verify admin status' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!callerRole) {
      return new Response(JSON.stringify({ error: 'Forbidden - Only admins can import mapel' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const payload: ImportRequest = await req.json()
    const rows = payload?.rows || []
    const dryRun = !!payload?.dryRun

    if (!Array.isArray(rows) || rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Rows is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const [{ data: kelasData, error: kelasError }, { data: staffData, error: staffError }] = await Promise.all([
      supabaseAdmin.from('kelas').select('id, nama, tahun_ajaran').limit(2000),
      supabaseAdmin.from('staff').select('id, employee_id').limit(5000),
    ])

    if (kelasError) {
      return new Response(JSON.stringify({ error: kelasError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (staffError) {
      return new Response(JSON.stringify({ error: staffError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const kelasMap = new Map<string, string>()
    ;(kelasData || []).forEach((k: any) => {
      const key = `${normalizeText(k.nama).toLowerCase()}|${normalizeText(k.tahun_ajaran).toLowerCase()}`
      if (k.id && key !== '|') kelasMap.set(key, k.id)
    })

    const staffByEmployeeId = new Map<string, string>()
    ;(staffData || []).forEach((s: any) => {
      const key = normalizeEmployeeId(s.employee_id).toLowerCase()
      if (key) staffByEmployeeId.set(key, s.id)
    })

    const results: ImportResult[] = []
    let created = 0
    let updated = 0
    let failed = 0

    for (const row of rows) {
      const rowNumber = Number(row?.rowNumber || 0) || 0
      const kodeMapel = normalizeText(row?.kodeMapel)
      const nama = normalizeText(row?.nama)
      const kategoriRaw = normalizeText(row?.kategori).toLowerCase()
      const statusRaw = normalizeText(row?.status).toLowerCase()
      const kkmRaw = normalizeText(row?.kkm)
      const kelasIdRaw = normalizeText(row?.kelasId)
      const kelasNama = normalizeText(row?.kelasNama)
      const tahunAjaran = normalizeText(row?.tahunAjaran)
      const pengampuIdRaw = normalizeText(row?.pengampuId)
      const pengampuEmployeeId = normalizeEmployeeId(row?.pengampuEmployeeId)
      const pengampuEmail = normalizeText(row?.pengampuEmail).toLowerCase()

      if (!nama) {
        failed += 1
        results.push({ rowNumber, kodeMapel, nama, success: false, error: 'Nama mapel wajib diisi' })
        continue
      }

      const kategori = isValidKategori(kategoriRaw) ? kategoriRaw : undefined
      if (!kategori) {
        failed += 1
        results.push({ rowNumber, kodeMapel, nama, success: false, error: 'Kategori tidak valid' })
        continue
      }

      const status = isValidStatus(statusRaw) ? statusRaw : undefined
      if (statusRaw && !status) {
        failed += 1
        results.push({ rowNumber, kodeMapel, nama, success: false, error: 'Status tidak valid' })
        continue
      }

      const kkm = kkmRaw ? Number(kkmRaw) : undefined
      if (kkmRaw && (Number.isNaN(kkm) || kkm < 0)) {
        failed += 1
        results.push({ rowNumber, kodeMapel, nama, success: false, error: 'KKM tidak valid' })
        continue
      }

      let kelasId: string | null = null
      if (kelasIdRaw) {
        kelasId = kelasIdRaw
      } else if (kelasNama && tahunAjaran) {
        const key = `${kelasNama.toLowerCase()}|${tahunAjaran.toLowerCase()}`
        kelasId = kelasMap.get(key) || null
        if (!kelasId) {
          failed += 1
          results.push({ rowNumber, kodeMapel, nama, success: false, error: `Kelas tidak ditemukan: ${kelasNama} (${tahunAjaran})` })
          continue
        }
      } else {
        failed += 1
        results.push({ rowNumber, kodeMapel, nama, success: false, error: 'kelas_id atau (nama_kelas+tahun_ajaran) wajib diisi' })
        continue
      }

      let pengampuId: string | null = null
      if (pengampuIdRaw) {
        pengampuId = pengampuIdRaw
      } else if (pengampuEmployeeId) {
        pengampuId = staffByEmployeeId.get(pengampuEmployeeId.toLowerCase()) || null
        if (!pengampuId) {
          failed += 1
          results.push({ rowNumber, kodeMapel, nama, success: false, error: `Pengampu tidak ditemukan (employee_id=${pengampuEmployeeId})` })
          continue
        }
      } else if (pengampuEmail) {
        const { data: prof, error: profError } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('email', pengampuEmail)
          .maybeSingle()

        if (profError) {
          failed += 1
          results.push({ rowNumber, kodeMapel, nama, success: false, error: profError.message })
          continue
        }

        if (!prof?.id) {
          failed += 1
          results.push({ rowNumber, kodeMapel, nama, success: false, error: `Pengampu tidak ditemukan (email=${pengampuEmail})` })
          continue
        }

        const { data: staffExists, error: staffExistsError } = await supabaseAdmin
          .from('staff')
          .select('id')
          .eq('id', prof.id)
          .maybeSingle()

        if (staffExistsError) {
          failed += 1
          results.push({ rowNumber, kodeMapel, nama, success: false, error: staffExistsError.message })
          continue
        }

        if (!staffExists?.id) {
          failed += 1
          results.push({ rowNumber, kodeMapel, nama, success: false, error: `Pengampu bukan staff (email=${pengampuEmail})` })
          continue
        }

        pengampuId = staffExists.id
      } else {
        failed += 1
        results.push({ rowNumber, kodeMapel, nama, success: false, error: 'pengampu_id atau (pengampu_employee_id/pengampu_email) wajib diisi' })
        continue
      }

      let existingId: string | null = null
      if (kodeMapel) {
        const { data: ex, error: exError } = await supabaseAdmin
          .from('mapel')
          .select('id')
          .eq('kelas_id', kelasId)
          .eq('kode_mapel', kodeMapel)
          .limit(2)

        if (exError) {
          failed += 1
          results.push({ rowNumber, kodeMapel, nama, success: false, error: exError.message })
          continue
        }
        existingId = ex?.[0]?.id || null
      } else {
        const { data: ex, error: exError } = await supabaseAdmin
          .from('mapel')
          .select('id')
          .eq('kelas_id', kelasId)
          .eq('nama', nama)
          .limit(2)

        if (exError) {
          failed += 1
          results.push({ rowNumber, kodeMapel, nama, success: false, error: exError.message })
          continue
        }
        existingId = ex?.[0]?.id || null
      }

      const payloadMapel: Record<string, unknown> = {
        nama,
        kode_mapel: kodeMapel || null,
        kategori: kategori as any,
        status: (status as any) || 'aktif',
        kelas_id: kelasId,
        pengampu_id: pengampuId,
        kkm: typeof kkm === 'number' ? kkm : null,
        updated_at: new Date().toISOString(),
      }

      if (existingId) {
        if (dryRun) {
          updated += 1
          results.push({ rowNumber, kodeMapel, nama, action: 'updated', success: true, mapelId: existingId })
          continue
        }

        const { error: updateError } = await supabaseAdmin
          .from('mapel')
          .update(payloadMapel)
          .eq('id', existingId)

        if (updateError) {
          failed += 1
          results.push({ rowNumber, kodeMapel, nama, success: false, error: updateError.message })
          continue
        }

        updated += 1
        results.push({ rowNumber, kodeMapel, nama, action: 'updated', success: true, mapelId: existingId })
        continue
      }

      if (dryRun) {
        created += 1
        results.push({ rowNumber, kodeMapel, nama, action: 'created', success: true })
        continue
      }

      const { data: inserted, error: insertError } = await supabaseAdmin
        .from('mapel')
        .insert(payloadMapel)
        .select('id')
        .maybeSingle()

      if (insertError) {
        failed += 1
        results.push({ rowNumber, kodeMapel, nama, success: false, error: insertError.message })
        continue
      }

      created += 1
      results.push({ rowNumber, kodeMapel, nama, action: 'created', success: true, mapelId: inserted?.id })
    }

    return new Response(
      JSON.stringify({
        success: true,
        dryRun,
        summary: { created, updated, failed, total: rows.length },
        results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as any)?.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
