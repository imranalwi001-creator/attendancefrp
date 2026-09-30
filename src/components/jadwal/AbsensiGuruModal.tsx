import { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, X, Check, RefreshCw, Users, BookOpen, ChevronDown, MapPin, AlertTriangle, CheckCircle2, HelpCircle } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getLocalDateString } from '@/lib/dateUtils';
import { logActivity } from '@/lib/activityLogger';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ContentCard, ContentCardHeader, ContentCardTitle, ContentCardBody } from '@/components/ui/content-card';
import { Label } from '@/components/ui/label';
import { useAcademicYear } from '@/contexts/AcademicYearContext';
import { Badge } from '@/components/ui/badge';

interface AbsensiGuruModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jadwal: {
    id: string;
    pengampu_id?: string;
    mapel_id?: string;
    mapel?: {
      id?: string;
      nama: string;
    };
    kelas?: {
      id: string;
      nama: string;
    };
    jam_mulai: string;
    jam_selesai: string;
  } | null;
  onSuccess?: () => void;
}

interface LokasiAbsen {
  id: string;
  nama: string;
  alamat: string | null;
  latitude: number;
  longitude: number;
  radius: number;
}

type LocationValidationStatus = 'dalam_lokasi' | 'di_luar_lokasi' | 'tidak_diketahui';
type AttendanceStatus = 'hadir' | 'sakit' | 'izin' | 'alpha';

interface SantriAttendance {
  santri_id: string;
  nama: string;
  status: AttendanceStatus;
}

type Step = 'camera' | 'attendance';

// Haversine formula to calculate distance between two coordinates
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

