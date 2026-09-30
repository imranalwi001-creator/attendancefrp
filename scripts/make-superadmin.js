import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'http://127.0.0.1:54321';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function makeSuperadmin() {
  const email = 'admin@pesantren.app';
  
  // 1. Get user ID
  const { data: users, error: fetchError } = await supabase.auth.admin.listUsers();
  if (fetchError) {
    console.error('Gagal mengambil daftar user:', fetchError);
    return;
  }
  const user = users.users.find(u => u.email === email);
  if (!user) {
    console.error('User tidak ditemukan.');
    return;
  }

  console.log(`Menjadikan ${email} sebagai Superadmin SaaS (mandiri)...`);

  // 2. Cek atau Buat workspace tipe 'mandiri'
  let { data: workspaces, error: wsError } = await supabase
    .from('workspaces')
    .select('id')
    .eq('type', 'mandiri')
    .limit(1);

  let workspaceId;

  if (workspaces && workspaces.length > 0) {
    workspaceId = workspaces[0].id;
    console.log('Menggunakan workspace mandiri yang sudah ada:', workspaceId);
  } else {
    // Buat baru
    const { data: newWs, error: newWsError } = await supabase
      .from('workspaces')
      .insert({
        name: 'SaaS Global Control Center',
        type: 'mandiri',
        education_level: 'pesantren',
        owner_id: user.id
      })
      .select('id')
      .single();

    if (newWsError) {
      console.error('Gagal membuat workspace:', newWsError);
      return;
    }
    workspaceId = newWs.id;
    console.log('Berhasil membuat workspace mandiri baru:', workspaceId);
  }

  // 3. Update profile user untuk link ke workspace ini dan role admin
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ 
      workspace_id: workspaceId,
      workspace_role: 'admin'
    })
    .eq('id', user.id);
  
  if (profileError) {
    console.error('Gagal update profiles:', profileError);
  } else {
    console.log('Berhasil memperbarui tabel profiles.');
  }

  // 4. Pastikan juga di user_roles
  await supabase
    .from('user_roles')
    .delete()
    .eq('user_id', user.id);

  const { error: roleError } = await supabase
    .from('user_roles')
    .insert({ user_id: user.id, role: 'admin' });
    
  if (roleError) {
    console.error('Gagal menambahkan ke tabel user_roles:', roleError);
  } else {
    console.log('Berhasil memperbarui tabel user_roles.');
    console.log('\n✅ SELESAI! Anda sekarang adalah Global Superadmin. Silakan login kembali / refresh halaman.');
  }
}

makeSuperadmin();
