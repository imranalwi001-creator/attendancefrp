import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Camera, X, Check, RefreshCw, Square, ClipboardList, ChevronRight, BookOpen } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ContentCard, ContentCardHeader, ContentCardTitle, ContentCardBody } from '@/components/ui/content-card';

interface AkhiriPembelajaranModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sesi: {
    id: string;
    jadwal_id: string;
    foto_guru_url?: string | null;
    metadata?: { materi_id?: string } | null;
  } | null;
  jadwalInfo?: {
    mapelNama?: string;
    kelasNama?: string;
    jamMulai?: string;
    jamSelesai?: string;
    mapelId?: string;
  };
  onSuccess?: () => void;
}

interface TujuanPembelajaran {
  id?: number;
  text: string;
  fromPreviousSession?: boolean;
}

interface CapaianBelajarForm {
  tujuanTercapaiIds: number[];
  buktiCapaian: string;
  keaktifanSiswa: string;
  adaKendala: 'tidak' | 'ada' | '';
  keteranganKendala: string;
  tindakLanjut: string;
  tindakLanjutLainnya: string;
}

type Step = 'camera' | 'capaian';

export function AkhiriPembelajaranModal({ 
  open, 
  onOpenChange, 
  sesi, 
  jadwalInfo,
  onSuccess 
}: AkhiriPembelajaranModalProps) {
  const [step, setStep] = useState<Step>('camera');
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingStream, setPendingStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const queryClient = useQueryClient();

  const [showAllTP, setShowAllTP] = useState(false);

  // Form state for Capaian Belajar
  const [formData, setFormData] = useState<CapaianBelajarForm>({
    tujuanTercapaiIds: [],
    buktiCapaian: '',
    keaktifanSiswa: '',
    adaKendala: '',
    keteranganKendala: '',
    tindakLanjut: '',
    tindakLanjutLainnya: '',
  });

  // Always re-fetch sesi metadata to ensure it matches what was saved in "Mulai Pembelajaran"
  const { data: sesiMetadata } = useQuery({
    queryKey: ['sesi-metadata', sesi?.id],
    queryFn: async () => {
      if (!sesi?.id) return null;
      const { data, error } = await supabase
        .from('sesi_pembelajaran')
        .select('metadata')
        .eq('id', sesi.id)
        .maybeSingle();
      if (error) return null;
      return (data?.metadata as any) ?? null;
    },
    enabled: !!sesi?.id && open,
  });

  // Get materi_id from session metadata (prefer latest from DB)
  const materiId = (sesiMetadata?.materi_id ?? (sesi?.metadata as any)?.materi_id) as string | undefined;
  const mapelId = jadwalInfo?.mapelId;

  // Fetch materi data
  const { data: materiData } = useQuery({
    queryKey: ['materi-detail', materiId],
    queryFn: async () => {
      if (!materiId) return null;
      const { data, error } = await supabase
        .from('materi')
        .select('judul, deskripsi')
        .eq('id', materiId)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!materiId && open,
  });

  // Fetch tujuan pembelajaran from materi (only the TP indices selected in materi)
  const { data: currentMateriTPList = [], isLoading: isLoadingTP } = useQuery({
    queryKey: ['tujuan-pembelajaran-materi', materiId],
    queryFn: async () => {
      if (!materiId) return [];

      // Get materi with tujuan_pembelajaran_ids
      const { data: materi, error: materiError } = await supabase
        .from('materi')
        .select('tujuan_pembelajaran_ids, mapel_id')
        .eq('id', materiId)
        .single();

      if (materiError || !materi) return [];

      const tpIds = (materi.tujuan_pembelajaran_ids || [])
        .map((v: any) => Number(v))
        .filter((n: number) => Number.isFinite(n));

      // If materi doesn't select any TP, don't show all mapel TP
      if (tpIds.length === 0) return [];

      // Get mapel_info for this mapel
      const { data: mapelInfo, error: mapelInfoError } = await supabase
        .from('mapel_info')
        .select('tujuan_pembelajaran')
        .eq('mapel_id', materi.mapel_id)
        .maybeSingle();

      if (mapelInfoError || !mapelInfo) return [];

      const rawTp = (mapelInfo.tujuan_pembelajaran || []) as unknown as Array<string | TujuanPembelajaran>;

      // Normalize: some records store TP as string[] and some as { text }[]
      const allTp = rawTp.map((tp, index) => {
        if (typeof tp === 'string') {
          return { id: index, text: tp };
        }
        return {
          id: tp.id !== undefined ? Number(tp.id) : index,
          text: tp.text,
        };
      });

      return allTp.filter((tp) => tp.id !== undefined && tpIds.includes(tp.id));
    },
    enabled: !!materiId && open,
  });

  // Fetch TP yang belum tercapai dari sesi-sesi sebelumnya berdasarkan materi yang dipilih
  const { data: unachievedTPList = [] } = useQuery({
    queryKey: ['unachieved-tp-from-sessions', mapelId, sesi?.id],
    queryFn: async () => {
      if (!mapelId) return [];
      
      // 1. Ambil jadwal_id untuk mapel ini
      const { data: jadwalData } = await supabase
        .from('jadwal')
        .select('id')
        .eq('mapel_id', mapelId);
      
      if (!jadwalData?.length) return [];
      
      const jadwalIds = jadwalData.map(j => j.id);
      
      // 2. Cari sesi yang sudah selesai dengan materi_id (kecuali sesi saat ini)
      let query = supabase
        .from('sesi_pembelajaran')
        .select('id, metadata')
        .in('jadwal_id', jadwalIds)
        .eq('status', 'selesai');
      
      if (sesi?.id) {
        query = query.neq('id', sesi.id);
      }
      
      const { data: completedSessions } = await query;
      
      if (!completedSessions?.length) return [];
      
      // 3. Filter sesi yang memiliki materi_id di metadata
      const sessionsWithMateri = completedSessions.filter(
        s => s.metadata && typeof s.metadata === 'object' && 'materi_id' in s.metadata && s.metadata.materi_id
      );
      
      if (!sessionsWithMateri.length) return [];
      
      // 4. Ambil data materi untuk setiap sesi
      const materiIds = [...new Set(sessionsWithMateri.map(s => (s.metadata as { materi_id: string }).materi_id))];
      
      const { data: materiList } = await supabase
        .from('materi')
        .select('id, tujuan_pembelajaran_ids')
        .in('id', materiIds);
      
      if (!materiList?.length) return [];
      
      // 5. Kumpulkan SEMUA TP yang pernah ada di materi & SEMUA TP yang sudah tercapai
      const allMateriTpIndexes = new Set<number>();
      const allAchievedTpIndexes = new Set<number>();
      
      sessionsWithMateri.forEach(session => {
        const metadata = session.metadata as { materi_id: string; tujuan_tercapai_ids?: number[] };
        const materiId = metadata.materi_id;
        const materi = materiList.find(m => m.id === materiId);
        
        if (!materi?.tujuan_pembelajaran_ids) return;
        
        const materiTpIds = materi.tujuan_pembelajaran_ids as number[];
        const achievedTpIds = (metadata.tujuan_tercapai_ids || []) as number[];
        
        // Kumpulkan semua TP dari materi
        materiTpIds.forEach(tpId => allMateriTpIndexes.add(tpId));
        
        // Kumpulkan semua TP yang sudah tercapai di sesi manapun
        achievedTpIds.forEach(tpId => allAchievedTpIndexes.add(tpId));
      });
      
      // 6. TP belum tercapai = TP yang ada di materi TAPI tidak pernah tercapai di sesi manapun
      const unachievedTpIndexes = new Set<number>();
      allMateriTpIndexes.forEach(tpId => {
        if (!allAchievedTpIndexes.has(tpId)) {
          unachievedTpIndexes.add(tpId);
        }
      });
      
      if (unachievedTpIndexes.size === 0) return [];
      
      // 6. Ambil text TP dari mapel_info
      const { data: mapelInfo } = await supabase
        .from('mapel_info')
        .select('tujuan_pembelajaran')
        .eq('mapel_id', mapelId)
        .maybeSingle();
      
      if (!mapelInfo?.tujuan_pembelajaran) return [];
      
      const rawTp = mapelInfo.tujuan_pembelajaran as unknown as Array<string | TujuanPembelajaran>;
      
      // 7. Filter dan format TP yang belum tercapai
      return rawTp
        .map((tp, index) => {
          if (typeof tp === 'string') {
            return { id: index, text: tp };
          }
          return {
            id: tp.id !== undefined ? Number(tp.id) : index,
            text: tp.text,
          };
        })
        .filter(tp => tp.id !== undefined && unachievedTpIndexes.has(tp.id))
        .map(tp => ({
          ...tp,
          fromPreviousSession: true,
        }));
    },
    enabled: !!mapelId && open,
  });


  // Fetch ALL TP from mapel_info (used when "Lihat Semua Tujuan" is enabled)
  const { data: allMapelTPList = [] } = useQuery({
    queryKey: ['all-mapel-tp', mapelId],
    queryFn: async () => {
      if (!mapelId) return [];
      const { data: mapelInfo } = await supabase
        .from('mapel_info')
        .select('tujuan_pembelajaran')
        .eq('mapel_id', mapelId)
        .maybeSingle();
      if (!mapelInfo?.tujuan_pembelajaran) return [];
      const rawTp = mapelInfo.tujuan_pembelajaran as unknown as Array<string | TujuanPembelajaran>;
      return rawTp.map((tp, index) => {
        if (typeof tp === 'string') return { id: index, text: tp };
        return { id: tp.id !== undefined ? Number(tp.id) : index, text: tp.text };
      });
    },
    enabled: !!mapelId && open && showAllTP,
  });

  // Fetch already-achieved TP ids across all sessions for this mapel (to flag them)
  const { data: achievedTPIds = [] } = useQuery({
    queryKey: ['achieved-tp-ids', mapelId, sesi?.id],
    queryFn: async () => {
      if (!mapelId) return [] as number[];
      const { data: jadwalData } = await supabase
        .from('jadwal')
        .select('id')
        .eq('mapel_id', mapelId);
      if (!jadwalData?.length) return [];
      const jadwalIds = jadwalData.map(j => j.id);
      let query = supabase
        .from('sesi_pembelajaran')
        .select('id, metadata')
        .in('jadwal_id', jadwalIds)
        .eq('status', 'selesai');
      if (sesi?.id) query = query.neq('id', sesi.id);
      const { data: sessions } = await query;
      const ids = new Set<number>();
      (sessions || []).forEach(s => {
        const md = s.metadata as any;
        const arr = (md?.tujuan_tercapai_ids || []) as number[];
        arr.forEach(id => ids.add(Number(id)));
      });
      return Array.from(ids);
    },
    enabled: !!mapelId && open,
  });

  // Combine current materi TPs with unachieved TPs from previous sessions
  // OR show ALL mapel TPs when showAllTP is enabled
  const tujuanPembelajaranList = useMemo(() => {
    if (showAllTP && allMapelTPList.length > 0) {
      const currentTPIds = new Set(currentMateriTPList.map(tp => tp.id));
      return allMapelTPList.map(tp => ({
        ...tp,
        fromPreviousSession: !currentTPIds.has(tp.id),
      }));
    }

    const currentTPIds = currentMateriTPList.map(tp => tp.id);
    const additionalUnachievedTPs = unachievedTPList.filter(
      tp => tp.id !== undefined && !currentTPIds.includes(tp.id)
    );
    return [
      ...currentMateriTPList.map(tp => ({ ...tp, fromPreviousSession: false })),
      ...additionalUnachievedTPs,
    ];
  }, [currentMateriTPList, unachievedTPList, showAllTP, allMapelTPList]);


  // Effect to attach stream to video element after it's rendered
  useEffect(() => {
    if (cameraActive && pendingStream && videoRef.current) {
      videoRef.current.srcObject = pendingStream;
      streamRef.current = pendingStream;
      setPendingStream(null);
    }
  }, [cameraActive, pendingStream]);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 }
      });
      
      setCameraActive(true);
      setPendingStream(stream);
    } catch (error) {
      console.error('Camera access error:', error);
      toast({
        title: "Akses Kamera Ditolak",
        description: "Mohon izinkan akses kamera untuk mengakhiri pembelajaran.",
        variant: "destructive",
      });
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  const capturePhoto = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        
        const photoData = canvas.toDataURL('image/jpeg', 0.8);
        setCapturedPhoto(photoData);
        stopCamera();
      }
    }
  }, [stopCamera]);

  const retakePhoto = useCallback(() => {
    setCapturedPhoto(null);
    startCamera();
  }, [startCamera]);

  const goToCapaianBelajar = useCallback(() => {
    setStep('capaian');
  }, []);

  const goBackToCamera = useCallback(() => {
    setStep('camera');
  }, []);

  const isFormValid = useCallback(() => {
    const { buktiCapaian, keaktifanSiswa, adaKendala, keteranganKendala, tindakLanjut, tindakLanjutLainnya } = formData;
    
    if (!buktiCapaian.trim() || !keaktifanSiswa || !adaKendala || !tindakLanjut) {
      return false;
    }
    
    if (adaKendala === 'ada' && !keteranganKendala.trim()) {
      return false;
    }
    
    if (tindakLanjut === 'lainnya' && !tindakLanjutLainnya.trim()) {
      return false;
    }
    
    return true;
  }, [formData]);

  const handleConfirmEndSession = useCallback(async () => {
    if (!capturedPhoto || !sesi) return;
    
    if (!isFormValid()) {
      toast({
        title: "Form Belum Lengkap",
        description: "Mohon lengkapi semua form capaian belajar.",
        variant: "destructive",
      });
      return;
    }
    
    setIsSubmitting(true);
    try {
      // Upload photo to storage
      const response = await fetch(capturedPhoto);
      const blob = await response.blob();
      const fileName = `absensi/${sesi.jadwal_id}/end_${new Date().toISOString().replace(/:/g, '-')}.jpg`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('user-documents')
        .upload(fileName, blob, { contentType: 'image/jpeg' });

      if (uploadError || !uploadData) {
        console.error('Upload foto akhiri pembelajaran gagal:', uploadError);
        throw new Error(`Gagal mengupload foto absen: ${uploadError?.message || 'Upload tidak menghasilkan data'}. Silakan coba lagi.`);
      }

      const endPhotoUrl = supabase.storage.from('user-documents').getPublicUrl(uploadData.path).data.publicUrl;

      // Prepare capaian belajar metadata - preserve materi_id from the existing DB session
      const { data: existingSession } = await supabase
        .from('sesi_pembelajaran')
        .select('metadata')
        .eq('id', sesi.id)
        .maybeSingle();

      const existingMateriId = (existingSession?.metadata as any)?.materi_id || null;

      const capaianBelajar = {
        materi_id: existingMateriId,
        tujuan_tercapai_ids: formData.tujuanTercapaiIds,
        bukti_capaian: formData.buktiCapaian.trim(),
        keaktifan_siswa: formData.keaktifanSiswa,
        ada_kendala: formData.adaKendala === 'ada',
        keterangan_kendala: formData.adaKendala === 'ada' ? formData.keteranganKendala.trim() : null,
        tindak_lanjut: formData.tindakLanjut,
        tindak_lanjut_lainnya: formData.tindakLanjut === 'lainnya' ? formData.tindakLanjutLainnya.trim() : null,
      };

      // Update sesi_pembelajaran record with end time, photo, and capaian belajar
      const { error } = await supabase
        .from('sesi_pembelajaran')
        .update({
          waktu_selesai: new Date().toISOString(),
          status: 'selesai',
          foto_guru_selesai_url: endPhotoUrl,
          metadata: capaianBelajar,
        })
        .eq('id', sesi.id);

      if (error) throw error;

      // Update tujuan_pembelajaran_status for each TP
      if (mapelId && tujuanPembelajaranList.length > 0) {
        // Get active academic year
        const { data: academicYearData } = await supabase
          .from('academic_years')
          .select('id')
          .eq('is_active', true)
          .single();

        const academicYearId = academicYearData?.id;

        // Get jadwal to determine semester
        const { data: jadwalData } = await supabase
          .from('jadwal')
          .select('semester')
          .eq('id', sesi.jadwal_id)
          .single();

        const semester = jadwalData?.semester || 'ganjil';

        // Prepare upsert data for all TPs in the materi
        const tpStatusUpdates = tujuanPembelajaranList.map((tp) => {
          const tpId = tp.id ?? 0;
          const isTercapai = formData.tujuanTercapaiIds.includes(tpId);
          
          return {
            mapel_id: mapelId,
            tp_index: tpId,
            status: isTercapai ? 'tercapai' : 'belum_tercapai',
            achieved_in_sesi_id: isTercapai ? sesi.id : null,
            achieved_at: isTercapai ? new Date().toISOString() : null,
            semester,
            academic_year_id: academicYearId,
          };
        });

        // Upsert each TP status (only update if not already tercapai)
        for (const tpStatus of tpStatusUpdates) {
          // Check if already tercapai
          const { data: existing } = await supabase
            .from('tujuan_pembelajaran_status')
            .select('id, status')
            .eq('mapel_id', tpStatus.mapel_id)
            .eq('tp_index', tpStatus.tp_index)
            .eq('semester', tpStatus.semester)
            .eq('academic_year_id', tpStatus.academic_year_id)
            .maybeSingle();

          if (existing) {
            // Only update if current status is not already 'tercapai'
            // OR if we're setting it to 'tercapai' for the first time
            if (existing.status !== 'tercapai' || tpStatus.status === 'tercapai') {
              await supabase
                .from('tujuan_pembelajaran_status')
                .update({
                  status: tpStatus.status,
                  achieved_in_sesi_id: tpStatus.achieved_in_sesi_id,
                  achieved_at: tpStatus.achieved_at,
                })
                .eq('id', existing.id);
            }
          } else {
            // Insert new record
            await supabase
              .from('tujuan_pembelajaran_status')
              .insert(tpStatus);
          }
        }
      }
      
      toast({
        title: "Pembelajaran Selesai",
        description: "Sesi pembelajaran telah diakhiri dengan sukses.",
      });
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['sesi-pembelajaran'] });
      queryClient.invalidateQueries({ queryKey: ['tujuan-pembelajaran-status'] });
      
      if (onSuccess) onSuccess();
      handleClose();
    } catch (error: any) {
      console.error('Submit error:', error);
      toast({
        title: "Gagal Mengakhiri",
        description: error.message || "Terjadi kesalahan saat mengakhiri pembelajaran.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [capturedPhoto, sesi, queryClient, onSuccess, formData, isFormValid, mapelId, tujuanPembelajaranList]);

  const handleClose = useCallback(() => {
    stopCamera();
    setCapturedPhoto(null);
    setCameraActive(false);
    setStep('camera');
    setFormData({
      tujuanTercapaiIds: [],
      buktiCapaian: '',
      keaktifanSiswa: '',
      adaKendala: '',
      keteranganKendala: '',
      tindakLanjut: '',
      tindakLanjutLainnya: '',
    });
    onOpenChange(false);
  }, [stopCamera, onOpenChange]);

  const updateFormField = <K extends keyof CapaianBelajarForm>(field: K, value: CapaianBelajarForm[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="bottom" className="h-[90vh] flex flex-col p-0 rounded-t-2xl">
        {/* Header */}
        <SheetHeader className="px-4 sm:px-6 py-3 sm:py-4 border-b border-border">
          <SheetTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Square className="h-4 w-4 sm:h-5 sm:w-5 text-red-500" />
            Akhiri Pembelajaran
          </SheetTitle>
          <SheetDescription className="sr-only">
            Drawer untuk mengambil foto selfie dan mengisi capaian belajar sebelum mengakhiri pembelajaran
          </SheetDescription>
        </SheetHeader>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-3 sm:py-4 space-y-3 sm:space-y-4">
          {/* Jadwal Info */}
          {jadwalInfo && (
            <div className="p-2.5 sm:p-4 rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 shadow-sm">
              <div className="flex items-start gap-2.5 sm:gap-3">
                <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <BookOpen className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-sm sm:text-base">{jadwalInfo.mapelNama || '-'}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    {jadwalInfo.kelasNama} • {jadwalInfo.jamMulai} - {jadwalInfo.jamSelesai}
                  </p>
                  {materiData && (
                    <p className="text-xs sm:text-sm text-primary/80 mt-1 font-medium truncate">
                      📖 {materiData.judul}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 'camera' && (
            <>
              {/* Camera Section */}
              <div className="relative aspect-[4/3] bg-muted rounded-xl overflow-hidden border-2 border-dashed border-border">
                {!cameraActive && !capturedPhoto && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 sm:gap-4 p-4 sm:p-6">
                    <div className="h-14 w-14 sm:h-20 sm:w-20 rounded-full bg-red-500/10 flex items-center justify-center border-2 border-red-500/20">
                      <Camera className="h-7 w-7 sm:h-10 sm:w-10 text-red-500" />
                    </div>
                    <div className="text-center space-y-0.5 sm:space-y-1">
                      <p className="text-xs sm:text-sm font-medium text-foreground">
                        Konfirmasi Akhiri Pembelajaran
                      </p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">
                        Ambil foto selfie untuk mengakhiri sesi pembelajaran
                      </p>
                    </div>
                    <Button onClick={startCamera} size="default" className="rounded-xl mt-1 sm:mt-2 h-9 sm:h-10 text-xs sm:text-sm bg-red-500 hover:bg-red-600">
                      <Camera className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                      Buka Kamera
                    </Button>
                  </div>
                )}

                {cameraActive && (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                )}

                {capturedPhoto && (
                  <img
                    src={capturedPhoto}
                    alt="Captured"
                    className="w-full h-full object-cover"
                  />
                )}

                <canvas ref={canvasRef} className="hidden" />
              </div>

              {/* Photo captured success indicator */}
              {capturedPhoto && (
                <div className="flex items-center gap-2 p-2.5 sm:p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <Check className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 shrink-0" />
                  <p className="text-xs sm:text-sm text-green-700 dark:text-green-400 font-medium">
                    Foto berhasil diambil. Lanjutkan ke form capaian belajar.
                  </p>
                </div>
              )}
            </>
          )}

          {step === 'capaian' && (
            <ContentCard>
              <ContentCardHeader>
                <ContentCardTitle className="text-sm sm:text-base">Capaian Belajar</ContentCardTitle>
              </ContentCardHeader>
              <ContentCardBody className="space-y-4 sm:space-y-6">
              {/* 1. Tujuan Pembelajaran yang Tercapai */}
              <div className="space-y-2 sm:space-y-3">
                <Label className="text-xs sm:text-sm font-medium">
                  1. Tujuan pembelajaran yang tercapai
                </Label>
                {showAllTP && (
                  <p className="text-[10px] sm:text-xs text-muted-foreground bg-muted/50 border border-border/50 rounded-lg p-2">
                    Menampilkan semua tujuan pembelajaran dari mata pelajaran ini. Anda bisa menandai tujuan lain yang tercapai pada sesi ini.
                  </p>
                )}

                {tujuanPembelajaranList.length > 0 ? (
                  <div className="space-y-1.5 sm:space-y-2">
                    {tujuanPembelajaranList.map((tp, index) => {
                      const tpId = tp.id ?? index;
                      const isFromPreviousSession = tp.fromPreviousSession;
                      const isAlreadyAchieved = achievedTPIds.includes(tpId);
                      return (
                        <div
                          key={`${tpId}-${isFromPreviousSession ? 'prev' : 'curr'}`}
                          className={`flex items-start space-x-2.5 sm:space-x-3 p-2.5 sm:p-3 rounded-lg border transition-colors ${
                            isFromPreviousSession 
                              ? 'border-amber-300 bg-amber-50/50 dark:bg-amber-900/10 dark:border-amber-700' 
                              : 'border-border bg-background hover:bg-muted/50'
                          }`}
                        >
                          <Checkbox
                            id={`tp-${tpId}-${isFromPreviousSession ? 'prev' : 'curr'}`}
                            checked={formData.tujuanTercapaiIds.includes(tpId)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setFormData(prev => ({
                                  ...prev,
                                  tujuanTercapaiIds: [...prev.tujuanTercapaiIds, tpId]
                                }));
                              } else {
                                setFormData(prev => ({
                                  ...prev,
                                  tujuanTercapaiIds: prev.tujuanTercapaiIds.filter(id => id !== tpId)
                                }));
                              }
                            }}
                            className="h-4 w-4 sm:h-5 sm:w-5 mt-0.5"
                          />
                          <div className="flex-1">
                            <Label 
                              htmlFor={`tp-${tpId}-${isFromPreviousSession ? 'prev' : 'curr'}`} 
                              className="cursor-pointer text-xs sm:text-sm leading-relaxed"
                            >
                              {tp.text}
                            </Label>
                            {isAlreadyAchieved && (
                              <p className="text-[10px] sm:text-xs text-green-600 dark:text-green-400 mt-1 font-medium">
                                ✓ Sudah tercapai pada sesi sebelumnya
                              </p>
                            )}
                            {isFromPreviousSession && !isAlreadyAchieved && (
                              <p className="text-[10px] sm:text-xs text-amber-600 dark:text-amber-400 mt-1 font-medium">
                                ⚠️ Tujuan ini belum tercapai di pertemuan sebelumnya
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    <p className="text-[10px] sm:text-xs text-muted-foreground">
                      {formData.tujuanTercapaiIds.length} dari {tujuanPembelajaranList.length} tujuan tercapai
                    </p>
                  </div>
                ) : isLoadingTP ? (
                  <div className="p-2.5 sm:p-3 rounded-lg bg-muted/50 border border-border/50">
                    <p className="text-xs sm:text-sm text-muted-foreground">Memuat tujuan pembelajaran...</p>
                  </div>
                ) : (
                  <div className="p-2.5 sm:p-3 rounded-lg bg-muted/50 border border-border/50">
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      {materiId 
                        ? "Tidak ada tujuan pembelajaran yang dipilih untuk materi ini"
                        : "Belum ada materi yang dipilih saat memulai pembelajaran"}
                    </p>
                  </div>
                )}

                <Button
                  type="button"
                  variant={showAllTP ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowAllTP(prev => !prev)}
                  className="w-full rounded-lg h-9 text-xs sm:text-sm gap-1.5"
                >
                  <BookOpen className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  {showAllTP ? 'Tampilkan Materi Ini Saja' : 'Lihat Semua Tujuan'}
                </Button>
              </div>

              {/* 2. Bukti Capaian */}
              <div className="space-y-2 sm:space-y-3">
                <Label htmlFor="buktiCapaian" className="text-xs sm:text-sm font-medium">
                  2. Bukti singkat capaian pembelajaran <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="buktiCapaian"
                  placeholder="Tuliskan bukti capaian (maks 150 karakter)"
                  value={formData.buktiCapaian}
                  onChange={(e) => {
                    if (e.target.value.length <= 150) {
                      updateFormField('buktiCapaian', e.target.value);
                    }
                  }}
                  className="resize-none bg-background text-xs sm:text-sm"
                  rows={2}
                />
                <p className="text-[10px] sm:text-xs text-muted-foreground text-right">
                  {formData.buktiCapaian.length}/150 karakter
                </p>
              </div>

              {/* 3. Keaktifan Siswa */}
              <div className="space-y-2 sm:space-y-3">
                <Label className="text-xs sm:text-sm font-medium">
                  3. Bagaimana tingkat keaktifan siswa selama pembelajaran? <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.keaktifanSiswa}
                  onValueChange={(value) => updateFormField('keaktifanSiswa', value)}
                >
                  <SelectTrigger className="bg-background h-9 sm:h-10 text-xs sm:text-sm">
                    <SelectValue placeholder="Pilih tingkat keaktifan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sangat_aktif" className="text-xs sm:text-sm">Sangat aktif</SelectItem>
                    <SelectItem value="cukup_aktif" className="text-xs sm:text-sm">Cukup aktif</SelectItem>
                    <SelectItem value="kurang_aktif" className="text-xs sm:text-sm">Kurang aktif</SelectItem>
                    <SelectItem value="tidak_kondusif" className="text-xs sm:text-sm">Tidak kondusif</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 4. Kendala */}
              <div className="space-y-2 sm:space-y-3">
                <Label className="text-xs sm:text-sm font-medium">
                  4. Apakah ada kendala atau kejadian penting selama pembelajaran? <span className="text-destructive">*</span>
                </Label>
                <RadioGroup
                  value={formData.adaKendala}
                  onValueChange={(value) => updateFormField('adaKendala', value as CapaianBelajarForm['adaKendala'])}
                  className="flex gap-2 sm:gap-4"
                >
                  <div className="flex items-center space-x-2 p-2.5 sm:p-3 rounded-lg border border-border bg-background hover:bg-muted/50 transition-colors flex-1">
                    <RadioGroupItem value="tidak" id="kendala-tidak" className="h-4 w-4" />
                    <Label htmlFor="kendala-tidak" className="cursor-pointer text-xs sm:text-sm">Tidak ada</Label>
                  </div>
                  <div className="flex items-center space-x-2 p-2.5 sm:p-3 rounded-lg border border-border bg-background hover:bg-muted/50 transition-colors flex-1">
                    <RadioGroupItem value="ada" id="kendala-ada" className="h-4 w-4" />
                    <Label htmlFor="kendala-ada" className="cursor-pointer text-xs sm:text-sm">Ada</Label>
                  </div>
                </RadioGroup>
                
                {formData.adaKendala === 'ada' && (
                  <Input
                    placeholder="Jelaskan kendala yang terjadi"
                    value={formData.keteranganKendala}
                    onChange={(e) => updateFormField('keteranganKendala', e.target.value)}
                    className="mt-2 bg-background h-9 sm:h-10 text-xs sm:text-sm"
                  />
                )}
              </div>

              {/* 5. Tindak Lanjut */}
              <div className="space-y-2 sm:space-y-3">
                <Label className="text-xs sm:text-sm font-medium">
                  5. Tindak lanjut setelah pembelajaran ini? <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.tindakLanjut}
                  onValueChange={(value) => updateFormField('tindakLanjut', value)}
                >
                  <SelectTrigger className="bg-background h-9 sm:h-10 text-xs sm:text-sm">
                    <SelectValue placeholder="Pilih tindak lanjut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lanjut_materi" className="text-xs sm:text-sm">Lanjut materi berikutnya</SelectItem>
                    <SelectItem value="penguatan_materi" className="text-xs sm:text-sm">Penguatan materi</SelectItem>
                    <SelectItem value="remedial" className="text-xs sm:text-sm">Remedial</SelectItem>
                    <SelectItem value="tugas_rumah" className="text-xs sm:text-sm">Tugas rumah</SelectItem>
                    <SelectItem value="lainnya" className="text-xs sm:text-sm">Lainnya</SelectItem>
                  </SelectContent>
                </Select>
                
                {formData.tindakLanjut === 'lainnya' && (
                  <Input
                    placeholder="Jelaskan tindak lanjut lainnya"
                    value={formData.tindakLanjutLainnya}
                    onChange={(e) => updateFormField('tindakLanjutLainnya', e.target.value)}
                    className="mt-2 bg-background h-9 sm:h-10 text-xs sm:text-sm"
                  />
                )}
              </div>
              </ContentCardBody>
            </ContentCard>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-border flex items-center justify-between gap-2">
          {step === 'camera' && (
            <>
              <div>
                {!cameraActive && !capturedPhoto && (
                  <Button variant="outline" onClick={handleClose} size="sm" className="h-9 text-xs sm:text-sm">
                    <X className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                    Tutup
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                {cameraActive && (
                  <>
                    <Button variant="outline" onClick={stopCamera} size="sm" className="h-9 text-xs sm:text-sm">
                      <X className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                      Batal
                    </Button>
                    <Button onClick={capturePhoto} size="sm" className="h-9 text-xs sm:text-sm bg-red-500 hover:bg-red-600">
                      <Camera className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                      Ambil Foto
                    </Button>
                  </>
                )}

                {capturedPhoto && (
                  <>
                    <Button variant="outline" onClick={retakePhoto} size="sm" className="h-9 text-xs sm:text-sm">
                      <RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                      Ulangi
                    </Button>
                    <Button onClick={goToCapaianBelajar} size="sm" className="h-9 text-xs sm:text-sm bg-primary hover:bg-primary/90">
                      <ClipboardList className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                      <span className="hidden sm:inline">Isi Capaian Belajar</span>
                      <span className="sm:hidden">Lanjut</span>
                      <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 ml-1" />
                    </Button>
                  </>
                )}
              </div>
            </>
          )}

          {step === 'capaian' && (
            <>
              <Button variant="outline" onClick={goBackToCamera} size="sm" className="h-9 text-xs sm:text-sm">
                Kembali
              </Button>
              <Button 
                onClick={handleConfirmEndSession} 
                disabled={isSubmitting || !isFormValid()}
                size="sm"
                className="h-9 text-xs sm:text-sm bg-red-500 hover:bg-red-600"
              >
                <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                {isSubmitting ? 'Menyimpan...' : 'Akhiri Pembelajaran'}
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
