import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type CleanupRequest = {
  mapelId: string
  semester: 'ganjil' | 'genap'
  /** YYYY-MM-DD in Asia/Jakarta */
  date?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const token = authHeader.replace('Bearer ', '')

    // Decode JWT payload to get user id (sub)
    let userId: string
    try {
      const payloadPart = token.split('.')[1]
      const payload = JSON.parse(atob(payloadPart))
      userId = payload.sub
      if (!userId) throw new Error('No user id')
    } catch {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Admin only
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle()

    if (roleError) {
      return new Response(JSON.stringify({ error: 'Failed to verify role' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!roleData || roleData.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = (await req.json()) as CleanupRequest
    const { mapelId, semester } = body
    const date = body.date ?? new Date().toISOString().slice(0, 10)

    if (!mapelId || !semester) {
      return new Response(JSON.stringify({ error: 'mapelId and semester are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Use Asia/Jakarta boundaries (+07:00)
    const startIso = `${date}T00:00:00+07:00`
    const endIso = `${date}T23:59:59.999+07:00`

    const { data: materiRows, error: fetchError } = await supabaseAdmin
      .from('materi')
      .select('id, judul, deskripsi, created_at')
      .eq('mapel_id', mapelId)
      .eq('semester', semester)
      .gte('created_at', startIso)
      .lte('created_at', endIso)

    if (fetchError) {
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const rows = materiRows ?? []

    // Group duplicates by (judul, deskripsi)
    const groups = new Map<string, { id: string; created_at: string | null }[]>()
    for (const r of rows) {
      const key = `${r.judul ?? ''}||${r.deskripsi ?? ''}`
      const arr = groups.get(key) ?? []
      arr.push({ id: r.id, created_at: r.created_at })
      groups.set(key, arr)
    }

    const toDelete: string[] = []
    for (const [, items] of groups) {
      if (items.length <= 1) continue
      items.sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))
      // Keep the oldest, delete the rest
      for (const it of items.slice(1)) toDelete.push(it.id)
    }

    if (toDelete.length === 0) {
      return new Response(JSON.stringify({ success: true, deleted: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { error: deleteError } = await supabaseAdmin.from('materi').delete().in('id', toDelete)

    if (deleteError) {
      return new Response(JSON.stringify({ error: deleteError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true, deleted: toDelete.length }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
