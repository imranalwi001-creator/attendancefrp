import { Drawer, DrawerClose, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Kelas } from '@/types';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Save, ArrowRight, X } from 'lucide-react';
interface SantriQuickAddFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kelas: Kelas[];
  onSuccess?: () => void;
}
export default function SantriQuickAddForm({
  open,
  onOpenChange,
  kelas,
  onSuccess
}: SantriQuickAddFormProps) {
  const {
    toast
  } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    kelasId: '',
    email: '',
    password: '',
    confirmPassword: '',
    status: 'aktif' as 'aktif' | 'nonaktif' | 'cuti' | 'alumni'
  });
  const handleSubmit = async (continueToDetail: boolean = false) => {
    const trimmedEmail = formData.email.trim().toLowerCase();
    const trimmedName = formData.name.trim();
    if (!trimmedName || !formData.kelasId || !trimmedEmail) {
      toast({
        title: "Data tidak lengkap",
        description: "Mohon lengkapi semua field yang wajib diisi",
        variant: "destructive"
      });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      toast({
        title: "Email tidak valid",
        description: "Masukkan alamat email yang valid",
        variant: "destructive"
      });
      return;
    }

    // Validate password confirmation
    if (formData.password && formData.password !== formData.confirmPassword) {
      toast({
        title: "Password tidak cocok",
        description: "Password dan konfirmasi password harus sama",
        variant: "destructive"
      });
      return;
    }
    try {
      setLoading(true);
      const password = formData.password && formData.password.trim() !== '' ? formData.password : '123456';

      // Use edge function to create user (more reliable than client-side signUp)
      const {
        data: result,
        error: fnError
      } = await supabase.functions.invoke('create-user', {
        body: {
          email: trimmedEmail,
          password: password,
          name: trimmedName,
          role: 'santri',
          kelasId: formData.kelasId,
          status: formData.status
        }
      });
      if (fnError) {
        console.error('Edge function error:', fnError);
        let msg = fnError.message || 'Gagal memanggil fungsi create-user';
        const ctx = (fnError as any)?.context;
        if (ctx) {
          const raw = await ctx.text();
          try {
            const parsed = JSON.parse(raw);
            msg = parsed?.error || parsed?.message || msg;
          } catch {
            msg = raw || msg;
          }
        }
        throw new Error(msg);
      }
      if (result?.error) {
        const errorMsg = result.error.toLowerCase();
        if (errorMsg.includes('already registered') || errorMsg.includes('already exists')) {
          toast({
            title: "Email sudah terdaftar",
            description: "Email ini sudah digunakan oleh pengguna lain",
            variant: "destructive"
          });
          setLoading(false);
          return;
        }
        throw new Error(result.error);
      }
      const newSantriId = result?.user?.id;
      if (!newSantriId) {
        throw new Error('User ID tidak ditemukan dalam response');
      }

      toast({
        title: "Data santri tersimpan",
        description: "Data awal santri berhasil disimpan"
      });
      if (continueToDetail) {
        handleClose();
        navigate(`/admin/users/${newSantriId}`);
      } else {
        handleClose();
        if (onSuccess) onSuccess();
      }
    } catch (error: any) {
      console.error('Error adding santri:', error);
      toast({
        title: "Error",
        description: error.message || "Gagal menambahkan data santri",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  const handleClose = () => {
    setFormData({
      name: '',
      kelasId: '',
      email: '',
      password: '',
      confirmPassword: '',
      status: 'aktif'
    });
    onOpenChange(false);
  };
  return <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh] flex flex-col">
        {/* Header */}
        <DrawerHeader className="px-6 py-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <DrawerTitle>Tambah Data Santri</DrawerTitle>
              
            </div>
            <DrawerClose asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
            </DrawerClose>
          </div>
        </DrawerHeader>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="santri-name">Nama Lengkap <span className="text-destructive">*</span></Label>
            <Input id="santri-name" name="santri-fullname" autoComplete="off" placeholder="Masukkan nama lengkap" value={formData.name} onChange={e => setFormData({
            ...formData,
            name: e.target.value
          })} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="kelas">Kelas <span className="text-destructive">*</span></Label>
            <Select value={formData.kelasId} onValueChange={value => setFormData({
            ...formData,
            kelasId: value
          })}>
              <SelectTrigger id="kelas">
                <SelectValue placeholder="Pilih kelas" />
              </SelectTrigger>
              <SelectContent>
                {kelas.map(k => <SelectItem key={k.id} value={k.id}>
                    {k.nama}
                  </SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="santri-email">Email <span className="text-destructive">*</span></Label>
            <Input id="santri-email" name="santri-email" type="email" autoComplete="off" placeholder="email@example.com" value={formData.email} onChange={e => setFormData({
            ...formData,
            email: e.target.value
          })} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="santri-password">Password</Label>
            <Input id="santri-password" name="santri-password" type="password" autoComplete="new-password" placeholder="Default: 123456" value={formData.password} onChange={e => setFormData({
            ...formData,
            password: e.target.value
          })} />
            {!formData.password && <p className="text-xs text-muted-foreground">
                Password default: 123456
              </p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="santri-confirm-password">Konfirmasi Password</Label>
            <Input id="santri-confirm-password" name="santri-confirm-password" type="password" autoComplete="new-password" placeholder="Masukkan ulang password" value={formData.confirmPassword} onChange={e => setFormData({
            ...formData,
            confirmPassword: e.target.value
          })} />
            {formData.password && formData.confirmPassword && formData.password !== formData.confirmPassword && <p className="text-xs text-destructive">
                Password tidak cocok
              </p>}
          </div>

          <div className="flex items-center justify-between rounded-xl border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="status" className="text-base">Status Aktif</Label>
              <p className="text-sm text-muted-foreground">
                Aktifkan akun santri ini
              </p>
            </div>
            <Switch id="status" checked={formData.status === 'aktif'} onCheckedChange={checked => setFormData({
            ...formData,
            status: checked ? 'aktif' : 'nonaktif'
          })} />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-muted/30">
          <div className="flex gap-2 w-full">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={handleClose}
              disabled={loading}
            >
              Batal
            </Button>
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => handleSubmit(false)}
              disabled={loading}
            >
              {loading ? 'Menyimpan...' : 'Simpan'}
            </Button>
            <Button
              className="flex-1"
              onClick={() => handleSubmit(true)}
              disabled={loading}
            >
              {loading ? 'Menyimpan...' : 'Lanjut Isi Data'}
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>;
}
