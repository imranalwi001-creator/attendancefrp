import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { mockMapel } from '@/mocks/data';
import { Info, BookOpen, Heart, FileText, Brain } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Role, User } from '@/types';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { UserDetailSkeleton } from '@/components/skeletons/UserDetailSkeleton';
import {
  UserDetailHeader,
  UserInfoTab,
  UserPersonalTab,
  UserDocumentsTab,
  UserMapelTab,
  UserPsikologiTab,
  UserFormData,
  KelasOption
} from '@/components/user-detail';

// Helper function to upload psychology document images to storage
async function uploadPsikologiImage(dataUrl: string, santriId: string, prefix: string): Promise<string | null> {
  try {
    // Convert data URL to blob
    const [meta, base64Data] = dataUrl.split(',');
    const mimeMatch = meta.match(/^data:(.*?);/);
    const mimeType = mimeMatch?.[1] || 'image/png';
    
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const blob = new Blob([bytes], { type: mimeType });
    const extension = mimeType.split('/')[1] === 'jpeg' ? 'jpg' : mimeType.split('/')[1];
    const fileName = `${santriId}/${prefix}-${Date.now()}.${extension}`;
    
    // Upload to storage bucket
    const { data, error } = await supabase.storage
      .from('user-documents')
      .upload(fileName, blob, { upsert: true });
    
    if (error) {
      console.error('Upload error:', error);
      return null;
    }
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('user-documents')
      .getPublicUrl(fileName);
    
    return publicUrl;
  } catch (error) {
    console.error('Error uploading image:', error);
    return null;
  }
}

