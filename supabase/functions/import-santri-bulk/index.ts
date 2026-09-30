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

interface ImportSantriRow {
  rowNumber: number
  nisn: string
  nis?: string
  name?: string
  email?: string
  status?: UserStatus
  kelasId?: string
  kelasNama?: string
  tahunAjaran?: string
}

interface ImportRequest {
  rows: ImportSantriRow[]
  dryRun?: boolean
}

interface ImportResult {
  rowNumber: number
  nisn?: string
  action?: 'created' | 'updated' | 'skipped'
  success: boolean
  error?: string
  userId?: string
  email?: string
  password?: string
}

const normalizeText = (v: string | undefined | null) => (v ?? '').trim()

const normalizeNisn = (v: unknown) => {
  if (v === null || v === undefined) return ''
  const s = String(v).trim()
  return s.replace(/\.0$/, '').replace(/\s+/g, '')
}

const isValidStatus = (v: string): v is UserStatus => {
  return v === 'aktif' || v === 'nonaktif' || v === 'cuti' || v === 'alumni'
}

const generatePassword = () => crypto.randomUUID().replace(/-/g, '').slice(0, 12)

const placeholderEmail = (nisn: string) => `nisn-${nisn}@digiss.invalid`

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

    const { data: isAdmin, error: roleError } = await supabaseAdmin
      .rpc('has_role', { _user_id: callerUser.id, _role: 'admin' })

    if (roleError) {
      return new Response(JSON.stringify({ error: 'Failed to verify admin status' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden - Only admins can import santri' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get caller's workspace_id
    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('workspace_id')
      .eq('id', callerUser.id)
      .single()

    const callerWorkspaceId = callerProfile?.workspace_id || null

    const payload: ImportRequest = await req.json()
    const rows = payload?.rows || []
    const dryRun = !!payload?.dryRun

    if (!Array.isArray(rows) || rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Rows is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let kelasQuery = supabaseAdmin
      .from('kelas')
      .select('id, nama, tahun_ajaran')
      .limit(1000)
      
    if (callerWorkspaceId) {
      kelasQuery = kelasQuery.eq('workspace_id', callerWorkspaceId)
    }

    const { data: kelasData, error: kelasError } = await kelasQuery

    if (kelasError) {
      return new Response(JSON.stringify({ error: kelasError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const kelasMap = new Map<string, string>()
    ;(kelasData || []).forEach((k: any) => {
      const key = `${normalizeText(k.nama).toLowerCase()}|${normalizeText(k.tahun_ajaran).toLowerCase()}`
      if (k.id && key !== '|') kelasMap.set(key, k.id)
    })

    const results: ImportResult[] = []
    let created = 0
    let updated = 0
    let failed = 0

    for (const row of rows) {
      const rowNumber = Number(row?.rowNumber || 0) || 0
      const nisn = normalizeNisn(row?.nisn)
      const nis = normalizeText(row?.nis)
      const name = normalizeText(row?.name)
      const emailRaw = normalizeText(row?.email)
      const statusRaw = normalizeText(row?.status)
      const status = isValidStatus(statusRaw) ? statusRaw : undefined
      const kelasIdRaw = normalizeText(row?.kelasId)
      const kelasNama = normalizeText(row?.kelasNama)
      const tahunAjaran = normalizeText(row?.tahunAjaran)

      if (!nisn) {
        failed += 1
        results.push({ rowNumber, success: false, error: 'NISN wajib diisi' })
        continue
      }

      if (!/^\d{10}$/.test(nisn)) {
        failed += 1
        results.push({ rowNumber, nisn, success: false, error: 'NISN harus 10 digit angka' })
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
          results.push({ rowNumber, nisn, success: false, error: `Kelas tidak ditemukan: ${kelasNama} (${tahunAjaran})` })
          continue
        }
      }

      let existingSantriQuery = supabaseAdmin
        .from('santri')
        .select('id, nisn')
        .eq('nisn', nisn)
        .limit(2)
        
      if (callerWorkspaceId) {
        existingSantriQuery = existingSantriQuery.eq('workspace_id', callerWorkspaceId)
      }

      const { data: existingSantri, error: existingError } = await existingSantriQuery

      if (existingError) {
        failed += 1
        results.push({ rowNumber, nisn, success: false, error: existingError.message })
        continue
      }

      const existingId = existingSantri?.[0]?.id as string | undefined
      if (existingId) {
        if (dryRun) {
          updated += 1
          results.push({ rowNumber, nisn, action: 'updated', success: true, userId: existingId })
          continue
        }

        const santriUpdate: Record<string, unknown> = {}
        if (nisn) santriUpdate.nisn = nisn
        if (nis) santriUpdate.nis = nis
        if (kelasId !== null) santriUpdate.kelas_id = kelasId
        santriUpdate.updated_at = new Date().toISOString()

        const profileUpdate: Record<string, unknown> = {}
        if (name) profileUpdate.name = name
        if (status) profileUpdate.status = status

        const { error: santriUpdateError } = await supabaseAdmin
          .from('santri')
          .update(santriUpdate)
          .eq('id', existingId)

        if (santriUpdateError) {
          failed += 1
          results.push({ rowNumber, nisn, success: false, error: santriUpdateError.message })
          continue
        }

        if (Object.keys(profileUpdate).length > 0) {
          const { error: profileUpdateError } = await supabaseAdmin
            .from('profiles')
            .update(profileUpdate)
            .eq('id', existingId)

          if (profileUpdateError) {
            failed += 1
            results.push({ rowNumber, nisn, success: false, error: profileUpdateError.message })
            continue
          }
        }

        updated += 1
        results.push({ rowNumber, nisn, action: 'updated', success: true, userId: existingId })
        continue
      }

      const email = emailRaw || placeholderEmail(nisn)
      if (dryRun) {
        created += 1
        results.push({ rowNumber, nisn, action: 'created', success: true, email })
        continue
      }

      const password = generatePassword()

      const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name: name || `Santri ${nisn}` },
      })

      if (createError || !authData?.user?.id) {
        failed += 1
        results.push({ rowNumber, nisn, success: false, error: createError?.message || 'Gagal membuat akun santri' })
        continue
      }

      const userId = authData.user.id
      const rollback = async () => {
        try {
          await supabaseAdmin.auth.admin.deleteUser(userId)
        } catch {
        }
      }

      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .upsert(
          {
            id: userId,
            name: name || `Santri ${nisn}`,
            email,
            status: (status as any) || 'aktif',
            workspace_id: callerWorkspaceId
          },
          { onConflict: 'id' }
        )

      if (profileError) {
        await rollback()
        failed += 1
        results.push({ rowNumber, nisn, success: false, error: profileError.message })
        continue
      }

      const { error: setRoleError } = await supabaseAdmin.rpc('set_user_role', {
        _user_id: userId,
        _role: 'santri',
      })

      if (setRoleError) {
        await rollback()
        failed += 1
        results.push({ rowNumber, nisn, success: false, error: setRoleError.message })
        continue
      }

      const { error: santriError } = await supabaseAdmin
        .from('santri')
        .upsert({
          id: userId,
          kelas_id: kelasId,
          nisn,
          nis: nis || null,
          workspace_id: callerWorkspaceId
        })

      if (santriError) {
        await rollback()
        failed += 1
        results.push({ rowNumber, nisn, success: false, error: santriError.message })
        continue
      }

      created += 1
      results.push({
        rowNumber,
        nisn,
        action: 'created',
        success: true,
        userId,
        email,
        password,
      })
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
