import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useAcademicYear } from '@/contexts/AcademicYearContext';
import { useActiveSession } from '@/hooks/useActiveSession';
import { useUnreadAnnouncements } from '@/hooks/useUnreadAnnouncements';
import { useSubstituteMapel } from '@/hooks/useSubstituteMapel';
import { mockKomponenNilai, mockNilai, mockKehadiran } from '@/mocks/data';
import KehadiranTab from '@/components/kehadiran/KehadiranTab';
import { ArrowLeft, BookOpen, ClipboardList, Award, Calendar, FileText, AlertCircle, MessageSquare, UserCheck } from 'lucide-react';
import { ForumTab } from '@/components/forum';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { MapelInformasiTab, MapelMateriTab, MapelTugasTab, MapelPenilaianTab } from '@/components/mapel';
export default function MapelDetail() {
  const {
    id
  } = useParams();
  const navigate = useNavigate();
  const {
    user
  } = useAuth();
  const {
    toast
  } = useToast();

  // Core states
  const [mapel, setMapel] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [materiList, setMateriList] = useState<any[]>([]);
  const [tugasList, setTugasList] = useState<any[]>([]);
  const [materiReads, setMateriReads] = useState<Set<string>>(new Set());
  const [pengumpulanList, setPengumpulanList] = useState<any[]>([]);
  const [mapelInfo, setMapelInfo] = useState<any>(null);
  const [tpStatusList, setTpStatusList] = useState<Array<{
    tp_index: number;
    status: string;
    achieved_at: string | null;
  }>>([]);
  const [showStatusConfirm, setShowStatusConfirm] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<'aktif' | 'nonaktif' | null>(null);
  const [kelasList, setKelasList] = useState<any[]>([]);
  const [guruList, setGuruList] = useState<any[]>([]);
  const [newTugasCount, setNewTugasCount] = useState(0);
  const [showIncompleteInfoModal, setShowIncompleteInfoModal] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('');
  const [santriList, setSantriList] = useState<any[]>([]);

  // Semester state - get context first
  const {
    getCurrentSemester,
    activeAcademicYear,
    isDateOutsideSemesters,
    isLoading: academicYearLoading
  } = useAcademicYear();

  // Check for active session - block modifications when session is active
  const {
    hasActiveSession
  } = useActiveSession(id);
  
  // Check if user is a substitute teacher for this mapel
  const { isSubstitute } = useSubstituteMapel(user?.id);
  const isSubstituteForThis = id ? isSubstitute(id) : false;
  
  // Track unread announcements for forum badge
  const { unreadCount: unreadAnnouncementCount, markAsSeen: markAnnouncementsSeen } = useUnreadAnnouncements(id || '', user?.id);
  
  const [selectedSemester, setSelectedSemester] = useState<'ganjil' | 'genap'>(() => {
    return getCurrentSemester() || 'ganjil';
  });

  // Fetch tujuan pembelajaran status
  const fetchTpStatus = async () => {
    if (!id) return;
    try {
      const {
        data: academicYear
      } = await supabase.from('academic_years').select('id').eq('is_active', true).single();
      if (academicYear) {
        const {
          data: statusData
        } = await supabase.from('tujuan_pembelajaran_status').select('tp_index, status, achieved_at').eq('mapel_id', id).eq('semester', selectedSemester).eq('academic_year_id', academicYear.id);
        if (statusData) {
          setTpStatusList(statusData);
        }
      }
    } catch (error) {
      console.error('Error fetching TP status:', error);
    }
  };
  const fetchMapel = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const {
        data,
        error
      } = await supabase.from('mapel').select(`
        id, nama, kode_mapel, deskripsi, kategori, kkm, status, kelas_id, pengampu_id,
        kelas:kelas_id (id, nama, tingkat),
        pengampu:profiles!mapel_pengampu_id_fkey(id, name)
      `).eq('id', id).maybeSingle();
      if (error) throw error;
      if (!data) {
        toast({
          title: "Error",
          description: "Mata pelajaran tidak ditemukan",
          variant: "destructive"
        });
        navigate(user?.role === 'santri' ? '/app/mapel' : '/admin/mapel');
        return;
      }

      // Fetch deskripsi from master_mapel by matching nama (live sync)
      let masterDeskripsi: string | null = null;
      const {
        data: masterData
      } = await supabase.from('master_mapel').select('deskripsi').eq('nama', data.nama).maybeSingle();
      if (masterData?.deskripsi) {
        masterDeskripsi = masterData.deskripsi;
      }
      setMapel({
        ...data,
        deskripsi: masterDeskripsi || data.deskripsi
      });

      // Fetch mapel_info
      const {
        data: infoData
      } = await supabase.from('mapel_info').select('id, mapel_id, capaian_pembelajaran, tujuan_pembelajaran').eq('mapel_id', id).maybeSingle();
      setMapelInfo(infoData);
      await fetchTpStatus();
      await fetchMateri();
      await fetchTugas();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Gagal memuat data mata pelajaran",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchMapel();
  }, [id, navigate, toast]);

  // Auto-detect semester from academic year context
  useEffect(() => {
    const currentSemester = getCurrentSemester();
    if (currentSemester) {
      setSelectedSemester(currentSemester);
    }
  }, [getCurrentSemester, activeAcademicYear]);

  // Realtime listener for new tugas
  useEffect(() => {
    if (!id) return;
    const channel = supabase.channel('tugas-changes').on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'tugas',
      filter: `mapel_id=eq.${id}`
    }, () => {
      fetchTugas();
    }).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);
  useEffect(() => {
    if (mapel) {
      fetchSantri();
    }
  }, [mapel]);

  // Fetch kelas and guru for inline editing
  useEffect(() => {
    const fetchDropdownData = async () => {
      try {
        const {
          data: kelasData
        } = await supabase.from('kelas').select('id, nama, tingkat').eq('status', 'aktif').order('tingkat');
        const {
          data: pengampuRoles
        } = await supabase.from('user_roles').select('user_id').in('role', ['admin', 'guru', 'walikelas', 'Pembina']);
        const pengampuIds = pengampuRoles?.map(r => r.user_id) || [];
        const {
          data: guruData
        } = await supabase.from('profiles').select('id, name').in('id', pengampuIds).order('name');
        if (kelasData) setKelasList(kelasData);
        if (guruData) setGuruList(guruData);
      } catch (error) {
        console.error('Error fetching dropdown data:', error);
      }
    };
    if (user?.role === 'admin' || user?.role === 'guru' || user?.role === 'walikelas' || user?.role === 'Pembina') {
      fetchDropdownData();
    }
  }, [user]);
  const fetchMateri = async () => {
    if (!id) return;
    try {
      const {
        data,
        error
      } = await supabase.from('materi').select('id, judul, deskripsi, tipe_konten, status, urutan, semester, mapel_id, tujuan_pembelajaran_ids, created_at').eq('mapel_id', id).eq('semester', selectedSemester).order('urutan', {
        ascending: true
      }).limit(50);
      if (error) throw error;
      if (user?.role === 'santri') {
        setMateriList(data?.filter(m => m.status === 'aktif') || []);
        if (user?.id) {
          const {
            data: readsData
          } = await supabase.from('materi_reads').select('materi_id').eq('santri_id', user.id);
          if (readsData) {
            setMateriReads(new Set(readsData.map(r => r.materi_id)));
          }
        }
      } else {
        setMateriList(data || []);
      }
    } catch (error: any) {
      console.error('Error fetching materi:', error);
    }
  };
  const fetchTugas = async () => {
    if (!id) return;
    try {
      let tugasQuery = supabase
        .from('tugas')
        .select('id, judul, deskripsi, tipe_jawaban, tanggal_deadline, status, bab, semester, mapel_id, created_at')
        .eq('mapel_id', id)
        .eq('semester', selectedSemester);

      if (user?.role === 'santri') {
        tugasQuery = tugasQuery.eq('status', 'aktif');
      }

      const { data, error } = await tugasQuery
        .order('tanggal_deadline', { ascending: false })
        .limit(50);
      if (error) throw error;
      const transformedTugas = data?.map(tugas => ({
        ...tugas,
        deadline: tugas.tanggal_deadline,
        tipeJawaban: tugas.tipe_jawaban,
        mapelId: tugas.mapel_id,
        status: tugas.status || 'aktif',
        createdAt: tugas.created_at
      })) || [];
      setTugasList(transformedTugas);
      const seenTugasKey = `seen_tugas_${id}_${user?.id}`;
      const seenTugasIds = JSON.parse(localStorage.getItem(seenTugasKey) || '[]');
      const newTasks = transformedTugas.filter(t => !seenTugasIds.includes(t.id));
      setNewTugasCount(newTasks.length);
      if (user?.role === 'santri' && user?.id) {
        const {
          data: pengumpulanData
        } = await supabase.from('pengumpulan_tugas').select('id, tugas_id, santri_id, status, nilai, tanggal_submit, catatan_nilai, jawaban_teks, file_url, feedback_santri').eq('santri_id', user.id).limit(100);
        if (pengumpulanData) {
          setPengumpulanList(pengumpulanData);
        }
      }
      if (user?.role === 'guru' || user?.role === 'walikelas' || user?.role === 'admin' || user?.role === 'Pembina') {
        if (transformedTugas && transformedTugas.length > 0) {
          const tugasIds = transformedTugas.map(t => t.id);
          const {
            data: pengumpulanData
          } = await supabase.from('pengumpulan_tugas').select('id, tugas_id, santri_id, jawaban_teks, file_url, tanggal_submit, status, nilai, catatan_nilai').in('tugas_id', tugasIds).limit(200);
          if (pengumpulanData && pengumpulanData.length > 0) {
            const santriIds = [...new Set(pengumpulanData.map(p => p.santri_id))];
            const {
              data: profilesData
            } = await supabase.from('profiles').select('id, name').in('id', santriIds);
            const santriNameMap = new Map(profilesData?.map(p => [p.id, p.name]) || []);
            const transformedData = pengumpulanData.map((p: any) => ({
              id: p.id,
              tugasId: p.tugas_id,
              santriId: p.santri_id,
              santriName: santriNameMap.get(p.santri_id) || 'Unknown',
              jawaban: {
                tipe: p.jawaban_teks ? 'teks' : p.file_url?.startsWith('http') ? 'link' : 'file',
                value: p.jawaban_teks || p.file_url || ''
              },
              submittedAt: p.tanggal_submit,
              status: p.status,
              nilai: p.nilai,
              komentarGuru: p.catatan_nilai
            }));
            setPengumpulanList(transformedData as any);
          }
        }
      }
    } catch (error: any) {
      console.error('Error fetching tugas:', error);
    }
  };
  const fetchSantri = async () => {
    if (!mapel?.kelas_id) return;
    try {
      const {
        data,
        error
      } = await supabase.from('santri').select(`
        id,
        profiles!santri_id_fkey(name)
      `).eq('kelas_id', mapel.kelas_id);
      if (error) throw error;
      const transformedSantriList = (data || []).map((santri: any) => ({
        id: santri.id,
        name: santri.profiles?.name || 'Tidak ada nama'
      }));
      setSantriList(transformedSantriList);
    } catch (error: any) {
      console.error('Error fetching santri:', error);
      toast({
        title: "Error",
        description: "Gagal memuat data santri",
        variant: "destructive"
      });
    }
  };

  // Refetch data when semester changes
  useEffect(() => {
    if (id && mapel && !academicYearLoading) {
      fetchMateri();
      fetchTugas();
      fetchSantri();
    }
  }, [selectedSemester, academicYearLoading]);
  const komponenNilaiList = mockKomponenNilai.filter(k => k.mapelId === id);
  const kehadiranList = mockKehadiran.filter(k => k.mapelId === id && k.santriId === user?.id);
  const totalSantri = santriList.length;
  const isMapelInfoComplete = () => {
    if (!mapelInfo) return false;
    const capaianPembelajaran = mapelInfo.capaian_pembelajaran;
    const tujuanPembelajaran = mapelInfo.tujuan_pembelajaran;
    const hasCapaian = Array.isArray(capaianPembelajaran) && capaianPembelajaran.length > 0;
    const hasTujuan = Array.isArray(tujuanPembelajaran) && tujuanPembelajaran.length > 0;
    return hasCapaian && hasTujuan;
  };
  const handleStatusChange = (newStatus: 'aktif' | 'nonaktif') => {
    setPendingStatus(newStatus);
    setShowStatusConfirm(true);
  };
  const confirmStatusChange = async () => {
    if (!id || !pendingStatus) return;
    try {
      const {
        error
      } = await supabase.from('mapel').update({
        status: pendingStatus
      }).eq('id', id);
      if (error) throw error;
      setMapel({
        ...mapel,
        status: pendingStatus
      });
      toast({
        title: "Status Diperbarui",
        description: `Mata pelajaran ${pendingStatus === 'aktif' ? 'diaktifkan' : 'dinonaktifkan'} dan ${pendingStatus === 'aktif' ? 'akan tampil' : 'tidak akan tampil'} di dashboard santri.`
      });
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: "Gagal Memperbarui Status",
        description: "Terjadi kesalahan saat memperbarui status mata pelajaran.",
        variant: "destructive"
      });
    } finally {
      setShowStatusConfirm(false);
      setPendingStatus(null);
    }
  };
  const checkMapelInfoComplete = (): boolean => {
    if (!isMapelInfoComplete()) {
      setShowIncompleteInfoModal(true);
      return false;
    }
    return true;
  };
  const markTugasAsSeen = () => {
    if (!id || tugasList.length === 0) return;
    const seenTugasKey = `seen_tugas_${id}_${user?.id}`;
    const allTugasIds = tugasList.map(t => t.id);
    localStorage.setItem(seenTugasKey, JSON.stringify(allTugasIds));
    setNewTugasCount(0);
  };
  const handleSaveMapelInfo = async () => {
    await fetchMapel();
  };
  if (loading) {
    return <div className="text-center py-12">
      <p className="text-muted-foreground">Memuat data...</p>
    </div>;
  }
  if (!mapel) {
    return <div className="text-center py-12">
      <p className="text-muted-foreground">Mata pelajaran tidak ditemukan</p>
      <Button onClick={() => navigate(-1)} className="mt-4">Kembali</Button>
    </div>;
  }
  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      aktif: 'default',
      draft: 'secondary',
      arsip: 'outline',
      ditutup: 'destructive'
    };
    return <Badge variant={variants[status] as any}>{status}</Badge>;
  };
  const calculateNilaiAkhir = () => {
    if (!user) return null;
    const nilaiSantri = mockNilai.filter(n => n.mapelId === id && n.santriId === user.id);
    let totalSkor = 0;
    let totalBobot = 0;
    nilaiSantri.forEach(nilai => {
      const komponen = komponenNilaiList.find(k => k.id === nilai.komponenId);
      if (komponen) {
        totalSkor += nilai.skor * komponen.bobot / 100;
        totalBobot += komponen.bobot;
      }
    });
    return totalBobot > 0 ? totalSkor / totalBobot * 100 : 0;
  };
  return <div className="space-y-4 md:space-y-6">
      {/* Substitute Teacher Banner */}
      {isSubstituteForThis && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <UserCheck className="h-5 w-5 text-amber-600 shrink-0" />
          <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
            Anda mengakses mata pelajaran ini sebagai <strong>guru pengganti</strong>. Akses akan berakhir setelah pembelajaran diakhiri.
          </p>
        </div>
      )}
      {/* Tabs */}
      <Tabs value={activeTab || 'forum'} onValueChange={setActiveTab} className="w-full">
        <div className="rounded-2xl bg-primary p-4 md:p-6 shadow-lg space-y-4">
          {/* Header with back button, mapel name, guru, and tabs */}
          <div className="flex flex-col gap-4">
            {/* Row 1: Back button and mapel info */}
            <div className="flex items-center gap-4">
              <Button variant="outline" size="icon" onClick={() => navigate(user?.role === 'santri' ? '/app/mapel' : '/admin/mapel')} className="rounded-xl h-10 w-10 shrink-0 border-2 border-white/20 bg-white/10 backdrop-blur-sm hover:bg-white/20 hover:border-white/30 transition-all duration-200">
                <ArrowLeft className="h-4 w-4 text-white" />
              </Button>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg md:text-xl font-bold text-white truncate">{mapel.nama}</h2>
                <p className="text-sm text-white/70 truncate flex items-center gap-1.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-white"></span>
                  {mapel.kelas?.nama || '-'}
                </p>
              </div>
            </div>
            
            {/* Row 2: Tabs */}
            <TabsList className={`grid w-full gap-1.5 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10 p-1.5 h-auto ${user?.role === 'santri' ? 'grid-cols-4' : 'grid-cols-6'}`}>
              {user?.role !== 'santri' && <TabsTrigger value="informasi" className="rounded-lg py-2.5 px-3 text-white/70 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-md data-[state=inactive]:hover:bg-white/10 transition-all duration-200 font-medium text-sm">
                  <FileText className="h-4 w-4 mr-1.5" />
                  <span className="hidden md:inline">Informasi</span>
                </TabsTrigger>}
              <TabsTrigger value="forum" onClick={markAnnouncementsSeen} className="rounded-lg py-2.5 px-3 text-white/70 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-md data-[state=inactive]:hover:bg-white/10 transition-all duration-200 font-medium text-sm">
                <MessageSquare className="h-4 w-4 mr-1.5" />
                <span className="hidden md:inline">Forum</span>
                {unreadAnnouncementCount > 0 && (
                  <Badge className="ml-1.5 h-5 min-w-5 px-1.5 bg-destructive text-destructive-foreground animate-scale-in">
                    {unreadAnnouncementCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="materi" className="rounded-lg py-2.5 px-3 text-white/70 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-md data-[state=inactive]:hover:bg-white/10 transition-all duration-200 font-medium text-sm">
                <BookOpen className="h-4 w-4 mr-1.5" />
                <span className="hidden md:inline">Materi</span>
              </TabsTrigger>
              <TabsTrigger value="tugas" onClick={markTugasAsSeen} className="rounded-lg py-2.5 px-3 text-white/70 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-md data-[state=inactive]:hover:bg-white/10 transition-all duration-200 font-medium text-sm">
                <ClipboardList className="h-4 w-4 mr-1.5" />
                <span className="hidden md:inline">Tugas</span>
                {newTugasCount > 0 && <Badge className="ml-1.5 h-5 min-w-5 px-1.5 bg-destructive text-destructive-foreground animate-scale-in">
                    {newTugasCount}
                  </Badge>}
              </TabsTrigger>
              {user?.role !== 'santri' && <TabsTrigger value="penilaian" className="rounded-lg py-2.5 px-3 text-white/70 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-md data-[state=inactive]:hover:bg-white/10 transition-all duration-200 font-medium text-sm">
                  <Award className="h-4 w-4 mr-1.5" />
                  <span className="hidden md:inline">Penilaian</span>
                </TabsTrigger>}
              <TabsTrigger value="kehadiran" className="rounded-lg py-2.5 px-3 text-white/70 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-md data-[state=inactive]:hover:bg-white/10 transition-all duration-200 font-medium text-sm">
                <Calendar className="h-4 w-4 mr-1.5" />
                <span className="hidden md:inline">Kehadiran</span>
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        {/* Informasi Tab */}
        {user?.role !== 'santri' && <TabsContent value="informasi">
            <MapelInformasiTab mapel={mapel} mapelInfo={mapelInfo} user={user} activeAcademicYear={activeAcademicYear} selectedSemester={selectedSemester} isDateOutsideSemesters={isDateOutsideSemesters} hasActiveSession={hasActiveSession} tpStatusList={tpStatusList} kelasList={kelasList} guruList={guruList} onRefresh={fetchMapel} santriCount={santriList.length} />
          </TabsContent>}

        {/* Materi Tab */}
        <TabsContent value="materi">
          <MapelMateriTab mapelId={id} user={user} materiList={materiList} materiReads={materiReads} setMateriReads={setMateriReads} selectedSemester={selectedSemester} mapelInfo={mapelInfo} tpStatusList={tpStatusList} hasActiveSession={hasActiveSession} onRefresh={fetchMateri} onCheckInfoComplete={checkMapelInfoComplete} />
        </TabsContent>

        {/* Tugas Tab */}
        <TabsContent value="tugas" className="space-y-4 mt-6">
          <MapelTugasTab mapelId={id!} userRole={user?.role || ''} userId={user?.id || ''} tugasList={tugasList} pengumpulanList={pengumpulanList} santriList={santriList} totalSantri={totalSantri} selectedSemester={selectedSemester} isMapelInfoComplete={isMapelInfoComplete} onShowIncompleteInfoModal={() => setShowIncompleteInfoModal(true)} onRefreshTugas={fetchTugas} />
        </TabsContent>

        {/* Penilaian Tab - Now using MapelPenilaianTab component */}
        {user?.role !== 'santri' && <TabsContent value="penilaian" className="space-y-6 mt-6">
            <MapelPenilaianTab mapelId={id!} mapelNama={mapel?.nama || ''} mapelInfo={mapelInfo} materiList={materiList} santriList={santriList} tugasList={tugasList} selectedSemester={selectedSemester} userId={user?.id || ''} />
          </TabsContent>}

        <TabsContent value="kehadiran" className="space-y-4 mt-6">
          <KehadiranTab mapelId={id || ''} mapelNama={mapel?.nama || ''} kelasId={mapel?.kelas_id || ''} userRole={user?.role || ''} santriList={santriList} />
        </TabsContent>

        {/* Forum Tab */}
        <TabsContent value="forum" className="mt-6">
          <ForumTab subjectId={id!} />
        </TabsContent>
      </Tabs>

      {/* Status Confirmation Dialog */}
      <AlertDialog open={showStatusConfirm} onOpenChange={setShowStatusConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingStatus === 'aktif' ? 'Aktifkan' : 'Nonaktifkan'} Mata Pelajaran?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingStatus === 'aktif' ? 'Mata pelajaran akan diaktifkan dan akan tampil di dashboard santri. Santri dapat melihat materi dan tugas dari mata pelajaran ini.' : 'Mata pelajaran akan dinonaktifkan dan tidak akan tampil di dashboard santri. Santri tidak akan dapat mengakses materi dan tugas dari mata pelajaran ini.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
            setShowStatusConfirm(false);
            setPendingStatus(null);
          }}>
              Batal
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmStatusChange}>
              {pendingStatus === 'aktif' ? 'Aktifkan' : 'Nonaktifkan'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal Warning - Incomplete Info */}
      <AlertDialog open={showIncompleteInfoModal} onOpenChange={setShowIncompleteInfoModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Lengkapi Informasi Mapel
            </AlertDialogTitle>
            <AlertDialogDescription>
              Harap isi Capaian Pembelajaran dan Tujuan Pembelajaran terlebih dahulu sebelum menambah materi atau tugas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
            setShowIncompleteInfoModal(false);
            setActiveTab('informasi');
          }}>
              Isi Tujuan dan Materi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>;
}