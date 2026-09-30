import { useState, useEffect } from 'react';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { User, Kelas, Role } from '@/types';
import { Trash2, X, Save } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { logActivity, getRoleLabel } from '@/lib/activityLogger';
import { DatePicker } from '@/components/ui/date-picker';

interface UserFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: User | null;
  kelas: Kelas[];
  onSave: (user: Partial<User>) => void;
  onDelete?: (userId: string) => void;
}

export default function UserForm({ open, onOpenChange, user, kelas, onSave, onDelete }: UserFormProps) {
  const { toast } = useToast();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    password: '',
    role: (user?.role || 'guru') as Role,
    employeeId: user?.employeeId || '',
    nis: user?.nis || '',
    birthDate: user?.birthDate || '',
    address: user?.address || '',
    kelasId: user?.kelasId || '',
    status: 'aktif'
  });

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        password: '',
        role: user.role || 'guru',
        employeeId: user.employeeId || '',
        nis: user.nis || '',
        birthDate: user.birthDate || '',
        address: user.address || '',
        kelasId: user.kelasId || '',
        status: (user.status || 'aktif') as any
      });
    } else {
      setFormData({
        name: '',
        email: '',
        password: '123456',
        role: 'guru',
        employeeId: '',
        nis: '',
        birthDate: '',
        address: '',
        kelasId: '',
        status: 'aktif'
      });
    }
  }, [user, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email) {
      toast({
        title: "Data tidak lengkap",
        description: "Nama dan email wajib diisi",
        variant: "destructive"
      });
      return;
    }

    // Validate employeeId for staff roles
    if (['admin', 'guru', 'walikelas', 'Pembina', 'staff', 'guru_ekskul'].includes(formData.role) && !formData.employeeId) {
      toast({
        title: "Data tidak lengkap",
        description: "ID Pegawai / NIP wajib diisi untuk Staff & Guru",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      if (user?.id) {
        // Update existing user
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            name: formData.name,
            email: formData.email,
            status: formData.status as any
          })
          .eq('id', user.id);

        if (profileError) throw profileError;

        // Update password if provided
        if (formData.password && formData.password.trim() !== '') {
          const { error: passwordError } = await supabase.auth.admin.updateUserById(
            user.id,
            { password: formData.password }
          );

          if (passwordError) {
            toast({
              title: "Gagal mengubah password",
              description: passwordError.message,
              variant: "destructive"
            });
          } else {
            toast({
              title: "Password diubah",
              description: "Password berhasil diperbarui"
            });
          }
        }

        // Update role if changed using set_user_role RPC (handles DELETE + INSERT)
        const { error: roleError } = await supabase.rpc('set_user_role', {
          _user_id: user.id,
          _role: formData.role
        });

        if (roleError) throw roleError;

        // Update staff record if applicable
        if (['admin', 'guru', 'walikelas', 'Pembina', 'staff', 'guru_ekskul'].includes(formData.role)) {
          const staffData = {
            employee_id: formData.employeeId || null,
            position: formData.role,
            kelas_id: (formData.role === 'walikelas' && formData.kelasId) ? formData.kelasId : null
          };

          const { error: staffError } = await supabase
            .from('staff')
            .upsert({ id: user.id, ...staffData });

          if (staffError) throw staffError;
        }

        toast({
          title: "Perubahan Disimpan",
          description: "Perubahan data berhasil disimpan."
        });

        // Log activity for user edit
        logActivity({
          action: 'user_edit',
          category: 'user_management',
          description: `Mengedit user ${getRoleLabel(formData.role)} atas nama ${formData.name}`,
          metadata: { userId: user.id, role: formData.role, email: formData.email }
        });

        onSave({
          id: user.id,
          name: formData.name,
          email: formData.email,
          role: formData.role,
          status: formData.status as any
        });
      } else {
        // Create new user using edge function (doesn't auto-login)
        const { data, error: invokeError } = await supabase.functions.invoke('create-user', {
          body: {
            email: formData.email,
            password: formData.password && formData.password.trim() !== '' ? formData.password : '123456',
            name: formData.name,
            role: formData.role,
            employeeId: formData.employeeId,
            kelasId: formData.kelasId,
            status: formData.status,
          },
        });

        if (invokeError) {
          let msg = invokeError.message || 'Gagal membuat pengguna';
          const ctx = (invokeError as any)?.context;
          if (ctx) {
            const raw = await ctx.text();
            try {
              const parsed = JSON.parse(raw);
              msg = parsed?.error || parsed?.message || msg;
            } catch {
              msg = raw || msg;
            }
          }
          if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('registered')) {
            throw new Error('Email ini sudah terdaftar. Gunakan email lain.');
          }
          throw new Error(msg);
        }

        const result: any = data;
        if (result?.error) {
          const errorMessage = String(result.error);
          if (errorMessage.toLowerCase().includes('already') || errorMessage.toLowerCase().includes('registered')) {
            throw new Error('Email ini sudah terdaftar. Gunakan email lain.');
          }
          throw new Error(errorMessage);
        }

        toast({
          title: "Pengguna Ditambahkan",
          description: "Pengguna baru berhasil ditambahkan."
        });

        // Edge function returns user object inside result.user
        const userId = result.user?.id || result.userId;
        
        // Log activity for new user
        logActivity({
          action: 'user_add',
          category: 'user_management',
          description: `Menambahkan user ${getRoleLabel(formData.role)} atas nama ${formData.name}`,
          metadata: { userId, role: formData.role, email: formData.email }
        });
        
        onSave({
          id: userId,
          name: formData.name,
          email: formData.email,
          role: formData.role,
          status: formData.status as any
        });
      }
      
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error saving user:', error);
      toast({
        title: "Error",
        description: error.message || "Gagal menyimpan data pengguna",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    if (user && onDelete) {
      // Log activity for user delete
      logActivity({
        action: 'user_delete',
        category: 'user_management',
        description: `Menghapus user ${getRoleLabel(user.role)} atas nama ${user.name}`,
        metadata: { userId: user.id, role: user.role, email: user.email }
      });

      onDelete(user.id);
      toast({
        title: "Pengguna Dihapus",
        description: "Pengguna telah dihapus.",
      });
      setShowDeleteDialog(false);
      onOpenChange(false);
    }
  };

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh] flex flex-col">
          {/* Header */}
          <DrawerHeader className="px-6 py-4 border-b border-border">
            <div className="flex items-center justify-between">
              <DrawerTitle>{user ? 'Edit Pengguna' : 'Tambah Pengguna Baru'}</DrawerTitle>
              <DrawerClose asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </Button>
              </DrawerClose>
            </div>
          </DrawerHeader>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <form id="user-form" onSubmit={handleSubmit} className="grid gap-4">
              {/* Nama Lengkap */}
              <div className="space-y-2">
                <Label htmlFor="name">Nama Lengkap *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="Masukkan nama lengkap"
                />
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">Email / Username *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  placeholder="email@example.com"
                />
              </div>

              {/* ID Pegawai / NISN - urutan 3 */}
              <div className="space-y-2">
              <Label htmlFor="employeeId">
                  {formData.role === 'santri' 
                    ? 'NISN (Nomor Induk Siswa Nasional)' 
                    : 'ID Pegawai / NIP'} {['admin', 'guru', 'walikelas', 'Pembina', 'staff', 'guru_ekskul'].includes(formData.role) && '*'}
                </Label>
                <Input
                  id="employeeId"
                  value={formData.employeeId}
                  onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                  placeholder={['admin', 'guru', 'walikelas', 'Pembina', 'staff', 'guru_ekskul'].includes(formData.role) ? "Wajib diisi" : "Opsional"}
                  required={['admin', 'guru', 'walikelas', 'Pembina', 'staff', 'guru_ekskul'].includes(formData.role)}
                />
              </div>

              {/* Peran Pengguna */}
              <div className="space-y-2">
                <Label htmlFor="role">Peran Pengguna *</Label>
                <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value as Role })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih peran" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrator</SelectItem>
                    <SelectItem value="guru">Guru</SelectItem>
                    <SelectItem value="walikelas">Wali Kelas</SelectItem>
                    <SelectItem value="guru_ekskul">Guru Ekskul</SelectItem>
                    <SelectItem value="Pembina">Pembina</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* NIS - khusus Santri */}
              {formData.role === 'santri' && (
                <div className="space-y-2">
                  <Label htmlFor="nis">NIS (Nomor Induk Sekolah)</Label>
                  <Input
                    id="nis"
                    value={formData.nis}
                    onChange={(e) => setFormData({ ...formData, nis: e.target.value })}
                    placeholder="Opsional"
                  />
                </div>
              )}

              {/* Kelas - khusus Santri atau Wali Kelas */}
              {(formData.role === 'santri' || formData.role === 'walikelas') && (
                <div className="space-y-2">
                  <Label htmlFor="kelasId">
                    {formData.role === 'santri' ? 'Kelas *' : 'Kelas yang Diampu *'}
                  </Label>
                  <Select value={formData.kelasId} onValueChange={(value) => setFormData({ ...formData, kelasId: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih kelas" />
                    </SelectTrigger>
                    <SelectContent>
                      {kelas.map((k) => (
                        <SelectItem key={k.id} value={k.id}>
                          {k.nama} - {k.tingkat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Tanggal Lahir - khusus Santri */}
              {formData.role === 'santri' && (
                <div className="space-y-2">
                  <Label htmlFor="birthDate">Tanggal Lahir</Label>
                  <DatePicker
                    value={formData.birthDate}
                    onChange={(v) => setFormData({ ...formData, birthDate: v })}
                    placeholder="Tanggal lahir"
                  />
                </div>
              )}

              {/* Alamat - khusus Santri */}
              {formData.role === 'santri' && (
                <div className="space-y-2">
                  <Label htmlFor="address">Alamat</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Alamat lengkap"
                  />
                </div>
              )}

              {/* Status Akun */}
              <div className="space-y-2">
                <Label htmlFor="status">Status Akun *</Label>
                <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aktif">Aktif</SelectItem>
                    <SelectItem value="nonaktif">Nonaktif</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Password - pindah ke paling bawah */}
              <div className="space-y-2">
                <Label htmlFor="password">
                  Password {user ? '' : '*'}
                  {user && <span className="text-muted-foreground text-sm ml-2">(Kosongkan jika tidak ingin mengubah)</span>}
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder={user ? "Masukkan password baru" : "Default: 123456"}
                />
                {!user && !formData.password && (
                  <p className="text-sm text-muted-foreground">
                    Password default: 123456
                  </p>
                )}
              </div>
            </form>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border bg-muted/30">
            <div className="flex gap-2 w-full">
              {user && onDelete && (
                <Button
                  type="button"
                  variant="destructive"
                  className="flex-1"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  Hapus
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Batal
              </Button>
              <Button
                type="submit"
                form="user-form"
                className="flex-1"
                disabled={loading}
              >
                {loading ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Delete Confirmation Dialog - tetap AlertDialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Pengguna?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak dapat dibatalkan. Data pengguna akan dihapus secara permanen dari sistem.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Ya, Lanjutkan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
