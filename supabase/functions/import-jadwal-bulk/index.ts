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

type JadwalStatus = 'aktif' | 'nonaktif'
type Semester = 'ganjil' | 'genap'

interface ImportJadwalRow {
  rowNumber: number
  kelasId?: string
  kelasNama?: string
  tahunAjaran?: string
  semester: Semester
  hari: string
  jamMulai: string
  jamSelesai: string
  tipe: string
  kategori: string
  status?: JadwalStatus
  label?: string
  ruangan?: string
  blockId?: string
  mapelId?: string
  kodeMapel?: string
  pengampuId?: string
  pengampuEmployeeId?: string
  pengampuEmail?: string
}

interface ImportRequest {
  rows: ImportJadwalRow[]
  dryRun?: boolean
}

interface ImportResult {
  rowNumber: number
  action?: 'created' | 'updated'
  success: boolean
  error?: string
  jadwalId?: string
}

const normalizeText = (v: unknown) => {
  if (v === null || v === undefined) return ''
  return String(v).trim()
}

const normalizeEmployeeId = (v: unknown) => {
  const s = normalizeText(v)
  return s.replace(/\.0$/, '').replace(/\s+/g, '')
}

const isValidSemester = (v: string): v is Semester => {
  return v === 'ganjil' || v === 'genap'
}

