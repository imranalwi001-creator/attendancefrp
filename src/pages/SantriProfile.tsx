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
import {
  UserInfoTab,
  UserFormData,
  KelasOption
} from '@/components/user-detail';
import { PushNotificationSettings } from '@/components/settings/PushNotificationSettings';
import { InstallAppSettings } from '@/components/settings/InstallAppSettings';

// Validation schema
const userSchema = z.object({
  name: z.string().trim().min(1, "Nama tidak boleh kosong").max(100, "Nama maksimal 100 karakter"),
  email: z.string().trim().email("Email tidak valid").max(255, "Email maksimal 255 karakter"),
  nisn: z.string().trim().max(50, "NISN maksimal 50 karakter").optional(),
  nis: z.string().trim().max(50, "NIS maksimal 50 karakter").optional(),
  birthDate: z.string().optional(),
  address: z.string().trim().max(500, "Alamat maksimal 500 karakter").optional(),
  kelasId: z.string().optional(),
  status: z.enum(['aktif', 'nonaktif', 'cuti', 'alumni']),
  previousSchool: z.string().trim().max(200, "Asal sekolah maksimal 200 karakter").optional(),
  childOrder: z.string().trim().max(50, "Anak ke maksimal 50 karakter").optional(),
  bloodType: z.string().optional(),
  medicalHistory: z.string().trim().max(1000, "Riwayat penyakit maksimal 1000 karakter").optional(),
  allergyHistory: z.string().trim().max(1000, "Riwayat alergi maksimal 1000 karakter").optional(),
  height: z.string().optional(),
  weight: z.string().optional(),
  socialType: z.enum(['periang', 'minder', 'tenang']).optional(),
  peerReaction: z.enum(['aktif', 'pasif']).optional()
});

const defaultFormData: UserFormData = {
  name: '',
  email: '',
  role: 'santri',
  employeeId: '',
  nisn: '',
  nis: '',
  birthDate: '',
  address: '',
  kelasId: '',
  mapelIds: [],
  status: 'aktif',
  avatar: '',
  previousSchool: '',
  childOrder: '',
  bloodType: '',
  medicalHistory: '',
  allergyHistory: '',
  height: '',
  weight: '',
  socialType: 'periang',
  peerReaction: 'aktif',
  photoChild: '',
  familyCard: '',
  achievementCertificate: '',
  stifin: '',
  asesmenAwal: '',
  jenisKelamin: '',
  tempatLahir: '',
  tanggalLahir: '',
  nik: '',
  alamatStaff: ''
};

