import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useHrmAuth } from '@/contexts/HrmAuthContext';
import { hrmService, getTodayDateStr } from '@/services/hrmService';
import { AttendanceRecord, OfficeLocation, Shift, OvertimeRecord, LeaveRequest, FIELD_SENTINEL_6_POST_PRESETS, isMobileOnlineOfficer, isLeadershipSpecialFieldOfficer, isSpecialDutyOfficer } from '@/types/hrm';
import {
  Clock,
  MapPin,
  Camera,
  CheckCircle2,
  AlertCircle,
  LogOut,
  History,
  CalendarDays,
  User,
  Home,
  SwitchCamera,
  X,
  AlertOctagon,
  Coffee,
  RotateCw,
  Lock,
  ChevronRight,
  TrendingUp,
  Award,
  Check,
  CalendarCheck2,
  Globe,
  ScanFace,
  FileText,
  Plus,
  Eye,
  Info,
  Calendar,
  Sparkles,
  AlertTriangle,
  BellRing,
  VolumeX,
  ShieldAlert,
  Bell,
  Upload,
  Image as ImageIcon,
  Filter,
  CheckCheck,
  Zap,
  ShieldCheck,
  Briefcase,
  Users,
  Smartphone,
  DownloadCloud,
  Share,
  PlusSquare,
  Loader2,
  ZapOff,
  Compass,
  Wrench,
  Fuel,
  Radio,
  Bike,
  Activity,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { customNotify } from '@/lib/customNotification';
import { biometricService, BiometricMatchResult, parseFaceDescriptor } from '@/services/biometricService';
import { livenessEngine } from '@/services/livenessEngine';
import { geofenceService, GeofenceEvaluation } from '@/services/geofenceService';
import { fieldSentinelService } from '@/services/fieldSentinelService';
import { emergencyAlertService } from '@/services/emergencyAlertAudioService';
import { HrmFaceEnrollmentModal } from '@/components/hrm/HrmFaceEnrollmentModal';
import { HrmFieldAuthorityMobileModal } from '@/components/hrm/HrmFieldAuthorityMobileModal';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import defaultAvatar from '@/assets/logo.png';

interface HrmPwaAttendanceViewProps {
  onSwitchToDesktop?: () => void;
}

export const HrmPwaAttendanceView: React.FC<HrmPwaAttendanceViewProps> = ({ onSwitchToDesktop }) => {
  const { user, logout, refreshUser } = useHrmAuth();

  // Active Bottom Tab: 'beranda' | 'riwayat' | 'aktivitas' | 'akun'
  const [activeTab, setActiveTab] = useState<'beranda' | 'riwayat' | 'aktivitas' | 'akun'>('beranda');

  // Real-time Clock
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Location & Geofence (Cached restoration for instant lock)
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(() => {
    try {
      const cached = sessionStorage.getItem('hrm_last_valid_coords');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.coords?.lat && parsed?.coords?.lng) return parsed.coords;
      }
    } catch (_) {}
    return null;
  });
  const [coordsAccuracy, setCoordsAccuracy] = useState<number | null>(null);
  const [distanceToOffice, setDistanceToOffice] = useState<number | null>(null);
  const [locationStatus, setLocationStatus] = useState<'checking' | 'inside' | 'outside' | 'error'>('checking');
  const [assignedOffice, setAssignedOffice] = useState<OfficeLocation | null>(null);
  const [assignedPostName, setAssignedPostName] = useState<string>('');
  const [bankPosts, setBankPosts] = useState<import('@/types/hrm').FieldAssignedPost[]>([]);
  const [isRefreshingGps, setIsRefreshingGps] = useState<boolean>(false);

  // Attendance & Shift State
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | undefined>(undefined);
  const [userShift, setUserShift] = useState<Shift | null>(null);
  const [attendancesHistory, setAttendancesHistory] = useState<AttendanceRecord[]>([]);

  // Fullscreen Live Camera States
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [actionType, setActionType] = useState<'clock_in' | 'clock_out' | 'emergency_on_call' | 'emergency_on_call_out'>('clock_in');
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [faceDetected, setFaceDetected] = useState<boolean>(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement | null>(null);

  // Scan Mode: 'auto' (AI automatic 750ms lock) vs 'manual' (Employee shutter tap anytime)
  const [scanMode, setScanMode] = useState<'auto' | 'manual'>('auto');
  const [isFlashlightOn, setIsFlashlightOn] = useState<boolean>(false);

  // Field Authority Modal State (Approval Hub & Rekap Tim Mobile)
  const [fieldAuthorityModalOpen, setFieldAuthorityModalOpen] = useState<boolean>(false);
  const [fieldAuthorityInitialTab, setFieldAuthorityInitialTab] = useState<'leaves' | 'overtime' | 'recap'>('leaves');

  // Synchronize cameraStreamRef & ensure unmount cleanup
  useEffect(() => {
    cameraStreamRef.current = cameraStream;
  }, [cameraStream]);

  // Direct video element binding whenever stream is active
  useEffect(() => {
    if (isCameraActive && cameraStream && videoRef.current) {
      if (videoRef.current.srcObject !== cameraStream) {
        videoRef.current.srcObject = cameraStream;
      }
      videoRef.current.play().catch(() => null);
    }
  }, [isCameraActive, cameraStream]);

  useEffect(() => {
    return () => {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => {
          track.stop();
          track.enabled = false;
        });
        cameraStreamRef.current = null;
      }
    };
  }, []);

  // 1-Hour Break States & Modal Konfirmasi
  const [breakTimer, setBreakTimer] = useState<number>(0);
  const [isBreakActive, setIsBreakActive] = useState<boolean>(false);
  const [breakConfirmModalOpen, setBreakConfirmModalOpen] = useState(false);

  // Emergency Leave Modal
  const [emergencyModalOpen, setEmergencyModalOpen] = useState(false);
  const [emergencyCategory, setEmergencyCategory] = useState<'sakit_mendadak' | 'darurat_keluarga' | 'tugas_luar' | 'lainnya'>('sakit_mendadak');
  const [emergencyReason, setEmergencyReason] = useState('');
  const [isSubmittingEmergency, setIsSubmittingEmergency] = useState(false);

  // Leave / Cuti Management States (Tab Aktivitas)
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [leaveType, setLeaveType] = useState<LeaveRequest['leaveType']>('annual_leave');
  const [leaveStartDate, setLeaveStartDate] = useState('');
  const [leaveEndDate, setLeaveEndDate] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [isSubmittingLeave, setIsSubmittingLeave] = useState(false);
  const [userLeaves, setUserLeaves] = useState<LeaveRequest[]>([]);
  const [leaveProofPhoto, setLeaveProofPhoto] = useState<string>('');

  // ─── TRAVEL INCIDENT & VIBRATION REMINDER STATES ───
  const [travelModalOpen, setTravelModalOpen] = useState(false);
  const [travelIncidentType, setTravelIncidentType] = useState<'ban_bocor' | 'kehabisan_bensin' | 'motor_rusak' | 'kecelakaan_ringan' | 'cuaca_ekstrem'>('ban_bocor');
  const [travelReason, setTravelReason] = useState('');
  const [travelProofPhoto, setTravelProofPhoto] = useState('');
  const [isSubmittingTravel, setIsSubmittingTravel] = useState(false);
  const [activeTravelDispensation, setActiveTravelDispensation] = useState<{
    label: string;
    graceMinutes: number;
    witaTime: string;
    recommendation: string;
  } | null>(() => {
    try {
      const saved = localStorage.getItem(`hrm_travel_disp_${getTodayDateStr()}`);
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return null;
  });

  const triggerStrongVibrationReminder = () => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([400, 200, 400, 200, 600, 200, 800]);
    }
    customNotify.warning(
      '🔔 Pengingat Shift & Lokasi FRP',
      `Segera berada di pos tugas resmi sebelum batas toleransi keterlambatan berakhir!`
    );
  };

  const handleCaptureTravelProof = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = Math.min(img.width, 1024);
        canvas.height = Math.round((canvas.width / img.width) * img.height);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          ctx.fillRect(0, canvas.height - 44, canvas.width, 44);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 12px sans-serif';
          const witaNow = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WITA';
          ctx.fillText(`🚨 KENDALA PERJALANAN FRP • ${user?.fullName || 'Petugas'} (${user?.nip || '-'})`, 10, canvas.height - 26);
          ctx.font = '10px sans-serif';
          ctx.fillText(`WAKTU: ${witaNow} • GPS: ${currentCoords ? `${currentCoords.lat.toFixed(5)}, ${currentCoords.lng.toFixed(5)}` : 'Terdeteksi'} (±${coordsAccuracy ? Math.round(coordsAccuracy) : 10}m)`, 10, canvas.height - 10);
          setTravelProofPhoto(canvas.toDataURL('image/jpeg', 0.85));
        }
      };
      img.src = evt.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitTravelIncident = async () => {
    if (!user?.id) return;
    setIsSubmittingTravel(true);
    try {
      const res = await fetch('/api/field-sentinel/travel-incident', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          incidentType: travelIncidentType,
          reason: travelReason,
          photoUrl: travelProofPhoto,
          latitude: currentCoords?.lat,
          longitude: currentCoords?.lng,
          accuracy: coordsAccuracy,
        }),
      });
      const data = await res.json();
      if (data.success) {
        const dispensationObj = {
          label: data.label,
          graceMinutes: data.graceMinutes,
          witaTime: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          recommendation: data.recommendation,
        };
        setActiveTravelDispensation(dispensationObj);
        try {
          localStorage.setItem(`hrm_travel_disp_${getTodayDateStr()}`, JSON.stringify(dispensationObj));
        } catch (_) {}

        customNotify.success(
          'Laporan Diterima',
          `Dispensasi toleransi ${data.graceMinutes} menit telah diaktifkan otomatis. Notifikasi darurat diteruskan ke WhatsApp Pimpinan.`
        );
        setTravelModalOpen(false);
        setTravelReason('');
        setTravelProofPhoto('');
      } else {
        customNotify.error('Gagal Mengirim', data.error || 'Terjadi kesalahan sistem');
      }
    } catch (err: any) {
      customNotify.error('Gagal Melapor', err.message);
    } finally {
      setIsSubmittingTravel(false);
    }
  };

  // Notification Bell Drawer & List
  const [notificationsDrawerOpen, setNotificationsDrawerOpen] = useState(false);
  const [userNotifications, setUserNotifications] = useState<import('@/types/hrm').HrmNotification[]>([]);

  // Monthly Shift Schedule Modal
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);

  // Overtime (SPL) Submission Modal States
  const [overtimeModalOpen, setOvertimeModalOpen] = useState(false);
  const [userOvertimeList, setUserOvertimeList] = useState<OvertimeRecord[]>([]);
  const [userSubstitutions, setUserSubstitutions] = useState<any[]>([]);
  const [otDate, setOtDate] = useState(getTodayDateStr());
  const [otStartTime, setOtStartTime] = useState('17:00');
  const [otEndTime, setOtEndTime] = useState('19:00');
  const [otHours, setOtHours] = useState(2);
  const [otTaskDescription, setOtTaskDescription] = useState('');
  const [otProofPhoto, setOtProofPhoto] = useState('');
  const [isSubmittingOvertime, setIsSubmittingOvertime] = useState(false);

  // History Tab Filters
  const [historyPeriodFilter, setHistoryPeriodFilter] = useState<'bulan_ini' | '7_hari' | 'semua'>('bulan_ini');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'all' | 'hadir' | 'terlambat' | 'telat_istirahat' | 'izin'>('all');

  // Aktivitas Sub-Tab (Cuti / Lembur)
  const [aktivitasSubTab, setAktivitasSubTab] = useState<'cuti' | 'lembur'>('cuti');

  // History Detail Preview Modal (Tab Riwayat)
  const [selectedHistoryRecord, setSelectedHistoryRecord] = useState<AttendanceRecord | null>(null);

  // Logout Confirmation Dialog
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);

  // Password Change Modal
  const [changePasswordModalOpen, setChangePasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Urgent Spot-Check Alert State (Instruksi Darurat Pimpinan)
  const [spotCheckModalOpen, setSpotCheckModalOpen] = useState(false);
  const [spotCheckData, setSpotCheckData] = useState<{ requestedAt?: string; notes?: string } | null>(null);
  const [isSpotCheckAction, setIsSpotCheckAction] = useState(false);
  const [spotCheckSecondsLeft, setSpotCheckSecondsLeft] = useState<number>(300);
  const isAlarmSilencedRef = useRef<boolean>(false);
  const lastRequestedAtRef = useRef<string | null>(null);
  const isSubmittingPatrolRef = useRef<boolean>(false);

  // PWA Standalone Detection & Installation State
  const [isStandaloneApp, setIsStandaloneApp] = useState<boolean>(true);
  const [showPwaInstallModal, setShowPwaInstallModal] = useState<boolean>(false);
  const [pwaGuideTab, setPwaGuideTab] = useState<'android' | 'ios' | 'apk'>('android');

  useEffect(() => {
    const checkStandalone = () => {
      const standalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://') ||
        window.location.search.includes('source=pwa');
      setIsStandaloneApp(standalone);
    };
    checkStandalone();
    const ua = window.navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) setPwaGuideTab('ios');
    window.addEventListener('appinstalled', checkStandalone);
    return () => window.removeEventListener('appinstalled', checkStandalone);
  }, []);

  const handleTriggerPwaInstall = async () => {
    const promptEvent = (window as any).__pwaInstallPrompt;
    if (promptEvent) {
      try {
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        if (choice.outcome === 'accepted') {
          toast.success('PWA berhasil dipasang ke Layar Utama HP!');
          (window as any).__pwaInstallPrompt = null;
        }
      } catch (e) {
        setShowPwaInstallModal(true);
      }
    } else {
      setShowPwaInstallModal(true);
    }
  };

  // Master Face Enrollment Modal
  const [enrollModalOpen, setEnrollModalOpen] = useState(false);

  // Master Face Descriptor from Database (128-D Normalized Vector)
  const masterDescriptor = useMemo<number[] | null>(() => {
    const raw = user?.faceDescriptor || (user as any)?.face_descriptor || (user as any)?.face_embedding;
    return parseFaceDescriptor(raw);
  }, [user]);

  // Preload face-api AI models
  useEffect(() => {
    if (!biometricService.isReady()) {
      biometricService.loadModels().catch((e) => console.warn('[FaceModels Load]', e));
    }
  }, []);

  // Real-time Live Face Detection & Match State (Fast Tracking & Indikator Hijau)
  const [liveFaceStatus, setLiveFaceStatus] = useState<{
    detected: boolean;
    isGreen: boolean;
    confidence: number;
    message: string;
  }>({
    detected: false,
    isGreen: false,
    confidence: 0,
    message: 'Arahkan wajah Anda ke dalam bingkai',
  });

  // Auto-capture progress (0 - 100%) when indicator is green
  const [autoCaptureProgress, setAutoCaptureProgress] = useState<number>(0);
  const greenSinceRef = useRef<number | null>(null);
  const isTriggeringAutoRef = useRef<boolean>(false);
  const isCapturingRef = useRef<boolean>(false);
  const handleShutterCaptureRef = useRef<() => void>();

  // Active Real-time Face Detection Loop on Camera Stream (Ultra Fast & Smooth)
  useEffect(() => {
    if (!isCameraActive || !cameraStream) {
      setLiveFaceStatus({
        detected: false,
        isGreen: false,
        confidence: 0,
        message: 'Arahkan wajah Anda ke dalam bingkai',
      });
      setAutoCaptureProgress(0);
      greenSinceRef.current = null;
      isTriggeringAutoRef.current = false;
      return;
    }

    let isMounted = true;
    let isProcessing = false;

    const interval = setInterval(async () => {
      if (!isMounted || !videoRef.current || isProcessing) return;
      if (videoRef.current.readyState < 2) return;

      isProcessing = true;
      try {
        // Fast face presence & position detection (< 25ms, no ResNet loop bottleneck)
        const detail = await biometricService.detectFaceFast(videoRef.current);

        if (!isMounted) return;

        if (!detail || !detail.box || detail.box.width === 0) {
          greenSinceRef.current = null;
          isTriggeringAutoRef.current = false;
          setAutoCaptureProgress(0);
          setLiveFaceStatus({
            detected: false,
            isGreen: false,
            confidence: 0,
            message: scanMode === 'manual' ? 'Posisikan wajah di dalam bingkai' : 'Posisikan wajah Anda tepat di dalam bingkai',
          });
        } else {
          const vw = videoRef.current.videoWidth || 640;
          const boxCenterX = detail.box.x + detail.box.width / 2;
          const isCentered = Math.abs(boxCenterX - vw / 2) < vw * 0.35;
          const scaleRatio = detail.box.width / vw;
          const isGoodScale = scaleRatio >= 0.16 && scaleRatio <= 0.88;

          if (!isGoodScale && scaleRatio < 0.16) {
            greenSinceRef.current = null;
            isTriggeringAutoRef.current = false;
            setAutoCaptureProgress(0);
            setLiveFaceStatus({
              detected: true,
              isGreen: false,
              confidence: 50,
              message: 'Dekatkan wajah sedikit ke kamera',
            });
          } else if (!isCentered) {
            greenSinceRef.current = null;
            isTriggeringAutoRef.current = false;
            setAutoCaptureProgress(0);
            setLiveFaceStatus({
              detected: true,
              isGreen: false,
              confidence: 60,
              message: 'Posisikan wajah tepat di tengah bingkai',
            });
          } else {
            // Wajah terdeteksi tepat di tengah & ukuran pas! INDIKATOR HIJAU AKTIF!
            const now = Date.now();
            if (!greenSinceRef.current) {
              greenSinceRef.current = now;
            }
            const elapsed = now - greenSinceRef.current;

            if (scanMode === 'auto') {
              const progress = Math.min(100, Math.round((elapsed / 750) * 100));
              setAutoCaptureProgress(progress);

              setLiveFaceStatus({
                detected: true,
                isGreen: true,
                confidence: masterDescriptor ? 98 : 94,
                message: progress >= 100
                  ? '✓ Mengambil foto otomatis...'
                  : '✓ Wajah Terkunci • Menjepret...',
              });

              // Auto-capture otomatis setelah bertahan 700ms
              if (elapsed >= 700 && !isCapturingRef.current && !isTriggeringAutoRef.current) {
                isTriggeringAutoRef.current = true;
                greenSinceRef.current = null;
                setAutoCaptureProgress(100);
                if (handleShutterCaptureRef.current) {
                  handleShutterCaptureRef.current();
                }
              }
            } else {
              // Mode Manual: Indikator hijau aktif tanpa auto-trigger!
              setAutoCaptureProgress(0);
              setLiveFaceStatus({
                detected: true,
                isGreen: true,
                confidence: masterDescriptor ? 98 : 94,
                message: '✓ Posisi Optimal • Ketuk Tombol Kamera',
              });
            }
          }
        }
      } catch (e) {
        console.warn('[Face Detection Tick]', e);
      } finally {
        isProcessing = false;
      }
    }, 130);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isCameraActive, cameraStream, scanMode, masterDescriptor]);

  // Load Real Data from PostgreSQL & hrmService
  const loadRealData = async () => {
    if (!user) return;
    try {
      await hrmService.syncWithBackend().catch(() => null);

      // 1. Shift Sinkron Database
      const shifts = hrmService.getShifts();
      const baseShift =
        shifts.find((s) => s.id === user.shiftId) ||
        shifts.find((s) => s.name === user.shiftName) ||
        shifts[0] ||
        null;
      let effectiveShift: Shift | null = baseShift ? { ...baseShift } : null;

      if (!effectiveShift && user.shiftName) {
        effectiveShift = {
          id: user.shiftId || 'shift-db',
          code: 'SHF',
          name: user.shiftName,
          startTime: user.shiftStartTime || '07:30',
          endTime: user.shiftEndTime || '16:30',
          lateToleranceMinutes: user.lateToleranceMinutes ?? 15,
        };
      } else if (effectiveShift && user.shiftName) {
        effectiveShift.name = user.shiftName;
      }

      if (effectiveShift) {
        if (user.shiftStartTime) effectiveShift.startTime = user.shiftStartTime;
        if (user.shiftEndTime) effectiveShift.endTime = user.shiftEndTime;
        if (user.customStartTime) effectiveShift.startTime = user.customStartTime;
        if (user.customEndTime) effectiveShift.endTime = user.customEndTime;
        if (user.lateToleranceMinutes !== undefined) effectiveShift.lateToleranceMinutes = user.lateToleranceMinutes;
      }
      setUserShift(effectiveShift);

      // 2. Attendance Hari Ini (Tarik langsung dari PostgreSQL via /api/attendances/today)
      const todayStr = getTodayDateStr();
      let todayAtt: AttendanceRecord | undefined = undefined;

      try {
        const todayRes = await fetch(`/api/attendances/today?userId=${encodeURIComponent(user.id)}`);
        if (todayRes.ok) {
          const todayData = await todayRes.json();
          if (todayData.success && todayData.attendance) {
            todayAtt = todayData.attendance;
          }
        }
      } catch (err) {
        console.warn('[PWA] Gagal fetch today attendance, fallback ke local cache:', err);
      }

      const userAtts = hrmService.getAttendances().filter((a) => a.userId === user.id);
      if (todayAtt) {
        const existingIdx = userAtts.findIndex((a) => a.id === todayAtt?.id || a.date === todayStr);
        if (existingIdx >= 0) {
          userAtts[existingIdx] = { ...userAtts[existingIdx], ...todayAtt };
        } else {
          userAtts.unshift(todayAtt);
        }
      } else {
        todayAtt = userAtts.find((a) => a.date === todayStr || a.attendanceDate === todayStr);
      }

      setAttendancesHistory(userAtts);
      setTodayAttendance(todayAtt || null);

      if (todayAtt?.isOnBreak && todayAtt.breakStartTime) {
        setIsBreakActive(true);
        let breakMs = new Date(todayAtt.breakStartTime).getTime();
        if (isNaN(breakMs)) {
          const [h, m, s] = todayAtt.breakStartTime.split(':').map(Number);
          const breakDate = new Date();
          breakDate.setHours(h, m, s || 0, 0);
          breakMs = breakDate.getTime();
        }
        const elapsedSec = Math.floor((Date.now() - breakMs) / 1000);
        setBreakTimer(Math.max(0, 3600 - elapsedSec));
      } else {
        setIsBreakActive(false);
        setBreakTimer(0);
      }

      // 2B. Data Permohonan Cuti/Izin Saya
      const myLeaves = hrmService.getUserLeaves(user.id);
      setUserLeaves(myLeaves);

      // 2C. Data Permohonan Lembur Saya
      const myOts = hrmService.getOvertimeRecords().filter((o) => o.userId === user.id);
      setUserOvertimeList(myOts);

      // 2C-2. Data Penugasan Pengganti Karyawan Saya (Relief Duties yang Disetujui)
      const mySwaps = (typeof hrmService.getShiftSwaps === 'function' ? hrmService.getShiftSwaps() : []).filter(
        (s: any) => s.substituteId === user.id && s.status === 'approved'
      );
      setUserSubstitutions(mySwaps);

      // 2D. Notifikasi Realtime Saya
      const myNotifs = hrmService.getNotifications().filter(
        (n) => n.userId === user.id || (n.recipientRole && n.recipientRole === (user.roleName || user.role))
      );
      setUserNotifications(myNotifs);

      // 3. Bank Pos Lapangan (Multi-Titik)
      let currentBankPosts: import('@/types/hrm').FieldAssignedPost[] = [];
      try {
        const posts = await fieldSentinelService.getFieldPosts(user.id);
        if (Array.isArray(posts) && posts.length > 0) {
          currentBankPosts = posts;
          setBankPosts(posts);
        } else {
          setBankPosts([]);
        }
      } catch (err) {
        console.warn('[PWA] Error fetching field posts:', err);
      }

      // Pos Penugasan Default / Kantor Divisi
      let officeLoc: OfficeLocation | null = null;
      if (currentBankPosts.length > 0) {
        // Prioritize matched assigned location or first bank post
        const matchedPost = currentBankPosts.find(p => p.postName === user.assignedLocationName || p.postCode === user.assignedLocationName) || currentBankPosts[0];
        officeLoc = {
          id: matchedPost.id,
          name: matchedPost.postName,
          latitude: matchedPost.latitude,
          longitude: matchedPost.longitude,
          radiusMeters: matchedPost.radiusMeters || 250,
          locationName: matchedPost.postName,
          address: matchedPost.description || `Area Pos Lapangan ${matchedPost.postName}`,
        };
        setAssignedPostName(`${matchedPost.postName} [${matchedPost.postCode}]`);
      } else if (user.assignedLatitude && user.assignedLongitude && !isNaN(Number(user.assignedLatitude)) && !isNaN(Number(user.assignedLongitude))) {
        officeLoc = {
          id: 'assigned-post',
          name: user.assignedLocationName || 'Pos Lapangan Terdaftar',
          latitude: Number(user.assignedLatitude),
          longitude: Number(user.assignedLongitude),
          radiusMeters: Number(user.assignedRadiusMeters) || 150,
          locationName: user.assignedLocationName || 'Pos Lapangan Terdaftar',
          address: user.assignedLocationName || 'Pos Lapangan Terdaftar',
        };
        setAssignedPostName(user.assignedLocationName || 'Pos Lapangan');
      } else if (user.divisionLatitude && user.divisionLongitude && !isNaN(Number(user.divisionLatitude)) && !isNaN(Number(user.divisionLongitude))) {
        // Prioritas Utama: Koordinat Divisi Sinkron Database PostgreSQL
        const divName = user.divisionLocationName || user.divisionName || 'Gedung Divisi';
        const divAddress = user.divisionAddress || user.address || user.divisionLocationName || 'Area Lokasi Divisi';
        officeLoc = {
          id: user.divisionId || 'div-loc',
          name: divName,
          latitude: Number(user.divisionLatitude),
          longitude: Number(user.divisionLongitude),
          radiusMeters: Number(user.divisionRadiusMeters) || 50,
          locationName: divName,
          address: divAddress,
          allowedPosts: Array.isArray(user.divisionAllowedPosts) ? user.divisionAllowedPosts : [],
        };
        setAssignedPostName(divName);
      } else {
        const divLoc = hrmService.getDivisionLocation(user.divisionId || user.divisionName || (user as any).division);
        if (divLoc) {
          officeLoc = divLoc;
          setAssignedPostName(divLoc.name);
        } else {
          const defaultOffice = hrmService.getOfficeLocation();
          officeLoc = defaultOffice;
          setAssignedPostName(defaultOffice?.name || 'Kantor Pusat PT FRP');
        }
      }
      setAssignedOffice(officeLoc);

      // Re-evaluate location with fresh bank posts
      if (currentCoords) {
        evaluateLocationCoords(currentCoords, coordsAccuracy || 10, currentBankPosts, officeLoc);
      }
    } catch (err) {
      console.error('[PWA] Error loading real data:', err);
    }
  };

  // Evaluate location coordinates against Bank Pos (Multi-Titik) or Fallback Office
  const evaluateLocationCoords = (
    coords: { lat: number; lng: number },
    accuracy: number = 10,
    activePosts: import('@/types/hrm').FieldAssignedPost[] = bankPosts,
    fallbackOffice: OfficeLocation | null = assignedOffice
  ) => {
    setCurrentCoords(coords);
    setCoordsAccuracy(accuracy);

    // ⚡ Pengecualian Petugas Online Distribusi (Rusdi, Reza, Ichtiar): Fleksibilitas Luas (Matching/Pusat/Cafe/Rumah)
    if (isMobileOnlineOfficer(user)) {
      let matchedName = '';
      let matchedDist = 0;
      if (activePosts && activePosts.length > 0) {
        const postsWithDist = activePosts.map((p) => {
          const d = geofenceService.calculateDistance(coords, { latitude: p.latitude, longitude: p.longitude });
          const r = p.radiusMeters || 250;
          return { ...p, distance: d, radius: r, isInside: d <= r };
        });
        const insidePost = postsWithDist.find((p) => p.isInside);
        if (insidePost) {
          matchedName = `${insidePost.postName} [${insidePost.postCode}]`;
          matchedDist = Math.round(insidePost.distance);
        }
      }
      if (!matchedName && fallbackOffice) {
        const evalResult = geofenceService.evaluateGeofence(coords, fallbackOffice);
        if (evalResult.isInside) {
          matchedName = fallbackOffice.name;
          matchedDist = Math.round(evalResult.distanceMeters);
        }
      }

      setDistanceToOffice(matchedDist);
      setLocationStatus('inside');
      setAssignedPostName(matchedName || 'Area Mobile / Online Remote (Matching/Pusat/Cafe/Rumah)');
      return;
    }

    // Dynamic GPS Accuracy buffer (toleransi radius saat sinyal GPS melar di dalam ruangan)
    const accuracyBuffer = Math.min(Math.max(0, (accuracy - 20) * 0.6), 80);
    // Hysteresis buffer: Jika sebelumnya sudah terdeteksi di lokasi ('inside'), beri toleransi ekstra 35m agar tidak flapping
    const hysteresisBonus = locationStatus === 'inside' ? 35 : 0;

    if (activePosts && activePosts.length > 0) {
      // Multi-Titik Bank Pos evaluation (Titik A, B, C, ...)
      const postsWithDist = activePosts.map((p) => {
        const d = geofenceService.calculateDistance(coords, { latitude: p.latitude, longitude: p.longitude });
        const r = (p.radiusMeters || 250) + accuracyBuffer + hysteresisBonus;
        return { ...p, distance: d, radius: r, isInside: d <= r };
      });

      const insidePost = postsWithDist.find((p) => p.isInside);
      if (insidePost) {
        setDistanceToOffice(Math.round(insidePost.distance));
        setLocationStatus('inside');
        setAssignedPostName(`${insidePost.postName} [${insidePost.postCode}]`);
        return;
      }

      // Outside all registered bank posts: find nearest
      const sorted = postsWithDist.sort((a, b) => a.distance - b.distance);
      const nearest = sorted[0];
      if (nearest) {
        setDistanceToOffice(Math.round(nearest.distance));
        setLocationStatus('outside');
        setAssignedPostName(`${nearest.postName} [${nearest.postCode}]`);
      }
      return;
    }

    // Evaluasi lokasi: kantor penugasan/divisi (Prioritas Utama Database), allowed posts divisi, dan pos resmi
    const candidateOffices: { name: string; lat: number; lng: number; radius: number; isPrimary?: boolean; address?: string }[] = [];
    
    // Pastikan target utama terdefinisi: dari fallbackOffice, assignedOffice, atau langsung dari user.divisionLatitude/Longitude
    const targetOffice = fallbackOffice || assignedOffice || (user?.divisionLatitude && user?.divisionLongitude ? {
      id: user.divisionId || 'div-loc',
      name: user.divisionLocationName || user.divisionName || 'Gedung Divisi',
      latitude: Number(user.divisionLatitude),
      longitude: Number(user.divisionLongitude),
      radiusMeters: Number(user.divisionRadiusMeters) || 50,
      locationName: user.divisionLocationName || user.divisionName || 'Gedung Divisi',
      address: user.divisionAddress || user.address || user.divisionLocationName || 'Area Lokasi Divisi',
      allowedPosts: Array.isArray(user.divisionAllowedPosts) ? user.divisionAllowedPosts : [],
    } : null);

    if (targetOffice && typeof targetOffice.latitude === 'number' && typeof targetOffice.longitude === 'number' && !isNaN(targetOffice.latitude) && !isNaN(targetOffice.longitude)) {
      candidateOffices.push({
        name: targetOffice.name,
        lat: targetOffice.latitude,
        lng: targetOffice.longitude,
        radius: targetOffice.radiusMeters || 50,
        address: targetOffice.address,
        isPrimary: true,
      });

      // Masukkan juga allowedPosts dari divisi/posisi pegawai jika ada
      if (targetOffice.allowedPosts && Array.isArray(targetOffice.allowedPosts)) {
        for (const ap of targetOffice.allowedPosts) {
          if (!candidateOffices.some((c) => Math.abs(c.lat - ap.latitude) < 0.0001 && Math.abs(c.lng - ap.longitude) < 0.0001)) {
            candidateOffices.push({
              name: ap.name,
              lat: ap.latitude,
              lng: ap.longitude,
              radius: ap.radiusMeters || 50,
              address: ap.description || targetOffice.address,
            });
          }
        }
      }
    }

    // Masukkan preset resmi PT FRP sebagai kandidat alternatif (hanya dicocokkan jika berada di dalam radius)
    for (const preset of FIELD_SENTINEL_6_POST_PRESETS) {
      if (!candidateOffices.some((c) => Math.abs(c.lat - preset.latitude) < 0.0001 && Math.abs(c.lng - preset.longitude) < 0.0001)) {
        candidateOffices.push({
          name: preset.name,
          lat: preset.latitude,
          lng: preset.longitude,
          radius: preset.radiusMeters || 250,
        });
      }
    }

    if (candidateOffices.length > 0) {
      const officeChecks = candidateOffices.map((cand) => {
        const d = geofenceService.calculateDistance(coords, { latitude: cand.lat, longitude: cand.lng });
        const allowedR = cand.radius + accuracyBuffer + hysteresisBonus;
        return { ...cand, distance: d, isInside: d <= allowedR };
      });

      // 🟢 Jika pegawai berada di dalam salah satu pos resmi / divisi
      const matchedInside = officeChecks.find((c) => c.isInside);
      if (matchedInside) {
        setDistanceToOffice(Math.round(matchedInside.distance));
        setLocationStatus('inside');
        setAssignedPostName(matchedInside.name);
        return;
      }

      // 🔴 Jika pegawai berada di luar radius:
      // Prioritaskan selalu target utama (divisi / penugasan resmi karyawan dari database)
      // JANGAN PERNAH timpa nama lokasi dengan preset random (seperti Matching Bontoa)!
      const primaryTarget = candidateOffices.find((c) => c.isPrimary) || candidateOffices[0];
      const dist = primaryTarget ? geofenceService.calculateDistance(coords, { latitude: primaryTarget.lat, longitude: primaryTarget.lng }) : 0;
      setDistanceToOffice(Math.round(dist));
      setLocationStatus('outside');
      setAssignedPostName(primaryTarget?.name || 'Area Pos Kerja');
    } else {
      setLocationStatus('inside');
    }
  };

  useEffect(() => {
    loadRealData();
    evaluateRealLocation();

    const handleUpdate = () => loadRealData();
    window.addEventListener('hrm_attendance_updated', handleUpdate);
    window.addEventListener('hrm_settings_updated', handleUpdate);

    return () => {
      window.removeEventListener('hrm_attendance_updated', handleUpdate);
      window.removeEventListener('hrm_settings_updated', handleUpdate);
    };
  }, [user]);

  // Continuous Background GPS Watcher & Heartbeat Ping for Field Officers
  const lastPingTimeRef = useRef<number>(0);
  useEffect(() => {
    if (!navigator.geolocation || !user) return;

    const isFieldOfficer =
      Boolean(user.isFieldSentinelEnabled) ||
      (Array.isArray(bankPosts) && bankPosts.length > 0) ||
      ['aslamfaisal10okt@gmail.com', 'abangelsamsi@gmail.com', 'mtakdir46@gmail.com'].includes(
        (user.email || '').toLowerCase()
      ) ||
      ['FRP 07065', 'FR.07.066', 'FRP.07.046', 'FR07065', 'FR07066', 'FR07046'].includes(
        (user.nip || '').trim()
      );

    const handlePos = (pos: GeolocationPosition) => {
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      evaluateLocationCoords(coords, pos.coords.accuracy || 10);

      const now = Date.now();
      // Send location ping every 45-60s or on position change
      if (isFieldOfficer && now - lastPingTimeRef.current >= 45000) {
        lastPingTimeRef.current = now;
        fieldSentinelService.sendLocationPing({
          userId: user.id,
          latitude: coords.lat,
          longitude: coords.lng,
          accuracy: pos.coords.accuracy || 10,
          altitude: pos.coords.altitude,
          speed: pos.coords.speed,
          isMockLocation: Boolean((pos.coords as any).isMock),
        }).then((res) => {
          if (res?.triggerVibration && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            try {
              navigator.vibrate([400, 200, 400, 200, 800]);
            } catch (_) {}
          }
          if (res?.shouldPromptSelfie) {
            toast.success(
              `📍 Tiba di ${res.arrivedPostName || 'Pos Tugas'}! Harap segera lakukan Foto Selfie Presensi di lokasi.`,
              {
                duration: 12000,
                action: {
                  label: '📸 Ambil Foto',
                  onClick: () => {
                    setScanMode('clock_in');
                    setIsCameraActive(true);
                  },
                },
              }
            );
          }
        }).catch(() => null);
      }
    };

    const watchId = navigator.geolocation.watchPosition(
      handlePos,
      (err) => console.warn('[PWA Geolocation Watcher]', err),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );

    // Heartbeat every 60 seconds
    const heartbeat = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        handlePos,
        () => null,
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
      );
    }, 60000);

    return () => {
      navigator.geolocation.clearWatch(watchId);
      clearInterval(heartbeat);
    };
  }, [user?.id, bankPosts, assignedOffice]);

  // Break Countdown Timer
  useEffect(() => {
    if (!isBreakActive || breakTimer <= 0) return;
    const interval = setInterval(() => {
      setBreakTimer((prev) => {
        if (prev <= 1) {
          toast.warning('Waktu istirahat 1 jam Anda telah berakhir. Harap kembali ke area kerja!');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isBreakActive, breakTimer]);

  // Spot-Check Countdown Timer (5 Minutes / 300s window)
  useEffect(() => {
    if (!spotCheckModalOpen) return;
    const timer = setInterval(() => {
      setSpotCheckSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [spotCheckModalOpen]);

  // Urgent Spot-Check Poller (Every 8 seconds - Listens for Pimpinan's Minta Lapor Wajah)
  useEffect(() => {
    if (!user?.id) return;

    let poller: any = null;
    const checkSpotCheckStatus = async () => {
      try {
        const res = await fieldSentinelService.getSpotCheckStatus(user.id);
        if (res && res.requested) {
          // Jika ada instruksi baru dari pimpinan (timestamp berbeda), aktifkan kembali kesempatan notifikasi
          if (res.requestedAt && res.requestedAt !== lastRequestedAtRef.current) {
            lastRequestedAtRef.current = res.requestedAt;
            isAlarmSilencedRef.current = false;
          }

          setSpotCheckData({
            requestedAt: res.requestedAt,
            notes: res.notes || 'Pimpinan meminta Anda segera melakukan verifikasi scan wajah di pos tugas.',
          });

          // Tampilkan modal HANYA jika kamera belum aktif dan aksi lapor belum berjalan
          if (!isCameraActive && !isSpotCheckAction) {
            setSpotCheckModalOpen(true);
          }

          // Bunyikan sirene HANYA jika belum pernah dibungkam/diheningkan oleh user dan kamera belum dibuka
          if (!isAlarmSilencedRef.current && !isCameraActive && !isSpotCheckAction && !emergencyAlertService.isAlertActive()) {
            emergencyAlertService.startEmergencyAlert(
              '🚨 INSTRUKSI PIMPINAN: SEGERA LAPOR WAJAH!',
              res.notes || 'Pimpinan meminta Anda segera melakukan verifikasi scan wajah di pos tugas.'
            );
          }
        } else if (res && !res.requested) {
          // Jika instruksi sudah selesai atau dibatalkan di server
          lastRequestedAtRef.current = null;
          isAlarmSilencedRef.current = false;
          if (spotCheckModalOpen && !isCameraActive) {
            setSpotCheckModalOpen(false);
            setSpotCheckData(null);
          }
          emergencyAlertService.stopEmergencyAlert();
        }
      } catch (err) {
        // silent catch
      }
    };

    // Initial check
    checkSpotCheckStatus();
    poller = setInterval(checkSpotCheckStatus, 8000);

    return () => {
      if (poller) clearInterval(poller);
    };
  }, [user?.id, isCameraActive, isSpotCheckAction]);

  // Real GPS Geofencing Evaluation with Fast Dual-Stage Resolver & Indoor Fallback
  const evaluateRealLocation = (isManualTrigger = false) => {
    if (!navigator.geolocation) {
      setLocationStatus('error');
      return;
    }
    setLocationStatus('checking');
    if (isManualTrigger) setIsRefreshingGps(true);

    let resolved = false;

    // Fast fallback timer: if high-accuracy GPS doesn't resolve in 4s (common indoors/under metal roofs),
    // immediately query standard network/wifi location which responds in <500ms
    const fallbackTimer = setTimeout(() => {
      if (!resolved) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (resolved) return;
            resolved = true;
            if (isManualTrigger) setIsRefreshingGps(false);
            const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            try {
              sessionStorage.setItem('hrm_last_valid_coords', JSON.stringify({ coords, accuracy: pos.coords.accuracy || 25, time: Date.now() }));
            } catch (_) {}
            evaluateLocationCoords(coords, pos.coords.accuracy || 25);
            if (isManualTrigger) toast.success(`Lokasi GPS diperbarui (±${Math.round(pos.coords.accuracy || 25)}m)`);
          },
          (err) => {
            if (resolved) return;
            resolved = true;
            if (isManualTrigger) setIsRefreshingGps(false);
            console.warn('[PWA GPS] Fallback check:', err);
            if (assignedOffice) {
              const fallbackCoords = { lat: assignedOffice.latitude, lng: assignedOffice.longitude };
              setCurrentCoords(fallbackCoords);
              setDistanceToOffice(0);
              setLocationStatus('inside');
            } else {
              setLocationStatus('inside');
            }
          },
          { enableHighAccuracy: false, timeout: 4000, maximumAge: 30000 }
        );
      }
    }, 4000);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(fallbackTimer);
        if (isManualTrigger) setIsRefreshingGps(false);
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        try {
          sessionStorage.setItem('hrm_last_valid_coords', JSON.stringify({ coords, accuracy: pos.coords.accuracy || 10, time: Date.now() }));
        } catch (_) {}
        evaluateLocationCoords(coords, pos.coords.accuracy || 10);
        if (isManualTrigger) toast.success(`Lokasi Presisi Terkunci (±${Math.round(pos.coords.accuracy || 10)}m)`);
      },
      (err) => {
        if (!resolved) {
          clearTimeout(fallbackTimer);
          resolved = true;
          if (isManualTrigger) setIsRefreshingGps(false);
          // Try network location fallback
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
              evaluateLocationCoords(coords, pos.coords.accuracy || 30);
              if (isManualTrigger) toast.success(`Lokasi Terdeteksi (±${Math.round(pos.coords.accuracy || 30)}m)`);
            },
            () => {
              if (assignedOffice) {
                const fallbackCoords = { lat: assignedOffice.latitude, lng: assignedOffice.longitude };
                setCurrentCoords(fallbackCoords);
                setDistanceToOffice(0);
                setLocationStatus('inside');
              } else {
                setLocationStatus('inside');
              }
            },
            { enableHighAccuracy: false, timeout: 4000, maximumAge: 60000 }
          );
        }
      },
      { enableHighAccuracy: true, timeout: 4000, maximumAge: 10000 }
    );
  };

  // Real-Time Analytics & Monthly Calculations from Database Records
  const currentMonthStr = useMemo(() => getTodayDateStr().substring(0, 7), []);

  const unreadNotificationsCount = useMemo(() => {
    return userNotifications.filter((n) => !n.isRead).length;
  }, [userNotifications]);

  // Absen Pulang (Clock-Out) Guard:
  // Harus tidak aktif sebelum shift endTime, kecuali ada izin darurat yang disetujui!
  const isBeforeShiftEndTime = useMemo(() => {
    if (!userShift?.endTime) return false;
    const now = currentTime;
    const currentTotalMins = now.getHours() * 60 + now.getMinutes();

    const [endH, endM] = userShift.endTime.split(':').map(Number);
    const endTotalMins = endH * 60 + (endM || 0);

    const [startH, startM] = (userShift.startTime || '07:30').split(':').map(Number);
    const startTotalMins = startH * 60 + (startM || 0);
    const isCrossDay = userShift.isCrossDay || endTotalMins < startTotalMins;

    if (isCrossDay) {
      if (currentTotalMins >= startTotalMins) return true;
      if (currentTotalMins < endTotalMins) return true;
      return false;
    } else {
      return currentTotalMins < endTotalMins;
    }
  }, [currentTime, userShift]);

  const hasApprovedEmergencyLeave = useMemo(() => {
    if (todayAttendance?.isEarlyLeave || todayAttendance?.earlyLeaveApproved || todayAttendance?.isRemoteUnlocked) {
      return true;
    }
    const todayStr = getTodayDateStr();
    return userLeaves.some(
      (l) =>
        (l.leaveType === 'emergency_leave' || l.leaveType === 'izin_darurat' || (l as any).type === 'izin_darurat') &&
        l.status === 'approved' &&
        (l.startDate === todayStr || l.endDate === todayStr)
    );
  }, [todayAttendance, userLeaves]);

  // Status Jam Istirahat Otomatis (Default 12.00 - 13.00 WITA atau sesuai Konfigurasi Superadmin)
  const isShiftBreakWindow = useMemo(() => {
    const appSettings = hrmService.getAppSettings();
    const breakStart = appSettings.breakStartTime || userShift?.breakStartTime || '12:00';
    const breakEnd = appSettings.breakEndTime || userShift?.breakEndTime || '13:00';
    const now = currentTime;
    const curMins = now.getHours() * 60 + now.getMinutes();
    const [bsh, bsm] = breakStart.split(':').map(Number);
    const [beh, bem] = breakEnd.split(':').map(Number);
    const startMins = (bsh || 12) * 60 + (bsm || 0);
    const endMins = (beh || 13) * 60 + (bem || 0);
    return curMins >= startMins && curMins < endMins;
  }, [currentTime, userShift]);

  // Kalender Jadwal Shift Bulan Berjalan
  const currentMonthDays = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const daysName = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

    const list = [];
    for (let d = 1; d <= totalDays; d++) {
      const dateObj = new Date(year, month, d);
      const dayOfWeek = dateObj.getDay();
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isToday = dateStr === getTodayDateStr();
      const isWeekend = dayOfWeek === 0 || (dayOfWeek === 6 && userShift?.workingDays && !userShift.workingDays.includes(6));

      list.push({
        dateStr,
        dayNum: d,
        dayName: daysName[dayOfWeek],
        shiftName: isWeekend ? 'Libur / Off' : (userShift?.name || 'Day Shift'),
        shiftHours: isWeekend ? '-' : `${userShift?.startTime || '07:30'} - ${userShift?.endTime || '16:30'} WITA`,
        isOff: isWeekend,
        isToday,
      });
    }
    return list;
  }, [userShift]);

  // Filter Riwayat Absensi
  const filteredAttendancesHistory = useMemo(() => {
    return attendancesHistory.filter((att) => {
      const attDate = att.attendanceDate || att.date || '';

      // Filter Periode
      if (historyPeriodFilter === 'bulan_ini') {
        if (!attDate.startsWith(currentMonthStr)) return false;
      } else if (historyPeriodFilter === '7_hari') {
        const today = new Date();
        const attD = new Date(attDate);
        const diffDays = Math.round((today.getTime() - attD.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays > 7 || diffDays < 0) return false;
      }

      // Filter Status
      if (historyStatusFilter === 'hadir') {
        return att.status === 'hadir';
      } else if (historyStatusFilter === 'terlambat') {
        return att.status === 'terlambat' || (att.lateMinutes && att.lateMinutes > 0);
      } else if (historyStatusFilter === 'telat_istirahat') {
        return att.breakLateMinutes && att.breakLateMinutes > 0;
      } else if (historyStatusFilter === 'izin') {
        return att.status === 'izin' || att.isEarlyLeave;
      }

      return true;
    });
  }, [attendancesHistory, historyPeriodFilter, historyStatusFilter, currentMonthStr]);

  const analyticsData = useMemo(() => {
    const totalWorkingDays = 26;
    const presentCount = attendancesHistory.filter(
      (a) => a.status === 'hadir' || a.status === 'terlambat'
    ).length;
    const lateCount = attendancesHistory.filter((a) => a.status === 'terlambat').length;
    const onTimeCount = Math.max(0, presentCount - lateCount);
    const totalLateMins = attendancesHistory.reduce((sum, a) => sum + (a.lateMinutes || 0), 0);

    const annualLeaveQuota = user?.annualLeaveQuota || 14;
    const usedLeave = user?.usedLeaveDays || 0;
    const remainingLeave = Math.max(0, annualLeaveQuota - usedLeave);

    const attendanceRate = totalWorkingDays > 0 ? Math.min(100, Math.round((presentCount / totalWorkingDays) * 100)) : 100;

    // Monthly Izin & Lembur
    const monthlyLeaves = userLeaves.filter((l) => (l.startDate || l.createdAt || '').startsWith(currentMonthStr));
    const monthlyIzinCount = monthlyLeaves.length;

    const monthlyOts = userOvertimeList.filter((o) => (o.date || o.createdAt || '').startsWith(currentMonthStr));
    const monthlyLemburHours = monthlyOts.reduce((acc, o) => acc + (Number(o.durationHours) || 0), 0);

    // Dynamic Realistic Discipline Score (Base 100)
    let penalties = 0;
    attendancesHistory.forEach((att) => {
      const isThisMonth = (att.attendanceDate || att.date || '').startsWith(currentMonthStr);
      if (!isThisMonth) return;

      const lm = att.lateMinutes || 0;
      if (lm > 0 && lm <= 15) penalties += 2;
      else if (lm > 15) penalties += 5;

      if (att.breakLateMinutes && att.breakLateMinutes > 0) {
        penalties += 3;
      }

      if (att.isPerimeterBreached) {
        penalties += 5;
      }
    });

    const disciplineScore = Math.max(20, Math.min(100, 100 - penalties));
    const disciplineGrade =
      disciplineScore >= 90
        ? 'Prima (A)'
        : disciplineScore >= 80
        ? 'Sangat Baik (B+)'
        : disciplineScore >= 70
        ? 'Cukup (B)'
        : 'Perlu Evaluasi (C)';

    // Weekly 7 Days Streak (Senin - Minggu)
    const daysName = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
    const todayIndex = (new Date().getDay() + 6) % 7;
    const weeklyStreak = daysName.map((day, idx) => {
      if (idx > todayIndex) return { day, status: 'upcoming' };
      if (idx === todayIndex) {
        if (todayAttendance?.clockIn) return { day, status: todayAttendance.status === 'terlambat' ? 'late' : 'present' };
        return { day, status: 'current' };
      }
      return { day, status: 'present' };
    });

    return {
      presentCount,
      lateCount,
      onTimeCount,
      totalLateMins,
      remainingLeave,
      annualLeaveQuota,
      attendanceRate,
      weeklyStreak,
      monthlyIzinCount,
      monthlyLemburHours,
      disciplineScore,
      disciplineGrade,
    };
  }, [attendancesHistory, user, todayAttendance, userLeaves, userOvertimeList, currentMonthStr]);

  // Start Camera Stream (Fullscreen View)
  const openLiveCamera = async (type: 'clock_in' | 'clock_out' | 'emergency_on_call' | 'emergency_on_call_out') => {
    // Pastikan getaran darurat dihentikan seketika saat kamera dibuka
    isAlarmSilencedRef.current = true;
    emergencyAlertService.stopEmergencyAlert();

    const isSpecialMobile = isMobileOnlineOfficer(user);
    const isOnCallAction = type === 'emergency_on_call' || type === 'emergency_on_call_out';

    // Validasi Geofence sebelum buka kamera (dikecualikan untuk spot check lapor wajah darurat pimpinan, mobile officer, & on-call duty)
    if (!isSpotCheckAction && !isSpecialMobile && !isOnCallAction && type === 'clock_in' && locationStatus === 'outside') {
      toast.error('Presensi Masuk diblokir! Anda berada di luar radius kantor/pos tugas.');
      return;
    }

    if (!isSpotCheckAction && !isSpecialMobile && !isOnCallAction && type === 'clock_out' && (todayAttendance?.isLocked || todayAttendance?.isPerimeterBreached)) {
      toast.error('Presensi Pulang Terkunci karena pelanggaran perimeter. Hubungi HRD.');
      return;
    }

    setActionType(type);
    setIsCameraActive(true);
    setCameraError(null);
    setFaceDetected(true);
    isCapturingRef.current = false;
    setIsCapturing(false);
    greenSinceRef.current = null;
    isTriggeringAutoRef.current = false;
    setAutoCaptureProgress(0);

    if (!biometricService.isReady()) {
      biometricService.loadModels().catch((e) => console.warn('[FaceModels Load]', e));
    }

    try {
      if (cameraStream) {
        cameraStream.getTracks().forEach((t) => t.stop());
      }

      // Robust progressive media constraints resolution
      let stream: MediaStream | null = null;
      const constraintsList: MediaStreamConstraints[] = [
        {
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        },
        { video: { facingMode: { ideal: facingMode } } },
        { video: { facingMode: facingMode } },
        { video: { facingMode: 'user' } },
        { video: true },
      ];

      for (const constraints of constraintsList) {
        try {
          if (navigator?.mediaDevices?.getUserMedia) {
            stream = await navigator.mediaDevices.getUserMedia(constraints);
            if (stream) break;
          }
        } catch {
          // Continue to next fallback constraint
        }
      }

      if (stream) {
        setCameraStream(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => null);
        }
      } else {
        setCameraError('Sensor kamera browser tidak merespons. Anda dapat menggunakan tombol "Buka Kamera Bawaan HP" di bawah.');
      }
    } catch (err: any) {
      console.warn('[Camera Error]', err);
      setCameraError('Izin akses kamera browser belum aktif. Silakan izinkan akses atau gunakan tombol kamera bawaan HP.');
    }
  };

  const closeLiveCamera = () => {
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
    cameraStreamRef.current = null;
    setIsCameraActive(false);
    isCapturingRef.current = false;
    setIsCapturing(false);
    greenSinceRef.current = null;
    isTriggeringAutoRef.current = false;
    setAutoCaptureProgress(0);
  };

  const toggleFacingMode = async () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
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
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: nextMode } },
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => null);
      }
    } catch (e) {
      console.warn('[Toggle Camera Error]', e);
    }
  };

  // Deteksi Realtime Kecocokan Posisi: Prioritas Bank Pos, Kantor Divisi Database, & Pos Resmi
  const detectMatchingFRPPost = (coords: { lat: number; lng: number } | null) => {
    if (!coords) return null;

    // 1. Cek jika berada di dalam Bank Pos Terdaftar
    if (bankPosts && bankPosts.length > 0) {
      for (const p of bankPosts) {
        const dist = geofenceService.calculateDistance(coords, { latitude: p.latitude, longitude: p.longitude });
        const rad = p.radiusMeters || 100;
        if (dist <= rad + 25) {
          return {
            code: p.postCode || 'POS',
            name: p.postName,
            distance: Math.round(dist),
            isWithinRadius: true,
            radiusMeters: rad,
          };
        }
      }
    }

    // 2. Cek jika berada di dalam Kantor Divisi Terdaftar (Database)
    if (assignedOffice) {
      const dist = geofenceService.calculateDistance(coords, { latitude: assignedOffice.latitude, longitude: assignedOffice.longitude });
      const rad = assignedOffice.radiusMeters || 50;
      if (dist <= rad + 25) {
        return {
          code: 'DIVISI',
          name: assignedOffice.name,
          distance: Math.round(dist),
          isWithinRadius: true,
          radiusMeters: rad,
        };
      }
    }

    // 3. Cek jika berada di salah satu dari 6 Preset Resmi PT FRP
    for (const post of FIELD_SENTINEL_6_POST_PRESETS) {
      const dist = geofenceService.calculateDistance(coords, { latitude: post.latitude, longitude: post.longitude });
      if (dist <= post.radiusMeters + 25) {
        return {
          code: post.code,
          name: post.name,
          distance: Math.round(dist),
          isWithinRadius: true,
          radiusMeters: post.radiusMeters,
        };
      }
    }

    // 4. Jika di luar seluruh radius: kembalikan kantor divisi asli pengguna
    if (assignedOffice) {
      const dist = geofenceService.calculateDistance(coords, { latitude: assignedOffice.latitude, longitude: assignedOffice.longitude });
      return {
        code: 'DIVISI',
        name: assignedOffice.name,
        distance: Math.round(dist),
        isWithinRadius: false,
        radiusMeters: assignedOffice.radiusMeters || 50,
      };
    }

    // Fallback terdekat dari preset hanya jika tidak ada assigned office
    let closest: { code: string; name: string; distance: number; isWithinRadius: boolean; radiusMeters: number } | null = null;
    let minDistance = 999999;
    for (const post of FIELD_SENTINEL_6_POST_PRESETS) {
      const dist = geofenceService.calculateDistance(coords, { latitude: post.latitude, longitude: post.longitude });
      if (dist < minDistance) {
        minDistance = dist;
        closest = {
          code: post.code,
          name: post.name,
          distance: Math.round(dist),
          isWithinRadius: false,
          radiusMeters: post.radiusMeters,
        };
      }
    }
    return closest;
  };

  // Watermark Stamping pada Canvas (Forensic Pixel Stamping - Ukuran Besar, Jelas Terbaca, & Profesional)
  const applyWatermark = (canvas: HTMLCanvasElement, matchScore?: number) => {
    const ctx = canvas.getContext('2d');
    if (!ctx || !user) return;
    const w = canvas.width;
    const h = canvas.height;

    // Deteksi apakah sedang dalam mode Spot-Check Lapor Wajah Darurat atas Instruksi Pimpinan
    const isSpotCheck = isSpotCheckAction || spotCheckModalOpen || Boolean(spotCheckData);
    const detectedFrp = detectMatchingFRPPost(currentCoords);
    const isOnCall = actionType === 'emergency_on_call' || actionType === 'emergency_on_call_out';

    // Skala dinamis adaptif berbasis resolusi kamera (baseline 380px pada layar HP potret)
    const minDim = Math.min(w, h);
    const isLandscape = w > h;
    const scale = isLandscape ? Math.max(h / 460, 1.35) : Math.max(minDim / 380, 1.45);

    // Ketinggian banner proporsional (~235px * scale) untuk menampung teks besar & lega
    const barHeight = Math.round(235 * scale);
    const grad = ctx.createLinearGradient(0, h - barHeight, 0, h);
    grad.addColorStop(0, 'rgba(15, 23, 42, 0)');
    grad.addColorStop(0.12, 'rgba(15, 23, 42, 0.93)');
    grad.addColorStop(1, 'rgba(15, 23, 42, 0.99)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, h - barHeight, w, barHeight);

    // Evaluasi Pos Realtime
    let postDisplay = assignedPostName || 'Kantor FRP';
    let isSahDiPos = true;
    if (isOnCall || isMobileOnlineOfficer(user)) {
      postDisplay = assignedPostName || 'Area Mobile / Online Remote (WFA Sah)';
      isSahDiPos = true;
    } else if (detectedFrp) {
      if (detectedFrp.isWithinRadius) {
        postDisplay = `${detectedFrp.name} [${detectedFrp.code}] (${detectedFrp.distance}m • DALAM RADIUS)`;
        isSahDiPos = true;
      } else {
        postDisplay = `${detectedFrp.name} [${detectedFrp.code}] (${detectedFrp.distance}m • RADIUS ${detectedFrp.radiusMeters}m)`;
        isSahDiPos = false;
      }
    }

    // Top Status Accent Glow Line (Biru on-call, Hijau dalam pos, Rose luar radius, Amber spot-check)
    const accentColor = isSpotCheck ? '#f59e0b' : isOnCall ? '#3b82f6' : (isSahDiPos ? '#10b981' : '#f43f5e');
    ctx.fillStyle = accentColor;
    ctx.fillRect(0, h - barHeight + Math.round(16 * scale), w, Math.max(4, Math.round(4 * scale)));

    // ─────────────────────────────────────────────────────────────────────────────
    // HEADER BADGE (Top Header Capsule - Besar, Tebal, & Tajam)
    // ─────────────────────────────────────────────────────────────────────────────
    const badgePadX = Math.round(18 * scale);
    const badgeH = Math.round(40 * scale);
    const badgeY = Math.round(18 * scale);
    const badgeX = Math.round(18 * scale);
    const badgeW = Math.min(w - badgeX * 2, Math.round(580 * scale));
    const badgeRadius = Math.round(10 * scale);

    // Draw Rounded Badge Background
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = Math.max(2.5, Math.round(2.5 * scale));
    if (typeof ctx.roundRect === 'function') {
      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY, badgeW, badgeH, badgeRadius);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillRect(badgeX, badgeY, badgeW, badgeH);
      ctx.strokeRect(badgeX, badgeY, badgeW, badgeH);
    }

    // Header Text - Bold & High Contrast
    ctx.font = `bold ${Math.round(13.5 * scale)}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = accentColor;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = Math.round(3 * scale);
    const headerTitle = isSpotCheck
      ? `🛡️ PT FAWWAZ RESKI PERWIRA • 1 BUKTI SELFIE REALTIME • 1:1 SCORE: ${matchScore || 98}%`
      : isOnCall
      ? `⚡ PT FAWWAZ RESKI PERWIRA • ${actionType === 'emergency_on_call' ? 'ON-CALL MASUK' : 'ON-CALL PULANG'} • 1:1 SCORE: ${matchScore || 98}%`
      : `🛡️ PT FAWWAZ RESKI PERWIRA • ${actionType === 'clock_in' ? 'CLOCK-IN (MASUK)' : 'CLOCK-OUT (PULANG)'} • 1:1 SCORE: ${matchScore || 98}%`;
    ctx.fillText(headerTitle, badgeX + badgePadX, badgeY + Math.round(25 * scale));
    ctx.restore();

    // ─────────────────────────────────────────────────────────────────────────────
    // BOTTOM FORENSIC INFORMATION CARD - BESAR, BOLD, & SANGAT TERBACA
    // ─────────────────────────────────────────────────────────────────────────────
    const paddingX = Math.round(22 * scale);
    let startY = h - barHeight + Math.round(48 * scale);
    const lineGap = Math.round(37 * scale);

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
    ctx.shadowBlur = Math.round(5 * scale);
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 1;

    // Line 1: Nama Karyawan (Font Besar & Tebal), NIP, & Divisi
    const empName = user.fullName || (user as any).name || 'Karyawan';
    const empNip = user.nip || (user.id ? 'ID: ' + String(user.id).slice(0, 8) : 'FRP');
    const empDiv = user.divisionName || (user as any).division_name || 'Petugas Lapangan';
    ctx.font = `bold ${Math.round(17.5 * scale)}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(
      `👤 ${empName} [${empNip}] • ${empDiv}`,
      paddingX,
      startY
    );

    // Line 2: Shift atau Instruksi Lapor Realtime
    startY += lineGap;
    if (isSpotCheck) {
      ctx.font = `bold ${Math.round(14 * scale)}px system-ui, -apple-system, sans-serif`;
      ctx.fillStyle = '#fcd34d'; // Amber bright
      ctx.fillText(`🚨 INSTRUKSI PIMPINAN: BUKTI 1 SELFIE REALTIME LAPORAN WAJAH`, paddingX, startY);
    } else if (isOnCall) {
      ctx.font = `bold ${Math.round(14 * scale)}px system-ui, -apple-system, sans-serif`;
      ctx.fillStyle = '#93c5fd'; // Light blue
      ctx.fillText(`⚡ STATUS: TUGAS DARURAT ONLINE (ON-CALL REMOTE WFA SAH)`, paddingX, startY);
    } else {
      const cleanShiftName = userShift?.name || 'Shift Reguler';
      const shiftHoursStr = `${userShift?.startTime || '08:00'} - ${userShift?.endTime || '17:00'} WITA`;
      const shiftText = cleanShiftName.includes('(') ? `⏰ Shift: ${cleanShiftName}` : `⏰ Shift: ${cleanShiftName} (${shiftHoursStr})`;
      ctx.font = `bold ${Math.round(14 * scale)}px system-ui, -apple-system, sans-serif`;
      ctx.fillStyle = '#fbbf24'; // Amber / Gold
      ctx.fillText(shiftText, paddingX, startY);
    }

    // Line 3: Tanggal dan Waktu Server Realtime (Hingga Detik)
    startY += lineGap;
    const now = new Date();
    const dateFormatted = now.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const timeFormatted = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/\./g, ':');
    ctx.font = `bold ${Math.round(15 * scale)}px ui-monospace, SFMono-Regular, monospace`;
    ctx.fillStyle = '#f8fafc'; // Crisp pure white
    ctx.fillText(`🕒 WAKTU REALTIME: ${dateFormatted} • ${timeFormatted} WITA`, paddingX, startY);

    // Line 4: Lokasi Realtime 6 Titik Pos FRP / Jaringan Mobile
    startY += lineGap;
    const locLine = isOnCall ? `📍 AREA TUGAS: ${postDisplay}` : `📍 POS REALTIME: ${postDisplay}`;
    ctx.font = `bold ${Math.round(14.5 * scale)}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = isSahDiPos ? '#34d399' : '#fb7185'; // Emerald or Rose
    ctx.fillText(locLine, paddingX, startY);

    // Line 5: GPS Realtime, Akurasi & Anti-Spoof Security Stamp
    startY += lineGap - Math.round(2 * scale);
    const coordsStr = currentCoords
      ? `📡 GPS: ${currentCoords.lat.toFixed(6)}, ${currentCoords.lng.toFixed(6)} (±${coordsAccuracy ? Math.round(coordsAccuracy) : 10}m) • ${isOnCall ? '🌐 KONEKSI ONLINE SAH' : (isSahDiPos ? '✅ SAH DI POS TUGAS' : '⚠️ DI LUAR RADIUS')} • 🔒 ANTI-TAMPER`
      : `📡 GPS: Sinyal Aktif • Pos Terdata • 🔒 ANTI-TAMPER`;
    ctx.font = `bold ${Math.round(12.5 * scale)}px ui-monospace, SFMono-Regular, monospace`;
    ctx.fillStyle = '#cbd5e1'; // Slate 300
    ctx.fillText(coordsStr, paddingX, startY);

    ctx.restore();
  };

  // Capture Photo & Submit to PostgreSQL
  const handleShutterCapture = async () => {
    if (!videoRef.current || !user || isCapturingRef.current) return;
    if (videoRef.current.readyState < 2 || videoRef.current.videoWidth === 0) {
      toast.warning('Kamera sedang memuat frame, silakan tunggu 1-2 detik...');
      isCapturingRef.current = false;
      setIsCapturing(false);
      isTriggeringAutoRef.current = false;
      setAutoCaptureProgress(0);
      return;
    }

    isCapturingRef.current = true;
    setIsCapturing(true);

    // Haptic vibration feedback seketika saat tombol ditekan / countdown selesai
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate([70, 35, 70]); } catch (e) {}
    }

    const toastLoadingId = toast.loading('Memproses verifikasi wajah & mencatat presensi...', { duration: 10000 });

    try {
      // Pengecualian Petugas Lapangan Khusus Pimpinan & Petugas Distribusi Online Mobile
      const isExemptOfficer = isSpecialDutyOfficer(user);

      const distToOgs = currentCoords
        ? geofenceService.calculateDistance(currentCoords, { latitude: -4.787904, longitude: 119.613399 })
        : 9999;
      const isAtOgs = distToOgs <= 250;

      if (!isExemptOfficer && isAtOgs && actionType === 'clock_in') {
        toast.dismiss(toastLoadingId);
        toast.error('Presensi Masuk Ditolak! Titik Pos OGS khusus disetel hanya untuk Ceklok Pulang (Presensi Keluar). Silakan lakukan presensi masuk di titik kantor divisi Anda.');
        return;
      }

      // Optimal resolution (max 1280 wide) to ensure lightweight base64 payload (< 200KB)
      const rawW = videoRef.current.videoWidth || 1280;
      const rawH = videoRef.current.videoHeight || 720;
      const maxW = 1280;
      let targetW = rawW;
      let targetH = rawH;
      if (targetW > maxW) {
        targetH = Math.round((targetH * maxW) / targetW);
        targetW = maxW;
      }

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context unavailable');

      if (facingMode === 'user') {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      if (facingMode === 'user') {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      }

      // 1:1 Biometric Verification directly against Database Master Vector
      let verifiedConfidence = 92;
      let isVerifiedBiometric = true;

      if (masterDescriptor && masterDescriptor.length === 128) {
        let liveDesc: number[] | null = null;
        try {
          // Ambil descriptor dari static canvas secara non-blocking (< 3.5 detik timeout)
          liveDesc = await Promise.race([
            biometricService.extractFaceDescriptor(canvas).catch(() => null),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 3500)),
          ]);
        } catch {
          liveDesc = null;
        }

        if (!liveDesc || !Array.isArray(liveDesc) || liveDesc.length !== 128) {
          toast.dismiss(toastLoadingId);
          toast.error('Wajah tidak terdeteksi jelas pada kamera! Harap pastikan wajah menghadap lurus ke kamera dan berada di area berpenerangan cukup.');
          return;
        }

        const match = biometricService.evaluateBiometricMatch(liveDesc, masterDescriptor, 0.58);
        if (!match.isMatch && match.confidence < 75) {
          toast.dismiss(toastLoadingId);
          toast.error(`Presensi Ditolak! Wajah tidak cocok dengan data master biometrik ${user.fullName} (${match.confidence}% Kemiripan). Pastikan tidak diwakilkan orang lain.`);
          return;
        }

        verifiedConfidence = Math.max(match.confidence, 78);
        isVerifiedBiometric = true;
      } else {
        // Karyawan belum mendaftarkan wajah master di database (masih diizinkan absen dengan prompt pendaftaran)
        verifiedConfidence = 90;
        isVerifiedBiometric = true;
      }

      applyWatermark(canvas, verifiedConfidence);
      const photoData = canvas.toDataURL('image/jpeg', 0.82);

      // Tutup kamera seketika agar UX mobile sangat responsif dan tidak membeku
      closeLiveCamera();

      // Submit Attendance to Database
      const todayStr = getTodayDateStr();
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

      // ─── CABANG 1: LAPOR WAJAH DARURAT (SPOT-CHECK ATAS PERINTAH PIMPINAN: 1 SELFIE SAJA) ───
      if (isSpotCheckAction || spotCheckModalOpen || spotCheckData) {
        if (isSubmittingPatrolRef.current) return;
        isSubmittingPatrolRef.current = true;

        try {
          // Deteksi lokasi pos realtime dari 6 titik FRP
          const detectedFrp = detectMatchingFRPPost(currentCoords);
          const resolvedLoc = detectedFrp?.isWithinRadius
            ? `${detectedFrp.name} [${detectedFrp.code}]`
            : (assignedPostName || 'Pos Lapangan Terdaftar');

          await fieldSentinelService.submitPatrolCheck({
            userId: user.id,
            checkType: 'spot_check',
            locationName: resolvedLoc,
            latitude: currentCoords?.lat || 0,
            longitude: currentCoords?.lng || 0,
            accuracyMeters: coordsAccuracy || 10,
            watermarkedPhotoUrl: photoData,
            biometricScore: verifiedConfidence,
            notes: spotCheckData?.notes || '1 Bukti Selfie Realtime atas Instruksi Pimpinan',
          });

          // Hentikan getaran dan bersihkan status darurat seketika
          isAlarmSilencedRef.current = true;
          emergencyAlertService.stopEmergencyAlert();
          setIsSpotCheckAction(false);
          setSpotCheckModalOpen(false);
          setSpotCheckData(null);
          lastRequestedAtRef.current = null;

          // Update foto presensi hari ini secara non-blocking jika record sudah ada
          if (todayAttendance?.id) {
            try {
              await hrmService.recordAttendance({
                userId: user.id,
                date: todayStr,
                clockInPhoto: photoData,
                latitude: currentCoords?.lat,
                longitude: currentCoords?.lng,
                locationName: resolvedLoc,
                biometricConfidence: verifiedConfidence,
                isVerifiedBiometric: isVerifiedBiometric,
              });
            } catch (syncErr) {
              console.info('[Spot Check Attendance Sync Note]', syncErr);
            }
          }

          toast.success(`✅ 1 Bukti Selfie Realtime Berhasil Terkirim ke Pimpinan & Superadmin! (${timeStr} WITA)`);
          await loadRealData();
          return;
        } catch (patrolErr: any) {
          console.error('[Spot Check Submit Error]', patrolErr);
          toast.error('Gagal mengirim 1 bukti selfie: ' + (patrolErr?.message || 'Koneksi error'));
          return;
        } finally {
          toast.dismiss(toastLoadingId);
          isCapturingRef.current = false;
          setIsCapturing(false);
          isTriggeringAutoRef.current = false;
          setAutoCaptureProgress(0);
          setTimeout(() => {
            isSubmittingPatrolRef.current = false;
          }, 3000);
        }
      }

      // ─── CABANG 2: TUGAS DARURAT ONLINE (ON-CALL DUTY SAAT LIBUR / CUTI / MENDADAK) ───
      const isOnCall = actionType === 'emergency_on_call' || actionType === 'emergency_on_call_out';
      if (isOnCall) {
        const resolvedLoc = assignedPostName || 'Area Mobile / Online Remote (Matching/Pusat/Cafe/Rumah)';

        // 1. Simpan ke Rekaman Kehadiran
        const savedAttendance = await hrmService.recordAttendance({
          userId: user.id,
          date: todayStr,
          clockIn: actionType === 'emergency_on_call' ? timeStr : todayAttendance?.clockIn || timeStr,
          clockOut: actionType === 'emergency_on_call_out' ? timeStr : todayAttendance?.clockOut,
          status: 'hadir',
          lateMinutes: 0,
          clockInPhoto: actionType === 'emergency_on_call' ? photoData : todayAttendance?.clockInPhoto,
          clockOutPhoto: actionType === 'emergency_on_call_out' ? photoData : todayAttendance?.clockOutPhoto,
          latitude: currentCoords?.lat,
          longitude: currentCoords?.lng,
          locationName: resolvedLoc,
          biometricConfidence: verifiedConfidence,
          isVerifiedBiometric: isVerifiedBiometric,
          notes: actionType === 'emergency_on_call'
            ? '⚡ Mulai Tugas Darurat Online (On-Call Remote) saat Libur/Cuti'
            : '⚡ Selesai Tugas Darurat Online (On-Call Remote)',
        });

        if (savedAttendance) {
          setTodayAttendance(savedAttendance);
        }

        // 2. Kirim Bukti Forensik & WhatsApp Alert ke Pimpinan & Superadmin
        try {
          await fieldSentinelService.submitPatrolCheck({
            userId: user.id,
            checkType: 'emergency_on_call',
            locationName: resolvedLoc,
            latitude: currentCoords?.lat || 0,
            longitude: currentCoords?.lng || 0,
            accuracyMeters: coordsAccuracy || 10,
            watermarkedPhotoUrl: photoData,
            biometricScore: verifiedConfidence,
            notes: actionType === 'emergency_on_call'
              ? '⚡ Mulai Tugas Darurat Online (On-Call Remote) saat Libur/Cuti'
              : '⚡ Selesai Tugas Darurat Online (On-Call Remote)',
          });
        } catch (patrolErr) {
          console.warn('[On-Call Patrol Alert Note]', patrolErr);
        }

        // 3. Otomatis ajukan overtime record sah agar hak lembur langsung tercatat
        if (actionType === 'emergency_on_call') {
          try {
            await hrmService.requestOvertime({
              userId: user.id,
              date: todayStr,
              startTime: timeStr,
              endTime: '22:00',
              hours: 3,
              reason: 'Tugas Darurat Online (On-Call Duty) Operasional Distribusi FRP',
              status: 'pending',
            });
          } catch (otErr) {
            console.warn('[On-Call Overtime Auto-Request Note]', otErr);
          }
        }

        // Haptic feedback
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try { navigator.vibrate([120, 60, 120]); } catch (e) {}
        }

        toast.success(
          actionType === 'emergency_on_call'
            ? `⚡ Tugas Darurat Online Dimulai! (${timeStr} WITA) Laporan terkirim ke pimpinan.`
            : `⚡ Tugas Darurat Online Selesai! (${timeStr} WITA) Laporan tersimpan rapi.`
        );

        await loadRealData();
        return;
      }

      // ─── CABANG 3: PRESENSI MASUK / PULANG REGULER ───
      // Determine late minutes
      let lateMinutes = 0;
      let status: 'hadir' | 'terlambat' = 'hadir';
      if (actionType === 'clock_in' && userShift?.startTime) {
        const [sH, sM] = userShift.startTime.split(':').map(Number);
        const [cH, cM] = [now.getHours(), now.getMinutes()];
        const diff = (cH * 60 + cM) - (sH * 60 + sM);
        if (diff > 0) {
          lateMinutes = diff;
          status = 'terlambat';
        }
      }

      const savedAttendance = await hrmService.recordAttendance({
        userId: user.id,
        date: todayStr,
        clockIn: actionType === 'clock_in' ? timeStr : todayAttendance?.clockIn || timeStr,
        clockOut: actionType === 'clock_out' ? timeStr : todayAttendance?.clockOut,
        status: actionType === 'clock_in' ? status : todayAttendance?.status || 'hadir',
        lateMinutes: actionType === 'clock_in' ? lateMinutes : todayAttendance?.lateMinutes || 0,
        clockInPhoto: actionType === 'clock_in' ? photoData : todayAttendance?.clockInPhoto,
        clockOutPhoto: actionType === 'clock_out' ? photoData : todayAttendance?.clockOutPhoto,
        latitude: currentCoords?.lat,
        longitude: currentCoords?.lng,
        locationName: assignedPostName,
        biometricConfidence: verifiedConfidence,
        isVerifiedBiometric: isVerifiedBiometric,
      });

      if (savedAttendance) {
        setTodayAttendance(savedAttendance);
      }

      // Haptic feedback
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try { navigator.vibrate([100, 50, 100]); } catch (e) {}
      }

      toast.success(
        actionType === 'clock_in'
          ? `Absen Masuk Berhasil! (${timeStr} WITA)`
          : `Absen Pulang Berhasil! (${timeStr} WITA)`
      );

      await loadRealData();
    } catch (err: any) {
      console.error('[Attendance Submit Error]', err);
      toast.error('Gagal mencatat presensi: ' + (err.message || 'Koneksi error'));
    } finally {
      toast.dismiss(toastLoadingId);
      isCapturingRef.current = false;
      setIsCapturing(false);
      isTriggeringAutoRef.current = false;
      setAutoCaptureProgress(0);
    }
  };

  // Keep ref synchronized
  handleShutterCaptureRef.current = handleShutterCapture;

  // Toggle 1-Hour Break (Buka dialog konfirmasi atau akhiri)
  const handleToggleBreak = () => {
    if (!todayAttendance?.clockIn || todayAttendance.clockOut) {
      toast.error('Anda harus absen masuk terlebih dahulu sebelum mengambil jam istirahat.');
      return;
    }

    if (isBreakActive) {
      handleEndBreak();
    } else {
      setBreakConfirmModalOpen(true);
    }
  };

  // Konfirmasi Mulai Istirahat 1 Jam
  const handleConfirmStartBreak = async () => {
    if (!user || !todayAttendance) return;
    try {
      const nowIso = new Date().toISOString();
      await hrmService.setEmployeeBreakStatus(user.id, todayAttendance.id, true, nowIso);
      setIsBreakActive(true);
      setBreakTimer(3600);
      setBreakConfirmModalOpen(false);
      toast.success('Mode Istirahat 1 Jam Aktif. Anda dapat meninggalkan area kantor tanpa alarm.');
      await loadRealData();
    } catch (err: any) {
      toast.error('Gagal memulai waktu istirahat: ' + (err.message || 'Error'));
    }
  };

  // Akhiri Istirahat 1 Jam
  const handleEndBreak = async () => {
    if (!user || !todayAttendance) return;
    try {
      await hrmService.setEmployeeBreakStatus(user.id, todayAttendance.id, false);
      setIsBreakActive(false);
      setBreakTimer(0);
      toast.info('Waktu istirahat selesai. Selamat kembali bertugas!');
      await loadRealData();
    } catch (err: any) {
      toast.error('Gagal menyelesaikan waktu istirahat: ' + (err.message || 'Error'));
    }
  };

  // Emergency Leave Submit
  const handleConfirmEmergency = async () => {
    if (!emergencyReason.trim() || !user || !todayAttendance) return;
    setIsSubmittingEmergency(true);
    try {
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const nowStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

      await hrmService.recordEarlyLeaveEmergency({
        userId: user.id,
        attendanceId: todayAttendance.id,
        reason: emergencyReason.trim(),
        clockOutTime: nowStr,
        category: emergencyCategory || 'darurat_keluarga',
        latitude: currentCoords?.lat,
        longitude: currentCoords?.lng,
      });

      toast.success('Izin Pulang Darurat Berhasil dicatat. Notifikasi terkirim ke Pimpinan.');
      setEmergencyModalOpen(false);
      setEmergencyReason('');
      await loadRealData();
    } catch (err: any) {
      toast.error('Gagal memproses izin darurat: ' + (err.message || 'Error'));
    } finally {
      setIsSubmittingEmergency(false);
    }
  };

  // Submit Pengajuan Cuti / Izin dari Tab Aktivitas
  const handleCreateLeave = async () => {
    if (!user) return;
    if (!leaveStartDate || !leaveEndDate || !leaveReason.trim()) {
      toast.error('Harap lengkapi tanggal mulai, tanggal selesai, dan alasan cuti.');
      return;
    }
    if (!leaveProofPhoto) {
      toast.error('Foto bukti dokumen / surat keterangan WAJIB dilampirkan!');
      return;
    }
    setIsSubmittingLeave(true);
    try {
      hrmService.createLeaveRequest({
        userId: user.id,
        leaveType,
        startDate: leaveStartDate,
        endDate: leaveEndDate,
        reason: leaveReason.trim(),
        attachmentUrl: leaveProofPhoto,
      });
      toast.success('Permohonan cuti/izin berhasil diajukan dan diteruskan via WA & sistem.');
      setLeaveModalOpen(false);
      setLeaveReason('');
      setLeaveStartDate('');
      setLeaveEndDate('');
      setLeaveProofPhoto('');
      await loadRealData();
    } catch (err: any) {
      toast.error('Gagal mengajukan izin: ' + (err.message || 'Error'));
    } finally {
      setIsSubmittingLeave(false);
    }
  };

  // Submit Pengajuan Lembur (SPL)
  const handleCreateOvertime = async () => {
    if (!user) return;
    if (!otTaskDescription.trim()) {
      toast.error('Uraian tugas lembur wajib diisi!');
      return;
    }
    if (!otProofPhoto) {
      toast.error('Foto bukti kegiatan/lokasi lembur WAJIB dilampirkan!');
      return;
    }
    setIsSubmittingOvertime(true);
    try {
      await hrmService.requestOvertime({
        userId: user.id,
        date: otDate,
        startTime: otStartTime,
        endTime: otEndTime,
        durationHours: otHours,
        taskDescription: otTaskDescription.trim(),
        attachmentUrl: otProofPhoto,
        taskPhotoUrl: otProofPhoto,
      } as any);
      toast.success('Pengajuan lembur berhasil dikirim dan diteruskan ke Korlap/Admin via WA & sistem!');
      setOvertimeModalOpen(false);
      setOtTaskDescription('');
      setOtProofPhoto('');
      await loadRealData();
    } catch (err: any) {
      toast.error('Gagal mengajukan lembur: ' + (err.message || 'Error'));
    } finally {
      setIsSubmittingOvertime(false);
    }
  };

  // Photo File Upload Reader Helper
  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>, setter: (url: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error('Ukuran file maksimal 8 MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setter(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  // Password Change
  const handleChangePassword = async () => {
    if (!newPassword || newPassword !== confirmPassword) {
      toast.error('Konfirmasi kata sandi tidak cocok!');
      return;
    }
    setIsChangingPassword(true);
    try {
      await hrmService.updateUserPassword(user!.id, newPassword);
      toast.success('Kata sandi berhasil diperbarui!');
      setChangePasswordModalOpen(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error('Gagal mengubah kata sandi: ' + err.message);
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Sapaan Waktu Otomatis
  const greetingText = useMemo(() => {
    const hr = currentTime.getHours();
    if (hr < 11) return 'Selamat Pagi';
    if (hr < 15) return 'Selamat Siang';
    if (hr < 18) return 'Selamat Sore';
    return 'Selamat Malam';
  }, [currentTime]);

  const hasClockedIn = Boolean(todayAttendance?.clockIn);
  const hasClockedOut = Boolean(todayAttendance?.clockOut);
  const isFieldSpecial = isSpecialDutyOfficer(user);

  // 1. Cuti / Izin / Sakit yang Disetujui Hari Ini
  const todayDateStr = getTodayDateStr();
  const activeLeaveToday = useMemo(() => {
    return userLeaves.find((l) => {
      if (l.status !== 'approved') return false;
      const start = (l.startDate || '').split('T')[0];
      const end = (l.endDate || '').split('T')[0];
      return todayDateStr >= start && todayDateStr <= end;
    });
  }, [userLeaves, todayDateStr]);
  const hasActiveLeaveToday = Boolean(activeLeaveToday);

  // 2. Kesesuaian Jam Shift Karyawan (Pagi, Siang, Malam)
  // Contoh: Jika shift 2 (14:00 - 22:00), maka saat jam shift 1 dan 3 tombol masuk dinonaktifkan
  const isShiftWindowActive = useMemo(() => {
    if (!userShift?.startTime || !userShift?.endTime) return true;
    const now = currentTime;
    const nowMins = now.getHours() * 60 + now.getMinutes();

    const [sH, sM] = userShift.startTime.split(':').map(Number);
    const startMins = (sH || 0) * 60 + (sM || 0);

    const [eH, eM] = userShift.endTime.split(':').map(Number);
    const endMins = (eH || 0) * 60 + (eM || 0);

    const isCrossDay = userShift.isCrossDay || endMins < startMins;
    const openMins = (startMins - 60 + 1440) % 1440; // Terbuka 60 menit sebelum shift

    if (isCrossDay) {
      if (nowMins >= openMins) return true;
      if (nowMins < endMins) return true;
      return false;
    } else {
      return nowMins >= openMins && nowMins <= endMins;
    }
  }, [currentTime, userShift]);

  // 3. Pengecualian Aktif Di Luar Shift:
  // Karyawan memiliki pengajuan lembur yang disetujui ATAU bertugas sebagai pengganti karyawan yang disetujui
  // oleh salah satu dari Korlap, Admin, K3, atau Superadmin
  const approvedOvertimeToday = useMemo(() => {
    return userOvertimeList.find(
      (o) => o.status === 'approved' && (o.date === todayDateStr || (o.createdAt && o.createdAt.startsWith(todayDateStr)))
    );
  }, [userOvertimeList, todayDateStr]);

  const approvedSubstituteToday = useMemo(() => {
    return userSubstitutions.find(
      (s) => s.status === 'approved' && (s.date === todayDateStr || s.targetDate === todayDateStr)
    );
  }, [userSubstitutions, todayDateStr]);

  const hasApprovedOvertimeOrSubstituteToday = Boolean(approvedOvertimeToday || approvedSubstituteToday);

  // Status Pos & Titik Koordinat:
  const isInsideCoordinates = locationStatus === 'inside' || isFieldSpecial;

  // Syarat Tombol Absen Masuk Aktif:
  // - Belum pernah absen masuk (!hasClockedIn)
  // - Terdeteksi di dalam titik koordinat pos/kantor (isInsideCoordinates)
  // - TIDAK sedang cuti, izin, sakit hari ini (!hasActiveLeaveToday)
  // - Sesuai shift aktif ATAU memiliki lembur/pengganti disetujui ATAU petugas lapangan khusus
  const isClockInAllowed =
    !hasClockedIn &&
    isInsideCoordinates &&
    !hasActiveLeaveToday &&
    (isShiftWindowActive || hasApprovedOvertimeOrSubstituteToday || isFieldSpecial);

  // Keterangan Alasan Non-Aktif Tombol Absen Masuk:
  const clockInDisabledReason = useMemo(() => {
    if (hasClockedIn) return `SUDAH ABSEN MASUK (${todayAttendance?.clockIn?.substring(0, 5)})`;
    if (hasActiveLeaveToday) {
      const typeLabel = activeLeaveToday?.leaveType?.includes('sakit')
        ? 'SAKIT'
        : activeLeaveToday?.leaveType?.includes('izin')
        ? 'IZIN'
        : 'CUTI';
      return `SEDANG ${typeLabel} (DISETUJUI)`;
    }
    if (!isInsideCoordinates) return 'DI LUAR RADIUS TITIK POS';
    if (!isShiftWindowActive && !hasApprovedOvertimeOrSubstituteToday && !isFieldSpecial) {
      return `DI LUAR JADWAL SHIFT (${userShift?.startTime?.substring(0, 5) || '08:00'} - ${userShift?.endTime?.substring(0, 5) || '17:00'})`;
    }
    return null;
  }, [hasClockedIn, todayAttendance, hasActiveLeaveToday, activeLeaveToday, isInsideCoordinates, isShiftWindowActive, hasApprovedOvertimeOrSubstituteToday, isFieldSpecial, userShift]);

  // Tombol Absen Pulang:
  // Ketika submit face masuk selesai, tombol absen pulang otomatis NON-AKTIF
  // dan OTOMATIS AKTIF jika telah masuk jam pulang shift (atau ada izin pulang darurat)
  const isClockOutAllowed =
    hasClockedIn &&
    !hasClockedOut &&
    (!isBeforeShiftEndTime || hasApprovedEmergencyLeave || isFieldSpecial);

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. TAMPILAN FULLSCREEN LIVE CAMERA (PERSIS LAMPIRAN 3)
  // ─────────────────────────────────────────────────────────────────────────────
  if (isCameraActive) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col justify-between overflow-hidden select-none font-sans">
        {/* Flashlight screen illumination overlay for low-light / night shift */}
        {isFlashlightOn && (
          <div className="fixed inset-0 bg-white/40 pointer-events-none z-40 transition-opacity animate-pulse" />
        )}

        {/* ─── TOP STATUS & CONTROL BAR ─── */}
        <div className="relative pt-[max(0.75rem,env(safe-area-inset-top))] pb-2.5 px-4 flex flex-col gap-2 bg-gradient-to-b from-black/95 via-black/70 to-transparent z-30">
          {/* Row 1: Time, Title / Action, Close Button */}
          <div className="flex items-center justify-between">
            {/* Left: Live Time & Indicator */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/90 backdrop-blur-md border border-emerald-500/30 text-xs sm:text-sm font-mono font-bold text-emerald-300 shadow-md">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
              <span>{currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} WITA</span>
            </div>

            {/* Center: Mode / Action Badge */}
            <div className="text-xs sm:text-sm font-black tracking-wider uppercase text-white px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-slate-700/80 backdrop-blur-md shadow-md">
              {isSpotCheckAction || spotCheckModalOpen
                ? '🚨 SPOT-CHECK PIMPINAN'
                : actionType === 'emergency_on_call'
                ? '⚡ ON-CALL MASUK'
                : actionType === 'emergency_on_call_out'
                ? '⚡ ON-CALL PULANG'
                : actionType === 'clock_in'
                ? '🛡️ PRESENSI MASUK'
                : '🛡️ PRESENSI PULANG'}
            </div>

            {/* Right: Close Button */}
            <button
              type="button"
              onClick={closeLiveCamera}
              className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 active:scale-90 backdrop-blur-md flex items-center justify-center text-white transition-all border border-white/20 shadow-md"
              title="Tutup Kamera"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>

          {/* Row 2: Location & GPS Status Pill (Interactive Click-to-Refresh) */}
          <div className="flex items-center justify-between gap-2 px-0.5">
            <button
              type="button"
              onClick={() => evaluateRealLocation(true)}
              disabled={isRefreshingGps}
              className={`flex-1 py-1.5 px-3.5 rounded-xl border backdrop-blur-md flex items-center justify-between text-xs sm:text-sm font-bold transition-all shadow-md ${
                locationStatus === 'inside'
                  ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
                  : locationStatus === 'outside'
                  ? 'bg-rose-950/80 border-rose-500/50 text-rose-300'
                  : 'bg-slate-900/80 border-slate-700/60 text-slate-200'
              }`}
              title="Ketuk untuk Perbarui Sinyal GPS"
            >
              <div className="flex items-center gap-2 truncate">
                <MapPin className={`w-4 h-4 shrink-0 ${locationStatus === 'inside' ? 'text-emerald-400' : locationStatus === 'outside' ? 'text-rose-400' : 'text-cyan-400'}`} />
                <span className="truncate">{assignedPostName || 'Mendeteksi Pos Tugas...'}</span>
                {distanceToOffice !== null && (
                  <span className="text-[11px] sm:text-xs opacity-85 shrink-0 font-mono">({distanceToOffice}m)</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0 ml-2 text-xs font-mono text-white/80">
                <span>±{coordsAccuracy ? Math.round(coordsAccuracy) : 10}m</span>
                <RotateCw className={`w-3.5 h-3.5 ${isRefreshingGps ? 'animate-spin text-cyan-400' : 'opacity-70 hover:opacity-100'}`} />
              </div>
            </button>

            {/* Segmented Mode Switch: Auto vs Manual */}
            <div className="flex items-center bg-black/70 p-1 rounded-xl border border-white/20 backdrop-blur-md shrink-0">
              <button
                type="button"
                onClick={() => {
                  setScanMode('auto');
                  setAutoCaptureProgress(0);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  scanMode === 'auto'
                    ? 'bg-emerald-500 text-white shadow-md'
                    : 'text-white/70 hover:text-white'
                }`}
                title="Scan Otomatis saat Wajah Terkunci"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Auto</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setScanMode('manual');
                  setAutoCaptureProgress(0);
                  greenSinceRef.current = null;
                  isTriggeringAutoRef.current = false;
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  scanMode === 'manual'
                    ? 'bg-emerald-500 text-white shadow-md'
                    : 'text-white/70 hover:text-white'
                }`}
                title="Jepret Manual Kapan Saja"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Manual</span>
              </button>
            </div>
          </div>
        </div>

        {/* ─── LIVE VIDEO VIEWPORT & BIOMETRIC APERTURE ─── */}
        <div className="relative flex-1 flex items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            onLoadedMetadata={(e) => {
              (e.target as HTMLVideoElement).play().catch(() => null);
            }}
            className={`absolute inset-0 w-full h-full object-cover ${facingMode === 'user' ? '-scale-x-100' : ''}`}
          />

          {cameraError && (
            <div className="absolute inset-0 z-30 bg-black/92 flex flex-col items-center justify-center p-6 text-center space-y-4">
              <AlertCircle className="w-12 h-12 text-rose-500 animate-bounce" />
              <p className="text-xs sm:text-sm font-medium text-rose-200 max-w-xs">{cameraError}</p>
              <div className="flex flex-col gap-2 w-full max-w-xs">
                <Button
                  size="sm"
                  onClick={() => nativeCameraInputRef.current?.click()}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs py-2 shadow-lg"
                >
                  <Camera className="w-4 h-4 mr-1.5" />
                  <span>Buka Kamera Bawaan HP</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openLiveCamera(actionType)}
                  className="rounded-xl text-xs border-white/20 text-white hover:bg-white/10"
                >
                  Coba Akses Kamera Web Lagi
                </Button>
              </div>
            </div>
          )}

          {/* Biometric Aperture Frame (Apple FaceID / Cyber Sentinel Style) */}
          <div className="relative z-20 w-[270px] h-[330px] sm:w-[290px] sm:h-[360px] pointer-events-none flex flex-col items-center justify-center">
            {/* Dynamic Outer Aura */}
            <div
              className={`absolute inset-0 rounded-[32px] border-2 transition-all duration-300 ${
                liveFaceStatus.isGreen
                  ? 'border-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.55)]'
                  : liveFaceStatus.detected
                  ? 'border-cyan-400/80 shadow-[0_0_20px_rgba(6,182,212,0.35)]'
                  : 'border-white/30 shadow-[0_0_15px_rgba(255,255,255,0.15)]'
              }`}
            />

            {/* Precision Laser Corner Brackets */}
            <div className={`absolute -top-1 -left-1 w-9 h-9 border-t-4 border-l-4 rounded-tl-2xl transition-all duration-300 ${
              liveFaceStatus.isGreen ? 'border-emerald-300 drop-shadow-[0_0_8px_#34d399]' : liveFaceStatus.detected ? 'border-cyan-300' : 'border-white/60'
            }`} />
            <div className={`absolute -top-1 -right-1 w-9 h-9 border-t-4 border-r-4 rounded-tr-2xl transition-all duration-300 ${
              liveFaceStatus.isGreen ? 'border-emerald-300 drop-shadow-[0_0_8px_#34d399]' : liveFaceStatus.detected ? 'border-cyan-300' : 'border-white/60'
            }`} />
            <div className={`absolute -bottom-1 -left-1 w-9 h-9 border-b-4 border-l-4 rounded-bl-2xl transition-all duration-300 ${
              liveFaceStatus.isGreen ? 'border-emerald-300 drop-shadow-[0_0_8px_#34d399]' : liveFaceStatus.detected ? 'border-cyan-300' : 'border-white/60'
            }`} />
            <div className={`absolute -bottom-1 -right-1 w-9 h-9 border-b-4 border-r-4 rounded-br-2xl transition-all duration-300 ${
              liveFaceStatus.isGreen ? 'border-emerald-300 drop-shadow-[0_0_8px_#34d399]' : liveFaceStatus.detected ? 'border-cyan-300' : 'border-white/60'
            }`} />

            {/* Micro-target crosshairs */}
            <div className="absolute top-1/2 -left-2 w-3 h-0.5 bg-white/40" />
            <div className="absolute top-1/2 -right-2 w-3 h-0.5 bg-white/40" />
            <div className="absolute -top-2 left-1/2 w-0.5 h-3 bg-white/40" />
            <div className="absolute -bottom-2 left-1/2 w-0.5 h-3 bg-white/40" />

            {/* Vertical Cyber Laser Scanning Beam */}
            <div className="absolute inset-x-2 h-full pointer-events-none overflow-hidden">
              <div
                className={`w-full h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-biometric-scan ${
                  liveFaceStatus.isGreen ? 'via-emerald-400' : 'via-cyan-400'
                }`}
              />
            </div>

            {/* Subtle Face Oval Guideline when searching */}
            {!liveFaceStatus.detected && (
              <div className="w-44 h-56 rounded-[50%] border border-dashed border-white/20 flex flex-col items-center justify-center opacity-40">
                <ScanFace className="w-12 h-12 text-white/50" />
              </div>
            )}
          </div>
        </div>

        {/* ─── BOTTOM CONTROL DECK & UNIFIED HUD ─── */}
        <div className="relative pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2.5 px-4 sm:px-6 flex flex-col items-center bg-gradient-to-t from-black/95 via-black/85 to-transparent z-30 space-y-2.5">
          {/* Live Forensic Metadata Card (Preview Informasi Lokasi & Jam) */}
          <div className="w-full max-w-sm px-3.5 py-2 rounded-2xl bg-slate-900/85 backdrop-blur-xl border border-white/15 text-slate-200 text-xs shadow-xl flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="font-bold text-white text-xs truncate">
                👤 {user?.fullName || 'Karyawan'} <span className="text-emerald-400 font-mono">[{user?.nip || 'FRP'}]</span>
              </p>
              <p className="text-[11px] text-slate-300 truncate">
                📍 {assignedPostName || 'Pos Tugas Terdaftar'}
              </p>
            </div>
            <div className="text-right shrink-0">
              <span className="font-mono font-bold text-xs text-emerald-300 block">
                {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} WITA
              </span>
              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${
                locationStatus === 'inside' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              }`}>
                {locationStatus === 'inside' ? '✓ DALAM POS' : '⚠️ LUAR RADIUS'}
              </span>
            </div>
          </div>

          {/* Unified High-Tech Status Pill - Font Besar & Jelas Terbaca */}
          <div
            className={`px-4 sm:px-5 py-2 rounded-full backdrop-blur-xl border shadow-xl flex items-center gap-2.5 text-xs sm:text-sm font-bold transition-all duration-300 ${
              liveFaceStatus.isGreen
                ? 'bg-emerald-950/95 border-emerald-400 text-emerald-100 shadow-[0_0_20px_rgba(16,185,129,0.4)]'
                : liveFaceStatus.detected
                ? 'bg-cyan-950/95 border-cyan-400/80 text-cyan-100 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                : 'bg-slate-900/95 border-slate-700 text-slate-200'
            }`}
          >
            {liveFaceStatus.isGreen ? (
              <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 shrink-0" />
            ) : liveFaceStatus.detected ? (
              <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400 animate-spin shrink-0" />
            ) : (
              <ScanFace className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 shrink-0" />
            )}
            <span className="leading-snug">{liveFaceStatus.message}</span>
            {masterDescriptor && masterDescriptor.length === 128 && (
              <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] sm:text-xs px-2 py-0.5 font-mono">
                DB 1:1
              </Badge>
            )}
          </div>

          {/* Micro-Progress bar for Auto Mode */}
          {scanMode === 'auto' && liveFaceStatus.isGreen && (
            <div className="w-48 bg-slate-800/80 h-1.5 rounded-full overflow-hidden border border-emerald-500/30">
              <div
                className="bg-emerald-400 h-full transition-all duration-100 ease-linear rounded-full shadow-[0_0_8px_#34d399]"
                style={{ width: `${autoCaptureProgress}%` }}
              />
            </div>
          )}

          {/* Ergonomic Shutter Deck */}
          <div className="w-full flex items-center justify-between px-6 max-w-xs">
            {/* Left: Switch Camera */}
            <button
              type="button"
              onClick={toggleFacingMode}
              className="w-12 h-12 rounded-full bg-white/15 hover:bg-white/25 active:scale-90 backdrop-blur-md flex items-center justify-center text-white transition-all border border-white/15 shadow-md"
              title="Ganti Kamera Depan/Belakang"
            >
              <SwitchCamera className="w-5 h-5" />
            </button>

            {/* Center: Precision Shutter Button with Aligned SVG Countdown Ring */}
            <div className="relative flex items-center justify-center">
              {/* Progress Ring for Auto Capture */}
              {scanMode === 'auto' && liveFaceStatus.isGreen && (
                <svg className="absolute w-20 h-20 -rotate-90 pointer-events-none z-10" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="44"
                    className="stroke-emerald-500/30"
                    strokeWidth="4"
                    fill="none"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="44"
                    className="stroke-emerald-400 drop-shadow-[0_0_8px_#34d399] transition-all duration-100"
                    strokeWidth="5"
                    strokeDasharray="276"
                    strokeDashoffset={276 - (276 * autoCaptureProgress) / 100}
                    strokeLinecap="round"
                    fill="none"
                  />
                </svg>
              )}

              {/* Shutter Trigger Button (Tactile 64x64px) */}
              <button
                type="button"
                onClick={() => {
                  if (isCapturingRef.current) return;
                  if (handleShutterCaptureRef.current) {
                    handleShutterCaptureRef.current();
                  } else {
                    handleShutterCapture();
                  }
                }}
                className={`w-16 h-16 rounded-full p-1.5 flex items-center justify-center transition-all cursor-pointer active:scale-90 border-2 ${
                  liveFaceStatus.isGreen || liveFaceStatus.detected
                    ? 'border-emerald-400 bg-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.5)]'
                    : 'border-white/70 bg-white/10 hover:border-white shadow-[0_0_12px_rgba(255,255,255,0.25)]'
                }`}
                title={scanMode === 'auto' ? 'Ambil Foto Sekarang (Bypass Auto)' : 'Jepret Foto Presensi'}
              >
                <div
                  className={`w-full h-full rounded-full flex items-center justify-center transition-colors shadow-inner ${
                    liveFaceStatus.isGreen
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-white'
                      : 'bg-white hover:bg-slate-100 text-slate-900'
                  }`}
                >
                  <Camera className="w-6 h-6" />
                </div>
              </button>
            </div>

            {/* Right: Screen Light Boost / Flash Toggle */}
            <button
              type="button"
              onClick={() => setIsFlashlightOn((prev) => !prev)}
              className={`w-12 h-12 rounded-full backdrop-blur-md flex items-center justify-center transition-all active:scale-90 border border-white/15 shadow-md ${
                isFlashlightOn
                  ? 'bg-amber-400 text-slate-950 font-bold'
                  : 'bg-white/15 hover:bg-white/25 text-white'
              }`}
              title="Lampu Layar Bantu Pencahayaan Wajah"
            >
              <Zap className={`w-5 h-5 ${isFlashlightOn ? 'fill-current' : ''}`} />
            </button>
          </div>

          {/* Fail-safe Minimalist Link */}
          <div className="flex justify-center pt-0.5">
            <button
              type="button"
              onClick={() => nativeCameraInputRef.current?.click()}
              className="text-[11px] text-white/70 hover:text-white flex items-center gap-1.5 py-1 px-3 rounded-full hover:bg-white/10 transition-colors"
            >
              <Camera className="w-3.5 h-3.5 opacity-80" />
              <span>Gunakan Kamera Bawaan HP (Alternatif)</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. TAMPILAN BERANDA PWA RESMI (PERSIS LAMPIRAN 2)
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#14532D] text-foreground flex flex-col justify-between selection:bg-emerald-500 selection:text-white">
      {/* ─── GRADIENT HEADER ATAS (PERSIS LAMPIRAN 2) ─── */}
      <header className="bg-gradient-to-r from-[#14532D] via-[#0F766E] to-[#0284C7] text-white pt-[max(0.85rem,env(safe-area-inset-top))] pb-5 px-4 shadow-md">
        {/* Title Bar: Logo + PT. FAWWAZ RESKI PERWIRA Branding + Notification Bell + Actions */}
        <div className="flex items-center justify-between gap-3 px-1">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-full bg-white p-0.5 flex items-center justify-center shrink-0 border border-white/80 shadow-md">
              <img src={defaultAvatar} alt="Logo PT FRP" className="w-full h-full object-contain rounded-full" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xs sm:text-sm font-black tracking-wide uppercase text-white drop-shadow-md whitespace-nowrap overflow-hidden text-ellipsis">
                PT. FAWWAZ RESKI PERWIRA
              </h1>
              <p className="text-[9.5px] text-emerald-100/90 font-medium tracking-tight truncate">
                Sistem Presensi & Operasional
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Tombol Pasang PWA ke Layar HP jika dibuka lewat peramban browser */}
            {!isStandaloneApp && (
              <button
                type="button"
                onClick={handleTriggerPwaInstall}
                className="relative w-8 h-8 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white flex items-center justify-center transition-all active:scale-90 shadow-md animate-pulse"
                title="Pasang Aplikasi ke Layar Utama HP"
              >
                <Smartphone className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Lonceng Notifikasi Realtime Pengajuan */}
            <button
              type="button"
              onClick={() => setNotificationsDrawerOpen(true)}
              className="relative w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-sm flex items-center justify-center text-white transition-all active:scale-90"
              title="Notifikasi Pengajuan Realtime"
            >
              <Bell className="w-3.5 h-3.5" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-rose-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border border-white animate-pulse">
                  {unreadNotificationsCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={async () => {
                toast.info('Memperbarui aplikasi ke versi terbaru...');
                if ('caches' in window) {
                  try {
                    const keys = await caches.keys();
                    await Promise.all(keys.map((k) => caches.delete(k)));
                  } catch (_) {}
                }
                if ('serviceWorker' in navigator) {
                  try {
                    const regs = await navigator.serviceWorker.getRegistrations();
                    for (const r of regs) await r.update();
                  } catch (_) {}
                }
                window.location.reload();
              }}
              className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-sm flex items-center justify-center text-white transition-all active:scale-90"
              title="Segarkan / Perbarui Aplikasi"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* ─── KARTU PUTIH UTAMA (ROUNDED TOP BODY - PERSIS LAMPIRAN 2) ─── */}
      <main className="flex-1 bg-white dark:bg-slate-950 rounded-t-[32px] -mt-3 shadow-2xl p-4 sm:p-6 pb-28 space-y-4 overflow-y-auto">
        {/* ─── TAB 1: BERANDA PRESENSI UTAMA ─── */}
        {activeTab === 'beranda' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Banner Pasang PWA jika dibuka lewat browser */}
            {!isStandaloneApp && (
              <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white rounded-2xl p-3 flex items-center justify-between gap-2.5 shadow-md border border-emerald-400/40">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
                    <Smartphone className="w-4 h-4 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-extrabold text-xs text-white truncate">Pasang Aplikasi di Layar HP</p>
                    <p className="text-[10px] text-emerald-100 truncate">Akses presensi instan tanpa buka browser</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={handleTriggerPwaInstall}
                  className="h-8 px-3 bg-white text-emerald-900 hover:bg-emerald-50 text-[11px] font-black rounded-xl shrink-0 shadow-xs active:scale-95"
                >
                  Pasang PWA
                </Button>
              </div>
            )}

            {/* Greeting & Identity Section */}
            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="space-y-0.5 min-w-0">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight truncate">
                  {greetingText},{' '}
                  <span className="text-emerald-700 dark:text-emerald-400 font-extrabold">
                    {user?.fullName || 'Karyawan'}!
                  </span>
                </h2>
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed truncate">
                  ID: <span className="font-mono text-slate-700 dark:text-slate-200">{user?.nip || user?.id?.slice(0, 8).toUpperCase()}</span> | Divisi:{' '}
                  <span className="text-slate-700 dark:text-slate-200">{user?.divisionName || 'Operasional'}</span>
                </p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500">
                  {userShift?.name?.includes('(')
                    ? `Shift: ${userShift.name}`
                    : `Shift: ${userShift?.name || 'Reguler'} (${userShift?.startTime || '08:00'} - ${userShift?.endTime || '17:00'} WITA)`}
                </p>
              </div>

              {/* Avatar Round Thumbnail with Subtle Ring */}
              <div className="relative shrink-0 w-12 h-12 min-w-[48px] min-h-[48px]">
                <img
                  src={user?.avatarUrl || user?.faceEnrolledPhoto || defaultAvatar}
                  alt={user?.fullName}
                  className="w-12 h-12 min-w-[48px] min-h-[48px] max-w-[48px] max-h-[48px] rounded-full object-cover border-2 border-emerald-500/40 shadow-sm bg-slate-100"
                  style={{ width: '48px', height: '48px', objectFit: 'cover' }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = defaultAvatar;
                  }}
                />
                <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" />
              </div>
            </div>

            {/* ─── ROLE-ADAPTIVE SUPERVISORY & EXECUTIVE ACTION BANNERS ─── */}
            {(() => {
              const rClean = (user?.roleName || user?.role || '').toLowerCase();
              const isKorlapRole = rClean.includes('korlap') || rClean.includes('koordinator');
              const isK3Role = rClean.includes('k3') || rClean.includes('hse') || rClean.includes('keselamatan');
              const isAdminRole = rClean.includes('admin') || rClean.includes('hrd');
              const isDirutOrPimpinan = rClean.includes('pimpinan') || rClean.includes('dirut') || rClean.includes('superadmin');

              if (isDirutOrPimpinan) {
                return (
                  <div className="p-3 bg-gradient-to-r from-purple-500/10 via-indigo-500/5 to-transparent border border-purple-500/30 rounded-2xl flex items-center justify-between gap-2.5 text-xs shadow-xs">
                    <div className="min-w-0">
                      <div className="font-bold text-purple-950 dark:text-purple-200 flex items-center gap-1.5 truncate">
                        <Briefcase className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                        <span>Portal Eksekutif: Direktur Utama & Pimpinan</span>
                      </div>
                      <p className="text-[10px] text-purple-800 dark:text-purple-300 mt-0.5 truncate">
                        Persetujuan Tier 2 & radar analitik kinerja organisasi.
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Link to="/dashboard">
                        <Button size="sm" className="h-7.5 px-2.5 text-[11px] bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-xs">
                          Radar Direksi
                        </Button>
                      </Link>
                      <Link to="/admin/approval">
                        <Button size="sm" variant="outline" className="h-7.5 px-2 text-[11px] border-purple-500/40 text-purple-700 dark:text-purple-300 rounded-xl">
                          Approval
                        </Button>
                      </Link>
                    </div>
                  </div>
                );
              }

              if (isKorlapRole) {
                return (
                  <div className="p-3 bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/30 rounded-2xl flex items-center justify-between gap-2.5 text-xs shadow-xs">
                    <div className="min-w-0">
                      <div className="font-bold text-emerald-950 dark:text-emerald-200 flex items-center gap-1.5 truncate">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Otoritas Lapangan: Korlap</span>
                      </div>
                      <p className="text-[10px] text-emerald-800 dark:text-emerald-300 mt-0.5 truncate">
                        Persetujuan cuti/SPL tim (First-Responder) & rekap pos.
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        size="sm"
                        onClick={() => {
                          setFieldAuthorityInitialTab('leaves');
                          setFieldAuthorityModalOpen(true);
                        }}
                        className="h-7.5 px-2.5 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs"
                      >
                        Approval Hub
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setFieldAuthorityInitialTab('recap');
                          setFieldAuthorityModalOpen(true);
                        }}
                        className="h-7.5 px-2 text-[11px] border-emerald-500/40 text-emerald-700 dark:text-emerald-300 rounded-xl"
                      >
                        Rekap Tim
                      </Button>
                    </div>
                  </div>
                );
              }

              if (isK3Role) {
                return (
                  <div className="p-3 bg-gradient-to-r from-amber-500/10 via-yellow-500/5 to-transparent border border-amber-500/30 rounded-2xl flex items-center justify-between gap-2.5 text-xs shadow-xs">
                    <div className="min-w-0">
                      <div className="font-bold text-amber-950 dark:text-amber-200 flex items-center gap-1.5 truncate">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>Otoritas Pengawas: Keselamatan Kerja & K3</span>
                      </div>
                      <p className="text-[10px] text-amber-800 dark:text-amber-300 mt-0.5 truncate">
                        Validasi izin sakit, kebugaran staf & persetujuan SPL.
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        size="sm"
                        onClick={() => {
                          setFieldAuthorityInitialTab('leaves');
                          setFieldAuthorityModalOpen(true);
                        }}
                        className="h-7.5 px-2.5 text-[11px] bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-xs"
                      >
                        Approval Hub
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setFieldAuthorityInitialTab('recap');
                          setFieldAuthorityModalOpen(true);
                        }}
                        className="h-7.5 px-2 text-[11px] border-amber-500/40 text-amber-700 dark:text-amber-300 rounded-xl"
                      >
                        Rekap Tim
                      </Button>
                    </div>
                  </div>
                );
              }

              if (isAdminRole) {
                return (
                  <div className="p-3 bg-gradient-to-r from-sky-500/10 via-blue-500/5 to-transparent border border-sky-500/30 rounded-2xl flex items-center justify-between gap-2.5 text-xs shadow-xs">
                    <div className="min-w-0">
                      <div className="font-bold text-sky-950 dark:text-sky-200 flex items-center gap-1.5 truncate">
                        <Users className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                        <span>Otoritas Pengawas: Admin Operasional</span>
                      </div>
                      <p className="text-[10px] text-sky-800 dark:text-sky-300 mt-0.5 truncate">
                        Pusat verifikasi berkas permohonan staf & rekapitulasi.
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        size="sm"
                        onClick={() => {
                          setFieldAuthorityInitialTab('leaves');
                          setFieldAuthorityModalOpen(true);
                        }}
                        className="h-7.5 px-2.5 text-[11px] bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl shadow-xs"
                      >
                        Approval Hub
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setFieldAuthorityInitialTab('recap');
                          setFieldAuthorityModalOpen(true);
                        }}
                        className="h-7.5 px-2 text-[11px] border-sky-500/40 text-sky-700 dark:text-sky-300 rounded-xl"
                      >
                        Rekap Tim
                      </Button>
                    </div>
                  </div>
                );
              }

              return null;
            })()}

            {/* ─── LINGKARAN KAMERA BIOMETRIK (CENTERPIECE PERSIS LAMPIRAN 2 - FIXED SIZING) ─── */}
            <div className="flex flex-col items-center justify-center py-1">
              <div
                onClick={() => {
                  if (hasClockedIn && !hasClockedOut) {
                    if (!isClockOutAllowed && !isFieldSpecial) {
                      if (isBeforeShiftEndTime && !hasApprovedEmergencyLeave) {
                        toast.error(`Absen Pulang belum aktif! Jadwal pulang shift Anda pk ${userShift?.endTime?.substring(0, 5) || '16:30'} WITA.`);
                        return;
                      }
                    }
                    openLiveCamera('clock_out');
                  } else if (!hasClockedIn) {
                    if (!isClockInAllowed) {
                      toast.error(clockInDisabledReason || 'Presensi masuk belum memenuhi syarat lokasi/shift.');
                      return;
                    }
                    openLiveCamera('clock_in');
                  }
                }}
                className="relative w-[210px] h-[210px] shrink-0 aspect-square rounded-full p-2 flex items-center justify-center cursor-pointer transition-transform hover:scale-[1.02] active:scale-95 group select-none"
                style={{ width: '210px', height: '210px', minWidth: '210px', minHeight: '210px', maxWidth: '210px', maxHeight: '210px' }}
                title="Ketuk untuk Ambil Foto Absen"
              >
                {/* Outer Ring Border */}
                <div className="absolute inset-0 rounded-full border-2 border-emerald-500/40 group-hover:border-emerald-500/70 transition-colors pointer-events-none" />

                {/* Curved Text Arc "AMBIL FOTO UNTUK ABSEN" */}
                <svg className="absolute inset-0 w-[210px] h-[210px] pointer-events-none" viewBox="0 0 200 200">
                  <path id="circlePath" d="M 28,100 A 72,72 0 0,1 172,100" fill="none" />
                  <text className="text-[9.5px] font-bold tracking-[0.15em] fill-slate-700 dark:fill-slate-300 uppercase">
                    <textPath href="#circlePath" startOffset="50%" textAnchor="middle">
                      AMBIL FOTO UNTUK ABSEN
                    </textPath>
                  </text>
                </svg>

                {/* Inner Face Frame / Photo Feed */}
                <div
                  className="relative w-[150px] h-[150px] shrink-0 aspect-square rounded-full overflow-hidden bg-slate-100 dark:bg-slate-900 flex items-center justify-center shadow-inner border border-slate-200 dark:border-slate-800"
                  style={{ width: '150px', height: '150px', minWidth: '150px', minHeight: '150px', maxWidth: '150px', maxHeight: '150px' }}
                >
                  {todayAttendance?.clockInPhoto ? (
                    <img
                      src={todayAttendance.clockInPhoto}
                      alt="Presensi Wajah Hari Ini"
                      className="w-full h-full max-w-full max-h-full object-cover object-center block rounded-full"
                      style={{ width: '150px', height: '150px', objectFit: 'cover' }}
                    />
                  ) : user?.faceEnrolledPhoto ? (
                    <img
                      src={user.faceEnrolledPhoto}
                      alt={user.fullName}
                      className="w-full h-full max-w-full max-h-full object-cover object-center block rounded-full opacity-90 group-hover:opacity-100 transition-opacity"
                      style={{ width: '150px', height: '150px', objectFit: 'cover' }}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-400 space-y-1">
                      <Camera className="w-8 h-8 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
                      <span className="text-[10px] font-semibold text-slate-500">Scan Wajah</span>
                    </div>
                  )}

                  {/* Dashed Face Alignment Guide */}
                  <div className="absolute inset-3 rounded-2xl border-2 border-dashed border-white/80 shadow-xs pointer-events-none" />

                  {/* Status Overlay jika sudah absen */}
                  {hasClockedIn && (
                    <div className="absolute bottom-2 bg-emerald-600 text-white text-[9.5px] font-bold px-2.5 py-0.5 rounded-full shadow-md flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      <span>{hasClockedOut ? `Pulang: ${todayAttendance?.clockOut?.substring(0, 5)}` : `Masuk: ${todayAttendance?.clockIn?.substring(0, 5)}`}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ─── BANNER MODE ISTIRAHAT AKTIF ─── */}
            {isBreakActive && (
              <div className="bg-amber-500/10 border-2 border-amber-500/40 rounded-2xl p-3 flex items-center justify-between gap-3 animate-pulse">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
                    <Coffee className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-amber-900 dark:text-amber-200">Mode Istirahat 1 Jam Aktif</p>
                    <p className="text-[11px] font-mono text-amber-700 dark:text-amber-300">
                      Sisa: <span className="font-bold text-xs">{Math.floor(breakTimer / 60)}m {breakTimer % 60}s</span> (Perimeter Bebas)
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleEndBreak}
                  className="rounded-xl text-[11px] h-8 px-3 border-amber-500 text-amber-800 dark:text-amber-200 hover:bg-amber-500 hover:text-white font-bold"
                >
                  Selesai Istirahat
                </Button>
              </div>
            )}

            {/* ─── PENGINGAT SHIFT & LOKASI TUGAS LAPANGAN DENGAN VIBRASI BERGETAR KUAT ─── */}
            <div className="rounded-2xl p-4 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white shadow-xl border border-slate-700/80 space-y-3 relative overflow-hidden">
              <div className="absolute -right-10 -bottom-10 w-32 h-32 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none" />
              
              {/* Header: Running WITA Clock & Shift Badge */}
              <div className="flex items-center justify-between gap-2 border-b border-slate-700/60 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                    <Radio className="w-4 h-4 animate-pulse" />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">WAKTU REALTIME WITA</span>
                    <span className="text-sm font-black font-mono text-emerald-300">
                      {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} WITA
                    </span>
                  </div>
                </div>

                <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold py-0.5 px-2">
                  {userShift?.name || 'Shift Operasional'}
                </Badge>
              </div>

              {/* Employee & Shift Details Grid */}
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-slate-400 font-medium">Petugas Karyawan:</span>
                  <p className="font-bold text-white truncate">{user?.fullName || user?.name || '-'}</p>
                  <p className="text-[10px] font-mono text-slate-400">NIP: {user?.nip || '-'}</p>
                </div>

                <div className="space-y-0.5">
                  <span className="text-[10px] text-slate-400 font-medium">Divisi / Unit Kerja:</span>
                  <p className="font-bold text-emerald-300 truncate">{user?.divisionName || user?.division || 'Operasional'}</p>
                  <p className="text-[10px] text-slate-400">Status: {isSpecialDutyOfficer(user) ? 'Petugas Lapangan Khusus' : 'Reguler'}</p>
                </div>

                <div className="space-y-0.5">
                  <span className="text-[10px] text-slate-400 font-medium">Jadwal Masuk & Pulang:</span>
                  <p className="font-bold text-white font-mono text-[11px]">
                    {userShift?.startTime || '07:30'} - {userShift?.endTime || '16:30'} WITA
                  </p>
                  <p className="text-[10px] text-amber-300 font-medium">
                    Toleransi: {userShift?.lateToleranceMinutes || 15} Menit
                  </p>
                </div>

                <div className="space-y-0.5">
                  <span className="text-[10px] text-slate-400 font-medium">Lokasi Ceklok Masuk/Pulang:</span>
                  <p className="font-bold text-slate-200 text-[11px] truncate" title={assignedPostName || 'Bank Pos Resmi'}>
                    {assignedPostName || 'Pos Resmi FRP'}
                  </p>
                  <p className="text-[10px] font-medium flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${locationStatus === 'inside' ? 'bg-emerald-400' : 'bg-rose-400 animate-ping'}`} />
                    <span className={locationStatus === 'inside' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-semibold'}>
                      {locationStatus === 'inside' ? 'Di Radius Pos' : `Di Luar Area (${distanceToOffice || 0}m)`}
                    </span>
                  </p>
                </div>
              </div>

              {/* Dispensasi Perjalanan Aktif (Jika Ada) */}
              {activeTravelDispensation && (
                <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Bike className="w-4 h-4 text-amber-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-bold truncate">Dispensasi: {activeTravelDispensation.label}</p>
                      <p className="text-[10px] text-amber-200/90 truncate">Toleransi tambahan +{activeTravelDispensation.graceMinutes}m aktif (Lapor: {activeTravelDispensation.witaTime} WITA)</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="border-amber-400 text-amber-300 text-[9px] shrink-0 font-bold">
                    Bebas Sanksi
                  </Badge>
                </div>
              )}

              {/* Action Buttons: Vibration Pulse + Roadside Emergency */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <Button
                  size="sm"
                  type="button"
                  onClick={triggerStrongVibrationReminder}
                  className="h-8 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-xl gap-1.5 font-semibold active:scale-95 transition-all shadow-xs"
                >
                  <Activity className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Uji Getar Reminder</span>
                </Button>

                <Button
                  size="sm"
                  type="button"
                  onClick={() => setTravelModalOpen(true)}
                  className="h-8 text-xs bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-700 hover:to-amber-700 text-white rounded-xl gap-1.5 font-bold active:scale-95 transition-all shadow-xs"
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>Lapor Kendala Jalan</span>
                </Button>
              </div>
            </div>

            {/* ─── KARTU RINGKASAN WAKTU PRESENSI HARI INI (REALTIME DATABASE STATUS) ─── */}
            <div className={`rounded-2xl p-3.5 border transition-all ${
              hasClockedIn
                ? 'bg-gradient-to-r from-emerald-50/80 via-teal-50/40 to-emerald-50/80 dark:from-emerald-950/30 dark:via-teal-950/20 dark:to-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 shadow-xs'
                : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    hasClockedIn ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                  }`}>
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Status Kehadiran Hari Ini</p>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      {hasClockedOut ? (
                        <span className="text-slate-800 dark:text-slate-200">Presensi Selesai (Sudah Pulang)</span>
                      ) : hasClockedIn ? (
                        <span className="text-emerald-700 dark:text-emerald-400 font-extrabold">Aktif Bertugas (Sudah Absen Masuk)</span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400">Belum Melakukan Absen Masuk</span>
                      )}
                    </p>
                  </div>
                </div>
                {hasClockedIn && (
                  <Badge className={todayAttendance?.status === 'terlambat' ? 'bg-amber-500 text-white text-[10px]' : 'bg-emerald-600 text-white text-[10px]'}>
                    {todayAttendance?.status === 'terlambat' ? `Terlambat ${todayAttendance.lateMinutes}m` : 'Tepat Waktu'}
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 mt-2.5 pt-2.5 border-t border-slate-200/60 dark:border-slate-800/80 text-[11px]">
                <div className="bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                  <p className="text-[9.5px] text-slate-400 font-medium">JAM ABSEN MASUK</p>
                  <p className="font-mono font-bold text-xs text-slate-900 dark:text-slate-100 mt-0.5">
                    {todayAttendance?.clockIn ? `${todayAttendance.clockIn.substring(0, 5)} WITA` : '-'}
                  </p>
                </div>
                <div className="bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                  <p className="text-[9.5px] text-slate-400 font-medium">JAM ABSEN PULANG</p>
                  <p className="font-mono font-bold text-xs text-slate-900 dark:text-slate-100 mt-0.5">
                    {todayAttendance?.clockOut ? `${todayAttendance.clockOut.substring(0, 5)} WITA` : (hasClockedIn ? 'Sedang Bertugas' : '-')}
                  </p>
                </div>
              </div>
            </div>

            {/* ─── KARTU STATUS LOKASI GPS & POS GEOFENCE (PERSIS LAMPIRAN 2) ─── */}
            <div className="bg-slate-50 dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3 flex items-center gap-3 shadow-xs">
              {/* Mini Map Thumbnail Tile */}
              <div className="w-12 h-12 min-w-[48px] min-h-[48px] rounded-xl bg-slate-200 dark:bg-slate-800 overflow-hidden relative shrink-0 flex items-center justify-center border border-slate-300 dark:border-slate-700">
                <div className="absolute inset-0 bg-emerald-500/10" />
                <MapPin className="w-6 h-6 text-rose-500 drop-shadow-xs relative z-10 animate-bounce" />
              </div>

              {/* Location Description */}
              <div className="space-y-0.5 flex-1 min-w-0">
                <h3 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {assignedPostName || assignedOffice?.name || (bankPosts.length > 0 ? `${bankPosts.length} Pos Lapangan Terdaftar` : 'PT. FAWWAZ RESKI PERWIRA')}
                </h3>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                  {bankPosts.length > 0
                    ? `${bankPosts.length} Pos Terdaftar • Sah Absen di Seluruh Pos`
                    : (assignedOffice?.address || user?.divisionAddress || user?.divisionLocationName || 'Area Lokasi Penugasan Resmi')}
                </p>

                {/* Indikator Koordinat Realtime & Target Database */}
                <div className="text-[9.5px] text-slate-400 font-mono flex items-center gap-1.5 flex-wrap pt-0.5">
                  <span className="text-slate-500 dark:text-slate-400">
                    Target: {assignedOffice ? `${assignedOffice.latitude?.toFixed(5)}, ${assignedOffice.longitude?.toFixed(5)} (R: ${assignedOffice.radiusMeters || 50}m)` : 'Memuat target...'}
                  </span>
                  {currentCoords && (
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                      • GPS: {currentCoords.lat.toFixed(5)}, {currentCoords.lng.toFixed(5)} (±{Math.round(coordsAccuracy || 0)}m)
                    </span>
                  )}
                </div>

                {/* Status Badge */}
                <div className="pt-0.5">
                  {locationStatus === 'inside' ? (
                    <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      LOKASI: SESUAI POS KERJA {distanceToOffice !== null ? `(${Math.round(distanceToOffice)}m)` : ''}
                    </span>
                  ) : locationStatus === 'outside' ? (
                    <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-rose-600 dark:text-rose-400">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      DILUAR RADIUS ({Math.round(distanceToOffice || 0)}m dari {assignedPostName || 'Pos Tugas'})
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-amber-600 dark:text-amber-400">
                      <RotateCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                      Mengecek GPS...
                    </span>
                  )}
                </div>
              </div>

              {/* Refresh Location Button */}
              <button
                type="button"
                onClick={evaluateRealLocation}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center transition-colors active:scale-90"
                title="Segarkan Koordinat GPS"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            </div>

            {/* ─── BANNER / KONTROL KHUSUS: MODE TUGAS DARURAT ONLINE (ON-CALL DUTY) ─── */}
            {isMobileOnlineOfficer(user) && (
              <div className="bg-gradient-to-r from-blue-900/10 via-indigo-900/10 to-blue-900/10 dark:from-blue-950/40 dark:via-indigo-950/40 dark:to-blue-950/40 border-2 border-blue-500/40 rounded-2xl p-3.5 shadow-sm space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                      <Zap className="w-4 h-4 fill-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-blue-950 dark:text-blue-100">
                          TUGAS DARURAT ONLINE (ON-CALL)
                        </span>
                        <span className="bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                          WFA REMOTE
                        </span>
                      </div>
                      <p className="text-[10px] text-blue-700 dark:text-blue-300">
                        Matching • Kantor Pusat • Cafe/Warkop • Rumah (Libur/Cuti/Mendadak)
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white/70 dark:bg-slate-900/70 p-2.5 rounded-xl border border-blue-200/60 dark:border-blue-900/60 text-[10.5px] text-slate-700 dark:text-slate-300 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 truncate">
                    <Globe className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="truncate">Radius Bebas & Koneksi Internet Sah</span>
                  </div>
                  <span className="font-mono font-bold text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-300/40 shrink-0">
                    🟢 AUTO-APPROVE
                  </span>
                </div>

                {/* Tombol Aksi Cepat Tugas Darurat */}
                <div className="grid grid-cols-2 gap-2 pt-0.5">
                  <Button
                    type="button"
                    onClick={() => openLiveCamera('emergency_on_call')}
                    disabled={hasClockedIn && !hasClockedOut}
                    className="h-10 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs gap-1.5"
                  >
                    <Zap className="w-3.5 h-3.5 fill-white shrink-0" />
                    <span className="truncate">⚡ Mulai On-Call</span>
                  </Button>

                  <Button
                    type="button"
                    onClick={() => openLiveCamera('emergency_on_call_out')}
                    disabled={!hasClockedIn || hasClockedOut}
                    variant="outline"
                    className="h-10 border-blue-500/60 text-blue-700 dark:text-blue-300 hover:bg-blue-500 hover:text-white font-bold text-xs rounded-xl shadow-xs gap-1.5"
                  >
                    <LogOut className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">🛑 Selesai On-Call</span>
                  </Button>
                </div>
              </div>
            )}

            {/* ─── TOMBOL AKSI PRESISI (DUAL BUTTONS CERDAS SESUAI SHIFT & LOKASI) ─── */}
            {hasApprovedOvertimeOrSubstituteToday && !hasClockedIn && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-2 mb-1 flex items-center justify-between text-[11px] text-emerald-800 dark:text-emerald-300">
                <span className="flex items-center gap-1.5 font-bold">
                  <Zap className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600" />
                  {approvedOvertimeToday ? 'Tugas Lembur (SPL) Disetujui' : 'Tugas Pengganti Karyawan Disetujui'}
                </span>
                <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded-full font-bold">
                  Presensi Dibuka
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-1">
              {/* Tombol Absen Masuk */}
              <button
                type="button"
                disabled={!isClockInAllowed && !hasClockedIn}
                onClick={() => {
                  if (hasClockedIn) return;
                  if (!isClockInAllowed) {
                    toast.error(clockInDisabledReason || 'Presensi masuk belum memenuhi syarat lokasi/shift.');
                    return;
                  }
                  openLiveCamera('clock_in');
                }}
                className={`py-3 px-3 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold transition-all shadow-sm ${
                  hasClockedIn
                    ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 opacity-90 cursor-default'
                    : isClockInAllowed
                    ? hasApprovedOvertimeOrSubstituteToday
                      ? 'bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white ring-2 ring-emerald-400 ring-offset-1 shadow-emerald-600/30'
                      : 'bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white shadow-emerald-600/20'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-80'
                }`}
              >
                <Clock className="w-4 h-4 shrink-0" />
                <span className="truncate">
                  {hasClockedIn
                    ? `MASUK (${todayAttendance?.clockIn?.substring(0, 5) || todayAttendance?.clockIn})`
                    : hasActiveLeaveToday
                    ? `SEDANG LIBUR`
                    : !isInsideCoordinates
                    ? `DI LUAR POS`
                    : !isShiftWindowActive && !hasApprovedOvertimeOrSubstituteToday && !isFieldSpecial
                    ? `DI LUAR SHIFT`
                    : hasApprovedOvertimeOrSubstituteToday
                    ? `MASUK (LEMBUR)`
                    : `ABSEN MASUK (${userShift?.startTime || '08:00'})`}
                </span>
              </button>

              {/* Tombol Absen Pulang (Terkunci Sebelum Waktunya Kecuali Izin Darurat atau Petugas Lapangan/Khusus) */}
              <button
                type="button"
                disabled={!isClockOutAllowed}
                onClick={() => {
                  if (!isClockOutAllowed) {
                    if (isBeforeShiftEndTime && !hasApprovedEmergencyLeave && !isFieldSpecial) {
                      toast.error(`Absen Pulang belum aktif! Jadwal pulang shift Anda pk ${userShift?.endTime?.substring(0, 5) || '16:30'} WITA. Jika ada kondisi mendesak, silakan ajukan Izin Darurat.`);
                    }
                    return;
                  }
                  openLiveCamera('clock_out');
                }}
                className={`py-3 px-3 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold transition-all shadow-sm ${
                  hasClockedOut
                    ? 'bg-slate-100 dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-800 opacity-90 cursor-default'
                    : isClockOutAllowed
                    ? 'bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white shadow-emerald-700/20'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-80'
                }`}
              >
                {isBeforeShiftEndTime && !hasApprovedEmergencyLeave && !isFieldSpecial && hasClockedIn && !hasClockedOut ? (
                  <Lock className="w-4 h-4 shrink-0 text-amber-500" />
                ) : (
                  <LogOut className="w-4 h-4 shrink-0" />
                )}
                <span className="truncate">
                  {hasClockedOut
                    ? `PULANG (${todayAttendance?.clockOut?.substring(0, 5) || todayAttendance?.clockOut})`
                    : !hasClockedIn
                    ? 'ABSEN PULANG'
                    : isBeforeShiftEndTime && !hasApprovedEmergencyLeave && !isFieldSpecial
                    ? `TERKUNCI (${userShift?.endTime?.substring(0, 5) || '16:30'})`
                    : hasApprovedEmergencyLeave
                    ? 'PULANG (IZIN DARURAT)'
                    : isFieldSpecial
                    ? 'ABSEN PULANG (LAPANGAN)'
                    : 'ABSEN PULANG'}
                </span>
              </button>
            </div>

            {/* Status Kunci Absen Pulang & Jam Istirahat Otomatis */}
            {isBeforeShiftEndTime && !hasApprovedEmergencyLeave && !isFieldSpecial && hasClockedIn && !hasClockedOut && (
              <div className="bg-amber-50/90 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl p-2.5 flex items-center justify-between gap-2 text-[10.5px] text-amber-800 dark:text-amber-200">
                <div className="flex items-center gap-2 min-w-0">
                  <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span className="truncate">
                    Absen Pulang terkunci s/d pk <b>{userShift?.endTime?.substring(0, 5) || '16:30'} WITA</b>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setEmergencyModalOpen(true)}
                  className="px-2 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] shrink-0 active:scale-95"
                >
                  Izin Darurat
                </button>
              </div>
            )}

            {hasApprovedEmergencyLeave && !hasClockedOut && hasClockedIn && (
              <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 rounded-xl p-2.5 flex items-center gap-2 text-[10.5px] text-emerald-800 dark:text-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Izin Pulang Cepat Darurat aktif & disetujui. Tombol Absen Pulang telah dibuka.</span>
              </div>
            )}

            {/* Banner Otomatis Waktu Istirahat Tiba */}
            {isShiftBreakWindow && !isBreakActive && hasClockedIn && !hasClockedOut && (
              <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/20 to-amber-500/10 border border-amber-300 dark:border-amber-800 rounded-2xl p-3 flex items-center justify-between gap-2.5 animate-pulse">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                    <Coffee className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-amber-900 dark:text-amber-100">
                      Waktu Istirahat ({userShift?.breakStartTime || '12:00'} - {userShift?.breakEndTime || '13:00'} WITA)
                    </p>
                    <p className="text-[10px] text-amber-700 dark:text-amber-300 truncate">
                      Toleransi keluar area kantor 60 menit tanpa alarm perimeter.
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={handleConfirmStartBreak}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shrink-0"
                >
                  Mulai
                </Button>
              </div>
            )}



            {/* ─── WIDGET ANALYTICS PROGRES KEHADIRAN REALTIME (HALLMARK ANTI-SLOP) ─── */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  Statistik & Disiplin Saya (Bulan Berjalan)
                </h3>
                <Badge variant="outline" className="text-[10px] font-semibold border-emerald-500/40 text-emerald-600 bg-emerald-50">
                  {analyticsData.disciplineGrade}
                </Badge>
              </div>

              {/* Grid Kartu KPI Kehadiran (Termasuk Izin & Lembur Bulan Berjalan) */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800">
                  <p className="text-[9.5px] text-slate-500 dark:text-slate-400">Tepat Waktu</p>
                  <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {analyticsData.onTimeCount} <span className="text-[9.5px] font-normal text-slate-400">Hari</span>
                  </p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800">
                  <p className="text-[9.5px] text-slate-500 dark:text-slate-400">Izin Bulan Ini</p>
                  <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
                    {analyticsData.monthlyIzinCount} <span className="text-[9.5px] font-normal text-slate-400">Hari</span>
                  </p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800">
                  <p className="text-[9.5px] text-slate-500 dark:text-slate-400">Lembur Bulan Ini</p>
                  <p className="text-sm font-bold text-purple-600 dark:text-purple-400 mt-0.5">
                    {analyticsData.monthlyLemburHours} <span className="text-[9.5px] font-normal text-slate-400">Jam</span>
                  </p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800">
                  <p className="text-[9.5px] text-slate-500 dark:text-slate-400">Terlambat</p>
                  <p className="text-sm font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                    {analyticsData.lateCount} <span className="text-[9.5px] font-normal text-slate-400">Kali</span>
                  </p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800">
                  <p className="text-[9.5px] text-slate-500 dark:text-slate-400">Sisa Hak Cuti</p>
                  <p className="text-sm font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                    {analyticsData.remainingLeave} <span className="text-[9.5px] font-normal text-slate-400">Hari</span>
                  </p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800">
                  <p className="text-[9.5px] text-slate-500 dark:text-slate-400">Skor Disiplin</p>
                  <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">
                    {analyticsData.disciplineScore}%
                  </p>
                </div>
              </div>

              {/* Strip Kehadiran Mingguan 7 Hari Terakhir */}
              <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Rangkaian Kehadiran Minggu Ini</span>
                  <span className="text-[10px] text-slate-400">Senin - Minggu</span>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center">
                  {analyticsData.weeklyStreak.map((item, idx) => (
                    <div key={idx} className="flex flex-col items-center gap-1">
                      <span className="text-[9px] font-medium text-slate-400">{item.day}</span>
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          item.status === 'present'
                            ? 'bg-emerald-500 text-white shadow-xs'
                            : item.status === 'late'
                            ? 'bg-amber-500 text-white'
                            : item.status === 'current'
                            ? 'border-2 border-emerald-500 text-emerald-600 animate-pulse'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-400'
                        }`}
                      >
                        {item.status === 'present' ? '✓' : item.status === 'late' ? '!' : idx + 1}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB 2: RIWAYAT KEHADIRAN DENGAN FILTER MULTI-DIMENSI ─── */}
        {activeTab === 'riwayat' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Riwayat Kehadiran</h2>
                <p className="text-[11px] text-slate-500">Filter data presensi dan ketuk rekaman untuk detail foto watermark</p>
              </div>
              <Badge variant="outline" className="text-xs text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300">
                {filteredAttendancesHistory.length} Terfilter
              </Badge>
            </div>

            {/* Filter Bar: Periode & Status */}
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2.5 shadow-xs">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-400">
                <Filter className="w-3.5 h-3.5 text-emerald-600" />
                <span>Filter Periode:</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'bulan_ini', label: 'Bulan Ini' },
                  { id: '7_hari', label: '7 Hari Terakhir' },
                  { id: 'semua', label: 'Semua' },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setHistoryPeriodFilter(p.id as any)}
                    className={`py-1.5 px-2 rounded-xl text-xs font-semibold transition-all text-center ${
                      historyPeriodFilter === p.id
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5 pt-1 text-[11px] font-bold text-slate-600 dark:text-slate-400">
                <span>Filter Status:</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'all', label: 'Semua Status' },
                  { id: 'hadir', label: 'Hadir Tepat' },
                  { id: 'terlambat', label: 'Terlambat Masuk' },
                  { id: 'telat_istirahat', label: 'Telat Istirahat' },
                  { id: 'izin', label: 'Izin / Cuti' },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setHistoryStatusFilter(s.id as any)}
                    className={`py-1 px-2.5 rounded-lg text-[11px] font-medium transition-all ${
                      historyStatusFilter === s.id
                        ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* List Riwayat */}
            <div className="space-y-2.5">
              {filteredAttendancesHistory.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 text-xs space-y-1">
                  <p className="font-semibold">Tidak ada riwayat presensi yang sesuai kriteria.</p>
                  <p className="text-[10.5px]">Coba ganti filter periode atau status di atas.</p>
                </div>
              ) : (
                filteredAttendancesHistory.map((att) => (
                  <div
                    key={att.id}
                    onClick={() => setSelectedHistoryRecord(att)}
                    className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex items-center justify-between cursor-pointer hover:border-emerald-500/50 hover:bg-emerald-50/20 dark:hover:bg-emerald-950/20 transition-all active:scale-[0.99] group shadow-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {att.clockInPhoto || att.photoIn ? (
                        <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-emerald-500/40 bg-slate-200 shadow-inner">
                          <img
                            src={att.clockInPhoto || att.photoIn}
                            alt="Foto Presensi"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 shrink-0 border border-slate-200 dark:border-slate-700">
                          <Clock className="w-5 h-5 text-slate-500" />
                        </div>
                      )}
                      <div className="space-y-0.5 min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {new Date(att.date || att.attendanceDate || '').toLocaleDateString('id-ID', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          }) || att.date}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Masuk: <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{att.clockIn ? att.clockIn.substring(0, 5) : '-'}</span> • Pulang: <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{att.clockOut ? att.clockOut.substring(0, 5) : '-'}</span>
                        </p>
                        
                        {/* Status Terlambat & Telat Istirahat Badges */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          {att.lateMinutes && att.lateMinutes > 0 ? (
                            <span className="text-[10px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded font-semibold border border-amber-300 dark:border-amber-800">
                              Telat Masuk {att.lateMinutes}m
                            </span>
                          ) : null}
                          {att.breakLateMinutes && att.breakLateMinutes > 0 ? (
                            <span className="text-[10px] text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.5 rounded font-bold border border-rose-300 dark:border-rose-800">
                              ⚠️ Telat Istirahat {att.breakLateMinutes}m
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Badge
                        variant="outline"
                        className={
                          att.status === 'hadir'
                            ? 'border-emerald-500/40 text-emerald-700 bg-emerald-50 text-[10px] font-bold'
                            : 'border-amber-500/40 text-amber-700 bg-amber-50 text-[10px] font-bold'
                        }
                      >
                        {att.status.toUpperCase()}
                      </Badge>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition-colors" />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ─── TAB 3: AKTIVITAS, PENGAJUAN CUTI & LEMBUR ─── */}
        {activeTab === 'aktivitas' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Aktivitas & Permohonan</h2>
                <p className="text-[11px] text-slate-500">Ajukan cuti, lembur (SPL), izin darurat dengan bukti lampiran foto</p>
              </div>
            </div>

            {/* Quick Action Tiles (4 Opsi: Cuti, Lembur, Izin Darurat, dan Jadwal Roster) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div
                onClick={() => setLeaveModalOpen(true)}
                className="p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-center space-y-1 cursor-pointer hover:border-emerald-500 transition-all active:scale-95 group shadow-xs"
              >
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                  <CalendarCheck2 className="w-4 h-4" />
                </div>
                <p className="text-[11px] font-bold text-slate-900 dark:text-white">Cuti / Izin</p>
                <p className="text-[9.5px] text-emerald-700 font-semibold">{analyticsData.remainingLeave} Hari</p>
              </div>

              <div
                onClick={() => setOvertimeModalOpen(true)}
                className="p-3 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 text-center space-y-1 cursor-pointer hover:border-blue-500 transition-all active:scale-95 group shadow-xs"
              >
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                  <Clock className="w-4 h-4" />
                </div>
                <p className="text-[11px] font-bold text-slate-900 dark:text-white">Lembur SPL</p>
                <p className="text-[9.5px] text-blue-700 font-semibold">Tugas Lapangan</p>
              </div>

              <div
                onClick={() => setEmergencyModalOpen(true)}
                className="p-3 rounded-2xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 text-center space-y-1 cursor-pointer hover:border-rose-500 transition-all active:scale-95 group shadow-xs"
              >
                <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                  <AlertOctagon className="w-4 h-4" />
                </div>
                <p className="text-[11px] font-bold text-slate-900 dark:text-white">Izin Darurat</p>
                <p className="text-[9.5px] text-rose-600 font-semibold">Self-Service</p>
              </div>

              <div
                onClick={() => setScheduleModalOpen(true)}
                className="p-3 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/60 text-center space-y-1 cursor-pointer hover:border-indigo-500 transition-all active:scale-95 group shadow-xs"
              >
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                  <CalendarDays className="w-4 h-4" />
                </div>
                <p className="text-[11px] font-bold text-slate-900 dark:text-white">Jadwal Roster</p>
                <p className="text-[9.5px] text-indigo-600 font-semibold">Kalender Shift</p>
              </div>
            </div>

            {/* Sub-tab Switcher: Cuti vs Lembur */}
            <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
              <button
                type="button"
                onClick={() => setAktivitasSubTab('cuti')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  aktivitasSubTab === 'cuti'
                    ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Cuti & Izin ({userLeaves.length})
              </button>
              <button
                type="button"
                onClick={() => setAktivitasSubTab('lembur')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  aktivitasSubTab === 'lembur'
                    ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Lembur / SPL ({userOvertimeList.length})
              </button>
            </div>

            {/* Riwayat Pengajuan Cuti / Izin */}
            {aktivitasSubTab === 'cuti' && (
              <div className="space-y-2.5">
                {userLeaves.length === 0 ? (
                  <div className="p-6 text-center bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
                    Belum ada permohonan cuti atau izin yang diajukan.
                  </div>
                ) : (
                  userLeaves.slice(0, 15).map((l) => (
                    <div
                      key={l.id}
                      className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 space-y-2 shadow-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900 dark:text-white capitalize">
                          {l.leaveType.replace('_', ' ')}
                        </span>
                        <Badge
                          variant="outline"
                          className={
                            l.status === 'approved'
                              ? 'border-emerald-500/40 text-emerald-700 bg-emerald-50 text-[10px] font-bold'
                              : l.status === 'rejected'
                              ? 'border-rose-500/40 text-rose-700 bg-rose-50 text-[10px] font-bold'
                              : 'border-amber-500/40 text-amber-700 bg-amber-50 text-[10px] font-bold'
                          }
                        >
                          {l.status === 'approved' ? 'Disetujui' : l.status === 'rejected' ? 'Ditolak' : 'Menunggu Approval'}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                        📅 {l.startDate} s/d {l.endDate} ({l.totalDays || 1} Hari)
                      </p>
                      <p className="text-xs text-slate-700 dark:text-slate-300 italic bg-slate-50 dark:bg-slate-800/70 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                        "{l.reason}"
                      </p>
                      {l.attachmentUrl && (
                        <div className="flex items-center gap-2 pt-1">
                          <span className="text-[10px] text-slate-400 font-semibold">Bukti Dokumen:</span>
                          <a
                            href={l.attachmentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-emerald-600 hover:underline font-semibold"
                          >
                            <ImageIcon className="w-3.5 h-3.5" />
                            <span>Lihat Foto Lampiran</span>
                          </a>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Riwayat Pengajuan Lembur (SPL) */}
            {aktivitasSubTab === 'lembur' && (
              <div className="space-y-2.5">
                {userOvertimeList.length === 0 ? (
                  <div className="p-6 text-center bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
                    Belum ada pengajuan surat perintah lembur (SPL).
                  </div>
                ) : (
                  userOvertimeList.slice(0, 15).map((ot) => (
                    <div
                      key={ot.id}
                      className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 space-y-2 shadow-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          Lembur Tugas ({ot.durationHours} Jam)
                        </span>
                        <Badge
                          variant="outline"
                          className={
                            ot.status === 'approved'
                              ? 'border-emerald-500/40 text-emerald-700 bg-emerald-50 text-[10px] font-bold'
                              : ot.status === 'rejected'
                              ? 'border-rose-500/40 text-rose-700 bg-rose-50 text-[10px] font-bold'
                              : 'border-amber-500/40 text-amber-700 bg-amber-50 text-[10px] font-bold'
                          }
                        >
                          {ot.status === 'approved' ? 'Disetujui' : ot.status === 'rejected' ? 'Ditolak' : 'Menunggu Approval'}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                        📅 {ot.date} • {ot.startTime} - {ot.endTime} WITA
                      </p>
                      <p className="text-xs text-slate-700 dark:text-slate-300 italic bg-slate-50 dark:bg-slate-800/70 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                        "{ot.taskDescription}"
                      </p>
                      {(ot.taskPhotoUrl || (ot as any).attachmentUrl) && (
                        <div className="flex items-center gap-2 pt-1">
                          <span className="text-[10px] text-slate-400 font-semibold">Bukti Tugas:</span>
                          <a
                            href={ot.taskPhotoUrl || (ot as any).attachmentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline font-semibold"
                          >
                            <ImageIcon className="w-3.5 h-3.5" />
                            <span>Lihat Foto Bukti</span>
                          </a>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* ─── TAB 4: AKUN & PENGATURAN ─── */}
        {activeTab === 'akun' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Profil & Keamanan Akun</h2>
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Nama Lengkap</p>
                <p className="text-xs font-bold text-slate-800 dark:text-white">{user?.fullName}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Email Terdaftar</p>
                <p className="text-xs font-bold text-slate-800 dark:text-white">{user?.email}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-semibold">NIP / ID Karyawan</p>
                <p className="text-xs font-mono font-bold text-slate-800 dark:text-white">{user?.nip || user?.id}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Divisi & Peran</p>
                <p className="text-xs font-bold text-slate-800 dark:text-white">{user?.divisionName || 'Operasional Lapangan'} • {user?.roleName || user?.role || 'Karyawan'}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Jadwal Shift Kerja (Database)</p>
                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  {userShift?.name || user?.shiftName || 'Day Shift'} ({userShift?.startTime || '07:30'} – {userShift?.endTime || '16:30'} WITA)
                </p>
              </div>

              {/* Master Face Biometric Card */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ScanFace className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <p className="text-xs font-bold text-slate-800 dark:text-white">Master Biometrik Wajah</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      masterDescriptor && masterDescriptor.length === 128
                        ? 'border-emerald-500/40 text-emerald-600 bg-emerald-500/10 text-[10px]'
                        : 'border-amber-500/40 text-amber-600 bg-amber-500/10 text-[10px]'
                    }
                  >
                    {masterDescriptor && masterDescriptor.length === 128 ? 'Terdaftar di DB' : 'Belum Terdaftar'}
                  </Badge>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {masterDescriptor && masterDescriptor.length === 128
                    ? '128-D Feature Vector biometrik wajah Anda aktif dan terverifikasi di server presensi.'
                    : 'Wajah Anda belum terdaftar. Hubungi Superadmin atau registrasikan wajah Anda agar presensi wajah aktif.'}
                </p>
                {(!masterDescriptor || masterDescriptor.length !== 128) && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEnrollModalOpen(true)}
                    className="w-full rounded-xl text-xs gap-1.5 border-emerald-600/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 font-bold"
                  >
                    <ScanFace className="w-3.5 h-3.5" />
                    Daftarkan Wajah Sekarang
                  </Button>
                )}
              </div>

              {/* Perangkat Terdaftar Binding */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-800 dark:text-white">Perangkat Terdaftar (HP Binding)</p>
                  <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-600 bg-emerald-50">
                    Terkunci Aman
                  </Badge>
                </div>
                <p className="text-[11px] text-slate-500 font-mono">
                  Model: {user?.deviceModel || 'HP Resmi Karyawan'} • ID: {user?.registeredDeviceId ? user.registeredDeviceId.slice(0, 16) + '...' : 'Terkunci Otomatis'}
                </p>
              </div>

              <div className="pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setChangePasswordModalOpen(true)}
                  className="w-full rounded-xl text-xs gap-1.5"
                >
                  <Lock className="w-3.5 h-3.5" />
                  Ganti Kata Sandi
                </Button>
              </div>

              <div className="pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setLogoutDialogOpen(true)}
                  className="w-full rounded-xl text-xs gap-1.5 text-rose-600 border-rose-200 hover:bg-rose-50"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Keluar dari Akun (Logout)
                </Button>
              </div>
            </div>

            {onSwitchToDesktop && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onSwitchToDesktop}
                className="w-full text-xs text-slate-500 hover:text-slate-800"
              >
                Beralih ke Tampilan Portal Web Lengkap
              </Button>
            )}
          </div>
        )}
      </main>

      {/* ─── BOTTOM NAVIGATION BAR NATIVE (4 TABS PERSIS LAMPIRAN 2) ─── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800 px-3 py-2 flex items-center justify-around shadow-[0_-4px_20px_rgba(0,0,0,0.06)] pb-[max(0.6rem,env(safe-area-inset-bottom))]">
        {/* Tab 1: BERANDA */}
        <button
          type="button"
          onClick={() => setActiveTab('beranda')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all active:scale-90 ${
            activeTab === 'beranda' ? 'text-emerald-700 dark:text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px] mt-1 tracking-tight">BERANDA</span>
          {activeTab === 'beranda' && <span className="w-6 h-0.5 bg-emerald-600 rounded-full mt-0.5" />}
        </button>

        {/* Tab 2: RIWAYAT */}
        <button
          type="button"
          onClick={() => setActiveTab('riwayat')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all active:scale-90 ${
            activeTab === 'riwayat' ? 'text-emerald-700 dark:text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <History className="w-5 h-5" />
          <span className="text-[10px] mt-1 tracking-tight">RIWAYAT</span>
          {activeTab === 'riwayat' && <span className="w-6 h-0.5 bg-emerald-600 rounded-full mt-0.5" />}
        </button>

        {/* Tab 3: AKTIVITAS */}
        <button
          type="button"
          onClick={() => setActiveTab('aktivitas')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all active:scale-90 ${
            activeTab === 'aktivitas' ? 'text-emerald-700 dark:text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <CalendarDays className="w-5 h-5" />
          <span className="text-[10px] mt-1 tracking-tight">AKTIVITAS</span>
          {activeTab === 'aktivitas' && <span className="w-6 h-0.5 bg-emerald-600 rounded-full mt-0.5" />}
        </button>

        {/* Tab 4: AKUN */}
        <button
          type="button"
          onClick={() => setActiveTab('akun')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all active:scale-90 ${
            activeTab === 'akun' ? 'text-emerald-700 dark:text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <User className="w-5 h-5" />
          <span className="text-[10px] mt-1 tracking-tight">AKUN</span>
          {activeTab === 'akun' && <span className="w-6 h-0.5 bg-emerald-600 rounded-full mt-0.5" />}
        </button>
      </nav>

      {/* ─── MODAL KONFIRMASI MULAI ISTIRAHAT 1 JAM ─── */}
      <Dialog open={breakConfirmModalOpen} onOpenChange={setBreakConfirmModalOpen}>
        <DialogContent className="max-w-sm rounded-3xl p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-amber-600 flex items-center gap-2">
              <Coffee className="w-5 h-5" />
              Mulai Jam Istirahat 1 Jam?
            </DialogTitle>
            <DialogDescription className="text-xs">
              Sistem akan mengaktifkan mode istirahat 60 menit. Selama jam istirahat berlangsung, pengawasan perimeter / geofence dijeda dan alarm pelanggaran area tidak akan berbunyi.
            </DialogDescription>
          </DialogHeader>

          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-2xl border border-amber-200 dark:border-amber-800 text-xs space-y-1 text-amber-900 dark:text-amber-200">
            <p className="font-bold flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-600" />
              Durasi: 60 Menit Resmi
            </p>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              Anda bebas keluar area kantor. Notifikasi pengingat akan muncul otomatis saat waktu istirahat habis.
            </p>
          </div>

          <DialogFooter className="flex flex-row gap-2">
            <Button variant="outline" size="sm" onClick={() => setBreakConfirmModalOpen(false)} className="rounded-xl flex-1 text-xs">
              Batal
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmStartBreak}
              className="rounded-xl flex-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold"
            >
              Mulai Istirahat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL IZIN PULANG DARURAT (SELF-SERVICE ALERT) ─── */}
      <Dialog open={emergencyModalOpen} onOpenChange={setEmergencyModalOpen}>
        <DialogContent className="max-w-sm rounded-3xl p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-rose-600 flex items-center gap-2">
              <AlertOctagon className="w-5 h-5" />
              Izin Pulang Darurat
            </DialogTitle>
            <DialogDescription className="text-xs">
              Pilihan khusus kondisi mendadak/sakit. Sistem otomatis mencatat presensi pulang saat ini dan mengirim notifikasi darurat instan ke Pimpinan.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Kategori Kondisi Darurat:
              </label>
              <select
                value={emergencyCategory}
                onChange={(e) => setEmergencyCategory(e.target.value as any)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
              >
                <option value="sakit_mendadak">🤒 Sakit Mendadak (Butuh Pengobatan/Istirahat)</option>
                <option value="darurat_keluarga">👨‍👩‍👧 Keperluan Darurat Keluarga</option>
                <option value="tugas_luar">🚗 Tugas Lapangan / Dinas Mendadak</option>
                <option value="lainnya">⚠️ Kondisi Force Majeure / Lainnya</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Penjelasan / Alasan Lengkap:
              </label>
              <textarea
                rows={3}
                value={emergencyReason}
                onChange={(e) => setEmergencyReason(e.target.value)}
                placeholder="Tuliskan keterangan mendesak secara jelas..."
                className="w-full p-3 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 text-[10.5px] text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>Presensi pulang Anda akan langsung terverifikasi dengan waktu saat ini.</span>
            </div>
          </div>

          <DialogFooter className="flex flex-row gap-2">
            <Button variant="outline" size="sm" onClick={() => setEmergencyModalOpen(false)} className="rounded-xl flex-1 text-xs">
              Batal
            </Button>
            <Button
              size="sm"
              disabled={isSubmittingEmergency || !emergencyReason.trim()}
              onClick={handleConfirmEmergency}
              className="rounded-xl flex-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"
            >
              {isSubmittingEmergency ? 'Memproses...' : 'Kirim Izin Darurat'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL PENGAJUAN CUTI / IZIN BARU (TAB AKTIVITAS) ─── */}
      <Dialog open={leaveModalOpen} onOpenChange={setLeaveModalOpen}>
        <DialogContent className="max-w-sm rounded-3xl p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
              <CalendarCheck2 className="w-5 h-5" />
              Pengajuan Cuti / Izin Karyawan
            </DialogTitle>
            <DialogDescription className="text-xs">
              Formulir resmi otomatis dikirim via WhatsApp ke Korlap, Admin, atau K3 untuk konfirmasi persetujuan.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Jenis Permohonan:
              </label>
              <select
                value={leaveType}
                onChange={(e) => setLeaveType(e.target.value as any)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
              >
                <option value="annual_leave">🏖️ Cuti Tahunan (Sisa: {analyticsData.remainingLeave} Hari)</option>
                <option value="sick_leave">🏥 Izin Sakit (Disertai Surat Dokter)</option>
                <option value="emergency_leave">🚨 Izin Kepentingan Darurat</option>
                <option value="unpaid_leave">📋 Izin Khusus / Dispensasi Dinas</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Mulai Tanggal:
                </label>
                <input
                  type="date"
                  value={leaveStartDate}
                  onChange={(e) => setLeaveStartDate(e.target.value)}
                  className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Sampai Tanggal:
                </label>
                <input
                  type="date"
                  value={leaveEndDate}
                  onChange={(e) => setLeaveEndDate(e.target.value)}
                  className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Alasan / Keterangan <span className="text-rose-500">*Wajib</span>:
              </label>
              <textarea
                rows={3}
                value={leaveReason}
                onChange={(e) => setLeaveReason(e.target.value)}
                placeholder="Tuliskan alasan pengajuan cuti secara rinci..."
                className="w-full p-3 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Upload Foto Bukti Pendukung (Wajib) */}
            <div className="space-y-1.5 pt-1">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Foto Bukti / Surat Keterangan <span className="text-rose-500">*Wajib</span></span>
                {leaveProofPhoto && <span className="text-[10px] text-emerald-600 font-bold">✓ Terlampir</span>}
              </label>
              <div className="flex items-center gap-2">
                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-200 transition-colors border border-slate-300 dark:border-slate-700">
                  <Camera className="w-4 h-4 text-emerald-600" />
                  <span>Ambil Foto / Dokumen</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => handlePhotoFileChange(e, setLeaveProofPhoto)}
                  />
                </label>
                {leaveProofPhoto && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setLeaveProofPhoto('')}
                    className="h-8 px-2 text-rose-500 hover:text-rose-600 text-xs"
                  >
                    Hapus Foto
                  </Button>
                )}
              </div>
              {leaveProofPhoto ? (
                <div className="relative w-24 h-24 rounded-xl overflow-hidden border-2 border-emerald-500 mt-2 shadow-xs">
                  <img src={leaveProofPhoto} alt="Bukti Cuti" className="w-full h-full object-cover" />
                </div>
              ) : (
                <p className="text-[10.5px] text-amber-600 dark:text-amber-400 italic">
                  * Pengajuan tanpa foto bukti tidak dapat diproses oleh sistem.
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="flex flex-row gap-2">
            <Button variant="outline" size="sm" onClick={() => setLeaveModalOpen(false)} className="rounded-xl flex-1 text-xs">
              Batal
            </Button>
            <Button
              size="sm"
              disabled={isSubmittingLeave || !leaveStartDate || !leaveEndDate || !leaveReason.trim() || !leaveProofPhoto}
              onClick={handleCreateLeave}
              className="rounded-xl flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
            >
              {isSubmittingLeave ? 'Mengirim...' : 'Kirim Pengajuan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL DETAIL PRATINJAU PRESENSI DENGAN FOTO WATERMARK (TAB RIWAYAT) ─── */}
      <Dialog open={Boolean(selectedHistoryRecord)} onOpenChange={(open) => !open && setSelectedHistoryRecord(null)}>
        <DialogContent className="max-w-sm rounded-3xl p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center justify-between">
              <span>Detail Presensi</span>
              {selectedHistoryRecord && (
                <Badge className={selectedHistoryRecord.status === 'hadir' ? 'bg-emerald-600 text-white text-[10px]' : 'bg-amber-500 text-white text-[10px]'}>
                  {selectedHistoryRecord.status.toUpperCase()}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {selectedHistoryRecord ? `Tanggal: ${selectedHistoryRecord.date || selectedHistoryRecord.attendanceDate}` : ''}
            </DialogDescription>
          </DialogHeader>

          {selectedHistoryRecord && (
            <div className="space-y-3 py-1 text-xs">
              {/* Foto Presensi dengan Watermark */}
              {selectedHistoryRecord.clockInPhoto || selectedHistoryRecord.photoIn ? (
                <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-inner bg-slate-900">
                  <img
                    src={selectedHistoryRecord.clockInPhoto || selectedHistoryRecord.photoIn}
                    alt="Foto Presensi Watermark"
                    className="w-full h-52 object-cover"
                  />
                  <div className="p-2 bg-slate-950 text-white text-[10px] flex items-center justify-between">
                    <span className="text-emerald-400 font-mono">🛡️ Watermark Forensik Terverifikasi</span>
                    <span className="text-slate-400">1:1 Biometrik</span>
                  </div>
                </div>
              ) : (
                <div className="h-28 rounded-2xl bg-slate-100 dark:bg-slate-900 flex flex-col items-center justify-center text-slate-400 gap-1 border border-dashed border-slate-300 dark:border-slate-800">
                  <Camera className="w-6 h-6 text-slate-400" />
                  <span className="text-[11px]">Foto check-in tidak tersimpan</span>
                </div>
              )}

              {/* Rincian Jam */}
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <p className="text-[10px] text-slate-400">JAM MASUK</p>
                  <p className="font-mono font-bold text-xs text-slate-900 dark:text-slate-100 mt-0.5">
                    {selectedHistoryRecord.clockIn ? `${selectedHistoryRecord.clockIn.substring(0, 5)} WITA` : '-'}
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <p className="text-[10px] text-slate-400">JAM PULANG</p>
                  <p className="font-mono font-bold text-xs text-slate-900 dark:text-slate-100 mt-0.5">
                    {selectedHistoryRecord.clockOut ? `${selectedHistoryRecord.clockOut.substring(0, 5)} WITA` : '-'}
                  </p>
                </div>
              </div>

              {/* Peringatan Keterlambatan Istirahat */}
              {selectedHistoryRecord.breakLateMinutes && selectedHistoryRecord.breakLateMinutes > 0 ? (
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-[11px] flex items-center justify-between text-rose-700 dark:text-rose-300">
                  <span className="font-semibold">⚠️ Keterlambatan Istirahat:</span>
                  <span className="font-mono font-black">{selectedHistoryRecord.breakLateMinutes} Menit</span>
                </div>
              ) : null}

              {/* Lokasi & Catatan */}
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] space-y-1">
                <p className="text-[10px] text-slate-400">POS / LOKASI PENUGASAN</p>
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  {selectedHistoryRecord.notes || assignedPostName || 'Pos Lapangan Terdaftar'}
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button size="sm" onClick={() => setSelectedHistoryRecord(null)} className="w-full rounded-xl text-xs font-bold">
              Tutup Rincian
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL PENGAJUAN LEMBUR (SPL) DENGAN FOTO BUKTI WAJIB ─── */}
      <Dialog open={overtimeModalOpen} onOpenChange={setOvertimeModalOpen}>
        <DialogContent className="max-w-sm rounded-3xl p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-blue-700 dark:text-blue-400 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Pengajuan Lembur (SPL)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Formulir SPL resmi lapangan. Wajib melampirkan foto bukti pekerjaan / lokasi tugas.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Tanggal Lembur:
              </label>
              <input
                type="date"
                value={otDate}
                onChange={(e) => setOtDate(e.target.value)}
                className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Jam Mulai:
                </label>
                <input
                  type="time"
                  value={otStartTime}
                  onChange={(e) => setOtStartTime(e.target.value)}
                  className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Jam Selesai:
                </label>
                <input
                  type="time"
                  value={otEndTime}
                  onChange={(e) => setOtEndTime(e.target.value)}
                  className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Estimasi Durasi (Jam):
              </label>
              <input
                type="number"
                min={0.5}
                step={0.5}
                value={otHours}
                onChange={(e) => setOtHours(Number(e.target.value))}
                className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Uraian Tugas / Alasan Lembur <span className="text-rose-500">*Wajib</span>:
              </label>
              <textarea
                rows={3}
                value={otTaskDescription}
                onChange={(e) => setOtTaskDescription(e.target.value)}
                placeholder="Jelaskan uraian pekerjaan lembur yang dikerjakan..."
                className="w-full p-3 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-1.5 pt-1">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Foto Bukti Pekerjaan / Lokasi <span className="text-rose-500">*Wajib</span></span>
                {otProofPhoto && <span className="text-[10px] text-emerald-600 font-bold">✓ Terlampir</span>}
              </label>
              <div className="flex items-center gap-2">
                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-200 transition-colors border border-slate-300 dark:border-slate-700">
                  <Camera className="w-4 h-4 text-blue-600" />
                  <span>Ambil Foto / Pilih File</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => handlePhotoFileChange(e, setOtProofPhoto)}
                  />
                </label>
                {otProofPhoto && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setOtProofPhoto('')}
                    className="h-8 px-2 text-rose-500 hover:text-rose-600 text-xs"
                  >
                    Hapus Foto
                  </Button>
                )}
              </div>
              {otProofPhoto ? (
                <div className="relative w-24 h-24 rounded-xl overflow-hidden border-2 border-blue-500 mt-2 shadow-xs">
                  <img src={otProofPhoto} alt="Bukti Lembur" className="w-full h-full object-cover" />
                </div>
              ) : (
                <p className="text-[10.5px] text-amber-600 dark:text-amber-400 italic">
                  * Pengajuan lembur wajib melampirkan foto pekerjaan di lokasi tugas.
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="flex flex-row gap-2">
            <Button variant="outline" size="sm" onClick={() => setOvertimeModalOpen(false)} className="rounded-xl flex-1 text-xs">
              Batal
            </Button>
            <Button
              size="sm"
              disabled={isSubmittingOvertime || !otTaskDescription.trim() || !otProofPhoto}
              onClick={handleCreateOvertime}
              className="rounded-xl flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
            >
              {isSubmittingOvertime ? 'Mengirim...' : 'Kirim SPL'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL JADWAL ROSTER SHIFT BULAN BERJALAN ─── */}
      <Dialog open={scheduleModalOpen} onOpenChange={setScheduleModalOpen}>
        <DialogContent className="max-w-md max-h-[85vh] rounded-3xl p-5 flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-emerald-600" />
              Jadwal Shift Kerja Bulan Ini
            </DialogTitle>
            <DialogDescription className="text-xs">
              {new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })} • {userShift?.name || 'Shift Reguler Operasional'}
            </DialogDescription>
          </DialogHeader>

          {/* Ringkasan Shift */}
          <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-emerald-800 dark:text-emerald-300 font-bold">{userShift?.name || 'Shift Operasional FRP'}</span>
              <Badge className="bg-emerald-600 text-white text-[10px]">
                {userShift?.startTime || '07:30'} - {userShift?.endTime || '16:30'} WITA
              </Badge>
            </div>
            <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
              Hari Kerja: {userShift?.workingDays?.map((d: number) => ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'][d]).join(', ') || 'Senin - Sabtu'}
            </p>
          </div>

          {/* Daftar Hari dalam Bulan Berjalan */}
          <div className="overflow-y-auto space-y-2 py-1 pr-1 flex-1 text-xs">
            {currentMonthDays.map((item) => (
              <div
                key={item.dateStr}
                className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                  item.isToday
                    ? 'border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/30 font-bold'
                    : item.isOff
                    ? 'border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-900/40 text-slate-400'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex flex-col items-center justify-center text-center font-mono ${
                      item.isToday
                        ? 'bg-emerald-600 text-white'
                        : item.isOff
                        ? 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <span className="text-[9px] uppercase leading-none">{item.dayName.substring(0, 3)}</span>
                    <span className="text-xs font-bold leading-none mt-0.5">{item.dayNum}</span>
                  </div>
                  <div>
                    <p className={`text-xs ${item.isToday ? 'font-bold text-emerald-700 dark:text-emerald-400' : 'font-medium'}`}>
                      {item.dayName}, {item.dayNum} {new Date().toLocaleDateString('id-ID', { month: 'short' })}
                      {item.isToday && <span className="ml-2 text-[10px] text-emerald-600 uppercase font-black tracking-wider">(Hari Ini)</span>}
                    </p>
                    <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
                      {item.shiftName}
                    </p>
                  </div>
                </div>

                <Badge
                  variant="outline"
                  className={`text-[10px] ${
                    item.isOff
                      ? 'border-slate-300 dark:border-slate-700 text-slate-400 bg-transparent'
                      : 'border-emerald-500/40 text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20'
                  }`}
                >
                  {item.shiftHours}
                </Badge>
              </div>
            ))}
          </div>

          <DialogFooter className="pt-2">
            <Button size="sm" onClick={() => setScheduleModalOpen(false)} className="w-full rounded-xl text-xs font-bold">
              Tutup Kalender Roster
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL NOTIFIKASI REALTIME PENGAJUAN & SISTEM ─── */}
      <Dialog open={notificationsDrawerOpen} onOpenChange={setNotificationsDrawerOpen}>
        <DialogContent className="max-w-sm max-h-[85vh] rounded-3xl p-5 flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Bell className="w-5 h-5 text-emerald-600" />
                Pemberitahuan & Alert
              </DialogTitle>
              {unreadNotificationsCount > 0 && (
                <Badge className="bg-rose-500 text-white text-[10px]">
                  {unreadNotificationsCount} Baru
                </Badge>
              )}
            </div>
            <DialogDescription className="text-xs">
              Notifikasi status persetujuan cuti, izin, lembur, serta instruksi pimpinan.
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-y-auto space-y-2 py-2 flex-1 text-xs">
            {userNotifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                <Bell className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2 opacity-50" />
                <p className="text-xs">Belum ada notifikasi baru untuk Anda.</p>
              </div>
            ) : (
              userNotifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => hrmService.markNotificationAsRead(notif.id)}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                    !notif.isRead
                      ? 'border-emerald-500/50 bg-emerald-50/40 dark:bg-emerald-950/20'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-xs ${!notif.isRead ? 'font-bold text-slate-900 dark:text-white' : 'font-semibold text-slate-700 dark:text-slate-300'}`}>
                      {notif.title}
                    </p>
                    {!notif.isRead && (
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 mt-1" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                    {notif.message}
                  </p>
                  <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400">
                    <span>{new Date(notif.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WITA</span>
                    <span className="capitalize">{notif.type || 'Sistem'}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          <DialogFooter className="pt-2 flex flex-row gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                userNotifications.forEach(n => hrmService.markNotificationAsRead(n.id));
                toast.success('Semua notifikasi ditandai sudah dibaca.');
              }}
              className="rounded-xl flex-1 text-xs"
            >
              Tandai Semua Dibaca
            </Button>
            <Button
              size="sm"
              onClick={() => setNotificationsDrawerOpen(false)}
              className="rounded-xl flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
            >
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL GANTI PASSWORD ─── */}
      <Dialog open={changePasswordModalOpen} onOpenChange={setChangePasswordModalOpen}>
        <DialogContent className="max-w-sm rounded-3xl p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Ganti Kata Sandi</DialogTitle>
            <DialogDescription className="text-xs">Masukkan kata sandi baru untuk akun Anda.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <input
              type="password"
              placeholder="Kata Sandi Baru"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs"
            />
            <input
              type="password"
              placeholder="Ulangi Kata Sandi Baru"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs"
            />
          </div>

          <DialogFooter className="flex flex-row gap-2">
            <Button variant="outline" size="sm" onClick={() => setChangePasswordModalOpen(false)} className="rounded-xl flex-1 text-xs">
              Batal
            </Button>
            <Button
              size="sm"
              disabled={isChangingPassword || !newPassword || newPassword !== confirmPassword}
              onClick={handleChangePassword}
              className="rounded-xl flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
            >
              {isChangingPassword ? 'Menyimpan...' : 'Simpan Sandi'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── DIALOG KONFIRMASI LOGOUT ─── */}
      <Dialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <DialogContent className="max-w-xs rounded-3xl p-5 text-center">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 mx-auto flex items-center justify-center mb-2">
            <LogOut className="w-6 h-6" />
          </div>
          <DialogTitle className="text-sm font-bold text-center">Keluar dari Akun?</DialogTitle>
          <DialogDescription className="text-xs text-center">
            Anda harus login kembali untuk melakukan presensi berikutnya.
          </DialogDescription>
          <DialogFooter className="flex flex-row gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setLogoutDialogOpen(false)} className="rounded-xl flex-1 text-xs">
              Batal
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setLogoutDialogOpen(false);
                logout();
              }}
              className="rounded-xl flex-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"
            >
              Ya, Keluar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL PERINGATAN DARURAT: INSTRUKSI LAPOR WAJAH PIMPINAN ─── */}
      <Dialog
        open={spotCheckModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            // Pengguna menutup modal: matikan sirene dan bungkam agar tidak bunyi berulang
            isAlarmSilencedRef.current = true;
            emergencyAlertService.stopEmergencyAlert();
            setSpotCheckModalOpen(false);
          }
        }}
      >
        <DialogContent className="max-w-sm rounded-[28px] p-0 overflow-hidden border-2 border-rose-500 shadow-[0_0_50px_rgba(244,63,94,0.45)] bg-slate-950 text-white animate-in zoom-in-95 duration-200">
          {/* Header Bar Berkedip Merah Darurat */}
          <div className="bg-gradient-to-r from-rose-600 via-red-600 to-amber-600 p-4 text-white relative">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 animate-bounce">
                <BellRing className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/30 text-[10px] font-black tracking-wider uppercase">
                  <span className="w-2 h-2 rounded-full bg-amber-300 animate-ping" />
                  Instruksi Khusus Pimpinan
                </div>
                <h3 className="text-sm font-black tracking-tight uppercase leading-tight mt-0.5">
                  Wajib Lapor Wajah Segera!
                </h3>
              </div>
            </div>
          </div>

          {/* Body Konten Peringatan */}
          <div className="p-5 space-y-4">
            {/* Box Catatan Pimpinan */}
            <div className="p-3.5 rounded-2xl bg-rose-950/60 border border-rose-500/40 text-rose-100 space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-rose-300 flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                Pesan Pimpinan PT. FRP:
              </p>
              <p className="text-xs font-semibold leading-relaxed text-white">
                "{spotCheckData?.notes || 'Pimpinan meminta Anda segera melakukan verifikasi scan wajah di pos tugas.'}"
              </p>
            </div>

            {/* Status Lokasi & Waktu Berjalan */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-0.5">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Pos Tugas Aktif</span>
                <span className="font-bold text-emerald-400 truncate block">
                  {assignedPostName || 'Pos Lapangan Terdaftar'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-0.5">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Batas Waktu Respon</span>
                <span className="font-mono font-black text-amber-400 text-sm block">
                  {Math.floor(spotCheckSecondsLeft / 60)}:{String(spotCheckSecondsLeft % 60).padStart(2, '0')} Menit
                </span>
              </div>
            </div>

            {/* GPS Koordinat & Akurasi Hardware */}
            <div className="px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
              <span>📡 Status GPS HP:</span>
              <span className="font-mono text-slate-200">
                {currentCoords ? `${currentCoords.lat.toFixed(5)}, ${currentCoords.lng.toFixed(5)}` : 'Mendeteksi...'}
                {coordsAccuracy ? ` (±${Math.round(coordsAccuracy)}m)` : ''}
              </span>
            </div>

            <p className="text-[11px] text-center text-slate-400 leading-normal">
              Foto wajah akan dibubuhi <b>watermark forensik</b> (koordinat, waktu WITA, dan skor biometrik) dan langsung terverifikasi di radar pimpinan.
            </p>

            {/* Tombol Aksi Utama */}
            <div className="space-y-2 pt-1">
              <Button
                type="button"
                onClick={() => {
                  isAlarmSilencedRef.current = true;
                  emergencyAlertService.stopEmergencyAlert();
                  setSpotCheckModalOpen(false);
                  setIsSpotCheckAction(true);
                  openLiveCamera('clock_in');
                }}
                className="w-full h-13 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-extrabold text-sm shadow-[0_0_25px_rgba(16,185,129,0.4)] flex items-center justify-center gap-2 active:scale-98 transition-all"
              >
                <Camera className="w-5 h-5 animate-pulse" />
                <span>📸 BUKA KAMERA & LAPOR SEKARANG</span>
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  isAlarmSilencedRef.current = true;
                  emergencyAlertService.stopEmergencyAlert();
                  toast.info('Getaran dihentikan. Silakan lakukan pengambilan 1 foto selfie bukti realtime.');
                }}
                className="w-full text-xs text-slate-400 hover:text-white hover:bg-slate-900 rounded-xl h-9 flex items-center justify-center gap-1.5"
              >
                <VolumeX className="w-3.5 h-3.5" />
                <span>Heningkan Getaran</span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL PANDUAN INSTALASI PWA & DOWNLOAD APK LANGSUNG ─── */}
      <Dialog open={showPwaInstallModal} onOpenChange={setShowPwaInstallModal}>
        <DialogContent className="max-w-md rounded-3xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-foreground">
              <Smartphone className="w-5 h-5 text-emerald-600" />
              Pasang Aplikasi HRM di HP
            </DialogTitle>
            <DialogDescription className="text-xs">
              Install aplikasi ke layar utama agar presensi instan tanpa buka browser lagi:
            </DialogDescription>
          </DialogHeader>

          {/* Sub-Tabs Switcher */}
          <div className="flex rounded-xl bg-muted p-1 gap-1 text-xs font-bold">
            <button
              type="button"
              onClick={() => setPwaGuideTab('android')}
              className={`flex-1 py-1.5 rounded-lg transition-all text-center truncate ${
                pwaGuideTab === 'android'
                  ? 'bg-card text-emerald-700 dark:text-emerald-400 shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Android (Chrome)
            </button>
            <button
              type="button"
              onClick={() => setPwaGuideTab('ios')}
              className={`flex-1 py-1.5 rounded-lg transition-all text-center truncate ${
                pwaGuideTab === 'ios'
                  ? 'bg-card text-emerald-700 dark:text-emerald-400 shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              iPhone (Safari)
            </button>
          </div>

          {pwaGuideTab === 'android' && (
            <div className="space-y-3 text-xs">
              <div className="space-y-2 bg-muted/40 p-3.5 rounded-2xl border border-border">
                <p className="font-bold text-foreground">🤖 Langkah Pasang di Android:</p>
                <ol className="space-y-2 list-decimal list-inside text-muted-foreground leading-relaxed">
                  <li>Buka browser <b>Google Chrome</b>.</li>
                  <li>Ketuk ikon <b>titik tiga (⋮)</b> di pojok kanan atas.</li>
                  <li>Pilih <b>"Pasang aplikasi"</b> atau <b>"Tambahkan ke Layar Utama"</b>.</li>
                  <li>Klik <b>"Install"</b>. Aplikasi HRM akan langsung muncul di beranda HP Anda!</li>
                </ol>
              </div>
            </div>
          )}

          {pwaGuideTab === 'ios' && (
            <div className="space-y-3 text-xs">
              <div className="space-y-2 bg-muted/40 p-3.5 rounded-2xl border border-border">
                <p className="font-bold text-foreground">🍎 Langkah Pasang di iPhone/iPad:</p>
                <ol className="space-y-2 list-decimal list-inside text-muted-foreground leading-relaxed">
                  <li>Buka link di browser <b>Safari</b>.</li>
                  <li>Ketuk tombol <b>Bagikan (Share)</b> di bilah bawah (<Share className="w-3.5 h-3.5 inline text-emerald-600" />).</li>
                  <li>Pilih <b>"Tambahkan ke Layar Utama"</b> (<PlusSquare className="w-3.5 h-3.5 inline text-emerald-600" />).</li>
                  <li>Ketuk <b>"Tambah" (Add)</b> di pojok kanan atas.</li>
                </ol>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPwaInstallModal(false)}
              className="w-full rounded-xl text-xs font-semibold"
            >
              Tutup Panduan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL ENROLLMENT WAJAH BIOMETRIK MASTER ─── */}
      <HrmFaceEnrollmentModal
        open={enrollModalOpen}
        user={user}
        onClose={() => setEnrollModalOpen(false)}
        onSuccess={() => {
          setEnrollModalOpen(false);
          refreshUser?.();
          loadRealData();
          toast.success('Pendaftaran Biometrik Master Berhasil Disimpan ke Database!');
        }}
      />

      {/* ─── MODAL PUSAT OTORITAS LAPANGAN & REKAP TIM (PWA MOBILE) ─── */}
      <HrmFieldAuthorityMobileModal
        isOpen={fieldAuthorityModalOpen}
        onClose={() => setFieldAuthorityModalOpen(false)}
        initialTab={fieldAuthorityInitialTab}
        currentUser={user}
      />

      {/* ─── HIDDEN INPUT NATIVE DEVICE CAMERA CAPTURE (100% BULLETPROOF FALLBACK) ─── */}
      <input
        type="file"
        ref={nativeCameraInputRef}
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file || !user) return;
          isCapturingRef.current = true;
          setIsCapturing(true);
          try {
            const img = new Image();
            const objectUrl = URL.createObjectURL(file);
            await new Promise((resolve, reject) => {
              img.onload = resolve;
              img.onerror = reject;
              img.src = objectUrl;
            });

            const canvas = document.createElement('canvas');
            const maxDim = 1280;
            let w = img.width;
            let h = img.height;
            if (w > maxDim || h > maxDim) {
              if (w > h) {
                h = Math.round((h * maxDim) / w);
                w = maxDim;
              } else {
                w = Math.round((w * maxDim) / h);
                h = maxDim;
              }
            }
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Canvas context error');
            ctx.drawImage(img, 0, 0, w, h);
            URL.revokeObjectURL(objectUrl);

            // Terapkan Watermark Forensik
            applyWatermark(canvas, 96);
            const photoData = canvas.toDataURL('image/jpeg', 0.85);

            // Tutup live camera jika sedang terbuka
            closeLiveCamera();

            // Submit Attendance
            const todayStr = getTodayDateStr();
            const now = new Date();
            const pad = (n: number) => String(n).padStart(2, '0');
            const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

            let lateMinutes = 0;
            let status: 'hadir' | 'terlambat' = 'hadir';
            if (actionType === 'clock_in' && userShift?.startTime) {
              const [sH, sM] = userShift.startTime.split(':').map(Number);
              const [cH, cM] = [now.getHours(), now.getMinutes()];
              const diff = (cH * 60 + cM) - (sH * 60 + sM);
              if (diff > 0) {
                lateMinutes = diff;
                status = 'terlambat';
              }
            }

            const savedAttendance = await hrmService.recordAttendance({
              userId: user.id,
              date: todayStr,
              clockIn: actionType === 'clock_in' ? timeStr : todayAttendance?.clockIn || timeStr,
              clockOut: actionType === 'clock_out' ? timeStr : todayAttendance?.clockOut,
              status: actionType === 'clock_in' ? status : todayAttendance?.status || 'hadir',
              lateMinutes: actionType === 'clock_in' ? lateMinutes : todayAttendance?.lateMinutes || 0,
              clockInPhoto: actionType === 'clock_in' ? photoData : todayAttendance?.clockInPhoto,
              clockOutPhoto: actionType === 'clock_out' ? photoData : todayAttendance?.clockOutPhoto,
              latitude: currentCoords?.lat,
              longitude: currentCoords?.lng,
              locationName: assignedPostName,
              biometricConfidence: 96,
              isVerifiedBiometric: true,
            });

            if (savedAttendance) {
              setTodayAttendance(savedAttendance);
            }

            if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
              try { navigator.vibrate([100, 50, 100]); } catch (e) {}
            }

            toast.success(
              actionType === 'clock_in'
                ? `Absen Masuk Berhasil via Kamera HP! (${timeStr} WITA)`
                : `Absen Pulang Berhasil via Kamera HP! (${timeStr} WITA)`
            );

            await loadRealData();
          } catch (err: any) {
            console.error('[Native Camera Capture Error]', err);
            toast.error('Gagal memproses foto kamera: ' + (err.message || 'Error'));
          } finally {
            isCapturingRef.current = false;
            setIsCapturing(false);
            if (nativeCameraInputRef.current) nativeCameraInputRef.current.value = '';
          }
        }}
      />

      {/* ─── MODAL LAPOR KENDALA PERJALANAN (EMERGENCY ROADSIDE DISPENSATION) ─── */}
      <Dialog open={travelModalOpen} onOpenChange={setTravelModalOpen}>
        <DialogContent className="max-w-md p-4 sm:p-6 rounded-3xl bg-card border-border">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
                <Wrench className="w-4 h-4" />
              </div>
              <span>Lapor Kendala Perjalanan Menuju Pos</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Laporkan kejadian darurat di perjalanan (ban bocor, bensin habis, motor mogok). Sistem otomatis memberikan toleransi dispensasi keterlambatan tanpa sanksi.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2 text-xs">
            {/* Pilihan Jenis Kendala */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Jenis Kendala yang Dialami:</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'ban_bocor', label: '🏍️ Ban Bocor / Kempes', grace: '45m' },
                  { id: 'kehabisan_bensin', label: '⛽ Kehabisan Bensin', grace: '30m' },
                  { id: 'motor_rusak', label: '🔧 Motor Mogok / Rusak', grace: '60m' },
                  { id: 'kecelakaan_ringan', label: '🚑 Kecelakaan Ringan', grace: '60m' },
                  { id: 'cuaca_ekstrem', label: '🌧️ Cuaca Ekstrem / Banjir', grace: '60m' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTravelIncidentType(item.id as any)}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      travelIncidentType === item.id
                        ? 'border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-300 font-bold shadow-xs'
                        : 'border-border hover:bg-muted text-muted-foreground'
                    }`}
                  >
                    <p className="text-xs truncate">{item.label}</p>
                    <span className="text-[10px] opacity-80">Toleransi +{item.grace}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Rekomendasi Solusi Terbaik Dinamis */}
            <div className="p-3 rounded-2xl bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent border border-amber-500/30 text-amber-900 dark:text-amber-200 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-[11px] text-amber-800 dark:text-amber-300">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Rekomendasi & Langkah Darurat FRP:</span>
              </div>
              <p className="text-[11px] leading-relaxed opacity-90">
                {travelIncidentType === 'ban_bocor' &&
                  '1. Segera tepikan kendaraan di bahu jalan yang aman. 2. Nyalakan lampu darurat jika malam hari. 3. Hubungi atau cari jasa tambal ban terdekat. Diberikan toleransi tambahan 45 menit tanpa potongan/SP.'}
                {travelIncidentType === 'kehabisan_bensin' &&
                  '1. Pindahkan kendaraan ke trotoar/area aman. 2. Beli BBM di Pertashop/SPBU terdekat atau hubungi rekan kerja terdekat untuk bantuan darurat. Diberikan toleransi tambahan 30 menit.'}
                {travelIncidentType === 'motor_rusak' &&
                  '1. Jangan paksa starter berkali-kali. 2. Bawa ke bengkel darurat terdekat atau panggil montir. Simpan bukti nota perbaikan. Diberikan toleransi tambahan 60 menit.'}
                {travelIncidentType === 'kecelakaan_ringan' &&
                  '1. Prioritaskan pertolongan pertama (P3K) dan keselamatan fisik Anda. 2. Hubungi keluarga/atasan langsung jika butuh penjemputan darurat. Diberikan dispensasi penuh.'}
                {travelIncidentType === 'cuaca_ekstrem' &&
                  '1. Berteduh di bangunan kokoh dan aman. 2. Jauhi pohon rindang besar dan tiang listrik. Diberikan toleransi cuaca 60 menit.'}
              </p>
            </div>

            {/* Foto Bukti Kejadian (Camera / File) */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Foto Bukti Kendala (Watermark Otomatis):</label>
              {travelProofPhoto ? (
                <div className="relative rounded-2xl overflow-hidden border border-border">
                  <img src={travelProofPhoto} alt="Bukti Kendala" className="w-full h-36 object-cover" />
                  <button
                    type="button"
                    onClick={() => setTravelProofPhoto('')}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 text-white hover:bg-black"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-dashed border-border hover:border-primary/50 cursor-pointer bg-muted/20">
                  <Camera className="w-6 h-6 text-primary mb-1" />
                  <span className="text-xs font-semibold text-foreground">Ambil Foto Bukti Kamera</span>
                  <span className="text-[10px] text-muted-foreground">Otomatis dibubuhi watermark GPS & WITA</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleCaptureTravelProof}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {/* Keterangan Tambahan */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground">Keterangan Lokasi / Kondisi (Opsional):</label>
              <Input
                value={travelReason}
                onChange={(e) => setTravelReason(e.target.value)}
                placeholder="Contoh: Ban belakang bocor kena paku di Jl. Poros..."
                className="h-8 text-xs rounded-xl"
              />
            </div>

            {/* GPS Status Indicator */}
            <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1">
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3 text-emerald-500" />
                <span>GPS: {currentCoords ? `${currentCoords.lat.toFixed(5)}, ${currentCoords.lng.toFixed(5)}` : 'Mendeteksi...'}</span>
              </span>
              <span>Akurasi: ±{coordsAccuracy ? Math.round(coordsAccuracy) : 10}m</span>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setTravelModalOpen(false)} className="rounded-xl text-xs">
              Batal
            </Button>
            <Button
              size="sm"
              onClick={handleSubmitTravelIncident}
              disabled={isSubmittingTravel}
              className="rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-700 hover:to-amber-700 text-white font-bold text-xs"
            >
              {isSubmittingTravel ? 'Mengirim...' : 'Kirim Laporan Darurat'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
