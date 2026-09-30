import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ActionButtonGroup, DetailButton } from '@/components/ui/action-buttons';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ArrowLeft, BookOpen, FileText, User, Printer, Eye, CheckCircle, XCircle, Calendar, AlertCircle, CalendarDays } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAcademicYear } from '@/contexts/AcademicYearContext';
import { PrintButton, ReportPrintTemplate } from '@/components/print';
import { MainPageHeader } from '@/components/layout/MainPageHeader';

interface SantriOption {
  id: string;
  nama: string;
  nis: string;
}
interface MapelNilai {
  mapel_nama: string;
  kategori: string;
  nilai_rapor: number;
  capaian_kompetensi: string;
}

export default function BuatRaport() {
  const { id } = useParams();
  const [kelas, setKelas] = useState<any>(null);
  const [santriList, setSantriList] = useState<SantriOption[]>([]);
  const [selectedSantri, setSelectedSantri] = useState<string>('');
  const [mapelNilaiList, setMapelNilaiList] = useState<MapelNilai[]>([]);
  const [catatanGuru, setCatatanGuru] = useState('');
  const [catatanOrtu, setCatatanOrtu] = useState('');
  const [kepalaSekolah, setKepalaSekolah] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('detail');
  const [raportStatus, setRaportStatus] = useState<Record<string, { id: string; status: string; is_published: boolean }>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [kehadiranSummary, setKehadiranSummary] = useState({ sakit: 0, izin: 0, alpha: 0 });
  const [orangtuaSantri, setOrangtuaSantri] = useState<{ name: string } | null>(null);
  
  // Confirmation dialog states
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showPublishConfirm, setShowPublishConfirm] = useState<string | null>(null);
  const [showUnpublishConfirm, setShowUnpublishConfirm] = useState<string | null>(null);
  const [showPublishAllConfirm, setShowPublishAllConfirm] = useState(false);
  const [isPublishingAll, setIsPublishingAll] = useState(false);
  
  // Print ref
  const printRef = useRef<HTMLDivElement>(null);
  
  const kelasData = kelas;
  const { toast } = useToast();
  const navigate = useNavigate();
  const { activeAcademicYear, getCurrentSemester } = useAcademicYear();
  const currentSemester = getCurrentSemester();
  const semesterValue = currentSemester === 'ganjil' ? '1' : currentSemester === 'genap' ? '2' : '1';
  useEffect(() => {
    if (id) {
      fetchKelasData();
    }
  }, [id]);

  // Fetch raport status for all santri when kelas data loads
  useEffect(() => {
    if (id && santriList.length > 0 && kelas) {
      fetchRaportStatus();
    }
  }, [id, santriList.length, kelas]);

  useEffect(() => {
    if (selectedSantri && kelas) {
      fetchNilaiSantri();
      fetchExistingRaport();
      fetchKehadiranSantri();
      fetchOrangtuaSantri();
    }
  }, [selectedSantri]);
  const fetchKelasData = async () => {
    setLoading(true);
    try {
      // Fetch kelas data
      const {
        data: kelasData,
        error: kelasError
      } = await supabase.from('kelas').select(`
          *, 
          walikelas:staff!kelas_walikelas_id_fkey(
            id,
            employee_id,
            profile:profiles!staff_id_fkey(name)
          )
        `).eq('id', id).single();
      if (kelasError) throw kelasError;
      setKelas(kelasData);

      // Fetch santri in this kelas
      const {
        data: santriData,
        error: santriError
      } = await supabase.from('santri').select('id, nis').eq('kelas_id', id);
      if (santriError) throw santriError;

      // Fetch profiles for santri
      const santriIds = (santriData || []).map((s: any) => s.id);
      const {
        data: profilesData
      } = await supabase.from('profiles').select('id, name').in('id', santriIds);
      const santriOptions = (santriData || []).map((s: any) => {
        const profile = profilesData?.find(p => p.id === s.id);
        return {
          id: s.id,
          nama: profile?.name || 'Unknown',
          nis: s.nis || '-'
        };
      });
      setSantriList(santriOptions);

      // Fetch Kepala Sekolah
      const {
        data: kepalaSekolahData
      } = await supabase.from('staff').select('id, employee_id, profile:profiles!staff_id_fkey(name)').eq('position', 'Kepala Sekolah').maybeSingle();
      if (kepalaSekolahData) {
        setKepalaSekolah(kepalaSekolahData);
      } else {
        // Fallback jika tidak ada data Kepala Sekolah
        setKepalaSekolah({
          profile: { name: 'Ayulia Aslam, S.Pd' },
          employee_id: '098765427384'
        });
      }

      // Auto-select first santri if available
      if (santriOptions.length > 0) {
        setSelectedSantri(santriOptions[0].id);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Gagal memuat data kelas",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  const fetchNilaiSantri = async () => {
    if (!selectedSantri) return;
    try {
      // Fetch all mapel for this kelas
      const {
        data: mapelData,
        error: mapelError
      } = await supabase.from('mapel').select('id, nama, kategori').eq('kelas_id', id).eq('status', 'aktif');
      if (mapelError) throw mapelError;

      // For each mapel, get finalized assessment
      const mapelWithNilai = await Promise.all((mapelData || []).map(async mapel => {
        // Get asesmen_sumatif
        const {
          data: sumatifData
        } = await supabase.from('asesmen_sumatif').select('nilai_rapor, is_finalized').eq('mapel_id', mapel.id).eq('santri_id', selectedSantri).eq('is_finalized', true).maybeSingle();

        // Get asesmen_formatif for capaian kompetensi
        const {
          data: formatifData
        } = await supabase.from('asesmen_formatif').select('deskripsi_tertinggi, deskripsi_terendah, tp_assessments').eq('mapel_id', mapel.id).eq('santri_id', selectedSantri).maybeSingle();
        let capaianKompetensi = '-';
        if (formatifData) {
          const tpAssessments = formatifData.tp_assessments as Array<{
            kktp: boolean;
            tampil_rapor: boolean;
          }>;
          const hasInactiveKKTP = tpAssessments?.some(tp => !tp.kktp && tp.tampil_rapor);
          const hasActiveKKTP = tpAssessments?.some(tp => tp.kktp && tp.tampil_rapor);
          if (hasInactiveKKTP && formatifData.deskripsi_terendah) {
            capaianKompetensi = formatifData.deskripsi_terendah;
          } else if (hasActiveKKTP && formatifData.deskripsi_tertinggi) {
            capaianKompetensi = formatifData.deskripsi_tertinggi;
          }
        }
        return {
          mapel_nama: mapel.nama,
          kategori: mapel.kategori || 'wajib',
          nilai_rapor: sumatifData?.nilai_rapor || 0,
          capaian_kompetensi: capaianKompetensi
        };
      }));
      setMapelNilaiList(mapelWithNilai);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Gagal memuat nilai santri",
        variant: "destructive"
      });
    }
  };

  const fetchKehadiranSantri = async () => {
    if (!selectedSantri) return;

    try {
      // Get all attendance records for this santri
      const { data, error } = await supabase
        .from('kehadiran_santri')
        .select('status')
        .eq('santri_id', selectedSantri);

      if (error) throw error;

      // Count by status
      const summary = {
        sakit: 0,
        izin: 0,
        alpha: 0
      };

      data?.forEach(record => {
        if (record.status === 'sakit') summary.sakit++;
        else if (record.status === 'izin') summary.izin++;
        else if (record.status === 'alpha' || record.status === 'tidak_hadir') summary.alpha++;
      });

      setKehadiranSummary(summary);
    } catch (error) {
      console.error('Error fetching kehadiran santri:', error);
    }
  };

  const fetchOrangtuaSantri = async () => {
    if (!selectedSantri) return;
    setOrangtuaSantri(null);

    try {
      // Get parent from parent_children relation
      const { data, error } = await supabase
        .from('parent_children')
        .select('parent_id, profiles!parent_children_parent_id_fkey(name)')
        .eq('child_id', selectedSantri)
        .maybeSingle();

      if (error) throw error;

      if (data?.profiles) {
        setOrangtuaSantri({ name: (data.profiles as any).name });
      }
    } catch (error) {
      console.error('Error fetching orangtua santri:', error);
    }
  };

  const fetchRaportStatus = async () => {
    if (!id || !kelas) return;

    try {
      const { data, error } = await supabase
        .from('raport')
        .select('id, santri_id, status, is_published')
        .eq('kelas_id', id)
        .eq('tahun_ajaran', kelas.tahun_ajaran)
        .eq('semester', semesterValue);

      if (error) throw error;

      const statusMap: Record<string, { id: string; status: string; is_published: boolean }> = {};
      data?.forEach(raport => {
        statusMap[raport.santri_id] = {
          id: raport.id,
          status: raport.status,
          is_published: raport.is_published || false
        };
      });

      setRaportStatus(statusMap);
    } catch (error) {
      console.error('Error fetching raport status:', error);
    }
  };

  const handlePublishRaport = async (santriId: string) => {
    const raportInfo = raportStatus[santriId];
    if (!raportInfo?.id) {
      toast({
        title: "Error",
        description: "Raport belum dibuat. Simpan raport terlebih dahulu.",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('raport')
        .update({ 
          is_published: true, 
          published_at: new Date().toISOString() 
        })
        .eq('id', raportInfo.id);

      if (error) throw error;

      toast({
        title: "Berhasil",
        description: "Raport berhasil dipublish ke dashboard santri"
      });

      // Refresh raport status
      fetchRaportStatus();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Gagal mempublish raport",
        variant: "destructive"
      });
    }
  };

  const handleUnpublishRaport = async (santriId: string) => {
    const raportInfo = raportStatus[santriId];
    if (!raportInfo?.id) {
      toast({
        title: "Error",
        description: "Raport tidak ditemukan.",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('raport')
        .update({ 
          is_published: false, 
          published_at: null 
        })
        .eq('id', raportInfo.id);

      if (error) throw error;

      toast({
        title: "Berhasil",
        description: "Raport berhasil di-unpublish"
      });

      // Refresh raport status
      fetchRaportStatus();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Gagal unpublish raport",
        variant: "destructive"
      });
    }
  };

  const handlePublishAllRaport = async () => {
    setIsPublishingAll(true);
    try {
      // Get all complete but unpublished raports
      const unpublishedRaports = santriList.filter(santri => {
        const raportInfo = raportStatus[santri.id];
        return raportInfo?.status === 'selesai' && !raportInfo?.is_published;
      });

      if (unpublishedRaports.length === 0) {
        toast({
          title: "Info",
          description: "Tidak ada raport yang dapat dipublish"
        });
        return;
      }

      const raportIds = unpublishedRaports.map(s => raportStatus[s.id].id);
      
      const { error } = await supabase
        .from('raport')
        .update({ 
          is_published: true, 
          published_at: new Date().toISOString() 
        })
        .in('id', raportIds);

      if (error) throw error;

      toast({
        title: "Berhasil",
        description: `${unpublishedRaports.length} raport berhasil dipublish`
      });

      fetchRaportStatus();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Gagal mempublish raport",
        variant: "destructive"
      });
    } finally {
      setIsPublishingAll(false);
    }
  };

  // Count publishable raports
  const publishableCount = santriList.filter(santri => {
    const raportInfo = raportStatus[santri.id];
    return raportInfo?.status === 'selesai' && !raportInfo?.is_published;
  }).length;

  const fetchExistingRaport = async () => {
    if (!selectedSantri || !id || !kelas) return;

    try {
      const { data, error } = await supabase
        .from('raport')
        .select('catatan_guru, catatan_ortu')
        .eq('santri_id', selectedSantri)
        .eq('kelas_id', id)
        .eq('tahun_ajaran', kelas.tahun_ajaran)
        .eq('semester', semesterValue)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setCatatanGuru(data.catatan_guru || '');
        setCatatanOrtu(data.catatan_ortu || '');
      } else {
        // Reset form if no existing raport
        setCatatanGuru('');
        setCatatanOrtu('');
      }
    } catch (error) {
      console.error('Error fetching existing raport:', error);
    }
  };

  const handleSaveRaport = async () => {
    if (!selectedSantri || !id || !kelas) {
      toast({
        title: "Error",
        description: "Data tidak lengkap",
        variant: "destructive"
      });
      return;
    }

    setIsSaving(true);

    try {
      const raportData = {
        santri_id: selectedSantri,
        kelas_id: id,
        tahun_ajaran: kelas.tahun_ajaran,
        semester: semesterValue,
        catatan_guru: catatanGuru || null,
        catatan_ortu: catatanOrtu || null,
        status: 'selesai'
      };

      const { data, error } = await supabase
        .from('raport')
        .upsert(raportData, {
          onConflict: 'santri_id,kelas_id,tahun_ajaran,semester'
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Sukses",
        description: "Raport berhasil disimpan dengan status Selesai"
      });

      // Update status in local state
      setRaportStatus(prev => ({
        ...prev,
        [selectedSantri]: {
          id: data.id,
          status: 'selesai',
          is_published: prev[selectedSantri]?.is_published || false
        }
      }));
    } catch (error: any) {
      console.error('Error saving raport:', error);
      toast({
        title: "Error",
        description: "Gagal menyimpan raport: " + error.message,
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const selectedSantriData = santriList.find(s => s.id === selectedSantri);
  if (loading) {
    return <div className="container mx-auto py-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Memuat data...</p>
          </CardContent>
        </Card>
      </div>;
  }
  return <div className="space-y-6">
        {/* Header + Tabs (integrated) */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <MainPageHeader
            title="Buat Raport"
            backTo={`/admin/penilaian/kelas/${id}`}
            subtitle={
              <>
                <span className="truncate">{kelas?.nama}</span>
                {currentSemester && activeAcademicYear && (
                  <Badge className="bg-primary-foreground/20 text-primary-foreground border-0 gap-1 ml-1 shrink-0">
                    <CalendarDays className="h-3 w-3" />
                    Semester {currentSemester === 'ganjil' ? 'Ganjil' : 'Genap'} {activeAcademicYear.name}
                  </Badge>
                )}
              </>
            }
            actions={
              selectedSantri ? (
                <>
                  {(catatanGuru || catatanOrtu) && (
                    <Button
                      variant="ghost"
                      onClick={() => setShowCancelConfirm(true)}
                      className="bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground border-0"
                    >
                      Batal
                    </Button>
                  )}
                  <PrintButton
                    contentRef={printRef}
                    documentTitle={`Raport_${selectedSantriData?.nama || 'Santri'}_${kelas?.nama || ''}`}
                    variant="ghost"
                    className="bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground border-0"
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Print Raport</span>
                  </PrintButton>
                  {(catatanGuru || catatanOrtu) && (
                    <Button
                      className="bg-primary-foreground text-primary hover:bg-primary-foreground/90"
                      onClick={() => setShowSaveConfirm(true)}
                      disabled={isSaving}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      {isSaving ? 'Menyimpan...' : 'Simpan Raport'}
                    </Button>
                  )}
                </>
              ) : null
            }
            bottomSlot={
              <TabsList className="grid w-full grid-cols-2 gap-1.5 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10 p-1.5 h-auto">
                <TabsTrigger
                  value="detail"
                  className="rounded-lg py-2.5 px-3 text-primary-foreground/70 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-md data-[state=inactive]:hover:bg-white/10 transition-all duration-200 font-medium text-sm"
                >
                  <User className="h-4 w-4 mr-2" />
                  Detail Santri
                </TabsTrigger>
                <TabsTrigger
                  value="daftar"
                  className="rounded-lg py-2.5 px-3 text-primary-foreground/70 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-md data-[state=inactive]:hover:bg-white/10 transition-all duration-200 font-medium text-sm"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Daftar Santri
                </TabsTrigger>
              </TabsList>
            }
          />

        {/* Tab 1: Detail Santri */}
        <TabsContent value="detail" className="space-y-6 mt-6">
          {/* Informasi Santri */}
          <Card className="rounded-2xl border-0 shadow-md no-print">
            <CardHeader className="border-b bg-card">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary/10">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-xl">Informasi Santri</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg border bg-muted/20 hover:bg-muted/30 transition-colors">
                  <label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Pilih Santri</label>
                  <Select value={selectedSantri} onValueChange={setSelectedSantri}>
                    <SelectTrigger className="w-full h-12 text-base border-0 bg-transparent hover:bg-transparent p-0 mt-1 shadow-none">
                      <SelectValue placeholder="Pilih santri..." />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      {santriList.map(santri => (
                        <SelectItem key={santri.id} value={santri.id} className="h-12 cursor-pointer">
                          <div className="flex items-center gap-3">
                            <div className="p-1.5 rounded-md bg-primary/10">
                              <User className="h-3.5 w-3.5 text-primary" />
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{santri.nama}</span>
                              <span className="text-xs text-muted-foreground">• NISN: {santri.nis}</span>
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="p-4 rounded-lg border bg-muted/20">
                  <label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">NISN</label>
                  <p className="text-base font-semibold text-foreground mt-1">{selectedSantriData?.nis || '-'}</p>
                </div>
                <div className="p-4 rounded-lg border bg-muted/20">
                  <label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Kelas</label>
                  <p className="text-base font-semibold text-foreground mt-1">{kelas?.nama || '-'}</p>
                </div>
                <div className="p-4 rounded-lg border bg-muted/20">
                  <label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Wali Kelas</label>
                  <p className="text-base font-semibold text-foreground mt-1">{kelas?.walikelas?.profile?.name || '-'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {selectedSantri && <div className="space-y-6">

          {/* Tabel Nilai */}
          <Card className="rounded-2xl border-0 shadow-md">
            <CardHeader className="border-b bg-card">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary/10">
                  <BookOpen className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-xl">Daftar Nilai</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="rounded-xl border-2 border-border/50 shadow-lg overflow-hidden bg-card">
                <Table id="table2">
                  <TableHeader>
                    <TableRow className="border-b-2 border-border bg-muted/50">
                      <TableHead className="border-r w-[80px] text-center font-semibold">No</TableHead>
                      <TableHead className="border-r min-w-[250px] font-semibold">Mata Pelajaran</TableHead>
                      <TableHead className="border-r w-[150px] text-center font-semibold">Jenis</TableHead>
                      <TableHead className="border-r w-[120px] text-center font-semibold">Nilai</TableHead>
                      <TableHead className="font-semibold">Capaian Kompetensi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mapelNilaiList.map((mapel, index) => <TableRow key={index} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="border-r text-center font-medium">{index + 1}</TableCell>
                        <TableCell className="border-r font-semibold">{mapel.mapel_nama}</TableCell>
                        <TableCell className="border-r text-center">
                          <Badge variant="outline" className="capitalize">{mapel.kategori}</Badge>
                        </TableCell>
                        <TableCell className="border-r text-center">
                          <span className="text-xl font-bold text-primary">{mapel.nilai_rapor.toFixed(1)}</span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{mapel.capaian_kompetensi}</TableCell>
                      </TableRow>)}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Ketidakhadiran */}
          <Card className="rounded-2xl border-0 shadow-md">
            <CardHeader className="border-b bg-card">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary/10">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-xl">Ketidakhadiran</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="rounded-xl border-2 border-border/50 shadow-lg overflow-hidden bg-card">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b-2 border-border bg-muted/50">
                      <TableHead className="border-r font-semibold">Keterangan</TableHead>
                      <TableHead className="w-[150px] text-center font-semibold">Jumlah</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow className="hover:bg-muted/30 transition-colors">
                      <TableCell className="border-r font-medium">Sakit</TableCell>
                      <TableCell className="text-center">{kehadiranSummary.sakit} Hari</TableCell>
                    </TableRow>
                    <TableRow className="hover:bg-muted/30 transition-colors">
                      <TableCell className="border-r font-medium">Izin</TableCell>
                      <TableCell className="text-center">{kehadiranSummary.izin} Hari</TableCell>
                    </TableRow>
                    <TableRow className="hover:bg-muted/30 transition-colors">
                      <TableCell className="border-r font-medium">Tanpa Keterangan</TableCell>
                      <TableCell className="text-center">{kehadiranSummary.alpha} Hari</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Catatan */}
          <Card className="rounded-2xl border-0 shadow-md">
            <CardHeader className="border-b bg-card">
              <CardTitle className="text-xl">Catatan</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Catatan Guru</label>
                <Textarea value={catatanGuru} onChange={e => setCatatanGuru(e.target.value)} placeholder="Masukkan catatan guru..." rows={4} />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Catatan Wali/Orang Tua</label>
                <Textarea value={catatanOrtu} onChange={e => setCatatanOrtu(e.target.value)} placeholder="Masukkan catatan orang tua..." rows={4} />
              </div>
            </CardContent>
          </Card>

          {/* Tanda Tangan */}
          <Card className="rounded-2xl border-0 shadow-md">
            <CardHeader className="border-b bg-card">
              <CardTitle className="text-xl">Tanda Tangan</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                  <p className="text-sm font-medium mb-4">Orang Tua</p>
                  <div className="h-24 flex flex-col items-center justify-center gap-2">
                    <p className="text-base font-semibold text-foreground">
                      {orangtuaSantri?.name || 'Tidak ada data orang tua'}
                    </p>
                  </div>
                </div>
                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                  <p className="text-sm font-medium mb-4">Wali Kelas</p>
                  <div className="h-24 flex flex-col items-center justify-center gap-2">
                    <p className="text-base font-semibold text-foreground">
                      {kelas?.walikelas?.profile?.name || '-'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      NIP: {kelas?.walikelas?.employee_id || '-'}
                    </p>
                  </div>
                </div>
                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                  <p className="text-sm font-medium mb-4">Kepala Sekolah</p>
                  <div className="h-24 flex flex-col items-center justify-center gap-2">
                    <p className="text-base font-semibold text-foreground">
                      {kepalaSekolah?.profile?.name || '-'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      NIP: {kepalaSekolah?.employee_id || '-'}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

        </div>}
        </TabsContent>

        {/* Tab 2: Daftar Santri */}
        <TabsContent value="daftar" className="mt-6">
          <Card className="rounded-2xl border-0 shadow-lg">
            <CardHeader className="border-b bg-card">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-primary/10">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-xl">Daftar Santri</CardTitle>
                </div>
                {publishableCount > 0 && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => setShowPublishAllConfirm(true)}
                    disabled={isPublishingAll}
                    className="h-8"
                  >
                    <CheckCircle className="h-3.5 w-3.5 mr-1" />
                    {isPublishingAll ? 'Publishing...' : `Publish Semua (${publishableCount})`}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="rounded-xl border-2 border-border/50 shadow-lg overflow-hidden bg-card">
                <Table id="table2">
                  <TableHeader>
                    <TableRow className="border-b-2 border-border bg-muted/50">
                      <TableHead className="border-r w-[80px] text-center font-semibold">No</TableHead>
                      <TableHead className="border-r font-semibold">Nama Santri</TableHead>
                      <TableHead className="border-r w-[150px] text-center font-semibold">Status Raport</TableHead>
                      <TableHead className="border-r w-[150px] text-center font-semibold">Status Publish</TableHead>
                      <TableHead className="w-[200px] text-center font-semibold">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {santriList.map((santri, index) => {
                      const raportInfo = raportStatus[santri.id];
                      const isComplete = raportInfo?.status === 'selesai';
                      const isPublished = raportInfo?.is_published || false;
                      return (
                        <TableRow key={santri.id} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="border-r text-center font-medium">{index + 1}</TableCell>
                          <TableCell className="border-r">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span className="font-semibold">{santri.nama}</span>
                              <span className="text-xs text-muted-foreground">• NISN: {santri.nis}</span>
                            </div>
                          </TableCell>
                          <TableCell className="border-r text-center">
                            {isComplete ? (
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Selesai
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                <XCircle className="h-3 w-3 mr-1" />
                                Belum Selesai
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="border-r text-center">
                            {isPublished ? (
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Published
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-muted text-muted-foreground border-border">
                                <XCircle className="h-3 w-3 mr-1" />
                                Unpublished
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <ActionButtonGroup className="justify-center">
                              <DetailButton
                                onClick={() => {
                                  setSelectedSantri(santri.id);
                                  setActiveTab('detail');
                                }}
                              />
                              <Button
                                variant="outline"
                                size="icon-sm"
                                onClick={() => navigate(`/admin/penilaian/kelas/${id}/raport/${santri.id}/print`)}
                              >
                                <Printer className="h-4 w-4" />
                              </Button>
                              {isPublished ? (
                                <Button
                                  variant="destructive"
                                  size="icon-sm"
                                  onClick={() => setShowUnpublishConfirm(santri.id)}
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              ) : (
                                <Button
                                  variant="default"
                                  size="icon-sm"
                                  disabled={!isComplete}
                                  onClick={() => setShowPublishConfirm(santri.id)}
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                              )}
                            </ActionButtonGroup>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Confirmation Dialogs */}
      <AlertDialog open={showSaveConfirm} onOpenChange={setShowSaveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-primary" />
              Konfirmasi Simpan
            </AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menyimpan raport ini? Status raport akan berubah menjadi "Selesai".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowSaveConfirm(false); handleSaveRaport(); }}>
              Simpan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Konfirmasi Batal
            </AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin membatalkan? Data catatan yang belum disimpan akan hilang.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Kembali</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => { 
                setShowCancelConfirm(false); 
                setCatatanGuru(''); 
                setCatatanOrtu(''); 
              }}
              className="bg-amber-500 hover:bg-amber-600"
            >
              Ya, Batalkan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!showPublishConfirm} onOpenChange={(open) => !open && setShowPublishConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Konfirmasi Publish
            </AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin mempublish raport ini? Raport akan ditampilkan di dashboard santri.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => { 
                if (showPublishConfirm) {
                  handlePublishRaport(showPublishConfirm);
                  setShowPublishConfirm(null);
                }
              }}
              className="bg-green-500 hover:bg-green-600"
            >
              Ya, Publish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!showUnpublishConfirm} onOpenChange={(open) => !open && setShowUnpublishConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-amber-500" />
              Konfirmasi Unpublish
            </AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin unpublish raport ini? Raport tidak akan ditampilkan di dashboard santri.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => { 
                if (showUnpublishConfirm) {
                  handleUnpublishRaport(showUnpublishConfirm);
                  setShowUnpublishConfirm(null);
                }
              }}
              className="bg-amber-500 hover:bg-amber-600"
            >
              Ya, Unpublish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showPublishAllConfirm} onOpenChange={setShowPublishAllConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Konfirmasi Publish Semua
            </AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin mempublish {publishableCount} raport sekaligus? Semua raport akan ditampilkan di dashboard santri.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => { 
                setShowPublishAllConfirm(false);
                handlePublishAllRaport();
              }}
              className="bg-green-500 hover:bg-green-600"
            >
              Ya, Publish Semua
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Hidden Print Template */}
      <div className="hidden">
        <ReportPrintTemplate
          ref={printRef}
          title="LAPORAN HASIL BELAJAR PESERTA DIDIK"
          tahunAjaran={activeAcademicYear?.name}
          semester={currentSemester || 'ganjil'}
          studentData={selectedSantriData ? {
            nama: selectedSantriData.nama,
            nis: selectedSantriData.nis,
            kelas: kelas?.nama || '-'
          } : undefined}
          signer={kepalaSekolah ? {
            name: kepalaSekolah?.profile?.name || '-',
            jabatan: 'Kepala Sekolah',
            nip: kepalaSekolah?.employee_id || undefined
          } : undefined}
        >
          {/* Nilai Akademik */}
          <div className="mb-6">
            <h3 className="text-base font-bold mb-3">A. NILAI AKADEMIK</h3>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-muted">
                  <th className="border border-border p-2 text-center w-12">No</th>
                  <th className="border border-border p-2 text-left">Mata Pelajaran</th>
                  <th className="border border-border p-2 text-center w-20">Nilai</th>
                  <th className="border border-border p-2 text-left">Capaian Kompetensi</th>
                </tr>
              </thead>
              <tbody>
                {mapelNilaiList.map((mapel, index) => (
                  <tr key={index}>
                    <td className="border border-border p-2 text-center">{index + 1}</td>
                    <td className="border border-border p-2">{mapel.mapel_nama}</td>
                    <td className="border border-border p-2 text-center font-bold">{mapel.nilai_rapor.toFixed(0)}</td>
                    <td className="border border-border p-2 text-sm">{mapel.capaian_kompetensi}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Ketidakhadiran */}
          <div className="mb-6">
            <h3 className="text-base font-bold mb-3">B. KETIDAKHADIRAN</h3>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-muted">
                  <th className="border border-border p-2 text-left">Keterangan</th>
                  <th className="border border-border p-2 text-center w-32">Jumlah</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-border p-2">Sakit</td>
                  <td className="border border-border p-2 text-center">{kehadiranSummary.sakit} Hari</td>
                </tr>
                <tr>
                  <td className="border border-border p-2">Izin</td>
                  <td className="border border-border p-2 text-center">{kehadiranSummary.izin} Hari</td>
                </tr>
                <tr>
                  <td className="border border-border p-2">Tanpa Keterangan</td>
                  <td className="border border-border p-2 text-center">{kehadiranSummary.alpha} Hari</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Catatan */}
          <div className="mb-6">
            <h3 className="text-base font-bold mb-3">C. CATATAN</h3>
            <div className="border border-border p-3 rounded min-h-[60px]">
              <p className="text-sm font-medium mb-1">Catatan Guru:</p>
              <p className="text-sm">{catatanGuru || '-'}</p>
            </div>
            <div className="border border-border p-3 rounded min-h-[60px] mt-2">
              <p className="text-sm font-medium mb-1">Catatan Orang Tua:</p>
              <p className="text-sm">{catatanOrtu || '-'}</p>
            </div>
          </div>

          {/* Tanda Tangan */}
          <div className="mt-8">
            <div className="grid grid-cols-3 gap-8 text-center text-sm">
              <div>
                <p className="mb-16">Orang Tua/Wali</p>
                <p className="border-t border-foreground pt-1">( _________________ )</p>
              </div>
              <div>
                <p className="mb-16">Wali Kelas</p>
                <p className="border-t border-foreground pt-1 font-semibold">{kelas?.walikelas?.profile?.name || '-'}</p>
                <p className="text-xs text-muted-foreground">NIP. {kelas?.walikelas?.employee_id || '-'}</p>
              </div>
              <div>
                <p className="mb-16">Kepala Sekolah</p>
                <p className="border-t border-foreground pt-1 font-semibold">{kepalaSekolah?.profile?.name || '-'}</p>
                <p className="text-xs text-muted-foreground">NIP. {kepalaSekolah?.employee_id || '-'}</p>
              </div>
            </div>
          </div>
        </ReportPrintTemplate>
      </div>
    </div>;
}
