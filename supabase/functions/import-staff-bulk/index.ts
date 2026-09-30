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
type StaffRole = 'admin' | 'guru' | 'walikelas' | 'Pembina' | 'staff' | 'guru_ekskul'

interface ImportStaffRow {
  rowNumber: number
  employeeId?: string
  name?: string
  email?: string
  phone?: string
  status?: UserStatus
  role?: StaffRole
  kelasId?: string
  kelasNama?: string
  tahunAjaran?: string
}

interface ImportRequest {
  rows: ImportStaffRow[]
  dryRun?: boolean
}

interface ImportResult {
  rowNumber: number
  employeeId?: string
  email?: string
  action?: 'created' | 'updated'
  success: boolean
  error?: string
  userId?: string
  password?: string
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

const isValidRole = (v: string): v is StaffRole => {
  return v === 'admin' || v === 'guru' || v === 'walikelas' || v === 'Pembina' || v === 'staff' || v === 'guru_ekskul'
}

const generatePassword = () => crypto.randomUUID().replace(/-/g, '').slice(0, 12)

const placeholderEmail = (employeeId: string) => `nip-${employeeId}@digiss.invalid`

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
      return new Response(JSON.stringify({ error: 'Forbidden - Only admins can import staff' }), {
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
      .limit(2000)
      
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
      const employeeId = normalizeEmployeeId(row?.employeeId)
      const name = normalizeText(row?.name)
      const emailRaw = normalizeText(row?.email).toLowerCase()
      const phone = normalizeText(row?.phone)
      const statusRaw = normalizeText(row?.status).toLowerCase()
      const roleRaw = normalizeText(row?.role)
      const role = isValidRole(roleRaw) ? roleRaw : 'staff'
      const kelasIdRaw = normalizeText(row?.kelasId)
      const kelasNama = normalizeText(row?.kelasNama)
      const tahunAjaran = normalizeText(row?.tahunAjaran)

      const status = isValidStatus(statusRaw) ? statusRaw : undefined
      if (statusRaw && !status) {
        failed += 1
        results.push({ rowNumber, employeeId, email: emailRaw || undefined, success: false, error: 'Status tidak valid' })
        continue
      }

      let resolvedKelasId: string | null = null
      if (role === 'walikelas') {
        if (kelasIdRaw) {
          resolvedKelasId = kelasIdRaw
        } else if (kelasNama && tahunAjaran) {
          const key = `${kelasNama.toLowerCase()}|${tahunAjaran.toLowerCase()}`
          resolvedKelasId = kelasMap.get(key) || null
          if (!resolvedKelasId) {
            failed += 1
            results.push({ rowNumber, employeeId, email: emailRaw || undefined, success: false, error: `Kelas tidak ditemukan: ${kelasNama} (${tahunAjaran})` })
            continue
          }
        }
      }

      if (!employeeId && !emailRaw) {
        failed += 1
        results.push({ rowNumber, success: false, error: 'Employee ID atau email wajib diisi' })
        continue
      }

      let existingUserId: string | null = null
      if (employeeId) {
        let staffMatchQuery = supabaseAdmin
          .from('staff')
          .select('id')
          .eq('employee_id', employeeId)
          .limit(2)
          
        if (callerWorkspaceId) {
          staffMatchQuery = staffMatchQuery.eq('workspace_id', callerWorkspaceId)
        }

        const { data: staffMatch, error: staffMatchError } = await staffMatchQuery

        if (staffMatchError) {
          failed += 1
          results.push({ rowNumber, employeeId, email: emailRaw || undefined, success: false, error: staffMatchError.message })
          continue
        }
        existingUserId = staffMatch?.[0]?.id || null
      }

      if (!existingUserId && emailRaw) {
        const { data: profileMatch, error: profileMatchError } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('email', emailRaw)
          .limit(2)

        if (profileMatchError) {
          failed += 1
          results.push({ rowNumber, employeeId, email: emailRaw || undefined, success: false, error: profileMatchError.message })
          continue
        }
        const candidateId = profileMatch?.[0]?.id || null
        if (candidateId) {
          const { data: staffExist, error: staffExistError } = await supabaseAdmin
            .from('staff')
            .select('id')
            .eq('id', candidateId)
            .maybeSingle()

          if (staffExistError) {
            failed += 1
            results.push({ rowNumber, employeeId, email: emailRaw || undefined, success: false, error: staffExistError.message })
            continue
          }

          if (staffExist?.id) existingUserId = staffExist.id
        }
      }

      if (existingUserId) {
        if (dryRun) {
          updated += 1
          results.push({ rowNumber, employeeId, email: emailRaw || undefined, action: 'updated', success: true, userId: existingUserId })
          continue
        }

        const profileUpdate: Record<string, unknown> = {}
        if (name) profileUpdate.name = name
        if (phone) profileUpdate.phone = phone
        if (status) profileUpdate.status = status

        if (Object.keys(profileUpdate).length > 0) {
          const { error: profileUpdateError } = await supabaseAdmin
            .from('profiles')
            .update(profileUpdate)
            .eq('id', existingUserId)

          if (profileUpdateError) {
            failed += 1
            results.push({ rowNumber, employeeId, email: emailRaw || undefined, success: false, error: profileUpdateError.message })
            continue
          }
        }

        const { error: setRoleError } = await supabaseAdmin.rpc('set_user_role', {
          _user_id: existingUserId,
          _role: role,
        })

        if (setRoleError) {
          failed += 1
          results.push({ rowNumber, employeeId, email: emailRaw || undefined, success: false, error: setRoleError.message })
          continue
        }

        const staffUpsert: Record<string, unknown> = { id: existingUserId, position: role }
        if (employeeId) staffUpsert.employee_id = employeeId
        staffUpsert.kelas_id = (role === 'walikelas' && resolvedKelasId) ? resolvedKelasId : null

        const { error: staffError } = await supabaseAdmin.from('staff').upsert(staffUpsert)
        if (staffError) {
          failed += 1
          results.push({ rowNumber, employeeId, email: emailRaw || undefined, success: false, error: staffError.message })
          continue
        }

        updated += 1
        results.push({ rowNumber, employeeId, email: emailRaw || undefined, action: 'updated', success: true, userId: existingUserId })
        continue
      }

      if (!emailRaw && !employeeId) {
        failed += 1
        results.push({ rowNumber, success: false, error: 'Email kosong: employee_id wajib untuk membuat placeholder email' })
        continue
      }

      const email = emailRaw || placeholderEmail(employeeId)
      if (dryRun) {
        created += 1
        results.push({ rowNumber, employeeId, email, action: 'created', success: true })
        continue
      }

      const password = generatePassword()

      const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name: name || (employeeId ? `Staff ${employeeId}` : 'Staff') },
      })

      if (createError || !authData?.user?.id) {
        failed += 1
        results.push({ rowNumber, employeeId, email, success: false, error: createError?.message || 'Gagal membuat akun staff' })
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
            name: name || (employeeId ? `Staff ${employeeId}` : 'Staff'),
            email,
            phone: phone || null,
            status: (status as any) || 'aktif',
            workspace_id: callerWorkspaceId
          },
          { onConflict: 'id' }
        )

      if (profileError) {
        await rollback()
        failed += 1
        results.push({ rowNumber, employeeId, email, success: false, error: profileError.message })
        continue
      }

      const { error: setRoleError } = await supabaseAdmin.rpc('set_user_role', {
        _user_id: userId,
        _role: role,
      })

      if (setRoleError) {
        await rollback()
        failed += 1
        results.push({ rowNumber, employeeId, email, success: false, error: setRoleError.message })
        continue
      }

      const staffUpsert: Record<string, unknown> = {
        id: userId,
        employee_id: employeeId || null,
        position: role,
        kelas_id: (role === 'walikelas' && resolvedKelasId) ? resolvedKelasId : null,
        workspace_id: callerWorkspaceId
      }

      const { error: staffError } = await supabaseAdmin.from('staff').upsert(staffUpsert)
      if (staffError) {
        await rollback()
        failed += 1
        results.push({ rowNumber, employeeId, email, success: false, error: staffError.message })
        continue
      }

      created += 1
      results.push({ rowNumber, employeeId, email, action: 'created', success: true, userId, password })
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