const isValidStatus = (v: string): v is JadwalStatus => {
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
      return new Response(JSON.stringify({ error: 'Forbidden - Only admins can import jadwal' }), {
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

    const [{ data: kelasData, error: kelasError }, { data: mapelData, error: mapelError }, { data: staffData, error: staffError }] = await Promise.all([
      supabaseAdmin.from('kelas').select('id, nama, tahun_ajaran').limit(2000),
      supabaseAdmin.from('mapel').select('id, kelas_id, kode_mapel, nama').limit(5000),
      supabaseAdmin.from('staff').select('id, employee_id').limit(5000),
    ])

    if (kelasError) {
      return new Response(JSON.stringify({ error: kelasError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (mapelError) {
      return new Response(JSON.stringify({ error: mapelError.message }), {
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

    const mapelByKode = new Map<string, string>()
    ;(mapelData || []).forEach((m: any) => {
      const kode = normalizeText(m.kode_mapel)
      if (!kode) return
      const key = `${m.kelas_id}|${kode.toLowerCase()}`
      mapelByKode.set(key, m.id)
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
      const kelasIdRaw = normalizeText(row?.kelasId)
      const kelasNama = normalizeText(row?.kelasNama)
      const tahunAjaran = normalizeText(row?.tahunAjaran)
      const semesterRaw = normalizeText(row?.semester).toLowerCase()
      const hari = normalizeText(row?.hari)
      const jamMulai = normalizeText(row?.jamMulai)
      const jamSelesai = normalizeText(row?.jamSelesai)
      const tipe = normalizeText(row?.tipe)
      const kategori = normalizeText(row?.kategori)
      const statusRaw = normalizeText(row?.status).toLowerCase()
      const label = normalizeText(row?.label)
      const ruangan = normalizeText(row?.ruangan)
      const blockIdRaw = normalizeText(row?.blockId)
      const mapelIdRaw = normalizeText(row?.mapelId)
      const kodeMapel = normalizeText(row?.kodeMapel)
      const pengampuIdRaw = normalizeText(row?.pengampuId)
      const pengampuEmployeeId = normalizeEmployeeId(row?.pengampuEmployeeId)
      const pengampuEmail = normalizeText(row?.pengampuEmail).toLowerCase()

      const semester = isValidSemester(semesterRaw) ? semesterRaw : undefined
      if (!semester) {
        failed += 1
        results.push({ rowNumber, success: false, error: 'Semester tidak valid (ganjil/genap)' })
        continue
      }

      if (!hari || !jamMulai || !jamSelesai || !tipe || !kategori) {
        failed += 1
        results.push({ rowNumber, success: false, error: 'hari, jam_mulai, jam_selesai, tipe, kategori wajib diisi' })
        continue
      }

      const status = isValidStatus(statusRaw) ? statusRaw : undefined
      if (statusRaw && !status) {
        failed += 1
        results.push({ rowNumber, success: false, error: 'Status tidak valid (aktif/nonaktif)' })
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
          results.push({ rowNumber, success: false, error: `Kelas tidak ditemukan: ${kelasNama} (${tahunAjaran})` })
          continue
        }
      } else {
        failed += 1
        results.push({ rowNumber, success: false, error: 'kelas_id atau (nama_kelas+tahun_ajaran) wajib diisi' })
        continue
      }

      let mapelId: string | null = null
      if (mapelIdRaw) {
        mapelId = mapelIdRaw
      } else if (kodeMapel) {
        mapelId = mapelByKode.get(`${kelasId}|${kodeMapel.toLowerCase()}`) || null
        if (!mapelId) {
          failed += 1
          results.push({ rowNumber, success: false, error: `Mapel tidak ditemukan (kode_mapel=${kodeMapel}) untuk kelas_id=${kelasId}` })
          continue
        }
      }

      let pengampuId: string | null = null
      if (pengampuIdRaw) {
        pengampuId = pengampuIdRaw
      } else if (pengampuEmployeeId) {
        pengampuId = staffByEmployeeId.get(pengampuEmployeeId.toLowerCase()) || null
        if (!pengampuId) {
          failed += 1
          results.push({ rowNumber, success: false, error: `Pengampu tidak ditemukan (employee_id=${pengampuEmployeeId})` })
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
          results.push({ rowNumber, success: false, error: profError.message })
          continue
        }

        if (!prof?.id) {
          failed += 1
          results.push({ rowNumber, success: false, error: `Pengampu tidak ditemukan (email=${pengampuEmail})` })
          continue
        }

        const { data: staffExists, error: staffExistsError } = await supabaseAdmin
          .from('staff')
          .select('id')
          .eq('id', prof.id)
          .maybeSingle()

        if (staffExistsError) {
          failed += 1
          results.push({ rowNumber, success: false, error: staffExistsError.message })
          continue
        }

        if (!staffExists?.id) {
          failed += 1
          results.push({ rowNumber, success: false, error: `Pengampu bukan staff (email=${pengampuEmail})` })
          continue
        }

        pengampuId = staffExists.id
      }

      let query = supabaseAdmin
        .from('jadwal')
        .select('id')
        .eq('kelas_id', kelasId)
        .eq('semester', semester)
        .eq('hari', hari)
        .eq('jam_mulai', jamMulai)
        .eq('jam_selesai', jamSelesai)
        .eq('tipe', tipe)
        .limit(2)

      if (blockIdRaw) {
        query = query.eq('block_id', blockIdRaw)
      } else {
        query = query.is('block_id', null)
      }

      const { data: existing, error: existingError } = await query
      if (existingError) {
        failed += 1
        results.push({ rowNumber, success: false, error: existingError.message })
        continue
      }

      const existingId = existing?.[0]?.id as string | undefined
      const payloadJadwal: Record<string, unknown> = {
        kelas_id: kelasId,
        semester,
        hari,
        jam_mulai: jamMulai,
        jam_selesai: jamSelesai,
        tipe,
        kategori,
        status: (status as any) || 'aktif',
        label: label || null,
        ruangan: ruangan || null,
        block_id: blockIdRaw || null,
        mapel_id: mapelId,
        pengampu_id: pengampuId,
        updated_at: new Date().toISOString(),
      }

      if (existingId) {
        if (dryRun) {
          updated += 1
          results.push({ rowNumber, action: 'updated', success: true, jadwalId: existingId })
          continue
        }

        const { error: updateError } = await supabaseAdmin
          .from('jadwal')
          .update(payloadJadwal)
          .eq('id', existingId)

        if (updateError) {
          failed += 1
          results.push({ rowNumber, success: false, error: updateError.message })
          continue
        }

        updated += 1
        results.push({ rowNumber, action: 'updated', success: true, jadwalId: existingId })
        continue
      }

      if (dryRun) {
        created += 1
        results.push({ rowNumber, action: 'created', success: true })
        continue
      }

      const { data: inserted, error: insertError } = await supabaseAdmin
        .from('jadwal')
        .insert(payloadJadwal)
        .select('id')
        .maybeSingle()

      if (insertError) {
        failed += 1
        results.push({ rowNumber, success: false, error: insertError.message })
        continue
      }

      created += 1
      results.push({ rowNumber, action: 'created', success: true, jadwalId: inserted?.id })
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
