import * as React from "react";
import { useState, useEffect, useMemo } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from "@/components/ui/drawer";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { PredikatBadge, getPredikatFromScore } from "@/components/ui/predikat-badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BookOpen, RefreshCw, Mic, Link2, Play, Trash2, Check, Square, GraduationCap, Calendar, User, ExternalLink, Copy } from "lucide-react";
import { GoogleDriveLinkCard } from "./GoogleDriveLinkCard";
import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

// Surah list data
const SURAH_LIST = [{
  number: 1,
  name: "Al-Fatihah",
  ayatCount: 7
}, {
  number: 2,
  name: "Al-Baqarah",
  ayatCount: 286
}, {
  number: 3,
  name: "Ali 'Imran",
  ayatCount: 200
}, {
  number: 4,
  name: "An-Nisa'",
  ayatCount: 176
}, {
  number: 5,
  name: "Al-Ma'idah",
  ayatCount: 120
}, {
  number: 6,
  name: "Al-An'am",
  ayatCount: 165
}, {
  number: 7,
  name: "Al-A'raf",
  ayatCount: 206
}, {
  number: 8,
  name: "Al-Anfal",
  ayatCount: 75
}, {
  number: 9,
  name: "At-Taubah",
  ayatCount: 129
}, {
  number: 10,
  name: "Yunus",
  ayatCount: 109
}, {
  number: 11,
  name: "Hud",
  ayatCount: 123
}, {
  number: 12,
  name: "Yusuf",
  ayatCount: 111
}, {
  number: 13,
  name: "Ar-Ra'd",
  ayatCount: 43
}, {
  number: 14,
  name: "Ibrahim",
  ayatCount: 52
}, {
  number: 15,
  name: "Al-Hijr",
  ayatCount: 99
}, {
  number: 16,
  name: "An-Nahl",
  ayatCount: 128
}, {
  number: 17,
  name: "Al-Isra'",
  ayatCount: 111
}, {
  number: 18,
  name: "Al-Kahf",
  ayatCount: 110
}, {
  number: 19,
  name: "Maryam",
  ayatCount: 98
}, {
  number: 20,
  name: "Taha",
  ayatCount: 135
}, {
  number: 21,
  name: "Al-Anbiya'",
  ayatCount: 112
}, {
  number: 22,
  name: "Al-Hajj",
  ayatCount: 78
}, {
  number: 23,
  name: "Al-Mu'minun",
  ayatCount: 118
}, {
  number: 24,
  name: "An-Nur",
  ayatCount: 64
}, {
  number: 25,
  name: "Al-Furqan",
  ayatCount: 77
}, {
  number: 26,
  name: "Asy-Syu'ara'",
  ayatCount: 227
}, {
  number: 27,
  name: "An-Naml",
  ayatCount: 93
}, {
  number: 28,
  name: "Al-Qasas",
  ayatCount: 88
}, {
  number: 29,
  name: "Al-'Ankabut",
  ayatCount: 69
}, {
  number: 30,
  name: "Ar-Rum",
  ayatCount: 60
}, {
  number: 31,
  name: "Luqman",
  ayatCount: 34
}, {
  number: 32,
  name: "As-Sajdah",
  ayatCount: 30
}, {
  number: 33,
  name: "Al-Ahzab",
  ayatCount: 73
}, {
  number: 34,
  name: "Saba'",
  ayatCount: 54
}, {
  number: 35,
  name: "Fatir",
  ayatCount: 45
}, {
  number: 36,
  name: "Ya Sin",
  ayatCount: 83
}, {
  number: 37,
  name: "As-Saffat",
  ayatCount: 182
}, {
  number: 38,
  name: "Sad",
  ayatCount: 88
}, {
  number: 39,
  name: "Az-Zumar",
  ayatCount: 75
}, {
  number: 40,
  name: "Ghafir",
  ayatCount: 85
}, {
  number: 41,
  name: "Fussilat",
  ayatCount: 54
}, {
  number: 42,
  name: "Asy-Syura",
  ayatCount: 53
}, {
  number: 43,
  name: "Az-Zukhruf",
  ayatCount: 89
}, {
  number: 44,
  name: "Ad-Dukhan",
  ayatCount: 59
}, {
  number: 45,
  name: "Al-Jasiyah",
  ayatCount: 37
}, {
  number: 46,
  name: "Al-Ahqaf",
  ayatCount: 35
}, {
  number: 47,
  name: "Muhammad",
  ayatCount: 38
}, {
  number: 48,
  name: "Al-Fath",
  ayatCount: 29
}, {
  number: 49,
  name: "Al-Hujurat",
  ayatCount: 18
}, {
  number: 50,
  name: "Qaf",
  ayatCount: 45
}, {
  number: 51,
  name: "Az-Zariyat",
  ayatCount: 60
}, {
  number: 52,
  name: "At-Tur",
  ayatCount: 49
}, {
  number: 53,
  name: "An-Najm",
  ayatCount: 62
}, {
  number: 54,
  name: "Al-Qamar",
  ayatCount: 55
}, {
  number: 55,
  name: "Ar-Rahman",
  ayatCount: 78
}, {
  number: 56,
  name: "Al-Waqi'ah",
  ayatCount: 96
}, {
  number: 57,
  name: "Al-Hadid",
  ayatCount: 29
}, {
  number: 58,
  name: "Al-Mujadalah",
  ayatCount: 22
}, {
  number: 59,
  name: "Al-Hasyr",
  ayatCount: 24
}, {
  number: 60,
  name: "Al-Mumtahanah",
  ayatCount: 13
}, {
  number: 61,
  name: "As-Saff",
  ayatCount: 14
}, {
  number: 62,
  name: "Al-Jumu'ah",
  ayatCount: 11
}, {
  number: 63,
  name: "Al-Munafiqun",
  ayatCount: 11
}, {
  number: 64,
  name: "At-Tagabun",
  ayatCount: 18
}, {
  number: 65,
  name: "At-Talaq",
  ayatCount: 12
}, {
  number: 66,
  name: "At-Tahrim",
  ayatCount: 12
}, {
  number: 67,
  name: "Al-Mulk",
  ayatCount: 30
}, {
  number: 68,
  name: "Al-Qalam",
  ayatCount: 52
}, {
  number: 69,
  name: "Al-Haqqah",
  ayatCount: 52
}, {
  number: 70,
  name: "Al-Ma'arij",
  ayatCount: 44
}, {
  number: 71,
  name: "Nuh",
  ayatCount: 28
}, {
  number: 72,
  name: "Al-Jinn",
  ayatCount: 28
}, {
  number: 73,
  name: "Al-Muzzammil",
  ayatCount: 20
}, {
  number: 74,
  name: "Al-Muddassir",
  ayatCount: 56
}, {
  number: 75,
  name: "Al-Qiyamah",
  ayatCount: 40
}, {
  number: 76,
  name: "Al-Insan",
  ayatCount: 31
}, {
  number: 77,
  name: "Al-Mursalat",
  ayatCount: 50
}, {
  number: 78,
  name: "An-Naba'",
  ayatCount: 40
}, {
  number: 79,
  name: "An-Nazi'at",
  ayatCount: 46
}, {
  number: 80,
  name: "'Abasa",
  ayatCount: 42
}, {
  number: 81,
  name: "At-Takwir",
  ayatCount: 29
}, {
  number: 82,
  name: "Al-Infitar",
  ayatCount: 19
}, {
  number: 83,
  name: "Al-Mutaffifin",
  ayatCount: 36
}, {
  number: 84,
  name: "Al-Insyiqaq",
  ayatCount: 25
}, {
  number: 85,
  name: "Al-Buruj",
  ayatCount: 22
}, {
  number: 86,
  name: "At-Tariq",
  ayatCount: 17
}, {
  number: 87,
  name: "Al-A'la",
  ayatCount: 19
}, {
  number: 88,
  name: "Al-Gasyiyah",
  ayatCount: 26
}, {
  number: 89,
  name: "Al-Fajr",
  ayatCount: 30
}, {
  number: 90,
  name: "Al-Balad",
  ayatCount: 20
}, {
  number: 91,
  name: "Asy-Syams",
  ayatCount: 15
}, {
  number: 92,
  name: "Al-Lail",
  ayatCount: 21
}, {
  number: 93,
  name: "Ad-Duha",
  ayatCount: 11
}, {
  number: 94,
  name: "Asy-Syarh",
  ayatCount: 8
}, {
  number: 95,
  name: "At-Tin",
  ayatCount: 8
}, {
  number: 96,
  name: "Al-'Alaq",
  ayatCount: 19
}, {
  number: 97,
  name: "Al-Qadr",
  ayatCount: 5
}, {
  number: 98,
  name: "Al-Bayyinah",
  ayatCount: 8
}, {
  number: 99,
  name: "Az-Zalzalah",
  ayatCount: 8
}, {
  number: 100,
  name: "Al-'Adiyat",
  ayatCount: 11
}, {
  number: 101,
  name: "Al-Qari'ah",
  ayatCount: 11
}, {
  number: 102,
  name: "At-Takasur",
  ayatCount: 8
}, {
  number: 103,
  name: "Al-'Asr",
  ayatCount: 3
}, {
  number: 104,
  name: "Al-Humazah",
  ayatCount: 9
}, {
  number: 105,
  name: "Al-Fil",
  ayatCount: 5
}, {
  number: 106,
  name: "Quraisy",
  ayatCount: 4
}, {
  number: 107,
  name: "Al-Ma'un",
  ayatCount: 7
}, {
  number: 108,
  name: "Al-Kausar",
  ayatCount: 3
}, {
  number: 109,
  name: "Al-Kafirun",
  ayatCount: 6
}, {
  number: 110,
  name: "An-Nasr",
  ayatCount: 3
}, {
  number: 111,
  name: "Al-Lahab",
  ayatCount: 5
}, {
  number: 112,
  name: "Al-Ikhlas",
  ayatCount: 4
}, {
  number: 113,
  name: "Al-Falaq",
  ayatCount: 5
}, {
  number: 114,
  name: "An-Nas",
  ayatCount: 6
}];
type TahfidzMode = "ziyadah" | "murojaah" | "tasmi";
type DataType = "tahfidz" | "tahsin";
interface PerkembanganData {
  id: string;
  santri_id: string;
  santri_name?: string;
  santri_nis?: string;
  santri_kelas?: string;
  jenis_hafalan: string; // ziyadah, murojaah, tasmi, tahsin
  nama_materi: string;
  juz?: number | null;
  surah?: string | null;
  ayat_mulai?: number | null;
  ayat_akhir?: number | null;
  halaman?: number | null;
  nilai?: number | null;
  status: string;
  audio_url?: string | null;
  audio_type?: string | null;
  catatan?: string | null;
  tanggal_setor: string;
  penguji_id: string;
  penguji_name?: string;
  pembina_external?: string | null;
  // Komponen nilai
  tajwid?: number | null;
  makhraj?: number | null;
  kelancaran?: number | null;
}
interface DetailPerkembanganDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: PerkembanganData | null;
  onSuccess?: () => void;
  onDelete?: () => void;
  readOnly?: boolean;
}
export function DetailPerkembanganDrawer({
  open,
  onOpenChange,
  data,
  onSuccess,
  onDelete,
  readOnly = false,
}: DetailPerkembanganDrawerProps) {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Determine data type
  const dataType: DataType = data?.jenis_hafalan === "tahsin" ? "tahsin" : "tahfidz";
  const tahfidzMode: TahfidzMode | null = data?.jenis_hafalan === "ziyadah" ? "ziyadah" : data?.jenis_hafalan === "murojaah" ? "murojaah" : data?.jenis_hafalan === "tasmi" ? "tasmi" : null;
  
  // Detect if Ziyadah is "Setoran Harian" mode (no scoring/audio data)
  // Setoran Harian: nilai is null/0 AND no audio_url
  const isZiyadahHarian = tahfidzMode === "ziyadah" && !data?.nilai && !data?.audio_url;

  // Form state
  const [juz, setJuz] = useState("");
  const [surah, setSurah] = useState("");
  const [surahSearch, setSurahSearch] = useState("");
  const [ayatAwal, setAyatAwal] = useState("");
  const [ayatAkhir, setAyatAkhir] = useState("");
  const [fullSurah, setFullSurah] = useState(false);
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
  const [existingAudioUrl, setExistingAudioUrl] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const audioChunksRef = React.useRef<Blob[]>([]);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isEditingAudio, setIsEditingAudio] = useState(false);
  const [driveUploadedUrl, setDriveUploadedUrl] = useState<string | null>(null);
  const audioBlobRef = React.useRef<Blob | null>(null);

  // Populate form when data changes
  useEffect(() => {
    if (data && open) {
      // Tahfidz fields
      setJuz(data.juz?.toString() || "");
      setSurah(data.surah || "");
      setAyatAwal(data.ayat_mulai?.toString() || "");
      setAyatAkhir(data.ayat_akhir?.toString() || "");

      // Tahsin fields
      setMateriTahsin(data.nama_materi || "");

      // Check if full surah (ayat 1 to last)
      const surahData = SURAH_LIST.find(s => s.name === data.surah);
      if (data.ayat_mulai === 1 && surahData && data.ayat_akhir === surahData.ayatCount) {
        setFullSurah(true);
      } else {
        setFullSurah(false);
      }
      // Load individual score components from data
      // If individual scores exist, use them; otherwise fall back to nilai (for backwards compatibility)
      setTajwid(data.tajwid !== null && data.tajwid !== undefined ? data.tajwid.toString() : (data.nilai?.toString() || ""));
      setMakhraj(data.makhraj !== null && data.makhraj !== undefined ? data.makhraj.toString() : (data.nilai?.toString() || ""));
      setKelancaran(data.kelancaran !== null && data.kelancaran !== undefined ? data.kelancaran.toString() : (data.nilai?.toString() || ""));

      // Status
      setStatus(data.status);

      // Audio
      if (data.audio_url) {
        setExistingAudioUrl(data.audio_url);
        if (data.audio_type === "link") {
          setRekamanMode("link");
          setLinkRekaman(data.audio_url);
        } else {
          setRekamanMode("rekam");
        }
      }
      setHasChanges(false);
      setIsEditingAudio(false);
    }
  }, [data, open]);

  // Track changes
  useEffect(() => {
    if (data && open) {
      const nilaiValue = data.nilai || 0;
      const changed = juz !== (data.juz?.toString() || "") || surah !== (data.surah || "") || ayatAwal !== (data.ayat_mulai?.toString() || "") || ayatAkhir !== (data.ayat_akhir?.toString() || "") || materiTahsin !== (data.nama_materi || "") || tajwid !== nilaiValue.toString() || makhraj !== nilaiValue.toString() || kelancaran !== nilaiValue.toString() || status !== data.status || audioUrl !== null || rekamanMode === "link" && linkRekaman !== (data.audio_url || "");
      setHasChanges(changed);
    }
  }, [data, juz, surah, ayatAwal, ayatAkhir, materiTahsin, tajwid, makhraj, kelancaran, status, audioUrl, linkRekaman, rekamanMode, open]);

  // Calculate nilai akhir
  const nilaiAkhir = useMemo(() => {
    const t = parseFloat(tajwid) || 0;
    const m = parseFloat(makhraj) || 0;
    const k = parseFloat(kelancaran) || 0;
    if (!tajwid && !makhraj && !kelancaran) return 0;
    return Math.round((t + m + k) / 3);
  }, [tajwid, makhraj, kelancaran]);

  // Get selected surah data
  const selectedSurah = useMemo(() => {
    return SURAH_LIST.find(s => s.name === surah || s.number.toString() === surah);
  }, [surah]);

  // Filter surah list
  const filteredSurahList = useMemo(() => {
    if (!surahSearch) return SURAH_LIST;
    return SURAH_LIST.filter(s => s.name.toLowerCase().includes(surahSearch.toLowerCase()) || s.number.toString().includes(surahSearch));
  }, [surahSearch]);
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && !readOnly && (hasChanges || isRecording)) {
      setShowCloseConfirm(true);
    } else {
      onOpenChange(newOpen);
    }
  };
  const handleConfirmClose = () => {
    if (isRecording) {
      stopRecording();
    }
    setShowCloseConfirm(false);
    onOpenChange(false);
  };
  const handleNumberInput = (value: string, setter: (val: string) => void) => {
    const num = parseInt(value);
    if (value === "" || num >= 0 && num <= 100) {
      setter(value);
    }
  };
  const handleSubmit = async () => {
    if (!data) return;

    // Validation - skip wilayah hafalan for tasmi mode
    if (dataType === "tahfidz" && tahfidzMode !== "tasmi" && (!juz || !surah)) {
      toast.error("Lengkapi data wilayah hafalan");
      return;
    }
    if (dataType === "tahsin" && !materiTahsin) {
      toast.error("Masukkan materi tahsin");
      return;
    }
    if (!tajwid || !makhraj || !kelancaran) {
      toast.error("Lengkapi semua komponen penilaian");
      return;
    }
    if (!status) {
      toast.error("Pilih status");
      return;
    }
    setIsSubmitting(true);
    try {
      // Auto-upload recording if exists and not yet uploaded
      if (audioBlobRef.current && !driveUploadedUrl) {
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) {
          toast.error("Silakan login terlebih dahulu");
          setIsSubmitting(false);
          return;
        }

        // Convert blob to base64
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as string;
            const base64 = result.split(",")[1];
            resolve(base64);
          };
          reader.onerror = reject;
        });
        reader.readAsDataURL(audioBlobRef.current);
        const audioBase64 = await base64Promise;

        const uploadPayload = {
          audioBase64,
          fileName: `rekaman_${data.santri_name || "santri"}_${data.nama_materi || "audio"}.webm`,
          mimeType: "audio/webm",
          santriName: data.santri_name,
          materi: data.nama_materi || data.surah || "hafalan",
        };

        let uploadedUrl: string | null = null;

        try {
          const { data: fnData, error: fnError } = await supabase.functions.invoke("upload-to-drive", {
            body: uploadPayload,
            headers: {
              Authorization: `Bearer ${sessionData.session.access_token}`,
            },
          });

          if (fnError) throw fnError;

          uploadedUrl = (fnData as any)?.url ?? null;
          if (!uploadedUrl) throw new Error("Upload rekaman gagal");
        } catch (error) {
          const userId = sessionData.session.user.id;
          const storagePath = `${userId}/rekaman/${data.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.webm`;

          const { error: storageError } = await supabase.storage
            .from("user-documents")
            .upload(storagePath, audioBlobRef.current, { contentType: "audio/webm", upsert: false });

          if (storageError) throw error;

          const { data: publicUrlData } = supabase.storage.from("user-documents").getPublicUrl(storagePath);
          uploadedUrl = publicUrlData.publicUrl;
        }

        if (!uploadedUrl) throw new Error("Upload rekaman gagal");

        setDriveUploadedUrl(uploadedUrl);
        setLinkRekaman(uploadedUrl);
      }

      // Prepare update data
      // surah state can be either surah name OR surah number (depending on how it was set)
      // Try to find by number first, then by name
      const selectedSurahData = SURAH_LIST.find(s => s.number.toString() === surah) || SURAH_LIST.find(s => s.name === surah);
      const surahName = selectedSurahData?.name || null;
      
      // Check if this is a "Setoran Harian" record (Ziyadah with nilai === null)
      // Setoran Harian should NEVER have nilai updated to preserve the badge
      const isSetoranHarianRecord = data.jenis_hafalan === "ziyadah" && data.nilai === null;
      
      // Calculate final nilai (only for non-Setoran Harian)
      const tajwidNum = parseInt(tajwid) || 0;
      const makhrajNum = parseInt(makhraj) || 0;
      const kelancaranNum = parseInt(kelancaran) || 0;
      const nilaiAkhir = isSetoranHarianRecord ? null : Math.round((tajwidNum + makhrajNum + kelancaranNum) / 3);
      
      // Prepare audio data
      let audioUrlToSave: string | null = null;
      let audioTypeToSave: string | null = null;
      
      if (rekamanMode === "link" && linkRekaman) {
        audioUrlToSave = linkRekaman;
        audioTypeToSave = "link";
      } else if (driveUploadedUrl) {
        audioUrlToSave = driveUploadedUrl;
        audioTypeToSave = "recording";
      } else if (existingAudioUrl && !isEditingAudio) {
        audioUrlToSave = existingAudioUrl;
        audioTypeToSave = data.audio_type || "recording";
      }
      
      // Build update object based on data type
      const updateData: Record<string, unknown> = {
        status: status,
        audio_url: audioUrlToSave,
        audio_type: audioTypeToSave,
      };
      
      // Only update scoring fields for non-Setoran Harian records
      if (!isSetoranHarianRecord) {
        updateData.tajwid = tajwidNum;
        updateData.makhraj = makhrajNum;
        updateData.kelancaran = kelancaranNum;
        updateData.nilai = nilaiAkhir;
      }
      
      // Add type-specific fields
      if (dataType === "tahsin") {
        updateData.materi_tahsin = materiTahsin;
      } else if (tahfidzMode === "ziyadah") {
        updateData.juz = parseInt(juz) || null;
        updateData.surah = surahName;
        updateData.ayat_awal = parseInt(ayatAwal) || null;
        updateData.ayat_akhir = parseInt(ayatAkhir) || null;
      }
      
      // Update to database
      const { error: updateError } = await supabase
        .from("tahfidz_tahsin")
        .update(updateData)
        .eq("id", data.id);
      
      if (updateError) {
        console.error("Error updating data:", updateError);
        throw new Error("Gagal memperbarui data ke database");
      }
      
      toast.success("Data berhasil diperbarui");
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error updating data:", error);
      toast.error(error instanceof Error ? error.message : "Gagal memperbarui data");
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
          type: "audio/webm"
        });
        audioBlobRef.current = audioBlob;
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        setDriveUploadedUrl(null);
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
    setDriveUploadedUrl(null);
    audioBlobRef.current = null;
  };


  const statusOptions = useMemo(() => {
    if (dataType === "tahsin") {
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
    if (tahfidzMode === "ziyadah") {
      return [{
        value: "lanjut",
        label: "Lanjut"
      }, {
        value: "ulang",
        label: "Ulang"
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
  }, [dataType, tahfidzMode]);
  const getModeLabel = () => {
    if (dataType === "tahsin") return "Tahsin";
    if (tahfidzMode === "ziyadah") return "Ziyadah";
    if (tahfidzMode === "tasmi") return "Tasmi";
    return "Murojaah";
  };
  const getModeColor = () => {
    if (dataType === "tahsin") return "bg-blue-100 text-blue-700";
    if (tahfidzMode === "ziyadah") return "bg-emerald-100 text-emerald-700";
    if (tahfidzMode === "tasmi") return "bg-purple-100 text-purple-700";
    return "bg-orange-100 text-orange-700";
  };
  const getModeIcon = () => {
    if (dataType === "tahsin") return <GraduationCap className="h-4 w-4" />;
    if (tahfidzMode === "ziyadah") return <BookOpen className="h-4 w-4" />;
    if (tahfidzMode === "tasmi") return <Mic className="h-4 w-4" />;
    return <RefreshCw className="h-4 w-4" />;
  };
  if (!data) return null;
  return <>
      <AlertDialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
        <AlertDialogContent className="max-w-sm rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Perubahan belum disimpan</AlertDialogTitle>
            <AlertDialogDescription>
              {isRecording ? "Rekaman masih berjalan. Jika Anda menutup drawer, rekaman akan dihentikan dan perubahan akan hilang." : "Anda memiliki perubahan yang belum disimpan. Jika menutup drawer, perubahan akan hilang."}
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
            <div className="flex items-center justify-between">
              <DrawerTitle className="text-lg font-semibold">
                Detail {dataType === "tahfidz" ? "Tahfidz" : "Tahsin"}
              </DrawerTitle>
              <Badge className={cn("border-0 px-3 sm:px-4 py-1 sm:py-1.5 text-[13px] sm:text-sm font-medium shrink-0 gap-1", getModeColor())}>
                {getModeIcon()}
                {getModeLabel()}
              </Badge>
            </div>
          </DrawerHeader>
        
          <div 
            className="flex-1 overflow-y-auto overscroll-contain"
            style={{ touchAction: 'pan-y' }}
            onWheel={(e) => e.stopPropagation()}
          >
            <div className="space-y-6 px-4 py-4">
              {/* Info Card */}
              <div className="rounded-xl sm:rounded-2xl border border-border/50 bg-card overflow-hidden">
                {/* Top Row: Avatar + Name + Badge */}
                <div 
                  className="flex items-center justify-between p-3 sm:p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => {
                    const from = location.pathname + location.search;
                    const isAdmin = location.pathname.startsWith("/admin");
                    onOpenChange(false);
                    navigate(`${isAdmin ? "/admin" : "/app"}/santri/${data.santri_id}`, { state: { from } });
                  }}
                >
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                    <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <User className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-foreground truncate text-[15px] sm:text-base">
                        {data.santri_name || "Santri"}
                      </h3>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1.5"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Detail</span>
                  </Button>
                </div>

                {/* Divider */}
                <div className="border-t border-border/50" />

                {/* Bottom Row: Info items */}
                <div className="flex items-stretch">
                  <div className="flex-1 min-w-0 p-3 sm:p-4 border-r border-border/30">
                    <p className="text-[10px] sm:text-xs text-muted-foreground mb-0.5">Tanggal</p>
                    <p className="font-semibold text-foreground text-[11px] sm:text-sm whitespace-nowrap">
                      {format(new Date(data.tanggal_setor), "dd MMM yyyy", {
                      locale: localeId
                    })}
                    </p>
                  </div>
                  <div className="flex-1 min-w-0 p-3 sm:p-4 border-r border-border/30">
                    <p className="text-[10px] sm:text-xs text-muted-foreground mb-0.5">Kelas</p>
                    <p className="font-semibold text-foreground text-[11px] sm:text-sm whitespace-nowrap">
                      {data.santri_kelas || "-"}
                    </p>
                  </div>
                  <div className="flex-1 min-w-0 p-3 sm:p-4">
                    <p className="text-[10px] sm:text-xs text-muted-foreground mb-0.5">Pembina</p>
                    <p className="font-semibold text-foreground text-[11px] sm:text-sm truncate">
                      {data.pembina_external || data.penguji_name || "-"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Tahfidz Wilayah Input - only for ziyadah */}
              <div className={cn(readOnly && "pointer-events-none opacity-60")}>
              {dataType === "tahfidz" && tahfidzMode === "ziyadah" && <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-4">
                  <Label className="text-sm font-semibold text-foreground">Wilayah Hafalan</Label>
                  
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Juz</Label>
                    <Select value={juz} onValueChange={setJuz}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih Juz..." />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({
                      length: 30
                    }, (_, i) => i + 1).map(num => <SelectItem key={num} value={num.toString()}>
                            Juz {num}
                          </SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Surah</Label>
                    <Select value={surah} onValueChange={setSurah}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih Surah..." />
                      </SelectTrigger>
                      <SelectContent>
                        <div className="px-2 pb-2">
                          <Input placeholder="Cari surah..." value={surahSearch} onChange={e => setSurahSearch(e.target.value)} className="h-8" />
                        </div>
                        <ScrollArea className="h-[200px]">
                          {filteredSurahList.map(s => <SelectItem key={s.number} value={s.name}>
                              {s.number}. {s.name} ({s.ayatCount} ayat)
                            </SelectItem>)}
                        </ScrollArea>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Ayat Awal</Label>
                        <Input type="number" min={1} max={selectedSurah?.ayatCount || 286} value={ayatAwal} onChange={e => setAyatAwal(e.target.value)} placeholder="1" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Ayat Akhir</Label>
                        <Input type="number" min={1} max={selectedSurah?.ayatCount || 286} value={ayatAkhir} onChange={e => setAyatAkhir(e.target.value)} placeholder={selectedSurah?.ayatCount.toString() || "286"} />
                      </div>
                    </div>
                </div>}

              {/* Murojaah - Keterangan & Status */}
              {dataType === "tahfidz" && tahfidzMode === "murojaah" && (
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-4">
                  <Label className="text-sm font-semibold text-foreground">Detail Murojaah</Label>

                  {/* Keterangan */}
                  {data.catatan && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Catatan</Label>
                      <div className="p-2.5 bg-background rounded-lg border text-sm min-h-[40px]">
                        {data.catatan}
                      </div>
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih status..." />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Tasmi Info - read only display */}
              {dataType === "tahfidz" && tahfidzMode === "tasmi" && <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 space-y-4">
                  <Label className="text-sm font-semibold text-foreground">Informasi Tasmi</Label>
                  
                  {/* Pembina */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Pembina</Label>
                    <div className="p-2.5 bg-background rounded-lg border text-sm">
                      {data.pembina_external || data.penguji_name || "-"}
                    </div>
                  </div>

                  {/* Keterangan */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Keterangan</Label>
                    <div className="p-2.5 bg-background rounded-lg border text-sm min-h-[60px]">
                      {data.catatan || "-"}
                    </div>
                  </div>
                </div>}

              {/* Tahsin Materi Input */}
              {dataType === "tahsin" && <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
                  <Label className="text-sm font-semibold text-foreground">Materi Tahsin</Label>
                  <Input value={materiTahsin} onChange={e => setMateriTahsin(e.target.value)} placeholder="Contoh: Jilid 1 Halaman 5" />
                </div>}

              {/* Scoring Components - tidak ditampilkan untuk mode murojaah dan ziyadah harian */}
              {!(dataType === "tahfidz" && (tahfidzMode === "murojaah" || isZiyadahHarian)) && <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-4">
                <Label className="text-sm font-semibold text-foreground">Komponen Penilaian</Label>
                
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

                <div className="flex items-center justify-between p-3 bg-background/80 rounded-lg border border-border/50">
                  <div>
                    <Label className="text-xs text-muted-foreground">Nilai Akhir</Label>
                    <p className="text-2xl font-bold">{nilaiAkhir}</p>
                  </div>
                  {nilaiAkhir > 0 && <PredikatBadge predikat={getPredikatFromScore(nilaiAkhir)} />}
                </div>
              </div>}

              {/* Status - tidak ditampilkan untuk mode murojaah dan ziyadah harian (sudah di section atas) */}
              {!(dataType === "tahfidz" && (tahfidzMode === "murojaah" || isZiyadahHarian)) && (
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
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
                </div>
              )}

              {/* Recording Input - tidak ditampilkan untuk mode murojaah dan ziyadah harian */}
              {!(dataType === "tahfidz" && (tahfidzMode === "murojaah" || isZiyadahHarian)) && <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold text-foreground">Bukti Rekaman</Label>
                  {tahfidzMode === "ziyadah" && !isEditingAudio && (
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setIsEditingAudio(true)}
                      className="h-7 px-2.5 text-xs gap-1"
                    >
                      <Mic className="h-3 w-3" />
                      Edit
                    </Button>
                  )}
                  {tahfidzMode === "ziyadah" && isEditingAudio && (
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setIsEditingAudio(false)}
                      className="h-7 px-2.5 text-xs text-muted-foreground"
                    >
                      Batal
                    </Button>
                  )}
                </div>
                
                {/* Existing Audio Display */}
                {existingAudioUrl && !audioUrl && rekamanMode === "rekam" && (
                  <div className="overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/5">
                    <div className="flex items-center gap-3 p-3 border-b border-primary/10 bg-primary/5">
                      <div className="relative">
                        <div className="absolute inset-0 rounded-full bg-primary/20 animate-pulse" />
                        <div className="relative h-10 w-10 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20">
                          <Play className="h-4 w-4 text-primary-foreground ml-0.5" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">Rekaman Tersimpan</p>
                        <p className="text-xs text-muted-foreground">Audio sebelumnya tersedia</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-primary/10 border border-primary/20">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                          <span className="text-[10px] font-medium text-primary uppercase tracking-wider">Ready</span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setExistingAudioUrl(null);
                            setHasChanges(true);
                          }}
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="p-3">
                      <audio 
                        src={existingAudioUrl} 
                        controls 
                        className="w-full h-10 rounded-lg [&::-webkit-media-controls-panel]:bg-muted/50 [&::-webkit-media-controls-panel]:rounded-lg" 
                      />
                    </div>
                  </div>
                )}

                {/* Show existing link if in link mode and not editing (for ziyadah) */}
                {tahfidzMode === "ziyadah" && !isEditingAudio && existingAudioUrl && rekamanMode === "link" && (
                  <GoogleDriveLinkCard
                    url={existingAudioUrl}
                    onUrlChange={() => {}}
                    onDelete={() => {
                      setExistingAudioUrl(null);
                      setLinkRekaman("");
                      setHasChanges(true);
                    }}
                    isEditing={false}
                    showInput={false}
                  />
                )}

                {/* No audio message for ziyadah when not editing */}
                {tahfidzMode === "ziyadah" && !isEditingAudio && !existingAudioUrl && !audioUrl && (
                  <div className="p-4 rounded-xl border border-dashed border-border bg-muted/20 text-center">
                    <p className="text-sm text-muted-foreground">Belum ada rekaman</p>
                    <p className="text-xs text-muted-foreground mt-1">Klik tombol Edit untuk menambahkan</p>
                  </div>
                )}
                
                {/* Toggle Mode - hidden for ziyadah unless editing */}
                {(tahfidzMode !== "ziyadah" || isEditingAudio) && (
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setRekamanMode("rekam")} className={cn("relative flex items-center gap-3 p-3 rounded-xl border-2 transition-all duration-200", rekamanMode === "rekam" ? "border-primary bg-primary/5" : "border-border bg-card hover:border-muted-foreground/50")}>
                      <div className={cn("h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all duration-200", rekamanMode === "rekam" ? "border-primary bg-primary" : "border-muted-foreground/30")}>
                        {rekamanMode === "rekam" && <Check className="h-3 w-3 text-primary-foreground" />}
                      </div>
                      <div className="flex items-center gap-2">
                        <Mic className={cn("h-4 w-4", rekamanMode === "rekam" ? "text-primary" : "text-muted-foreground")} />
                        <span className={cn("text-sm font-medium", rekamanMode === "rekam" ? "text-foreground" : "text-muted-foreground")}>
                          Rekam
                        </span>
                      </div>
                    </button>
                    <button type="button" onClick={() => setRekamanMode("link")} className={cn("relative flex items-center gap-3 p-3 rounded-xl border-2 transition-all duration-200", rekamanMode === "link" ? "border-primary bg-primary/5" : "border-border bg-card hover:border-muted-foreground/50")}>
                      <div className={cn("h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all duration-200", rekamanMode === "link" ? "border-primary bg-primary" : "border-muted-foreground/30")}>
                        {rekamanMode === "link" && <Check className="h-3 w-3 text-primary-foreground" />}
                      </div>
                      <div className="flex items-center gap-2">
                        <Link2 className={cn("h-4 w-4", rekamanMode === "link" ? "text-primary" : "text-muted-foreground")} />
                        <span className={cn("text-sm font-medium", rekamanMode === "link" ? "text-foreground" : "text-muted-foreground")}>
                          Link URL
                        </span>
                      </div>
                    </button>
                  </div>
                )}

                {/* Recording Mode - hidden for ziyadah unless editing */}
                {(tahfidzMode !== "ziyadah" || isEditingAudio) && rekamanMode === "rekam" && <div className="overflow-hidden rounded-xl border border-border bg-gradient-to-br from-secondary/30 to-secondary/10">
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
                              <p className="text-sm font-medium text-foreground">Rekam Baru</p>
                              <p className="text-xs text-muted-foreground">Ketuk tombol untuk merekam ulang</p>
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
                            <p className="text-sm font-medium text-foreground">Rekaman Baru</p>
                            <p className="text-xs text-muted-foreground">Durasi: {formatTime(recordingTime)}</p>
                          </div>
                          <Button type="button" variant="ghost" size="icon" onClick={deleteRecording} className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <audio src={audioUrl} controls className="w-full h-10" />
                        
                        {/* Auto-upload info */}
                        <div className="rounded-lg border border-muted bg-muted/30 p-2.5">
                          <p className="text-xs text-muted-foreground text-center">
                            Rekaman akan otomatis diupload saat menyimpan
                          </p>
                        </div>
                      </div>}
                  </div>}

                {/* Link Mode - hidden for ziyadah unless editing */}
                {(tahfidzMode !== "ziyadah" || isEditingAudio) && rekamanMode === "link" && (
                  <GoogleDriveLinkCard
                    url={linkRekaman}
                    onUrlChange={(value) => {
                      setLinkRekaman(value);
                      setHasChanges(true);
                    }}
                    isEditing={true}
                    showInput={true}
                    placeholder="Masukkan link Google Drive atau URL audio..."
                  />
                )}
              </div>}
              </div>
            </div>
          </div>

          {!readOnly && (onDelete || hasChanges) && (
            <DrawerFooter className="border-t pt-4 flex-shrink-0">
              <div className="flex gap-2 w-full">
                {onDelete && (
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      onOpenChange(false);
                      onDelete();
                    }}
                    className="flex-1 sm:flex-none text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Hapus
                  </Button>
                )}
                {hasChanges && (
                  <Button onClick={handleSubmit} disabled={isSubmitting} className="flex-1">
                    {isSubmitting ? "Menyimpan..." : "Simpan Perubahan"}
                  </Button>
                )}
              </div>
            </DrawerFooter>
          )}
        </DrawerContent>
      </Drawer>
    </>;
}
