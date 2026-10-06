import React, { useState, useEffect, useRef } from 'react';
import { UserProfile } from '@/types/hrm';
import { biometricService } from '@/services/biometricService';
import { hrmService, safeSetJson } from '@/services/hrmService';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Camera,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  ScanFace,
  Loader2,
  QrCode,
  Smartphone,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react';
import QRCode from 'qrcode';
import { api } from '@/services/apiClient';

interface HrmFaceEnrollmentModalProps {
  open: boolean;
  user: UserProfile | null;
  onClose: () => void;
  onSuccess?: (updatedUser: UserProfile) => void;
}

export const HrmFaceEnrollmentModal: React.FC<HrmFaceEnrollmentModalProps> = ({
  open,
  user,
  onClose,
  onSuccess,
}) => {
  // Mode selection: 'qr_mobile' (Recommended) vs 'laptop_cam'
  const [enrollMode, setEnrollMode] = useState<'qr_mobile' | 'laptop_cam'>('qr_mobile');
  const [qrImageUrl, setQrImageUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [isMobileEnrolledSuccess, setIsMobileEnrolledSuccess] = useState(false);
  const [enrolledPhotoPreview, setEnrolledPhotoPreview] = useState<string | null>(null);
  const [enrolledUserObj, setEnrolledUserObj] = useState<UserProfile | null>(null);

  // Laptop Camera States
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [step, setStep] = useState<'camera' | 'review'>('camera');
  const [samples, setSamples] = useState<number[][]>([]);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [qualityMsg, setQualityMsg] = useState('Posisikan wajah Anda pas di dalam lingkaran');
  const [isQualityGood, setIsQualityGood] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [modelLoadingStatus, setModelLoadingStatus] = useState('Memuat model neural network AI...');

  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const isCapturingRef = useRef(false);
  const lastMsgTimeRef = useRef(0);
  const lastMsgRef = useRef('');

  // Dynamic Enrollment URL for mobile handoff (always use official domain on mobile APK/Capacitor/localhost)
  const getEnrollBaseUrl = () => {
    if (
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.protocol === 'capacitor:' ||
        window.location.origin.includes('localhost'))
    ) {
      return 'https://fawwazreskiperwira.com';
    }
    return window.location.origin;
  };

  const mobileEnrollUrl = user
    ? `${getEnrollBaseUrl()}/enroll-face?userId=${encodeURIComponent(user.id)}&name=${encodeURIComponent(
        user.fullName
      )}&token=${user.id.substring(0, 8)}`
    : '';

  // Generate high-resolution QR Code when modal opens or user changes
  useEffect(() => {
    if (!open || !user || !mobileEnrollUrl) return;

    setIsMobileEnrolledSuccess(false);
    setEnrolledPhotoPreview(null);
    setEnrolledUserObj(null);

    QRCode.toDataURL(mobileEnrollUrl, {
      width: 320,
      margin: 1.5,
      color: {
        dark: '#020617',
        light: '#ffffff',
      },
    })
      .then((url) => setQrImageUrl(url))
      .catch((err) => console.error('Failed generating QR enrollment code:', err));
  }, [open, user, mobileEnrollUrl]);

  // Polling listener: Detect when smartphone finishes enrollment
  useEffect(() => {
    if (!open || !user || enrollMode !== 'qr_mobile' || isMobileEnrolledSuccess) return;

    const pollInterval = setInterval(async () => {
      // 1. Poll PostgreSQL database on server
      try {
        const res = await api.get<{ success: boolean; data: UserProfile }>(`/users/${user.id}`);
        if (res && res.success && res.data && (res.data.isFaceEnrolled || res.data.faceEnrolledPhoto || res.data.avatarUrl)) {
          const photo = res.data.faceEnrolledPhoto || res.data.avatarUrl || null;
          setIsMobileEnrolledSuccess(true);
          setEnrolledPhotoPreview(photo);
          setEnrolledUserObj(res.data);

          // Update local cache immediately
          const currentUsers = hrmService.getUsers();
          const uIdx = currentUsers.findIndex((u) => u.id === user.id || u.nip === user.nip);
          if (uIdx !== -1) {
            currentUsers[uIdx] = {
              ...currentUsers[uIdx],
              ...res.data,
              isFaceEnrolled: true,
              avatarUrl: photo || currentUsers[uIdx].avatarUrl,
              faceEnrolledPhoto: photo || currentUsers[uIdx].faceEnrolledPhoto,
            };
            safeSetJson('hrm_users', currentUsers);
            window.dispatchEvent(new Event('hrm_users_updated'));
          }

          if (onSuccess) onSuccess(res.data);
          return;
        }
      } catch (err) {
        // Silent fallback to local storage check
      }

      // 2. Fallback check local storage
      const freshUsers = hrmService.getUsers();
      const targetUser = freshUsers.find((u) => u.id === user.id || u.nip === user.nip);

      if (targetUser && (targetUser.isFaceEnrolled || targetUser.faceEnrolledPhoto || targetUser.avatarUrl)) {
        const photo = targetUser.faceEnrolledPhoto || targetUser.avatarUrl || null;
        setIsMobileEnrolledSuccess(true);
        setEnrolledPhotoPreview(photo);
        setEnrolledUserObj(targetUser);
        if (onSuccess) onSuccess(targetUser);
      }
    }, 1800);

    return () => clearInterval(pollInterval);
  }, [open, user, enrollMode, isMobileEnrolledSuccess, onSuccess]);

  // Preload face-api models when laptop camera mode is activated
  useEffect(() => {
    if (!open || enrollMode !== 'laptop_cam') return;
    if (!biometricService.isReady()) {
      setIsModelLoading(true);
      biometricService
        .loadModels((status) => setModelLoadingStatus(status))
        .then(() => setIsModelLoading(false))
        .catch(() => setIsModelLoading(false));
    }
  }, [open, enrollMode]);

  // Start camera stream when in laptop_cam mode
  useEffect(() => {
    if (!open || enrollMode !== 'laptop_cam') {
      handleStopCamera();
      return;
    }

    startCamera();

    return () => {
      handleStopCamera();
    };
  }, [open, enrollMode, facingMode]);

  const startCamera = async () => {
    handleStopCamera();
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => null);
      }
    } catch (err: any) {
      setErrorMsg('Akses kamera laptop tidak tersedia. Rekomendasi: Gunakan mode Scan QR Smartphone.');
    }
  };

  const handleStopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => {
        track.enabled = false;
        track.stop();
      });
      setCameraStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // Face tracking loop for laptop camera mode
  useEffect(() => {
    let animId: number;

    const detectLoop = async () => {
      if (
        !open ||
        enrollMode !== 'laptop_cam' ||
        step !== 'camera' ||
        isModelLoading ||
        !videoRef.current ||
        videoRef.current.readyState < 2 ||
        !overlayCanvasRef.current
      ) {
        animId = requestAnimationFrame(detectLoop);
        return;
      }

      const video = videoRef.current;
      const canvas = overlayCanvasRef.current;

      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
      }

      try {
        const detail = await biometricService.detectFaceDetail(video);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          if (detail) {
            biometricService.drawFaceHUD(canvas, detail, {
              isMatch: isQualityGood,
              label: isQualityGood ? 'POSISI OPTIMAL' : 'MENYELARASKAN...',
            });
          }
        }

        if (!detail) {
          setIsQualityGood(false);
          const now = Date.now();
          if (lastMsgRef.current !== 'Posisikan wajah Anda pas di dalam lingkaran' && now - lastMsgTimeRef.current > 350) {
            lastMsgRef.current = 'Posisikan wajah Anda pas di dalam lingkaran';
            lastMsgTimeRef.current = now;
            setQualityMsg('Posisikan wajah Anda pas di dalam lingkaran');
          }
        } else {
          const quality = biometricService.checkImageQuality(detail, canvas.width, canvas.height);
          setIsQualityGood(quality.passed);

          const now = Date.now();
          if (lastMsgRef.current !== quality.message && (now - lastMsgTimeRef.current > 350 || quality.passed)) {
            lastMsgRef.current = quality.message;
            lastMsgTimeRef.current = now;
            setQualityMsg(quality.message);
          }

          if (quality.passed && detail.descriptor && !isCapturingRef.current && samples.length < 3) {
            isCapturingRef.current = true;
            const descArray = Array.from(detail.descriptor);

            setSamples((prev) => {
              const next = [...prev, descArray];
              if (next.length === 1 && !capturedPhoto) {
                const snapCanvas = document.createElement('canvas');
                snapCanvas.width = video.videoWidth;
                snapCanvas.height = video.videoHeight;
                const snapCtx = snapCanvas.getContext('2d');
                if (snapCtx) {
                  if (facingMode === 'user') {
                    snapCtx.translate(snapCanvas.width, 0);
                    snapCtx.scale(-1, 1);
                  }
                  snapCtx.drawImage(video, 0, 0);
                  setCapturedPhoto(snapCanvas.toDataURL('image/jpeg', 0.9));
                }
              }

              if (next.length >= 3) {
                handleStopCamera();
                setTimeout(() => setStep('review'), 300);
              }
              return next;
            });

            setTimeout(() => {
              isCapturingRef.current = false;
            }, 600);
          }
        }
      } catch (err) {
        // Ignored frame glitch
      }

      animId = requestAnimationFrame(detectLoop);
    };

    animId = requestAnimationFrame(detectLoop);
    return () => cancelAnimationFrame(animId);
  }, [open, enrollMode, step, isModelLoading, facingMode, samples.length, isQualityGood]);

  const handleRetake = () => {
    setSamples([]);
    setCapturedPhoto(null);
    setStep('camera');
    setErrorMsg(null);
    startCamera();
  };

  const handleSaveMaster = async () => {
    if (!user || samples.length === 0 || !capturedPhoto) {
      setErrorMsg('Data sampel biometrik belum lengkap.');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);
    try {
      const averageDescriptor = biometricService.computeCentroidDescriptor(samples);

      const updated = await hrmService.enrollMasterFace(user.id, averageDescriptor, capturedPhoto);
      if (onSuccess) onSuccess(updated);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menyimpan wajah master ke database.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyLink = () => {
    if (!mobileEnrollUrl) return;
    navigator.clipboard.writeText(mobileEnrollUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md w-full p-0 overflow-hidden rounded-2xl bg-card border border-border shadow-2xl">
        <DialogHeader className="p-5 pb-3 border-b border-border/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shrink-0">
              <ScanFace className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Pendaftaran Wajah Master Biometrik
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {user ? `${user.fullName} (${user.nip})` : 'Karyawan'}
              </DialogDescription>
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-muted/60 rounded-xl mt-3 border border-border/60">
            <button
              type="button"
              onClick={() => {
                setEnrollMode('qr_mobile');
                handleStopCamera();
              }}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
                enrollMode === 'qr_mobile'
                  ? 'bg-card text-foreground shadow-xs border border-border/80'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <QrCode className="w-3.5 h-3.5 text-primary" />
              <span>Scan QR HP</span>
              <Badge className="text-[9px] px-1.5 py-0 h-4 bg-emerald-500/15 text-emerald-600 border-emerald-500/30">
                HD
              </Badge>
            </button>

            <button
              type="button"
              onClick={() => {
                setEnrollMode('laptop_cam');
                setStep('camera');
                setSamples([]);
                setCapturedPhoto(null);
              }}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
                enrollMode === 'laptop_cam'
                  ? 'bg-card text-foreground shadow-xs border border-border/80'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Camera className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Kamera Laptop</span>
            </button>
          </div>
        </DialogHeader>

        {errorMsg && (
          <div className="mx-5 mt-3 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* ═══ OPTION 1: QR CODE MOBILE HANDOFF ════════════════════════════════ */}
        {enrollMode === 'qr_mobile' && (
          <div className="p-5 space-y-4">
            {isMobileEnrolledSuccess ? (
              <div className="py-6 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 flex items-center justify-center mx-auto animate-bounce">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-foreground">Wajah Master HD Berhasil Terdaftar!</h3>
                  <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                    Karyawan <strong>{user?.fullName}</strong> berhasil mendaftarkan biometrik resolusi tinggi melalui smartphone.
                  </p>
                </div>

                {enrolledPhotoPreview && (
                  <div className="w-28 h-28 rounded-full overflow-hidden mx-auto border-4 border-emerald-500/40 shadow-xl">
                    <img src={enrolledPhotoPreview} alt="Enrolled Master Face" className="w-full h-full object-cover" />
                  </div>
                )}

                <div className="pt-2">
                  <Button
                    onClick={() => {
                      if (onSuccess && enrolledUserObj) {
                        onSuccess(enrolledUserObj);
                      }
                      onClose();
                    }}
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground text-xs rounded-xl h-10 font-semibold"
                  >
                    Selesai &amp; Tutup Modal
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-col items-center text-center space-y-3">
                  <div className="p-3 bg-white rounded-2xl border-2 border-border shadow-md">
                    {qrImageUrl ? (
                      <img src={qrImageUrl} alt="QR Enrollment Handoff" className="w-48 h-48 rounded-xl object-contain" />
                    ) : (
                      <div className="w-48 h-48 flex items-center justify-center">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      </div>
                    )}
                  </div>

                  {/* Pulsating Live Radar Status */}
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                    </span>
                    <span>Menunggu koneksi dari smartphone...</span>
                  </div>

                  <div className="space-y-1 max-w-xs">
                    <p className="text-xs font-semibold text-foreground">
                      Pindai dengan Kamera HP atau Buka Langsung
                    </p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Sistem akan memandu Anda melalui 6 pose presisi (dekat, jauh, berkedip, senyum, menoleh) untuk akurasi biometrik standar ISO.
                    </p>
                  </div>

                  {/* Direct Launch Button for Mobile Users */}
                  <div className="w-full pt-1">
                    <Button
                      type="button"
                      onClick={() => {
                        if (typeof window !== 'undefined' && user) {
                          const targetPath = `/enroll-face?userId=${encodeURIComponent(user.id)}&name=${encodeURIComponent(user.fullName)}&token=${user.id.substring(0, 8)}`;
                          window.location.href = targetPath;
                        }
                      }}
                      className="w-full bg-primary hover:bg-primary/90 text-primary-foreground text-xs rounded-xl h-10 font-bold gap-2 shadow-md"
                    >
                      <ScanFace className="w-4 h-4" />
                      <span>Buka Pendaftaran Wajah di HP Ini</span>
                      <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                    </Button>
                  </div>
                </div>

                {/* Alternative Direct Link Copy */}
                <div className="p-3 bg-muted/40 border border-border rounded-xl flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs truncate">
                    <Smartphone className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-muted-foreground truncate max-w-[200px] font-mono text-[11px]">
                      {mobileEnrollUrl}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCopyLink}
                    className="h-8 text-xs rounded-lg gap-1.5 shrink-0"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-600 font-semibold">Tersalin</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Salin</span>
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ═══ OPTION 2: LAPTOP / USB WEBCAM ════════════════════════════════════ */}
        {enrollMode === 'laptop_cam' && (
          <>
            {isModelLoading && (
              <div className="mx-5 mt-3 p-2.5 bg-primary/10 border border-primary/20 text-primary text-xs rounded-xl flex items-center gap-2 animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                <span>{modelLoadingStatus}</span>
              </div>
            )}

            {step === 'camera' ? (
              <div className="p-5 space-y-4">
                <div className="relative w-full aspect-square bg-slate-950 rounded-2xl overflow-hidden border border-border/80 flex items-center justify-center shadow-inner">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${facingMode === 'user' ? '-scale-x-100' : ''}`}
                  />
                  <canvas
                    ref={overlayCanvasRef}
                    className={`absolute inset-0 w-full h-full pointer-events-none ${
                      facingMode === 'user' ? '-scale-x-100' : ''
                    }`}
                  />

                  {/* Center Guidance Ring */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <div
                      className={`w-52 h-64 rounded-[50%] border-2 transition-all duration-300 ${
                        isQualityGood
                          ? 'border-emerald-500 shadow-[0_0_24px_rgba(16,185,129,0.4)]'
                          : 'border-cyan-400/60 border-dashed animate-pulse'
                      }`}
                    />
                    <div className="absolute inset-x-0 bottom-3 px-4 text-center">
                      <span
                        className={`inline-block text-[11px] font-medium px-3 py-1 rounded-full backdrop-blur-md shadow-sm border ${
                          isQualityGood
                            ? 'bg-emerald-500/80 text-white border-emerald-400/40'
                            : 'bg-black/75 text-slate-200 border-white/10'
                        }`}
                      >
                        {qualityMsg}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setFacingMode(facingMode === 'user' ? 'environment' : 'user')}
                    className="absolute top-3 right-3 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur-md border border-white/20 transition-all active:scale-95"
                    title="Ganti Kamera"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>

                <div className="bg-muted/40 p-3 rounded-2xl border border-border/60 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-primary" />
                      Pengambilan Sampel AI ResNet-34 (3 Frame)
                    </span>
                    <span className="font-mono text-muted-foreground">{samples.length}/3 Selesai</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {[1, 2, 3].map((i) => {
                      const done = samples.length >= i;
                      return (
                        <div
                          key={i}
                          className={`py-1.5 px-2 rounded-xl text-center text-[10px] font-medium transition-all border ${
                            done
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                              : 'bg-background text-muted-foreground border-border'
                          }`}
                        >
                          {done ? `✓ Frame ${i}` : `Frame ${i}`}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-5 space-y-4">
                <div className="flex flex-col items-center text-center space-y-3">
                  {capturedPhoto && (
                    <div className="relative w-40 h-40 rounded-full p-1 bg-gradient-to-tr from-emerald-500 to-cyan-500 shadow-xl overflow-hidden">
                      <img
                        src={capturedPhoto}
                        alt="Master Face Preview"
                        className="w-full h-full object-cover rounded-full"
                      />
                      <div className="absolute bottom-1 right-1 w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-md border-2 border-card">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                    </div>
                  )}

                  <div>
                    <h3 className="text-sm font-bold text-foreground">{user?.fullName}</h3>
                    <p className="text-xs font-mono text-muted-foreground">NIP: {user?.nip}</p>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">
                      ✓ 128-D Vektor Terkalibrasi
                    </Badge>
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px]">
                      3 Frame Centroid L2
                    </Badge>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        <DialogFooter className="p-4 bg-muted/20 border-t border-border/80 flex sm:justify-between gap-2">
          {enrollMode === 'qr_mobile' ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (isMobileEnrolledSuccess && onSuccess && enrolledUserObj) {
                  onSuccess(enrolledUserObj);
                }
                onClose();
              }}
              className="rounded-xl text-xs w-full sm:w-auto"
            >
              Tutup
            </Button>
          ) : step === 'camera' ? (
            <Button variant="outline" size="sm" onClick={onClose} className="rounded-xl text-xs w-full sm:w-auto">
              Batal
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetake}
                disabled={isSaving}
                className="rounded-xl text-xs flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Ambil Ulang
              </Button>
              <Button
                size="sm"
                onClick={handleSaveMaster}
                disabled={isSaving}
                className="rounded-xl text-xs flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                {isSaving ? 'Menyimpan...' : 'Simpan Wajah Master'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
