import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'http://127.0.0.1:54321';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createAdmin() {
  const email = 'admin@pesantren.app';
  const password = 'Admin@123!';

  console.log(`Mencoba membuat user: ${email}...`);

  // 1. Create user in auth.users
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: email,
    password: password,
    email_confirm: true,
  });

  if (authError) {
    if (authError.message.includes('already exists')) {
      console.log('User sudah ada, kita akan memperbarui role-nya saja.');
    } else {
      console.error('Gagal membuat user:', authError);
      return;
    }
  } else {
    console.log('Berhasil membuat user di auth.users dengan ID:', authData.user.id);
  }

  // 2. Get user ID
  const { data: users, error: fetchError } = await supabase.auth.admin.listUsers();
  if (fetchError) {
    console.error('Gagal mengambil daftar user:', fetchError);
    return;
  }
  const user = users.users.find(u => u.email === email);
  if (!user) {
    console.error('User tidak ditemukan setelah dibuat.');
    return;
  }

  // 3. Insert or update in public.profiles (trigger should have done this, but let's make sure it's admin)
  console.log('Memperbarui role menjadi admin di tabel profiles...');
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ workspace_role: 'admin' })
    .eq('id', user.id);
  
  if (profileError) {
    console.error('Gagal update profiles:', profileError);
  } else {
    console.log('Berhasil update tabel profiles.');
  }

  // 4. Insert or update in public.user_roles
  console.log('Memperbarui role menjadi admin di tabel user_roles...');
  
  // First delete any existing role for this user
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
    console.log('Berhasil menambahkan role admin ke tabel user_roles.');
    console.log('\n✅ SELESAI! Anda sekarang bisa login dengan akun:');
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
  }
}

createAdmin();
