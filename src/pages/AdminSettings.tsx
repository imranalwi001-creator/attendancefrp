// Admin Settings Page
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Plus, Calendar, BookOpen, AlertTriangle, UserCheck, Bell, ShieldAlert, Loader2, Moon, Palmtree, ChevronRight, ArrowLeft, Settings, Sparkles, Monitor, UserPlus, FileText, Building2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAcademicYear, type AcademicYear } from '@/contexts/AcademicYearContext';
import AcademicYearForm from '@/components/admin/AcademicYearForm';
import AcademicYearList from '@/components/admin/AcademicYearList';
import MasterMapelForm, { type MasterMapel } from '@/components/admin/MasterMapelForm';
import MasterMapelList from '@/components/admin/MasterMapelList';
import { LokasiAbsenForm } from '@/components/kehadiran/LokasiAbsenForm';
import { WaktuKerjaForm } from '@/components/kehadiran/WaktuKerjaForm';
import { PushNotificationSettings } from '@/components/settings/PushNotificationSettings';
import RamadhanConfigForm from '@/components/admin/RamadhanConfigForm';
import LiburanConfigTab from '@/components/settings/LiburanConfigTab';
import { AiSettingsPanel } from '@/components/settings/AiSettingsPanel';
import { LandingPageConfigTab } from '@/components/settings/LandingPageConfigTab';
import { WorkspaceInvitesTab } from '@/components/settings/WorkspaceInvitesTab';
import { PrintSettingsTab } from '@/components/settings/PrintSettingsTab';
import { WorkspaceProfileTab } from '@/components/settings/WorkspaceProfileTab';
import { useInstitution } from '@/contexts/InstitutionContext';
import { useAuth } from '@/contexts/AuthContext';

const settingsMenuItems = [
  { key: 'profil-institusi', title: 'Profil Institusi', description: 'Atur nama dan logo ruang kerja Anda', icon: Building2 },
  { key: 'tahun-ajaran', title: 'Tahun Ajaran', description: 'Kelola periode tahun ajaran', icon: Calendar },
  { key: 'data-mapel', title: 'Data Mata Pelajaran', description: 'Master data mata pelajaran', icon: BookOpen },
  { key: 'absen-staff', title: 'Absensi Staff', description: 'Lokasi & waktu kerja absensi', icon: UserCheck },
  { key: 'ramadhan', title: 'Ramadhan', description: 'Konfigurasi program Ramadhan', icon: Moon },
  { key: 'liburan', title: 'Liburan', description: 'Konfigurasi periode liburan', icon: Palmtree },
  { key: 'notifikasi', title: 'Notifikasi', description: 'Pengaturan push notification', icon: Bell },
  { key: 'print-settings', title: 'Pengaturan Laporan & Cetak', description: 'Atur kop surat, logo, dan tanda tangan digital', icon: FileText },
  { key: 'ai', title: 'AI', description: 'Konfigurasi API key & health check AI', icon: Sparkles },
  { key: 'landing-page', title: 'Landing Page', description: 'Pengaturan konten halaman utama', icon: Monitor },
  { key: 'tarik-data', title: 'Tarik Data Guru', description: 'Undang guru mandiri ke sekolah Anda', icon: UserPlus },
];