export function AbsensiGuruModal({
  open,
  onOpenChange,
  jadwal,
  onSuccess
}: AbsensiGuruModalProps) {
  const [step, setStep] = useState<Step>('camera');
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingStream, setPendingStream] = useState<MediaStream | null>(null);
  const [santriAttendance, setSantriAttendance] = useState<SantriAttendance[]>([]);
  const [selectedMateriId, setSelectedMateriId] = useState<string>('');
  
  // Location states
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<'loading' | 'success' | 'error' | 'idle'>('idle');
  const [locationName, setLocationName] = useState<string>('Memuat lokasi...');
  const [validationStatus, setValidationStatus] = useState<LocationValidationStatus>('tidak_diketahui');
  const [distance, setDistance] = useState<number | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const queryClient = useQueryClient();
  const {
    getCurrentSemester
  } = useAcademicYear();
  const currentSemester = getCurrentSemester();

  // Fetch location settings - explicit columns
  const { data: lokasiAbsen } = useQuery({
    queryKey: ['lokasi-absen'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lokasi_absen')
        .select('id, nama, alamat, latitude, longitude, radius')
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data as LokasiAbsen | null;
    },
    enabled: open,
    staleTime: 10 * 60 * 1000, // 10 minutes - location rarely changes
    refetchOnWindowFocus: false
  });

  // Validate location when we have both user location and settings
  useEffect(() => {
    if (location && lokasiAbsen) {
      const dist = calculateDistance(
        location.lat,
        location.lng,
        Number(lokasiAbsen.latitude),
        Number(lokasiAbsen.longitude)
      );
      setDistance(Math.round(dist));
      
      if (dist <= lokasiAbsen.radius) {
        setValidationStatus('dalam_lokasi');
        setLocationName(lokasiAbsen.nama);
      } else {
        setValidationStatus('di_luar_lokasi');
        setLocationName(`${Math.round(dist)}m dari ${lokasiAbsen.nama}`);
      }
    } else if (location && !lokasiAbsen) {
      setValidationStatus('tidak_diketahui');
      setLocationName(`${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`);
    }
  }, [location, lokasiAbsen]);

  // Get current location with fallback strategy
  const getCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationStatus('error');
      setLocationName('Geolocation tidak didukung');
      return;
    }
    
    setLocationStatus('loading');
    setLocationName('Memuat lokasi...');
    
    // First, try to get cached/quick location
    const tryGetLocation = (highAccuracy: boolean, timeout: number) => {
      return new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: highAccuracy,
          timeout: timeout,
          maximumAge: highAccuracy ? 0 : 300000 // 5 min cache for low accuracy
        });
      });
    };

    // Strategy: Try quick/cached first, then high accuracy as fallback
    const getLocationWithFallback = async () => {
      try {
        // First attempt: quick location (cached or low accuracy) - 3 seconds
        const position = await tryGetLocation(false, 3000);
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        setLocation(coords);
        setLocationStatus('success');
        
        // Try to get more accurate location in background (don't block)
        tryGetLocation(true, 15000)
          .then((accuratePos) => {
            setLocation({
              lat: accuratePos.coords.latitude,
              lng: accuratePos.coords.longitude
            });
          })
          .catch(() => {
            // Ignore error, we already have location
          });
      } catch (firstError) {
        try {
          // Second attempt: high accuracy with longer timeout
          const position = await tryGetLocation(true, 20000);
          const coords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setLocation(coords);
          setLocationStatus('success');
        } catch (error: any) {
          setLocationStatus('error');
          let message = 'Gagal mendapatkan lokasi';
          switch (error.code) {
            case 1: // PERMISSION_DENIED
              message = 'Izin lokasi ditolak';
              break;
            case 2: // POSITION_UNAVAILABLE
              message = 'Lokasi tidak tersedia';
              break;
            case 3: // TIMEOUT
              message = 'Waktu habis';
              break;
          }
          setLocationName(message);
        }
      }
    };

    getLocationWithFallback();
  }, []);

  // Get location when modal opens
  useEffect(() => {
    if (open) {
      getCurrentLocation();
    }
  }, [open, getCurrentLocation]);

  // Fetch materi for this mapel - use mapel.id from relation or mapel_id
  const mapelId = jadwal?.mapel?.id || jadwal?.mapel_id;
  const {
    data: materiList
  } = useQuery({
    queryKey: ['materi-mapel', mapelId, currentSemester],
    queryFn: async () => {
      if (!mapelId) return [];
      const {
        data,
        error
      } = await supabase.from('materi').select('id, judul, deskripsi, tipe_konten').eq('mapel_id', mapelId).eq('semester', currentSemester || 'ganjil').eq('status', 'aktif').order('deskripsi', {
        ascending: true
      });
      if (error) throw error;
      return data || [];
    },
    enabled: !!mapelId && open
  });

  // Fetch completed session materi_ids to disable already-used materi
  const { data: completedMateriIds } = useQuery({
    queryKey: ['completed-materi-ids', mapelId],
    queryFn: async () => {
      if (!mapelId) return [];
      // Get all completed sessions for this mapel's jadwal
      const { data: sessions, error } = await supabase
        .from('sesi_pembelajaran')
        .select('metadata, jadwal!inner(mapel_id)')
        .eq('jadwal.mapel_id', mapelId)
        .eq('status', 'selesai');
      if (error) return [];
      // Extract materi_ids from metadata
      const ids = (sessions || [])
        .map((s: any) => s.metadata?.materi_id)
        .filter(Boolean);
      return [...new Set(ids)] as string[];
    },
    enabled: !!mapelId && open
  });

  // Fetch santri in this class
  const {
    data: santriList
  } = useQuery({
    queryKey: ['santri-kelas', jadwal?.kelas?.id],
    queryFn: async () => {
      if (!jadwal?.kelas?.id) return [];
      const {
        data,
        error
      } = await supabase.from('santri').select('id, profiles!santri_id_fkey(name)').eq('kelas_id', jadwal.kelas.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!jadwal?.kelas?.id && step === 'attendance'
  });

  // Initialize attendance when santri list is loaded
  useEffect(() => {
    if (santriList && santriList.length > 0 && santriAttendance.length === 0) {
      const initialAttendance: SantriAttendance[] = santriList.map((s: any) => ({
        santri_id: s.id,
        nama: s.profiles?.name || 'Unknown',
        status: 'hadir' as AttendanceStatus
      }));
      setSantriAttendance(initialAttendance);
    }
  }, [santriList, santriAttendance.length]);

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
        video: {
          facingMode: 'user',
          width: 640,
          height: 480
        }
      });
      setCameraActive(true);
      setPendingStream(stream);
    } catch (error) {
      console.error('Camera access error:', error);
      toast({
        title: "Akses Kamera Ditolak",
        description: "Mohon izinkan akses kamera untuk melakukan absensi.",
        variant: "destructive"
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
  const handleConfirmPhoto = useCallback(() => {
    // Move to attendance step
    setStep('attendance');
  }, []);
  const updateAttendance = useCallback((santriId: string, status: AttendanceStatus) => {
    setSantriAttendance(prev => prev.map(s => s.santri_id === santriId ? {
      ...s,
      status
    } : s));
  }, []);
  const handleFinalSubmit = useCallback(async () => {
    if (!capturedPhoto || !jadwal) return;

    // Materi must be selected so Akhiri Pembelajaran can show TP checklist correctly
    if (materiList && materiList.length > 0 && !selectedMateriId) {
      toast({
        title: 'Materi belum dipilih',
        description: 'Silakan pilih materi pembelajaran terlebih dahulu.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Get current user
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      // Check if user is a substitute teacher for this schedule today
      const todayDate = getLocalDateString();
      const { data: guruPengganti } = await supabase
        .from('guru_pengganti')
        .select('id, guru_pengganti_id')
        .eq('jadwal_id', jadwal.id)
        .eq('tanggal', todayDate)
        .eq('guru_pengganti_id', user.id)
        .maybeSingle();
      
      // Determine pengampu_id: use current user if they're a substitute, otherwise use jadwal.pengampu_id
      const actualPengampuId = guruPengganti ? user.id : (jadwal.pengampu_id || user.id);

      // Upload photo to storage
      const response = await fetch(capturedPhoto);
      const blob = await response.blob();
      const fileName = `absensi/${jadwal.id}/${new Date().toISOString().replace(/:/g, '-')}.jpg`;
      const {
        data: uploadData,
        error: uploadError
      } = await supabase.storage.from('user-documents').upload(fileName, blob, {
        contentType: 'image/jpeg'
      });
      if (uploadError || !uploadData) {
        console.error('Upload foto mulai pembelajaran gagal:', uploadError);
        throw new Error(`Gagal mengupload foto absen: ${uploadError?.message || 'Upload tidak menghasilkan data'}. Silakan coba lagi.`);
      }
      const photoUrl = supabase.storage.from('user-documents').getPublicUrl(uploadData.path).data.publicUrl;

      // Create sesi_pembelajaran record using local date
      const {
        data: sesiData,
        error: sesiError
      } = await supabase.from('sesi_pembelajaran').insert({
        jadwal_id: jadwal.id,
        tanggal: getLocalDateString(),
        waktu_mulai: new Date().toISOString(),
        foto_guru_url: photoUrl,
        pengampu_id: actualPengampuId,
        status: 'berlangsung',
        metadata: {
          materi_id: selectedMateriId
        }
      }).select().single();
      if (sesiError) throw sesiError;

      // Insert kehadiran_santri records
      if (santriAttendance.length > 0) {
        const kehadiranRecords = santriAttendance.map(s => ({
          sesi_id: sesiData.id,
          santri_id: s.santri_id,
          status: s.status
        }));
        const {
          error: kehadiranError
        } = await supabase.from('kehadiran_santri').insert(kehadiranRecords);
        if (kehadiranError) throw kehadiranError;
      }
      toast({
        title: "Pembelajaran Dimulai",
        description: `${santriAttendance.filter(s => s.status === 'hadir').length} santri hadir.`
      });

      // Log activity
      logActivity({
        action: 'attendance_checkin',
        category: 'attendance',
        description: `Guru memulai pembelajaran ${jadwal.mapel?.nama || ''} di kelas ${jadwal.kelas?.nama || ''}`,
        metadata: {
          jadwalId: jadwal.id,
          sesiId: sesiData.id,
          hadir: santriAttendance.filter(s => s.status === 'hadir').length
        }
      });

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({
        queryKey: ['sesi-pembelajaran']
      });
      if (onSuccess) onSuccess();
      handleClose();
    } catch (error: any) {
      console.error('Submit error:', error);
      toast({
        title: "Gagal Menyimpan",
        description: error.message || "Terjadi kesalahan saat menyimpan absensi.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [capturedPhoto, jadwal, santriAttendance, queryClient, onSuccess, materiList, selectedMateriId]);
  const handleClose = useCallback(() => {
    stopCamera();
    setCapturedPhoto(null);
    setCameraActive(false);
    setStep('camera');
    setSantriAttendance([]);
    setSelectedMateriId('');
    setLocation(null);
    setLocationStatus('idle');
    setLocationName('Memuat lokasi...');
    setValidationStatus('tidak_diketahui');
    setDistance(null);
    onOpenChange(false);
  }, [stopCamera, onOpenChange]);

  // Calculate attendance summary
  const attendanceSummary = {
    hadir: santriAttendance.filter(s => s.status === 'hadir').length,
    sakit: santriAttendance.filter(s => s.status === 'sakit').length,
    izin: santriAttendance.filter(s => s.status === 'izin').length,
    alpha: santriAttendance.filter(s => s.status === 'alpha').length
  };
  return <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="bottom" className="h-[90vh] flex flex-col p-0 rounded-t-2xl">
        {/* Header */}
        <SheetHeader className="px-4 sm:px-6 py-3 sm:py-4 border-b border-border">
          <SheetTitle className="text-base sm:text-lg">
            {step === 'camera' ? 'Absensi Guru' : 'Absensi Santri'}
          </SheetTitle>
          <SheetDescription className="sr-only">
            {step === 'camera' ? 'Drawer untuk mengambil foto selfie sebagai konfirmasi kehadiran guru' : 'Drawer untuk mencatat kehadiran santri'}
          </SheetDescription>
        </SheetHeader>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-3 sm:py-4 space-y-3 sm:space-y-4">
          {/* Jadwal Info */}
          {jadwal && <div className="p-2.5 sm:p-3 rounded-lg border border-border/50 bg-muted/30">
              <p className="font-semibold text-foreground text-sm sm:text-base">{jadwal.mapel?.nama || '-'}</p>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {jadwal.kelas?.nama} • {jadwal.jam_mulai} - {jadwal.jam_selesai}
              </p>
            </div>}

          {/* Location Info */}
          {step === 'camera' && (
            <div className={`p-2.5 sm:p-3 rounded-lg border flex items-center justify-between gap-2 ${
              validationStatus === 'dalam_lokasi'
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                : validationStatus === 'di_luar_lokasi'
                  ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                  : 'bg-muted/30 border-border/50'
            }`}>
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {locationStatus === 'loading' ? (
                  <RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground animate-spin shrink-0" />
                ) : validationStatus === 'dalam_lokasi' ? (
                  <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-600 shrink-0" />
                ) : validationStatus === 'di_luar_lokasi' ? (
                  <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-600 shrink-0" />
                ) : locationStatus === 'error' ? (
                  <X className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-destructive shrink-0" />
                ) : (
                  <HelpCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-muted-foreground shrink-0" />
                    <span className="text-[10px] sm:text-xs text-muted-foreground">Lokasi</span>
                  </div>
                  <p className="text-xs sm:text-sm font-medium text-foreground truncate">{locationName}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                {validationStatus === 'dalam_lokasi' && (
                  <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300 text-[10px] sm:text-xs px-1.5 sm:px-2">
                    Dalam Lokasi
                  </Badge>
                )}
                {validationStatus === 'di_luar_lokasi' && (
                  <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300 text-[10px] sm:text-xs px-1.5 sm:px-2">
                    Di Luar Lokasi
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 sm:h-8 sm:w-8"
                  onClick={() => getCurrentLocation()}
                  disabled={locationStatus === 'loading'}
                  title="Refresh lokasi"
                >
                  <RefreshCw className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${locationStatus === 'loading' ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
          )}

          {/* Step 1: Camera */}
          {step === 'camera' && <div className="relative aspect-[4/3] bg-muted rounded-xl overflow-hidden border-2 border-dashed border-border">
              {!cameraActive && !capturedPhoto && <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 sm:gap-4 p-4 sm:p-6">
                  <div className="h-14 w-14 sm:h-20 sm:w-20 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary/20">
                    <Camera className="h-7 w-7 sm:h-10 sm:w-10 text-primary" />
                  </div>
                  <div className="text-center space-y-0.5 sm:space-y-1">
                    <p className="text-xs sm:text-sm font-medium text-foreground">
                      Konfirmasi Kehadiran Guru
                    </p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">
                      Ambil foto selfie untuk memulai pembelajaran
                    </p>
                  </div>
                  <Button onClick={startCamera} size="default" className="rounded-xl mt-1 sm:mt-2 h-9 sm:h-10 text-xs sm:text-sm">
                    <Camera className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                    Buka Kamera
                  </Button>
                </div>}

              {cameraActive && <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />}

              {capturedPhoto && <img src={capturedPhoto} alt="Captured" className="w-full h-full object-cover" />}

              <canvas ref={canvasRef} className="hidden" />
            </div>}

          {/* Step 2: Attendance */}
          {step === 'attendance' && <ContentCard className="border shadow-sm">
              <ContentCardHeader>
                <ContentCardTitle className="text-sm sm:text-base">Absensi Santri</ContentCardTitle>
              </ContentCardHeader>
              <ContentCardBody className="space-y-3 sm:space-y-4">
                {/* Materi Selection */}
                {materiList && materiList.length > 0 && <div className="space-y-1.5 sm:space-y-2">
                    <Label className="text-xs sm:text-sm font-semibold">
                      Materi Pembelajaran
                    </Label>
                    <Select value={selectedMateriId} onValueChange={setSelectedMateriId}>
                      <SelectTrigger className="w-full rounded-xl h-9 sm:h-10 text-xs sm:text-sm">
                        <SelectValue placeholder="Pilih materi yang akan diajarkan">
                          {selectedMateriId && materiList && (() => {
                            const selected = materiList.find((m: any) => m.id === selectedMateriId);
                            if (selected) {
                              return (
                                <span className="text-xs sm:text-sm">
                                  {selected.deskripsi ? `${selected.deskripsi} - ` : ''}{selected.judul}
                                </span>
                              );
                            }
                            return null;
                          })()}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {materiList.map((materi: any) => {
                          const isCompleted = completedMateriIds?.includes(materi.id);
                          return (
                            <SelectItem 
                              key={materi.id} 
                              value={materi.id}
                              className="text-xs sm:text-sm"
                            >
                              <div className="flex flex-col items-start">
                                <span className="font-medium">
                                  {materi.deskripsi ? `${materi.deskripsi} - ` : ''}{materi.judul}
                                  {isCompleted && <span className="ml-2 text-[10px] sm:text-xs text-muted-foreground">(Sudah Terlaksana)</span>}
                                </span>
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    {selectedMateriId && <p className="text-[10px] sm:text-xs text-muted-foreground">
                        Materi ini akan dicatat dalam sesi pembelajaran
                      </p>}
                  </div>}

                {materiList && materiList.length === 0 && <div className="p-2.5 sm:p-3 rounded-lg bg-muted/50 border border-border/50">
                    <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-2">
                      <BookOpen className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      Belum ada materi untuk mapel ini
                    </p>
                  </div>}
                {/* Summary */}
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  <div className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-green-100 text-green-800 text-xs sm:text-sm font-medium">
                    H: {attendanceSummary.hadir}
                  </div>
                  <div className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-yellow-100 text-yellow-800 text-xs sm:text-sm font-medium">
                    S: {attendanceSummary.sakit}
                  </div>
                  <div className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-blue-100 text-blue-800 text-xs sm:text-sm font-medium">
                    I: {attendanceSummary.izin}
                  </div>
                  <div className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-red-100 text-red-800 text-xs sm:text-sm font-medium">
                    A: {attendanceSummary.alpha}
                  </div>
                </div>

                {/* Table with Radio Buttons */}
                <div className="rounded-xl border border-border overflow-hidden -mx-0 sm:mx-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-8 sm:w-12 text-center text-[10px] sm:text-xs px-1 sm:px-2">No</TableHead>
                        <TableHead className="min-w-[100px] sm:min-w-[150px] text-xs sm:text-sm px-2 sm:px-4">Nama</TableHead>
                        <TableHead className="w-10 sm:w-16 text-center px-1 sm:px-2">
                          <span className="text-green-700 text-[10px] sm:text-xs">Hadir</span>
                        </TableHead>
                        <TableHead className="w-10 sm:w-16 text-center px-1 sm:px-2">
                          <span className="text-yellow-700 text-[10px] sm:text-xs">Sakit</span>
                        </TableHead>
                        <TableHead className="w-10 sm:w-16 text-center px-1 sm:px-2">
                          <span className="text-blue-700 text-[10px] sm:text-xs">Izin</span>
                        </TableHead>
                        <TableHead className="w-10 sm:w-16 text-center px-1 sm:px-2">
                          <span className="text-red-700 text-[10px] sm:text-xs">Alpa</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {santriAttendance.length === 0 ? <TableRow>
                          <TableCell colSpan={6} className="text-center py-6 sm:py-8 text-muted-foreground">
                            <Users className="h-6 w-6 sm:h-8 sm:w-8 mx-auto mb-2 opacity-50" />
                            <span className="text-xs sm:text-sm">Tidak ada santri di kelas ini</span>
                          </TableCell>
                        </TableRow> : santriAttendance.map((santri, index) => <TableRow key={santri.santri_id}>
                            <TableCell className="text-center font-medium text-xs sm:text-sm px-1 sm:px-2">{index + 1}</TableCell>
                            <TableCell className="font-medium text-xs sm:text-sm px-2 sm:px-4 py-2 sm:py-3">{santri.nama}</TableCell>
                            <RadioGroup value={santri.status} onValueChange={value => updateAttendance(santri.santri_id, value as AttendanceStatus)} className="contents">
                              <TableCell className="text-center px-1 sm:px-2">
                                <RadioGroupItem value="hadir" className="h-4 w-4 sm:h-5 sm:w-5 border-green-500 text-green-500 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500" />
                              </TableCell>
                              <TableCell className="text-center px-1 sm:px-2">
                                <RadioGroupItem value="sakit" className="h-4 w-4 sm:h-5 sm:w-5 border-yellow-500 text-yellow-500 data-[state=checked]:bg-yellow-500 data-[state=checked]:border-yellow-500" />
                              </TableCell>
                              <TableCell className="text-center px-1 sm:px-2">
                                <RadioGroupItem value="izin" className="h-4 w-4 sm:h-5 sm:w-5 border-blue-500 text-blue-500 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500" />
                              </TableCell>
                              <TableCell className="text-center px-1 sm:px-2">
                                <RadioGroupItem value="alpha" className="h-4 w-4 sm:h-5 sm:w-5 border-red-500 text-red-500 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500" />
                              </TableCell>
                            </RadioGroup>
                          </TableRow>)}
                    </TableBody>
                  </Table>
                </div>
              </ContentCardBody>
            </ContentCard>}
        </div>

        {/* Footer Actions */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-border flex items-center justify-end gap-2">
          {/* Step 1: Camera actions */}
          {step === 'camera' && cameraActive && <>
              <Button variant="outline" onClick={stopCamera} size="sm" className="h-9 text-xs sm:text-sm">
                <X className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                Batal
              </Button>
              <Button onClick={capturePhoto} size="sm" className="h-9 text-xs sm:text-sm">
                <Camera className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                Ambil Foto
              </Button>
            </>}

          {step === 'camera' && capturedPhoto && <>
              <Button variant="outline" onClick={retakePhoto} size="sm" className="h-9 text-xs sm:text-sm">
                <RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                Ulangi
              </Button>
              <Button onClick={handleConfirmPhoto} size="sm" className="h-9 text-xs sm:text-sm">
                <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                Lanjut Absen
              </Button>
            </>}

          {step === 'camera' && !cameraActive && !capturedPhoto && <Button variant="outline" onClick={handleClose} size="sm" className="h-9 text-xs sm:text-sm">
              <X className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
              Tutup
            </Button>}

          {/* Step 2: Attendance actions */}
          {step === 'attendance' && <>
              <Button variant="outline" onClick={() => setStep('camera')} disabled={isSubmitting} size="sm" className="h-9 text-xs sm:text-sm">
                Kembali
              </Button>
              <Button onClick={handleFinalSubmit} disabled={isSubmitting} size="sm" className="h-9 text-xs sm:text-sm">
                <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                {isSubmitting ? 'Menyimpan...' : 'Simpan Absensi'}
              </Button>
            </>}
        </div>
      </SheetContent>
    </Sheet>;
}