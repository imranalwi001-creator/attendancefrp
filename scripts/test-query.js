import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'http://127.0.0.1:54321';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testQuery() {
  const email = 'admin@pesantren.app';
  const { data: users } = await supabase.auth.admin.listUsers();
  const user = users.users.find(u => u.email === email);
  
  if (!user) return;

  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select(`
      workspace_id,
      workspaces (
        type,
        education_level
      )
    `)
    .eq('id', user.id)
    .single();

  console.log("PROFILE DATA:", JSON.stringify(profileData, null, 2));
  console.log("PROFILE ERROR:", profileError);
}

testQuery();
