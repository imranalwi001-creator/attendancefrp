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

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = getDefaultKey(Deno.env.get('SUPABASE_SECRET_KEYS') ?? undefined, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')

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

    // Check if admin already exists
    const { data: existingAdmin } = await supabaseAdmin
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin')
      .limit(1)
      .single()

    if (existingAdmin) {
      console.log('Admin already exists')
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Admin user already exists. Use login to access admin panel.',
          hint: 'If you forgot the password, contact the system administrator.'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create admin credentials
    const adminEmail = 'admin@pesantren.app'
    const adminPassword = 'Admin@123!'
    const adminName = 'Administrator'

    const { data: usersData, error: listUsersError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    })

    if (listUsersError) {
      console.error('Error listing users:', listUsersError)
      return new Response(
        JSON.stringify({ error: listUsersError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const existingUser = usersData?.users?.find(
      (u) => (u.email || '').toLowerCase() === adminEmail.toLowerCase()
    )

    let userId: string
    let wasCreated = false

    if (existingUser) {
      userId = existingUser.id
      console.log('Admin auth user already exists:', userId)
    } else {
      console.log('Creating admin user:', adminEmail)

      const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: adminEmail,
        password: adminPassword,
        email_confirm: true,
        user_metadata: { name: adminName }
      })

      if (createError) {
        console.error('Error creating admin:', createError)
        return new Response(
          JSON.stringify({ error: createError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      userId = authData.user.id
      wasCreated = true
      console.log('Admin auth user created:', userId)
    }

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert(
        { id: userId, name: adminName, email: adminEmail, status: 'aktif' as any },
        { onConflict: 'id' }
      )

    if (profileError) {
      console.error('Error updating profile:', profileError)
    }

    // Set admin role (ensure row exists)
    const { error: deleteRoleError } = await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', userId)

    if (deleteRoleError) {
      console.error('Error clearing existing roles:', deleteRoleError)
    }

    const { error: insertRoleError } = await supabaseAdmin
      .from('user_roles')
      .insert({ user_id: userId, role: 'admin' })

    if (insertRoleError) {
      console.error('Error setting admin role:', insertRoleError)
      return new Response(
        JSON.stringify({ error: insertRoleError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Admin user ready:', userId)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: wasCreated ? 'Admin user created successfully' : 'Admin user role restored successfully',
        credentials: wasCreated ? { email: adminEmail, password: adminPassword } : { email: adminEmail },
        warning: wasCreated ? 'Please change the password immediately after first login!' : undefined
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
