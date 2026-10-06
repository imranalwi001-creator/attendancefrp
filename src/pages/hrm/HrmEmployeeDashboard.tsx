import React, { useState, useEffect, useRef } from 'react';
import { useHrmAuth } from '@/contexts/HrmAuthContext';
import { hrmService, calculateDistanceMeters, getTodayDateStr } from '@/services/hrmService';
import { AttendanceRecord, OfficeLocation, Shift, OvertimeRecord, HrmNotification, EmployeeSchedule, isMobileOnlineOfficer } from '@/types/hrm';
import {
  Clock,
  MapPin,
  Camera,
  CalendarCheck2,
  AlertTriangle,
  CheckCircle2,
  CalendarDays,
  Sparkles,
  ArrowUpRight,
  RotateCw,
  FileText,
  AlertCircle,
  ShieldCheck,
  QrCode,
  Smartphone,
  Lock,
  Unlock,
  Bell,
  Check,
  Send,
  Timer,
  Briefcase,
  ChevronRight,
  Info,
  SwitchCamera,
  X,
  Monitor,
  Tablet,
  Download,
  DownloadCloud,
  ScanFace,
  ShieldAlert,
  Activity,
  UserCheck,
  CreditCard,
  Printer,
  Share2,
  Copy,
  ExternalLink,
  Navigation,
  PenTool,
  UploadCloud,
  Trash2,
  Image as ImageIcon,
  Radio,
  Coffee,
  AlertOctagon,
} from 'lucide-react';
import { toast } from 'sonner';
import { livenessEngine, LivenessPhase } from '@/services/livenessEngine';
import { biometricService, BiometricMatchResult } from '@/services/biometricService';
import { geofenceService, GeofenceEvaluation, AntiSpoofResult } from '@/services/geofenceService';
import { HrmFaceEnrollmentModal } from '@/components/hrm/HrmFaceEnrollmentModal';
import { HrmSpotCheckModal } from '@/components/hrm/HrmSpotCheckModal';
import { fieldSentinelService } from '@/services/fieldSentinelService';
import { PwaInstallPrompt } from '@/components/hrm/PwaInstallPrompt';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Link } from 'react-router-dom';
import { HrmPwaAttendanceView } from '@/components/hrm/HrmPwaAttendanceView';