// Validation schema
const userSchema = z.object({
  name: z.string().trim().min(1, "Nama tidak boleh kosong").max(100, "Nama maksimal 100 karakter"),
  email: z.string().trim().email("Email tidak valid").max(255, "Email maksimal 255 karakter"),
  employeeId: z.string().trim().max(50, "Nomor induk maksimal 50 karakter").optional(),
  nisn: z.string().trim().max(50, "NISN maksimal 50 karakter").optional(),
  nis: z.string().trim().max(50, "NIS maksimal 50 karakter").optional(),
  birthDate: z.string().optional(),
  address: z.string().trim().max(500, "Alamat maksimal 500 karakter").optional(),
  role: z.enum(['admin', 'guru', 'walikelas', 'santri', 'orangtua', 'Pembina', 'staff']),
  kelasId: z.string().optional(),
  mapelIds: z.array(z.string()),
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
  role: 'guru',
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
  // Psychology assessment fields
  stifin: '',
  asesmenAwal: '',
  // Staff specific fields
  jenisKelamin: '',
  tempatLahir: '',
  tanggalLahir: '',
  nik: '',
  alamatStaff: ''
};

export default function UserDetail() {
  const { id: userId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [santriData, setSantriData] = useState<any>(null);
  const [staffData, setStaffData] = useState<any>(null);
  const [parentData, setParentData] = useState<any>(null);
  const [kelasList, setKelasList] = useState<KelasOption[]>([]);
  const [formData, setFormData] = useState<UserFormData>(defaultFormData);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [photoChildPreview, setPhotoChildPreview] = useState('');
  const [familyCardPreview, setFamilyCardPreview] = useState('');
  const [achievementCertificatePreview, setAchievementCertificatePreview] = useState('');
  const [stifinPreview, setStifinPreview] = useState('');
  const [asesmenAwalPreviews, setAsesmenAwalPreviews] = useState<string[]>([]);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  
  // Only used for staff edit mode from header
  const [isEditMode, setIsEditMode] = useState(false);

  useEffect(() => {
    if (userId) {
      fetchUser();
      fetchKelasList();
    }
  }, [userId]);

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

  const fetchUser = async () => {
    try {
      setLoading(true);

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, name, email, phone, status, avatar_url, created_at')
        .eq('id', userId)
        .maybeSingle();
      if (profileError) throw profileError;
      if (!profile) throw new Error('Profil pengguna tidak ditemukan');

      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .eq('user_id', userId)
        .maybeSingle();
      if (roleError) throw roleError;
      if (!roleData) throw new Error('Role pengguna tidak ditemukan');

      const userData: User = {
        id: profile.id,
        name: profile.name,
        email: profile.email || '',
        role: roleData.role,
        status: profile.status,
        createdAt: profile.created_at
      };
      setUser(userData);

      if (roleData.role === 'santri') {
        const { data: santri, error: santriError } = await supabase
          .from('santri')
          .select(`
            id, kelas_id, nis, nisn, birth_date, address, previous_school, child_order, blood_type, medical_history, allergy_history, height, weight, social_type, peer_reaction, photo_url, family_card_url, achievement_cert_url,
            stifin_url, asesmen_awal_url, kelas:kelas_id(
              id, nama, tingkat, tahun_ajaran, walikelas_id,
              wali_kelas:staff!kelas_walikelas_id_fkey(id, profiles!staff_id_fkey(name))
            )
          `)
          .eq('id', userId)
          .maybeSingle();
        if (santriError) console.error('Error fetching santri data:', santriError);
        
        if (santri) {
          setSantriData(santri);
          setFormData({
            name: userData.name,
            email: userData.email || '',
            role: userData.role,
            employeeId: '',
            nisn: santri.nisn || '',
            nis: santri.nis || '',
            birthDate: santri.birth_date || '',
            address: santri.address || '',
            kelasId: santri.kelas_id || '',
            mapelIds: [],
            status: userData.status || 'aktif',
            avatar: profile.avatar_url || '',
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
            stifin: santri.stifin_url || '',
            asesmenAwal: santri.asesmen_awal_url ? JSON.stringify(santri.asesmen_awal_url) : '',
            jenisKelamin: '',
            tempatLahir: '',
            tanggalLahir: '',
            nik: '',
            alamatStaff: ''
          });
          setAvatarPreview(profile.avatar_url || '');
          setPhotoChildPreview(santri.photo_url || '');
          setFamilyCardPreview(santri.family_card_url || '');
          setAchievementCertificatePreview(santri.achievement_cert_url || '');
          setStifinPreview(santri.stifin_url || '');
          // Parse asesmen_awal_url which is stored as JSONB array
          if (santri.asesmen_awal_url && Array.isArray(santri.asesmen_awal_url)) {
            setAsesmenAwalPreviews(santri.asesmen_awal_url as string[]);
          }
        } else {
          setFormData({ ...defaultFormData, name: userData.name, email: userData.email || '', role: userData.role, status: userData.status || 'aktif', avatar: profile.avatar_url || '' });
          setAvatarPreview(profile.avatar_url || '');
        }
      } else if (['admin', 'guru', 'walikelas', 'Pembina', 'staff'].includes(roleData.role)) {
        const { data: staff, error: staffError } = await supabase
          .from('staff')
          .select(`id, employee_id, kelas_id, jenis_kelamin, tempat_lahir, tanggal_lahir, nik, alamat, kelas:kelas_id(id, nama, tingkat, tahun_ajaran, walikelas_id)`)
          .eq('id', userId)
          .maybeSingle();
        if (staffError) console.error('Error fetching staff data:', staffError);
        
        if (staff) {
          setStaffData(staff);
          setFormData({
            ...defaultFormData,
            name: userData.name,
            email: userData.email || '',
            role: userData.role,
            employeeId: staff.employee_id || '',
            kelasId: staff.kelas_id || '',
            status: userData.status || 'aktif',
            avatar: profile.avatar_url || '',
            jenisKelamin: staff.jenis_kelamin || '',
            tempatLahir: staff.tempat_lahir || '',
            tanggalLahir: staff.tanggal_lahir || '',
            nik: staff.nik || '',
            alamatStaff: staff.alamat || ''
          });
          setAvatarPreview(profile.avatar_url || '');
        } else {
          setFormData({ ...defaultFormData, name: userData.name, email: userData.email || '', role: userData.role, status: userData.status || 'aktif', avatar: profile.avatar_url || '' });
          setAvatarPreview(profile.avatar_url || '');
        }
      } else if (roleData.role === 'orangtua') {
        const { data: parent, error: parentError } = await supabase.from('orangtua').select('id, occupation, relationship, notes').eq('id', userId).maybeSingle();
        if (parentError) console.error('Error fetching parent data:', parentError);
        if (parent) setParentData(parent);
        setFormData({ ...defaultFormData, name: userData.name, email: userData.email || '', role: userData.role, status: userData.status || 'aktif', avatar: profile.avatar_url || '' });
        setAvatarPreview(profile.avatar_url || '');
      } else {
        setFormData({ ...defaultFormData, name: userData.name, email: userData.email || '', role: userData.role, status: userData.status || 'aktif', avatar: profile.avatar_url || '' });
        setAvatarPreview(profile.avatar_url || '');
      }
    } catch (error) {
      console.error('Error fetching user:', error);
      toast({ title: "Error", description: "Gagal memuat data pengguna", variant: "destructive" });
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
  const handleStifinChange = (e: React.ChangeEvent<HTMLInputElement>) => handleFileChange(e, setStifinPreview, 'stifin');
  const handleAsesmenAwalChange = (previews: string[]) => {
    setAsesmenAwalPreviews(previews);
    // Store as JSON array in formData
    setFormData(prev => ({ ...prev, asesmenAwal: JSON.stringify(previews) }));
  };

  const userKelas = santriData?.kelas || staffData?.kelas || null;
  const userMapel = formData.mapelIds ? mockMapel.filter(m => formData.mapelIds?.includes(m.id)) : [];

  const handleSave = async () => {
    try {
      const validated = userSchema.parse(formData);
      if (!userId) return;

      const { error: profileError } = await supabase.from('profiles').update({
        name: validated.name,
        email: validated.email,
        status: validated.status,
        avatar_url: formData.avatar
      }).eq('id', userId);
      if (profileError) throw profileError;

      const { error: roleError } = await supabase.rpc('set_user_role', { _user_id: userId, _role: validated.role });
      if (roleError) throw roleError;

      if (validated.role === 'santri') {
        const { data: existingSantri } = await supabase.from('santri').select('id').eq('id', userId).maybeSingle();
        const santriPayload = {
          nisn: validated.nisn,
          nis: validated.nis,
          kelas_id: validated.kelasId || null,
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
        if (existingSantri) {
          const { error: santriError } = await supabase.from('santri').update(santriPayload).eq('id', userId);
          if (santriError) throw santriError;
        } else {
          const { error: santriError } = await supabase.from('santri').insert({ id: userId, ...santriPayload });
          if (santriError) throw santriError;
        }
      } else if (['admin', 'guru', 'walikelas', 'Pembina', 'staff'].includes(validated.role)) {
        const { error: staffError } = await supabase.from('staff').upsert({
          id: userId,
          employee_id: validated.employeeId,
          kelas_id: validated.kelasId || null,
          jenis_kelamin: formData.jenisKelamin || null,
          tempat_lahir: formData.tempatLahir || null,
          tanggal_lahir: formData.tanggalLahir || null,
          nik: formData.nik || null,
          alamat: formData.alamatStaff || null
        });
        if (staffError) throw staffError;
      }

      toast({ title: "Perubahan Disimpan", description: "Perubahan data berhasil disimpan." });
      await fetchUser();
      setIsEditMode(false);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({ title: "Validasi Gagal", description: error.errors[0].message, variant: "destructive" });
      } else {
        console.error('Save error:', error);
        toast({ title: "Error", description: "Gagal menyimpan perubahan", variant: "destructive" });
      }
    }
  };

  const handleCancel = () => {
    if (!user) return;
    if (user.role === 'santri' && santriData) {
      setFormData({
        name: user.name, email: user.email || '', role: user.role, employeeId: '',
        nisn: santriData.nisn || '', nis: santriData.nis || '', birthDate: santriData.birth_date || '',
        address: santriData.address || '', kelasId: santriData.kelas_id || '', mapelIds: [],
        status: user.status || 'aktif', avatar: user.avatar || '',
        previousSchool: santriData.previous_school || '', childOrder: santriData.child_order || '',
        bloodType: santriData.blood_type || '', medicalHistory: santriData.medical_history || '',
        allergyHistory: santriData.allergy_history || '', height: santriData.height || '',
        weight: santriData.weight || '', socialType: santriData.social_type || 'periang',
        peerReaction: santriData.peer_reaction || 'aktif', photoChild: santriData.photo_url || '',
        familyCard: santriData.family_card_url || '', achievementCertificate: santriData.achievement_cert_url || '',
        stifin: '', asesmenAwal: '',
        jenisKelamin: '', tempatLahir: '', tanggalLahir: '', nik: '', alamatStaff: ''
      });
      setPhotoChildPreview(santriData.photo_url || '');
      setFamilyCardPreview(santriData.family_card_url || '');
      setAchievementCertificatePreview(santriData.achievement_cert_url || '');
    } else if (['admin', 'guru', 'walikelas', 'Pembina', 'staff'].includes(user.role) && staffData) {
      setFormData({
        ...defaultFormData, name: user.name, email: user.email || '', role: user.role,
        employeeId: staffData.employee_id || '', kelasId: staffData.kelas_id || '',
        status: user.status || 'aktif', avatar: user.avatar || '',
        jenisKelamin: staffData.jenis_kelamin || '',
        tempatLahir: staffData.tempat_lahir || '',
        tanggalLahir: staffData.tanggal_lahir || '',
        nik: staffData.nik || '',
        alamatStaff: staffData.alamat || ''
      });
    } else {
      setFormData({ ...defaultFormData, name: user.name, email: user.email || '', role: user.role, status: user.status || 'aktif', avatar: user.avatar || '' });
    }
    setAvatarPreview(user.avatar || '');
    setIsEditMode(false);
  };

  const handleDelete = async () => {
    try {
      if (!userId) return;
      const { error } = await supabase.rpc('delete_user_cascade' as any, { user_id_to_delete: userId });
      if (error) throw error;
      toast({ title: "Pengguna Dihapus", description: "Pengguna telah dihapus." });
      navigate('/admin/users');
    } catch (error) {
      console.error('Error deleting user:', error);
      toast({ title: "Error", description: "Gagal menghapus pengguna", variant: "destructive" });
    }
  };

  const toggleMapel = (mapelId: string) => {
    setFormData(prev => ({
      ...prev,
      mapelIds: prev.mapelIds.includes(mapelId)
        ? prev.mapelIds.filter(id => id !== mapelId)
        : [...prev.mapelIds, mapelId]
    }));
  };

  const handleChangePassword = async () => {
    if (!userId) return;
    if (!newPassword || newPassword.trim() === '') {
      toast({ title: "Password tidak boleh kosong", description: "Masukkan password baru", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Password terlalu pendek", description: "Password minimal 6 karakter", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Password tidak cocok", description: "Password dan konfirmasi password harus sama", variant: "destructive" });
      return;
    }
    try {
      setIsChangingPassword(true);
      const { data, error } = await supabase.functions.invoke('update-user-password', { body: { userId, newPassword } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Password berhasil diubah", description: "Password pengguna telah diperbarui" });
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error('Error changing password:', error);
      toast({ title: "Gagal mengubah password", description: error.message || "Terjadi kesalahan saat mengubah password", variant: "destructive" });
    } finally {
      setIsChangingPassword(false);
    }
  };


  if (loading) return <UserDetailSkeleton />;
  
  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Pengguna tidak ditemukan</p>
        <Button onClick={() => navigate('/admin/users')} className="mt-4">Kembali</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <UserDetailHeader
        formData={formData}
        avatarPreview={avatarPreview}
        isEditMode={formData.role !== 'santri' ? isEditMode : false}
        onEditModeToggle={() => setIsEditMode(true)}
        onSave={handleSave}
        onCancel={handleCancel}
        onDelete={() => setShowDeleteDialog(true)}
        onAvatarChange={handleAvatarChange}
        onNavigateBack={() => navigate('/admin/users')}
        hideEditButton={formData.role === 'santri'}
      />

      <Tabs defaultValue="info" className="w-full">
        <TabsList variant="admin" className={formData.role === 'santri' ? 'grid-cols-4' : 'grid-cols-2'}>
          <TabsTrigger value="info" variant="admin">
            <Info className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">Informasi</span>
          </TabsTrigger>
          {formData.role === 'santri' ? (
            <>
              <TabsTrigger value="personal" variant="admin">
                <Heart className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Personal</span>
              </TabsTrigger>
              <TabsTrigger value="documents" variant="admin">
                <FileText className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Dokumen</span>
              </TabsTrigger>
              <TabsTrigger value="psikologi" variant="admin">
                <Brain className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Assesmen Psikologi</span>
              </TabsTrigger>
            </>
          ) : (
            <TabsTrigger value="mapel" variant="admin">
              <BookOpen className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Mata Pelajaran</span>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="info" className="mt-6">
          <UserInfoTab
            user={user}
            formData={formData}
            setFormData={setFormData}
            isEditMode={isEditMode}
            kelasList={kelasList}
            userKelas={userKelas}
            userMapel={userMapel}
            toggleMapel={toggleMapel}
            newPassword={newPassword}
            setNewPassword={setNewPassword}
            confirmPassword={confirmPassword}
            setConfirmPassword={setConfirmPassword}
            isChangingPassword={isChangingPassword}
            handleChangePassword={handleChangePassword}
            onSave={handleSave}
          />
        </TabsContent>

        {formData.role === 'santri' && (
          <>
            <TabsContent value="personal" className="mt-6">
              <UserPersonalTab
                formData={formData}
                setFormData={setFormData}
                isEditMode={false}
                onSave={handleSave}
              />
            </TabsContent>
            <TabsContent value="documents" className="mt-6">
              <UserDocumentsTab
                photoChildPreview={photoChildPreview}
                familyCardPreview={familyCardPreview}
                achievementCertificatePreview={achievementCertificatePreview}
                onPhotoChildChange={handlePhotoChildChange}
                onFamilyCardChange={handleFamilyCardChange}
                onAchievementCertificateChange={handleAchievementCertificateChange}
                santriId={userId}
                santriName={formData.name}
                onSave={async () => {
                  if (!userId) return;
                  const { error } = await supabase.from('santri').update({
                    photo_url: formData.photoChild,
                    family_card_url: formData.familyCard,
                    achievement_cert_url: formData.achievementCertificate
                  }).eq('id', userId);
                  if (error) throw error;
                  await fetchUser();
                }}
              />
            </TabsContent>
            <TabsContent value="psikologi" className="mt-6">
              <UserPsikologiTab
                santriId={userId}
                santriName={formData.name}
                stifinPreview={stifinPreview}
                asesmenAwalPreviews={asesmenAwalPreviews}
                onStifinChange={handleStifinChange}
                onAsesmenAwalChange={handleAsesmenAwalChange}
                onSave={async () => {
                  if (!userId) return;
                  
                  // Upload stifin image to storage if it's a data URL
                  let stifinUrl = formData.stifin;
                  if (formData.stifin && formData.stifin.startsWith('data:')) {
                    const stifinUploadUrl = await uploadPsikologiImage(formData.stifin, userId, 'stifin');
                    if (stifinUploadUrl) {
                      stifinUrl = stifinUploadUrl;
                    }
                  }
                  
                  // Upload asesmen awal images to storage
                  const asesmenAwalUrls: string[] = [];
                  const asesmenAwalArray = asesmenAwalPreviews;
                  
                  for (let i = 0; i < asesmenAwalArray.length; i++) {
                    const preview = asesmenAwalArray[i];
                    if (preview.startsWith('data:')) {
                      const uploadedUrl = await uploadPsikologiImage(preview, userId, `asesmen-awal-${i}`);
                      if (uploadedUrl) {
                        asesmenAwalUrls.push(uploadedUrl);
                      }
                    } else {
                      // Already a URL, keep it
                      asesmenAwalUrls.push(preview);
                    }
                  }
                  
                  // Save to database
                  const { error } = await supabase.from('santri').update({
                    stifin_url: stifinUrl || null,
                    asesmen_awal_url: asesmenAwalUrls.length > 0 ? asesmenAwalUrls : null
                  }).eq('id', userId);
                  
                  if (error) throw error;
                  await fetchUser();
                }}
              />
            </TabsContent>
          </>
        )}

        <TabsContent value="mapel" className="mt-6">
          <UserMapelTab userId={userId || ''} />
        </TabsContent>
      </Tabs>

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
    </div>
  );
}
