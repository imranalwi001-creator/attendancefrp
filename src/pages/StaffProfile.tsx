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

// Validation schema for staff
const staffSchema = z.object({
  name: z.string().trim().min(1, "Nama tidak boleh kosong").max(100, "Nama maksimal 100 karakter"),
  email: z.string().trim().email("Email tidak valid").max(255, "Email maksimal 255 karakter"),
  employeeId: z.string().trim().max(50, "Nomor induk maksimal 50 karakter").optional(),
  status: z.enum(['aktif', 'nonaktif', 'cuti', 'alumni']),
  jenisKelamin: z.string().optional(),
  tempatLahir: z.string().trim().max(100, "Tempat lahir maksimal 100 karakter").optional(),
  tanggalLahir: z.string().optional(),
  nik: z.string().trim().max(20, "NIK maksimal 20 karakter").optional(),
  alamatStaff: z.string().trim().max(500, "Alamat maksimal 500 karakter").optional()
});

const defaultFormData: UserFormData = {
  name: '',
  email: '',
  role: 'staff',
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

const getRoleLabel = (role: string) => {
  const labels: Record<string, string> = {
    admin: 'Administrator',
    guru: 'Guru',
    walikelas: 'Wali Kelas',
    Pembina: 'Pembina',
    staff: 'Staff'
  };
  return labels[role] || role;
};

export default function StaffProfile() {
  const { user: authUser } = useAuth();
  const { toast } = useToast();
  const userRole = authUser?.role;
  
  const [loading, setLoading] = useState(true);
  const [staffData, setStaffData] = useState<any>(null);
  const [kelasList, setKelasList] = useState<KelasOption[]>([]);
  const [formData, setFormData] = useState<UserFormData>(defaultFormData);
  const [avatarPreview, setAvatarPreview] = useState('');
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

      const { data: staff, error: staffError } = await supabase
        .from('staff')
        .select(`*, kelas:kelas_id(id, nama, tingkat, tahun_ajaran, walikelas_id)`)
        .eq('id', authUser.id)
        .maybeSingle();
      if (staffError) console.error('Error fetching staff data:', staffError);
      
      if (staff) {
        setStaffData(staff);
        setFormData({
          ...defaultFormData,
          name: profile?.name || authUser.name,
          email: profile?.email || authUser.email || '',
          role: userRole || 'staff',
          employeeId: staff.employee_id || '',
          kelasId: staff.kelas_id || '',
          status: profile?.status || 'aktif',
          avatar: profile?.avatar_url || '',
          jenisKelamin: staff.jenis_kelamin || '',
          tempatLahir: staff.tempat_lahir || '',
          tanggalLahir: staff.tanggal_lahir || '',
          nik: staff.nik || '',
          alamatStaff: staff.alamat || ''
        });
        setAvatarPreview(profile?.avatar_url || '');
      } else {
        setFormData({ 
          ...defaultFormData, 
          name: profile?.name || authUser.name, 
          email: profile?.email || authUser.email || '', 
          role: userRole || 'staff',
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

  const userKelas = staffData?.kelas || null;

  const handleSave = async () => {
    try {
      const validated = staffSchema.parse(formData);
      if (!authUser?.id) return;

      const { error: profileError } = await supabase.from('profiles').update({
        name: validated.name,
        email: validated.email,
        avatar_url: formData.avatar
      }).eq('id', authUser.id);
      if (profileError) throw profileError;

      const staffPayload = {
        employee_id: validated.employeeId,
        jenis_kelamin: validated.jenisKelamin || null,
        tempat_lahir: validated.tempatLahir || null,
        tanggal_lahir: validated.tanggalLahir || null,
        nik: validated.nik || null,
        alamat: validated.alamatStaff || null
      };

      const { error: staffError } = await supabase.from('staff').update(staffPayload).eq('id', authUser.id);
      if (staffError) throw staffError;

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
                {getRoleLabel(formData.role)}
              </Badge>
              {userKelas && (
                <Badge variant="outline" className="bg-primary-foreground/10 text-primary-foreground border-primary-foreground/30">
                  Wali Kelas {userKelas.nama}
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
              role: formData.role, 
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
