import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import TugasDetail from '@/components/tugas/TugasDetail';
import TugasForm from '@/components/tugas/TugasForm';
import TugasSubmitForm from '@/components/tugas/TugasSubmitForm';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tugas, PengumpulanTugas, User } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { toast as sonnerToast } from 'sonner';

export default function TugasDetailPage() {
  const { tugasId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();

  const isSantri = user?.role === 'santri';

  const [loading, setLoading] = useState(true);
  const [tugas, setTugas] = useState<Tugas | null>(null);
  const [pengumpulanList, setPengumpulanList] = useState<PengumpulanTugas[]>([]);
  const [santriList, setSantriList] = useState<User[]>([]);
  const [showEditSheet, setShowEditSheet] = useState(false);
  const [mapelId, setMapelId] = useState<string | null>(null);
  const [mapelNama, setMapelNama] = useState<string>('');
  const [kelasNama, setKelasNama] = useState<string>('');
  const [pengampuSigner, setPengampuSigner] = useState<{ name: string; jabatan: string; nip?: string } | undefined>(undefined);
  const [semester, setSemester] = useState<'ganjil' | 'genap'>('ganjil');

  // Santri-specific state
  const [existingSubmission, setExistingSubmission] = useState<any>(null);
  const [isEditingSubmission, setIsEditingSubmission] = useState(false);

  const fetchTugasDetail = async () => {
    if (!tugasId) return;
    setLoading(true);
    
    try {
      // Fetch tugas data
      const { data: tugasData, error: tugasError } = await supabase
        .from('tugas')
        .select('id, judul, deskripsi, bab, tanggal_deadline, tanggal_mulai, tipe_jawaban, mapel_id, status, nilai_maksimal, semester, created_at')
        .eq('id', tugasId)
        .single();

      if (tugasError) throw tugasError;
      if (!tugasData) {
        toast({
          title: "Error",
          description: "Tugas tidak ditemukan",
          variant: "destructive"
        });
        navigate(-1);
        return;
      }

      const transformedTugas: Tugas = {
        id: tugasData.id,
        judul: tugasData.judul,
        deskripsi: tugasData.deskripsi,
        bab: tugasData.bab,
        deadline: tugasData.tanggal_deadline,
        tanggal_deadline: tugasData.tanggal_deadline,
        tanggal_mulai: tugasData.tanggal_mulai,
        tipeJawaban: tugasData.tipe_jawaban as 'file' | 'teks' | 'link' | 'semua',
        tipe_jawaban: tugasData.tipe_jawaban as 'file' | 'teks' | 'link' | 'semua',
        mapelId: tugasData.mapel_id,
        mapel_id: tugasData.mapel_id,
        status: tugasData.status || 'aktif',
        nilai_maksimal: tugasData.nilai_maksimal,
        createdAt: tugasData.created_at,
        created_at: tugasData.created_at
      };

      setTugas(transformedTugas);
      setMapelId(tugasData.mapel_id);
      setSemester((tugasData.semester as 'ganjil' | 'genap') || 'ganjil');

      if (isSantri && user?.id) {
        // Fetch santri's own submission (if any)
        const { data: subData } = await supabase
          .from('pengumpulan_tugas')
          .select('id, tugas_id, santri_id, jawaban_teks, file_url, tanggal_submit, status, nilai, catatan_nilai')
          .eq('tugas_id', tugasId)
          .eq('santri_id', user.id)
          .maybeSingle();

        setExistingSubmission(subData || null);
        setIsEditingSubmission(false);
        setLoading(false);
        return;
      }

      // Teacher/admin view: fetch class roster + all submissions
      const { data: mapelData } = await supabase
        .from('mapel')
        .select('kelas_id, nama, pengampu_id, kelas:kelas_id(nama), pengampu:profiles!mapel_pengampu_id_fkey(id, name)')
        .eq('id', tugasData.mapel_id)
        .single();

      if (mapelData?.nama) setMapelNama(mapelData.nama);
      if ((mapelData as any)?.kelas?.nama) setKelasNama((mapelData as any).kelas.nama);
      const pengampuRaw: any = (mapelData as any)?.pengampu;
      const pengampuProfile = Array.isArray(pengampuRaw) ? pengampuRaw[0] : pengampuRaw;
      if (pengampuProfile?.name) {
        setPengampuSigner({
          name: pengampuProfile.name,
          jabatan: 'Guru Mata Pelajaran',
          nip: undefined,
        });
      }

      if (mapelData?.kelas_id) {
        const { data: santriData } = await supabase
          .from('santri')
          .select(`
            id,
            profiles!santri_id_fkey(id, name)
          `)
          .eq('kelas_id', mapelData.kelas_id)
          .limit(100);

        if (santriData) {
          const transformedSantri = santriData.map((s: any) => ({
            id: s.id,
            name: s.profiles?.name || 'Unknown'
          }));
          setSantriList(transformedSantri as User[]);
        }
      }

      const { data: pengumpulanData } = await supabase
        .from('pengumpulan_tugas')
        .select('id, tugas_id, santri_id, tanggal_submit, jawaban_teks, file_url, status, nilai, catatan_nilai, feedback_santri')
        .eq('tugas_id', tugasId)
        .limit(200);

      if (pengumpulanData && pengumpulanData.length > 0) {
        const santriIds = [...new Set(pengumpulanData.map(p => p.santri_id))];
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', santriIds);

        const santriNameMap = new Map(profilesData?.map(p => [p.id, p.name]) || []);

        const transformedPengumpulan = pengumpulanData.map((p: any) => {
          const fileUrl = (p.file_url as string | null) || '';
          const isSupabaseStorageUrl = fileUrl.includes('/storage/v1/object/public/');
          const tipe = p.jawaban_teks ? 'teks' : fileUrl ? (isSupabaseStorageUrl ? 'file' : 'link') : 'file';
          return {
            id: p.id,
            tugasId: p.tugas_id,
            santriId: p.santri_id,
            santriName: santriNameMap.get(p.santri_id) || 'Unknown',
            jawaban: {
              tipe: tipe as 'file' | 'teks' | 'link',
              value: p.jawaban_teks || p.file_url || ''
            },
            submittedAt: p.tanggal_submit,
            status: p.status,
            nilai: p.nilai,
            komentarGuru: p.catatan_nilai,
            feedbackSantri: p.feedback_santri,
          };
        });

        setPengumpulanList(transformedPengumpulan as PengumpulanTugas[]);
      }
    } catch (error: any) {
      console.error('Error fetching tugas:', error);
      toast({
        title: "Error",
        description: error.message || "Gagal memuat data tugas",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTugasDetail();
  }, [tugasId, user?.id]);

  const handleBack = () => {
    if (mapelId) {
      const isAdmin = location.pathname.startsWith('/admin');
      const basePath = isAdmin ? '/admin/mapel' : '/app/mapel';
      navigate(`${basePath}/${mapelId}?tab=tugas`);
    } else {
      navigate(-1);
    }
  };

  const handleEdit = () => {
    if (!tugas) return;
    const isDeadlinePassed = tugas.tanggal_deadline ? new Date(tugas.tanggal_deadline).getTime() < Date.now() : false;
    if (tugas.status === 'ditutup' || isDeadlinePassed) {
      sonnerToast.error('Tugas yang sudah ditutup atau melewati deadline tidak dapat diedit.');
      return;
    }
    setShowEditSheet(true);
  };

  const handleSaveTugas = async () => {
    await fetchTugasDetail();
    setShowEditSheet(false);
  };

  // Santri submit handler
  const handleSantriSubmit = async (jawaban: { tipe: 'file' | 'teks' | 'link'; value: string }) => {
    if (!tugas || !user?.id) return;
    try {
      const { data: santriData, error: santriError } = await supabase
        .from('santri')
        .select('id')
        .eq('id', user.id)
        .single();

      if (santriError || !santriData) {
        sonnerToast.error('Anda tidak terdaftar sebagai santri. Silakan hubungi admin.');
        return;
      }

      if (existingSubmission) {
        const { error } = await supabase.from('pengumpulan_tugas').update({
          jawaban_teks: jawaban.tipe === 'teks' ? jawaban.value : null,
          file_url: jawaban.tipe === 'file' || jawaban.tipe === 'link' ? jawaban.value : null,
          tanggal_submit: new Date().toISOString(),
          status: 'submitted',
        }).eq('id', existingSubmission.id);
        if (error) throw error;
        sonnerToast.success('Jawaban berhasil diperbarui');
      } else {
        const { error } = await supabase.from('pengumpulan_tugas').insert({
          tugas_id: tugas.id,
          santri_id: santriData.id,
          jawaban_teks: jawaban.tipe === 'teks' ? jawaban.value : null,
          file_url: jawaban.tipe === 'file' || jawaban.tipe === 'link' ? jawaban.value : null,
          status: 'submitted',
        });
        if (error) throw error;
        sonnerToast.success('Tugas berhasil dikumpulkan');
      }
      setIsEditingSubmission(false);
      await fetchTugasDetail();
    } catch (error: any) {
      sonnerToast.error(error.message || 'Gagal mengumpulkan tugas');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!tugas) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Tugas tidak ditemukan</p>
      </div>
    );
  }

  // Santri view: render TugasSubmitForm
  if (isSantri) {
    return (
      <div className="p-3 md:p-6 space-y-3 md:space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBack}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali
        </Button>
        <TugasSubmitForm
          tugas={tugas}
          onBack={handleBack}
          onSubmit={handleSantriSubmit}
          existingSubmission={existingSubmission || undefined}
          isEditing={isEditingSubmission}
        />
        {existingSubmission && !isEditingSubmission && (
          <div className="flex justify-end">
            <Button onClick={() => setIsEditingSubmission(true)} variant="outline">
              Edit Jawaban
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <TugasDetail
        tugas={tugas}
        pengumpulanList={pengumpulanList}
        santriList={santriList}
        mapelNama={mapelNama}
        kelasNama={kelasNama}
        signer={pengampuSigner}
        onBack={handleBack}
        onEdit={handleEdit}
        onRefresh={fetchTugasDetail}
      />

      <Sheet open={showEditSheet} onOpenChange={setShowEditSheet}>
        <SheetContent side="bottom" className="h-[85vh] overflow-y-auto rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Edit Tugas</SheetTitle>
          </SheetHeader>
          <div className="mt-6">
            <TugasForm
              tugas={tugas}
              mapelId={mapelId || ''}
              semester={semester}
              onBack={() => setShowEditSheet(false)}
              onSave={handleSaveTugas}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
