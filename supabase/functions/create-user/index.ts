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

interface CreateUserRequest {
  email: string
  password: string
  name: string
  role: 'admin' | 'guru' | 'walikelas' | 'santri' | 'orangtua' | 'Pembina' | 'staff' | 'guru_ekskul'
  phone?: string
  employeeId?: string
  kelasId?: string
  status?: 'aktif' | 'nonaktif'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const anonKey = getDefaultKey(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? undefined, Deno.env.get('SUPABASE_ANON_KEY') ?? '')
    const serviceRoleKey = getDefaultKey(Deno.env.get('SUPABASE_SECRET_KEYS') ?? undefined, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')

    const supabaseAuth = createClient(
      supabaseUrl,
      anonKey,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user: callerUser }, error: authError } = await supabaseAuth.auth.getUser(token)
    if (authError || !callerUser) {
      console.error('JWT verification failed:', authError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const callerId = callerUser.id

    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Check if caller is admin (using has_role to support guru mandiri)
    const { data: isAdmin, error: roleError } = await supabaseAdmin
      .rpc('has_role', { _user_id: callerId, _role: 'admin' })

    if (roleError) {
      console.error('Error checking user role:', roleError)
      return new Response(
        JSON.stringify({ error: 'Failed to verify admin status' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Forbidden - Only admins can create users' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get caller's workspace_id
    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('workspace_id')
      .eq('id', callerId)
      .single()

    const callerWorkspaceId = callerProfile?.workspace_id || null

    console.log('Admin verified:', callerId, 'Workspace:', callerWorkspaceId)

    const { email, password, name, role, phone, employeeId, kelasId, status }: CreateUserRequest = await req.json()

    console.log('Creating user:', { email, name, role })

    if (!email || !password || !name || !role) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, password, name, role' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name }
    })

    if (createError) {
      console.error('Error creating auth user:', createError)
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = authData.user.id
    console.log('Auth user created:', userId)

    const rollback = async () => {
      try {
        await supabaseAdmin.auth.admin.deleteUser(userId)
      } catch (e) {
        console.error('Rollback error:', e)
      }
    }

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert(
        {
          id: userId,
          name,
          email,
          phone: phone || null,
          status: (status as any) || 'aktif',
          workspace_id: callerWorkspaceId
        },
        { onConflict: 'id' }
      )

    if (profileError) {
      console.error('Error updating profile:', profileError)
      await rollback()
      return new Response(
        JSON.stringify({ error: profileError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { error: setRoleError } = await supabaseAdmin.rpc('set_user_role', {
      _user_id: userId,
      _role: role
    })

    if (setRoleError) {
      console.error('Error setting role:', setRoleError)
      await rollback()
      return new Response(
        JSON.stringify({ error: setRoleError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (['admin', 'guru', 'walikelas', 'Pembina', 'staff', 'guru_ekskul'].includes(role)) {
      const { error: staffError } = await supabaseAdmin
        .from('staff')
        .upsert({
          id: userId,
          employee_id: employeeId || null,
          position: role,
          kelas_id: (role === 'walikelas' && kelasId) ? kelasId : null
        })

      if (staffError) {
        console.error('Error creating staff record:', staffError)
        await rollback()
        return new Response(
          JSON.stringify({ error: staffError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    if (role === 'santri') {
      const { error: santriError } = await supabaseAdmin
        .from('santri')
        .upsert({
          id: userId,
          kelas_id: kelasId || null,
          workspace_id: callerWorkspaceId
        })

      if (santriError) {
        console.error('Error creating santri record:', santriError)
        await rollback()
        return new Response(
          JSON.stringify({ error: santriError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    console.log('User created successfully:', { userId, email, role })

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: { id: userId, email, name, role } 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
