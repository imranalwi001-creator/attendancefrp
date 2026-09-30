import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Award, GraduationCap, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { FormatifTab, SumatifTab, RekapNilaiTab } from './penilaian';

interface MapelPenilaianTabProps {
  mapelId: string;
  mapelNama: string;
  mapelInfo: any;
  materiList: any[];
  santriList: any[];
  tugasList: any[];
  selectedSemester: 'ganjil' | 'genap';
  userId: string;
}

interface FormatifPerSiswa {
  [santriId: string]: {
    santri_id: string;
    nama: string;
    tp_assessments: Array<{
      tp_index: number;
      kktp: boolean;
      tampil_rapor: boolean;
    }>;
    deskripsi_tertinggi: string;
    deskripsi_terendah: string;
    db_id?: string;
  };
}

interface SumatifDataItem {
  santri_id: string;
  nama: string;
  sumatif: (number | null)[];
  non_tes: number | null;
  tes: number | null;
  na_lingkup: number;
  na_semester: number | null;
  nilai_rapor: number;
  is_finalized?: boolean;
  finalized_at?: string | null;
  finalized_by?: string | null;
  db_id?: string | null;
}

interface SumatifData {
  [santriId: string]: SumatifDataItem;
}

export default function MapelPenilaianTab({
  mapelId,
  mapelNama,
  mapelInfo,
  materiList,
  santriList,
  tugasList,
  selectedSemester,
  userId,
}: MapelPenilaianTabProps) {
  const { toast } = useToast();

  // State untuk asesmen formatif per siswa
  const [formatifPerSiswa, setFormatifPerSiswa] = useState<FormatifPerSiswa>({});

  // State untuk asesmen sumatif
  const [sumatifData, setSumatifData] = useState<SumatifData>({});
  const [editedCells, setEditedCells] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showFinalisasiModal, setShowFinalisasiModal] = useState(false);
  const [isFinalized, setIsFinalized] = useState(false);

  // Helper functions untuk auto-calculation sumatif
  const calculateNALingkup = (sumatif: (number | null)[]): number => {
    const validScores = sumatif.filter(s => s !== null && s !== undefined && !isNaN(s)) as number[];
    if (validScores.length === 0) return 0;
    const sum = validScores.reduce((acc, val) => acc + val, 0);
    return Math.round(sum / validScores.length * 10) / 10;
  };

  const calculateNASemester = (nonTes: number | null, tes: number | null): number | null => {
    if (nonTes === null && tes === null) return null;
    if (nonTes !== null && tes !== null) {
      return Math.round((nonTes + tes) / 2 * 10) / 10;
    }
    return nonTes ?? tes;
  };

  const calculateNilaiRapor = (naLingkup: number, naSemester: number | null): number => {
    if (naSemester === null) return naLingkup;
    return Math.round((naLingkup + naSemester) / 2 * 10) / 10;
  };

  // Initialize formatif data
  const initializeFormatifData = async () => {
    if (!mapelId || santriList.length === 0) return;

    try {
      const { data: existingFormatif } = await supabase
        .from('asesmen_formatif')
        .select('*')
        .eq('mapel_id', mapelId)
        .eq('semester', selectedSemester);

      const existingFormatifMap = new Map();
      existingFormatif?.forEach(item => {
        existingFormatifMap.set(item.santri_id, item);
      });

      const initialData: FormatifPerSiswa = {};
      const allTPs = mapelInfo?.tujuan_pembelajaran?.map((tp: any) => tp.text).filter(Boolean) || [];

      santriList.forEach((santri: any) => {
        const santriName = santri.name || santri.profiles?.name || 'Tidak ada nama';
        const existing = existingFormatifMap.get(santri.id);

        if (existing) {
          initialData[santri.id] = {
            santri_id: santri.id,
            nama: santriName,
            tp_assessments: existing.tp_assessments || [],
            deskripsi_tertinggi: existing.deskripsi_tertinggi || '',
            deskripsi_terendah: existing.deskripsi_terendah || '',
            db_id: existing.id
          };
        } else {
          const initialTpAssessments = mapelInfo?.tujuan_pembelajaran?.map((_: any, index: number) => ({
            tp_index: index,
            kktp: true,
            tampil_rapor: false
          })) || [];

          const deskripsiTertinggi = allTPs.length > 0 ? `${santriName} menunjukkan pemahaman dalam ${allTPs.join(', ')}` : '';

          initialData[santri.id] = {
            santri_id: santri.id,
            nama: santriName,
            tp_assessments: initialTpAssessments,
            deskripsi_tertinggi: deskripsiTertinggi,
            deskripsi_terendah: '',
            db_id: undefined
          };
        }
      });

      setFormatifPerSiswa(initialData);
    } catch (error) {
      console.error('Error initializing formatif data:', error);
    }
  };

  // Initialize sumatif data
  const initializeSumatifData = async () => {
    const initialData: SumatifData = {};
    const sumatifLength = materiList?.length || 0;

    const { data: existingData, error: loadError } = await supabase
      .from('asesmen_sumatif')
      .select('*')
      .eq('mapel_id', mapelId)
      .eq('semester', selectedSemester)
      .limit(100);

    if (loadError) {
      console.error('Error loading asesmen_sumatif:', loadError);
    }

    const existingDataMap = new Map();
    existingData?.forEach(item => {
      existingDataMap.set(item.santri_id, item);
    });

    // Fetch tugas data for auto-fill from materi → tugas → pengumpulan_tugas
    const { data: tugasData } = await supabase
      .from('tugas')
      .select('id, bab')
      .eq('mapel_id', mapelId)
      .eq('semester', selectedSemester)
      .order('created_at', { ascending: true })
      .limit(50);

    // Create mapping: materi.judul → index
    const materiToIndex = new Map<string, number>();
    materiList?.forEach((materi: any, index: number) => {
      if (materi.judul) {
        const normalized = materi.judul.toLowerCase().trim();
        materiToIndex.set(normalized, index);
      }
    });

    // Create mapping: tugas_id → materi_index (based on tugas.bab matching materi.judul)
    const tugasToMateriIndex = new Map<string, number>();
    tugasData?.forEach(tugas => {
      if (tugas.bab) {
        const normalized = tugas.bab.toLowerCase().trim();
        if (materiToIndex.has(normalized)) {
          tugasToMateriIndex.set(tugas.id, materiToIndex.get(normalized)!);
        }
      }
    });

    const tugasIds = tugasData?.map(t => t.id) || [];
    const pengumpulanBySantri = new Map();
    if (tugasIds.length > 0) {
      const { data: pengumpulanData } = await supabase
        .from('pengumpulan_tugas')
        .select('id, tugas_id, santri_id, nilai')
        .in('tugas_id', tugasIds)
        .not('nilai', 'is', null)
        .limit(500);

      pengumpulanData?.forEach(p => {
        if (!pengumpulanBySantri.has(p.santri_id)) {
          pengumpulanBySantri.set(p.santri_id, []);
        }
        pengumpulanBySantri.get(p.santri_id).push(p);
      });
    }

    santriList.forEach((santri: any) => {
      const existingSantriData = existingDataMap.get(santri.id);
      if (existingSantriData) {
        const savedSumatif = existingSantriData.sumatif || [];
        initialData[santri.id] = {
          santri_id: santri.id,
          nama: santri.name,
          sumatif: savedSumatif,
          non_tes: existingSantriData.non_tes,
          tes: existingSantriData.tes,
          na_lingkup: existingSantriData.na_lingkup,
          na_semester: existingSantriData.na_semester,
          nilai_rapor: existingSantriData.nilai_rapor,
          is_finalized: existingSantriData.is_finalized || false,
          finalized_at: existingSantriData.finalized_at,
          db_id: existingSantriData.id
        };
      } else {
        const sumatif = Array(sumatifLength).fill(null);
        const santriPengumpulan = pengumpulanBySantri.get(santri.id) || [];
        // Auto-fill nilai from pengumpulan_tugas based on materi → tugas mapping
        santriPengumpulan.forEach((p: any) => {
          const materiIndex = tugasToMateriIndex.get(p.tugas_id);
          if (materiIndex !== undefined && p.nilai !== null) {
            sumatif[materiIndex] = p.nilai;
          }
        });
        const na_lingkup = calculateNALingkup(sumatif);
        const na_semester = calculateNASemester(null, null);
        const nilai_rapor = calculateNilaiRapor(na_lingkup, na_semester);
        initialData[santri.id] = {
          santri_id: santri.id,
          nama: santri.name,
          sumatif,
          non_tes: null,
          tes: null,
          na_lingkup,
          na_semester,
          nilai_rapor,
          is_finalized: false,
          finalized_at: null,
          db_id: null
        };
      }
    });

    setSumatifData(initialData);

    const santriValues = Object.values(initialData);
    if (santriValues.length > 0) {
      const allFinalized = santriValues.every((data: any) => data.is_finalized === true);
      setIsFinalized(allFinalized);
    } else {
      setIsFinalized(false);
    }
  };

  useEffect(() => {
    if (santriList.length > 0 && mapelInfo) {
      initializeFormatifData();
    }
  }, [santriList, mapelInfo, selectedSemester]);

  useEffect(() => {
    if (santriList.length > 0 && materiList) {
      initializeSumatifData();
    }
  }, [santriList, materiList, selectedSemester]);

  // Function to save formatif data to database
  const saveFormatifData = async (santriId: string) => {
    if (!mapelId) return;
    const data = formatifPerSiswa[santriId];
    if (!data) return;

    try {
      const payload = {
        mapel_id: mapelId,
        santri_id: santriId,
        semester: selectedSemester,
        tp_assessments: data.tp_assessments,
        deskripsi_tertinggi: data.deskripsi_tertinggi,
        deskripsi_terendah: data.deskripsi_terendah
      };
      const { data: savedData, error } = await supabase
        .from('asesmen_formatif')
        .upsert(payload, { onConflict: 'mapel_id,santri_id,semester' })
        .select()
        .single();

      if (error) throw error;

      setFormatifPerSiswa(prev => ({
        ...prev,
        [santriId]: { ...prev[santriId], db_id: savedData.id }
      }));
    } catch (error) {
      console.error('Error saving formatif data:', error);
      toast({
        title: "Error",
        description: "Gagal menyimpan data asesmen formatif",
        variant: "destructive"
      });
    }
  };

  // Function to save all formatif data at once
  const handleSaveAllFormatif = async () => {
    if (!mapelId) return;
    setIsSaving(true);
    try {
      const dataToSave = Object.values(formatifPerSiswa).map((data: any) => ({
        mapel_id: mapelId,
        santri_id: data.santri_id,
        semester: selectedSemester,
        tp_assessments: data.tp_assessments,
        deskripsi_tertinggi: data.deskripsi_tertinggi,
        deskripsi_terendah: data.deskripsi_terendah
      }));
      const { error } = await supabase
        .from('asesmen_formatif')
        .upsert(dataToSave, { onConflict: 'mapel_id,santri_id,semester' });

      if (error) throw error;
      toast({
        title: "✅ Berhasil",
        description: `Data asesmen formatif untuk ${dataToSave.length} siswa berhasil disimpan`,
        duration: 3000
      });
    } catch (error) {
      console.error('Error saving all formatif data:', error);
      toast({
        title: "Error",
        description: "Gagal menyimpan data asesmen formatif",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Handler untuk toggle KKTP
  const handleToggleKKTP = async (santriId: string, tpIndex: number, checked: boolean) => {
    setFormatifPerSiswa(prev => {
      const current = prev[santriId];
      if (!current) return prev;

      const existingAssessment = current.tp_assessments.find(a => a.tp_index === tpIndex);
      let newAssessments;

      if (existingAssessment) {
        newAssessments = current.tp_assessments.map(a => a.tp_index === tpIndex ? { ...a, kktp: checked } : a);
      } else {
        newAssessments = [...current.tp_assessments, { tp_index: tpIndex, kktp: checked, tampil_rapor: false }];
      }

      const checkedTPs = newAssessments.filter(a => a.kktp).map(a => mapelInfo?.tujuan_pembelajaran?.[a.tp_index]?.text).filter(Boolean);
      const deskripsiTertinggi = checkedTPs.length > 0 ? `${current.nama} menunjukkan pemahaman dalam ${checkedTPs.join(', ')}` : '';

      const allTpIndices = Array.from({ length: mapelInfo?.tujuan_pembelajaran?.length || 0 }, (_, i) => i);
      const uncheckedTPs = allTpIndices.filter(tpIdx => {
        const assessment = newAssessments.find(a => a.tp_index === tpIdx);
        return !assessment || !assessment.kktp;
      }).map(tpIdx => mapelInfo?.tujuan_pembelajaran?.[tpIdx]?.text).filter(Boolean);
      const deskripsiTerendah = uncheckedTPs.length > 0 ? `${current.nama} membutuhkan bimbingan dalam ${uncheckedTPs.join(', ')}` : '';

      return {
        ...prev,
        [santriId]: {
          ...current,
          tp_assessments: newAssessments,
          deskripsi_tertinggi: deskripsiTertinggi,
          deskripsi_terendah: deskripsiTerendah
        }
      };
    });

    await saveFormatifData(santriId);
  };

  // Handler untuk toggle Tampil Rapor
  const handleToggleTampilRapor = async (santriId: string, tpIndex: number, checked: boolean | 'indeterminate') => {
    const isChecked = checked === true;
    setFormatifPerSiswa(prev => {
      const current = prev[santriId];
      if (!current) return prev;

      const existingAssessment = current.tp_assessments.find(a => a.tp_index === tpIndex);
      let newAssessments;

      if (existingAssessment) {
        newAssessments = current.tp_assessments.map(a => a.tp_index === tpIndex ? { ...a, tampil_rapor: isChecked } : a);
      } else {
        newAssessments = [...current.tp_assessments, { tp_index: tpIndex, kktp: false, tampil_rapor: isChecked }];
      }

      return { ...prev, [santriId]: { ...current, tp_assessments: newAssessments } };
    });

    await saveFormatifData(santriId);
  };

  // Bulk handlers for Asesmen Formatif
  const handleBulkToggleKKTP = async (santriId: string, value: boolean) => {
    setFormatifPerSiswa(prev => {
      const current = prev[santriId];
      if (!current) return prev;

      const updatedAssessments = mapelInfo?.tujuan_pembelajaran?.map((_: any, index: number) => ({
        tp_index: index,
        kktp: value,
        tampil_rapor: current.tp_assessments.find((a: any) => a.tp_index === index)?.tampil_rapor || false
      })) || [];

      const allTPs = mapelInfo?.tujuan_pembelajaran?.map((tp: any) => tp.text).filter(Boolean) || [];
      const deskripsiTertinggi = value && allTPs.length > 0 ? `${current.nama} menunjukkan pemahaman dalam ${allTPs.join(', ')}` : '';
      const deskripsiTerendah = !value && allTPs.length > 0 ? `${current.nama} membutuhkan bimbingan dalam ${allTPs.join(', ')}` : '';

      return {
        ...prev,
        [santriId]: {
          ...current,
          tp_assessments: updatedAssessments,
          deskripsi_tertinggi: deskripsiTertinggi,
          deskripsi_terendah: deskripsiTerendah
        }
      };
    });

    await saveFormatifData(santriId);
  };

  const handleBulkToggleTampil = async (santriId: string, value: boolean) => {
    setFormatifPerSiswa(prev => {
      const current = prev[santriId];
      if (!current) return prev;

      const updatedAssessments = current.tp_assessments.map((a: any) => ({ ...a, tampil_rapor: value }));
      return { ...prev, [santriId]: { ...current, tp_assessments: updatedAssessments } };
    });

    await saveFormatifData(santriId);
  };

  // Handlers untuk Asesmen Sumatif
  const handleSumatifChange = (santriId: string, index: number, value: string) => {
    const numValue = value === '' ? null : parseFloat(value);
    if (numValue !== null && (numValue < 0 || numValue > 100)) {
      toast({ title: "Nilai tidak valid", description: "Nilai harus antara 0-100", variant: "destructive" });
      return;
    }

    setSumatifData(prev => {
      const current = prev[santriId];
      if (!current) {
        const santri = santriList.find((s: any) => s.id === santriId);
        if (!santri) return prev;
        const sumatifLength = materiList?.length || 0;
        const newSumatif = Array(sumatifLength).fill(null);
        newSumatif[index] = numValue;
        const na_lingkup = calculateNALingkup(newSumatif);
        return {
          ...prev,
          [santriId]: {
            santri_id: santriId,
            nama: santri.name,
            sumatif: newSumatif,
            non_tes: null,
            tes: null,
            na_lingkup,
            na_semester: null,
            nilai_rapor: na_lingkup,
            is_finalized: false,
            finalized_at: null,
            finalized_by: null
          }
        };
      }

      const newSumatif = [...current.sumatif];
      newSumatif[index] = numValue;
      const na_lingkup = calculateNALingkup(newSumatif);
      const na_semester = calculateNASemester(current.non_tes, current.tes);
      const nilai_rapor = calculateNilaiRapor(na_lingkup, na_semester);

      return {
        ...prev,
        [santriId]: { ...current, sumatif: newSumatif, na_lingkup, na_semester, nilai_rapor }
      };
    });

    setEditedCells(prev => new Set([...prev, `${santriId}-sumatif-${index}`]));
  };

  const handleNonTesChange = (santriId: string, value: string) => {
    const numValue = value === '' ? null : parseFloat(value);
    if (numValue !== null && (numValue < 0 || numValue > 100)) {
      toast({ title: "Nilai tidak valid", description: "Nilai harus antara 0-100", variant: "destructive" });
      return;
    }

    setSumatifData(prev => {
      const current = prev[santriId];
      if (!current) {
        const santri = santriList.find((s: any) => s.id === santriId);
        if (!santri) return prev;
        const sumatifLength = materiList?.length || 0;
        const na_semester = calculateNASemester(numValue, null);
        const nilai_rapor = calculateNilaiRapor(0, na_semester);
        return {
          ...prev,
          [santriId]: {
            santri_id: santriId,
            nama: santri.name,
            sumatif: Array(sumatifLength).fill(null),
            non_tes: numValue,
            tes: null,
            na_lingkup: 0,
            na_semester,
            nilai_rapor,
            is_finalized: false,
            finalized_at: null,
            finalized_by: null
          }
        };
      }

      const na_semester = calculateNASemester(numValue, current.tes);
      const nilai_rapor = calculateNilaiRapor(current.na_lingkup, na_semester);
      return { ...prev, [santriId]: { ...current, non_tes: numValue, na_semester, nilai_rapor } };
    });

    setEditedCells(prev => new Set([...prev, `${santriId}-nontes`]));
  };

  const handleTesChange = (santriId: string, value: string) => {
    const numValue = value === '' ? null : parseFloat(value);
    if (numValue !== null && (numValue < 0 || numValue > 100)) {
      toast({ title: "Nilai tidak valid", description: "Nilai harus antara 0-100", variant: "destructive" });
      return;
    }

    setSumatifData(prev => {
      const current = prev[santriId];
      if (!current) {
        const santri = santriList.find((s: any) => s.id === santriId);
        if (!santri) return prev;
        const sumatifLength = materiList?.length || 0;
        const na_semester = calculateNASemester(null, numValue);
        const nilai_rapor = calculateNilaiRapor(0, na_semester);
        return {
          ...prev,
          [santriId]: {
            santri_id: santriId,
            nama: santri.name,
            sumatif: Array(sumatifLength).fill(null),
            non_tes: null,
            tes: numValue,
            na_lingkup: 0,
            na_semester,
            nilai_rapor,
            is_finalized: false,
            finalized_at: null,
            finalized_by: null
          }
        };
      }

      const na_semester = calculateNASemester(current.non_tes, numValue);
      const nilai_rapor = calculateNilaiRapor(current.na_lingkup, na_semester);
      return { ...prev, [santriId]: { ...current, tes: numValue, na_semester, nilai_rapor } };
    });

    setEditedCells(prev => new Set([...prev, `${santriId}-tes`]));
  };

  const handleAutoSave = async () => {
    const changesCount = editedCells.size;
    if (changesCount === 0) return;
    setIsSaving(true);

    try {
      const dataToSave = Object.values(sumatifData).map((data: any) => ({
        mapel_id: mapelId,
        santri_id: data.santri_id,
        semester: selectedSemester,
        sumatif: data.sumatif,
        non_tes: data.non_tes,
        tes: data.tes,
        na_lingkup: data.na_lingkup,
        na_semester: data.na_semester,
        nilai_rapor: data.nilai_rapor,
        is_finalized: data.is_finalized || false,
        finalized_at: data.finalized_at || null,
        finalized_by: data.finalized_by || null
      }));

      const { error } = await supabase
        .from('asesmen_sumatif')
        .upsert(dataToSave, { onConflict: 'mapel_id,santri_id,semester' });

      if (error) throw error;

      setEditedCells(new Set());
      await initializeSumatifData();

      toast({
        title: "✅ Tersimpan",
        description: `${changesCount} perubahan berhasil disimpan`,
        duration: 2000
      });
    } catch (error) {
      console.error('Error in handleAutoSave:', error);
      toast({
        title: "❌ Gagal menyimpan",
        description: "Terjadi kesalahan saat menyimpan data. Silakan coba lagi.",
        variant: "destructive",
        duration: 4000
      });
    } finally {
      setIsSaving(false);
    }
  };

  const isAllSumatifFilled = () => {
    const allData = Object.values(sumatifData);
    if (allData.length === 0) return false;
    return allData.every((data: any) => {
      if (!data || !data.sumatif || !Array.isArray(data.sumatif)) return false;
      const allSumatifFilled = data.sumatif.length > 0 && data.sumatif.every((val: number | null) => val !== null && val !== undefined && val >= 0);
      const hasNALingkup = data.na_lingkup != null && data.na_lingkup > 0;
      const hasNilaiRapor = data.nilai_rapor != null && data.nilai_rapor > 0;
      return allSumatifFilled && hasNALingkup && hasNilaiRapor;
    });
  };

  const handleFinalisasiClick = () => {
    setShowFinalisasiModal(true);
  };

  const handleFinalisasiConfirm = async () => {
    try {
      setShowFinalisasiModal(false);
      const now = new Date().toISOString();
      const finalizedData = Object.values(sumatifData).map((data: any) => ({
        mapel_id: mapelId,
        santri_id: data.santri_id,
        semester: selectedSemester,
        sumatif: data.sumatif,
        non_tes: data.non_tes,
        tes: data.tes,
        na_lingkup: data.na_lingkup,
        na_semester: data.na_semester,
        nilai_rapor: data.nilai_rapor,
        is_finalized: true,
        finalized_at: now,
        finalized_by: userId
      }));

      const { error } = await supabase
        .from('asesmen_sumatif')
        .upsert(finalizedData, { onConflict: 'mapel_id,santri_id,semester' });

      if (error) throw error;
      setIsFinalized(true);
      toast({
        title: "Berhasil",
        description: "Data nilai sumatif telah difinalisasi dan siap untuk rapor."
      });

      await initializeSumatifData();
    } catch (error) {
      console.error('Error finalizing data:', error);
      toast({
        title: "Gagal Memfinalisasi",
        description: "Terjadi kesalahan saat memfinalisasi data",
        variant: "destructive"
      });
    }
  };

  const handleExport = () => {
    // Build dynamic headers based on materiList
    const materiHeaders: Record<string, any> = {};
    materiList?.forEach((materi: any, index: number) => {
      materiHeaders[materi.judul || `Materi ${index + 1}`] = (data: SumatifDataItem) => data.sumatif[index] ?? '';
    });

    const csvData = Object.values(sumatifData).map((data, index) => {
      const row: Record<string, any> = {
        No: index + 1,
        'Nama Siswa': data.nama,
      };
      // Add materi columns dynamically
      Object.keys(materiHeaders).forEach(key => {
        row[key] = materiHeaders[key](data);
      });
      row['NA Sumatif Materi'] = data.na_lingkup;
      row['Non Tes'] = data.non_tes ?? '';
      row['Tes'] = data.tes ?? '';
      row['NA Sumatif Akhir Semester'] = data.na_semester ?? '';
      row['Nilai Rapor'] = data.nilai_rapor;
      return row;
    });

    if (csvData.length === 0) {
      toast({ title: "Tidak ada data", description: "Tidak ada data untuk diekspor", variant: "destructive" });
      return;
    }

    const headers = Object.keys(csvData[0]).join(',');
    const rows = csvData.map(row => Object.values(row).join(',')).join('\n');
    const csv = `${headers}\n${rows}`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `asesmen-sumatif-${mapelNama || 'data'}.csv`;
    a.click();
    toast({ title: "📥 Ekspor Berhasil", description: "Data berhasil diekspor ke CSV" });
  };

  const handleEditNilai = async () => {
    if (!mapelId) return;
    try {
      const { error } = await supabase
        .from('asesmen_sumatif')
        .update({ is_finalized: false, finalized_at: null, finalized_by: null })
        .eq('mapel_id', mapelId)
        .eq('semester', selectedSemester)
        .eq('is_finalized', true);

      if (error) throw error;

      setIsFinalized(false);
      await initializeSumatifData();
      toast({ title: "Mode Edit Aktif", description: "Anda dapat mengedit nilai siswa sekarang" });
    } catch (error) {
      console.error('Error enabling edit mode:', error);
      toast({ title: "Error", description: "Gagal mengaktifkan mode edit", variant: "destructive" });
    }
  };

  const handleReset = async () => {
    if (!mapelId) return;
    setIsSaving(true);
    try {
      const { error: deleteError } = await supabase
        .from('asesmen_sumatif')
        .delete()
        .eq('mapel_id', mapelId)
        .eq('semester', selectedSemester);

      if (deleteError) throw deleteError;

      await initializeSumatifData();
      setEditedCells(new Set());
      setShowResetConfirm(false);
      toast({ title: "♻️ Data Direset", description: "Semua data asesmen sumatif telah dihapus" });
    } catch (error) {
      console.error('Error resetting data:', error);
      toast({ title: "Error", description: "Gagal mereset data asesmen sumatif", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  // Render TabsList
  const renderTabsList = () => (
    <TabsList className="w-full h-auto p-1.5 bg-transparent rounded-full border border-border gap-2">
      <TabsTrigger value="formatif" className="flex-1 gap-2 py-2.5 px-5 rounded-full border border-transparent data-[state=active]:border-primary data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all">
        <Award className="h-4 w-4" />
        <span className="font-medium">Formatif</span>
      </TabsTrigger>
      <TabsTrigger value="sumatif" className="flex-1 gap-2 py-2.5 px-5 rounded-full border border-transparent data-[state=active]:border-primary data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all">
        <GraduationCap className="h-4 w-4" />
        <span className="font-medium">Sumatif</span>
      </TabsTrigger>
    </TabsList>
  );

  return (
    <>
      <Tabs defaultValue={isFinalized ? "sumatif" : "formatif"} className="w-full">
        {/* Tab 1: Asesmen Formatif */}
        {!isFinalized && (
          <TabsContent value="formatif" className="space-y-6 animate-fade-in">
            <FormatifTab
              mapelInfo={mapelInfo}
              santriList={santriList}
              formatifPerSiswa={formatifPerSiswa}
              setFormatifPerSiswa={setFormatifPerSiswa}
              isSaving={isSaving}
              onToggleKKTP={handleToggleKKTP}
              onToggleTampilRapor={handleToggleTampilRapor}
              onBulkToggleKKTP={handleBulkToggleKKTP}
              onBulkToggleTampil={handleBulkToggleTampil}
              onSaveAll={handleSaveAllFormatif}
              renderTabsList={renderTabsList}
            />
          </TabsContent>
        )}

        {/* Tab 2: Asesmen Sumatif */}
        <TabsContent value="sumatif" className="space-y-6 animate-fade-in">
          {!isFinalized ? (
            <SumatifTab
              mapelInfo={mapelInfo}
              materiList={materiList}
              santriList={santriList}
              sumatifData={sumatifData}
              editedCells={editedCells}
              isSaving={isSaving}
              onSumatifChange={handleSumatifChange}
              onNonTesChange={handleNonTesChange}
              onTesChange={handleTesChange}
              onAutoSave={handleAutoSave}
              onExport={handleExport}
              onResetClick={() => setShowResetConfirm(true)}
              onFinalisasiClick={handleFinalisasiClick}
              isAllFilled={isAllSumatifFilled()}
              renderTabsList={renderTabsList}
            />
          ) : (
            <RekapNilaiTab
              mapelNama={mapelNama}
              santriList={santriList}
              sumatifData={sumatifData}
              formatifPerSiswa={formatifPerSiswa}
              onEditNilai={handleEditNilai}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Reset Confirmation Dialog */}
      <AlertDialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <AlertDialogContent className="animate-scale-in">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Konfirmasi Reset Data
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              Apakah Anda yakin ingin mereset semua data asesmen sumatif? 
              <span className="block mt-2 font-semibold text-foreground">
                Semua data nilai yang telah diinput akan dihapus dan tidak dapat dikembalikan.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="hover:bg-accent">Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleReset} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Ya, Reset Data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Finalisasi Confirmation Dialog */}
      <AlertDialog open={showFinalisasiModal} onOpenChange={setShowFinalisasiModal}>
        <AlertDialogContent className="animate-scale-in">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              Finalisasi Nilai
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              Apakah Anda yakin ingin memfinalisasi nilai? 
              <span className="block mt-2 font-semibold text-foreground">
                Setelah difinalisasi, nilai tidak dapat diubah lagi.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="hover:bg-accent">Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleFinalisasiConfirm} className="bg-primary text-primary-foreground hover:bg-primary/90">
              Ya, Finalisasi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
