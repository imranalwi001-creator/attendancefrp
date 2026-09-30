import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ShieldCheck, Plus, Search, UserCheck, ShieldAlert, 
  Mail, Calendar, Lock, User, MoreVertical, Trash2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface SuperadminUser {
  id: string;
  name: string;
  email: string | null;
  workspace_id: string | null;
  workspace_role: string | null;
  created_at: string;
}

export default function Superadmins() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Form states
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');

  // Fetch superadmin users
  const { data: superadmins = [], isLoading } = useQuery({
    queryKey: ['superadmin-users-list'],
    queryFn: async () => {
      // Superadmins are profiles in mandiri workspace or with role admin
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email, workspace_id, workspace_role, created_at')
        .or('workspace_role.eq.admin,email.ilike.%@pesantren.app,email.ilike.%@digiss.app')
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []) as unknown as SuperadminUser[];
    },
  });

  // Create superadmin mutation
  const createSuperadminMutation = useMutation({
    mutationFn: async () => {
      if (!formEmail || !formPassword || !formName) {
        throw new Error('Harap lengkapi nama, email, dan password.');
      }

      // Check if current user is authenticated
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: formEmail,
        password: formPassword,
        options: {
          data: {
            name: formName,
            full_name: formName,
            role: 'admin',
          },
        },
      });

      if (signUpError) throw signUpError;
      const newUserId = authData.user?.id;

      if (newUserId) {
        // Find mandiri workspace
        const { data: wsData } = await supabase
          .from('workspaces')
          .select('id')
          .eq('type', 'mandiri')
          .limit(1)
          .single();

        const mandiriWsId = wsData?.id;

        // Upsert profile
        await supabase.from('profiles').upsert({
          id: newUserId,
          name: formName,
          email: formEmail,
          workspace_id: mandiriWsId,
          workspace_role: 'admin',
        });

        // Insert role
        await supabase.from('user_roles').upsert({
          user_id: newUserId,
          role: 'admin',
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin-users-list'] });
      toast.success('Akun Superadmin baru berhasil dibuat');
      setIsAddOpen(false);
      setFormName('');
      setFormEmail('');
      setFormPassword('');
    },
    onError: (err: any) => {
      toast.error('Gagal membuat superadmin: ' + err.message);
    },
  });

  const filteredSuperadmins = superadmins.filter(admin => 
    admin.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    admin.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader 
          title="Superadmin Users" 
          description="Kelola pengguna dengan hak akses tingkat tinggi (Global Superadmin) untuk memelihara dan mengatur platform SaaS."
        />
        <Button 
          onClick={() => setIsAddOpen(true)}
          className="gap-2 shadow-sm shrink-0"
        >
          <Plus className="h-4 w-4" /> Tambah Superadmin
        </Button>
      </div>

      {/* Info Card */}
      <Card className="rounded-2xl border-primary/20 bg-primary/5 shadow-xs">
        <CardContent className="p-4 flex items-start gap-4">
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-foreground">Hak Akses Superadmin</h4>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Superadmin memiliki wewenang penuh (unrestricted bypass) di seluruh workspace sekolah, konfigurasi SaaS, modul penagihan, serta monitoring performa server. Pastikan hanya personil yang terpercaya yang memiliki akses ini.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Filter & Search */}
      <div className="flex items-center gap-3 bg-card p-3 rounded-2xl border border-border">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Cari superadmin berdasarkan nama atau email..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-background border-none shadow-none focus-visible:ring-1"
          />
        </div>
      </div>

      {/* Superadmin List */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Nama & Profil</th>
                <th className="px-5 py-3.5">Email Akun</th>
                <th className="px-5 py-3.5">Peran Sistem</th>
                <th className="px-5 py-3.5">Status Akses</th>
                <th className="px-5 py-3.5">Terdaftar Sejak</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-muted-foreground">
                    Memuat daftar superadmin...
                  </td>
                </tr>
              ) : filteredSuperadmins.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-muted-foreground">
                    Tidak ada akun superadmin yang ditemukan.
                  </td>
                </tr>
              ) : (
                filteredSuperadmins.map((admin) => (
                  <tr key={admin.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                          {admin.name ? admin.name.substring(0, 2).toUpperCase() : 'SA'}
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{admin.name || 'Super Administrator'}</p>
                          <span className="text-[11px] text-muted-foreground font-mono">ID: {admin.id.substring(0, 8)}...</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 text-foreground font-medium text-xs">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{admin.email || '-'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
                        Global Superadmin
                      </Badge>
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant="outline" className="text-emerald-600 border-emerald-500/30 gap-1 text-xs">
                        <UserCheck className="h-3 w-3" /> Aktif
                      </Badge>
                    </td>
                    <td className="px-5 py-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>{new Date(admin.created_at || Date.now()).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Tambah Superadmin */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" /> Tambah Superadmin Baru
            </DialogTitle>
            <DialogDescription>
              Buat akun dengan hak akses pengelolaan penuh pada platform SaaS LMS Digiss.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="s-name">Nama Lengkap <span className="text-rose-500">*</span></Label>
              <Input 
                id="s-name" 
                placeholder="Contoh: Muhammad Imran" 
                value={formName} 
                onChange={(e) => setFormName(e.target.value)} 
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="s-email">Alamat Email <span className="text-rose-500">*</span></Label>
              <Input 
                id="s-email" 
                type="email" 
                placeholder="nama@digiss.app" 
                value={formEmail} 
                onChange={(e) => setFormEmail(e.target.value)} 
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="s-password">Password Akses <span className="text-rose-500">*</span></Label>
              <Input 
                id="s-password" 
                type="password" 
                placeholder="Minimal 8 karakter" 
                value={formPassword} 
                onChange={(e) => setFormPassword(e.target.value)} 
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>Batal</Button>
            <Button 
              onClick={() => createSuperadminMutation.mutate()}
              disabled={!formName || !formEmail || !formPassword || createSuperadminMutation.isPending}
            >
              {createSuperadminMutation.isPending ? 'Membuat Akun...' : 'Simpan Superadmin'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
