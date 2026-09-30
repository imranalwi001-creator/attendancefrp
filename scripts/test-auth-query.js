import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'http://127.0.0.1:54321';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'; // anon key

const supabase = createClient(supabaseUrl, supabaseKey);

async function testAuthQuery() {
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: 'admin@pesantren.app',
    password: 'Admin@123!'
  });

  if (signInError) {
    console.error('Sign in failed:', signInError);
    return;
  }

  const userId = signInData.user.id;
  console.log('Logged in as:', userId);

  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select(`
      workspace_id,
      workspaces (
        type,
        education_level
      )
    `)
    .eq('id', userId)
    .single();

  console.log("PROFILE DATA:", JSON.stringify(profileData, null, 2));
  console.log("PROFILE ERROR:", JSON.stringify(profileError, null, 2));
}

testAuthQuery();
