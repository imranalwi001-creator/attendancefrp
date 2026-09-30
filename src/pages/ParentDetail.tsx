import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ExtractionCardHeader } from '@/components/ui/extraction-card-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Edit, Trash2, User, Info, Save, X, Camera, Loader2, Lock, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { ProfileInfoCard, ProfileField } from '@/components/profile';
interface ParentProfile {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  status: 'aktif' | 'nonaktif' | 'cuti' | 'alumni' | null;
  created_at: string | null;
}
interface OrangtuaData {
  id: string;
  relationship: string | null;
  occupation: string | null;
  notes: string | null;
}
interface ChildData {
  id: string;
  name: string;
  nis: string | null;
  avatar_url: string | null;
}
export default function ParentDetail() {
  const {
    id
  } = useParams();
  const navigate = useNavigate();
  const {
    toast
  } = useToast();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ParentProfile | null>(null);
  const [orangtuaData, setOrangtuaData] = useState<OrangtuaData | null>(null);
  const [children, setChildren] = useState<ChildData[]>([]);
  const [allSantri, setAllSantri] = useState<ChildData[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    relationship: 'ayah',
    occupation: '',
    notes: '',
    childrenIds: [] as string[],
    status: 'aktif' as 'aktif' | 'nonaktif' | 'cuti' | 'alumni',
    avatar: ''
  });
  const [avatarPreview, setAvatarPreview] = useState('');

  // Password change state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Fetch parent data
  useEffect(() => {
    if (id) {
      fetchParentData();
      fetchAllSantri();
    }
  }, [id]);
  const fetchParentData = async () => {
    try {
      setLoading(true);

      // Fetch profile
      const {
        data: profileData,
        error: profileError
      } = await supabase.from('profiles').select('id, name, email, phone, avatar_url, status, created_at').eq('id', id).maybeSingle();
      if (profileError) throw profileError;
      if (!profileData) {
        throw new Error('Profil orang tua tidak ditemukan');
      }
      setProfile(profileData);

      // Fetch orangtua specific data
      const {
        data: orangtua,
        error: orangtuaError
      } = await supabase.from('orangtua').select('id, relationship, occupation, notes').eq('id', id).maybeSingle();
      if (orangtuaError) {
        console.error('Error fetching orangtua data:', orangtuaError);
      }
      setOrangtuaData(orangtua);

      // Fetch children - first get parent_children relations
      const {
        data: parentChildren,
        error: childrenError
      } = await supabase.from('parent_children').select('child_id').eq('parent_id', id);
      if (childrenError) {
        console.error('Error fetching children relations:', childrenError);
      }

      // Then fetch santri details for each child
      let childrenData: ChildData[] = [];
      if (parentChildren && parentChildren.length > 0) {
        const childIds = parentChildren.map(pc => pc.child_id);
        const {
          data: santriData,
          error: santriError
        } = await supabase.from('santri').select('id, nis').in('id', childIds);
        if (santriError) {
          console.error('Error fetching santri data:', santriError);
        }
        const {
          data: profilesData,
          error: profilesError
        } = await supabase.from('profiles').select('id, name, avatar_url').in('id', childIds);
        if (profilesError) {
          console.error('Error fetching profiles data:', profilesError);
        }

        // Combine data
        childrenData = childIds.map(childId => {
          const santri = santriData?.find(s => s.id === childId);
          const profile = profilesData?.find(p => p.id === childId);
          return {
            id: childId,
            name: profile?.name || 'Unknown',
            nis: santri?.nis || null,
            avatar_url: profile?.avatar_url || null
          };
        }).filter(c => c.name !== 'Unknown');
      }
      setChildren(childrenData);

      // Set form data
      setFormData({
        name: profileData.name,
        email: profileData.email || '',
        phone: profileData.phone || '',
        relationship: orangtua?.relationship || 'ayah',
        occupation: orangtua?.occupation || '',
        notes: orangtua?.notes || '',
        childrenIds: childrenData.map(c => c.id),
        status: profileData.status || 'aktif',
        avatar: profileData.avatar_url || ''
      });
      setAvatarPreview(profileData.avatar_url || '');
    } catch (error) {
      console.error('Error fetching parent data:', error);
      toast({
        title: "Error",
        description: "Gagal memuat data orang tua",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  const fetchAllSantri = async () => {
    try {
      // Fetch santri data
      const {
        data: santriData,
        error: santriError
      } = await supabase.from('santri').select('id, nis').order('nis');
      if (santriError) throw santriError;

      // Fetch profiles for all santri
      const santriIds = (santriData || []).map(s => s.id);
      if (santriIds.length === 0) {
        setAllSantri([]);
        return;
      }
      const {
        data: profilesData,
        error: profilesError
      } = await supabase.from('profiles').select('id, name, avatar_url').in('id', santriIds);
      if (profilesError) throw profilesError;
      const combinedData: ChildData[] = (santriData || []).map(s => {
        const profile = profilesData?.find(p => p.id === s.id);
        return {
          id: s.id,
          name: profile?.name || 'Unknown',
          nis: s.nis,
          avatar_url: profile?.avatar_url || null
        };
      }).filter(s => s.name !== 'Unknown');
      setAllSantri(combinedData);
    } catch (error) {
      console.error('Error fetching santri:', error);
    }
  };
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File terlalu besar",
          description: "Ukuran file maksimal 5MB",
          variant: "destructive"
        });
        return;
      }
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Format file tidak valid",
          description: "Hanya file gambar yang diperbolehkan",
          variant: "destructive"
        });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setAvatarPreview(result);
        setFormData({
          ...formData,
          avatar: result
        });
      };
      reader.readAsDataURL(file);
    }
  };
  const handleSave = async () => {
    try {
      setSaving(true);

      // Update profile
      const {
        error: profileError
      } = await supabase.from('profiles').update({
        name: formData.name,
        email: formData.email || null,
        phone: formData.phone || null,
        status: formData.status,
        updated_at: new Date().toISOString()
      }).eq('id', id);
      if (profileError) throw profileError;

      // Update or insert orangtua data
      const orangtuaPayload = {
        id: id!,
        relationship: formData.relationship || null,
        occupation: formData.occupation || null,
        notes: formData.notes || null,
        updated_at: new Date().toISOString()
      };
      const {
        error: orangtuaError
      } = await supabase.from('orangtua').upsert(orangtuaPayload, {
        onConflict: 'id'
      });
      if (orangtuaError) throw orangtuaError;

      // Update parent_children relationships
      // First delete existing relationships
      const {
        error: deleteError
      } = await supabase.from('parent_children').delete().eq('parent_id', id);
      if (deleteError) throw deleteError;

      // Insert new relationships
      if (formData.childrenIds.length > 0) {
        const childrenInserts = formData.childrenIds.map(childId => ({
          parent_id: id!,
          child_id: childId
        }));
        const {
          error: insertError
        } = await supabase.from('parent_children').insert(childrenInserts);
        if (insertError) throw insertError;
      }
      toast({
        title: "Perubahan Disimpan",
        description: "Perubahan data orang tua berhasil disimpan."
      });
      setIsEditMode(false);
      fetchParentData();
    } catch (error) {
      console.error('Error saving parent data:', error);
      toast({
        title: "Error",
        description: "Gagal menyimpan perubahan",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };
  const handleCancel = () => {
    if (profile) {
      setFormData({
        name: profile.name,
        email: profile.email || '',
        phone: profile.phone || '',
        relationship: orangtuaData?.relationship || 'ayah',
        occupation: orangtuaData?.occupation || '',
        notes: orangtuaData?.notes || '',
        childrenIds: children.map(c => c.id),
        status: profile.status || 'aktif',
        avatar: profile.avatar_url || ''
      });
      setAvatarPreview(profile.avatar_url || '');
    }
    setIsEditMode(false);
  };
  const handleDelete = async () => {
    try {
      // Delete from parent_children
      await supabase.from('parent_children').delete().eq('parent_id', id);

      // Delete from orangtua
      await supabase.from('orangtua').delete().eq('id', id);
      toast({
        title: "Pengguna Dihapus",
        description: "Data orang tua telah dihapus."
      });
      navigate('/admin/users');
    } catch (error) {
      console.error('Error deleting parent:', error);
      toast({
        title: "Error",
        description: "Gagal menghapus data orang tua",
        variant: "destructive"
      });
    }
  };
  const toggleChild = (childId: string) => {
    setFormData(prev => ({
      ...prev,
      childrenIds: prev.childrenIds.includes(childId) ? prev.childrenIds.filter(id => id !== childId) : [...prev.childrenIds, childId]
    }));
  };
  const handleChangePassword = async () => {
    if (!id) return;

    // Validasi password
    if (!newPassword || newPassword.trim() === '') {
      toast({
        title: "Password tidak boleh kosong",
        description: "Masukkan password baru",
        variant: "destructive"
      });
      return;
    }
    if (newPassword.length < 6) {
      toast({
        title: "Password terlalu pendek",
        description: "Password minimal 6 karakter",
        variant: "destructive"
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({
        title: "Password tidak cocok",
        description: "Password dan konfirmasi password harus sama",
        variant: "destructive"
      });
      return;
    }
    try {
      setIsChangingPassword(true);

      // Get current session token
      const {
        data: {
          session
        }
      } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Tidak ada sesi aktif');
      }

      // Call edge function to update password
      const {
        data,
        error
      } = await supabase.functions.invoke('update-user-password', {
        body: {
          userId: id,
          newPassword
        }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({
        title: "Password berhasil diubah",
        description: "Password orang tua telah diperbarui"
      });

      // Reset form
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error('Error changing password:', error);
      toast({
        title: "Gagal mengubah password",
        description: error.message || "Terjadi kesalahan saat mengubah password",
        variant: "destructive"
      });
    } finally {
      setIsChangingPassword(false);
    }
  };
  const getRelationshipLabel = (rel?: string | null) => {
    const labels: Record<string, string> = {
      ayah: 'Ayah',
      ibu: 'Ibu',
      wali: 'Wali'
    };
    return labels[rel || ''] || rel || '-';
  };

  // Loading skeleton
  if (loading) {
    return <div className="space-y-6">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-primary/80 p-8 shadow-xl">
          <div className="flex items-start gap-4">
            <Skeleton className="h-10 w-10 rounded-xl bg-primary-foreground/20" />
            <div className="flex-1 flex items-start gap-4">
              <Skeleton className="h-20 w-20 rounded-full bg-primary-foreground/20" />
              <div className="flex-1 space-y-3">
                <Skeleton className="h-8 w-64 bg-primary-foreground/20" />
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-20 bg-primary-foreground/20" />
                  <Skeleton className="h-6 w-16 bg-primary-foreground/20" />
                </div>
              </div>
            </div>
          </div>
        </div>
        <Skeleton className="h-12 w-full rounded-2xl" />
        <Card className="rounded-3xl">
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
          </CardContent>
        </Card>
      </div>;
  }
  if (!profile) {
    return <div className="space-y-6">
        <Button onClick={() => navigate('/admin/users')} variant="ghost">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Kembali
        </Button>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Data orang tua tidak ditemukan
          </CardContent>
        </Card>
      </div>;
  }
  const selectedChildren = allSantri.filter(s => formData.childrenIds.includes(s.id));
  return <div className="space-y-6">
      {/* Header with Gradient */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-primary/80 p-8 shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-foreground/10 rounded-full blur-3xl -translate-y-32 translate-x-32" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary-foreground/5 rounded-full blur-2xl translate-y-24 -translate-x-24" />
        
        <div className="relative flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/users')} className="rounded-xl bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground border-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          
          <div className="flex-1">
            <div className="flex items-start gap-4 mb-4">
              <div className="relative group">
                <Avatar className="h-20 w-20 border-4 border-primary-foreground/20 shadow-xl">
                  <AvatarImage src={avatarPreview} alt={formData.name} />
                  <AvatarFallback className="bg-primary-foreground/20 text-primary-foreground text-2xl font-bold">
                    {formData.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                {isEditMode && <label htmlFor="avatar-upload" className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                    <Camera className="h-6 w-6 text-white" />
                    <input id="avatar-upload" type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
                  </label>}
              </div>
              
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-primary-foreground mb-3">{formData.name}</h1>
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant="outline" className="bg-primary-foreground/20 text-primary-foreground border-primary-foreground/30 hover:bg-primary-foreground/30">
                    {getRelationshipLabel(formData.relationship)}
                  </Badge>
                  <Badge variant={formData.status === 'aktif' ? 'default' : 'secondary'} className="bg-primary-foreground/20 text-primary-foreground border-primary-foreground/30 hover:bg-primary-foreground/30">
                    {formData.status === 'aktif' ? 'Aktif' : formData.status === 'nonaktif' ? 'Nonaktif' : formData.status}
                  </Badge>
                  <div className="flex items-center gap-2 text-primary-foreground/90">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground/60" />
                    <span className="text-sm">{selectedChildren.length > 0 ? selectedChildren.map(c => c.name).join(', ') : 'Belum ada anak asuh'}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                {!isEditMode ? <>
                    <Button onClick={() => setIsEditMode(true)} className="rounded-xl bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 backdrop-blur-sm">
                      <Edit className="h-4 w-4 mr-2" />
                      <span className="font-medium">Edit</span>
                    </Button>
                    <Button onClick={() => setShowDeleteDialog(true)} variant="ghost" className="rounded-xl bg-destructive/10 hover:bg-destructive/20 text-primary-foreground border-0 hover:text-destructive transition-all duration-300 hover:scale-105">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </> : <>
                    <Button onClick={handleSave} disabled={saving} className="rounded-xl bg-green-500 hover:bg-green-600 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                      {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                      <span className="font-medium">Simpan</span>
                    </Button>
                    <Button onClick={handleCancel} variant="ghost" className="rounded-xl bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground border-0 transition-all duration-300 hover:scale-105">
                      <X className="h-4 w-4 mr-2" />
                      <span className="font-medium">Batal</span>
                    </Button>
                  </>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Section */}
      <Tabs defaultValue="profile" className="w-full">
        <TabsList variant="admin" className="grid-cols-2">
          <TabsTrigger value="profile" variant="admin">
            <User className="h-4 w-4 mr-2" />
            Profil
          </TabsTrigger>
          <TabsTrigger value="activity" variant="admin">
            <Info className="h-4 w-4 mr-2" />
            Data Lainnya
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="mt-6">
          <ProfileInfoCard title="Informasi Profil" fields={[{
          key: 'name',
          label: 'Nama Lengkap',
          value: formData.name,
          type: 'text',
          onChange: value => setFormData({
            ...formData,
            name: value
          })
        }, {
          key: 'relationship',
          label: 'Hubungan',
          value: formData.relationship,
          type: 'select',
          options: [{
            value: 'ayah',
            label: 'Ayah'
          }, {
            value: 'ibu',
            label: 'Ibu'
          }, {
            value: 'wali',
            label: 'Wali'
          }],
          onChange: value => setFormData({
            ...formData,
            relationship: value
          })
        }, {
          key: 'email',
          label: 'Email',
          value: formData.email,
          type: 'email',
          onChange: value => setFormData({
            ...formData,
            email: value
          })
        }, {
          key: 'phone',
          label: 'Nomor Telepon',
          value: formData.phone,
          type: 'text',
          onChange: value => setFormData({
            ...formData,
            phone: value
          })
        }, {
          key: 'occupation',
          label: 'Pekerjaan',
          value: formData.occupation,
          type: 'text',
          placeholder: 'Masukkan pekerjaan...',
          onChange: value => setFormData({
            ...formData,
            occupation: value
          })
        }, {
          key: 'status',
          label: 'Status Akun',
          value: formData.status,
          type: 'select',
          options: [{
            value: 'aktif',
            label: 'Aktif'
          }, {
            value: 'nonaktif',
            label: 'Nonaktif'
          }, {
            value: 'cuti',
            label: 'Cuti'
          }, {
            value: 'alumni',
            label: 'Alumni'
          }],
          onChange: value => setFormData({
            ...formData,
            status: value as 'aktif' | 'nonaktif' | 'cuti' | 'alumni'
          })
        }, {
          key: 'notes',
          label: 'Catatan',
          value: formData.notes,
          type: 'textarea',
          colSpan: 2,
          placeholder: 'Tambahkan catatan...',
          onChange: value => setFormData({
            ...formData,
            notes: value
          })
        }] as ProfileField[]} isEditMode={isEditMode} childrenField={{
          label: 'Anak Asuh / Santri',
          selectedIds: formData.childrenIds,
          allItems: allSantri,
          onToggle: toggleChild,
          emptyText: 'Belum ada anak asuh'
        }} registrationDate={profile?.created_at} />

          {/* Security Settings Card */}
          <Card className="rounded-3xl border shadow-lg overflow-hidden mt-6">
            <ExtractionCardHeader
              icon={<Lock className="h-4 w-4 text-primary" />}
              title="Pengaturan Keamanan"
            />
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-muted/30 border border-border/50 space-y-2">
                    <Label htmlFor="new-password" className="text-sm font-medium text-muted-foreground">
                      Password Baru
                    </Label>
                    <Input 
                      id="new-password" 
                      type="password" 
                      value={newPassword} 
                      onChange={e => setNewPassword(e.target.value)} 
                      placeholder="Masukkan password baru" 
                      className="rounded-xl border-border/50 bg-background/50" 
                    />
                    <p className="text-xs text-muted-foreground">Minimal 6 karakter</p>
                  </div>

                  <div className="p-4 rounded-2xl bg-muted/30 border border-border/50 space-y-2">
                    <Label htmlFor="confirm-password" className="text-sm font-medium text-muted-foreground">
                      Konfirmasi Password
                    </Label>
                    <Input 
                      id="confirm-password" 
                      type="password" 
                      value={confirmPassword} 
                      onChange={e => setConfirmPassword(e.target.value)} 
                      placeholder="Ulangi password baru" 
                      className="rounded-xl border-border/50 bg-background/50" 
                    />
                  </div>
                </div>

                <Button onClick={handleChangePassword} disabled={isChangingPassword || !newPassword || !confirmPassword} className="rounded-xl">
                  {isChangingPassword ? 'Menyimpan...' : 'Ubah Password'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="mt-6">
          <Card className="rounded-3xl border shadow-lg overflow-hidden">
            <ExtractionCardHeader
              icon={<FileText className="h-4 w-4 text-primary" />}
              title="Data Lainnya"
            />
            <CardContent className="p-8">
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted/50 mb-4">
                  <Info className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground text-lg">Fitur data lainnya akan segera hadir</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Data Orang Tua?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak dapat dibatalkan. Data orang tua akan dihapus secara permanen dari sistem.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl">
              Ya, Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>;
}