import { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, X, Check, RefreshCw, MapPin, Clock, Calendar, CheckCircle2, AlertTriangle, HelpCircle } from 'lucide-react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface AbsenStaffModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'masuk' | 'pulang';
  staffId: string;
  attendanceId?: string;
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

interface AturanWaktuKerja {
  id: string;
  jabatan: string;
  waktu_masuk: string;
  waktu_pulang: string;
  toleransi_terlambat: number;
}

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

type LocationValidationStatus = 'dalam_lokasi' | 'di_luar_lokasi' | 'tidak_diketahui';
type TimeStatus = 'tepat_waktu' | 'terlambat' | 'pulang_cepat' | 'normal' | null;

export function AbsenStaffModal({ 
  open, 
  onOpenChange, 
  type, 
  staffId, 
  attendanceId,
  onSuccess 
}: AbsenStaffModalProps) {
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingStream, setPendingStream] = useState<MediaStream | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<'loading' | 'success' | 'error' | 'idle'>('idle');
  const [locationName, setLocationName] = useState<string>('Memuat lokasi...');
  const [validationStatus, setValidationStatus] = useState<LocationValidationStatus>('tidak_diketahui');
  const [distance, setDistance] = useState<number | null>(null);
  const [timeStatus, setTimeStatus] = useState<TimeStatus>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const queryClient = useQueryClient();

  const today = new Date();
  const currentTime = format(today, 'HH:mm:ss');
  const currentDate = format(today, 'EEEE, d MMMM yyyy', { locale: idLocale });

  // Fetch location settings
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
    staleTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
  });

  // Fetch work time rules
  const { data: aturanWaktuKerja } = useQuery({
    queryKey: ['aturan-waktu-kerja'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('aturan_waktu_kerja')
        .select('id, jabatan, waktu_masuk, waktu_pulang, toleransi_terlambat');
      
      if (error) throw error;
      return data as AturanWaktuKerja[];
    },
    enabled: open,
    staleTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
  });

  // Get staff role for matching work time rules
  const { data: staffRole } = useQuery({
    queryKey: ['staff-role', staffId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', staffId)
        .maybeSingle();
      
      if (error) throw error;
      return data?.role || null;
    },
    enabled: open && !!staffId
  });

  // Calculate time status based on work time rules
  useEffect(() => {
    if (!aturanWaktuKerja || aturanWaktuKerja.length === 0) {
      setTimeStatus(null);
      return;
    }

    // Find applicable rule: first try role-specific, then fall back to 'Standar'
    let applicableRule = aturanWaktuKerja.find(r => r.jabatan === staffRole);
    if (!applicableRule) {
      applicableRule = aturanWaktuKerja.find(r => r.jabatan === 'Standar');
    }

    if (!applicableRule) {
      setTimeStatus(null);
      return;
    }

    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    
    const [masukHour, masukMin] = applicableRule.waktu_masuk.substring(0, 5).split(':').map(Number);
    const waktuMasukMinutes = masukHour * 60 + masukMin;
    const toleransi = applicableRule.toleransi_terlambat || 0;
    const batasTolerasi = waktuMasukMinutes + toleransi;
    
    const [pulangHour, pulangMin] = applicableRule.waktu_pulang.substring(0, 5).split(':').map(Number);
    const waktuPulangMinutes = pulangHour * 60 + pulangMin;

    if (type === 'masuk') {
      if (nowMinutes <= batasTolerasi) {
        setTimeStatus('tepat_waktu');
      } else {
        setTimeStatus('terlambat');
      }
    } else {
      if (nowMinutes >= waktuPulangMinutes) {
        setTimeStatus('normal');
      } else {
        setTimeStatus('pulang_cepat');
      }
    }
  }, [aturanWaktuKerja, staffRole, type]);

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
  const getCurrentLocation = useCallback((isRetry = false) => {
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
      toast.error('Akses kamera ditolak. Mohon izinkan akses kamera untuk melakukan absensi.');
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
        // Resize to max 320x240 for storage optimization (~70% reduction)
        const maxWidth = 320;
        const maxHeight = 240;
        const scale = Math.min(maxWidth / video.videoWidth, maxHeight / video.videoHeight);
        
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Compress to 60% quality for additional size reduction
        const photoData = canvas.toDataURL('image/jpeg', 0.6);
        setCapturedPhoto(photoData);
        stopCamera();
      }
    }
  }, [stopCamera]);

  const retakePhoto = useCallback(() => {
    setCapturedPhoto(null);
    startCamera();
  }, [startCamera]);

  const handleSubmit = useCallback(async () => {
    if (!capturedPhoto || !location) {
      toast.error('Foto dan lokasi diperlukan untuk absen');
      return;
    }
    
    setIsSubmitting(true);
    try {
      // Upload photo to storage
      const response = await fetch(capturedPhoto);
      const blob = await response.blob();
      const fileName = `kehadiran-staff/${staffId}/${type}/${new Date().toISOString().replace(/:/g, '-')}.jpg`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('user-documents')
        .upload(fileName, blob, { contentType: 'image/jpeg' });

      if (uploadError || !uploadData) {
        console.error('Upload foto absen staff gagal:', uploadError);
        throw new Error(`Gagal mengupload foto absen: ${uploadError?.message || 'Upload tidak menghasilkan data'}. Silakan coba lagi.`);
      }
      const photoUrl: string = supabase.storage.from('user-documents').getPublicUrl(uploadData.path).data.publicUrl;

      const todayDate = format(new Date(), 'yyyy-MM-dd');
      const currentTimeHMS = format(new Date(), 'HH:mm:ss');

      // Determine location status text for database
      const statusLokasiText = validationStatus === 'dalam_lokasi' 
        ? 'dalam_lokasi' 
        : validationStatus === 'di_luar_lokasi' 
          ? 'di_luar_lokasi' 
          : 'tidak_diketahui';

      if (type === 'masuk') {
        // Check if record already exists for today (e.g., from approved leave)
        const { data: existingRecord } = await supabase
          .from('kehadiran_staff')
          .select('id')
          .eq('staff_id', staffId)
          .eq('tanggal', todayDate)
          .maybeSingle();

        if (existingRecord) {
          // Update existing record
          const { error } = await supabase
            .from('kehadiran_staff')
            .update({
              jam_masuk: currentTimeHMS,
              latitude_masuk: location.lat,
              longitude_masuk: location.lng,
              status_lokasi_masuk: statusLokasiText,
              foto_masuk_url: photoUrl,
              status: null // Clear any previous status like 'izin'
            })
            .eq('id', existingRecord.id);
          
          if (error) throw error;
        } else {
          // Insert new attendance record
          const { error } = await supabase
            .from('kehadiran_staff')
            .insert({
              staff_id: staffId,
              tanggal: todayDate,
              jam_masuk: currentTimeHMS,
              latitude_masuk: location.lat,
              longitude_masuk: location.lng,
              status_lokasi_masuk: statusLokasiText,
              foto_masuk_url: photoUrl
            });
          
          if (error) {
            if (error.code === '23505') {
              throw new Error('Anda sudah absen masuk hari ini');
            }
            throw error;
          }
        }
        
        toast.success('Absen masuk berhasil');
      } else {
        // Update existing attendance record
        if (!attendanceId) throw new Error('Data kehadiran tidak ditemukan');
        
        const { error } = await supabase
          .from('kehadiran_staff')
          .update({
            jam_pulang: currentTimeHMS,
            latitude_pulang: location.lat,
            longitude_pulang: location.lng,
            status_lokasi_pulang: statusLokasiText,
            foto_pulang_url: photoUrl
          })
          .eq('id', attendanceId);
        
        if (error) throw error;
        
        toast.success('Absen pulang berhasil');
      }
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['kehadiran-staff-today'] });
      queryClient.invalidateQueries({ queryKey: ['kehadiran-staff-range'] });
      
      if (onSuccess) onSuccess();
      handleClose();
    } catch (error: any) {
      console.error('Submit error:', error);
      toast.error(error.message || 'Terjadi kesalahan saat menyimpan absensi');
    } finally {
      setIsSubmitting(false);
    }
  }, [capturedPhoto, location, staffId, type, attendanceId, queryClient, onSuccess]);

  const handleClose = useCallback(() => {
    stopCamera();
    setCapturedPhoto(null);
    setCameraActive(false);
    setLocation(null);
    setLocationStatus('idle');
    setLocationName('Memuat lokasi...');
    setTimeStatus(null);
    setValidationStatus('tidak_diketahui');
    setDistance(null);
    onOpenChange(false);
  }, [stopCamera, onOpenChange]);

  const isReady = capturedPhoto && location && locationStatus === 'success';

  return (
    <Drawer open={open} onOpenChange={handleClose}>
      <DrawerContent className="max-h-[90vh] flex flex-col">
        {/* Header */}
        <DrawerHeader className="px-6 py-4 border-b border-border">
          <DrawerTitle>
            {type === 'masuk' ? 'Absen Masuk' : 'Absen Pulang'}
          </DrawerTitle>
          <DrawerDescription className="sr-only">
            Drawer untuk mengambil foto selfie sebagai konfirmasi kehadiran
          </DrawerDescription>
        </DrawerHeader>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Info Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Calendar className="h-4 w-4" />
                <span className="text-xs">Tanggal</span>
              </div>
              <p className="text-sm font-medium text-foreground">{currentDate}</p>
            </div>
            <div className={`p-3 rounded-lg border ${
              timeStatus === 'tepat_waktu' || timeStatus === 'normal'
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                : timeStatus === 'terlambat' || timeStatus === 'pulang_cepat'
                  ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                  : 'bg-muted/30 border-border/50'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span className="text-xs">Jam</span>
                </div>
                {timeStatus && (
                  <Badge 
                    variant="outline" 
                    className={
                      timeStatus === 'tepat_waktu' || timeStatus === 'normal'
                        ? 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/50 dark:text-green-400' 
                        : 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/50 dark:text-amber-400'
                    }
                  >
                    {(timeStatus === 'tepat_waktu' || timeStatus === 'normal') && <CheckCircle2 className="h-3 w-3 mr-1" />}
                    {(timeStatus === 'terlambat' || timeStatus === 'pulang_cepat') && <AlertTriangle className="h-3 w-3 mr-1" />}
                    {timeStatus === 'tepat_waktu' ? 'Tepat Waktu' : 
                     timeStatus === 'terlambat' ? 'Terlambat' : 
                     timeStatus === 'pulang_cepat' ? 'Pulang Cepat' : 'Normal'}
                  </Badge>
                )}
              </div>
              <p className="text-sm font-medium text-foreground font-mono">{currentTime}</p>
            </div>
          </div>

          {/* Location Info */}
          <div className={`p-3 rounded-lg border ${
            validationStatus === 'dalam_lokasi' 
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
              : validationStatus === 'di_luar_lokasi'
                ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                : 'bg-muted/30 border-border/50'
          }`}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span className="text-xs">Lokasi</span>
                {locationStatus === 'loading' && (
                  <span className="text-xs text-muted-foreground animate-pulse">Memuat...</span>
                )}
              </div>
              {locationStatus === 'success' && (
                <Badge 
                  variant="outline" 
                  className={
                    validationStatus === 'dalam_lokasi' 
                      ? 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/50 dark:text-green-400' 
                      : validationStatus === 'di_luar_lokasi'
                        ? 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/50 dark:text-amber-400'
                        : 'bg-muted text-muted-foreground'
                  }
                >
                  {validationStatus === 'dalam_lokasi' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                  {validationStatus === 'di_luar_lokasi' && <AlertTriangle className="h-3 w-3 mr-1" />}
                  {validationStatus === 'tidak_diketahui' && <HelpCircle className="h-3 w-3 mr-1" />}
                  {validationStatus === 'dalam_lokasi' ? 'Dalam Lokasi' : validationStatus === 'di_luar_lokasi' ? 'Di Luar Lokasi' : 'Tidak Diketahui'}
                </Badge>
              )}
            </div>
            <p className={`text-sm font-medium ${locationStatus === 'error' ? 'text-destructive' : 'text-foreground'}`}>
              {locationName}
            </p>
            {distance !== null && validationStatus !== 'tidak_diketahui' && (
              <p className="text-xs text-muted-foreground mt-1">
                Jarak: {distance}m {lokasiAbsen ? `(radius: ${lokasiAbsen.radius}m)` : ''}
              </p>
            )}
            {locationStatus === 'error' && (
              <Button variant="link" size="sm" className="h-auto p-0 mt-1" onClick={() => getCurrentLocation()}>
                Coba lagi
              </Button>
            )}
          </div>

          {/* Camera Preview */}
          <div className="relative aspect-[4/3] bg-muted rounded-xl overflow-hidden border-2 border-dashed border-border w-full">
            {!cameraActive && !capturedPhoto && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6">
                <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary/20">
                  <Camera className="h-10 w-10 text-primary" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    Konfirmasi Kehadiran
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Ambil foto selfie untuk {type === 'masuk' ? 'absen masuk' : 'absen pulang'}
                  </p>
                </div>
                <Button onClick={startCamera} size="lg" className="rounded-xl mt-2">
                  <Camera className="h-4 w-4 mr-2" />
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
        </div>

        {/* Footer Actions */}
        <DrawerFooter className="px-6 py-4 border-t border-border flex-row items-center justify-end gap-2">
          {/* Camera actions */}
          {cameraActive && (
            <>
              <Button variant="outline" onClick={stopCamera}>
                <X className="h-4 w-4 mr-2" />
                Batal
              </Button>
              <Button onClick={capturePhoto}>
                <Camera className="h-4 w-4 mr-2" />
                Ambil Foto
              </Button>
            </>
          )}

          {capturedPhoto && (
            <>
              <Button variant="outline" onClick={retakePhoto} disabled={isSubmitting}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Ulangi
              </Button>
              <Button 
                onClick={handleSubmit} 
                disabled={!isReady || isSubmitting}
              >
                <Check className="h-4 w-4 mr-2" />
                {isSubmitting ? 'Menyimpan...' : (type === 'masuk' ? 'Absen Sekarang' : 'Absen Pulang')}
              </Button>
            </>
          )}

          {!cameraActive && !capturedPhoto && (
            <Button variant="outline" onClick={handleClose}>
              <X className="h-4 w-4 mr-2" />
              Batal
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
