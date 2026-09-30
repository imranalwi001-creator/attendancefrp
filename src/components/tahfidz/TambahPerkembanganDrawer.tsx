import * as React from "react";
import { useState, useEffect, useMemo } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from "@/components/ui/drawer";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PredikatBadge, getPredikatFromScore } from "@/components/ui/predikat-badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveAcademicYear } from "@/hooks/useActiveAcademicYear";
import { toast } from "sonner";
import { BookOpen, RefreshCw, Mic, Link2, Play, Trash2, Check, Square, Users, CalendarCheck, ArrowRight, FileCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { getLocalDateString } from "@/lib/dateUtils";
import { QURAN_JUZ_SURAH_MAPPING, getSurahsInJuz, getVerseRangeInJuz, getTotalAyatBySurahNumber } from "@/data/quranJuzSurahMapping";
import { PembinaSelector, PembinaOption } from "./PembinaSelector";
import { checkAyatOverlap, checkSurahCompletion, canFinalizeSurah, formatOverlapError, SurahCompletionResult } from "@/lib/hafalanValidation";
type TahfidzMode = "ziyadah" | "murojaah" | "tasmi";
type ZiyadahSubMode = "setoran_harian" | "finalisasi_surah";
type DrawerMode = "tahfidz" | "tahsin";
interface Santri {
  id: string;
  nis: string | null;
  profiles: {
    name: string;
  } | null;
  kelas: {
    nama: string;
  } | null;
}
interface FinalizationNavigationData {
  santriId: string;
  juz: string;
  surah: string;
  surahNumber: number;
}

interface TambahPerkembanganDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab: DrawerMode;
  onSuccess?: () => void;
  // Pre-fill props for finalization flow
  prefillData?: {
    santriId?: string;
    juz?: string;
    surah?: string;
    surahNumber?: number;
    ziyadahSubMode?: ZiyadahSubMode;
  };
  // Callback for navigating to finalization mode
  onNavigateToFinalization?: (data: FinalizationNavigationData) => void;
}
export function TambahPerkembanganDrawer({
  open,
  onOpenChange,
  initialTab,
  onSuccess,
  prefillData,
  onNavigateToFinalization
}: TambahPerkembanganDrawerProps) {
  const {
    user
  } = useAuth();
  const {
    academicYear
  } = useActiveAcademicYear();

  // Mode state
  const [tahfidzMode, setTahfidzMode] = useState<TahfidzMode | null>(null);
  const [ziyadahSubMode, setZiyadahSubMode] = useState<ZiyadahSubMode | null>(null);

  // Common state
  const [santriId, setSantriId] = useState("");
  const [santriList, setSantriList] = useState<Santri[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Wilayah state (Tahfidz)
  const [juz, setJuz] = useState("");
  const [surah, setSurah] = useState("");
  const [surahSearch, setSurahSearch] = useState("");
  const [ayatAwal, setAyatAwal] = useState("");
  const [ayatAkhir, setAyatAkhir] = useState("");

  // Murojaah state - keterangan text input
  const [keteranganMurojaah, setKeteranganMurojaah] = useState("");

  // Tasmi state
  const [pembinaList, setPembinaList] = useState<PembinaOption[]>([]);
  const [selectedPembinaId, setSelectedPembinaId] = useState("");
  const [isAlAkhor, setIsAlAkhor] = useState(false);
  const [pembinaExternal, setPembinaExternal] = useState("");
  const [keteranganTasmi, setKeteranganTasmi] = useState("");

  // Tahsin state
  const [materiTahsin, setMateriTahsin] = useState("");

  // Scoring state
  const [tajwid, setTajwid] = useState("");
  const [makhraj, setMakhraj] = useState("");
  const [kelancaran, setKelancaran] = useState("");

  // Status state
  const [status, setStatus] = useState("");

  // Recording state
  const [rekamanMode, setRekamanMode] = useState<"rekam" | "link">("rekam");
  const [linkRekaman, setLinkRekaman] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const audioChunksRef = React.useRef<Blob[]>([]);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // State for close confirmation dialog
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  // Completion check state
  const [completionResult, setCompletionResult] = useState<SurahCompletionResult | null>(null);

  // Check if form has any data
  const hasFormData = santriId !== "" || tahfidzMode !== null || juz !== "" || surah !== "" || ayatAwal !== "" || ayatAkhir !== "" || materiTahsin !== "" || tajwid !== "" || makhraj !== "" || kelancaran !== "" || status !== "" || linkRekaman !== "" || audioUrl !== null || selectedPembinaId !== "" || pembinaExternal !== "" || keteranganTasmi !== "" || keteranganMurojaah !== "";

  // Handle drawer close with confirmation
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && (hasFormData || isRecording)) {
      setShowCloseConfirm(true);
    } else {
      onOpenChange(newOpen);
    }
  };

  // Stop recording helper (defined early for use in handleConfirmClose)
  const stopRecordingHelper = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  // Confirm close and reset
  const handleConfirmClose = () => {
    if (isRecording) {
      stopRecordingHelper();
    }
    resetForm();
    setShowCloseConfirm(false);
    onOpenChange(false);
  };

  // Calculate nilai akhir
  const nilaiAkhir = useMemo(() => {
    const t = parseFloat(tajwid) || 0;
    const m = parseFloat(makhraj) || 0;
    const k = parseFloat(kelancaran) || 0;
    if (!tajwid && !makhraj && !kelancaran) return 0;
    return Math.round((t + m + k) / 3);
  }, [tajwid, makhraj, kelancaran]);

  // Get surahs available in selected Juz
  const availableSurahsInJuz = useMemo(() => {
    if (!juz) return [];
    return getSurahsInJuz(parseInt(juz));
  }, [juz]);

  // Get selected surah mapping for the selected Juz
  const selectedSurahMapping = useMemo(() => {
    if (!juz || !surah) return null;
    return availableSurahsInJuz.find(s => s.surah_number.toString() === surah) || null;
  }, [juz, surah, availableSurahsInJuz]);

  // Filter surah list based on search
  const filteredSurahList = useMemo(() => {
    if (!surahSearch) return availableSurahsInJuz;
    return availableSurahsInJuz.filter(s => s.surah_name_latin.toLowerCase().includes(surahSearch.toLowerCase()) || s.surah_number.toString().includes(surahSearch));
  }, [surahSearch, availableSurahsInJuz]);

  // Get verse range for selected surah in selected Juz
  const verseRange = useMemo(() => {
    if (!juz || !surah) return null;
    return getVerseRangeInJuz(parseInt(juz), parseInt(surah));
  }, [juz, surah]);

  // Reset surah and ayat when juz changes
  useEffect(() => {
    if (juz && !prefillData?.surah) {
      setSurah("");
      setAyatAwal("");
      setAyatAkhir("");
      setSurahSearch("");
    }
  }, [juz, prefillData?.surah]);

  // Set default ayat values when surah changes (only for setoran_harian)
  useEffect(() => {
    if (verseRange && ziyadahSubMode === "setoran_harian") {
      setAyatAwal(verseRange.start.toString());
      setAyatAkhir(verseRange.end.toString());
    }
  }, [verseRange, ziyadahSubMode]);

  // Fetch santri list and pembina list
  useEffect(() => {
    if (open && academicYear?.tahunAjaranName) {
      fetchSantri();
      fetchPembinaList();
    }
  }, [open, academicYear?.tahunAjaranName]);

  // Apply prefill data when drawer opens
  useEffect(() => {
    if (open && prefillData) {
      if (prefillData.santriId) setSantriId(prefillData.santriId);
      if (prefillData.juz) setJuz(prefillData.juz);
      if (prefillData.surah) setSurah(prefillData.surah);
      if (prefillData.ziyadahSubMode) {
        setTahfidzMode("ziyadah");
        setZiyadahSubMode(prefillData.ziyadahSubMode);
      }
    }
  }, [open, prefillData]);

  // Reset murojaah keterangan when mode changes
  useEffect(() => {
    if (tahfidzMode !== "murojaah") {
      setKeteranganMurojaah("");
    }
    // Reset tasmi fields when switching modes
    if (tahfidzMode !== "tasmi") {
      setSelectedPembinaId("");
      setIsAlAkhor(false);
      setPembinaExternal("");
    }
    // Reset ziyadah sub-mode when switching away from ziyadah
    if (tahfidzMode !== "ziyadah") {
      setZiyadahSubMode(null);
    }
  }, [tahfidzMode]);

  // Reset form when drawer closes
  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open]);
  const fetchSantri = async () => {
    if (!academicYear?.tahunAjaranName) return;
    try {
      const {
        data: kelasData
      } = await supabase.from("kelas").select("id").eq("status", "aktif").eq("tahun_ajaran", academicYear.tahunAjaranName);
      const kelasIds = kelasData?.map(k => k.id) || [];
      if (kelasIds.length === 0) {
        setSantriList([]);
        return;
      }
      const {
        data,
        error
      } = await supabase.from("santri").select(`
          id,
          nis,
          profiles (name),
          kelas (nama)
        `).in("kelas_id", kelasIds).order("nis");
      if (error) throw error;
      setSantriList(data || []);
    } catch (error) {
      console.error("Error fetching santri:", error);
      toast.error("Gagal memuat data santri");
    }
  };
  const fetchPembinaList = async () => {
    try {
      const {
        data: roleData,
        error: roleError
      } = await supabase.from("user_roles").select("user_id, role").in("role", ["guru", "walikelas", "Pembina", "admin"]);
      if (roleError) throw roleError;
      if (!roleData || roleData.length === 0) {
        setPembinaList([]);
        return;
      }
      const userIds = roleData.map(r => r.user_id);
      const roleMap = new Map(roleData.map(r => [r.user_id, r.role]));
      const {
        data: profileData,
        error: profileError
      } = await supabase.from("profiles").select("id, name").in("id", userIds).eq("status", "aktif");
      if (profileError) throw profileError;
      const pembinas: PembinaOption[] = (profileData || []).map(p => ({
        id: p.id,
        name: p.name,
        role: roleMap.get(p.id) || undefined
      }));
      setPembinaList(pembinas);
    } catch (error) {
      console.error("Error fetching pembina list:", error);
      setPembinaList([]);
    }
  };
  const resetForm = () => {
    setTahfidzMode(null);
    setZiyadahSubMode(null);
    setSantriId("");
    setJuz("");
    setSurah("");
    setSurahSearch("");
    setAyatAwal("");
    setAyatAkhir("");
    setKeteranganMurojaah("");
    setSelectedPembinaId("");
    setIsAlAkhor(false);
    setPembinaExternal("");
    setKeteranganTasmi("");
    setMateriTahsin("");
    setTajwid("");
    setMakhraj("");
    setKelancaran("");
    setStatus("");
    setRekamanMode("rekam");
    setLinkRekaman("");
    setAudioFile(null);
    setIsRecording(false);
    setRecordingTime(0);
    setAudioUrl(null);
    setCompletionResult(null);
    if (timerRef.current) clearInterval(timerRef.current);
  };
  const handleNumberInput = (value: string, setter: (val: string) => void) => {
    const num = parseInt(value);
    if (value === "" || num >= 0 && num <= 100) {
      setter(value);
    }
  };
  const uploadAudio = async (santriId: string): Promise<string | null> => {
    if (audioUrl && audioChunksRef.current.length > 0) {
      const audioBlob = new Blob(audioChunksRef.current, {
        type: "audio/webm"
      });
      const fileName = `${santriId}/${Date.now()}.webm`;
      const {
        data,
        error
      } = await supabase.storage.from("tahfidz-audio").upload(fileName, audioBlob, {
        contentType: "audio/webm",
        upsert: false
      });
      if (error) {
        console.error("Error uploading audio:", error);
        throw new Error("Gagal mengupload rekaman audio");
      }
      const {
        data: urlData
      } = supabase.storage.from("tahfidz-audio").getPublicUrl(data.path);
      return urlData.publicUrl;
    }
    if (audioFile) {
      const fileExt = audioFile.name.split(".").pop();
      const fileName = `${santriId}/${Date.now()}.${fileExt}`;
      const {
        data,
        error
      } = await supabase.storage.from("tahfidz-audio").upload(fileName, audioFile, {
        contentType: audioFile.type,
        upsert: false
      });
      if (error) {
        console.error("Error uploading audio file:", error);
        throw new Error("Gagal mengupload file audio");
      }
      const {
        data: urlData
      } = supabase.storage.from("tahfidz-audio").getPublicUrl(data.path);
      return urlData.publicUrl;
    }
    return null;
  };
  const handleSubmit = async () => {
    // Prevent double submission
    if (isSubmitting) return;
    
    // Validation - synchronous checks first
    if (!santriId) {
      toast.error("Pilih santri terlebih dahulu");
      return;
    }
    if (!user) {
      toast.error("Sesi login tidak valid. Silakan login ulang.");
      return;
    }
    if (initialTab === "tahfidz" && !tahfidzMode) {
      toast.error("Pilih mode terlebih dahulu");
      return;
    }

    // Ziyadah-specific synchronous validations
    if (initialTab === "tahfidz" && tahfidzMode === "ziyadah") {
      if (!ziyadahSubMode) {
        toast.error("Pilih jenis setoran terlebih dahulu");
        return;
      }
      if (!juz || !surah) {
        toast.error("Lengkapi data wilayah hafalan");
        return;
      }
      if (ziyadahSubMode === "setoran_harian") {
        if (!ayatAwal || !ayatAkhir) {
          toast.error("Masukkan ayat awal dan akhir");
          return;
        }
        const ayatAwalNum = parseInt(ayatAwal);
        const ayatAkhirNum = parseInt(ayatAkhir);
        if (ayatAwalNum > ayatAkhirNum) {
          toast.error("Ayat awal tidak boleh lebih besar dari ayat akhir");
          return;
        }
      }
      if (ziyadahSubMode === "finalisasi_surah") {
        if (!tajwid || !makhraj || !kelancaran) {
          toast.error("Lengkapi semua komponen penilaian untuk finalisasi");
          return;
        }
        if (rekamanMode === "link" && !linkRekaman) {
          toast.error("Masukkan link rekaman untuk finalisasi");
          return;
        }
        if (rekamanMode === "rekam" && !audioUrl && !audioFile) {
          toast.error("Rekam atau upload bukti audio untuk finalisasi");
          return;
        }
      }
    }

    // Tasmi validation
    if (initialTab === "tahfidz" && tahfidzMode === "tasmi") {
      if (!isAlAkhor && !selectedPembinaId) {
        toast.error("Pilih pembina terlebih dahulu");
        return;
      }
      if (isAlAkhor && !pembinaExternal.trim()) {
        toast.error("Masukkan nama pembina eksternal");
        return;
      }
      if (!keteranganTasmi.trim()) {
        toast.error("Masukkan keterangan tasmi");
        return;
      }
    }
    if (initialTab === "tahsin" && !materiTahsin) {
      toast.error("Masukkan materi tahsin");
      return;
    }

    // Penilaian validation - not required for murojaah and setoran_harian
    const isSetoranHarianLocal = initialTab === "tahfidz" && tahfidzMode === "ziyadah" && ziyadahSubMode === "setoran_harian";
    const isMurojaah = initialTab === "tahfidz" && tahfidzMode === "murojaah";
    if (!isSetoranHarianLocal && !isMurojaah && (!tajwid || !makhraj || !kelancaran)) {
      toast.error("Lengkapi semua komponen penilaian");
      return;
    }

    // Status validation - not required for setoran_harian
    if (!isSetoranHarianLocal && !status) {
      toast.error("Pilih status");
      return;
    }
    
    // Set submitting BEFORE async operations to prevent double-click
    setIsSubmitting(true);
    
    try {
      // Async validations inside try block
      if (initialTab === "tahfidz" && tahfidzMode === "ziyadah") {
        const surahData = selectedSurahMapping;
        const surahName = surahData?.surah_name_latin || "";
        const surahNumber = parseInt(surah);
        
        if (ziyadahSubMode === "setoran_harian") {
          const ayatAwalNum = parseInt(ayatAwal);
          const ayatAkhirNum = parseInt(ayatAkhir);
          
          // Check for overlap
          const overlapResult = await checkAyatOverlap(santriId, surahName, ayatAwalNum, ayatAkhirNum);
          if (overlapResult.hasOverlap) {
            toast.error(formatOverlapError(overlapResult.overlappingRanges));
            setIsSubmitting(false);
            return;
          }
        }
        
        if (ziyadahSubMode === "finalisasi_surah") {
          // Check if surah is complete before allowing finalization
          const finalizationCheck = await canFinalizeSurah(santriId, surahName, surahNumber);
          if (!finalizationCheck.allowed) {
            toast.error(finalizationCheck.message);
            setIsSubmitting(false);
            return;
          }
        }
      }
      
      // Upload audio if exists (not for setoran_harian)
      let audioStorageUrl: string | null = null;
      let audioType: "recording" | "link" | null = null;
      if (!isSetoranHarianLocal) {
        if (rekamanMode === "link" && linkRekaman) {
          audioStorageUrl = linkRekaman;
          audioType = "link";
        } else if (audioUrl || audioFile) {
          audioStorageUrl = await uploadAudio(santriId);
          audioType = "recording";
        }
      }

      // Prepare data for insertion
      const surahData = selectedSurahMapping;
      const surahName = tahfidzMode === "murojaah" || tahfidzMode === "tasmi" ? null : surahData?.surah_name_latin;

      // For finalisasi_surah, use full surah range
      const totalAyatSurah = surah ? getTotalAyatBySurahNumber(parseInt(surah)) : null;
      let finalAyatAwal: number | null = null;
      let finalAyatAkhir: number | null = null;
      if (tahfidzMode === "ziyadah") {
        if (ziyadahSubMode === "setoran_harian") {
          finalAyatAwal = parseInt(ayatAwal) || null;
          finalAyatAkhir = parseInt(ayatAkhir) || null;
        } else if (ziyadahSubMode === "finalisasi_surah") {
          finalAyatAwal = 1;
          finalAyatAkhir = totalAyatSurah;
        }
      }
      const pengujiId = tahfidzMode === "tasmi" && !isAlAkhor && selectedPembinaId ? selectedPembinaId : user.id;
      const insertData = {
        santri_id: santriId,
        penguji_id: pengujiId,
        tipe: initialTab,
        mode: initialTab === "tahfidz" ? tahfidzMode : null,
        juz: initialTab === "tahfidz" && tahfidzMode === "ziyadah" ? parseInt(juz) : null,
        surah: initialTab === "tahfidz" && tahfidzMode === "ziyadah" ? surahName : null,
        ayat_awal: finalAyatAwal,
        ayat_akhir: finalAyatAkhir,
        materi_tahsin: initialTab === "tahsin" ? materiTahsin : null,
        tajwid: isSetoranHarianLocal || isMurojaah ? null : parseInt(tajwid),
        makhraj: isSetoranHarianLocal || isMurojaah ? null : parseInt(makhraj),
        kelancaran: isSetoranHarianLocal || isMurojaah ? null : parseInt(kelancaran),
        nilai: isSetoranHarianLocal || isMurojaah ? null : nilaiAkhir,
        status: isSetoranHarianLocal ? "lanjut" : status,
        audio_url: isSetoranHarianLocal || isMurojaah ? null : audioStorageUrl,
        audio_type: isSetoranHarianLocal || isMurojaah ? null : audioType,
        tahun_ajaran_id: academicYear?.id || null,
        semester: academicYear?.semester || 'ganjil',
        pembina_external: tahfidzMode === "tasmi" && isAlAkhor ? pembinaExternal.trim() : null,
        catatan: tahfidzMode === "tasmi" ? keteranganTasmi.trim() : tahfidzMode === "murojaah" ? keteranganMurojaah.trim() || null : ziyadahSubMode === "finalisasi_surah" ? "Finalisasi Surah" : null,
        tanggal: getLocalDateString()
      };
      const {
        error
      } = await supabase.from("tahfidz_tahsin").insert(insertData as any);
      if (error) {
        console.error("Error inserting data:", error);
        throw new Error("Gagal menyimpan data");
      }

      // Check surah completion after setoran_harian
      if (isSetoranHarianLocal && surahName) {
        const surahNumber = parseInt(surah);
        const completionCheck = await checkSurahCompletion(santriId, surahName, surahNumber);
        if (completionCheck.isComplete) {
          const santriName = santriList.find(s => s.id === santriId)?.profiles?.name || "Santri";
          const finalizationData = {
            santriId,
            juz,
            surah,
            surahNumber
          };
          toast.success(
            `🎉 Alhamdulillah! Ananda ${santriName} telah melengkapi surah ${surahName}. Silakan lanjutkan ke finalisasi.`,
            { duration: 10000 }
          );
          // Set completion result for potential navigation
          setCompletionResult(completionCheck);
        } else {
          toast.success(`Data berhasil disimpan (${completionCheck.percentage}% selesai)`);
        }
      } else {
        toast.success("Data berhasil disimpan");
      }
      resetForm();
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error saving data:", error);
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan data");
    } finally {
      setIsSubmitting(false);
    }
  };
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true
      });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = event => {
        audioChunksRef.current.push(event.data);
      };
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/wav"
        });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      toast.error("Tidak dapat mengakses mikrofon");
    }
  };
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };
  const deleteRecording = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioUrl(null);
    setRecordingTime(0);
  };
  const statusOptions = useMemo(() => {
    if (initialTab === "tahsin") {
      return [{
        value: "lulus_halaman",
        label: "Lulus Halaman"
      }, {
        value: "ulang_halaman",
        label: "Ulang Halaman"
      }, {
        value: "naik_jilid",
        label: "Naik Jilid"
      }, {
        value: "lulus",
        label: "Lulus"
      }];
    }
    if (tahfidzMode === "ziyadah" && ziyadahSubMode === "finalisasi_surah") {
      return [{
        value: "lulus",
        label: "Lulus"
      }, {
        value: "tidak_lulus",
        label: "Tidak Lulus"
      }];
    }
    if (tahfidzMode === "tasmi") {
      return [{
        value: "lulus",
        label: "Lulus"
      }, {
        value: "tidak_lulus",
        label: "Tidak Lulus"
      }];
    }
    return [{
      value: "lancar",
      label: "Lancar"
    }, {
      value: "belum_lancar",
      label: "Belum Lancar"
    }];
  }, [initialTab, tahfidzMode, ziyadahSubMode]);

  // Determine which sections to show
  const isSetoranHarian = tahfidzMode === "ziyadah" && ziyadahSubMode === "setoran_harian";
  const isFinalisasiSurah = tahfidzMode === "ziyadah" && ziyadahSubMode === "finalisasi_surah";
  const showScoring = !isSetoranHarian && !(initialTab === "tahfidz" && tahfidzMode === "murojaah");
  const showStatus = !isSetoranHarian;
  const showRecording = !isSetoranHarian && !(initialTab === "tahfidz" && tahfidzMode === "murojaah");
  return (
    <>
      {/* Close Confirmation Dialog */}
      <AlertDialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
        <AlertDialogContent className="max-w-sm rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Data akan terhapus</AlertDialogTitle>
            <AlertDialogDescription>
              {isRecording ? "Rekaman masih berjalan. Jika Anda menutup drawer, rekaman akan dihentikan dan semua data akan terhapus." : "Anda memiliki data yang belum disimpan. Jika menutup drawer, data akan terhapus."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmClose} className="rounded-xl bg-destructive text-destructive-foreground">
              Tutup
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Drawer open={open} onOpenChange={handleOpenChange}>
        <DrawerContent className="max-h-[90vh] flex flex-col">
          <DrawerHeader className="border-b pb-4 flex-shrink-0">
            <div className="flex items-center gap-2">
              <DrawerTitle className="text-lg font-semibold">Tambah Perkembangan</DrawerTitle>
              {initialTab === "tahsin" ? <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400">
                  Tahsin
                </span> : tahfidzMode && <div className="flex items-center gap-1">
                  <span className={cn("px-2 py-0.5 text-xs font-medium rounded-full capitalize", tahfidzMode === "ziyadah" && "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400", tahfidzMode === "murojaah" && "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400", tahfidzMode === "tasmi" && "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400")}>
                    {tahfidzMode}
                  </span>
                  {tahfidzMode === "ziyadah" && ziyadahSubMode && <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-muted text-muted-foreground">
                      {ziyadahSubMode === "setoran_harian" ? "Harian" : "Finalisasi"}
                    </span>}
                </div>}
            </div>
          </DrawerHeader>
        
        <div 
          className="flex-1 overflow-y-auto overscroll-contain"
          style={{ touchAction: 'pan-y' }}
          onWheel={(e) => e.stopPropagation()}
        >
          <div className="space-y-6 px-4 py-4">
            {/* Mode Selection - Only for Tahfidz */}
            {initialTab === "tahfidz" && !tahfidzMode && <div className="space-y-3">
                <Label className="text-sm font-medium">Pilih Mode</Label>
                <div className="grid grid-cols-3 gap-2">
                  <button type="button" onClick={() => setTahfidzMode("ziyadah")} className={cn("flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all", "hover:border-primary hover:bg-primary/5", tahfidzMode === "ziyadah" ? "border-primary bg-primary/10" : "border-border")}>
                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-emerald-600" />
                    </div>
                    <span className="font-medium text-xs">Ziyadah</span>
                    <span className="text-[10px] text-muted-foreground text-center leading-tight">
                      Hafalan baru
                    </span>
                  </button>
                  
                  <button type="button" onClick={() => setTahfidzMode("murojaah")} className={cn("flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all", "hover:border-primary hover:bg-primary/5", tahfidzMode === "murojaah" ? "border-primary bg-primary/10" : "border-border")}>
                    <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                      <RefreshCw className="w-5 h-5 text-orange-600" />
                    </div>
                    <span className="font-medium text-xs">Murojaah</span>
                    <span className="text-[10px] text-muted-foreground text-center leading-tight">
                      Mengulang hafalan
                    </span>
                  </button>

                  <button type="button" onClick={() => setTahfidzMode("tasmi")} className={cn("flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all", "hover:border-primary hover:bg-primary/5", tahfidzMode === "tasmi" ? "border-primary bg-primary/10" : "border-border")}>
                    <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                      <Users className="w-5 h-5 text-purple-600" />
                    </div>
                    <span className="font-medium text-xs">Tasmi</span>
                    <span className="text-[10px] text-muted-foreground text-center leading-tight">
                      Simak Hafalan
                    </span>
                  </button>
                </div>
              </div>}

            {/* Ziyadah Sub-Mode Selection */}
            {initialTab === "tahfidz" && tahfidzMode === "ziyadah" && !ziyadahSubMode && <div className="space-y-3">
                <Label className="text-sm font-medium">Pilih Jenis Setoran</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setZiyadahSubMode("setoran_harian")} className={cn("flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all", "hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/20", ziyadahSubMode === "setoran_harian" ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20" : "border-border")}>
                    <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                      <CalendarCheck className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="text-center">
                      <span className="font-medium text-sm block">Setoran Blok</span>
                      <span className="text-[10px] text-muted-foreground leading-tight">
                        Input per blok ayat
                      </span>
                    </div>
                  </button>
                  
                  <button type="button" onClick={() => setZiyadahSubMode("finalisasi_surah")} className={cn("flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all", "hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/20", ziyadahSubMode === "finalisasi_surah" ? "border-amber-500 bg-amber-50 dark:bg-amber-950/20" : "border-border")}>
                    <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                      <FileCheck className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="text-center">
                      <span className="font-medium text-sm block">Finalisasi Surah</span>
                      <span className="text-[10px] text-muted-foreground leading-tight">
                        Validasi surah lengkap
                      </span>
                    </div>
                  </button>
                </div>
                
                <button type="button" onClick={() => setTahfidzMode(null)} className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2">
                  ← Kembali pilih mode
                </button>
              </div>}

            {/* Form Content - Show when mode is selected or for Tahsin */}
            {(initialTab === "tahsin" || tahfidzMode && (tahfidzMode !== "ziyadah" || ziyadahSubMode)) && <>
                {/* Pembina Selection - For Ziyadah, Murojaah & Tasmi mode */}
                {initialTab === "tahfidz" && (tahfidzMode === "ziyadah" || tahfidzMode === "murojaah" || tahfidzMode === "tasmi") && <PembinaSelector pembinaList={pembinaList} selectedPembinaId={selectedPembinaId} onPembinaIdChange={setSelectedPembinaId} isAlAkhor={isAlAkhor} onAlAkhorChange={setIsAlAkhor} pembinaExternal={pembinaExternal} onPembinaExternalChange={setPembinaExternal} />}

                {/* Santri Selection */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Pilih Santri</Label>
                  <Select value={santriId} onValueChange={setSantriId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih santri..." />
                    </SelectTrigger>
                    <SelectContent>
                      {santriList.map(santri => <SelectItem key={santri.id} value={santri.id}>
                          {santri.profiles?.name} - {santri.kelas?.nama || "Tanpa Kelas"}
                        </SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {/* Tahfidz Wilayah Input */}
                {initialTab === "tahfidz" && <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-4">
                    <Label className="text-sm font-semibold text-foreground">Wilayah Hafalan</Label>
                    
                    {/* Mode Murojaah - Input text keterangan */}
                    {tahfidzMode === "murojaah" ? <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Keterangan</Label>
                        <Input value={keteranganMurojaah} onChange={e => setKeteranganMurojaah(e.target.value)} placeholder="Masukkan keterangan murojaah..." />
                      </div> : tahfidzMode === "tasmi" ? (/* Mode Tasmi - Keterangan text field */
                <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Keterangan</Label>
                        <Input value={keteranganTasmi} onChange={e => setKeteranganTasmi(e.target.value)} placeholder="Masukkan keterangan tasmi..." />
                      </div>) : tahfidzMode === "ziyadah" ? (/* Mode Ziyadah - Sub-mode dependent */
                <>
                        {/* Juz */}
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Juz</Label>
                          <Select value={juz} onValueChange={setJuz}>
                            <SelectTrigger>
                              <SelectValue placeholder="Pilih Juz..." />
                            </SelectTrigger>
                            <SelectContent className="max-h-[200px] overflow-y-auto">
                              {Array.from({
                          length: 30
                        }, (_, i) => i + 1).map(num => <SelectItem key={num} value={num.toString()}>
                                  Juz {num}
                                </SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Surah with Search */}
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Surah</Label>
                          <Select value={surah} onValueChange={setSurah} disabled={!juz}>
                            <SelectTrigger>
                              <SelectValue placeholder={juz ? "Pilih Surah..." : "Pilih Juz dahulu..."} />
                            </SelectTrigger>
                            <SelectContent>
                              <div className="px-2 pb-2">
                                <Input placeholder="Cari surah..." value={surahSearch} onChange={e => setSurahSearch(e.target.value)} className="h-8" />
                              </div>
                              <ScrollArea className="h-[200px]">
                                {filteredSurahList.map(s => <SelectItem key={`${s.juz_number}-${s.surah_number}`} value={s.surah_number.toString()}>
                                    {s.surah_number}. {s.surah_name_latin} ({s.total_verses_in_surah} ayat)
                                  </SelectItem>)}
                              </ScrollArea>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Ayat Range - Only for setoran_harian */}
                        {ziyadahSubMode === "setoran_harian" && <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <Label className="text-xs text-muted-foreground">Ayat Awal</Label>
                              <Input type="number" min={verseRange?.start || 1} max={verseRange?.end || 286} value={ayatAwal} onChange={e => setAyatAwal(e.target.value)} placeholder={verseRange?.start.toString() || "1"} disabled={!surah} />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs text-muted-foreground">Ayat Akhir</Label>
                              <Input type="number" min={verseRange?.start || 1} max={verseRange?.end || 286} value={ayatAkhir} onChange={e => setAyatAkhir(e.target.value)} placeholder={verseRange?.end.toString() || "286"} disabled={!surah} />
                            </div>
                          </div>}

                        {/* Info for finalisasi_surah */}
                        {ziyadahSubMode === "finalisasi_surah" && selectedSurahMapping && <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                            <p className="text-xs text-amber-700 dark:text-amber-400">
                              <strong>Finalisasi:</strong> Mencakup Ayat 1 s.d. {selectedSurahMapping.total_verses_in_surah}
                            </p>
                          </div>}
                      </>) : null}
                  </div>}

                {/* Tahsin Materi Input */}
                {initialTab === "tahsin" && <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
                    <Label className="text-sm font-semibold text-foreground">Materi Tahsin</Label>
                    <Input value={materiTahsin} onChange={e => setMateriTahsin(e.target.value)} placeholder="Contoh: Jilid 1 Halaman 5" />
                  </div>}

                {/* Scoring Components - conditionally shown */}
                {showScoring && <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-semibold text-foreground">Komponen Penilaian</Label>
                      {isFinalisasiSurah && <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">Wajib</span>}
                    </div>
                    
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Tajwid</Label>
                        <Input type="number" min={0} max={100} value={tajwid} onChange={e => handleNumberInput(e.target.value, setTajwid)} placeholder="0-100" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Makhraj</Label>
                        <Input type="number" min={0} max={100} value={makhraj} onChange={e => handleNumberInput(e.target.value, setMakhraj)} placeholder="0-100" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Kelancaran</Label>
                        <Input type="number" min={0} max={100} value={kelancaran} onChange={e => handleNumberInput(e.target.value, setKelancaran)} placeholder="0-100" />
                      </div>
                    </div>

                    {/* Nilai Akhir */}
                    <div className="flex items-center justify-between p-3 bg-background/80 rounded-lg border border-border/30">
                      <div>
                        <Label className="text-xs text-muted-foreground">Nilai Akhir</Label>
                        <p className="text-2xl font-bold">{nilaiAkhir}</p>
                      </div>
                      {nilaiAkhir > 0 && <PredikatBadge predikat={getPredikatFromScore(nilaiAkhir)} />}
                    </div>
                  </div>}

                {/* Status - conditionally shown */}
                {showStatus && <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
                    <Label className="text-sm font-semibold text-foreground">Status</Label>
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih status..." />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>}

                {/* Recording Input - conditionally shown */}
                {showRecording && <div id="rekaman" className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold text-foreground">Bukti Rekaman</Label>
                    {isFinalisasiSurah ? <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">Wajib</span> : <span className="text-xs text-muted-foreground">Opsional</span>}
                  </div>
                  
                  {/* Toggle Mode - Checkbox Buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setRekamanMode("rekam")} className={`relative flex items-center gap-3 p-3 rounded-xl border-2 transition-all duration-200 ${rekamanMode === "rekam" ? "border-primary bg-primary/5" : "border-border bg-card hover:border-muted-foreground/50"}`}>
                      <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${rekamanMode === "rekam" ? "border-primary bg-primary" : "border-muted-foreground/30"}`}>
                        {rekamanMode === "rekam" && <Check className="h-3 w-3 text-primary-foreground" />}
                      </div>
                      <div className="flex items-center gap-2">
                        <Mic className={`h-4 w-4 ${rekamanMode === "rekam" ? "text-primary" : "text-muted-foreground"}`} />
                        <span className={`text-sm font-medium ${rekamanMode === "rekam" ? "text-foreground" : "text-muted-foreground"}`}>
                          Rekam
                        </span>
                      </div>
                    </button>
                    <button type="button" onClick={() => setRekamanMode("link")} className={`relative flex items-center gap-3 p-3 rounded-xl border-2 transition-all duration-200 ${rekamanMode === "link" ? "border-primary bg-primary/5" : "border-border bg-card hover:border-muted-foreground/50"}`}>
                      <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${rekamanMode === "link" ? "border-primary bg-primary" : "border-muted-foreground/30"}`}>
                        {rekamanMode === "link" && <Check className="h-3 w-3 text-primary-foreground" />}
                      </div>
                      <div className="flex items-center gap-2">
                        <Link2 className={`h-4 w-4 ${rekamanMode === "link" ? "text-primary" : "text-muted-foreground"}`} />
                        <span className={`text-sm font-medium ${rekamanMode === "link" ? "text-foreground" : "text-muted-foreground"}`}>
                          Link URL
                        </span>
                      </div>
                    </button>
                  </div>

                  {/* Recording Mode */}
                  {rekamanMode === "rekam" && <div className="overflow-hidden rounded-xl border border-border bg-gradient-to-br from-secondary/30 to-secondary/10">
                      {!audioUrl ? <div className="flex flex-col items-center gap-4 p-6">
                          {isRecording ? <>
                              <div className="relative">
                                <div className="absolute inset-0 rounded-full bg-destructive/20 animate-ping" />
                                <div className="relative h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
                                  <div className="h-12 w-12 rounded-full bg-destructive/20 flex items-center justify-center">
                                    <Mic className="h-6 w-6 text-destructive animate-pulse" />
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
                                <span className="text-2xl font-mono font-semibold tracking-wider text-foreground">
                                  {formatTime(recordingTime)}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground">Sedang merekam...</p>
                              <Button type="button" variant="destructive" onClick={stopRecording} className="gap-2 rounded-full px-6">
                                <Square className="h-4 w-4" />
                                Berhenti Rekam
                              </Button>
                            </> : <>
                              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                                <Mic className="h-7 w-7 text-primary" />
                              </div>
                              <div className="text-center space-y-1">
                                <p className="text-sm font-medium text-foreground">Rekam Hafalan</p>
                                <p className="text-xs text-muted-foreground">Ketuk tombol untuk mulai merekam suara</p>
                              </div>
                              <Button type="button" variant="secondary" onClick={startRecording} className="gap-2 rounded-full px-6 shadow-sm hover:shadow-md transition-all border-[1.5px] border-primary/30">
                                <Mic className="h-4 w-4" />
                                Mulai Rekam
                              </Button>
                            </>}
                        </div> : <div className="p-4 space-y-3">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <Play className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-foreground">Rekaman Selesai</p>
                              <p className="text-xs text-muted-foreground">Durasi: {formatTime(recordingTime)}</p>
                            </div>
                            <Button type="button" variant="ghost" size="icon" onClick={deleteRecording} className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <audio src={audioUrl} controls className="w-full h-10 rounded-lg" />
                        </div>}
                    </div>}

                  {/* Link Mode */}
                  {rekamanMode === "link" && <div className="rounded-xl border border-border bg-gradient-to-br from-secondary/30 to-secondary/10 p-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <Link2 className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">Link Google Drive</p>
                          <p className="text-xs text-muted-foreground">Masukkan URL rekaman suara hafalan</p>
                        </div>
                      </div>
                      <Input placeholder="https://drive.google.com/file/d/..." value={linkRekaman} onChange={e => setLinkRekaman(e.target.value)} className="h-11 rounded-xl bg-background" />
                    </div>}
                </div>}
              </>}
          </div>
        </div>

        <DrawerFooter className="border-t pt-4">
          <Button onClick={handleSubmit} disabled={isSubmitting || initialTab === "tahfidz" && (!tahfidzMode || tahfidzMode === "ziyadah" && !ziyadahSubMode)} className="w-full">
            {isSubmitting ? "Menyimpan..." : "Simpan Laporan"}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
    </>
  );
}