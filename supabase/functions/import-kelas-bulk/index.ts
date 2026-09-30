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

type UserStatus = 'aktif' | 'nonaktif' | 'cuti' | 'alumni'

interface ImportKelasRow {
  rowNumber: number
  nama: string
  tingkat: string
  tahunAjaran: string
  status?: UserStatus
  walikelasId?: string
  walikelasEmployeeId?: string
  walikelasEmail?: string
}

interface ImportRequest {
  rows: ImportKelasRow[]
  dryRun?: boolean
}

interface ImportResult {
  rowNumber: number
  nama?: string
  tingkat?: string
  tahunAjaran?: string
  action?: 'created' | 'updated'
  success: boolean
  error?: string
  kelasId?: string
}

const normalizeText = (v: unknown) => {
  if (v === null || v === undefined) return ''
  return String(v).trim()
}

const normalizeEmployeeId = (v: unknown) => {
  const s = normalizeText(v)
  return s.replace(/\.0$/, '').replace(/\s+/g, '')
}

const isValidStatus = (v: string): v is UserStatus => {
  return v === 'aktif' || v === 'nonaktif' || v === 'cuti' || v === 'alumni'
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
      return new Response(JSON.stringify({ error: 'Forbidden - Only admins can import kelas' }), {
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

    const { data: staffData, error: staffError } = await supabaseAdmin
      .from('staff')
      .select('id, employee_id')
      .limit(5000)

    if (staffError) {
      return new Response(JSON.stringify({ error: staffError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

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
      const nama = normalizeText(row?.nama)
      const tingkat = normalizeText(row?.tingkat)
      const tahunAjaran = normalizeText(row?.tahunAjaran)
      const statusRaw = normalizeText(row?.status).toLowerCase()
      const walikelasIdRaw = normalizeText(row?.walikelasId)
      const walikelasEmployeeId = normalizeEmployeeId(row?.walikelasEmployeeId)
      const walikelasEmail = normalizeText(row?.walikelasEmail).toLowerCase()

      if (!nama || !tingkat || !tahunAjaran) {
        failed += 1
        results.push({ rowNumber, nama, tingkat, tahunAjaran, success: false, error: 'Nama, tingkat, dan tahun_ajaran wajib diisi' })
        continue
      }

      const status = isValidStatus(statusRaw) ? statusRaw : undefined
      if (statusRaw && !status) {
        failed += 1
        results.push({ rowNumber, nama, tingkat, tahunAjaran, success: false, error: 'Status tidak valid' })
        continue
      }

      let walikelasId: string | null = null
      if (walikelasIdRaw) {
        walikelasId = walikelasIdRaw
      } else if (walikelasEmployeeId) {
        walikelasId = staffByEmployeeId.get(walikelasEmployeeId.toLowerCase()) || null
        if (!walikelasId) {
          failed += 1
          results.push({ rowNumber, nama, tingkat, tahunAjaran, success: false, error: `Wali kelas tidak ditemukan (employee_id=${walikelasEmployeeId})` })
          continue
        }
      } else if (walikelasEmail) {
        const { data: prof, error: profError } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('email', walikelasEmail)
          .maybeSingle()

        if (profError) {
          failed += 1
          results.push({ rowNumber, nama, tingkat, tahunAjaran, success: false, error: profError.message })
          continue
        }

        if (!prof?.id) {
          failed += 1
          results.push({ rowNumber, nama, tingkat, tahunAjaran, success: false, error: `Wali kelas tidak ditemukan (email=${walikelasEmail})` })
          continue
        }

        const { data: staffExists, error: staffExistsError } = await supabaseAdmin
          .from('staff')
          .select('id')
          .eq('id', prof.id)
          .maybeSingle()

        if (staffExistsError) {
          failed += 1
          results.push({ rowNumber, nama, tingkat, tahunAjaran, success: false, error: staffExistsError.message })
          continue
        }

        if (!staffExists?.id) {
          failed += 1
          results.push({ rowNumber, nama, tingkat, tahunAjaran, success: false, error: `Wali kelas bukan staff (email=${walikelasEmail})` })
          continue
        }

        walikelasId = staffExists.id
      }

      const { data: existing, error: existingError } = await supabaseAdmin
        .from('kelas')
        .select('id')
        .eq('nama', nama)
        .eq('tingkat', tingkat)
        .eq('tahun_ajaran', tahunAjaran)
        .limit(2)

      if (existingError) {
        failed += 1
        results.push({ rowNumber, nama, tingkat, tahunAjaran, success: false, error: existingError.message })
        continue
      }

      const existingId = existing?.[0]?.id as string | undefined
      const payloadKelas: Record<string, unknown> = {
        nama,
        tingkat,
        tahun_ajaran: tahunAjaran,
        walikelas_id: walikelasId,
        status: (status as any) || 'aktif',
        updated_at: new Date().toISOString(),
      }

      if (existingId) {
        if (dryRun) {
          updated += 1
          results.push({ rowNumber, nama, tingkat, tahunAjaran, action: 'updated', success: true, kelasId: existingId })
          continue
        }

        const { error: updateError } = await supabaseAdmin
          .from('kelas')
          .update(payloadKelas)
          .eq('id', existingId)

        if (updateError) {
          failed += 1
          results.push({ rowNumber, nama, tingkat, tahunAjaran, success: false, error: updateError.message })
          continue
        }

        updated += 1
        results.push({ rowNumber, nama, tingkat, tahunAjaran, action: 'updated', success: true, kelasId: existingId })
        continue
      }

      if (dryRun) {
        created += 1
        results.push({ rowNumber, nama, tingkat, tahunAjaran, action: 'created', success: true })
        continue
      }

      const { data: inserted, error: insertError } = await supabaseAdmin
        .from('kelas')
        .insert(payloadKelas)
        .select('id')
        .maybeSingle()

      if (insertError) {
        failed += 1
        results.push({ rowNumber, nama, tingkat, tahunAjaran, success: false, error: insertError.message })
        continue
      }

      created += 1
      results.push({ rowNumber, nama, tingkat, tahunAjaran, action: 'created', success: true, kelasId: inserted?.id })
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
