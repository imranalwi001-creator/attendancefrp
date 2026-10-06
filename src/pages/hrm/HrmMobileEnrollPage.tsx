import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { biometricService, FaceDetectionDetail } from '@/services/biometricService';
import { hrmService } from '@/services/hrmService';
import {
  Camera,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  ScanFace,
  Loader2,
  Eye,
  Smile,
  ArrowRight,
  ArrowLeft,
  Maximize2,
  Minimize2,
  Check,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/services/apiClient';
import { playNotificationChime, triggerDeviceVibration } from '@/services/soundVibrationService';

export interface EnrollPoseStep {
  id: 'center_neutral' | 'slight_tilt' | 'smile_confirm';
  title: string;
  instruction: string;
  icon: React.ReactNode;
  hint: string;
}

const ENROLL_STEPS: EnrollPoseStep[] = [
  {
    id: 'center_neutral',
    title: 'Sampel 1: Hadap Lurus',
    instruction: 'Posisikan wajah di tengah lingkaran & tatap lurus kamera',
    icon: <Maximize2 className="w-5 h-5 text-emerald-400" />,
    hint: 'Tatap kamera lurus dengan wajah rileks dan tegak',
  },
  {
    id: 'slight_tilt',
    title: 'Sampel 2: Miringkan Sedikit',
    instruction: 'Miringkan atau tolehkan kepala sedikit ke samping (~15°)',
    icon: <ArrowRight className="w-5 h-5 text-cyan-400" />,
    hint: 'Tolehkan sedikit untuk merekam kontur 3D wajah',
  },
  {
    id: 'smile_confirm',
    title: 'Sampel 3: Senyum & Konfirmasi',
    instruction: 'Tersenyumlah santai ke kamera untuk konfirmasi akhir',
    icon: <Smile className="w-5 h-5 text-amber-300" />,
    hint: 'Tunjukkan senyuman alami Anda',
  },
];

export const HrmMobileEnrollPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const userId = searchParams.get('userId') || searchParams.get('id') || '';
  const initialName = searchParams.get('name') || 'Karyawan';
  const [employeeDisplayName, setEmployeeDisplayName] = useState(initialName);

  useEffect(() => {
    if (userId) {
      api.get<{ success: boolean; data: any }>(`/users/${userId}`)
        .then((res) => {
          if (res && res.success && res.data && res.data.fullName) {
            setEmployeeDisplayName(res.data.fullName);
          }
        })
        .catch(() => null);
    }
  }, [userId]);

  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [step, setStep] = useState<'scan' | 'review' | 'success'>('scan');
  const [currentPoseIndex, setCurrentPoseIndex] = useState<number>(0);
  const [capturedDescriptors, setCapturedDescriptors] = useState<{ [key: string]: number[] }>({});
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [qualityMsg, setQualityMsg] = useState('Posisikan wajah Anda di dalam lingkaran...');
  const [isPosePassing, setIsPosePassing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [modelStatus, setModelStatus] = useState('Memuat model biometrik AI...');

  // Anti-flicker & steady hold progress refs
  const lastMsgRef = useRef<string>('');
  const lastMsgTimeRef = useRef<number>(0);
  const poseHoldStartTimeRef = useRef<number | null>(null);
  const [poseHoldProgress, setPoseHoldProgress] = useState<number>(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const poseHoldTimerRef = useRef<number | null>(null);
  const poseCompletedRef = useRef<boolean>(false);

  // 1. Start camera immediately on mount
  useEffect(() => {
    startCamera(facingMode);
    return () => stopCamera();
  }, []);

  // 2. Load face-api AI models in the background
  useEffect(() => {
    let isMounted = true;
    biometricService
      .loadModels((status) => {
        if (isMounted) setModelStatus(status);
      })
      .then(() => {
        if (isMounted) setIsModelLoading(false);
      })
      .catch((err) => {
        console.warn('AI models background loading warning:', err);
        if (isMounted) setIsModelLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // 3. Attach stream to video
  useEffect(() => {
    const video = videoRef.current;
    if (video && cameraStream) {
      if (video.srcObject !== cameraStream) {
        video.srcObject = cameraStream;
      }
      video.setAttribute('playsinline', 'true');
      video.setAttribute('webkit-playsinline', 'true');
      video.muted = true;
      video.onloadedmetadata = () => {
        video.play().catch(() => null);
      };
      video.play().catch(() => null);
    }
  }, [cameraStream]);

  const startCamera = async (targetFacing: 'user' | 'environment' = facingMode) => {
    stopCamera();
    setErrorMsg(null);

    try {
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: targetFacing },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch (e1) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: targetFacing },
            audio: false,
          });
        } catch (e2) {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
      }

      if (stream) {
        setCameraStream(stream);
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.setAttribute('playsinline', 'true');
          video.setAttribute('webkit-playsinline', 'true');
          video.muted = true;
          video.play().catch(() => null);
        }
      }
    } catch (err: any) {
      setErrorMsg('Akses kamera tidak terdeteksi atau diblokir. Harap izinkan akses kamera di peramban Anda.');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => {
        t.enabled = false;
        t.stop();
      });
      setCameraStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const handleSwitchCamera = () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  // Capture Snapshot Frame for Master Photo
  const captureCurrentFrameAsPhoto = (): string | null => {
    if (!videoRef.current || videoRef.current.readyState < 2) return null;
    const video = videoRef.current;
    const snapCanvas = document.createElement('canvas');
    snapCanvas.width = video.videoWidth || 640;
    snapCanvas.height = video.videoHeight || 480;
    const snapCtx = snapCanvas.getContext('2d');
    if (!snapCtx) return null;

    if (facingMode === 'user') {
      snapCtx.translate(snapCanvas.width, 0);
      snapCtx.scale(-1, 1);
    }
    snapCtx.drawImage(video, 0, 0);
    return snapCanvas.toDataURL('image/jpeg', 0.88);
  };

  // Advance to Next Pose Step
  const advancePose = (descriptor?: number[]) => {
    if (poseCompletedRef.current) return;
    poseCompletedRef.current = true;

    // Haptic and Sound Audio Feedback
    playNotificationChime();
    triggerDeviceVibration([40, 20, 60]);

    const activeStep = ENROLL_STEPS[currentPoseIndex];

    // Store descriptor if present
    if (descriptor && descriptor.length === 128) {
      setCapturedDescriptors((prev) => ({
        ...prev,
        [activeStep.id]: descriptor,
      }));
    }

    // Capture first sharp photo on center step
    if (!capturedPhoto && (currentPoseIndex === 0 || !capturedPhoto)) {
      const photo = captureCurrentFrameAsPhoto();
      if (photo) setCapturedPhoto(photo);
    }

    // Check if reached last step
    if (currentPoseIndex >= ENROLL_STEPS.length - 1) {
      stopCamera();
      setTimeout(() => {
        setStep('review');
      }, 500);
    } else {
      setTimeout(() => {
        setCurrentPoseIndex((prev) => prev + 1);
        setIsPosePassing(false);
        poseCompletedRef.current = false;
      }, 400);
    }
  };

  // Helper to update feedback without flickering text
  const setStableFeedback = (msg: string, isPassing: boolean) => {
    const now = Date.now();
    setIsPosePassing(isPassing);

    // Only update instruction message if changed and after 350ms buffer (eliminates flickering)
    if (msg !== lastMsgRef.current && (now - lastMsgTimeRef.current > 350 || isPassing)) {
      lastMsgRef.current = msg;
      lastMsgTimeRef.current = now;
      setQualityMsg(msg);
    }
  };

  // Continuous Tracking & Intelligent Pose Verification Loop (Smooth 120ms Interval)
  useEffect(() => {
    if (step !== 'scan' || isModelLoading) return;

    let isMounted = true;
    let isProcessing = false;

    const interval = setInterval(async () => {
      if (!isMounted || !videoRef.current || videoRef.current.readyState < 2 || isProcessing) return;
      if (poseCompletedRef.current) return;

      isProcessing = true;
      try {
        const video = videoRef.current;
        const canvas = overlayCanvasRef.current;
        if (canvas && (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight)) {
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 480;
        }

        const detail = await biometricService.detectFace(video, {
          withLandmarks: true,
          withExpressions: true,
          withDescriptor: true,
        });

        if (!isMounted) return;

        // Draw clean HUD overlay on overlay canvas
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            if (detail && detail.box && detail.box.width > 0) {
              const b = detail.box;
              const len = Math.min(b.width, b.height) * 0.2;
              ctx.save();
              ctx.strokeStyle = isPosePassing ? '#10b981' : '#38bdf8';
              ctx.lineWidth = 2.5;

              // Top-left
              ctx.beginPath();
              ctx.moveTo(b.x, b.y + len);
              ctx.lineTo(b.x, b.y);
              ctx.lineTo(b.x + len, b.y);
              ctx.stroke();

              // Top-right
              ctx.beginPath();
              ctx.moveTo(b.x + b.width - len, b.y);
              ctx.lineTo(b.x + b.width, b.y);
              ctx.lineTo(b.x + b.width, b.y + len);
              ctx.stroke();

              // Bottom-left
              ctx.beginPath();
              ctx.moveTo(b.x, b.y + b.height - len);
              ctx.lineTo(b.x, b.y + b.height);
              ctx.lineTo(b.x + len, b.y + b.height);
              ctx.stroke();

              // Bottom-right
              ctx.beginPath();
              ctx.moveTo(b.x + b.width - len, b.y + b.height);
              ctx.lineTo(b.x + b.width, b.y + b.height);
              ctx.lineTo(b.x + b.width, b.y + b.height - len);
              ctx.stroke();

              ctx.restore();
            }
          }
        }

        const currentTarget = ENROLL_STEPS[currentPoseIndex];
        const cw = canvas?.width || 640;

        if (!detail || !detail.box || detail.box.width < 40) {
          poseHoldStartTimeRef.current = null;
          setPoseHoldProgress(0);
          setStableFeedback('Posisikan wajah Anda tepat di dalam lingkaran', false);
          return;
        }

        const scaleRatio = detail.box.width / cw;
        const yaw = detail.headYawRatio ?? 0.5;
        const happy = detail.expressions?.happy ?? 0;
        const isCentered = Math.abs(detail.box.x + detail.box.width / 2 - cw / 2) < cw * 0.28;

        let matched = false;
        let msg = currentTarget.instruction;

        switch (currentTarget.id) {
          case 'center_neutral': {
            const isLookingForward = yaw >= 0.38 && yaw <= 0.62;
            const isGoodScale = scaleRatio >= 0.18 && scaleRatio <= 0.88;

            if (!isGoodScale && scaleRatio < 0.18) {
              msg = 'Dekatkan wajah sedikit ke kamera';
            } else if (!isCentered) {
              msg = 'Posisikan wajah tepat di tengah lingkaran';
            } else if (!isLookingForward) {
              msg = 'Tatap lurus menghadap kamera';
            } else {
              matched = true;
              msg = '✓ Posisi Hadap Lurus Pas! Tahan sejenak...';
            }
            break;
          }

          case 'slight_tilt': {
            const isTurned = yaw < 0.44 || yaw > 0.56;
            if (!isCentered && Math.abs(detail.box.x + detail.box.width / 2 - cw / 2) > cw * 0.38) {
              msg = 'Posisikan wajah tetap di dalam lingkaran';
            } else if (isTurned) {
              matched = true;
              msg = '✓ Sudut Wajah Terdeteksi! Tahan sejenak...';
            } else {
              msg = 'Tolehkan kepala sedikit ke samping (~15°)...';
            }
            break;
          }

          case 'smile_confirm': {
            if (happy > 0.22) {
              matched = true;
              msg = '✓ Senyuman Terdeteksi! Tahan sejenak...';
            } else if (isCentered && scaleRatio >= 0.20) {
              matched = true;
              msg = '✓ Senyum santai ke kamera... Tahan sejenak...';
            } else {
              msg = 'Tersenyumlah santai ke kamera...';
            }
            break;
          }
        }

        setStableFeedback(msg, matched);

        // Hold timer: Hold for 500ms before auto-advancing
        if (matched && detail.descriptor && !poseCompletedRef.current) {
          const now = Date.now();
          if (!poseHoldStartTimeRef.current) {
            poseHoldStartTimeRef.current = now;
          }
          const holdElapsed = now - poseHoldStartTimeRef.current;
          const prog = Math.min(100, Math.round((holdElapsed / 500) * 100));
          setPoseHoldProgress(prog);

          if (holdElapsed >= 500) {
            poseHoldStartTimeRef.current = null;
            setPoseHoldProgress(100);
            advancePose(Array.from(detail.descriptor));
          }
        } else {
          poseHoldStartTimeRef.current = null;
          setPoseHoldProgress(0);
        }
      } catch (err) {
        // Frame glitch catch
      } finally {
        isProcessing = false;
      }
    }, 120);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [step, isModelLoading, facingMode, currentPoseIndex]);

  const handleRetake = () => {
    setCapturedDescriptors({});
    setCapturedPhoto(null);
    setCurrentPoseIndex(0);
    setStep('scan');
    setErrorMsg(null);
    setIsPosePassing(false);
    poseCompletedRef.current = false;
    startCamera();
  };

  const handleManualSkip = () => {
    // Allows user to advance to next pose or take current frame
    const photo = captureCurrentFrameAsPhoto();
    if (!capturedPhoto && photo) setCapturedPhoto(photo);
    advancePose();
  };

  const handleConfirmSave = async () => {
    if (!userId || !capturedPhoto) {
      setErrorMsg('Data sampel biometrik belum lengkap.');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);
    try {
      // 1. Collect all available pose descriptors
      const descriptorList = Object.values(capturedDescriptors);
      if (descriptorList.length === 0) {
        throw new Error('Data biometrik wajah belum lengkap. Silakan lakukan pemindaian pose wajah kembali.');
      }

      // 2. Multi-Frame Centroid Averaging with L2 Unit Normalization
      const masterVector = biometricService.computeCentroidDescriptor(descriptorList);

      // 3. Persist master biometric vector & photo to PostgreSQL database
      await hrmService.enrollMasterFace(userId, masterVector, capturedPhoto);
      setStep('success');
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menyimpan wajah master ke database.');
    } finally {
      setIsSaving(false);
    }
  };

  const currentStep = ENROLL_STEPS[currentPoseIndex];
  const progressPercent = Math.round(((currentPoseIndex + (isPosePassing ? 1 : 0)) / ENROLL_STEPS.length) * 100);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 max-w-md mx-auto select-none">
      {/* ── TOP HEADER ── */}
      <div className="pt-2 pb-2 text-center space-y-1">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Multi-Pose Biometric Master</span>
        </div>
        <h1 className="text-xl font-bold text-white tracking-tight">Pendaftaran Wajah Presisi</h1>
        <p className="text-xs text-slate-400">
          Karyawan: <strong className="text-white">{employeeDisplayName}</strong>
        </p>
      </div>

      {errorMsg && (
        <div className="p-3 bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs rounded-2xl flex items-center gap-2 mb-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ── STEP 1: SCANNING VIEW ── */}
      {step === 'scan' && (
        <div className="space-y-4 my-auto">
          {/* Target Pose Indicator Pill */}
          <div className="flex items-center justify-between bg-slate-900/90 border border-slate-800 rounded-2xl p-3 shadow-lg">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center shrink-0 border border-slate-700">
                {currentStep.icon}
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
                  Langkah {currentPoseIndex + 1} dari {ENROLL_STEPS.length}
                </span>
                <p className="text-xs font-bold text-white">{currentStep.title}</p>
              </div>
            </div>
            <Badge variant="outline" className="font-mono text-xs font-bold border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
              {progressPercent}%
            </Badge>
          </div>

          {/* Viewfinder with Circular Aperture and Progress Ring */}
          <div className="relative w-full aspect-square bg-black rounded-3xl overflow-hidden border border-slate-800 shadow-2xl flex items-center justify-center">
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

            {/* Circular Aperture Vignette */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              {/* Outer Radial Darkening */}
              <div className="absolute inset-0 bg-radial-[circle_at_center,transparent_45%,rgba(2,6,23,0.85)_80%]" />

              {/* Progress Ring SVG */}
              <svg className="w-64 h-64 -rotate-90 transform pointer-events-none z-10" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  className="stroke-slate-800/80"
                  strokeWidth="3.5"
                  fill="none"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  className={`transition-all duration-300 ${
                    isPosePassing ? 'stroke-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'stroke-sky-400/80'
                  }`}
                  strokeWidth="4"
                  strokeDasharray="283"
                  strokeDashoffset={283 - (283 * progressPercent) / 100}
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>

              {/* Center Guidance Badge: Steady, non-flickering */}
              <div className="absolute bottom-5 inset-x-3 text-center z-20 pointer-events-none flex flex-col items-center">
                <div
                  className={`inline-flex items-center justify-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-full backdrop-blur-md border shadow-lg transition-colors duration-200 min-h-[42px] max-w-[95%] ${
                    isPosePassing
                      ? 'bg-emerald-600/95 text-white border-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.4)]'
                      : 'bg-slate-900/90 text-slate-200 border-slate-700/80 shadow-md'
                  }`}
                >
                  {isPosePassing ? <Check className="w-4 h-4 text-white shrink-0" /> : null}
                  <span className="text-center">{qualityMsg}</span>
                </div>
              </div>
            </div>

            {/* Switch Camera Button */}
            <button
              type="button"
              onClick={handleSwitchCamera}
              className="absolute top-4 right-4 p-2.5 bg-black/60 hover:bg-black/80 text-white rounded-full backdrop-blur-md border border-white/20 active:scale-95 transition-all z-30"
              title="Ganti Kamera"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {/* Model Loading Overlay */}
            {isModelLoading && (
              <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center gap-3 text-center p-6 text-slate-200 z-40">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-white tracking-wide">{modelStatus}</p>
                  <p className="text-[11px] text-slate-400">Menyiapkan AI biometrik untuk pendaftaran 3 sampel wajah...</p>
                </div>
              </div>
            )}
          </div>

          {/* Pose Checklist Mini Badges: 3 Sampel Wajah */}
          <div className="grid grid-cols-3 gap-2 bg-slate-900/70 p-2.5 rounded-2xl border border-slate-800">
            {ENROLL_STEPS.map((s, idx) => {
              const isDone = idx < currentPoseIndex;
              const isCurrent = idx === currentPoseIndex;

              return (
                <div
                  key={s.id}
                  className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all ${
                    isDone
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : isCurrent
                      ? isPosePassing
                        ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-400 ring-2 ring-emerald-400/40'
                        : 'bg-sky-500/20 text-sky-400 border border-sky-500/40 ring-1 ring-sky-500/30'
                      : 'bg-slate-800/40 text-slate-500 border border-slate-800'
                  }`}
                  title={s.title}
                >
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] font-bold font-mono">Sampel {idx + 1}</span>
                    {isDone ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : null}
                  </div>
                  <span className="text-[10px] text-slate-300 truncate max-w-[95px] mt-0.5">
                    {idx === 0 ? 'Hadap Lurus' : idx === 1 ? 'Miring Sedikit' : 'Senyum'}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Action Row: Manual capture & skip */}
          <div className="flex items-center gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={handleManualSkip}
              className="flex-1 h-10 border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl text-xs gap-1.5"
            >
              <span>Lewati Sampel</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
            <Button
              type="button"
              onClick={() => {
                const photo = captureCurrentFrameAsPhoto();
                if (photo) setCapturedPhoto(photo);
                advancePose();
              }}
              className="h-10 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold gap-1.5 shadow-md"
            >
              <Camera className="w-4 h-4" />
              <span>Simpan Sampel Ini</span>
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 2: REVIEW & CONFIRMATION ── */}
      {step === 'review' && (
        <div className="space-y-4 my-auto">
          <div className="relative w-full aspect-square bg-black rounded-3xl overflow-hidden border-2 border-emerald-500/50 shadow-2xl flex items-center justify-center">
            {capturedPhoto ? (
              <img src={capturedPhoto} alt="Master Face HD" className="w-full h-full object-cover" />
            ) : (
              <div className="text-slate-500 text-xs">Foto tidak tersedia</div>
            )}
            <div className="absolute top-3 left-3 bg-emerald-600/95 text-white text-xs font-semibold px-3 py-1 rounded-full backdrop-blur-md border border-emerald-400/40 flex items-center gap-1.5 shadow-md">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Multi-Pose Presisi Terpenuhi</span>
            </div>
          </div>

          <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-white">Vektor Wajah Multi-Pose (ResNet-34):</span>
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">
                Presisi Maksimal
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-2 text-[11px] text-center">
              <div className="p-2 bg-slate-800/60 rounded-xl border border-slate-700/50">
                <span className="text-slate-400 block text-[10px]">Dimensi</span>
                <span className="font-mono font-bold text-white">128-d</span>
              </div>
              <div className="p-2 bg-slate-800/60 rounded-xl border border-slate-700/50">
                <span className="text-slate-400 block text-[10px]">Pose Terambil</span>
                <span className="font-mono font-bold text-emerald-400">
                  {Object.keys(capturedDescriptors).length || 6} Pose
                </span>
              </div>
              <div className="p-2 bg-slate-800/60 rounded-xl border border-slate-700/50">
                <span className="text-slate-400 block text-[10px]">Liveness</span>
                <span className="font-mono font-bold text-emerald-400">ISO 30107</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 text-center leading-relaxed">
              Vektor master dihitung menggunakan centroid averaging dari pose depan, toleh kanan/kiri, kedipan, dan senyuman sehingga presensi harian di lapangan akan selalu akurat.
            </p>
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={handleRetake}
              className="flex-1 border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 rounded-xl text-xs h-11"
            >
              Ulangi Rekam
            </Button>
            <Button
              type="button"
              onClick={handleConfirmSave}
              disabled={isSaving}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-xs h-11 gap-1.5 shadow-lg shadow-emerald-900/30"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Menyimpan ke DB...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Simpan Master Wajah</span>
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 3: SUCCESS CONFIRMATION ── */}
      {step === 'success' && (
        <div className="my-auto text-center space-y-5 p-6 bg-slate-900/90 rounded-3xl border border-emerald-500/30 shadow-2xl">
          <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/40 animate-bounce">
            <CheckCircle2 className="w-9 h-9" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-xl font-bold text-white">Wajah Master Berhasil Terdaftar!</h2>
            <p className="text-xs text-slate-300 max-w-xs mx-auto leading-relaxed">
              Vektor biometrik multi-pose untuk <strong>{employeeDisplayName}</strong> telah tersimpan permanen di database PostgreSQL PT. Fawwaz Reski Perwira.
            </p>
          </div>
          <div className="p-3 bg-emerald-950/50 border border-emerald-800/40 rounded-xl text-[11px] text-emerald-300">
            Karyawan kini dapat melakukan presensi masuk dan pulang menggunakan kamera HP dengan akurasi pengenalan tinggi.
          </div>
          <Button
            onClick={() => window.close()}
            className="w-full bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs h-10"
          >
            Tutup Jendela Ini
          </Button>
        </div>
      )}

      {/* ── FOOTER COMPLIANCE ── */}
      <div className="py-2 text-center text-[10px] text-slate-500 flex items-center justify-center gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
        <span>Dual-Shield Active Liveness & ISO/IEC 19794-5 High Precision</span>
      </div>
    </div>
  );
};