export default function AdminSettings() {
  const { toast } = useToast();
  const { workspaceType } = useInstitution();
  const { user } = useAuth();
  
  const isSuperadmin = user?.role === 'admin' && workspaceType === 'mandiri';
  const isGuruMandiri = user?.role === 'guru' && workspaceType === 'mandiri';
  const isAdminSekolah = user?.role === 'admin' && workspaceType === 'sekolah';

  const { activeAcademicYear, refetch: refetchActiveYear, isDateOutsideSemesters } = useAcademicYear();

  // Academic Year State
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [isLoadingYears, setIsLoadingYears] = useState(true);
  const [isYearFormOpen, setIsYearFormOpen] = useState(false);
  const [editingYear, setEditingYear] = useState<AcademicYear | null>(null);
  const [deletingYear, setDeletingYear] = useState<AcademicYear | null>(null);
  const [deleteYearPassword, setDeleteYearPassword] = useState('');
  const [deleteYearError, setDeleteYearError] = useState('');
  const [deleteYearLoading, setDeleteYearLoading] = useState(false);
  const [activatingYear, setActivatingYear] = useState<AcademicYear | null>(null);
  const [isSubmittingYear, setIsSubmittingYear] = useState(false);

  // Master Mapel State
  const [masterMapelList, setMasterMapelList] = useState<MasterMapel[]>([]);
  const [isLoadingMapel, setIsLoadingMapel] = useState(true);
  const [isMapelFormOpen, setIsMapelFormOpen] = useState(false);
  const [editingMapel, setEditingMapel] = useState<MasterMapel | null>(null);
  const [deletingMapel, setDeletingMapel] = useState<MasterMapel | null>(null);
  const [isSubmittingMapel, setIsSubmittingMapel] = useState(false);

  // Fetch Academic Years
  const fetchAcademicYears = async () => {
    try {
      const { data, error } = await supabase
        .from('academic_years')
        .select('id, name, is_active, odd_semester_start, odd_semester_end, even_semester_start, even_semester_end, odd_semester_model, even_semester_model, created_at, updated_at')
        .order('name', { ascending: false })
        .limit(20);

      if (error) throw error;
      const mappedData: AcademicYear[] = (data || []).map(item => ({
        ...item,
        odd_semester_model: (item.odd_semester_model as AcademicYear['odd_semester_model']) || 'normal',
        even_semester_model: (item.even_semester_model as AcademicYear['even_semester_model']) || 'normal',
      }));
      setAcademicYears(mappedData);
    } catch (error) {
      console.error('Error fetching academic years:', error);
      toast({
        title: 'Error',
        description: 'Gagal memuat data tahun ajaran',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingYears(false);
    }
  };

  // Fetch Master Mapel
  const fetchMasterMapel = async () => {
    try {
      const { data, error } = await supabase
        .from('master_mapel')
        .select('id, nama, kategori, deskripsi, created_at, updated_at')
        .order('nama', { ascending: true })
        .limit(100);

      if (error) throw error;
      setMasterMapelList(data || []);
    } catch (error) {
      console.error('Error fetching master mapel:', error);
      toast({
        title: 'Error',
        description: 'Gagal memuat data mata pelajaran',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingMapel(false);
    }
  };

  useEffect(() => {
    fetchAcademicYears();
    fetchMasterMapel();
  }, []);

  // Academic Year Handlers
  const handleYearSubmit = async (data: Omit<AcademicYear, 'id' | 'created_at' | 'updated_at'>) => {
    setIsSubmittingYear(true);
    try {
      let academicYearId: string;

      if (editingYear) {
        const { error } = await supabase
          .from('academic_years')
          .update(data)
          .eq('id', editingYear.id);

        if (error) throw error;
        academicYearId = editingYear.id;
        toast({
          title: 'Berhasil',
          description: 'Tahun ajaran berhasil diperbarui',
        });
      } else {
        const { data: insertedData, error } = await supabase
          .from('academic_years')
          .insert(data)
          .select('id')
          .single();

        if (error) {
          if (error.code === '23505') {
            toast({
              title: 'Error',
              description: 'Tahun ajaran dengan nama tersebut sudah ada',
              variant: 'destructive',
            });
            return;
          }
          throw error;
        }
        academicYearId = insertedData.id;
        toast({
          title: 'Berhasil',
          description: 'Tahun ajaran berhasil ditambahkan',
        });
      }

      // Save learning blocks if using sistem blok
      if ((window as any).__academicYearFormSaveBlocks) {
        await (window as any).__academicYearFormSaveBlocks(academicYearId);
      }

      setIsYearFormOpen(false);
      setEditingYear(null);
      fetchAcademicYears();
      refetchActiveYear();
    } catch (error) {
      console.error('Error saving academic year:', error);
      toast({
        title: 'Error',
        description: 'Gagal menyimpan tahun ajaran',
        variant: 'destructive',
      });
    } finally {
      setIsSubmittingYear(false);
    }
  };

  const handleYearDelete = async () => {
    if (!deletingYear) return;

    // Validate password is entered
    if (!deleteYearPassword.trim()) {
      setDeleteYearError('Password harus diisi');
      return;
    }

    setDeleteYearLoading(true);
    setDeleteYearError('');

    try {
      // Get current user email
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser?.email) {
        throw new Error('Tidak dapat mengambil informasi pengguna');
      }

      // Verify password by attempting to sign in
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: currentUser.email,
        password: deleteYearPassword
      });

      if (authError) {
        setDeleteYearError('Password salah');
        setDeleteYearLoading(false);
        return;
      }

      // Password verified, proceed with deletion
      const { error } = await supabase
        .from('academic_years')
        .delete()
        .eq('id', deletingYear.id);

      if (error) throw error;
      toast({
        title: 'Berhasil',
        description: 'Tahun ajaran berhasil dihapus',
      });
      fetchAcademicYears();
      handleCloseDeleteYearDialog();
    } catch (error) {
      console.error('Error deleting academic year:', error);
      toast({
        title: 'Error',
        description: 'Gagal menghapus tahun ajaran',
        variant: 'destructive',
      });
    } finally {
      setDeleteYearLoading(false);
    }
  };

  const handleCloseDeleteYearDialog = () => {
    setDeletingYear(null);
    setDeleteYearPassword('');
    setDeleteYearError('');
  };

  const handleYearActivate = async () => {
    if (!activatingYear) return;
    try {
      const { error } = await supabase
        .from('academic_years')
        .update({ is_active: true })
        .eq('id', activatingYear.id);

      if (error) throw error;
      toast({
        title: 'Berhasil',
        description: `Tahun ajaran ${activatingYear.name} berhasil diaktifkan`,
      });
      fetchAcademicYears();
      refetchActiveYear();
    } catch (error) {
      console.error('Error activating academic year:', error);
      toast({
        title: 'Error',
        description: 'Gagal mengaktifkan tahun ajaran',
        variant: 'destructive',
      });
    } finally {
      setActivatingYear(null);
    }
  };

  // Master Mapel Handlers
  const handleMapelSubmit = async (data: Omit<MasterMapel, 'id' | 'created_at' | 'updated_at'>) => {
    setIsSubmittingMapel(true);
    try {
      if (editingMapel) {
        const { error } = await supabase
          .from('master_mapel')
          .update(data)
          .eq('id', editingMapel.id);

        if (error) throw error;
        toast({
          title: 'Berhasil',
          description: 'Data mata pelajaran berhasil diperbarui',
        });
      } else {
        const { error } = await supabase.from('master_mapel').insert(data);

        if (error) {
          if (error.code === '23505') {
            toast({
              title: 'Error',
              description: 'Mata pelajaran dengan nama tersebut sudah ada',
              variant: 'destructive',
            });
            return;
          }
          throw error;
        }
        toast({
          title: 'Berhasil',
          description: 'Data mata pelajaran berhasil ditambahkan',
        });
      }

      setIsMapelFormOpen(false);
      setEditingMapel(null);
      fetchMasterMapel();
    } catch (error) {
      console.error('Error saving master mapel:', error);
      toast({
        title: 'Error',
        description: 'Gagal menyimpan data mata pelajaran',
        variant: 'destructive',
      });
    } finally {
      setIsSubmittingMapel(false);
    }
  };

  const handleMapelDelete = async () => {
    if (!deletingMapel) return;
    try {
      const { error } = await supabase
        .from('master_mapel')
        .delete()
        .eq('id', deletingMapel.id);

      if (error) throw error;
      toast({
        title: 'Berhasil',
        description: 'Data mata pelajaran berhasil dihapus',
      });
      fetchMasterMapel();
    } catch (error) {
      console.error('Error deleting master mapel:', error);
      toast({
        title: 'Error',
        description: 'Gagal menghapus data mata pelajaran',
        variant: 'destructive',
      });
    } finally {
      setDeletingMapel(null);
    }
  };

  const hasActiveYear = academicYears.some((y) => y.is_active);

  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || '';

  const setActiveTab = (tab: string) => {
    setSearchParams(tab ? { tab } : {});
  };

  // Check if date is outside semester range
  const showSemesterWarning = activeAcademicYear && isDateOutsideSemesters();

  return (
    <div className="space-y-6">
      {/* Semester Warning Alert */}
      {showSemesterWarning && (
        <Alert variant="destructive" className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertTitle className="text-amber-800 dark:text-amber-300">Perhatian</AlertTitle>
          <AlertDescription className="text-amber-700 dark:text-amber-400">
            Tanggal hari ini ({format(new Date(), 'dd MMMM yyyy', { locale: idLocale })}) berada di luar rentang semester ganjil maupun genap pada tahun ajaran aktif ({activeAcademicYear.name}). Beberapa fitur terkait semester mungkin tidak berfungsi dengan benar.
          </AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-background border border-border/50 p-6">
        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            {activeTab && (
              <Button variant="ghost" size="icon" onClick={() => setActiveTab('')} className="rounded-xl">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {!activeTab ? 'Pengaturan' : settingsMenuItems.find(m => m.key === activeTab)?.title || 'Pengaturan'}
              </h1>
              <p className="text-muted-foreground">
                {!activeTab ? 'Kelola pengaturan sistem' : settingsMenuItems.find(m => m.key === activeTab)?.description}
              </p>
            </div>
          </div>
          {activeTab === 'tahun-ajaran' && (
            <Button
              onClick={() => {
                setEditingYear(null);
                setIsYearFormOpen(true);
              }}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Tambah Tahun Ajaran
            </Button>
          )}
          {activeTab === 'data-mapel' && (
            <Button
              onClick={() => {
                setEditingMapel(null);
                setIsMapelFormOpen(true);
              }}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Tambah Mata Pelajaran
            </Button>
          )}
        </div>
      </div>

      {/* Card List Menu */}
      {!activeTab && (
        <div className="grid gap-4">
          {settingsMenuItems.map(item => {
            // Role-based visibility filtering
            if (isGuruMandiri) {
              const allowedForGuruMandiri = ['profil-institusi', 'print-settings']; // Only these tabs are allowed for Guru Mandiri
              if (!allowedForGuruMandiri.includes(item.key)) return null;
            }
            
            if (isAdminSekolah) {
              const hiddenForAdminSekolah = ['ai', 'landing-page', 'data-mapel', 'tahun-ajaran']; // Hide global master data
              if (hiddenForAdminSekolah.includes(item.key)) return null;
            }
            
            if (item.key === 'tarik-data' && workspaceType !== 'sekolah') return null;

            const Icon = item.icon;
            return (
              <Card
                key={item.key}
                className="rounded-2xl border-0 shadow-md overflow-hidden transition-all duration-300 hover:shadow-lg cursor-pointer"
                onClick={() => setActiveTab(item.key)}
              >
                <CardContent className="p-0">
                  <div className="flex items-center gap-4 p-5">
                    <div className="p-3 rounded-xl bg-primary/10">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg text-foreground">{item.title}</h3>
                      <p className="text-muted-foreground text-sm mt-0.5">{item.description}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Content sections */}
      {activeTab === 'tahun-ajaran' && (
        <Card>
          <CardContent className="pt-6">
            <AcademicYearList
              years={academicYears}
              isLoading={isLoadingYears}
              onEdit={(year) => {
                setEditingYear(year);
                setIsYearFormOpen(true);
              }}
              onDelete={setDeletingYear}
            />
          </CardContent>
        </Card>
      )}

      {activeTab === 'data-mapel' && (
        <Card>
          <CardContent className="pt-6">
            <MasterMapelList
              items={masterMapelList}
              isLoading={isLoadingMapel}
              onEdit={(item) => {
                setEditingMapel(item);
                setIsMapelFormOpen(true);
              }}
              onDelete={setDeletingMapel}
            />
          </CardContent>
        </Card>
      )}

      {activeTab === 'profil-institusi' && (
        <WorkspaceProfileTab />
      )}

      {activeTab === 'absen-staff' && (
        <div className="space-y-6">
          <LokasiAbsenForm />
          <WaktuKerjaForm />
        </div>
      )}

      {activeTab === 'ramadhan' && <RamadhanConfigForm />}

      {activeTab === 'liburan' && <LiburanConfigTab />}

      {activeTab === 'notifikasi' && <PushNotificationSettings />}

      {activeTab === 'ai' && <AiSettingsPanel />}

      {activeTab === 'landing-page' && <LandingPageConfigTab />}

      {activeTab === 'tarik-data' && <WorkspaceInvitesTab />}

      {activeTab === 'print-settings' && <PrintSettingsTab />}

      {/* Academic Year Form Drawer */}
      <AcademicYearForm
        open={isYearFormOpen}
        onOpenChange={(open) => {
          setIsYearFormOpen(open);
          if (!open) setEditingYear(null);
        }}
        onSubmit={handleYearSubmit}
        initialData={editingYear}
        loading={isSubmittingYear}
        hasActiveYear={hasActiveYear}
      />

      {/* Master Mapel Form Drawer */}
      <MasterMapelForm
        open={isMapelFormOpen}
        onOpenChange={(open) => {
          setIsMapelFormOpen(open);
          if (!open) setEditingMapel(null);
        }}
        onSubmit={handleMapelSubmit}
        initialData={editingMapel}
        loading={isSubmittingMapel}
      />

      {/* Delete Year Confirmation */}
      <AlertDialog open={!!deletingYear} onOpenChange={handleCloseDeleteYearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              Hapus Tahun Ajaran?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus tahun ajaran{' '}
              <strong>{deletingYear?.name}</strong>? Tindakan ini tidak dapat
              dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-3 py-4">
            <div className="space-y-2">
              <label htmlFor="delete-year-password" className="text-sm font-medium text-foreground">
                Masukkan password Anda untuk konfirmasi
              </label>
              <Input
                id="delete-year-password"
                type="password"
                placeholder="Password"
                value={deleteYearPassword}
                onChange={(e) => {
                  e.stopPropagation();
                  setDeleteYearPassword(e.target.value);
                  setDeleteYearError('');
                }}
                onKeyDown={(e) => e.stopPropagation()}
                disabled={deleteYearLoading}
                autoComplete="new-password"
                className={deleteYearError ? 'border-destructive' : ''}
              />
              {deleteYearError && (
                <p className="text-sm text-destructive">{deleteYearError}</p>
              )}
            </div>
          </div>
          
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteYearLoading}>Batal</AlertDialogCancel>
            <Button 
              onClick={handleYearDelete} 
              disabled={deleteYearLoading || !deleteYearPassword.trim()}
              variant="destructive"
            >
              {deleteYearLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Memverifikasi...
                </>
              ) : (
                'Ya, Hapus'
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Activate Year Confirmation */}
      <AlertDialog open={!!activatingYear} onOpenChange={() => setActivatingYear(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aktifkan Tahun Ajaran?</AlertDialogTitle>
            <AlertDialogDescription>
              Mengaktifkan tahun ajaran <strong>{activatingYear?.name}</strong>{' '}
              akan menonaktifkan tahun ajaran sebelumnya. Data akademik yang
              ditampilkan akan berubah sesuai tahun ajaran yang aktif.
              <br />
              <br />
              Lanjutkan?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleYearActivate}>
              Ya, Aktifkan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Mapel Confirmation */}
      <AlertDialog open={!!deletingMapel} onOpenChange={() => setDeletingMapel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Mata Pelajaran?</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus mata pelajaran{' '}
              <strong>{deletingMapel?.nama}</strong>? Tindakan ini tidak dapat
              dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleMapelDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
