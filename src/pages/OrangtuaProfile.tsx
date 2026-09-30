import { useState, useEffect } from 'react';
import { Camera, User, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { UserDetailSkeleton } from '@/components/skeletons/UserDetailSkeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ContentCard, ContentCardHeader, ContentCardTitle, ContentCardBody } from '@/components/ui/content-card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { PushNotificationSettings } from '@/components/settings/PushNotificationSettings';
import { InstallAppSettings } from '@/components/settings/InstallAppSettings';

// Validation schema
const profileSchema = z.object({
  name: z.string().trim().min(1, "Nama tidak boleh kosong").max(100, "Nama maksimal 100 karakter"),
  email: z.string().trim().email("Email tidak valid").max(255, "Email maksimal 255 karakter"),
  phone: z.string().trim().max(20, "Nomor telepon maksimal 20 karakter").optional(),
  occupation: z.string().trim().max(100, "Pekerjaan maksimal 100 karakter").optional(),
  relationship: z.string().trim().max(50, "Hubungan maksimal 50 karakter").optional(),
});

interface ProfileData {
  name: string;
  email: string;
  phone: string;
  avatar: string;
  occupation: string;
  relationship: string;
}

const defaultProfileData: ProfileData = {
  name: '',
  email: '',
  phone: '',
  avatar: '',
  occupation: '',
  relationship: '',
};

export default function OrangtuaProfile() {
  const { user: authUser } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<ProfileData>(defaultProfileData);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [children, setChildren] = useState<any[]>([]);

  useEffect(() => {
    if (authUser?.id) {
      fetchUserProfile();
      fetchChildren();
    }
  }, [authUser?.id]);

  const fetchUserProfile = async () => {
    if (!authUser?.id) return;
    
    try {
      setLoading(true);

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, name, email, phone, avatar_url, status')
        .eq('id', authUser.id)
        .maybeSingle();
      if (profileError) throw profileError;

      const { data: orangtua, error: orangtuaError } = await supabase
        .from('orangtua')
        .select('id, occupation, relationship, notes')
        .eq('id', authUser.id)
        .maybeSingle();
      if (orangtuaError) console.error('Error fetching orangtua data:', orangtuaError);
      
      setFormData({
        name: profile?.name || authUser.name,
        email: profile?.email || authUser.email || '',
        phone: profile?.phone || '',
        avatar: profile?.avatar_url || '',
        occupation: orangtua?.occupation || '',
        relationship: orangtua?.relationship || '',
      });
      setAvatarPreview(profile?.avatar_url || '');
    } catch (error) {
      console.error('Error fetching user profile:', error);
      toast({ title: "Error", description: "Gagal memuat data profil", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchChildren = async () => {
    if (!authUser?.id) return;
    
    try {
      // First get child IDs
      const { data: parentChildren, error: pcError } = await supabase
        .from('parent_children')
        .select('child_id')
        .eq('parent_id', authUser.id);
      
      if (pcError) throw pcError;
      if (!parentChildren || parentChildren.length === 0) {
        setChildren([]);
        return;
      }

      const childIds = parentChildren.map(pc => pc.child_id);

      // Then get santri details with profiles
      const { data: santriData, error: santriError } = await supabase
        .from('santri')
        .select(`
          id,
          nis,
          nisn,
          kelas:kelas_id(nama, tingkat)
        `)
        .in('id', childIds);

      if (santriError) throw santriError;

      // Get profiles separately
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, avatar_url, status')
        .in('id', childIds);

      if (profilesError) throw profilesError;

      // Combine data
      const combinedChildren = (santriData || []).map(santri => {
        const profile = profilesData?.find(p => p.id === santri.id);
        return {
          child_id: santri.id,
          santri: {
            ...santri,
            profiles: profile
          }
        };
      });

      setChildren(combinedChildren);
    } catch (error) {
      console.error('Error fetching children:', error);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: "File terlalu besar", description: "Ukuran file maksimal 5MB", variant: "destructive" });
        return;
      }
      if (!file.type.startsWith('image/')) {
        toast({ title: "Format file tidak valid", description: "Hanya file gambar yang diperbolehkan", variant: "destructive" });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setAvatarPreview(result);
        setFormData(prev => ({ ...prev, avatar: result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    try {
      const validated = profileSchema.parse(formData);
      if (!authUser?.id) return;

      setSaving(true);

      const { error: profileError } = await supabase.from('profiles').update({
        name: validated.name,
        email: validated.email,
        phone: validated.phone,
        avatar_url: formData.avatar
      }).eq('id', authUser.id);
      if (profileError) throw profileError;

      const { error: orangtuaError } = await supabase.from('orangtua').update({
        occupation: validated.occupation,
        relationship: validated.relationship,
      }).eq('id', authUser.id);
      if (orangtuaError) throw orangtuaError;

      toast({ title: "Berhasil", description: "Perubahan data berhasil disimpan." });
      await fetchUserProfile();
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({ title: "Validasi Gagal", description: error.errors[0].message, variant: "destructive" });
      } else {
        console.error('Save error:', error);
        toast({ title: "Error", description: "Gagal menyimpan perubahan", variant: "destructive" });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast({ title: "Validasi Gagal", description: "Password minimal 6 karakter", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Validasi Gagal", description: "Konfirmasi password tidak sesuai", variant: "destructive" });
      return;
    }

    setIsChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      
      toast({ title: "Berhasil", description: "Password berhasil diubah" });
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error('Password change error:', error);
      toast({ title: "Error", description: error.message || "Gagal mengubah password", variant: "destructive" });
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (loading) {
    return <UserDetailSkeleton />;
  }

  return (
    <div className="space-y-6">

      {/* Profile Header Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-primary/80 p-8 shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-foreground/10 rounded-full blur-3xl -translate-y-32 translate-x-32" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary-foreground/5 rounded-full blur-2xl translate-y-24 -translate-x-24" />
        
        <div className="relative flex items-center gap-6">
          <div className="relative group">
            <Avatar className="h-24 w-24 border-4 border-primary-foreground/20 shadow-xl">
              <AvatarImage src={avatarPreview} alt={formData.name} />
              <AvatarFallback className="bg-primary-foreground/20 text-primary-foreground text-2xl font-bold">
                {formData.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <label 
              htmlFor="avatar-upload" 
              className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            >
              <Camera className="h-6 w-6 text-white" />
              <input 
                id="avatar-upload" 
                type="file" 
                accept="image/*" 
                onChange={handleAvatarChange} 
                className="hidden" 
              />
            </label>
          </div>
          
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-primary-foreground mb-2">{formData.name}</h1>
            <div className="flex flex-wrap items-center gap-3">
              <Badge className="bg-primary-foreground/20 text-primary-foreground border-primary-foreground/30 hover:bg-primary-foreground/30">
                Orang Tua
              </Badge>
              {children.length > 0 && (
                <Badge variant="outline" className="bg-primary-foreground/10 text-primary-foreground border-primary-foreground/30">
                  {children.length} Anak
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content with Tabs */}
      <Tabs defaultValue="profil" className="space-y-4">
        <TabsList variant="admin" className="grid-cols-2">
          <TabsTrigger variant="admin" value="profil" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Profil
          </TabsTrigger>
          <TabsTrigger variant="admin" value="notifikasi" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Pengaturan
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profil" className="space-y-4">
          {/* Data Pribadi */}
          <ContentCard>
            <ContentCardHeader>
              <ContentCardTitle>Data Pribadi</ContentCardTitle>
            </ContentCardHeader>
            <ContentCardBody className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Nama Lengkap</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Nomor Telepon</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="occupation">Pekerjaan</Label>
                <Input
                  id="occupation"
                  value={formData.occupation}
                  onChange={(e) => setFormData(prev => ({ ...prev, occupation: e.target.value }))}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="relationship">Hubungan dengan Anak</Label>
                <Input
                  id="relationship"
                  placeholder="Contoh: Ayah, Ibu, Wali"
                  value={formData.relationship}
                  onChange={(e) => setFormData(prev => ({ ...prev, relationship: e.target.value }))}
                />
              </div>
            </ContentCardBody>
          </ContentCard>

          {/* Data Anak */}
          {children.length > 0 && (
            <ContentCard>
              <ContentCardHeader>
                <ContentCardTitle>Data Anak</ContentCardTitle>
              </ContentCardHeader>
              <ContentCardBody>
                <div className="grid gap-3 md:grid-cols-2">
                  {children.map((child) => (
                    <div key={child.child_id} className="flex items-center gap-4 p-4 rounded-xl bg-muted/30 border border-border/50">
                      <Avatar className="h-14 w-14">
                        <AvatarImage src={child.santri?.profiles?.avatar_url} />
                        <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                          {child.santri?.profiles?.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground truncate">{child.santri?.profiles?.name || 'Tidak diketahui'}</p>
                        {child.santri?.nis && (
                          <p className="text-sm text-muted-foreground">NIS: {child.santri.nis}</p>
                        )}
                        {child.santri?.kelas && (
                          <p className="text-sm text-muted-foreground">
                            Kelas {child.santri.kelas.nama} - {child.santri.kelas.tingkat}
                          </p>
                        )}
                        {child.santri?.profiles?.status && (
                          <Badge variant={child.santri.profiles.status === 'aktif' ? 'default' : 'secondary'} className="mt-1 text-xs">
                            {child.santri.profiles.status}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ContentCardBody>
            </ContentCard>
          )}

          {/* Ubah Password */}
          <ContentCard>
            <ContentCardHeader>
              <ContentCardTitle>Ubah Password</ContentCardTitle>
            </ContentCardHeader>
            <ContentCardBody className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="newPassword">Password Baru</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Konfirmasi Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ulangi password baru"
                />
              </div>
              <div className="md:col-span-2">
                <Button 
                  onClick={handleChangePassword} 
                  disabled={isChangingPassword || !newPassword || !confirmPassword}
                  variant="outline"
                >
                  {isChangingPassword ? 'Menyimpan...' : 'Ubah Password'}
                </Button>
              </div>
            </ContentCardBody>
          </ContentCard>

          {/* Tombol Simpan */}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="notifikasi" className="space-y-4">
          <PushNotificationSettings />
          <InstallAppSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