export const HrmEmployeeDashboard: React.FC = () => {
  const { user, refreshUser } = useHrmAuth();

  // Standalone PWA Mode Detection (Lampiran 2 & 3 eksklusif untuk PWA terinstall)
  const isPwaStandalone = React.useMemo(() => {
    if (typeof window === 'undefined') return false;
    const urlParams = new URLSearchParams(window.location.search);
    return Boolean(
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://') ||
      urlParams.get('source') === 'pwa' ||
      urlParams.get('mode') === 'app' ||
      localStorage.getItem('hrm_pwa_mode') === 'true'
    );
  }, []);

  if (isPwaStandalone) {
    return (
      <HrmPwaAttendanceView
        onSwitchToDesktop={() => {
          localStorage.removeItem('hrm_pwa_mode');
          const url = new URL(window.location.href);
          url.searchParams.delete('source');
          url.searchParams.delete('mode');
          window.location.href = url.pathname;
        }}
      />
    );
  }

  // Real-time clock state
  const [currentTime, setCurrentTime] = useState(new Date());

  // Geolocation & Office data
  const [office, setOffice] = useState<OfficeLocation | null>(null);
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [coordsAccuracy, setCoordsAccuracy] = useState<number | null>(null);
  const [showGpsDetailModal, setShowGpsDetailModal] = useState(false);
  const [distanceToOffice, setDistanceToOffice] = useState<number | null>(null);
  const [geofenceEval, setGeofenceEval] = useState<GeofenceEvaluation | null>(null);
  const [locationStatus, setLocationStatus] = useState<'checking' | 'inside' | 'outside' | 'error'>('checking');
  const [locationError, setLocationError] = useState<string | null>(null);

  // Anti-fraud & Anti-GPS Spoofing security state
  const [isMockSuspected, setIsMockSuspected] = useState(false);
  const [antiSpoofResult, setAntiSpoofResult] = useState<AntiSpoofResult | null>(null);
  const [cameraSecurityWarning, setCameraSecurityWarning] = useState<string | null>(null);
  const previousPositionRef = useRef<{ lat: number; lng: number; timestamp: number } | null>(null);

  // Today's attendance & shift
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | undefined>(undefined);
  const [userShift, setUserShift] = useState<Shift | null>(null);
  const [todaySchedule, setTodaySchedule] = useState<EmployeeSchedule | null>(null);

  // Overtime state with Karu Signature and Early Finish Report
  const [todayApprovedOvertime, setTodayApprovedOvertime] = useState<OvertimeRecord | null>(null);
  const [userOvertimeRequests, setUserOvertimeRequests] = useState<OvertimeRecord[]>([]);
  const [overtimeModalOpen, setOvertimeModalOpen] = useState(false);
  const [overtimeHoursInput, setOvertimeHoursInput] = useState('2');
  const [overtimeReasonInput, setOvertimeReasonInput] = useState('');
  const [supervisorNameInput, setSupervisorNameInput] = useState('');
  const [hasSignature, setHasSignature] = useState(false);
  const [isDrawingSignature, setIsDrawingSignature] = useState(false);
  const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [submittingOvertime, setSubmittingOvertime] = useState(false);

  // Finish Overtime Early & Evidence Report States
  const [finishOvertimeModalOpen, setFinishOvertimeModalOpen] = useState(false);
  const [overtimeCompletionNotes, setOvertimeCompletionNotes] = useState('');
  const [overtimeProofPhotos, setOvertimeProofPhotos] = useState<string[]>([]);
  const [isSubmittingFinishOt, setIsSubmittingFinishOt] = useState(false);

  // In-App Notifications
  const [notifications, setNotifications] = useState<HrmNotification[]>([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [notifModalOpen, setNotifModalOpen] = useState(false);

  // Perimeter Watchdog & Disciplinary Breach Engine States
  const [perimeterBreachAlertOpen, setPerimeterBreachAlertOpen] = useState(false);
  const [breachDetail, setBreachDetail] = useState<{ distance: number; time: string } | null>(null);
  const [clarificationModalOpen, setClarificationModalOpen] = useState(false);
  const [clarificationReason, setClarificationReason] = useState('');
  const [submittingClarification, setSubmittingClarification] = useState(false);
  const consecutiveOutsideCountRef = useRef<number>(0);
  const isBreachReportedRef = useRef<boolean>(false);

  // Presensi Flow State (Face AI Biometrics & Geofence Instant Submit - No Barcode Required)
  const [cameraModalOpen, setCameraModalOpen] = useState(false); // Controls Fullscreen Selfie Viewfinder
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [actionType, setActionType] = useState<'clock_in' | 'clock_out'>('clock_in');
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [attendanceMessage, setAttendanceMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Biometric Master Face Enrollment & 1:1 Verification States
  const [faceEnrollmentModalOpen, setFaceEnrollmentModalOpen] = useState(false);
  const [biometricResult, setBiometricResult] = useState<BiometricMatchResult | null>(null);

  // Official Real Salary Slip States
  const [salarySlipModalOpen, setSalarySlipModalOpen] = useState(false);
  const [salarySlipData, setSalarySlipData] = useState<any>(null);
  const [loadingSlip, setLoadingSlip] = useState(false);
  const [slipCopied, setSlipCopied] = useState(false);

  // Multi-Device Collision & Employee Password Change States
  const currentDeviceFingerprint = hrmService.getDeviceFingerprint();
  const currentDeviceModel = hrmService.getDeviceModel();
  const isLegacyGenericId = user?.registeredDeviceId === 'DEV-HW-UUID-ANDROID-882910';
  const isBothAndroid = Boolean(
    (/Android/i.test(user?.deviceModel || '') || isLegacyGenericId) && 
    /Android/i.test(currentDeviceModel || '')
  );
  const isMultiDeviceDetected = Boolean(
    user?.registeredDeviceId && 
    user.registeredDeviceId !== currentDeviceFingerprint &&
    !isBothAndroid
  );

  const [isBindingDevice, setIsBindingDevice] = useState(false);
  const handleBindCurrentDevice = async () => {
    if (!user) return;
    setIsBindingDevice(true);
    try {
      const res = await hrmService.bindUserDevice(user.id, currentDeviceFingerprint, currentDeviceModel);
      if (res.success) {
        toast.success('Perangkat ini berhasil ditautkan sebagai perangkat resmi Anda.');
        refreshUser();
      } else {
        toast.error(res.message || 'Gagal menautkan perangkat');
      }
    } catch (e: any) {
      toast.error(e.message || 'Terjadi kesalahan sistem');
    } finally {
      setIsBindingDevice(false);
    }
  };

  // Seamless auto-sync for same physical Android device (e.g. Flutter APK to Web APK transition)
  useEffect(() => {
    if (user && isBothAndroid && user.registeredDeviceId && user.registeredDeviceId !== currentDeviceFingerprint) {
      console.info('[Security] Seamlessly synchronizing Android device binding on same physical device...');
      hrmService.bindUserDevice(user.id, currentDeviceFingerprint, currentDeviceModel).then(() => {
        refreshUser();
      }).catch(() => null);
    }
  }, [user?.id, user?.registeredDeviceId, isBothAndroid, currentDeviceFingerprint]);

  // Field Sentinel Spot-Check State
  const [spotCheckModalOpen, setSpotCheckModalOpen] = useState(false);
  const [spotCheckInstruction, setSpotCheckInstruction] = useState<string>('');

  useEffect(() => {
    const handleSpotCheck = (e: any) => {
      const detail = e?.detail;
      if (detail && (!detail.targetUserId || detail.targetUserId === user?.id)) {
        setSpotCheckInstruction(detail.message || 'Pimpinan meminta konfirmasi scan wajah ber-watermark di titik tugas sekarang.');
        setSpotCheckModalOpen(true);
      }
    };
    window.addEventListener('hrm_spot_check_requested', handleSpotCheck);
    return () => window.removeEventListener('hrm_spot_check_requested', handleSpotCheck);
  }, [user]);

  // ─── REKOMENDASI 1 & 2: EARLY LEAVE STATES ───
  const [earlyLeaveModalOpen, setEarlyLeaveModalOpen] = useState(false);
  const [earlyLeaveCategory, setEarlyLeaveCategory] = useState<'sakit_mendadak' | 'darurat_keluarga' | 'tugas_luar' | 'lainnya'>('sakit_mendadak');
  const [earlyLeaveReason, setEarlyLeaveReason] = useState('');
  const [isSubmittingEarlyLeave, setIsSubmittingEarlyLeave] = useState(false);

  // ─── FITUR JAM ISTIRAHAT 1 JAM (BREAK TIME POLICY) ───
  const [breakRemainingSeconds, setBreakRemainingSeconds] = useState<number>(0);
  const [breakWarningNotified, setBreakWarningNotified] = useState(false);
  const [breakExpiredNotified, setBreakExpiredNotified] = useState(false);
  const [isStartingBreak, setIsStartingBreak] = useState(false);
  const [isEndingBreak, setIsEndingBreak] = useState(false);

  // Break policy config from app settings
  const appSettings = hrmService.getAppSettings();
  const breakPolicyEnabled = appSettings.breakPolicyEnabled !== false;
  const breakDurationLimitMinutes = appSettings.breakDurationMinutes || 60;

  // Real-time Break Countdown Ticker
  useEffect(() => {
    if (!todayAttendance?.isOnBreak || !todayAttendance?.breakStartTime) {
      setBreakRemainingSeconds(0);
      setBreakWarningNotified(false);
      setBreakExpiredNotified(false);
      return;
    }

    const calcRemaining = () => {
      const startMs = new Date(todayAttendance.breakStartTime!).getTime();
      const totalAllowedSecs = breakDurationLimitMinutes * 60;
      const elapsedSecs = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
      const remaining = Math.max(0, totalAllowedSecs - elapsedSecs);
      setBreakRemainingSeconds(remaining);

      // Warning at <= 10 minutes (600s)
      if (remaining <= 600 && remaining > 0 && !breakWarningNotified) {
        setBreakWarningNotified(true);
        if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
        toast.warning('⚠️ Sisa waktu istirahat kurang dari 10 menit! Segera bersiap kembali ke lokasi tugas.');
      }

      // Expired at 0s
      if (remaining <= 0 && !breakExpiredNotified) {
        setBreakExpiredNotified(true);
        if ('vibrate' in navigator) navigator.vibrate([500, 200, 500, 200, 500]);
        toast.error('⏰ Waktu istirahat 1 jam telah berakhir! Silakan segera kembali ke pos dan akhiri masa istirahat.');
      }
    };

    calcRemaining();
    const interval = setInterval(calcRemaining, 1000);
    return () => clearInterval(interval);
  }, [todayAttendance?.isOnBreak, todayAttendance?.breakStartTime, breakDurationLimitMinutes, breakWarningNotified, breakExpiredNotified]);

  const handleStartBreak = async () => {
    if (!user) return;
    setIsStartingBreak(true);
    try {
      hrmService.startBreakTime(user.id);
      toast.success('Masa istirahat 1 jam dimulai! Anda dapat meninggalkan pos tanpa alarm perimeter.');
    } catch (err: any) {
      toast.error(err.message || 'Gagal memulai jam istirahat');
    } finally {
      setIsStartingBreak(false);
    }
  };

  const handleEndBreak = async () => {
    if (!user) return;
    setIsEndingBreak(true);
    try {
      hrmService.endBreakTime(user.id);
      toast.success('Masa istirahat selesai! Sistem pemantauan pos kembali aktif.');
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengakhiri masa istirahat');
    } finally {
      setIsEndingBreak(false);
    }
  };

  const handleConfirmEarlyLeave = async () => {
    if (!user) return;
    if (!earlyLeaveReason.trim()) {
      toast.error('Harap tuliskan alasan atau keterangan darurat.');
      return;
    }
    setIsSubmittingEarlyLeave(true);
    try {
      let curLat: number | undefined;
      let curLon: number | undefined;
      if (navigator.geolocation) {
        await new Promise<void>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              curLat = pos.coords.latitude;
              curLon = pos.coords.longitude;
              resolve();
            },
            () => resolve(),
            { timeout: 4000 }
          );
        });
      }

      hrmService.recordEarlyLeave({
        userId: user.id,
        category: earlyLeaveCategory,
        reason: earlyLeaveReason.trim(),
        latitude: curLat,
        longitude: curLon,
        photoUrl: user.avatarUrl || user.faceEnrolledPhoto,
        geofenceValid: true,
      });

      toast.success('Presensi Pulang Awal Darurat berhasil! Laporan resmi terkirim via Aplikasi & WhatsApp ke Pimpinan.');
      setEarlyLeaveModalOpen(false);
      setEarlyLeaveReason('');
    } catch (err: any) {
      toast.error(err.message || 'Gagal memproses pulang awal darurat');
    } finally {
      setIsSubmittingEarlyLeave(false);
    }
  };

  const [changePasswordModalOpen, setChangePasswordModalOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordChangeMessage, setPasswordChangeMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleChangePasswordSubmit = async () => {
    if (!user) return;
    if (!newPassword || newPassword.length < 6) {
      setPasswordChangeMessage({ type: 'error', text: 'Kata sandi baru minimal 6 karakter.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordChangeMessage({ type: 'error', text: 'Konfirmasi kata sandi baru tidak sesuai.' });
      return;
    }
    setIsChangingPassword(true);
    setPasswordChangeMessage(null);
    try {
      const res = await hrmService.changePassword(user.id, oldPassword, newPassword);
      if (res.success) {
        setPasswordChangeMessage({ type: 'success', text: 'Kata sandi berhasil diperbarui!' });
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => {
          setChangePasswordModalOpen(false);
          setPasswordChangeMessage(null);
        }, 1500);
      } else {
        setPasswordChangeMessage({ type: 'error', text: res.error || 'Gagal mengubah kata sandi' });
      }
    } catch (err: any) {
      setPasswordChangeMessage({ type: 'error', text: err.message || 'Terjadi kesalahan sistem' });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleOpenSalarySlip = async () => {
    if (!user) return;
    setLoadingSlip(true);
    setSalarySlipModalOpen(true);
    try {
      const data = await hrmService.fetchUserSalarySlip(user.id);
      setSalarySlipData(data);
    } catch {
      // fallback
    } finally {
      setLoadingSlip(false);
    }
  };

  const handleShareSlipText = () => {
    if (!salarySlipData) return;
    const s = salarySlipData;
    const text = `📄 *SLIP GAJI RESMI - PT. FAWWAZ RESKI PERWIRA*\n` +
      `No Dokumen : ${s.id || '-'}\n` +
      `Periode     : ${s.period || '-'}\n` +
      `Karyawan    : ${s.employee?.name || user?.fullName}\n` +
      `NIP         : ${s.employee?.nip || user?.nip || '-'}\n` +
      `Divisi      : ${s.employee?.division || user?.divisionName || '-'}\n` +
      `Rekening    : ${s.employee?.bankName || '-'} (${s.employee?.bankAccount || '-'})\n` +
      `Kehadiran   : ${s.employee?.presentDays || 0} Hari | Lembur: ${s.employee?.overtimeHours || 0} Jam\n\n` +
      `💵 *Take Home Pay (THP):* Rp ${Number(s.netSalary || 0).toLocaleString('id-ID')}\n` +
      `Status: ${s.status || 'DISETUJUI'}\n` +
      `Terbilang: ${s.netSalaryTerbilang || '-'}`;
    navigator.clipboard.writeText(text);
    setSlipCopied(true);
    setTimeout(() => setSlipCopied(false), 3000);
  };

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hudCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Active Liveness & Anti-Spoofing States (Distance Challenge)
  const [livenessPhase, setLivenessPhase] = useState<LivenessPhase>('idle');
  const [livenessProgress, setLivenessProgress] = useState<number>(0);
  const [livenessMessage, setLivenessMessage] = useState<string>('Posisikan wajah Anda di dalam lingkaran');
  const [chromaticFlash, setChromaticFlash] = useState<boolean>(false);
  const isLivenessCapturingRef = useRef<boolean>(false);
  const takeSnapshotRef = useRef<() => void>(() => {});

  // Emergency Quota Sanitizer on Dashboard Mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem('hrm_attendance');
      if (raw && (raw.includes('data:image/') || raw.length > 30000)) {
        console.warn('[Dashboard] Quota protection: pruning bloated hrm_attendance...');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const lean = parsed.slice(0, 10).map(({ photoIn, clockInPhoto, photoOut, clockOutPhoto, ...r }: any) => r);
          localStorage.setItem('hrm_attendance', JSON.stringify(lean));
        } else {
          localStorage.removeItem('hrm_attendance');
        }
      }
    } catch {
      try { localStorage.removeItem('hrm_attendance'); } catch (_) {}
    }
  }, []);

  // Preload Face-API AI Neural Network models on dashboard mount
  useEffect(() => {
    biometricService.loadModels().catch(() => {});
  }, []);

  // Hook to ensure video element binds to stream when camera modal mounts
  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream, cameraModalOpen]);

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch initial data & auto-lock expired
  const loadAttendanceData = () => {
    if (!user) return;

    // Check & trigger auto-lock for yesterday or forgotten attendances
    hrmService.autoLockExpiredAttendances();

    const divLoc = hrmService.getDivisionLocation(user.divisionId);
    setOffice({
      id: 'div-loc',
      name: divLoc.name,
      address: divLoc.address,
      latitude: divLoc.latitude,
      longitude: divLoc.longitude,
      radiusMeters: divLoc.radiusMeters,
      isActive: true,
    });

    const shifts = hrmService.getShifts();
    const todayStr = getTodayDateStr();
    const dailySched = hrmService.getEmployeeTodaySchedule(user.id, todayStr);
    setTodaySchedule(dailySched);

    if (dailySched && !dailySched.isOff) {
      setUserShift({
        id: dailySched.shiftId || `sched-${dailySched.shiftCode}`,
        code: dailySched.shiftCode,
        name: dailySched.shiftName,
        startTime: dailySched.startTime,
        endTime: dailySched.endTime,
        lateToleranceMinutes: 15,
        isCrossDay: dailySched.isNightShift,
        colorTag: dailySched.shiftCode === 'P' ? '#3b82f6' : dailySched.shiftCode === 'S' ? '#f59e0b' : '#8b5cf6',
      });
    } else {
      const shift = shifts.find((s) => s.id === user.shiftId) || shifts[0];
      setUserShift(shift);
    }

    const todayAtt = hrmService.getUserTodayAttendance(user.id);
    setTodayAttendance(todayAtt);

    // Load overtime
    const approvedOt = hrmService.getUserTodayApprovedOvertime(user.id);
    setTodayApprovedOvertime(approvedOt);

    const myOts = hrmService.getOvertimeRecords().filter((r) => r.userId === user.id && r.date === todayStr);
    setUserOvertimeRequests(myOts);

    // Load notifications
    const userNotifs = hrmService.getNotifications(user.id);
    setNotifications(userNotifs);
    setUnreadNotifCount(userNotifs.filter((n) => !n.isRead).length);
  };

  useEffect(() => {
    hrmService.syncWithBackend().finally(() => {
      loadAttendanceData();
      fetchUserLocation();
    });

    const handleNotifUpdate = () => {
      if (user) {
        const userNotifs = hrmService.getNotifications(user.id);
        setNotifications(userNotifs);
        setUnreadNotifCount(userNotifs.filter((n) => !n.isRead).length);
      }
    };

    window.addEventListener('hrm_notifications_updated', handleNotifUpdate);
    window.addEventListener('hrm_overtime_updated', loadAttendanceData);
    window.addEventListener('hrm_attendance_updated', loadAttendanceData);
    window.addEventListener('hrm_schedules_updated', loadAttendanceData);

    return () => {
      window.removeEventListener('hrm_notifications_updated', handleNotifUpdate);
      window.removeEventListener('hrm_overtime_updated', loadAttendanceData);
      window.removeEventListener('hrm_attendance_updated', loadAttendanceData);
      window.removeEventListener('hrm_schedules_updated', loadAttendanceData);
    };
  }, [user]);

  // Periodic Geofence Perimeter Watchdog (Active during shift when employee clocked in, not clocked out, and not on break)
  useEffect(() => {
    if (!user || !todayAttendance?.clockIn || todayAttendance?.clockOut || todayAttendance?.isOnBreak || todayAttendance?.isEarlyLeave) {
      consecutiveOutsideCountRef.current = 0;
      return;
    }

    if (todayAttendance.isLocked || todayAttendance.isPerimeterBreached) {
      isBreachReportedRef.current = true;
    } else {
      isBreachReportedRef.current = false;
    }

    const checkPerimeter = () => {
      if (!navigator.geolocation) return;
      const assignedLoc = (user.assignedLatitude && user.assignedLongitude)
        ? {
            id: 'assigned-loc',
            name: user.assignedLocationName || 'Titik Tugas Khusus',
            latitude: user.assignedLatitude,
            longitude: user.assignedLongitude,
            radiusMeters: user.assignedRadiusMeters || 150,
            locationName: user.assignedLocationName || 'Titik Tugas Khusus',
            address: user.assignedLocationName || 'Titik Tugas Khusus',
          }
        : null;
      const divLoc = assignedLoc || hrmService.getDivisionLocation(user.divisionId);
      if (!divLoc) return;

      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          const todayStr = getTodayDateStr();
          const hasPermit = hrmService.isUserOnApprovedPermit(user.id, todayStr);

          // Continuous Field Sentinel Background GPS Ping to Server
          if (user.isFieldSentinelEnabled || ['aslamfaisal10okt@gmail.com', 'abangelsamsi@gmail.com', 'mtakdir46@gmail.com'].includes(user.email.toLowerCase())) {
            fieldSentinelService.sendLocationPing({
              userId: user.id,
              latitude: coords.lat,
              longitude: coords.lng,
              accuracy: pos.coords.accuracy || 5,
              isMockLocation: Boolean((pos.coords as any).isMock),
            }).catch(() => null);
          }

          const watchdogEval = geofenceService.evaluateWatchdogTick({
            coords,
            officeLoc: divLoc,
            hasClockedIn: Boolean(todayAttendance.clockIn),
            hasClockedOut: Boolean(todayAttendance.clockOut),
            hasApprovedPermit: hasPermit,
            consecutiveOutsideCount: consecutiveOutsideCountRef.current,
            graceThresholdCount: 2,
          });

          consecutiveOutsideCountRef.current = watchdogEval.consecutiveOutsideCount;

          if (watchdogEval.shouldTriggerBreach && !isBreachReportedRef.current) {
            isBreachReportedRef.current = true;
            const dist = Math.round(watchdogEval.distanceMeters);
            const nowTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
            setBreachDetail({ distance: dist, time: nowTime });
            setPerimeterBreachAlertOpen(true);

            // Audio / Haptic alert for mobile
            if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
              try { navigator.vibrate([300, 150, 300, 150, 600]); } catch (e) {}
            }

            // Web Push notification (if granted)
            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              try {
                new Notification('⚠️ PELANGGARAN PERIMETER KERJA', {
                  body: `Anda terdeteksi meninggalkan radius kantor (${dist}m) saat jam kerja. Presensi kepulangan otomatis dikunci.`,
                  icon: '/favicon.ico',
                });
              } catch (e) {}
            }

            // Report breach to backend & PostgreSQL
            try {
              await hrmService.reportPerimeterBreach({
                userId: user.id,
                attendanceId: todayAttendance.id,
                divisionId: user.divisionId,
                distanceMeters: dist,
                latitude: coords.lat,
                longitude: coords.lng,
                durationOutsideMinutes: 1,
                notes: `Terdeteksi meninggalkan perimeter kantor ${user.divisionName || ''} sejauh ${dist}m pada jam kerja tanpa surat dinas/izin resmi.`,
              });
            } catch (err) {
              console.error('Failed reporting perimeter breach:', err);
            }

            loadAttendanceData();
          }
        },
        () => {},
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    };

    // Evaluate location perimeter watchdog every 20 seconds
    const interval = setInterval(checkPerimeter, 20000);
    return () => clearInterval(interval);
  }, [user, todayAttendance?.clockIn, todayAttendance?.clockOut, todayAttendance?.isLocked, todayAttendance?.isPerimeterBreached, todayAttendance?.isOnBreak, todayAttendance?.isEarlyLeave]);

  // Check Geolocation against Division-specific coordinates via Enterprise Geofence Service
  const fetchUserLocation = () => {
    setLocationStatus('checking');
    setLocationError(null);

    const assignedLoc = (user?.assignedLatitude && user?.assignedLongitude)
      ? {
          id: 'assigned-loc',
          name: user.assignedLocationName || 'Titik Tugas Khusus',
          latitude: user.assignedLatitude,
          longitude: user.assignedLongitude,
          radiusMeters: user.assignedRadiusMeters || 150,
          locationName: user.assignedLocationName || 'Titik Tugas Khusus',
          address: user.assignedLocationName || 'Titik Tugas Khusus',
        }
      : null;
    const divLoc = assignedLoc || hrmService.getDivisionLocation(user?.divisionId);

    if (!navigator.geolocation) {
      setLocationStatus('error');
      setLocationError('Perangkat Anda tidak mendukung geolokasi GPS.');
      return;
    }

    const processPosition = (pos: GeolocationPosition) => {
      const { latitude, longitude, accuracy } = pos.coords;
      setCurrentCoords({ lat: latitude, lng: longitude });
      setCoordsAccuracy(accuracy || null);

      // Anti-Mock GPS & Teleportation Analysis
      const spoofCheck = geofenceService.evaluateMockGPS(pos, previousPositionRef.current);
      setAntiSpoofResult(spoofCheck);
      setIsMockSuspected(spoofCheck.isMockSuspected);

      previousPositionRef.current = { lat: latitude, lng: longitude, timestamp: pos.timestamp || Date.now() };

      if (divLoc) {
        const evalResult = geofenceService.evaluateGeofence({ lat: latitude, lng: longitude }, divLoc);
        setGeofenceEval(evalResult);
        setDistanceToOffice(evalResult.distanceMeters);
        if (isMobileOnlineOfficer(user)) {
          setLocationStatus('inside');
        } else {
          setLocationStatus(evalResult.isInside ? 'inside' : 'outside');
        }
      }
    };

    // Try high accuracy GPS first (8 seconds timeout)
    navigator.geolocation.getCurrentPosition(
      processPosition,
      () => {
        // Fallback to standard/network accuracy (10 seconds timeout)
        navigator.geolocation.getCurrentPosition(
          processPosition,
          (err) => {
            console.warn('[GPS] Geolocation fallback error:', err);
            // Fallback simulation inside division location for local dev
            if (divLoc) {
              const fallbackCoords = { lat: divLoc.latitude, lng: divLoc.longitude };
              setCurrentCoords(fallbackCoords);
              const evalResult = geofenceService.evaluateGeofence(fallbackCoords, divLoc);
              setGeofenceEval(evalResult);
              setDistanceToOffice(evalResult.distanceMeters);
              setLocationStatus('inside');
            }
          },
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 30000 }
        );
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  };

  // Shared helper: applies the secure forensic dual-shield watermark on a canvas
  const applyForensicWatermark = (canvas: HTMLCanvasElement, biometricConfidence?: number) => {
    if (!user) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const deviceFp = hrmService.getDeviceFingerprint();

    const grad = ctx.createLinearGradient(0, h - 120, 0, h);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    grad.addColorStop(0.3, 'rgba(15, 23, 42, 0.88)');
    grad.addColorStop(1, 'rgba(15, 23, 42, 0.98)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, h - 120, w, 120);

    // Top Security Badge
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.fillRect(14, 14, 430, 32);

    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = '#10b981';
    const bioText = biometricConfidence != null ? ` • BIOMETRIC: ${biometricConfidence}% MATCH` : '';
    const geoText = geofenceEval ? ` • GEOFENCE: ${Math.round(geofenceEval.distanceMeters)}m (${geofenceEval.zone.toUpperCase()})` : '';
    ctx.fillText(`🛡️ DUAL-SHIELD GATE • ${actionType === 'clock_in' ? 'CLOCK-IN' : 'CLOCK-OUT'}${bioText}${geoText}`, 22, 34);

    // Employee Info
    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${user.fullName} (${user.nip}) • ${user.divisionName || 'Pusat'}`, 18, h - 70);

    // Atomic Time
    const timeStr = new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'medium' });
    ctx.font = '12px monospace';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(`🕒 ${timeStr} WIB`, 18, h - 46);

    // Geofence & Anti-Spoof coordinates
    const locStr = currentCoords
      ? `📍 GPS: ${currentCoords.lat.toFixed(5)}, ${currentCoords.lng.toFixed(5)} (${distanceToOffice ? `${Math.round(distanceToOffice)}m` : 'Area OK'} - ${geofenceEval?.cardinalDirection || 'Pusat'})`
      : '📍 GPS: Area Terverifikasi';
    ctx.fillStyle = isMockSuspected ? '#f87171' : '#34d399';
    ctx.fillText(locStr, 18, h - 22);

    ctx.font = '11px monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'right';
    const spoofLabel = isMockSuspected ? 'MOCK_ALERT' : 'GPS_HW_OK';
    ctx.fillText(`ANTI-SPOOF: ${spoofLabel} • DEV: ${(deviceFp || '').slice(0, 10)}`, w - 18, h - 22);
    ctx.textAlign = 'left';
  };

  // Start or switch camera stream with specified facingMode and multi-level fallback
  const startCameraStream = async (mode: 'user' | 'environment') => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setCameraError(null);
    setCameraSecurityWarning(null);

    const isHttps = typeof window !== 'undefined' && (
      window.location.protocol === 'https:' ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1'
    );

    const hasGetUserMedia = Boolean(navigator?.mediaDevices?.getUserMedia);

    if (!hasGetUserMedia) {
      if (!isHttps) {
        setCameraError(
          'Kamera browser memerlukan protokol aman (HTTPS). Ketuk tombol Buka Mode HTTPS di bawah.'
        );
      } else {
        setCameraError(
          'Kamera peramban tidak terdeteksi atau diblokir. Harap aktifkan izin kamera pada peramban Anda.'
        );
      }
      return;
    }

    try {
      let stream: MediaStream | null = null;
      // Tingkat 1: Coba dengan orientasi ideal dan resolusi standar
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
      } catch (e1) {
        console.warn('[Camera] Fallback Level 1 (ideal mode)', e1);
        try {
          // Tingkat 2: Coba dengan facingMode sederhana
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: mode },
          });
        } catch (e2) {
          console.warn('[Camera] Fallback Level 2 (basic video)', e2);
          // Tingkat 3: Coba kamera default apapun yang tersedia di perangkat
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }
      }

      if (stream) {
        setCameraStream(stream);

        const track = stream.getVideoTracks()[0];
        const trackLabel = (track?.label || '').toLowerCase();
        if (/obs|virtual|manycam|fake|v4l2/i.test(trackLabel)) {
          setCameraSecurityWarning('⚠️ Peringatan: Kamera virtual terdeteksi! Harap gunakan kamera fisik perangkat.');
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch((e) => console.warn('[Camera] Autoplay error:', e));
          };
          videoRef.current.play().catch((e) => console.warn('[Camera] Play error:', e));
        }
      }
    } catch (err: any) {
      console.error('[Camera] Stream initialization error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Izin akses kamera diblokir oleh peramban. Harap izinkan kamera pada pengaturan situs browser Anda.');
      } else if (!isHttps) {
        setCameraError('Kamera browser memerlukan protokol aman (HTTPS). Ketuk tombol Buka Mode HTTPS di bawah.');
      } else {
        setCameraError('Kamera tidak dapat diakses. Pastikan kamera tidak sedang dipakai aplikasi lain.');
      }
    }
  };

  // Open Presensi modal (triggers immersive full-screen selfie)
  const handleOpenAttendanceModal = async (type: 'clock_in' | 'clock_out') => {
    // Enforce Master Face Enrollment
    if (!user?.isFaceEnrolled) {
      setFaceEnrollmentModalOpen(true);
      return;
    }

    // If clock in, enforce inside area
    if (type === 'clock_in' && locationStatus !== 'inside') {
      setAttendanceMessage({
        type: 'error',
        text: 'Presensi Masuk diblokir! Anda harus berada di dalam area kerja divisi terlebih dahulu.',
      });
      return;
    }

    // CHECK IF CHECKOUT IS LOCKED DUE TO PERIMETER BREACH
    if (type === 'clock_out' && (todayAttendance?.isLocked || todayAttendance?.isPerimeterBreached)) {
      setAttendanceMessage({
        type: 'error',
        text: 'Presensi Pulang Terkunci! Terdeteksi pelanggaran perimeter kerja (meninggalkan area kantor sebelum jam kepulangan tanpa izin resmi). Harap hubungi HRD/Pimpinan untuk verifikasi dan pembukaan kunci.',
      });
      setClarificationModalOpen(true);
      return;
    }

    setActionType(type);
    setPhotoDataUrl(null);
    setBiometricResult(null);
    setCameraModalOpen(true);

    // Reset Liveness Engine
    livenessEngine.reset();
    setLivenessPhase('idle');
    setLivenessProgress(0);
    setLivenessMessage('Posisikan wajah Anda di dalam lingkaran');
    isLivenessCapturingRef.current = false;

    await startCameraStream(facingMode);
  };

  // Toggle front and back camera (Switch Camera)
  const handleToggleFacingMode = async () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    if (!photoDataUrl) {
      livenessEngine.reset();
      setLivenessPhase('idle');
      setLivenessProgress(0);
      isLivenessCapturingRef.current = false;
      await startCameraStream(nextMode);
    }
  };

  // Retake photo
  const handleRetakePhoto = async () => {
    setPhotoDataUrl(null);
    setBiometricResult(null);
    livenessEngine.reset();
    setLivenessPhase('idle');
    setLivenessProgress(0);
    setLivenessMessage('Posisikan wajah Anda di dalam lingkaran');
    isLivenessCapturingRef.current = false;
    await startCameraStream(facingMode);
  };

  // Stop and close camera stream
  const handleCloseCameraModal = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    livenessEngine.reset();
    setLivenessPhase('idle');
    setLivenessProgress(0);
    isLivenessCapturingRef.current = false;
    setCameraModalOpen(false);
  };

  // Capture snapshot with 1:1 Biometric Verification, Forensic Watermark & Direct Auto-Submit
  const takeSnapshot = async () => {
    if (videoRef.current && user) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 1280;
      canvas.height = videoRef.current.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Mirror if front camera
        if (facingMode === 'user') {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        if (facingMode === 'user') {
          ctx.setTransform(1, 0, 0, 1, 0, 0);
        }

        // 1:1 Biometric Evaluation against Master Template
        let matchResult: BiometricMatchResult | null = null;
        if (user.isFaceEnrolled && user.faceDescriptor && Array.isArray(user.faceDescriptor) && user.faceDescriptor.length === 128) {
          const liveDesc = await biometricService.extractFaceDescriptor(canvas);
          if (liveDesc) {
            matchResult = biometricService.evaluateBiometricMatch(liveDesc, user.faceDescriptor);
            setBiometricResult(matchResult);
          }
        }

        applyForensicWatermark(canvas, matchResult?.confidence);
        const capturedPhoto = canvas.toDataURL('image/jpeg', 0.9);
        setPhotoDataUrl(capturedPhoto);

        // Stop camera stream once captured
        if (cameraStream) {
          cameraStream.getTracks().forEach((track) => track.stop());
          setCameraStream(null);
        }

        // Instant Submit: If biometric match is valid (or user not enrolled) and location is valid, auto-submit directly!
        if (matchResult && !matchResult.isMatch) {
          // Do not auto-submit if biometric mismatch
          return;
        }

        if (locationStatus === 'outside') {
          // Do not auto-submit if outside perimeter
          return;
        }

        // Auto-submit immediately without needing barcode scan!
        await handleSubmitAttendance(capturedPhoto, matchResult);
      }
    } else {
      console.warn('[Camera] videoRef stream tidak tersedia saat snapshot');
    }
  };

  // Keep ref synchronized
  takeSnapshotRef.current = takeSnapshot;

  // Active Liveness Analysis Loop (Real-time Frame Inspection)
  useEffect(() => {
    if (!cameraModalOpen || !cameraStream || photoDataUrl) {
      livenessEngine.reset();
      setLivenessPhase('idle');
      setLivenessProgress(0);
      isLivenessCapturingRef.current = false;
      return;
    }

    livenessEngine.reset();
    isLivenessCapturingRef.current = false;

    let active = true;
    const interval = setInterval(async () => {
      if (!active || !videoRef.current || isLivenessCapturingRef.current) return;
      try {
        const res = await livenessEngine.analyzeFrame(videoRef.current);
        if (!active) return;
        setLivenessPhase(res.phase);
        setLivenessProgress(res.progress);
        setLivenessMessage(res.message);

        // Render Tactical AI HUD onto overlay canvas
        if (hudCanvasRef.current) {
          if (hudCanvasRef.current.width !== 320) {
            hudCanvasRef.current.width = 320;
            hudCanvasRef.current.height = 240;
          }
          biometricService.drawTacticalHUD(
            hudCanvasRef.current,
            res.detail || null,
            res.phase === 'verified' ? true : null,
            res.phase === 'verified' ? '✓ TERVERIFIKASI' : 'AI LIVENESS'
          );
        }

        // Jika liveness berhasil diverifikasi, picu chromatic flash dan capture otomatis
        if (res.phase === 'verified' && !isLivenessCapturingRef.current) {
          isLivenessCapturingRef.current = true;
          setChromaticFlash(true);
          if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            try {
              navigator.vibrate([60, 40, 100]);
            } catch (e) {
              // Ignore if vibrate not allowed
            }
          }
          setTimeout(() => {
            if (active) {
              takeSnapshotRef.current();
              setChromaticFlash(false);
            }
          }, 400);
        }
      } catch (err) {
        console.warn('[Liveness] Frame analysis warning:', err);
      }
    }, 120);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [cameraModalOpen, cameraStream, photoDataUrl]);

  // Submit Presensi (Clock In or Out) with Direct Auto-Submit & Rolling Photo Overwrite
  const handleSubmitAttendance = async (overridePhoto?: string, overrideBio?: BiometricMatchResult | null) => {
    if (!user) return;
    setSubmitting(true);
    setAttendanceMessage(null);

    const activePhoto = overridePhoto || photoDataUrl;
    const activeBio = overrideBio !== undefined ? overrideBio : biometricResult;

    // Enforce 1:1 Biometric Match Check
    if (activeBio && !activeBio.isMatch) {
      setAttendanceMessage({
        type: 'error',
        text: `Presensi Ditolak! Wajah tidak cocok dengan Wajah Master karyawan (${activeBio.confidence}% kemiripan). Presensi dibatalkan demi integritas data.`,
      });
      setSubmitting(false);
      return;
    }

    // Pengecualian 3 Petugas Lapangan Khusus & 3 Petugas Distribusi Online Mobile
    const isExemptOfficer = [
      'aslamfaisal10okt@gmail.com',
      'abangelsamsi@gmail.com',
      'mtakdir46@gmail.com'
    ].includes((user.email || '').toLowerCase()) ||
    ['FRP 07065', 'FR.07.066', 'FRP.07.046', 'FR07065', 'FR07066', 'FR07046'].includes((user.nip || '').trim()) ||
    isMobileOnlineOfficer(user);

    // Cek keberadaan di Titik Pos OGS (-4.787904, 119.613399, radius 250m)
    const distToOgs = currentCoords
      ? geofenceService.calculateDistance(currentCoords, { latitude: -4.787904, longitude: 119.613399 })
      : 9999;
    const isAtOgs = distToOgs <= 250;

    // Aturan Khusus Pos OGS: Hanya sah untuk Ceklok Pulang bagi karyawan non-khusus
    if (!isExemptOfficer && isAtOgs && actionType === 'clock_in') {
      setAttendanceMessage({
        type: 'error',
        text: 'Presensi Masuk Ditolak! Titik Pos OGS khusus disetel hanya untuk Ceklok Pulang (Presensi Keluar). Silakan lakukan presensi masuk di titik kantor divisi Anda.',
      });
      toast.error('Pos OGS hanya diizinkan untuk Ceklok Pulang!');
      setSubmitting(false);
      return;
    }

    // Jika karyawan pulang di Pos OGS atau petugas mobile, izinkan presensi
    const effectiveLocationStatus = (isAtOgs && actionType === 'clock_out') || isMobileOnlineOfficer(user) ? 'inside' : locationStatus;

    // Enforce Geofence Perimeter Check
    if (effectiveLocationStatus === 'outside' && !isMobileOnlineOfficer(user)) {
      const dist = geofenceEval ? Math.round(geofenceEval.distanceMeters) : (distanceToOffice ? Math.round(distanceToOffice) : 0);
      setAttendanceMessage({
        type: 'error',
        text: `Presensi Ditolak! Anda berada di luar perimeter kantor divisi (${dist} meter). Harap berada di dalam area radius yang ditentukan.`,
      });
      setSubmitting(false);
      return;
    }

    // Enforce Mock-GPS Anti-Spoofing Check
    if (isMockSuspected) {
      setAttendanceMessage({
        type: 'error',
        text: 'Presensi Ditolak! Terdeteksi anomali GPS tiruan (Mock Location / Fake GPS). Sistem menolak presensi demi integritas audit.',
      });
      setSubmitting(false);
      return;
    }

    const deviceId = hrmService.getDeviceFingerprint();
    const flags: string[] = ['BIOMETRIC_SELFIE_WATERMARKED'];

    if (geofenceEval?.isInside || locationStatus === 'inside') {
      flags.push(`GEOFENCE_IN_VERIFIED_${Math.round(geofenceEval?.distanceMeters || distanceToOffice || 0)}M`);
    }
    if (antiSpoofResult?.anomalyFlags && antiSpoofResult.anomalyFlags.length > 0) {
      flags.push(...antiSpoofResult.anomalyFlags);
    }

    if (!cameraSecurityWarning) flags.push('HARDWARE_CAMERA_VERIFIED');
    if (activeBio?.isMatch) flags.push(`BIOMETRIC_MATCH_${activeBio.confidence}PCT`);

    try {
      if (actionType === 'clock_in') {
        const savedAtt = hrmService.recordClockIn({
          userId: user.id,
          latitude: currentCoords?.lat,
          longitude: currentCoords?.lng,
          photoUrl: activePhoto || undefined,
          deviceId,
          isMockSuspected,
          securityFlags: flags,
          biometricScore: activeBio?.confidence,
          biometricMatch: activeBio ? activeBio.isMatch : undefined,
          geofenceDistance: geofenceEval?.distanceMeters ?? distanceToOffice ?? undefined,
          geofenceValid: geofenceEval?.isInside ?? (locationStatus === 'inside'),
          isMockLocation: isMockSuspected,
        });
        setTodayAttendance(savedAtt);
        toast.success('Presensi Masuk Berhasil Direkam!');
        setAttendanceMessage({
          type: 'success',
          text: `Presensi Masuk Berhasil! Biometrik wajah (${activeBio ? `${activeBio.confidence}% cocok` : 'terverifikasi'}) dan radius perimeter lokasi valid. Foto tersimpan sebagai arsip review.`,
        });
      } else {
        const savedAtt = hrmService.recordClockOut({
          userId: user.id,
          latitude: currentCoords?.lat,
          longitude: currentCoords?.lng,
          photoUrl: activePhoto || undefined,
          deviceId,
          isMockSuspected,
          securityFlags: flags,
          biometricScore: activeBio?.confidence,
          biometricMatch: activeBio ? activeBio.isMatch : undefined,
          geofenceDistance: geofenceEval?.distanceMeters ?? distanceToOffice ?? undefined,
          geofenceValid: geofenceEval?.isInside ?? (locationStatus === 'inside'),
          isMockLocation: isMockSuspected,
        });
        setTodayAttendance(savedAtt);
        toast.success('Presensi Pulang Berhasil Direkam!');
        setAttendanceMessage({
          type: 'success',
          text: `Presensi Pulang Berhasil! Foto selfie kepulangan ${activeBio ? `(Biometrik ${activeBio.confidence}% cocok)` : ''} dan koordinat perimeter tersinkronisasi ke database.`,
        });
      }

      handleCloseCameraModal();
      loadAttendanceData();
      refreshUser();
    } catch (err: any) {
      if (err.message && (err.message.includes('quota') || err.message.includes('Quota'))) {
        try {
          localStorage.removeItem('hrm_attendance');
          console.warn('[Dashboard] QuotaExceededError auto-remediated by clearing hrm_attendance.');
        } catch (_) {}
      }
      setAttendanceMessage({ type: 'error', text: err.message || 'Gagal menyimpan presensi.' });
    } finally {
      setSubmitting(false);
    }
  };

  // Digital Signature Pad Handlers for Karu (Touch & Mouse Support)
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    setIsDrawingSignature(true);
    setHasSignature(true);
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingSignature) return;
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handlePointerUp = () => {
    setIsDrawingSignature(false);
  };

  const handleClearSignature = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  // Submit Overtime Request by Employee with Karu Name & Digital Signature
  const handleRequestOvertime = () => {
    if (!user) return;
    const hours = parseFloat(overtimeHoursInput);
    if (isNaN(hours) || hours <= 0 || hours > 8) {
      alert('Jumlah jam lembur harus antara 0.5 hingga 8 jam.');
      return;
    }
    if (!supervisorNameInput.trim()) {
      alert('Mohon masukkan Nama Kepala Regu (Karu) yang bertugas di lokasi.');
      return;
    }
    if (!hasSignature || !signatureCanvasRef.current) {
      alert('Mohon minta Kepala Regu membubuhkan paraf pada area tanda tangan digital.');
      return;
    }
    if (!overtimeReasonInput.trim()) {
      alert('Mohon isi alasan / rincian pekerjaan lembur Anda.');
      return;
    }

    const signatureData = signatureCanvasRef.current.toDataURL('image/png');

    setSubmittingOvertime(true);
    try {
      hrmService.requestOvertime({
        userId: user.id,
        hours,
        taskDescription: overtimeReasonInput.trim(),
        supervisorName: supervisorNameInput.trim(),
        supervisorSignature: signatureData,
      });
      setOvertimeModalOpen(false);
      setOvertimeReasonInput('');
      setSupervisorNameInput('');
      handleClearSignature();
      toast.success(`Pengajuan lembur ${hours} Jam telah dikirim dengan paraf Kepala Regu!`);
      setAttendanceMessage({
        type: 'success',
        text: `Pengajuan lembur ${hours} Jam (Karu: ${supervisorNameInput.trim()}) telah diajukan dengan verifikasi paraf untuk persetujuan resmi.`,
      });
      loadAttendanceData();
    } catch (err: any) {
      alert(err.message || 'Gagal mengajukan lembur.');
    } finally {
      setSubmittingOvertime(false);
    }
  };

  // Multi-Photo Upload Handler for Overtime Completion Evidence
  const handlePhotoUploadForOvertime = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (result) {
          setOvertimeProofPhotos((prev) => [...prev, result]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveProofPhoto = (index: number) => {
    setOvertimeProofPhotos((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Selesaikan Lembur & Laporkan Bukti Kerja (Early / Regular Finish)
  const handleFinishOvertimeSubmit = async () => {
    if (!todayApprovedOvertime) return;
    if (!overtimeCompletionNotes.trim()) {
      alert('Mohon isi keterangan atau status rincian hasil pekerjaan lembur.');
      return;
    }

    setIsSubmittingFinishOt(true);
    try {
      await hrmService.completeOvertimeWork(todayApprovedOvertime.id, {
        completionNotes: overtimeCompletionNotes.trim(),
        completionPhotos: overtimeProofPhotos,
      });
      toast.success('Pekerjaan lembur berhasil diakhiri! Tombol Presensi Pulang telah aktif.');
      setFinishOvertimeModalOpen(false);
      setOvertimeCompletionNotes('');
      setOvertimeProofPhotos([]);
      loadAttendanceData();
    } catch (err: any) {
      alert(err.message || 'Gagal mengakhiri lembur.');
    } finally {
      setIsSubmittingFinishOt(false);
    }
  };

  const hasClockedIn = Boolean(todayAttendance?.clockIn);
  const hasClockedOut = Boolean(todayAttendance?.clockOut);

  // Calculate clock out eligibility and auto-lock warning based on shift & overtime
  const { isTimeForClockOut, timeRemainingFormatted, isAutoLockWarning } = (() => {
    const parseTime = (timeStr?: any): { hours: number; minutes: number } | null => {
      if (!timeStr || typeof timeStr !== 'string') return null;
      const clean = timeStr.trim().replace('.', ':');
      const parts = clean.split(':').map(Number);
      if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        return { hours: parts[0], minutes: parts[1] };
      }
      return null;
    };

    // 1. Check if employee has an approved overtime today
    if (todayApprovedOvertime && todayApprovedOvertime.status === 'approved') {
      // If employee completed overtime early
      if (todayApprovedOvertime.overtimePhase === 'completed') {
        return { isTimeForClockOut: true, timeRemainingFormatted: 'Lembur Selesai', isAutoLockWarning: false };
      }

      // Overtime in progress: compute against scheduledEndTime or endTime
      const otTime = parseTime(todayApprovedOvertime.scheduledEndTime || todayApprovedOvertime.endTime);
      if (otTime) {
        const otEndTime = new Date(currentTime);
        otEndTime.setHours(otTime.hours, otTime.minutes, 0, 0);

        const otDiffMs = otEndTime.getTime() - currentTime.getTime();
        const isPastOtEnd = otDiffMs <= 0;

        let remainingOtStr = '';
        if (!isPastOtEnd) {
          const remSecs = Math.floor(otDiffMs / 1000);
          const hrs = Math.floor(remSecs / 3600);
          const mins = Math.floor((remSecs % 3600) / 60);
          const secs = remSecs % 60;
          remainingOtStr = `${hrs > 0 ? `${hrs}j ` : ''}${mins}m ${secs}d`;
        } else {
          remainingOtStr = 'Waktu Lembur Selesai';
        }

        return {
          isTimeForClockOut: isPastOtEnd,
          timeRemainingFormatted: remainingOtStr,
          isAutoLockWarning: false,
        };
      }
    }

    // 2. Normal Shift End Time Calculation
    const endTimeParts = parseTime(userShift?.endTime);
    if (!endTimeParts) {
      return { isTimeForClockOut: true, timeRemainingFormatted: '', isAutoLockWarning: false };
    }

    const shiftEndTime = new Date(currentTime);
    shiftEndTime.setHours(endTimeParts.hours, endTimeParts.minutes, 0, 0);

    const startTimeParts = parseTime(userShift?.startTime) || { hours: 8, minutes: 0 };
    if (userShift?.isCrossDay && endTimeParts.hours < startTimeParts.hours) {
      if (currentTime.getHours() >= startTimeParts.hours) {
        shiftEndTime.setDate(shiftEndTime.getDate() + 1);
      }
    }

    const diffMs = shiftEndTime.getTime() - currentTime.getTime();
    const isPastShiftEnd = diffMs <= 0;

    let remainingStr = '';
    if (!isPastShiftEnd) {
      const remainingSecs = Math.floor(diffMs / 1000);
      const hrs = Math.floor(remainingSecs / 3600);
      const mins = Math.floor((remainingSecs % 3600) / 60);
      remainingStr = `${hrs}j ${mins}m`;
    }

    const minsPastShiftEnd = Math.floor(-diffMs / (60 * 1000));
    const autoLockWarn = hasClockedIn && !hasClockedOut && minsPastShiftEnd >= 30 && minsPastShiftEnd < 90;

    return {
      isTimeForClockOut: isPastShiftEnd,
      timeRemainingFormatted: remainingStr,
      isAutoLockWarning: autoLockWarn,
    };
  })();

  const isLockedBreach = hasClockedIn && !hasClockedOut && Boolean(todayAttendance?.isLocked || todayAttendance?.isPerimeterBreached);

  const canClockIn = !hasClockedIn && locationStatus === 'inside';
  const isClockInBlockedLocation = !hasClockedIn && locationStatus !== 'inside';
  const isRemoteUnlocked = Boolean(todayAttendance?.isRemoteUnlocked);
  const isWaitingClockOut = hasClockedIn && !hasClockedOut && !isTimeForClockOut && !isRemoteUnlocked && !isLockedBreach;
  const canClockOut = hasClockedIn && !hasClockedOut && (isTimeForClockOut || isRemoteUnlocked) && !isLockedBreach;
  const isCompleted = hasClockedIn && hasClockedOut;

  // Monthly stats
  const allUserAttendances = hrmService.getAttendances().filter((a) => a.userId === user?.id);
  const presentCount = allUserAttendances.filter((a) => a.status === 'hadir' || a.status === 'terlambat').length;
  const lateCount = allUserAttendances.filter((a) => a.status === 'terlambat').length;
  const totalLateMins = allUserAttendances.reduce((sum, a) => sum + (a.lateMinutes || 0), 0);
  // Kuota cuti: 12 reguler + 2 bonus = 14 total (sinkron dari database)
  const annualLeaveQuota = user?.annualLeaveQuota || 14;
  const remainingLeave = annualLeaveQuota - (user?.usedLeaveDays || 0);

  const formatDateIndonesian = (date: Date) => {
    return date.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* ─── 0. PWA INSTALL PROMPT & APP READINESS BANNER ─── */}
      <PwaInstallPrompt />

      {/* ─── PROMINENT PWA INSTALL CALLOUT (UNTUK PENGGUNA AKSES VIA BROWSER DOMAIN) ─── */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white p-3.5 sm:p-4 rounded-2xl shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0">
            <Smartphone className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-bold leading-tight">Pasang Aplikasi PWA Presensi</p>
            <p className="text-[11px] sm:text-xs text-white/80 leading-tight">
              Dapatkan tampilan presensi mandiri Lampiran 2 langsung di Layar Utama HP tanpa browser
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            onClick={() => {
              const promptEvent = (window as any).__pwaInstallPrompt;
              if (promptEvent) {
                promptEvent.prompt();
              } else {
                localStorage.setItem('hrm_pwa_mode', 'true');
                window.location.href = '/dashboard?source=pwa';
              }
            }}
            className="bg-white text-emerald-800 hover:bg-white/90 text-xs font-bold rounded-xl h-8 px-3.5 shadow-xs gap-1.5"
          >
            <DownloadCloud className="w-3.5 h-3.5" />
            Install PWA
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              localStorage.setItem('hrm_pwa_mode', 'true');
              window.location.href = '/dashboard?source=pwa';
            }}
            className="bg-emerald-700/60 hover:bg-emerald-700 text-white border-white/30 text-xs font-medium rounded-xl h-8 px-2.5"
            title="Buka Tampilan PWA Presensi Langsung"
          >
            Buka PWA
          </Button>
        </div>
      </div>

      {/* ─── TOP STATUS & QUICK ACCESS BAR (ICON-DRIVEN & MINIMALIST) ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 bg-card border border-border rounded-xl shadow-2xs">
        {/* Geolocation Status Chip */}
        <div className="flex items-center gap-2 flex-wrap min-w-0 flex-1">
          <div
            onClick={() => setShowGpsDetailModal(true)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all truncate max-w-full cursor-pointer hover:opacity-90 ${
              locationStatus === 'inside'
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                : locationStatus === 'outside'
                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
            }`}
            title="Klik untuk melihat detail koordinat GPS"
          >
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">
              {locationStatus === 'inside'
                ? `${office?.name || user?.divisionName} (${distanceToOffice !== null ? `${Math.round(distanceToOffice)}m` : '0m'})`
                : locationStatus === 'outside'
                ? `Di Luar Radius (${distanceToOffice !== null ? `${Math.round(distanceToOffice)}m` : '0m'})`
                : 'Mencari Lokasi...'}
            </span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              hrmService.syncWithBackend().finally(() => {
                loadAttendanceData();
                fetchUserLocation();
              });
              toast.info('Memperbarui sinyal GPS...');
            }}
            className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted shrink-0"
            title="Perbarui GPS"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </Button>

          {/* Quick display of detected coordinates */}
          {currentCoords && (
            <button
              type="button"
              onClick={() => setShowGpsDetailModal(true)}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-mono bg-muted/60 hover:bg-muted text-foreground border border-border/70 transition-colors cursor-pointer"
              title="Klik untuk melihat detail & salin koordinat"
            >
              <Navigation className="w-3 h-3 text-primary shrink-0" />
              <span>{currentCoords.lat.toFixed(5)}, {currentCoords.lng.toFixed(5)}</span>
              {coordsAccuracy && <span className="text-[10px] text-muted-foreground">±{Math.round(coordsAccuracy)}m</span>}
            </button>
          )}

          {user?.originalDivisionId && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs border border-blue-500/20 font-medium">
              <Info className="w-3.5 h-3.5" />
              <span>Mutasi: {user.divisionName}</span>
            </span>
          )}

          {user?.isFieldSentinelEnabled && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs border border-indigo-500/20 font-medium">
                <Radio className="w-3.5 h-3.5 animate-pulse text-indigo-600 dark:text-indigo-400" />
                <span>Pos: {user.assignedLocationName || 'Titik Khusus'} ({user.assignedRadiusMeters || 150}m)</span>
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSpotCheckModalOpen(true)}
                className="h-7 text-xs px-2.5 rounded-lg border-primary/30 text-primary hover:bg-primary/10 gap-1 font-semibold shadow-2xs"
                title="Lakukan konfirmasi scan wajah ber-watermark sekarang"
              >
                <Camera className="w-3.5 h-3.5" />
                Lapor Wajah Titik
              </Button>
            </div>
          )}
        </div>

        {/* Quick Actions (Kios & Notif: only shown on desktop/tablet since mobile navbar has them) */}
        <div className="hidden sm:flex items-center gap-1.5 self-end sm:self-center shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setChangePasswordModalOpen(true)}
            className="h-8 px-2.5 text-xs rounded-lg gap-1.5 border-border hover:bg-muted text-muted-foreground hover:text-foreground font-medium"
            title="Ganti Kata Sandi Akun"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Ganti Sandi</span>
          </Button>
          <Link to="/kios">
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2.5 text-xs rounded-lg gap-1.5 border-border hover:bg-muted text-muted-foreground hover:text-foreground font-medium"
              title="Buka Kios Presensi Lobi"
            >
              <Tablet className="w-3.5 h-3.5" />
              <span>Kios Lobi</span>
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setNotifModalOpen(true)}
            className="relative h-8 w-8 p-0 rounded-lg border-border text-muted-foreground hover:text-foreground"
            title="Notifikasi"
          >
            <Bell className="w-3.5 h-3.5" />
            {unreadNotifCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
                {unreadNotifCount}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* ─── MULTI-DEVICE ACCESS NOTICE BANNER ─── */}
      {isMultiDeviceDetected && (
        <Alert className="rounded-2xl border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100 shadow-xs">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
          <AlertTitle className="text-xs font-bold uppercase tracking-wider flex items-center justify-between flex-wrap gap-2">
            <span>⚠️ Peringatan Keamanan: Terdeteksi Akses Multi-Perangkat</span>
            <Badge variant="outline" className="bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40 text-[10px]">
              Notice Keamanan
            </Badge>
          </AlertTitle>
          <AlertDescription className="text-xs mt-1 space-y-2">
            <p>
              Akun Anda terikat pada <strong>{user?.deviceModel || 'Perangkat Utama'}</strong>, namun aplikasi saat ini terdeteksi dibuka pada perangkat berbeda (<strong>{currentDeviceModel}</strong>). Sesuai kebijakan keamanan PT. Fawwaz Reski Perwira, dilarang keras membagikan akun untuk presensi titipan. Jika Anda merasa akun Anda diakses orang lain, segera ganti kata sandi.
            </p>
            <div className="flex items-center flex-wrap gap-2 pt-1">
              <Button
                size="sm"
                variant="default"
                disabled={isBindingDevice}
                onClick={handleBindCurrentDevice}
                className="rounded-xl text-xs h-8 px-3 font-semibold bg-amber-600 hover:bg-amber-700 text-white shadow-xs"
              >
                {isBindingDevice ? 'Menautkan...' : 'Tautkan ke Perangkat Ini'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setChangePasswordModalOpen(true)}
                className="rounded-xl text-xs h-8 px-3 font-semibold border-amber-500/40 bg-background text-amber-800 dark:text-amber-200 hover:bg-amber-500/20"
              >
                Ganti Kata Sandi Sekarang
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* ─── 2. MUTATION / TEMPORARY ASSIGNMENT NOTICE (IF REASSIGNED BY ADMIN) ─── */}
      {user?.originalDivisionId && (
        <Alert className="bg-blue-50/80 dark:bg-blue-950/50 border-blue-300 dark:border-blue-800/70 text-blue-950 dark:text-blue-100 rounded-2xl">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertTitle className="text-xs font-bold flex items-center gap-2">
            <span>Status Penugasan / Mutasi Kerja Aktif</span>
            <Badge variant="outline" className="text-[10px] bg-blue-100 dark:bg-blue-900 border-blue-300">
              Penugasan Khusus
            </Badge>
          </AlertTitle>
          <AlertDescription className="text-xs mt-1">
            Anda saat ini dialihkan ke <strong>{user.divisionName}</strong> dari divisi asal Anda (<strong>{user.originalDivisionName}</strong>).
            Seluruh titik GPS dan Barcode presensi Anda telah disesuaikan ke lokasi kerja baru.{' '}
            {user.assignmentNotes && (
              <span className="italic">Catatan Admin: "{user.assignmentNotes}"</span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* ─── PERIMETER BREACH LOCKED BANNER ─── */}
      {isLockedBreach && (
        <Alert variant="destructive" className="rounded-2xl border-rose-500/40 bg-rose-500/10 text-rose-950 dark:text-rose-100 shadow-sm">
          <ShieldAlert className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0" />
          <AlertTitle className="text-xs font-bold uppercase tracking-wider flex items-center justify-between flex-wrap gap-2">
            <span>🚨 Presensi Pulang Dinonaktifkan — Pelanggaran Perimeter Kerja Terdeteksi</span>
            <Badge variant="outline" className="bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/40 text-[10px]">
              Terekam di Database Kinerja
            </Badge>
          </AlertTitle>
          <AlertDescription className="text-xs mt-1 space-y-2">
            <p>
              Sistem mendeteksi Anda telah meninggalkan area kantor divisi saat jam operasional berlangsung tanpa surat izin/dinas resmi. Sesuai Standar Operasional Prosedur (SOP) disiplin kehadiran, tombol presensi pulang (Clock Out) <strong>otomatis dikunci</strong> dan pelanggaran ini dilaporkan ke <strong>Dashboard Superadmin, HRD, dan Pimpinan</strong> untuk dievaluasi pada Rekap Penilaian Kinerja Karyawan.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setClarificationModalOpen(true)}
                className="rounded-xl text-xs h-8 px-3 font-semibold shadow-xs"
              >
                Ajukan Klarifikasi / Buka Kunci ke HRD
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* ─── 3. AUTO-LOCK WARNING BANNER (IF FORGOTTEN CHECKOUT) ─── */}
      {isAutoLockWarning && (
        <Alert variant="destructive" className="rounded-2xl border-amber-300 dark:border-amber-800/70 bg-amber-50/80 dark:bg-amber-950/50 text-amber-950 dark:text-amber-100">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          <AlertTitle className="text-xs font-bold uppercase tracking-wider">
            ⚠️ Peringatan Waktu Pulang — Segera Selfie Pulang!
          </AlertTitle>
          <AlertDescription className="text-xs mt-1">
            Jam kerja shift Anda ({userShift?.endTime} WIB) telah berakhir lebih dari 30 menit yang lalu. Harap segera lakukan <strong>Selfie Presensi Pulang</strong> sekarang sebelum sistem mengunci waktu kepulangan Anda secara otomatis!
          </AlertDescription>
        </Alert>
      )}

      {/* ─── 4. NOTIFICATION / FEEDBACK MESSAGES ─── */}
      {attendanceMessage && (
        <Alert
          variant={attendanceMessage.type === 'error' ? 'destructive' : 'default'}
          className={
            attendanceMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-100 rounded-2xl'
              : 'rounded-2xl'
          }
        >
          {attendanceMessage.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <AlertDescription className="text-sm font-medium flex items-center justify-between flex-wrap gap-2">
            <span>{attendanceMessage.text}</span>
            {attendanceMessage.text.includes('quota') && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs font-semibold bg-background hover:bg-muted text-foreground border-rose-500/40 rounded-xl"
                onClick={() => {
                  try {
                    localStorage.removeItem('hrm_attendance');
                    localStorage.removeItem('hrm_perimeter_violations');
                    setAttendanceMessage(null);
                    window.location.reload();
                  } catch (e) {}
                }}
              >
                🧹 Bersihkan Cache & Muat Ulang
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* ─── 5. TOP HEADER & DIGITAL CLOCK ─── */}
      <div className="bg-card border border-border rounded-xl p-3.5 sm:p-5 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
          <div className="space-y-1.5 min-w-0 flex-1">
            <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-foreground truncate break-words">
              {user?.fullName}
            </h1>
            <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1 shrink-0">
                <UserCheck className="w-3.5 h-3.5 text-primary" />
                <span>NIP: <strong className="text-foreground">{user?.nip}</strong></span>
              </span>
              <span>•</span>
              {todaySchedule ? (
                <span className="inline-flex items-center gap-1.5 flex-wrap">
                  <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span>Jadwal Roster:</span>
                  <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                    todaySchedule.isOff
                      ? 'bg-slate-500/20 text-slate-700 dark:text-slate-300'
                      : todaySchedule.shiftCode === 'P'
                      ? 'bg-blue-500/20 text-blue-700 dark:text-blue-300'
                      : todaySchedule.shiftCode === 'S'
                      ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                      : 'bg-purple-500/20 text-purple-700 dark:text-purple-300'
                  }`}>
                    {todaySchedule.isOff ? '🏖️ LIBUR / OFF' : `${todaySchedule.shiftName} (${todaySchedule.startTime} - ${todaySchedule.endTime})`}
                  </span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 flex-wrap">
                  <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span>Shift: <strong className="text-foreground">{userShift?.name}</strong> <span className="text-[11px]">({userShift?.startTime} - {userShift?.endTime})</span></span>
                </span>
              )}
            </div>
          </div>

          {/* Real-time Digital Clock Display */}
          <div className="bg-muted/30 border border-border/80 px-3.5 py-2 rounded-xl text-center md:text-right w-full md:w-auto min-w-0 shrink-0">
            <p className="text-[11px] font-medium text-muted-foreground">
              {formatDateIndonesian(currentTime)}
            </p>
            <p className="text-xl sm:text-2xl font-mono font-bold text-foreground tracking-tight">
              {formatTime(currentTime)} <span className="text-xs font-normal text-muted-foreground">WIB</span>
            </p>
          </div>
        </div>
      </div>

      {/* ─── 6. MAIN ACTION GRID: CLOCK IN / CLOCK OUT & LEMBUR ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Presensi Action Hero Card */}
        <Card className="lg:col-span-2 border-border shadow-2xs rounded-xl overflow-hidden">
          {todaySchedule?.isOff && (
            <div className="mx-6 mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-start gap-2.5 text-xs text-blue-900 dark:text-blue-200">
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Hari ini Anda dijadwalkan Libur (OFF).</span>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Anda tidak memiliki kewajiban absensi hari ini menurut matriks jadwal shift perusahaan. Jika hadir untuk lembur atau penugasan khusus, Anda tetap dapat melakukan presensi di bawah.
                </p>
              </div>
            </div>
          )}
          <CardHeader className="border-b border-border/60 pb-3 px-3.5 sm:px-6">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary shrink-0" />
                <span>Presensi Hari Ini ({getTodayDateStr()})</span>
              </CardTitle>
              <div>
                {todayAttendance?.clockIn ? (
                  todayAttendance.clockOut ? (
                    <Badge className="bg-emerald-600 text-white text-xs">
                      Selesai Hari Ini
                    </Badge>
                  ) : todayAttendance.status === 'terlambat' ? (
                    <Badge variant="destructive" className="text-xs">
                      Terlambat {todayAttendance.lateMinutes} Mnt
                    </Badge>
                  ) : (
                    <Badge className="bg-primary text-primary-foreground text-xs">
                      Sedang Bekerja
                    </Badge>
                  )
                ) : (
                  <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 bg-amber-50">
                    Belum Presensi Masuk
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-5 sm:space-y-6 pt-4 sm:pt-6 px-3.5 sm:px-6">
            {/* HERO CENTER BUTTON */}
            <div className="flex flex-col items-center justify-center p-6 bg-gradient-to-b from-muted/30 to-muted/10 border border-border rounded-2xl text-center shadow-xs">
              <div className="relative mb-3">
                {canClockIn ? (
                  <button
                    type="button"
                    onClick={() => handleOpenAttendanceModal('clock_in')}
                    className="w-28 h-28 rounded-full bg-primary text-primary-foreground flex flex-col items-center justify-center shadow-lg shadow-primary/30 hover:scale-105 active:scale-95 transition-all duration-200 border-4 border-card ring-4 ring-primary/20 cursor-pointer animate-pulse"
                    title="Klik untuk Presensi Masuk (Selfie + Scan Barcode)"
                  >
                    <Camera className="w-9 h-9 mb-1" />
                    <span className="text-xs font-bold tracking-tight uppercase">CLOCK IN</span>
                  </button>
                ) : isClockInBlockedLocation ? (
                  <div
                    onClick={() => setShowGpsDetailModal(true)}
                    className="w-28 h-28 rounded-full bg-rose-500/10 border-4 border-rose-500/30 text-rose-600 flex flex-col items-center justify-center cursor-pointer hover:bg-rose-500/20 hover:scale-105 active:scale-95 transition-all shadow-sm"
                    title="Presensi Masuk Terkunci: Ketuk untuk melihat detail koordinat & status."
                  >
                    <MapPin className="w-8 h-8 mb-1 animate-pulse" />
                    <span className="text-[10px] font-bold text-center px-1 leading-tight uppercase">DI LUAR AREA</span>
                    <span className="text-[9px] font-mono font-semibold opacity-90 mt-0.5">
                      {distanceToOffice !== null ? `${Math.round(distanceToOffice)}m` : ''}
                    </span>
                  </div>
                ) : isLockedBreach ? (
                  <button
                    type="button"
                    onClick={() => setClarificationModalOpen(true)}
                    className="w-28 h-28 rounded-full bg-rose-500/10 border-4 border-rose-500/40 text-rose-600 flex flex-col items-center justify-center shadow-lg shadow-rose-500/20 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer animate-pulse"
                    title="Presensi Pulang Terkunci: Terdeteksi pelanggaran perimeter. Ketuk untuk melihat detail & ajukan klarifikasi."
                  >
                    <ShieldAlert className="w-8 h-8 mb-1 text-rose-600 animate-bounce" />
                    <span className="text-[9px] font-bold text-center px-1 leading-tight uppercase tracking-tight text-rose-700 dark:text-rose-400">
                      CHECKOUT TERKUNCI
                    </span>
                  </button>
                ) : canClockOut ? (
                  <button
                    type="button"
                    onClick={() => handleOpenAttendanceModal('clock_out')}
                    className="w-28 h-28 rounded-full bg-primary text-primary-foreground flex flex-col items-center justify-center shadow-lg shadow-primary/30 hover:scale-105 active:scale-95 transition-all duration-200 border-4 border-card ring-4 ring-primary/20 cursor-pointer animate-bounce"
                    title="Klik untuk Presensi Pulang (Hanya Selfie)"
                  >
                    <Camera className="w-9 h-9 mb-1" />
                    <span className="text-xs font-bold tracking-tight uppercase">CLOCK OUT</span>
                  </button>
                ) : isWaitingClockOut ? (
                  <div
                    className="w-28 h-28 rounded-full bg-muted border-4 border-border text-muted-foreground flex flex-col items-center justify-center cursor-not-allowed opacity-90"
                    title={`Tombol pulang terkunci hingga pukul ${userShift?.endTime || '17:00'}.`}
                  >
                    <Lock className="w-8 h-8 mb-1 text-muted-foreground" />
                    <span className="text-[10px] font-bold text-center px-1 leading-tight uppercase">TERKUNCI</span>
                    <span className="text-[9px] font-mono text-muted-foreground">{timeRemainingFormatted}</span>
                  </div>
                ) : (
                  <div
                    className="w-28 h-28 rounded-full bg-emerald-500/10 border-4 border-emerald-500/30 text-emerald-600 flex flex-col items-center justify-center"
                    title="Presensi hari ini telah tuntas."
                  >
                    <CheckCircle2 className="w-10 h-10 mb-0.5 text-emerald-600" />
                    <span className="text-[10px] font-bold uppercase tracking-tight">SELESAI</span>
                  </div>
                )}
              </div>

              {/* Minimalist Icon-First Status Indicator */}
              <div className="flex items-center justify-center gap-2 pt-1">
                {canClockIn && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                    <Camera className="w-3.5 h-3.5" />
                    <span>Siap Presensi Masuk</span>
                  </span>
                )}
                {isClockInBlockedLocation && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-medium">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>Di Luar Area Kantor</span>
                  </span>
                )}
                {isLockedBreach && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-300 text-xs font-semibold border border-rose-500/30">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Presensi Pulang Terkunci (Pelanggaran Perimeter)</span>
                  </span>
                )}
                {isWaitingClockOut && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted text-muted-foreground text-xs font-medium">
                    <Lock className="w-3.5 h-3.5" />
                    <span>Menunggu Pulang ({timeRemainingFormatted})</span>
                  </span>
                )}
                {canClockOut && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                    <Camera className="w-3.5 h-3.5" />
                    <span>Waktu Pulang Tiba</span>
                  </span>
                )}
                {isCompleted && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Presensi Selesai</span>
                  </span>
                )}
              </div>
            </div>

            {/* Master Face Biometric Status Banner */}
            {user?.isFaceEnrolled ? (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <ScanFace className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground flex items-center gap-1.5">
                      Wajah Master Terdaftar
                      <Badge variant="outline" className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-[9px] py-0 px-1.5 rounded-full">
                        128-D Aktif
                      </Badge>
                    </p>
                    <p className="text-[11px] text-muted-foreground">Siap verifikasi biometrik 1:1 saat presensi.</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFaceEnrollmentModalOpen(true)}
                  className="rounded-xl text-[11px] h-7 px-2.5 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10"
                >
                  Daftar Ulang
                </Button>
              </div>
            ) : (
              <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-bold text-amber-950 dark:text-amber-100">Wajah Master Belum Terdaftar</p>
                    <p className="text-[11px] text-amber-800 dark:text-amber-200">
                      Daftarkan wajah Anda sekarang agar dapat melakukan presensi biometrik 1:1.
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => setFaceEnrollmentModalOpen(true)}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs h-8 px-3 rounded-xl shrink-0 gap-1.5 shadow-sm"
                >
                  <ScanFace className="w-3.5 h-3.5" />
                  Daftarkan Wajah
                </Button>
              </div>
            )}

            {/* Status Grid Clock In vs Clock Out */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Clock In Box */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                    Presensi Masuk
                  </span>
                  <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-medium">
                    Face AI + GPS Lokasi
                  </Badge>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono text-foreground">
                    {todayAttendance?.clockIn || '--:--:--'}
                  </span>
                  {todayAttendance?.clockIn && (
                    <span className="text-xs text-muted-foreground">WIB</span>
                  )}
                </div>
                <div className="pt-1">
                  <Button
                    onClick={() => handleOpenAttendanceModal('clock_in')}
                    disabled={!canClockIn}
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm font-semibold gap-2 rounded-xl disabled:bg-muted disabled:text-muted-foreground"
                  >
                    <Camera className="w-4 h-4" />
                    {hasClockedIn
                      ? 'Sudah Presensi Masuk'
                      : isClockInBlockedLocation
                      ? 'Terkunci (Di Luar Area)'
                      : 'Clock In Sekarang (Instant)'}
                  </Button>
                </div>
              </div>

              {/* Clock Out Box */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                    Presensi Pulang
                  </span>
                  <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-medium">
                    Face AI + GPS Lokasi
                  </Badge>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono text-foreground">
                    {todayAttendance?.clockOut || '--:--:--'}
                  </span>
                  {todayAttendance?.clockOut && (
                    <span className="text-xs text-muted-foreground">WIB</span>
                  )}
                </div>
                <div className="pt-1">
                  <Button
                    onClick={() => {
                      if (isLockedBreach) {
                        setClarificationModalOpen(true);
                      } else {
                        handleOpenAttendanceModal('clock_out');
                      }
                    }}
                    disabled={!canClockOut && !isLockedBreach}
                    className={`w-full font-semibold gap-2 rounded-xl shadow-sm ${
                      isLockedBreach
                        ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse'
                        : 'bg-primary hover:bg-primary/90 text-primary-foreground disabled:bg-muted disabled:text-muted-foreground'
                    }`}
                  >
                    {isLockedBreach ? (
                      <>
                        <Lock className="w-4 h-4" />
                        Terkunci (Pelanggaran Perimeter)
                      </>
                    ) : isWaitingClockOut ? (
                      <>
                        <Lock className="w-4 h-4" />
                        Terkunci s/d {todayApprovedOvertime?.scheduledEndTime || userShift?.endTime || '17:00'} ({timeRemainingFormatted})
                      </>
                    ) : (
                      <>
                        <Camera className="w-4 h-4" />
                        {hasClockedOut
                          ? 'Sudah Presensi Pulang'
                          : !hasClockedIn
                          ? 'Belum Clock In'
                          : 'Clock Out Sekarang (Instant)'}
                      </>
                    )}
                  </Button>

                  {/* Remote Unlock Status Badge */}
                  {todayAttendance?.isRemoteUnlocked && !hasClockedOut && (
                    <div className="flex items-center gap-2 p-2 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 rounded-lg text-xs font-semibold border border-emerald-500/30">
                      <Unlock className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                      <span>Kunci Checkout Telah Dibuka oleh {todayAttendance.remoteUnlockedBy || 'Atasan'}</span>
                    </div>
                  )}

                  {/* Early Leave Status Badge */}
                  {todayAttendance?.isEarlyLeave && (
                    <div className="flex items-center gap-2 p-2 bg-amber-500/10 text-amber-700 dark:text-amber-300 rounded-lg text-xs font-semibold border border-amber-500/30">
                      <AlertOctagon className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                      <span>Presensi Pulang Awal Darurat ({todayAttendance.earlyLeaveCategory}) - Laporan Masuk ke Pimpinan</span>
                    </div>
                  )}

                  {/* REKOMENDASI 1 & 2: Tombol Pilihan Ketika Belum Jam Pulang */}
                  {isWaitingClockOut && (
                    <div className="pt-2 space-y-1.5 border-t border-border/60">
                      <Button
                        type="button"
                        onClick={() => setEarlyLeaveModalOpen(true)}
                        variant="outline"
                        className="w-full text-xs font-bold gap-1.5 text-rose-600 border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl py-2"
                      >
                        <AlertOctagon className="w-3.5 h-3.5 shrink-0" />
                        🚨 Izin Pulang Awal Darurat (Sakit / Urgent)
                      </Button>
                      <p className="text-[10px] text-muted-foreground text-center">
                        Tanpa tunggu atasan • Langsung terkirim ke WhatsApp Pimpinan & Superadmin
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ─── FITUR JAM ISTIRAHAT 1 JAM (BREAK TIME POLICY) ─── */}
            {hasClockedIn && !hasClockedOut && breakPolicyEnabled && (
              <div className={`p-4 rounded-xl border transition-all ${
                todayAttendance?.isOnBreak
                  ? 'bg-amber-500/10 border-amber-500/30 dark:bg-amber-950/20'
                  : 'bg-card border-border'
              }`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Coffee className={`w-4 h-4 ${todayAttendance?.isOnBreak ? 'text-amber-600 animate-bounce' : 'text-primary'}`} />
                      <h4 className="text-sm font-bold text-foreground">
                        {todayAttendance?.isOnBreak ? '☕ Sedang Masa Istirahat (1 Jam)' : 'Hak Jam Istirahat (1 Jam Keluar Pos)'}
                      </h4>
                      {todayAttendance?.isOnBreak && (
                        <Badge className="bg-amber-600 text-white text-[10px] animate-pulse">
                          Radar Dijeda (Aman)
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {todayAttendance?.isOnBreak
                        ? 'Anda bebas berada di luar pos untuk makan/istirahat. Perimeter breach dijeda selama 1 jam.'
                        : 'Karyawan diizinkan meninggalkan pos selama 1 jam (makan di luar) tanpa memicu alarm perimeter.'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {todayAttendance?.isOnBreak ? (
                      <div className="flex items-center gap-2">
                        <div className="px-3 py-1.5 bg-background border border-amber-500/40 rounded-xl text-center">
                          <span className="text-[10px] uppercase font-bold text-muted-foreground block">Sisa Waktu</span>
                          <span className={`text-base font-black font-mono ${
                            breakRemainingSeconds <= 600 ? 'text-rose-600 animate-pulse' : 'text-amber-600'
                          }`}>
                            {String(Math.floor(breakRemainingSeconds / 60)).padStart(2, '0')}:
                            {String(breakRemainingSeconds % 60).padStart(2, '0')}
                          </span>
                        </div>
                        <Button
                          onClick={handleEndBreak}
                          disabled={isEndingBreak}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold gap-1.5 rounded-xl shadow-xs"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {isEndingBreak ? 'Menyimpan...' : 'Selesai Istirahat'}
                        </Button>
                      </div>
                    ) : (
                      <Button
                        onClick={handleStartBreak}
                        disabled={isStartingBreak}
                        variant="outline"
                        className="border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 text-xs font-semibold gap-1.5 rounded-xl"
                      >
                        <Coffee className="w-3.5 h-3.5" />
                        {isStartingBreak ? 'Memproses...' : 'Mulai Jam Istirahat (1 Jam)'}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Attendance Details Card if recorded */}
            {todayAttendance && (
              <div className="p-3.5 bg-muted/30 rounded-xl border border-border text-xs text-foreground space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      Durasi Kerja: <strong>{Math.floor(todayAttendance.workDurationMinutes / 60)} Jam {todayAttendance.workDurationMinutes % 60} Menit</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {Array.isArray(todayAttendance.securityFlags) && todayAttendance.securityFlags.map((flag, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded-full bg-background border text-[10px] font-mono text-muted-foreground">
                        ✓ {String(flag).replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Arsip Foto Wajah Presensi Review */}
                {Boolean(todayAttendance.photoOut || todayAttendance.photoIn || (todayAttendance as any).photoUrl) && (
                  <div className="flex items-center gap-3 pt-2 border-t border-border/50">
                    <img
                      src={todayAttendance.photoOut || todayAttendance.photoIn || (todayAttendance as any).photoUrl}
                      alt="Arsip Presensi"
                      className="w-11 h-11 rounded-lg object-cover border border-emerald-500/50 shrink-0 shadow-xs"
                    />
                    <div className="text-[11px] leading-tight">
                      <p className="font-semibold text-foreground flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                        Arsip Foto Presensi Wajah Terverifikasi
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Watermark waktu atomik WIB &amp; koordinat GPS tertanam sebagai bukti audit forensik.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ─── OVERTIME (LEMBUR) & OFFICE INFO CARD ─── */}
        <div className="space-y-6">
          {/* LEMBUR STATUS CARD */}
          <Card className="border-border shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="pb-3 border-b border-border/50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-primary" />
                  Status Lembur Hari Ini
                </CardTitle>
                {todayApprovedOvertime ? (
                  todayApprovedOvertime.overtimePhase === 'completed' ? (
                    <Badge className="bg-emerald-600 text-white text-[10px]">
                      Selesai Dilaporkan
                    </Badge>
                  ) : (
                    <Badge className="bg-emerald-600 text-white text-[10px] animate-pulse">
                      ● Lembur Berjalan
                    </Badge>
                  )
                ) : userOvertimeRequests.some((r) => r.status === 'pending') ? (
                  <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 text-[10px]">
                    Menunggu Approval Karu/Admin
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground text-[10px]">
                    Tidak Ada Lembur
                  </Badge>
                )}
              </div>
            </CardHeader>

            <CardContent className="pt-4 space-y-3 text-xs">
              {todayApprovedOvertime ? (
                todayApprovedOvertime.overtimePhase === 'completed' ? (
                  /* Lembur Selesai Card */
                  <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl space-y-2 text-emerald-950 dark:text-emerald-100">
                    <div className="flex items-center justify-between font-bold">
                      <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 text-xs">
                        <CheckCircle2 className="w-4 h-4" />
                        Lembur Telah Selesai &amp; Dilaporkan
                      </span>
                      <span className="text-xs font-mono bg-emerald-500/20 px-2 py-0.5 rounded-md">
                        {todayApprovedOvertime.actualEndTime || 'Selesai'} WIB
                      </span>
                    </div>

                    <p className="text-[11px] text-muted-foreground">
                      Hasil Kerja: <em>"{todayApprovedOvertime.completionNotes || '-'}"</em>
                    </p>

                    {Array.isArray(todayApprovedOvertime.completionPhotos) && todayApprovedOvertime.completionPhotos.length > 0 && (
                      <div className="space-y-1 pt-1">
                        <span className="text-[10px] font-semibold text-muted-foreground">
                          Bukti Foto Hasil Kerja ({todayApprovedOvertime.completionPhotos.length} foto):
                        </span>
                        <div className="flex items-center gap-2 overflow-x-auto py-1">
                          {todayApprovedOvertime.completionPhotos.map((photo, i) => (
                            <img
                              key={i}
                              src={photo}
                              alt={`Bukti ${i + 1}`}
                              className="w-12 h-12 rounded-lg object-cover border border-emerald-500/40 shrink-0"
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="p-2 bg-emerald-600/15 rounded-xl text-[10px] text-emerald-800 dark:text-emerald-200 font-medium">
                      ✓ Pekerjaan lembur telah selesai dilaporkan. Tombol <strong>Presensi Pulang</strong> kini aktif.
                    </div>
                  </div>
                ) : (
                  /* Lembur Berjalan dengan Countdown Timer Otomatis */
                  <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl space-y-3 text-emerald-950 dark:text-emerald-100">
                    <div className="flex items-center justify-between font-bold">
                      <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 text-xs">
                        <Timer className="w-4 h-4 animate-spin" />
                        Lembur Sedang Berjalan
                      </span>
                      <span className="text-xs font-mono bg-emerald-500/20 px-2 py-0.5 rounded-md">
                        {todayApprovedOvertime.approvedHours || todayApprovedOvertime.durationHours} Jam Lembur
                      </span>
                    </div>

                    {/* LIVE COUNTDOWN DISPLAY */}
                    <div className="p-3 bg-card border border-emerald-500/30 rounded-xl text-center space-y-1">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                        Sisa Waktu Lembur Otomatis
                      </span>
                      <div className="text-2xl font-black font-mono tracking-tight text-emerald-600 dark:text-emerald-400">
                        {timeRemainingFormatted || '00j 00m 00d'}
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Batas Waktu Selesai: <strong>{todayApprovedOvertime.scheduledEndTime || 'Sesuai Jadwal'} WIB</strong>
                      </p>
                    </div>

                    <div className="space-y-1 text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Karu Otorisasi:</span>
                        <strong className="text-foreground">{todayApprovedOvertime.supervisorName || 'Kepala Regu'}</strong>
                      </div>
                      {todayApprovedOvertime.supervisorSignature && (
                        <div className="flex items-center justify-between pt-0.5">
                          <span className="text-muted-foreground">Paraf Karu:</span>
                          <img
                            src={todayApprovedOvertime.supervisorSignature}
                            alt="Paraf Karu"
                            className="h-7 max-w-[90px] object-contain border border-border/70 rounded bg-white p-0.5"
                          />
                        </div>
                      )}
                      <p className="text-muted-foreground italic pt-1 truncate">
                        "{todayApprovedOvertime.taskDescription}"
                      </p>
                    </div>

                    {/* Button Akhiri Lembur Sekarang */}
                    <Button
                      type="button"
                      onClick={() => setFinishOvertimeModalOpen(true)}
                      className="w-full rounded-xl text-xs font-semibold h-9 gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Akhiri Lembur Sekarang (Selesai Lebih Awal)
                    </Button>
                  </div>
                )
              ) : Array.isArray(userOvertimeRequests) && userOvertimeRequests.length > 0 ? (
                <div className="space-y-2">
                  {userOvertimeRequests.map((ot) => (
                    <div key={ot.id} className="p-2.5 bg-muted/40 rounded-xl border border-border space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground">Pengajuan: {ot.requestedHours || ot.durationHours} Jam</span>
                        <Badge variant={ot.status === 'rejected' ? 'destructive' : 'outline'} className="text-[10px]">
                          {ot.status === 'pending' ? 'Menunggu Admin' : ot.status}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">{ot.taskDescription}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-xs">
                  Hanya karyawan dengan persetujuan atau mandat resmi Kepala Regu &amp; Admin yang berhak menjalankan jam lembur.
                </p>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => setOvertimeModalOpen(true)}
                className="w-full rounded-xl text-xs gap-1.5 h-9 border-border font-medium"
              >
                <Send className="w-3.5 h-3.5 text-primary" />
                Ajukan Permohonan Lembur Hari Ini
              </Button>
            </CardContent>
          </Card>

          {/* SLIP GAJI ELEKTRONIK CARD */}
          <Card className="border-border shadow-sm rounded-2xl overflow-hidden bg-gradient-to-br from-card via-card to-primary/5">
            <CardHeader className="pb-3 border-b border-border/50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-primary" />
                  Slip Gaji Elektronik
                </CardTitle>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] font-semibold">
                  Resmi Terverifikasi
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Periode Aktif:</span>
                <span className="font-semibold text-foreground font-mono">September 2026</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Status Penerimaan:</span>
                <span className="font-medium text-emerald-600">Lunas / Siap Dicairkan</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Dokumen bukti pembayaran gaji resmi, rincian tunjangan, lembur terverifikasi, dan potongan statutoris (BPJS & PPh 21 TER).
              </p>
              <Button
                variant="default"
                size="sm"
                onClick={handleOpenSalarySlip}
                className="w-full rounded-xl text-xs gap-1.5 h-9 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-xs"
              >
                <FileText className="w-3.5 h-3.5" />
                Buka Slip Gaji Resmi
              </Button>
            </CardContent>
          </Card>

          {/* Lokasi Divisi Summary Card */}
          <Card className="border-border shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-base font-bold text-foreground flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  Titik Kantor Divisi
                </span>
                <span className="text-[11px] font-mono text-muted-foreground">
                  Radius: {office?.radiusMeters || 150}m
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-2.5 text-xs">
              <p className="font-semibold text-foreground">{office?.name || user?.divisionName}</p>
              <p className="text-muted-foreground leading-relaxed text-[11px]">{office?.address}</p>
              <div className="flex items-center justify-between pt-2 border-t border-border/60 text-[11px]">
                <span className="text-muted-foreground">Perangkat Anda:</span>
                <span className="font-medium text-foreground">{hrmService.getDeviceModel()}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ─── 7. MONTHLY STATS SUMMARY (ICON-FIRST) ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-card border border-border p-4 rounded-xl shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Hadir</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-foreground">
            {presentCount} <span className="text-xs font-normal text-muted-foreground">hari</span>
          </p>
        </div>

        <div className="bg-card border border-border p-4 rounded-xl shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Terlambat</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-foreground">
            {lateCount} <span className="text-xs font-normal text-muted-foreground">kali ({totalLateMins}m)</span>
          </p>
        </div>

        <div className="bg-card border border-border p-4 rounded-xl shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Sisa Cuti</span>
            <CalendarDays className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-foreground">
            {remainingLeave} <span className="text-xs font-normal text-muted-foreground">hari</span>
          </p>
          <p className="text-[11px] text-muted-foreground">dari {annualLeaveQuota} hari (12+2)</p>
        </div>

        <div className="bg-card border border-border p-4 rounded-xl shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Shift</span>
            <Timer className="w-4 h-4 text-primary" />
          </div>
          <p className="text-lg font-bold text-foreground truncate">
            {userShift?.name ? userShift.name.split(' ')[0] : 'Reguler'}
          </p>
        </div>
      </div>

      {/* ─── 8. IMMERSIVE FULL-SCREEN SELFIE CAMERA VIEWPORT ─── */}
      {cameraModalOpen && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between overflow-hidden select-none animate-in fade-in duration-200">
          {/* TOP OVERLAY BAR */}
          <div className="relative z-20 flex items-center justify-between p-4 sm:p-6 bg-gradient-to-b from-black/90 via-black/40 to-transparent">
            <div className="flex items-center gap-2">
              <div className="px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 backdrop-blur-md">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{actionType === 'clock_in' ? 'Step 1: Selfie Wajah Biometrik' : 'Selfie Presensi Pulang'}</span>
              </div>
              <span className="hidden sm:inline text-xs text-white/80 font-mono bg-black/40 px-2.5 py-1 rounded-md backdrop-blur-sm border border-white/10">
                Divisi: {user?.divisionName || 'Pusat'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Switch Front/Back Camera Button */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleToggleFacingMode}
                className="text-white hover:bg-white/20 rounded-full h-10 w-10 p-0 backdrop-blur-md border border-white/20"
                title="Ganti Kamera Depan / Belakang"
              >
                <SwitchCamera className="w-5 h-5" />
              </Button>

              {/* Close / Cancel Button */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCloseCameraModal}
                className="text-white hover:bg-white/20 rounded-full h-10 w-10 p-0 backdrop-blur-md border border-white/20"
                title="Tutup / Batalkan"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* CENTER VIEWFINDER AREA (FULL-BLEED SCREEN CAMERA) */}
          <div className="absolute inset-0 z-10 flex items-center justify-center">
            {!photoDataUrl ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${facingMode === 'user' ? '-scale-x-100' : ''}`}
                />
                <canvas
                  ref={hudCanvasRef}
                  className={`absolute inset-0 w-full h-full pointer-events-none z-15 ${facingMode === 'user' ? '-scale-x-100' : ''}`}
                />

                {/* Fallback Camera Trigger Card when Live Stream is Blocked or Insecure */}
                {(!cameraStream || cameraError) && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-20 bg-black/95 backdrop-blur-md">
                    {typeof window !== 'undefined' && window.location.protocol === 'http:' && window.location.hostname !== 'localhost' ? (
                      <>
                        <div className="w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30 shadow-lg mb-4 animate-pulse">
                          <Lock className="w-8 h-8" />
                        </div>
                        <h4 className="text-white font-bold text-base">Aktifkan Kamera via HTTPS</h4>
                        <p className="text-white/80 text-xs mt-2 max-w-xs leading-relaxed">
                          Browser smartphone (Safari & Chrome) mewajibkan koneksi aman (HTTPS) agar kamera browser langsung dapat aktif.
                        </p>
                        <Button
                          type="button"
                          onClick={() => {
                            window.location.href = window.location.href.replace(/^http:/, 'https:');
                          }}
                          className="mt-5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl h-11 px-6 text-xs shadow-xl gap-2 active:scale-95 transition-transform"
                        >
                          <ShieldCheck className="w-4 h-4" /> Buka via Mode HTTPS (Kamera Aktif)
                        </Button>
                      </>
                    ) : (
                      <>
                        <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shadow-lg mb-4">
                          <Camera className="w-8 h-8" />
                        </div>
                        <h4 className="text-white font-bold text-base">Hubungkan Kamera Browser</h4>
                        <p className="text-white/80 text-xs mt-2 max-w-xs leading-relaxed">
                          {cameraError || 'Pastikan izin akses kamera telah diizinkan pada pengaturan browser Anda.'}
                        </p>
                        <Button
                          type="button"
                          onClick={() => startCameraStream(facingMode)}
                          className="mt-5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl h-11 px-6 text-xs shadow-xl gap-2 active:scale-95 transition-transform"
                        >
                          <RotateCw className="w-4 h-4" /> Sambungkan Ulang Kamera
                        </Button>
                      </>
                    )}
                  </div>
                )}

                {/* Chromatic Flash Screen for 3D skin reflection */}
                <div
                  className={`absolute inset-0 z-30 pointer-events-none transition-opacity ${
                    chromaticFlash ? 'bg-cyan-300/40 opacity-100 duration-100' : 'opacity-0 duration-300'
                  }`}
                />

                {/* Active Liveness HUD & Biometric Dynamic Oval Guide */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-4 z-20">
                  {/* Top Phase Stage Badge */}
                  <div className="absolute top-16 sm:top-20 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full backdrop-blur-md border shadow-lg transition-all duration-300">
                    {livenessPhase === 'verified' ? (
                      <div className="flex items-center gap-2 text-emerald-300 bg-emerald-950/80 border border-emerald-500/50 px-3 py-1 rounded-full text-xs font-bold animate-pulse">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>VERIFIKASI REALTIME: 100% VALID</span>
                      </div>
                    ) : livenessPhase === 'moving_away' || livenessPhase === 'ready_to_move' ? (
                      <div className="flex items-center gap-2 text-purple-200 bg-purple-950/80 border border-purple-500/50 px-3 py-1 rounded-full text-xs font-bold animate-bounce">
                        <Activity className="w-4 h-4 text-purple-400 animate-spin" />
                        <span>TAHAP 2/2: JAUHKAN KAMERA HP DARI WAJAH</span>
                      </div>
                    ) : livenessPhase === 'aligning' ? (
                      <div className="flex items-center gap-2 text-amber-200 bg-amber-950/80 border border-amber-500/50 px-3 py-1 rounded-full text-xs font-bold">
                        <ScanFace className="w-4 h-4 text-amber-400" />
                        <span>TAHAP 1/2: PENYELARASAN POSISI WAJAH</span>
                      </div>
                    ) : livenessPhase === 'failed' ? (
                      <div className="flex items-center gap-2 text-rose-200 bg-rose-950/80 border border-rose-500/50 px-3 py-1 rounded-full text-xs font-bold">
                        <AlertTriangle className="w-4 h-4 text-rose-400" />
                        <span>GERAKAN TIDAK TERDETEKSI</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-white/90 bg-black/60 border border-white/20 px-3 py-1 rounded-full text-xs font-medium">
                        <ShieldAlert className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Anti-Spoofing & Liveness Detection</span>
                      </div>
                    )}
                  </div>

                  {/* Biomorphic Dynamic Target Oval (Animates size based on challenge phase) */}
                  <div
                    className={`relative w-64 h-80 sm:w-72 sm:h-96 rounded-[48%] border-4 flex flex-col items-center justify-center overflow-hidden transition-all duration-700 ease-out ${
                      livenessPhase === 'verified'
                        ? 'border-emerald-400 bg-emerald-500/20 scale-90 shadow-[0_0_45px_rgba(52,211,153,0.7)]'
                        : livenessPhase === 'moving_away' || livenessPhase === 'ready_to_move'
                        ? 'border-purple-400 bg-purple-500/10 scale-[0.76] shadow-[0_0_40px_rgba(168,85,247,0.55)] animate-pulse'
                        : livenessPhase === 'failed'
                        ? 'border-rose-500 bg-rose-500/15 scale-95 shadow-[0_0_35px_rgba(244,63,94,0.5)]'
                        : 'border-amber-400/90 scale-100 shadow-[0_0_30px_rgba(251,191,36,0.4)]'
                    }`}
                  >
                    {/* Corner Crosshairs */}
                    <div className="absolute top-4 left-4 w-4 h-4 border-t-2 border-l-2 border-white/70" />
                    <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-white/70" />
                    <div className="absolute bottom-4 left-4 w-4 h-4 border-b-2 border-l-2 border-white/70" />
                    <div className="absolute bottom-4 right-4 w-4 h-4 border-b-2 border-r-2 border-white/70" />

                    {/* Animated Laser Scan Bar */}
                    <div
                      className={`absolute top-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_14px_#22d3ee] animate-bounce ${
                        livenessPhase === 'moving_away' ? 'via-purple-400' : ''
                      }`}
                    />

                    {/* Target Scale Visual Hint inside Oval */}
                    {livenessPhase === 'moving_away' && (
                      <div className="absolute inset-4 rounded-[48%] border border-dashed border-purple-300/40 animate-ping opacity-30" />
                    )}

                    {/* Instruction Inside Oval */}
                    <div className="mt-auto mb-5 px-3 py-1.5 rounded-full bg-black/75 backdrop-blur-md border border-white/20 text-center max-w-[85%]">
                      <span className="text-[11px] sm:text-xs font-bold text-white block">
                        {livenessMessage}
                      </span>
                    </div>
                  </div>

                  {/* Real-time Circular Progress Bar & Metric Indicator */}
                  <div className="w-full max-w-xs mt-3 flex flex-col items-center gap-1.5">
                    <div className="w-full flex items-center justify-between text-[11px] text-white/80 px-1 font-mono">
                      <span className="flex items-center gap-1">
                        <Activity className="w-3 h-3 text-cyan-400" /> Progres Tantangan:
                      </span>
                      <span className="font-bold text-emerald-400">{livenessProgress}%</span>
                    </div>
                    <div className="w-full h-2 bg-black/60 rounded-full overflow-hidden border border-white/15 p-0.5">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ease-out ${
                          livenessPhase === 'verified'
                            ? 'bg-emerald-500'
                            : livenessPhase === 'moving_away'
                            ? 'bg-gradient-to-r from-amber-400 via-purple-500 to-emerald-400'
                            : 'bg-amber-400'
                        }`}
                        style={{ width: `${livenessProgress}%` }}
                      />
                    </div>
                  </div>

                  {/* Dual-Shield Spatial Geofence & Anti-Spoof Radar Pills */}
                  <div className="mt-2.5 flex items-center justify-center gap-1.5 flex-wrap px-2">
                    <span className="px-2 py-0.5 rounded-md bg-black/60 text-white/90 text-[10px] font-mono backdrop-blur-md border border-white/15">
                      {facingMode === 'user' ? 'Kamera Depan' : 'Kamera Belakang'}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-mono backdrop-blur-md border flex items-center gap-1 ${
                        locationStatus === 'inside' || geofenceEval?.isInside
                          ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                          : 'bg-rose-950/80 text-rose-300 border-rose-500/40'
                      }`}
                    >
                      <span>📍 Perimeter:</span>
                      <strong className="font-bold">
                        {geofenceEval ? `${Math.round(geofenceEval.distanceMeters)}m` : (distanceToOffice ? `${Math.round(distanceToOffice)}m` : 'Valid')}
                      </strong>
                      <span>({geofenceEval?.isInside ? 'Dalam Area' : 'Luar Area'})</span>
                    </span>
                    {isMockSuspected ? (
                      <span className="px-2 py-0.5 rounded-md bg-rose-950/90 text-rose-200 text-[10px] font-mono backdrop-blur-md border border-rose-500/50 flex items-center gap-1 animate-pulse">
                        <AlertTriangle className="w-3 h-3 text-rose-400" />
                        <span>Mock GPS!</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md bg-black/60 text-emerald-400 text-[10px] font-mono backdrop-blur-md border border-white/15">
                        🛡️ Anti-Spoof OK
                      </span>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="relative w-full h-full flex items-center justify-center bg-black">
                <img
                  src={photoDataUrl}
                  alt="Hasil Selfie Biometrik"
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-20 left-4 right-4 pointer-events-none">
                  {biometricResult && !biometricResult.isMatch ? (
                    <div className="max-w-md mx-auto bg-rose-950/90 border border-rose-500/50 text-rose-200 text-xs px-4 py-3 rounded-2xl backdrop-blur-md flex items-center gap-2.5 shadow-2xl animate-shake">
                      <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                      <div>
                        <p className="font-bold text-white">Verifikasi Biometrik Gagal ({biometricResult.confidence}% Cocok)</p>
                        <p className="text-[11px] opacity-90">{biometricResult.message}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="max-w-md mx-auto bg-emerald-950/90 border border-emerald-500/50 text-emerald-200 text-xs px-4 py-2.5 rounded-2xl backdrop-blur-md flex items-center gap-2.5 shadow-2xl">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                      <div>
                        <p className="font-bold text-white">
                          Biometrik 1:1 Terverifikasi {biometricResult ? `(${biometricResult.confidence}% Cocok)` : ''}
                        </p>
                        <p className="text-[11px] opacity-90">Wajah sesuai dengan data master &amp; stempel forensik disematkan.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* BOTTOM SHUTTER & ACTION CONTROLS */}
          <div className="relative z-20 p-6 sm:pb-8 bg-gradient-to-t from-black/95 via-black/60 to-transparent flex flex-col items-center gap-3">
            {cameraSecurityWarning && (
              <p className="text-amber-300 text-xs bg-amber-950/85 px-3 py-1 rounded-lg border border-amber-500/40 backdrop-blur-sm">
                {cameraSecurityWarning}
              </p>
            )}

            {cameraError && !cameraStream && (
              <p className="text-rose-300 text-xs bg-rose-950/85 px-3 py-1 rounded-lg border border-rose-500/40 backdrop-blur-sm">
                {cameraError}
              </p>
            )}

            {!photoDataUrl ? (
              <div className="w-full max-w-sm flex items-center justify-around">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleToggleFacingMode}
                  className="text-white hover:bg-white/20 rounded-full w-12 h-12 border border-white/20 backdrop-blur-md"
                  title="Putar Kamera Depan / Belakang"
                >
                  <SwitchCamera className="w-5 h-5" />
                </Button>

                {/* Big Native Circular Shutter Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (cameraStream && videoRef.current) {
                      takeSnapshot();
                    } else {
                      startCameraStream(facingMode);
                    }
                  }}
                  className="w-20 h-20 rounded-full border-4 border-white bg-white/30 flex items-center justify-center p-1.5 shadow-2xl active:scale-90 transition-all focus:outline-hidden cursor-pointer"
                  title="Ketuk untuk Ambil Foto Selfie"
                >
                  <div className="w-full h-full rounded-full bg-white shadow-md flex items-center justify-center hover:bg-white/90">
                    <Camera className="w-8 h-8 text-black" />
                  </div>
                </button>

                {/* Camera Reconnect Button */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => startCameraStream(facingMode)}
                  className="text-white hover:bg-white/20 rounded-full w-12 h-12 border border-white/20 backdrop-blur-md"
                  title="Muat Ulang Kamera Browser"
                >
                  <RotateCw className="w-5 h-5" />
                </Button>
              </div>
            ) : (
              <div className="w-full max-w-md flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleRetakePhoto}
                  className="w-full sm:w-auto rounded-xl text-xs h-11 px-5 gap-2 bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-md"
                >
                  <RotateCw className="w-4 h-4" />
                  Ambil Ulang Foto
                </Button>

                {biometricResult && !biometricResult.isMatch ? (
                  <Button
                    type="button"
                    disabled
                    className="w-full sm:w-auto rounded-xl text-xs font-bold h-11 px-6 gap-2 bg-rose-600/80 text-white cursor-not-allowed opacity-80"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    <span>Wajah Mismatch ({biometricResult.confidence}%)</span>
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={() => handleSubmitAttendance(photoDataUrl || undefined, biometricResult)}
                    disabled={submitting}
                    className="w-full sm:w-auto rounded-xl text-xs font-bold h-11 px-6 gap-2 bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg"
                  >
                    <Check className="w-4 h-4" />
                    <span>
                      {submitting
                        ? 'Menyimpan Presensi...'
                        : actionType === 'clock_in'
                        ? 'Konfirmasi Presensi Masuk'
                        : 'Konfirmasi Presensi Pulang'}
                    </span>
                  </Button>
                )}
              </div>
            )}

            <p className="text-[11px] text-white/75 font-sans tracking-tight text-center max-w-xs leading-tight">
              🛡️ <strong>Anti-Kecurangan Aktif:</strong> Posisikan wajah di lingkaran. Presensi otomatis tersimpan instan ke server begitu biometrik wajah dan radius GPS valid.
            </p>
          </div>
        </div>
      )}

      {/* ─── 9. DIALOG AJUKAN LEMBUR (DENGAN NAMA & PARAF KEPALA REGU) ─── */}
      <Dialog open={overtimeModalOpen} onOpenChange={setOvertimeModalOpen}>
        <DialogContent className="max-w-md rounded-2xl border border-border shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Briefcase className="w-5 h-5 text-primary" />
              Pengajuan Jam Lembur (Overtime)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Sesuai kebijakan ketat, lembur harus disertai mandat dan paraf digital Kepala Regu (Karu) yang bertugas di lokasi.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-1">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">
                Jumlah Jam Lembur yang Diajukan
              </label>
              <div className="grid grid-cols-4 gap-2">
                {['1', '2', '3', '4'].map((h) => (
                  <Button
                    key={h}
                    type="button"
                    variant={overtimeHoursInput === h ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setOvertimeHoursInput(h)}
                    className="rounded-xl text-xs h-9 font-mono"
                  >
                    {h} Jam
                  </Button>
                ))}
              </div>
            </div>

            {/* Nama Kepala Regu di Lokasi */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span>Nama Kepala Regu (Karu) di Lokasi <span className="text-rose-500">*</span></span>
                <span className="text-[10px] text-muted-foreground">Wajib Diisi</span>
              </label>
              <Input
                placeholder="Contoh: Bpk. Bambang Sutrisno (Karu Lapangan)"
                value={supervisorNameInput}
                onChange={(e) => setSupervisorNameInput(e.target.value)}
                className="text-xs rounded-xl h-9"
              />
            </div>

            {/* Interactive Digital Signature Canvas for Karu */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <PenTool className="w-3.5 h-3.5 text-primary" />
                  <span>Paraf Kepala Regu di Lokasi <span className="text-rose-500">*</span></span>
                </label>
                {hasSignature && (
                  <button
                    type="button"
                    onClick={handleClearSignature}
                    className="text-[11px] text-rose-500 hover:underline flex items-center gap-1"
                  >
                    <RotateCw className="w-3 h-3" />
                    Hapus / Ulangi Paraf
                  </button>
                )}
              </div>
              <div className="border border-border/80 rounded-xl overflow-hidden bg-card relative touch-none">
                <canvas
                  ref={signatureCanvasRef}
                  width={380}
                  height={120}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerLeave={handlePointerUp}
                  className="w-full h-[120px] cursor-crosshair bg-slate-50 dark:bg-slate-900/60"
                />
                {!hasSignature && (
                  <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-muted-foreground/60 gap-1 text-[11px]">
                    <PenTool className="w-4 h-4 opacity-50" />
                    <span>Bubuhkan paraf Kepala Regu di sini (jari / stylus)</span>
                  </div>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Tanda tangan digital langsung di layar HP sebagai bukti otorisasi langsung di lokasi kerja.
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">
                Alasan / Rincian Pekerjaan Lembur <span className="text-rose-500">*</span>
              </label>
              <Textarea
                placeholder="Contoh: Menyelesaikan pekerjaan penutupan instalasi server divisi yang mendesak..."
                value={overtimeReasonInput}
                onChange={(e) => setOvertimeReasonInput(e.target.value)}
                className="text-xs rounded-xl min-h-[70px]"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setOvertimeModalOpen(false)} className="rounded-xl text-xs h-9">
              Batal
            </Button>
            <Button
              onClick={handleRequestOvertime}
              disabled={submittingOvertime || !overtimeReasonInput.trim() || !supervisorNameInput.trim() || !hasSignature}
              className="rounded-xl text-xs font-semibold h-9"
            >
              {submittingOvertime ? 'Mengirim...' : 'Kirim Pengajuan ke Admin'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── 9B. DIALOG SELESAIKAN LEMBUR & BUKTI KERJA ─── */}
      <Dialog open={finishOvertimeModalOpen} onOpenChange={setFinishOvertimeModalOpen}>
        <DialogContent className="max-w-md rounded-2xl border border-border shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Akhiri Lembur &amp; Lapor Hasil Kerja
            </DialogTitle>
            <DialogDescription className="text-xs">
              Laporkan status penyelesaian pekerjaan lembur Anda dan lampirkan bukti foto (bisa lebih dari 1 foto). Setelah disubmit, tombol Presensi Pulang akan aktif.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-1 text-xs">
            <div className="p-3 bg-muted/40 rounded-xl border border-border space-y-1">
              <div className="flex items-center justify-between font-semibold text-foreground">
                <span>Lembur Hari Ini: {todayApprovedOvertime?.approvedHours || todayApprovedOvertime?.durationHours} Jam</span>
                <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40">
                  {todayApprovedOvertime?.scheduledEndTime ? `Batas: ${todayApprovedOvertime.scheduledEndTime} WIB` : 'Aktif'}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground truncate">
                Karu Otorisasi: <strong>{todayApprovedOvertime?.supervisorName || '-'}</strong>
              </p>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-foreground">
                Keterangan / Status Hasil Pekerjaan <span className="text-rose-500">*</span>
              </label>
              <Textarea
                placeholder="Contoh: Pekerjaan perbaikan divisi telah selesai lebih awal, seluruh fungsi diuji dan berjalan normal..."
                value={overtimeCompletionNotes}
                onChange={(e) => setOvertimeCompletionNotes(e.target.value)}
                className="text-xs rounded-xl min-h-[75px]"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-foreground flex items-center gap-1.5">
                  <UploadCloud className="w-3.5 h-3.5 text-primary" />
                  <span>Upload Foto Bukti Hasil Kerja (Bisa &gt; 1 Foto)</span>
                </label>
                <span className="text-[10px] text-muted-foreground">
                  {overtimeProofPhotos.length} foto dipilih
                </span>
              </div>

              <label className="cursor-pointer flex items-center justify-center gap-2 px-3 py-2 border-2 border-dashed border-border hover:border-primary/60 rounded-xl bg-card hover:bg-muted/30 transition-colors w-full text-center">
                <ImageIcon className="w-4 h-4 text-primary" />
                <span className="text-xs font-medium text-foreground">Pilih / Tambah Foto Bukti</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoUploadForOvertime}
                  className="hidden"
                />
              </label>

              {overtimeProofPhotos.length > 0 && (
                <div className="grid grid-cols-3 gap-2 pt-1 max-h-44 overflow-y-auto p-1 bg-muted/20 rounded-xl border border-border/50">
                  {overtimeProofPhotos.map((photo, index) => (
                    <div key={index} className="relative group rounded-lg overflow-hidden border border-border aspect-square bg-black">
                      <img src={photo} alt={`Bukti ${index + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => handleRemoveProofPhoto(index)}
                        className="absolute top-1 right-1 bg-rose-600 text-white rounded-full p-1 shadow-md hover:bg-rose-700 transition-colors"
                        title="Hapus foto ini"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setFinishOvertimeModalOpen(false)} className="rounded-xl text-xs h-9">
              Batal
            </Button>
            <Button
              onClick={handleFinishOvertimeSubmit}
              disabled={isSubmittingFinishOt || !overtimeCompletionNotes.trim()}
              className="rounded-xl text-xs font-semibold h-9 bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {isSubmittingFinishOt ? 'Menyimpan...' : 'Selesaikan Lembur & Aktifkan Pulang'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── 10. NOTIFICATIONS MODAL ─── */}
      <Dialog open={notifModalOpen} onOpenChange={setNotifModalOpen}>
        <DialogContent className="max-w-md rounded-2xl border border-border shadow-2xl">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2 text-base font-bold">
                <Bell className="w-5 h-5 text-primary" />
                Notifikasi Anda
              </DialogTitle>
              {notifications.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (user) {
                      hrmService.clearNotifications(user.id);
                      setNotifications([]);
                      setUnreadNotifCount(0);
                    }
                  }}
                  className="text-[11px] text-muted-foreground h-7"
                >
                  Bersihkan
                </Button>
              )}
            </div>
          </DialogHeader>
          <div className="space-y-2 py-2 max-h-[60vh] overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-6">Tidak ada notifikasi baru.</p>
            ) : (
              (Array.isArray(notifications) ? notifications : []).map((n) => (
                <div key={n.id} className="p-3 bg-muted/40 rounded-xl border border-border text-xs space-y-1">
                  <div className="flex items-center justify-between font-semibold">
                    <span>{n.title}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {(n.createdAt || n.timestamp || '').slice(11, 16) || '-'}
                    </span>
                  </div>
                  <p className="text-muted-foreground">{n.message}</p>
                </div>
              ))
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setNotifModalOpen(false)} className="w-full rounded-xl text-xs h-9">
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── 10. MASTER FACE ENROLLMENT MODAL ─── */}
      <HrmFaceEnrollmentModal
        open={faceEnrollmentModalOpen}
        user={user}
        onClose={() => setFaceEnrollmentModalOpen(false)}
        onSuccess={(updatedUser) => {
          refreshUser();
          loadAttendanceData();
        }}
      />

      {/* ─── 11. MODAL POPUP INSTAN DI HP SAAT MENINGGALKAN PERIMETER ─── */}
      <Dialog open={perimeterBreachAlertOpen} onOpenChange={setPerimeterBreachAlertOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl border-rose-500/50 bg-card text-foreground shadow-2xl">
          <div className="flex flex-col items-center text-center p-2 space-y-3">
            <div className="w-16 h-16 rounded-full bg-rose-500/15 border-2 border-rose-500/40 flex items-center justify-center text-rose-600 animate-bounce">
              <ShieldAlert className="w-9 h-9" />
            </div>
            <div className="space-y-1">
              <Badge variant="destructive" className="uppercase tracking-wider text-[10px] px-2 py-0.5">
                Peringatan Disiplin Geofence
              </Badge>
              <h3 className="text-base font-bold text-foreground">
                Anda Terdeteksi Meninggalkan Area Kantor!
              </h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Sistem Geofence Watchdog mendeteksi lokasi perangkat Anda telah berada di luar perimeter divisi
              {breachDetail ? ` sejauh ${breachDetail.distance} meter` : ''} pada pukul {breachDetail?.time || 'sekarang'} WIB saat jam kerja masih berlangsung.
            </p>
            <div className="p-3 w-full bg-rose-500/10 border border-rose-500/25 rounded-xl text-[11px] text-rose-900 dark:text-rose-200 text-left space-y-1">
              <p className="font-semibold flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                Presensi Kepulangan (Clock Out) Telah Dinonaktifkan
              </p>
              <p className="text-muted-foreground dark:text-rose-300">
                Data pelanggaran telah tersimpan di database server dan diteruskan ke Dashboard Superadmin, HRD, dan Pimpinan untuk evaluasi penilaian kinerja karyawan.
              </p>
            </div>
            <div className="pt-2 w-full flex flex-col gap-2">
              <Button
                variant="destructive"
                className="w-full rounded-xl text-xs font-semibold h-9 shadow-sm"
                onClick={() => setPerimeterBreachAlertOpen(false)}
              >
                Saya Mengerti (Kembali ke Kantor)
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── 12. DIALOG: KLARIFIKASI & PERMOHONAN BUKA KUNCI PRESENSI ─── */}
      <Dialog open={clarificationModalOpen} onOpenChange={setClarificationModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <ShieldAlert className="w-5 h-5" />
              Klarifikasi Pelanggaran Perimeter
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Presensi kepulangan Anda dikunci otomatis karena terdeteksi meninggalkan perimeter area kantor sebelum jam kerja selesai.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="p-3 bg-muted/40 rounded-xl border border-border space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status Presensi:</span>
                <Badge variant="destructive" className="text-[10px]">TERKUNCI (DISIPLIN)</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Karyawan:</span>
                <span className="font-semibold text-foreground">{user?.fullName} ({user?.nip})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Divisi:</span>
                <span className="font-medium text-foreground">{user?.divisionName}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-medium text-foreground text-xs">
                Alasan / Penjelasan Meninggalkan Lokasi Kerja:
              </label>
              <Textarea
                placeholder="Contoh: Menghadiri rapat mendadak dengan rekanan dinas / Mengambil berkas atas izin lisan atasan / Keperluan mendesak..."
                value={clarificationReason}
                onChange={(e) => setClarificationReason(e.target.value)}
                rows={4}
                className="text-xs rounded-xl"
              />
              <p className="text-[11px] text-muted-foreground">
                Klarifikasi ini akan langsung diteruskan ke live review HRD dan Pimpinan untuk proses otorisasi pembukaan kunci presensi pulang.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setClarificationModalOpen(false)}
              className="rounded-xl text-xs"
            >
              Tutup
            </Button>
            <Button
              size="sm"
              disabled={!clarificationReason.trim() || submittingClarification}
              onClick={async () => {
                setSubmittingClarification(true);
                try {
                  hrmService.createNotification({
                    userId: 'admin-hrd',
                    type: 'system',
                    title: `Permohonan Buka Kunci Presensi: ${user?.fullName}`,
                    message: `Karyawan ${user?.fullName} (${user?.nip}) mengajukan klarifikasi breach perimeter: "${clarificationReason.trim()}". Mohon evaluasi pada menu Live Monitoring.`,
                    link: '/monitoring',
                  });
                  setAttendanceMessage({
                    type: 'success',
                    text: 'Pengajuan klarifikasi telah terkirim ke HRD. Menunggu otorisasi pembukaan kunci dari HRD/Pimpinan.',
                  });
                  setClarificationModalOpen(false);
                  setClarificationReason('');
                } finally {
                  setSubmittingClarification(false);
                }
              }}
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-semibold gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              Kirim Klarifikasi ke HRD
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── 11. MODAL SLIP GAJI RESMI STATUTORIS REAL (DATABASE SYNC) ─── */}
      <Dialog open={salarySlipModalOpen} onOpenChange={setSalarySlipModalOpen}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto p-0 rounded-2xl border-border bg-card">
          <div className="p-6 border-b border-border bg-muted/30">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <DialogTitle className="text-lg font-bold text-foreground">
                      Slip Gaji Resmi Elektronik
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground">
                      PT. Fawwaz Reski Perwira &bull; Dokumen Rahasia &amp; Statutoris
                    </DialogDescription>
                  </div>
                </div>
              </div>
              <Badge className="bg-emerald-600/10 text-emerald-600 border border-emerald-600/20 text-xs px-2.5 py-1">
                {salarySlipData?.status || 'LUNAS / SIAP CAIR'}
              </Badge>
            </div>

            {/* Sub-header meta bar */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs bg-card p-3 rounded-xl border border-border">
              <div>
                <span className="text-muted-foreground">Periode Gaji: </span>
                <span className="font-semibold text-foreground font-mono">
                  {salarySlipData?.period || 'September 2026'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">No. Slip: </span>
                <span className="font-semibold text-foreground font-mono">
                  {salarySlipData?.id || `SLIP-2026-09-${user?.nip || 'EMP008'}`}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Tanggal Cair: </span>
                <span className="font-semibold text-emerald-600 font-mono">
                  {salarySlipData?.paymentDate || '25 September 2026'}
                </span>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {loadingSlip ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3">
                <RotateCw className="w-6 h-6 animate-spin text-primary" />
                <p className="text-xs text-muted-foreground">Mengambil rincian slip gaji resmi dari database...</p>
              </div>
            ) : salarySlipData ? (
              <>
                {/* Employee Information Card */}
                <div className="p-4 rounded-xl bg-muted/40 border border-border grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Nama Karyawan:</span>
                    <span className="font-bold text-foreground text-sm">{salarySlipData.employee?.name || user?.fullName}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">NIP &amp; Divisi:</span>
                    <span className="font-semibold text-foreground">
                      {salarySlipData.employee?.nip || user?.nip} &bull; {salarySlipData.employee?.division || user?.divisionName}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Rekening Payroll:</span>
                    <span className="font-semibold text-foreground flex items-center gap-1.5 mt-0.5">
                      <CreditCard className="w-3.5 h-3.5 text-primary" />
                      {salarySlipData.employee?.bankName || 'Bank Central Asia (BCA)'} ({salarySlipData.employee?.bankAccount || '7140294812'})
                    </span>
                    <span className="text-[10px] text-muted-foreground">a.n {salarySlipData.employee?.bankAccountHolder || user?.fullName}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Rekap Kehadiran:</span>
                    <span className="font-medium text-foreground">
                      {salarySlipData.employee?.presentDays || 0} Hari Hadir &bull; {salarySlipData.employee?.overtimeHours || 0} Jam Lembur
                      {Number(salarySlipData.employee?.lateMinutes || 0) > 0 && (
                        <span className="text-amber-500 ml-1">({salarySlipData.employee.lateMinutes}m terlambat)</span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Earnings & Deductions Tables */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Earnings */}
                  <div className="rounded-xl border border-border overflow-hidden">
                    <div className="bg-emerald-500/10 px-3.5 py-2.5 border-b border-border flex items-center justify-between text-xs font-bold text-emerald-700 dark:text-emerald-400">
                      <span>A. PENDAPATAN / PENERIMAAN</span>
                    </div>
                    <div className="p-3 space-y-2 text-xs">
                      {salarySlipData.earnings?.map((item: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center text-foreground py-0.5">
                          <span className="text-muted-foreground">{item.label}</span>
                          <span className="font-mono font-medium">Rp {Number(item.amount || 0).toLocaleString('id-ID')}</span>
                        </div>
                      ))}
                      <div className="pt-2 border-t border-border flex justify-between items-center font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                        <span>Total Pendapatan Kotor</span>
                        <span className="font-mono">Rp {Number(salarySlipData.grossEarnings || 0).toLocaleString('id-ID')}</span>
                      </div>
                    </div>
                  </div>

                  {/* Deductions */}
                  <div className="rounded-xl border border-border overflow-hidden">
                    <div className="bg-rose-500/10 px-3.5 py-2.5 border-b border-border flex items-center justify-between text-xs font-bold text-rose-700 dark:text-rose-400">
                      <span>B. POTONGAN RESMI (STATUTORIS)</span>
                    </div>
                    <div className="p-3 space-y-2 text-xs">
                      {salarySlipData.deductions?.map((item: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center text-foreground py-0.5">
                          <span className="text-muted-foreground">{item.label}</span>
                          <span className="font-mono font-medium text-rose-600 dark:text-rose-400">
                            - Rp {Number(item.amount || 0).toLocaleString('id-ID')}
                          </span>
                        </div>
                      ))}
                      <div className="pt-2 border-t border-border flex justify-between items-center font-bold text-rose-600 dark:text-rose-400 text-xs">
                        <span>Total Potongan</span>
                        <span className="font-mono">- Rp {Number(salarySlipData.totalDeductions || 0).toLocaleString('id-ID')}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Take Home Pay Banner */}
                <div className="rounded-2xl p-5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-md space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-xs uppercase tracking-wider text-emerald-100 font-semibold">
                        Gaji Bersih Diterima (Take Home Pay)
                      </span>
                      <p className="text-xs text-emerald-200">
                        Ditransfer ke {salarySlipData.employee?.bankName} ({salarySlipData.employee?.bankAccount})
                      </p>
                    </div>
                    <div className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-white">
                      Rp {Number(salarySlipData.netSalary || 0).toLocaleString('id-ID')}
                    </div>
                  </div>
                  {salarySlipData.netSalaryTerbilang && (
                    <div className="pt-2 border-t border-white/20 text-xs italic text-emerald-100 font-sans">
                      Terbilang: # {salarySlipData.netSalaryTerbilang} #
                    </div>
                  )}
                </div>

                {/* Digital Compliance Guarantee */}
                <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/30 border border-border text-[11px] text-muted-foreground">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Dokumen slip gaji digital ini dihasilkan otomatis oleh Sistem HRM PT. Fawwaz Reski Perwira dan sah secara hukum sesuai UU ITE No. 11/2008.
                  </span>
                </div>
              </>
            ) : (
              <div className="py-8 text-center text-xs text-muted-foreground">
                Gagal memuat dokumen slip gaji. Pastikan server backend sedang aktif.
              </div>
            )}
          </div>

          <DialogFooter className="p-4 bg-muted/20 border-t border-border flex flex-col sm:flex-row gap-2 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleShareSlipText}
              disabled={!salarySlipData}
              className="rounded-xl text-xs gap-1.5 h-9"
            >
              {slipCopied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Tersalin ke Clipboard!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Salin Rincian Slip</span>
                </>
              )}
            </Button>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSalarySlipModalOpen(false)}
                className="rounded-xl text-xs h-9"
              >
                Tutup
              </Button>
              <Button
                type="button"
                variant="default"
                size="sm"
                disabled={!salarySlipData}
                onClick={() => {
                  if (user?.id) {
                    window.open(`/api/payroll/slip/${user.id}/print?autoprint=1`, '_blank');
                  }
                }}
                className="rounded-xl text-xs gap-1.5 h-9 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak / Unduh PDF</span>
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL DETAIL GPS & RADAR GEOFENCE ─── */}
      <Dialog open={showGpsDetailModal} onOpenChange={setShowGpsDetailModal}>
        <DialogContent className="max-w-md rounded-2xl p-5 border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-foreground">
              <MapPin className="w-5 h-5 text-primary" />
              <span>Detail Sinyal GPS & Radar Kantor</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Informasi posisi satelit GPS perangkat Anda dibandingkan dengan koordinat resmi kantor divisi.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            {/* Koordinat HP Karyawan */}
            <div className="p-3 bg-muted/40 rounded-xl border border-border/70 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                <span className="flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-primary" />
                  Koordinat GPS HP Anda (Terdeteksi)
                </span>
                {coordsAccuracy && (
                  <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                    Akurasi: ±{Math.round(coordsAccuracy)}m
                  </Badge>
                )}
              </div>
              {currentCoords ? (
                <div className="space-y-2">
                  <div className="font-mono text-sm font-bold text-foreground tracking-tight select-all bg-card/80 p-2 rounded-lg border border-border/60">
                    Lat: {currentCoords.lat.toFixed(6)}, Lng: {currentCoords.lng.toFixed(6)}
                  </div>
                  <div className="flex items-center gap-2 pt-0.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(`${currentCoords.lat}, ${currentCoords.lng}`);
                        toast.success('Koordinat GPS HP berhasil disalin!');
                      }}
                      className="h-8 text-xs rounded-xl gap-1.5 border-border hover:bg-muted font-medium"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Salin Koordinat Saya
                    </Button>
                    <a
                      href={`https://www.google.com/maps?q=${currentCoords.lat},${currentCoords.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline h-8 px-2 font-medium"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Google Maps
                    </a>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">Mencari satelit GPS...</p>
              )}
            </div>

            {/* Titik Kantor Terdaftar */}
            <div className="p-3 bg-muted/40 rounded-xl border border-border/70 space-y-1.5">
              <div className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-primary" />
                  Titik Kantor Divisi: {office?.name || user?.divisionName || 'Pusat'}
                </span>
                <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                  Radius: {office?.radiusMeters || 150}m
                </Badge>
              </div>
              <div className="font-mono text-xs text-muted-foreground bg-card/80 p-2 rounded-lg border border-border/60">
                Lat: {office?.latitude?.toFixed(6) || '-'}, Lng: {office?.longitude?.toFixed(6) || '-'}
              </div>
            </div>

            {/* Status Radar Geofence */}
            <div className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
              locationStatus === 'inside'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-100'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-950 dark:text-rose-100'
            }`}>
              {locationStatus === 'inside' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <div className="font-bold">
                  {locationStatus === 'inside'
                    ? `✓ Posisi Sah di Dalam Radius (${distanceToOffice !== null ? `${Math.round(distanceToOffice)}m` : '0m'})`
                    : `⚠️ Anda Berada di Luar Radius (${distanceToOffice !== null ? `${Math.round(distanceToOffice)}m` : '0m'})`}
                </div>
                <p className="text-[11px] opacity-90 leading-relaxed">
                  {locationStatus === 'inside'
                    ? 'Posisi HP Anda telah diverifikasi berada di dalam zona kerja resmi divisi. Tombol presensi siap digunakan.'
                    : `Jarak HP Anda (${Math.round(distanceToOffice || 0)} meter) melebihi batas radius yang diizinkan (${office?.radiusMeters || 150} meter).`}
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2 flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                hrmService.syncWithBackend().finally(() => {
                  loadAttendanceData();
                  fetchUserLocation();
                });
                toast.info('Memperbarui sinyal GPS & sinkronisasi kantor...');
              }}
              className="rounded-xl text-xs gap-1.5 h-8 w-full sm:w-auto"
            >
              <RotateCw className="w-3.5 h-3.5" />
              Perbarui GPS Sekarang
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => setShowGpsDetailModal(false)}
              className="rounded-xl text-xs h-8 w-full sm:w-auto"
            >
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── EMPLOYEE CHANGE PASSWORD DIALOG MODAL ─── */}
      <Dialog open={changePasswordModalOpen} onOpenChange={setChangePasswordModalOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Lock className="w-5 h-5 text-primary" />
              Ganti Kata Sandi Akun
            </DialogTitle>
            <DialogDescription className="text-xs">
              Perbarui kata sandi login Anda untuk menjaga keamanan data akun dan presensi.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            {passwordChangeMessage && (
              <Alert className={`rounded-xl text-xs p-2.5 ${
                passwordChangeMessage.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-100'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-900 dark:text-rose-100'
              }`}>
                {passwordChangeMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 inline mr-1.5 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 inline mr-1.5 shrink-0" />
                )}
                <span>{passwordChangeMessage.text}</span>
              </Alert>
            )}

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">Kata Sandi Lama</label>
              <Input
                type="password"
                placeholder="Masukkan kata sandi saat ini"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="text-xs rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">Kata Sandi Baru (Minimal 6 Karakter)</label>
              <Input
                type="password"
                placeholder="Masukkan kata sandi baru"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="text-xs rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">Konfirmasi Kata Sandi Baru</label>
              <Input
                type="password"
                placeholder="Ketik ulang kata sandi baru"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="text-xs rounded-xl"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl text-xs"
              onClick={() => setChangePasswordModalOpen(false)}
              disabled={isChangingPassword}
            >
              Batal
            </Button>
            <Button
              size="sm"
              className="rounded-xl text-xs font-semibold gap-1.5"
              onClick={handleChangePasswordSubmit}
              disabled={isChangingPassword || !newPassword || !confirmPassword}
            >
              <Lock size={14} />
              {isChangingPassword ? 'Memperbarui...' : 'Simpan Kata Sandi'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── FIELD SENTINEL: PIMPINAN SPOT CHECK MODAL ─── */}
      {user && (
        <HrmSpotCheckModal
          open={spotCheckModalOpen}
          user={user}
          instructionNotes={spotCheckInstruction}
          onClose={() => setSpotCheckModalOpen(false)}
          onSuccess={() => {
            toast.success('Bukti verifikasi wajah ber-watermark berhasil dikirim ke Pimpinan & Superadmin!');
            loadAttendanceData();
          }}
        />
      )}

      {/* ─── REKOMENDASI 1: EARLY LEAVE EMERGENCY MODAL DIALOG ─── */}
      <Dialog open={earlyLeaveModalOpen} onOpenChange={setEarlyLeaveModalOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-rose-600">
              <AlertOctagon className="w-5 h-5 shrink-0" />
              Izin Pulang Awal Darurat (Self-Service)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Pilihan kepulangan khusus situasi darurat/sakit tanpa menunggu persetujuan atasan. Sistem akan memproses checkout dan mengirim notifikasi WhatsApp langsung ke Pimpinan & Superadmin.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2 text-xs">
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">Kategori Kepulangan Darurat</label>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { id: 'sakit_mendadak', label: '🤒 Sakit Mendadak / Butuh Medis' },
                  { id: 'darurat_keluarga', label: '👨‍👩‍👧‍👦 Darurat Keluarga / Musibah' },
                  { id: 'tugas_luar', label: '💼 Tugas Luar / Panggilan Mendesak' },
                  { id: 'lainnya', label: '⚠️ Keperluan Mendesak Lainnya' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setEarlyLeaveCategory(cat.id as any)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-medium text-left transition-all ${
                      earlyLeaveCategory === cat.id
                        ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 font-bold'
                        : 'border-border bg-card hover:bg-muted/50 text-foreground'
                    }`}
                  >
                    <span>{cat.label}</span>
                    {earlyLeaveCategory === cat.id && (
                      <Check className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">Alasan / Penjelasan Terinci *</label>
              <textarea
                rows={3}
                value={earlyLeaveReason}
                onChange={(e) => setEarlyLeaveReason(e.target.value)}
                placeholder="Contoh: Mengalami demam tinggi dan harus segera ke klinik terdekat..."
                className="w-full p-2.5 rounded-xl border border-border bg-background text-xs resize-none focus:outline-none focus:ring-2 focus:ring-rose-500"
                required
              />
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-900 dark:text-amber-200 space-y-1 text-[11px] leading-relaxed">
              <div className="font-bold flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
                <Info className="w-3.5 h-3.5 shrink-0" />
                Dual-Channel Broadcast Instan Aktif
              </div>
              <p>
                Data kepulangan Anda akan langsung diteruskan ke WhatsApp Pimpinan (Drs. Hendra Gunawan) dan Superadmin. Alarm pelanggaran perimeter tidak akan dibunyikan.
              </p>
            </div>
          </div>

          <DialogFooter className="pt-2 flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEarlyLeaveModalOpen(false)}
              className="rounded-xl text-xs h-9 w-full sm:w-auto"
            >
              Batal
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isSubmittingEarlyLeave || !earlyLeaveReason.trim()}
              onClick={handleConfirmEarlyLeave}
              className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold gap-1.5 h-9 w-full sm:w-auto"
            >
              <AlertOctagon className="w-3.5 h-3.5" />
              {isSubmittingEarlyLeave ? 'Memproses...' : 'Konfirmasi Pulang Darurat'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