export default function SantriProfile() {
  const { user: authUser } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [santriData, setSantriData] = useState<any>(null);
  const [kelasList, setKelasList] = useState<KelasOption[]>([]);
  const [formData, setFormData] = useState<UserFormData>(defaultFormData);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [photoChildPreview, setPhotoChildPreview] = useState('');
  const [familyCardPreview, setFamilyCardPreview] = useState('');
  const [achievementCertificatePreview, setAchievementCertificatePreview] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  useEffect(() => {
    if (authUser?.id) {
      fetchUserProfile();
      fetchKelasList();
    }
  }, [authUser?.id]);

  const fetchKelasList = async () => {
    try {
      const { data: kelas, error } = await supabase
        .from('kelas')
        .select('id, nama, tingkat, tahun_ajaran')
        .order('tingkat', { ascending: true })
        .order('nama', { ascending: true });
      if (error) throw error;
      setKelasList(kelas || []);
    } catch (error) {
      console.error('Error fetching kelas list:', error);
    }
  };

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

      const { data: santri, error: santriError } = await supabase
        .from('santri')
        .select(`
          id, nis, nisn, kelas_id, birth_date, address, blood_type, height, weight,
          child_order, previous_school, medical_history, allergy_history,
          social_type, peer_reaction, photo_url, family_card_url, achievement_cert_url,
          kelas:kelas_id(
            id, nama, tingkat, tahun_ajaran, walikelas_id,
            wali_kelas:staff!kelas_walikelas_id_fkey(id, profiles!staff_id_fkey(name))
          )
        `)
        .eq('id', authUser.id)
        .maybeSingle();
      if (santriError) console.error('Error fetching santri data:', santriError);
      
      if (santri) {
        setSantriData(santri);
        setFormData({
          name: profile?.name || authUser.name,
          email: profile?.email || authUser.email || '',
          role: 'santri',
          employeeId: '',
          nisn: santri.nisn || '',
          nis: santri.nis || '',
          birthDate: santri.birth_date || '',
          address: santri.address || '',
          kelasId: santri.kelas_id || '',
          mapelIds: [],
          status: profile?.status || 'aktif',
          avatar: profile?.avatar_url || '',
          previousSchool: santri.previous_school || '',
          childOrder: santri.child_order || '',
          bloodType: santri.blood_type || '',
          medicalHistory: santri.medical_history || '',
          allergyHistory: santri.allergy_history || '',
          height: santri.height || '',
          weight: santri.weight || '',
          socialType: santri.social_type as 'periang' | 'minder' | 'tenang' || 'periang',
          peerReaction: santri.peer_reaction as 'aktif' | 'pasif' || 'aktif',
          photoChild: santri.photo_url || '',
          familyCard: santri.family_card_url || '',
          achievementCertificate: santri.achievement_cert_url || '',
          stifin: '',
          asesmenAwal: '',
          jenisKelamin: '',
          tempatLahir: '',
          tanggalLahir: '',
          nik: '',
          alamatStaff: ''
        });
        setAvatarPreview(profile?.avatar_url || '');
        setPhotoChildPreview(santri.photo_url || '');
        setFamilyCardPreview(santri.family_card_url || '');
        setAchievementCertificatePreview(santri.achievement_cert_url || '');
      } else {
        setFormData({ 
          ...defaultFormData, 
          name: profile?.name || authUser.name, 
          email: profile?.email || authUser.email || '', 
          status: profile?.status || 'aktif', 
          avatar: profile?.avatar_url || '' 
        });
        setAvatarPreview(profile?.avatar_url || '');
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      toast({ title: "Error", description: "Gagal memuat data profil", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setPreview: (value: string) => void,
    formKey: keyof UserFormData
  ) => {
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
        setPreview(result);
        setFormData(prev => ({ ...prev, [formKey]: result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => handleFileChange(e, setAvatarPreview, 'avatar');
  const handlePhotoChildChange = (e: React.ChangeEvent<HTMLInputElement>) => handleFileChange(e, setPhotoChildPreview, 'photoChild');
  const handleFamilyCardChange = (e: React.ChangeEvent<HTMLInputElement>) => handleFileChange(e, setFamilyCardPreview, 'familyCard');
  const handleAchievementCertificateChange = (e: React.ChangeEvent<HTMLInputElement>) => handleFileChange(e, setAchievementCertificatePreview, 'achievementCertificate');

  const userKelas = santriData?.kelas || null;

  const handleSave = async () => {
    try {
      const validated = userSchema.parse(formData);
      if (!authUser?.id) return;

      const { error: profileError } = await supabase.from('profiles').update({
        name: validated.name,
        email: validated.email,
        avatar_url: formData.avatar
      }).eq('id', authUser.id);
      if (profileError) throw profileError;

      const santriPayload = {
        nisn: validated.nisn,
        nis: validated.nis,
        birth_date: validated.birthDate || null,
        address: validated.address,
        previous_school: validated.previousSchool,
        child_order: validated.childOrder,
        blood_type: validated.bloodType,
        medical_history: validated.medicalHistory,
        allergy_history: validated.allergyHistory,
        height: validated.height,
        weight: validated.weight,
        social_type: validated.socialType,
        peer_reaction: validated.peerReaction,
        photo_url: formData.photoChild,
        family_card_url: formData.familyCard,
        achievement_cert_url: formData.achievementCertificate
      };

      const { error: santriError } = await supabase.from('santri').update(santriPayload).eq('id', authUser.id);
      if (santriError) throw santriError;

      toast({ title: "Berhasil", description: "Perubahan data berhasil disimpan." });
      await fetchUserProfile();
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({ title: "Validasi Gagal", description: error.errors[0].message, variant: "destructive" });
      } else {
        console.error('Save error:', error);
        toast({ title: "Error", description: "Gagal menyimpan perubahan", variant: "destructive" });
      }
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
                Santri
              </Badge>
              {userKelas && (
                <Badge variant="outline" className="bg-primary-foreground/10 text-primary-foreground border-primary-foreground/30">
                  {userKelas.nama} - {userKelas.tingkat}
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

        <TabsContent value="profil">
          <UserInfoTab
            user={{ 
              id: authUser?.id || '', 
              name: formData.name, 
              email: formData.email, 
              role: 'santri', 
              status: formData.status,
              createdAt: new Date().toISOString()
            }}
            formData={formData}
            setFormData={setFormData}
            isEditMode={false}
            kelasList={kelasList}
            userKelas={userKelas}
            userMapel={[]}
            toggleMapel={() => {}}
            newPassword={newPassword}
            setNewPassword={setNewPassword}
            confirmPassword={confirmPassword}
            setConfirmPassword={setConfirmPassword}
            isChangingPassword={isChangingPassword}
            handleChangePassword={handleChangePassword}
            onSave={handleSave}
            disableEdit={true}
          />
        </TabsContent>

        <TabsContent value="notifikasi" className="space-y-4">
          <PushNotificationSettings />
          <InstallAppSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
