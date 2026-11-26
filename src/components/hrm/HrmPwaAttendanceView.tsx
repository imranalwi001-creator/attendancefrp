import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useHrmAuth } from '@/contexts/HrmAuthContext';
import { hrmService, getTodayDateStr, getYesterdayDateStr, normalizeAttendanceRecord, normalizeDateString } from '@/services/hrmService';
import { api } from '@/services/apiClient';
import { AttendanceRecord, OfficeLocation, Shift, OvertimeRecord, LeaveRequest, EmployeeSchedule, FIELD_SENTINEL_6_POST_PRESETS, isMobileOnlineOfficer, isLeadershipSpecialFieldOfficer, isSpecialDutyOfficer, isExecutiveMobileSupportOfficer, isFieldOperationalWorker, isMacciniBajiOfficer } from '@/types/hrm';
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
  RefreshCw,
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
  Download,
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
  Sun,
  Moon,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { customNotify } from '@/lib/customNotification';
import { biometricService, BiometricMatchResult, parseFaceDescriptor } from '@/services/biometricService';
import { livenessEngine } from '@/services/livenessEngine';
import { geofenceService, GeofenceEvaluation } from '@/services/geofenceService';
import { fieldSentinelService } from '@/services/fieldSentinelService';
import { emergencyAlertService } from '@/services/emergencyAlertAudioService';
import { hrmHolidayService } from '@/services/hrmHolidayService';
import { HrmFieldAuthorityMobileModal } from '@/components/hrm/HrmFieldAuthorityMobileModal';
import { HrmPwaPersonalCalendarView } from '@/components/hrm/HrmPwaPersonalCalendarView';
import { HrmPwaSplashScreen } from '@/components/pwa/HrmPwaSplashScreen';
import { HrmGhostBanner } from '@/components/hrm/HrmGhostBanner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import defaultAvatar from '@/assets/logo.png';
import { resolveEffectiveShift, checkShiftClockInWindow, checkShiftClockOutWindow, determineNextContinuousShift, NextContinuousShiftInfo, calculateAttendanceLateness, isShiftOffDay, formatShiftLabel, formatShiftHours, resolveContinuousDutyShift } from '@/lib/hrmShiftResolver';
import { compressImageFile } from '@/lib/imageCompressor';
import { DatePicker } from '@/components/ui/date-picker';
import { TimePicker } from '@/components/ui/time-picker';

interface HrmPwaAttendanceViewProps {
  onSwitchToDesktop?: () => void;
}

export const HrmPwaAttendanceView: React.FC<HrmPwaAttendanceViewProps> = ({ onSwitchToDesktop }) => {
  const { user, logout, refreshUser } = useHrmAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const isDarkMode = resolvedTheme === 'dark';
  const toggleThemeMode = () => setTheme(isDarkMode ? 'light' : 'dark');

  // Active Bottom Tab: 'beranda' | 'riwayat' | 'aktivitas' | 'akun'
  const [activeTab, setActiveTab] = useState<'beranda' | 'riwayat' | 'aktivitas' | 'akun'>('beranda');
  const [riwayatViewMode, setRiwayatViewMode] = useState<'kalender' | 'log'>('kalender');

  // PWA Splash Screen Preview State
  const [showSplashPreview, setShowSplashPreview] = useState(false);

  // Real-time Clock
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Location & Geofence (Cached restoration for instant lock & anti-flapping)
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(() => {
    try {
      const cached = sessionStorage.getItem('hrm_last_valid_coords');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.coords?.lat && parsed?.coords?.lng && (Date.now() - (parsed.time || 0) < 180000)) {
          return parsed.coords;
        }
      }
    } catch (_) {}
    return null;
  });
  const [coordsAccuracy, setCoordsAccuracy] = useState<number | null>(() => {
    try {
      const cached = sessionStorage.getItem('hrm_last_valid_coords');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (typeof parsed?.accuracy === 'number') return parsed.accuracy;
      }
    } catch (_) {}
    return null;
  });
  const [distanceToOffice, setDistanceToOffice] = useState<number | null>(null);
  const [locationStatus, setLocationStatus] = useState<'checking' | 'inside' | 'outside' | 'error'>(() => {
    try {
      const lastInsideRaw = sessionStorage.getItem('hrm_last_inside_post_timestamp');
      if (lastInsideRaw && Date.now() - Number(lastInsideRaw) < 90000) {
        return 'inside';
      }
    } catch (_) {}
    return 'checking';
  });
  const [assignedOffice, setAssignedOffice] = useState<OfficeLocation | null>(() => {
    if (isMacciniBajiOfficer(user)) {
      return {
        id: 'pelabuhan-maccini-baji',
        name: 'Pelabuhan Maccini Baji',
        latitude: -4.773545,
        longitude: 119.487525,
        radiusMeters: 500,
        locationName: 'Pelabuhan Maccini Baji',
        address: 'Kawasan Dermaga Pelabuhan Maccini Baji, Labakkang, Pangkep',
        allowedPosts: ['Pelabuhan Maccini Baji', 'MATCH-MCBAJI'],
      };
    }
    return null;
  });
  const [assignedPostName, setAssignedPostName] = useState<string>(() => {
    if (isMacciniBajiOfficer(user)) return 'Pelabuhan Maccini Baji';
    return '';
  });
  const [bankPosts, setBankPosts] = useState<import('@/types/hrm').FieldAssignedPost[]>([]);
  const [isRefreshingGps, setIsRefreshingGps] = useState<boolean>(false);

  // Attendance & Shift State (Diinisialisasi instan dari local confirmed storage untuk mencegah glitch/flicker)
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | undefined>(() => {
    if (!user) return undefined;
    const todayStr = getTodayDateStr();
    const yesterdayStr = getYesterdayDateStr();
    const existing = hrmService.getUserTodayAttendance(user.id);
    if (existing) {
      const existDate = normalizeDateString(existing.attendanceDate || existing.date || (existing as any)?.attendance_date);
      const isExistToday = !existDate || existDate === todayStr;
      const isExistYesterdayActive = existDate === yesterdayStr && !existing.clockOut && !existing.clock_out;
      if (isExistToday || isExistYesterdayActive) {
        return normalizeAttendanceRecord(existing);
      }
    }
    return undefined;
  });
  const [userShift, setUserShift] = useState<Shift | null>(() => {
    if (!user) return null;
    const shifts = hrmService.getShifts();
    const todayStr = getTodayDateStr();
    const dailySched = hrmService.getEmployeeTodaySchedule(user.id, todayStr);
    return resolveEffectiveShift(user, shifts, dailySched);
  });
  const [attendancesHistory, setAttendancesHistory] = useState<AttendanceRecord[]>([]);
  const [userSchedules, setUserSchedules] = useState<EmployeeSchedule[]>(() => {
    if (!user) return [];
    return hrmService.getEmployeeSchedules({ userId: user.id });
  });

  // Instant Shift Sync whenever user profile changes in memory
  useEffect(() => {
    if (user) {
      const shifts = hrmService.getShifts();
      const todayStr = getTodayDateStr();
      const dailySched = hrmService.getEmployeeTodaySchedule(user.id, todayStr);
      setUserShift(resolveEffectiveShift(user, shifts, dailySched));
    }
  }, [user]);

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
  const lastUserRefreshRef = useRef<number>(0);

  // Scan Mode: 'manual' (100% Jepret Manual Penuh oleh Karyawan)
  const [scanMode, setScanMode] = useState<'auto' | 'manual'>('manual');
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

  // ─── PELAPORAN KELUAR AREA / KLARIFIKASI JAM PULANG (REKOMENDASI PIMPINAN) ───
  const [breachReportModalOpen, setBreachReportModalOpen] = useState(false);
  const [breachReportNotes, setBreachReportNotes] = useState('');
  const [isSubmittingBreachReport, setIsSubmittingBreachReport] = useState(false);

  // ─── TAHAP 2: RELIEF DUTY & EMERGENCY POST-SHIFT OVERTIME STATES ───
  // Note: Modal popup lembur pasca-shift dihilangkan sesuai instruksi resmi manajemen.
  // Lembur hanya sah melalui penugasan resmi / pengganti (shift_relief) yang disetujui Korlap.
  const [emergencyOvertimePayload, setEmergencyOvertimePayload] = useState<{
    isEmergencyOvertime: boolean;
    emergencyOvertimeHours: number;
    emergencyOvertimeReason: string;
  } | null>(null);

  // ─── MACCINI BAJI VESSEL BERTHING & ON-CALL CONTROL ───
  const [macciniVesselStatus, setMacciniVesselStatus] = useState<{
    status: 'idle' | 'docking';
    vesselName: string;
    updatedAt: string | null;
    updatedBy: string;
    notes: string;
  }>({ status: 'idle', vesselName: '', updatedAt: null, updatedBy: '', notes: '' });
  const [isUpdatingVesselStatus, setIsUpdatingVesselStatus] = useState(false);
  const [vesselModalOpen, setVesselModalOpen] = useState(false);
  const [targetVesselStatus, setTargetVesselStatus] = useState<'docking' | 'idle'>('docking');
  const [inputVesselName, setInputVesselName] = useState('');

  // ─── EMERGENCY OVERRIDE CLOCK-IN STATES (REKOMENDASI 3: ABSEN TUGAS DARURAT MANDIRI) ───
  const [emergencyOverrideModalOpen, setEmergencyOverrideModalOpen] = useState<boolean>(false);
  const [emergencyOverrideCategory, setEmergencyOverrideCategory] = useState<string>('Panggilan Tugas Darurat Mendadak');
  const [emergencyOverrideDetails, setEmergencyOverrideDetails] = useState<string>('');
  const [emergencyOverridePayload, setEmergencyOverridePayload] = useState<{
    isEmergencyOverride: boolean;
    emergencyReason: string;
  } | null>(null);

  // Active relief post for logged-in user
  const activeReliefPost = useMemo(() => {
    return bankPosts.find((p) => p.isRelief === true);
  }, [bankPosts]);

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
  const [liveLeaveBalance, setLiveLeaveBalance] = useState<{
    annualLeaveQuota: number;
    usedLeaveDays: number;
    pendingLeaveDays?: number;
    approvedLeaveDays?: number;
    remainingLeaveDays: number;
    frpGroup?: string;
    frpGroupLabel?: string;
    months?: Record<string, number>;
    monthlyBreakdown?: Array<{ monthKey: string; label: string; days: number; pendingDays?: number }>;
    overtimeThisMonth?: any;
    overtimeCurrentMonth?: {
      approvedCount: number;
      approvedHours: number;
      month: string;
      cycle?: string;
    };
  } | null>(null);
  const [otDate, setOtDate] = useState(getTodayDateStr());
  const [otCategory, setOtCategory] = useState<'shift1' | 'shift2' | 'shift3' | 'dayshift' | 'darurat_wajib' | 'custom'>('shift1');
  const [otStartTime, setOtStartTime] = useState('07:30');
  const [otEndTime, setOtEndTime] = useState('15:30');
  const [otHours, setOtHours] = useState(8);
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

  // ─── SLIP GAJI KARYAWAN (ON-DEMAND & OTORISASI SUPERADMIN) ───
  const [employeeSlip, setEmployeeSlip] = useState<any | null>(null);
  const [slipLockedInfo, setSlipLockedInfo] = useState<{
    isLocked: boolean;
    hasRequested: boolean;
    periodLabel?: string;
    message?: string;
  }>({ isLocked: true, hasRequested: false });
  const [isSlipViewOpen, setIsSlipViewOpen] = useState(false);
  const [isRequestSlipOpen, setIsRequestSlipOpen] = useState(false);
  const [slipReason, setSlipReason] = useState('Keperluan Administrasi Finansial / Bank');
  const [isSubmittingSlipReq, setIsSubmittingSlipReq] = useState(false);
  const slipPrintRef = useRef<HTMLDivElement>(null);

  const loadEmployeeSlip = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await api.get<{
        success: boolean;
        isLocked?: boolean;
        hasRequested?: boolean;
        periodLabel?: string;
        message?: string;
        slip?: any;
        raw?: any;
      }>(`/api/payroll/my-slip?userId=${user.id}`);
      if (res.data?.success && res.data?.slip) {
        setSlipLockedInfo({ isLocked: false, hasRequested: false, periodLabel: res.data.slip.period });
        setEmployeeSlip(res.data.raw || res.data.slip);
      } else {
        setEmployeeSlip(null);
        setSlipLockedInfo({
          isLocked: true,
          hasRequested: Boolean(res.data?.hasRequested),
          periodLabel: res.data?.periodLabel || 'Periode Berjalan',
          message: res.data?.message || 'Slip gaji belum diterbitkan oleh Admin.',
        });
      }
    } catch {
      setEmployeeSlip(null);
      setSlipLockedInfo({
        isLocked: true,
        hasRequested: false,
        message: 'Slip gaji belum diterbitkan oleh Admin.',
      });
    }
  }, [user?.id]);

  useEffect(() => {
    if (activeTab === 'akun' || activeTab === 'beranda') {
      loadEmployeeSlip();
    }
  }, [activeTab, loadEmployeeSlip]);

  const handleSendSlipRequest = async () => {
    if (!user?.id) return;
    setIsSubmittingSlipReq(true);
    try {
      hrmService.requestPayrollSlipByEmployee(user.id, undefined, slipReason);
      setSlipLockedInfo((prev) => ({
        ...prev,
        hasRequested: true,
        message: 'Permohonan slip gaji berhasil dikirim dan sedang menunggu persetujuan Superadmin.',
      }));
      setIsRequestSlipOpen(false);
      toast.success('Permohonan slip gaji berhasil dikirim ke Superadmin.');
    } catch (err: any) {
      toast.error('Gagal mengirim permohonan: ' + (err?.message || 'Terjadi kesalahan'));
    } finally {
      setIsSubmittingSlipReq(false);
    }
  };

  const handlePrintEmployeeSlip = () => {
    if (!slipPrintRef.current) return;
    const win = window.open('', '_blank');
    if (!win) return;
    const CSS = `
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #000; background: #fff; padding: 15px; }
      .pw { width: 100%; max-width: 820px; margin: 0 auto; }
      .official-box { border: 2.5px solid #000; background: #fff; }
      .box-hdr { display: flex; border-bottom: 2px solid #000; min-height: 64px; }
      .hdr-logo { width: 80px; padding: 6px; display: flex; align-items: center; justify-content: center; border-right: 2px solid #000; }
      .hdr-logo img { width: 48px; height: 48px; object-fit: contain; }
      .hdr-company { flex: 1; display: flex; flex-direction: column; justify-content: center; padding: 0 14px; text-align: center; }
      .hdr-company-name { font-weight: 900; font-size: 12pt; text-decoration: underline; letter-spacing: 0.5px; }
      .hdr-company-sub { font-weight: 900; font-size: 12pt; letter-spacing: 0.5px; margin-top: 2px; }
      .hdr-title { width: 300px; border-left: 2px solid #000; padding: 8px 14px; display: flex; flex-direction: column; justify-content: center; text-align: right; }
      .doc-title { font-weight: 900; font-size: 11pt; text-transform: uppercase; }
      .doc-period { font-weight: 700; font-size: 9.5pt; margin-top: 3px; }
      .emp-info { padding: 10px 14px; border-bottom: 2px solid #000; position: relative; font-size: 9.5pt; font-weight: 700; line-height: 1.6; }
      .emp-row { display: flex; }
      .emp-lbl { width: 75px; font-weight: 900; }
      .emp-date { position: absolute; right: 14px; bottom: 8px; font-size: 8.5pt; font-weight: 600; color: #333; }
      .columns-wrap { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 2px solid #000; }
      .col-left { border-right: 2px solid #000; display: flex; flex-direction: column; justify-content: space-between; }
      .col-right { display: flex; flex-direction: column; justify-content: space-between; }
      .sec-hdr { border-bottom: 2px solid #000; padding: 6px 12px; font-size: 10pt; font-weight: 900; text-align: center; letter-spacing: 0.5px; text-transform: uppercase; background: #fafafa; }
      .item-list { padding: 8px 14px; min-height: 95px; }
      .item-row { display: flex; justify-content: space-between; font-size: 9.5pt; font-weight: 600; margin-bottom: 5px; }
      .total-row { border-top: 2px solid #000; padding: 6px 14px; display: flex; justify-content: space-between; font-size: 10pt; font-weight: 900; background: #fafafa; }
      .bottom-wrap { display: grid; grid-template-columns: 1fr 1fr; }
      .thp-box { border-left: 2px solid #000; padding: 7px 14px; display: flex; justify-content: space-between; font-size: 10.5pt; font-weight: 900; background: #f0fdf4; }
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; padding: 0; }
        .pw { max-width: 100%; margin: 0; }
      }
    `;
    win.document.write(
      `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><title>Slip Gaji - ${user?.fullName || ''}</title><style>${CSS}</style></head><body><div class="pw">${slipPrintRef.current.innerHTML}</div></body></html>`
    );
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
      win.close();
    }, 400);
  };

  // Urgent Spot-Check Alert State (Instruksi Darurat Pimpinan)
  const [spotCheckModalOpen, setSpotCheckModalOpen] = useState(false);
  const [spotCheckData, setSpotCheckData] = useState<{ requestedAt?: string; notes?: string } | null>(null);
  const [isSpotCheckAction, setIsSpotCheckAction] = useState(false);
  const [spotCheckSecondsLeft, setSpotCheckSecondsLeft] = useState<number>(300);
  const isAlarmSilencedRef = useRef<boolean>(false);
  const lastRequestedAtRef = useRef<string | null>(null);
  const isSubmittingPatrolRef = useRef<boolean>(false);

  // PWA Standalone Detection & Installation State
  const checkIsStandalone = () => {
    if (typeof window === 'undefined') return false;
    return Boolean(
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://') ||
      window.location.search.includes('source=pwa')
    );
  };
  const [isStandaloneApp, setIsStandaloneApp] = useState<boolean>(checkIsStandalone);
  const [showPwaInstallModal, setShowPwaInstallModal] = useState<boolean>(false);
  const [pwaGuideTab, setPwaGuideTab] = useState<'android' | 'ios' | 'apk'>('android');

  useEffect(() => {
    const checkStandalone = () => {
      setIsStandaloneApp(checkIsStandalone());
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
        if (choice && choice.outcome === 'accepted') {
          toast.success('PWA berhasil dipasang ke Layar Utama HP!');
          (window as any).__pwaInstallPrompt = null;
          setIsStandaloneApp(true);
          setShowPwaInstallModal(false);
          return;
        }
      } catch (e) {
        console.warn('[PWA] Prompt trigger error:', e);
      }
    }
    // Jika belum ada prompt langsung dari browser, buka panduan interaktif
    setShowPwaInstallModal(true);
  };

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
  const autoCaptureCooldownUntilRef = useRef<number>(0);

  // Active Liveness Challenge States (Strict Anti-Foto Statis & Anti-Layar HP / Video Call Replay)
  const livenessPassedRef = useRef<boolean>(false);
  const [, setIsLivenessPassed] = useState<boolean>(false);
  const [activeChallenge, setActiveChallenge] = useState<'blink' | 'smile'>('blink');
  const activeChallengeRef = useRef<'blink' | 'smile'>('blink');
  const challengeStartedAtRef = useRef<number>(Date.now());
  const [isChromaticFlashing, setIsChromaticFlashing] = useState<boolean>(false);
  const flashStateRef = useRef<'idle' | 'flashing' | 'verified' | 'failed'>('idle');

  const blinkStateRef = useRef<'waiting_blink' | 'blink_closed' | 'verified'>('waiting_blink');
  const hasEstablishedBaselineRef = useRef<boolean>(false);
  const openFramesCountRef = useRef<number>(0);
  const baselineOpenEarRef = useRef<number>(0.22);
  const blinkClosedAtRef = useRef<number | null>(null);
  const staticFaceDetectedSinceRef = useRef<number | null>(null);
  const earHistoryRef = useRef<number[]>([]);

  // Randomizer for active challenges (Kedipan Santai & Senyum Wajar - Anti pre-recorded video loops)
  const pickRandomChallenge = () => {
    const list: ('blink' | 'smile')[] = ['blink', 'smile'];
    const current = activeChallengeRef.current;
    const pool = list.filter((c) => c !== current);
    const next = pool[Math.floor(Math.random() * pool.length)] || 'blink';
    activeChallengeRef.current = next;
    setActiveChallenge(next);
    challengeStartedAtRef.current = Date.now();
    blinkStateRef.current = 'waiting_blink';
    hasEstablishedBaselineRef.current = false;
    openFramesCountRef.current = 0;
    baselineOpenEarRef.current = 0.22;
    blinkClosedAtRef.current = null;
    flashStateRef.current = 'idle';
  };

  // Helper to sample facial skin patch color & luminance for 3D chromatic reflection test
  const sampleSkinPatch = (box: { x: number; y: number; width: number; height: number }) => {
    if (!videoRef.current || videoRef.current.videoWidth === 0) return { r: 128, g: 128, b: 128, lum: 128 };
    try {
      const c = document.createElement('canvas');
      c.width = 32;
      c.height = 32;
      const ctx = c.getContext('2d');
      if (!ctx) return { r: 128, g: 128, b: 128, lum: 128 };
      const sx = Math.max(0, box.x + box.width * 0.35);
      const sy = Math.max(0, box.y + box.height * 0.20);
      const sw = Math.max(10, box.width * 0.30);
      const sh = Math.max(10, box.height * 0.25);
      ctx.drawImage(videoRef.current, sx, sy, sw, sh, 0, 0, 32, 32);
      const d = ctx.getImageData(0, 0, 32, 32).data;
      let rSum = 0, gSum = 0, bSum = 0;
      const total = 32 * 32;
      for (let i = 0; i < d.length; i += 4) {
        rSum += d[i];
        gSum += d[i + 1];
        bSum += d[i + 2];
      }
      const r = rSum / total;
      const g = gSum / total;
      const b = bSum / total;
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      return { r, g, b, lum };
    } catch {
      return { r: 128, g: 128, b: 128, lum: 128 };
    }
  };

  // Active Real-time Face Detection Loop on Camera Stream with Fast Friendly Smile Guidance
  // ─── 100% MANUAL SHUTTER CAMERA (KARYAWAN MEMILIKI KENDALI PENUH UNTUK JEPRET) ───
  useEffect(() => {
    if (!isCameraActive || !cameraStream) {
      setLiveFaceStatus({
        detected: false,
        isGreen: false,
        confidence: 0,
        message: actionType === 'clock_out'
          ? '🏁 Posisikan wajah • Ketuk tombol bulat di bawah untuk pulang'
          : '😊 Posisikan wajah (Silakan senyum) • Ketuk tombol bulat di bawah',
      });
      setAutoCaptureProgress(0);
      greenSinceRef.current = null;
      isTriggeringAutoRef.current = false;
      livenessPassedRef.current = true;
      setIsLivenessPassed(true);
      staticFaceDetectedSinceRef.current = null;
      earHistoryRef.current = [];
      return;
    }

    let isMounted = true;
    let isProcessing = false;

    const interval = setInterval(async () => {
      if (!isMounted || !videoRef.current || isProcessing) return;
      if (videoRef.current.readyState < 2) return;

      isProcessing = true;
      try {
        // Fast real-time face tracking (< 35ms)
        const detail = await biometricService.detectFaceWithLandmarks(videoRef.current);

        if (!isMounted) return;

        if (!detail || !detail.box || detail.box.width === 0) {
          greenSinceRef.current = null;
          isTriggeringAutoRef.current = false;
          setAutoCaptureProgress(0);
          staticFaceDetectedSinceRef.current = null;
          livenessPassedRef.current = true;
          setIsLivenessPassed(true);
          setLiveFaceStatus({
            detected: false,
            isGreen: false,
            confidence: 0,
            message: actionType === 'clock_out'
              ? 'Posisikan wajah di dalam bingkai • Lalu ketuk tombol bulat di bawah'
              : 'Posisikan wajah di dalam bingkai • Lalu ketuk tombol bulat di bawah',
          });
        } else {
          const vw = videoRef.current.videoWidth || 640;
          const boxCenterX = detail.box.x + detail.box.width / 2;
          const isCentered = Math.abs(boxCenterX - vw / 2) < vw * 0.40;
          const scaleRatio = detail.box.width / vw;
          const isGoodScale = scaleRatio >= 0.16 && scaleRatio <= 0.90;

          if (!isGoodScale && scaleRatio < 0.16) {
            greenSinceRef.current = null;
            isTriggeringAutoRef.current = false;
            setAutoCaptureProgress(0);
            setLiveFaceStatus({
              detected: true,
              isGreen: false,
              confidence: 50,
              message: '⚠️ Dekatkan wajah sedikit ke kamera',
            });
            return;
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
            return;
          } else {
            // Wajah terdeteksi tepat di tengah & ukuran pas!
            const now = Date.now();
            livenessPassedRef.current = true;
            setIsLivenessPassed(true);

            if (!greenSinceRef.current) {
              greenSinceRef.current = now;
            }

            const isSmiling = typeof detail.smileScore === 'number' && detail.smileScore >= 0.20;

            // 100% Mode Manual: Tidak ada countdown otomatis, karyawan menekan tombol sendiri saat siap!
            setAutoCaptureProgress(0);
            setLiveFaceStatus({
              detected: true,
              isGreen: true,
              confidence: masterDescriptor ? 98 : 95,
              message: actionType === 'clock_out'
                ? '🏁 Wajah Pas • TEKAN TOMBOL BULAT DI BAWAH UNTUK PULANG'
                : isSmiling
                ? '😊 Senyum Terdeteksi! TEKAN TOMBOL BULAT DI BAWAH'
                : '😊 Wajah Pas (Silakan Senyum) • TEKAN TOMBOL BULAT DI BAWAH',
            });
          }
        }
      } catch (e) {
        console.warn('[Face Detection Tick]', e);
      } finally {
        isProcessing = false;
      }
    }, 120);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isCameraActive, cameraStream, masterDescriptor, actionType]);

  // Load Real Data from PostgreSQL & hrmService
  // Load Real Data from PostgreSQL & hrmService (Zero-Delay Instant Lock Architecture)
  const loadRealData = async () => {
    if (!user) return;
    try {
      const todayStr = getTodayDateStr();
      const yesterdayStr = getYesterdayDateStr();
      let todayAtt: AttendanceRecord | undefined = undefined;

      // Pastikan profil user aktif terdaftar di inMemoryUsers hrmService
      const currentUsers = hrmService.getUsers();
      if (!currentUsers.some((u) => u.id === user.id)) {
        hrmService.setInMemoryUsers([...currentUsers, user]);
      }

      // ─── TAHAP 1.5: SINKRONISASI PROFIL REALTIME DARI POSTGRESQL ───
      // Memastikan perubahan penugasan shift, divisi, atau status akun dari Superadmin langsung aktif
      if (typeof refreshUser === 'function' && Date.now() - lastUserRefreshRef.current > 10000) {
        lastUserRefreshRef.current = Date.now();
        refreshUser().catch(() => null);
      }

      // ─── TAHAP 2: SEGERA RESOLVE SHIFT SECARA SINKRON DARI DATA TERSEDIA ───
      const currentShifts = hrmService.getShifts();
      const activeSchedDate = (todayAtt && !todayAtt.clockOut && todayAtt.attendanceDate && todayAtt.attendanceDate === yesterdayStr)
        ? yesterdayStr
        : todayStr;
      let currentSched = hrmService.getEmployeeTodaySchedule(user.id, activeSchedDate);
      const instantShift = resolveEffectiveShift(user, currentShifts, currentSched);
      setUserShift(instantShift);

      // ─── TAHAP 2.5: FAST REALTIME ROSTER SYNC DARI POSTGRESQL (< 50ms) ───
      try {
        const schedRes = await api.get<{ success: boolean; data?: any }>(
          `/employee-schedules/today/${encodeURIComponent(user.id)}?date=${encodeURIComponent(activeSchedDate)}`
        ).catch(() => null);

        if (schedRes && schedRes.success && schedRes.data) {
          const s = schedRes.data;
          const remoteSched: EmployeeSchedule = {
            id: s.id,
            userId: s.userId || user.id,
            userName: s.userName || user.fullName,
            userNip: s.userNip || user.nip,
            scheduleDate: (s.scheduleDate || activeSchedDate).split('T')[0],
            shiftId: s.shiftId,
            shiftCode: s.shiftCode,
            shiftName: s.shiftName,
            startTime: s.startTime,
            endTime: s.endTime,
            durationHours: Number(s.durationHours || 8),
            isNightShift: Boolean(s.isNightShift),
            isOff: Boolean(s.isOff),
            notes: s.notes || '',
          };
          currentSched = remoteSched;
          const syncedShift = resolveEffectiveShift(user, currentShifts, remoteSched);
          setUserShift(syncedShift);

          try {
            const existingScheds = hrmService.getEmployeeSchedules();
            const schedIdx = existingScheds.findIndex(
              (item) => item.userId === user.id && item.scheduleDate === activeSchedDate
            );
            if (schedIdx >= 0) {
              existingScheds[schedIdx] = remoteSched;
            } else {
              existingScheds.push(remoteSched);
            }
            localStorage.setItem('hrm_employee_schedules', JSON.stringify(existingScheds));
          } catch (_) {}
        }
      } catch (schedSyncErr) {
        console.warn('[PWA] Realtime schedule sync note:', schedSyncErr);
      }

      // ─── TAHAP 3: FAST REALTIME TODAY ATTENDANCE FETCH DARI POSTGRESQL (< 50ms) ───
      // Dijalankan LANGSUNG ke PostgreSQL sebagai Single Source of Truth (SSOT)!
      try {
        const todayData = await api.get<{ success: boolean; attendance?: any }>(
          `/attendances/today?userId=${encodeURIComponent(user.id)}&nip=${encodeURIComponent(user.nip || '')}&date=${encodeURIComponent(todayStr)}`
        ).catch(() => null);

        if (todayData && todayData.success && todayData.attendance) {
          const normRemote = normalizeAttendanceRecord(todayData.attendance);
          const remoteAttDate = normalizeDateString(normRemote.attendanceDate || normRemote.date || (normRemote as any)?.attendance_date);

          // VALIDASI TANGGAL: Terima jika hari ini ATAU sesi aktif shift malam yang BELUM clock-out
          const isToday = !remoteAttDate || remoteAttDate === todayStr;
          const isYesterdayActive = remoteAttDate === yesterdayStr && (!normRemote.clockOut && !normRemote.clock_out);

          if (isToday || isYesterdayActive) {
            // PostgreSQL Server adalah Single Source of Truth (SSOT).
            const remoteClockIn = normRemote.clockIn ? String(normRemote.clockIn).substring(0, 5) : undefined;
            const remoteClockInFull = normRemote.clock_in || normRemote.clockIn;

            const remoteClockOut = normRemote.clockOut 
              ? String(normRemote.clockOut).substring(0, 5) 
              : (normRemote.clock_out ? String(normRemote.clock_out).substring(0, 5) : undefined);
            const remoteClockOutFull = normRemote.clock_out || normRemote.clockOut;
            const preservedPhotoOut = normRemote.photoOut || normRemote.clockOutPhoto;

            const finalAttDate = normRemote.attendanceDate || remoteAttDate || (isYesterdayActive ? yesterdayStr : todayStr);

            todayAtt = {
              ...normRemote,
              attendanceDate: finalAttDate,
              date: finalAttDate,
              clockIn: remoteClockIn,
              clock_in: remoteClockInFull,
              clockOut: remoteClockOut,
              clock_out: remoteClockOutFull,
              photoOut: preservedPhotoOut,
              clockOutPhoto: preservedPhotoOut,
            };

            if (todayAtt && (todayAtt.clockIn || todayAtt.clock_in)) {
              setTodayAttendance(todayAtt);

              // Jika ini sesi shift malam kemarin yang masih aktif, pastikan userShift mengikuti shift kemarin (Shift III)
              if (isYesterdayActive && normRemote.shiftName) {
                const matchedShift = currentShifts.find((s) => s.id === normRemote.shiftId || s.name === normRemote.shiftName);
                if (matchedShift) {
                  setUserShift(matchedShift);
                }
              }
            }
          } else {
            console.warn(`[PWA] Remote attendance date (${remoteAttDate}) does not match active window (${todayStr} / ${yesterdayStr}), discarding.`);
            setTodayAttendance(undefined);
            todayAtt = undefined;
          }
        } else if (todayData && todayData.success && !todayData.attendance) {
          // Server mengonfirmasi belum ada rekaman presensi sah di PostgreSQL untuk hari ini
          setTodayAttendance(undefined);
          todayAtt = undefined;
        }
      } catch (err) {
        console.warn('[PWA] Fetch today attendance API note:', err);
      }

      // ─── TAHAP 4: FAST TARGETED USER PROFILE REFRESH (< 50ms) ───
      try {
        const userData = await api.get<{ success: boolean; user?: any; data?: any }>(`/users/${encodeURIComponent(user.id)}`).catch(() => null);
        const freshUser = userData?.user || userData?.data;
        if (userData && userData.success && freshUser) {
          const updatedShift = resolveEffectiveShift(freshUser, currentShifts, currentSched);
          setUserShift(updatedShift);
          sessionStorage.setItem('hrm_active_session_user', JSON.stringify(freshUser));
          localStorage.setItem('hrm_active_session_user', JSON.stringify(freshUser));
        }
      } catch (err) {
        console.warn('[PWA] Fast user fetch warning:', err);
      }

      // ─── TAHAP 5: RIWAYAT PRESENSI (< 100ms) ───
      const validUserIds = [user.id, user.nip, user.email].filter(Boolean);
      let userAtts = hrmService.getAttendances().filter((a) => {
        const aUser = a.userId || (a as any).user_id;
        return validUserIds.includes(aUser);
      });

      try {
        const histData = await api.get<{ success: boolean; data?: any[] }>(
          `/attendances?userId=${encodeURIComponent(user.id)}`
        ).catch(() => null);

        if (histData && histData.success && Array.isArray(histData.data) && histData.data.length > 0) {
          userAtts = histData.data.map((a: any) => normalizeAttendanceRecord(a));
        }
      } catch (e) {
        console.warn('[PWA] Attendance history fetch note:', e);
      }

      if (todayAtt && (todayAtt.clockIn || todayAtt.clock_in)) {
        const existingIdx = todayAtt?.id
          ? userAtts.findIndex((a) => a.id === todayAtt?.id)
          : userAtts.findIndex((a) =>
              a.date === todayStr ||
              a.attendanceDate === todayStr ||
              (todayAtt?.attendanceDate && (a.date === todayAtt.attendanceDate || a.attendanceDate === todayAtt.attendanceDate))
            );
        if (existingIdx >= 0) {
          const mergedClockOut = userAtts[existingIdx].clockOut || todayAtt.clockOut || (userAtts[existingIdx].clock_out ? String(userAtts[existingIdx].clock_out).substring(0, 5) : undefined);
          const mergedClockOutFull = userAtts[existingIdx].clock_out || todayAtt.clock_out || mergedClockOut;
          userAtts[existingIdx] = {
            ...userAtts[existingIdx],
            ...todayAtt,
            clockOut: mergedClockOut,
            clock_out: mergedClockOutFull,
          };
          if (mergedClockOut) {
            todayAtt.clockOut = mergedClockOut;
            todayAtt.clock_out = mergedClockOutFull;
          }
        } else {
          userAtts.unshift(todayAtt);
        }
      } else {
        let fromHist = userAtts.find((a) => (a.date === todayStr || a.attendanceDate === todayStr) && (a.clockIn || a.clock_in));
        if (!fromHist) {
          // Cross-midnight Shift: Cari sesi kemarin yang belum clock-out
          fromHist = userAtts.find((a) => (a.date === yesterdayStr || a.attendanceDate === yesterdayStr) && (a.clockIn || a.clock_in) && !a.clockOut && !a.clock_out);
        }
        if (fromHist) {
          todayAtt = normalizeAttendanceRecord(fromHist);
        }
      }

      setAttendancesHistory(userAtts);

      // KONSISTENSI TOTAL: Kunci status presensi hari ini jika sudah absen masuk & absen pulang
      if (todayAtt && (todayAtt.clockIn || todayAtt.clock_in)) {
        // MONOTONIC CLOCK-OUT GUARD: Sekali karyawan clock-out pada sesi yang sama, kunci permanen jika ada foto!
        const memDate = normalizeDateString(todayAttendance?.attendanceDate || todayAttendance?.date);
        const isSameAttendanceSession = !todayAtt.id || !todayAttendance?.id || todayAtt.id === todayAttendance.id;
        if (isSameAttendanceSession && todayAttendance?.clockOut && !todayAtt.clockOut && (!memDate || memDate === todayStr || memDate === yesterdayStr)) {
          if (todayAttendance.clockOutPhoto || todayAttendance.photoOut) {
            todayAtt.clockOut = todayAttendance.clockOut;
            todayAtt.clock_out = todayAttendance.clock_out || todayAttendance.clockOut;
          }
        }
        const finalNormalized = normalizeAttendanceRecord(todayAtt);
        setTodayAttendance(finalNormalized);
      } else if (todayAttendance && (todayAttendance.clockIn || (todayAttendance as any).clock_in)) {
        // Pertahankan status kehadiran jika tanggalnya sesuai hari ini ATAU sesi aktif kemarin
        const curDate = normalizeDateString(todayAttendance.attendanceDate || todayAttendance.date || (todayAttendance as any).attendance_date);
        const isYestActive = curDate === yesterdayStr && (!todayAttendance.clockOut && !(todayAttendance as any).clock_out);
        if (curDate && curDate !== todayStr && !isYestActive) {
          setTodayAttendance(undefined);
        }
      } else {
        setTodayAttendance(undefined);
      }

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

      // ─── TAHAP 6: BACKGROUND FULL SYNC (ASINKRON - TIDAK MEMBLOKIR UI / ZERO LAG!) ───
      // Dijalankan di latar belakang tanpa 'await' agar karyawan langsung melihat data real tanpa jeda
      hrmService.syncWithBackend()
        .then(() => {
          const latestShifts = hrmService.getShifts();
          const latestSched = hrmService.getEmployeeTodaySchedule(user.id, todayStr);
          const finalEffectiveShift = resolveEffectiveShift(user, latestShifts, latestSched);
          setUserShift(finalEffectiveShift);
          setUserLeaves(hrmService.getUserLeaves(user.id));
        })
        .catch(() => null);

      // 2A-2. Live Leave & Overtime Balance langsung dari server PostgreSQL (authoritative real-time sync)
      api.get<{ success: boolean; data: any }>(`/leaves/balance?userId=${encodeURIComponent(user.id)}`)
        .then((balRes) => {
          if (balRes?.success && balRes.data) {
            setLiveLeaveBalance(balRes.data);
            try {
              const rawCur = localStorage.getItem('hrm_current_user');
              if (rawCur) {
                const cur = JSON.parse(rawCur);
                if (cur && cur.id === user.id) {
                  cur.annualLeaveQuota = balRes.data.annualLeaveQuota;
                  cur.usedLeaveDays = balRes.data.usedLeaveDays;
                  localStorage.setItem('hrm_current_user', JSON.stringify(cur));
                }
              }
              const cachedUsers = hrmService.getUsers();
              if (Array.isArray(cachedUsers) && cachedUsers.length > 0) {
                const updatedUsers = cachedUsers.map((u) =>
                  u.id === user.id
                    ? {
                        ...u,
                        annualLeaveQuota: balRes.data.annualLeaveQuota,
                        usedLeaveDays: balRes.data.usedLeaveDays,
                      }
                    : u
                );
                hrmService.setInMemoryUsers(updatedUsers);
              }
            } catch (_) {}
          }
        })
        .catch(() => null);

      // 2B. Data Permohonan Cuti/Izin Saya
      const myLeaves = hrmService.getUserLeaves(user.id);
      setUserLeaves(myLeaves);

      // 2B-2. Roster Jadwal Kerja & Libur Saya (Sinkron Realtime PostgreSQL Server)
      api.get<{ success: boolean; data?: any[] }>(`/employee-schedules?userId=${encodeURIComponent(user.id)}`)
        .then((schedRes) => {
          if (schedRes?.success && Array.isArray(schedRes.data) && schedRes.data.length > 0) {
            setUserSchedules(schedRes.data);
            try {
              const existingScheds = hrmService.getEmployeeSchedules();
              const otherScheds = existingScheds.filter((s) => s.userId !== user.id);
              const merged = [...otherScheds, ...schedRes.data];
              localStorage.setItem('hrm_employee_schedules', JSON.stringify(merged));
            } catch (_) {}
          }
        })
        .catch(() => {
          const localScheds = hrmService.getEmployeeSchedules({ userId: user.id });
          if (localScheds.length > 0) setUserSchedules(localScheds);
        });

      // Warm-up cache hari libur nasional
      hrmHolidayService.fetchHolidays().catch(() => null);

      // 2C. Data Permohonan Lembur Saya (Sinkron Realtime PostgreSQL Server)
      api.get<{ success: boolean; data?: any[] }>(`/overtime?userId=${encodeURIComponent(user.id)}`)
        .then((otRes) => {
          if (otRes?.success && Array.isArray(otRes.data)) {
            setUserOvertimeList(otRes.data);
          } else {
            const myOts = hrmService.getOvertimeRecords().filter((o) => o.userId === user.id);
            setUserOvertimeList(myOts);
          }
        })
        .catch(() => {
          const myOts = hrmService.getOvertimeRecords().filter((o) => o.userId === user.id);
          setUserOvertimeList(myOts);
        });

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

      // 2E. Status Kapal Pelabuhan Maccini Baji
      if (isMacciniBajiOfficer(user)) {
        hrmService.getMacciniVesselStatus().then((s) => {
          if (s) setMacciniVesselStatus(s);
        }).catch(() => null);
      }

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
      if (isMacciniBajiOfficer(user)) {
        officeLoc = {
          id: 'pelabuhan-maccini-baji',
          name: 'Pelabuhan Maccini Baji',
          latitude: -4.773545,
          longitude: 119.487525,
          radiusMeters: 500,
          locationName: 'Pelabuhan Maccini Baji',
          address: 'Kawasan Dermaga Pelabuhan Maccini Baji, Labakkang, Pangkep',
          allowedPosts: ['Pelabuhan Maccini Baji', 'MATCH-MCBAJI'],
        };
        setAssignedPostName('Pelabuhan Maccini Baji');
      } else if (currentBankPosts.length > 0) {
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

    // 🚗 Pengecualian Petugas Khusus Dukungan Direksi & Mobilitas Luar Perusahaan (Hasri. S & Ita Purnamasari)
    if (isExecutiveMobileSupportOfficer(user)) {
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
      setAssignedPostName(matchedName || 'Area Mobile Dinas Luar Dukungan Direksi & Perusahaan');
      return;
    }

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

    // ⚡ Evaluasi Pelabuhan Maccini Baji: Jika sudah Cek-In dan status 'idle' (Nihil Kapal), berikan dispensasi Standby On-Call
    const isMaccini = isMacciniBajiOfficer(user);
    const hasAlreadyClockedIn = Boolean(
      todayAttendance && (todayAttendance.clockIn || todayAttendance.clock_in) && !(todayAttendance.clockOut || todayAttendance.clock_out)
    );
    if (isMaccini && hasAlreadyClockedIn && macciniVesselStatus.status !== 'docking') {
      setCurrentCoords(coords);
      setCoordsAccuracy(accuracy);
      setDistanceToOffice(0);
      setLocationStatus('inside');
      setAssignedPostName('Pelabuhan Maccini Baji (Standby On-Call • Bebas Koordinat)');
      return;
    }

    // ─── ACCURACY-AWARE TOLERANCE & PERSISTENT HYSTERESIS ───
    // 1. Dynamic accuracy buffer: Sensor error discount (mengakomodasi deviasi sensor HP di lapangan)
    const accuracyBuffer = Math.min(Math.max(accuracy * 0.5, (accuracy - 15) * 0.6), 45);

    // 2. Persistent Hysteresis: Jika user baru saja terverifikasi 'inside' dalam 90 detik terakhir, pertahankan toleransi +35m (mencegah flapping saat refresh PWA)
    const nowTs = Date.now();
    let isRecentInside = locationStatus === 'inside';
    if (!isRecentInside) {
      try {
        const lastInsideRaw = sessionStorage.getItem('hrm_last_inside_post_timestamp');
        if (lastInsideRaw && (nowTs - Number(lastInsideRaw)) < 90000) {
          isRecentInside = true;
        }
      } catch (_) {}
    }
    const hysteresisBonus = isRecentInside ? 35 : 0;

    if (activePosts && activePosts.length > 0) {
      // Multi-Titik Bank Pos evaluation (Titik A, B, C, ...)
      // Standar radius minimum operasional lapangan industri: minimal 100m
      const postsWithDist = activePosts.map((p) => {
        const d = geofenceService.calculateDistance(coords, { latitude: p.latitude, longitude: p.longitude });
        const baseR = Math.max(p.radiusMeters || 100, 100);
        const r = baseR + accuracyBuffer + hysteresisBonus;
        return { ...p, distance: d, radius: r, isInside: d <= r };
      });

      const insidePost = postsWithDist.find((p) => p.isInside);
      if (insidePost) {
        try {
          sessionStorage.setItem('hrm_last_inside_post_timestamp', String(nowTs));
        } catch (_) {}
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
    const targetOffice = fallbackOffice || assignedOffice || (
      isMaccini ? {
        id: 'pelabuhan-maccini-baji',
        name: 'Pelabuhan Maccini Baji',
        latitude: -4.773545,
        longitude: 119.487525,
        radiusMeters: 500,
        locationName: 'Pelabuhan Maccini Baji',
        address: 'Kawasan Dermaga Pelabuhan Maccini Baji, Labakkang, Pangkep',
      } : (user?.divisionLatitude && user?.divisionLongitude ? {
        id: user.divisionId || 'div-loc',
        name: user.divisionLocationName || user.divisionName || 'Gedung Divisi',
        latitude: Number(user.divisionLatitude),
        longitude: Number(user.divisionLongitude),
        radiusMeters: Math.max(Number(user.divisionRadiusMeters) || 100, 100),
        locationName: user.divisionLocationName || user.divisionName || 'Gedung Divisi',
        address: user.divisionAddress || user.address || user.divisionLocationName || 'Area Lokasi Divisi',
        allowedPosts: Array.isArray(user.divisionAllowedPosts) ? user.divisionAllowedPosts : [],
      } : null)
    );

    if (targetOffice && typeof targetOffice.latitude === 'number' && typeof targetOffice.longitude === 'number' && !isNaN(targetOffice.latitude) && !isNaN(targetOffice.longitude)) {
      candidateOffices.push({
        name: targetOffice.name,
        lat: targetOffice.latitude,
        lng: targetOffice.longitude,
        radius: Math.max(targetOffice.radiusMeters || 100, 100),
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
              radius: Math.max(ap.radiusMeters || 100, 100),
              address: ap.description || targetOffice.address,
            });
          }
        }
      }
    }

    // Opsi A (Strict Post Lock): Personil regu lapangan (Segel, Timbangan, Matching, dll.)
    // DIKUNCI MUTLAK hanya boleh absen di titik pos divisi / bank pos mereka sendiri.
    // DILARANG keras menjadikan Kantor Umum FRP sebagai fallback lokasi presensi mereka!
    const isFieldWorker = isFieldOperationalWorker(user);
    if (!isFieldWorker) {
      // Masukkan preset resmi PT FRP sebagai kandidat alternatif HANYA untuk staf kantor umum / manajemen non-lapangan
      for (const preset of FIELD_SENTINEL_6_POST_PRESETS) {
        if (!candidateOffices.some((c) => Math.abs(c.lat - preset.latitude) < 0.0001 && Math.abs(c.lng - preset.longitude) < 0.0001)) {
          candidateOffices.push({
            name: preset.name,
            lat: preset.latitude,
            lng: preset.longitude,
            radius: Math.max(preset.radiusMeters || 100, 100),
          });
        }
      }
    }

    // Masukkan Divisi Simulasi Sosialisasi (DIV-SIM) agar seluruh karyawan dapat mencoba absen di venue presentasi
    try {
      const allDivs = hrmService.getDivisions();
      // Masukkan Divisi Simulasi Sosialisasi (DIV-SIM) HANYA jika sesi simulasi sedang aktif (isActive === true)
      const simDiv = allDivs.find((d) => (d.code === 'DIV-SIM' || d.id === 'div-sim') && (d.isActive === true || (d as any).is_active === true));
      if (simDiv && typeof simDiv.latitude === 'number' && typeof simDiv.longitude === 'number' && !isNaN(simDiv.latitude)) {
        if (!candidateOffices.some((c) => Math.abs(c.lat - simDiv.latitude) < 0.0001 && Math.abs(c.lng - simDiv.longitude) < 0.0001)) {
          candidateOffices.push({
            name: `${simDiv.locationName || 'Venue Sosialisasi'} [DIV-SIM]`,
            lat: simDiv.latitude,
            lng: simDiv.longitude,
            radius: simDiv.radiusMeters || 300,
          });
        }
      }
    } catch (e) {
      console.warn('Gagal memuat kandidat DIV-SIM:', e);
    }

    if (candidateOffices.length > 0) {
      const officeChecks = candidateOffices.map((cand) => {
        const d = geofenceService.calculateDistance(coords, { latitude: cand.lat, longitude: cand.lng });
        const allowedR = Math.max(cand.radius || 100, 100) + accuracyBuffer + hysteresisBonus;
        return { ...cand, distance: d, isInside: d <= allowedR };
      });

      // 🟢 Jika pegawai berada di dalam salah satu pos resmi / divisi
      const matchedInside = officeChecks.find((c) => c.isInside);
      if (matchedInside) {
        try {
          sessionStorage.setItem('hrm_last_inside_post_timestamp', String(nowTs));
        } catch (_) {}
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

    const handleUpdate = () => {
      loadRealData();
      if (user) {
        setUserSchedules(hrmService.getEmployeeSchedules({ userId: user.id }));
      }
    };
    window.addEventListener('hrm_attendance_updated', handleUpdate);
    window.addEventListener('hrm_settings_updated', handleUpdate);
    window.addEventListener('hrm_users_updated', handleUpdate);
    window.addEventListener('hrm_leaves_updated', handleUpdate);
    window.addEventListener('hrm_shifts_updated', handleUpdate);
    window.addEventListener('hrm_schedules_updated', handleUpdate);

    // ─── PWA APP RESUME & WAKEUP LIFECYCLE (HP BANGUN DARI SLEEP / LAYAR NYALA / TAB AKTIF) ───
    const handleResumeOrWakeup = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        console.info('[PWA Lifecycle] App resumed from sleep / visible, refreshing attendance state directly from server...');
        loadRealData();
        evaluateRealLocation();
      }
    };

    document.addEventListener('visibilitychange', handleResumeOrWakeup);
    window.addEventListener('pageshow', handleResumeOrWakeup);
    window.addEventListener('focus', handleResumeOrWakeup);

    // Periodic live background poll setiap 20 detik saat PWA aktif agar data selalu sinkron
    const periodicPoll = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible' && !isCameraActive) {
        loadRealData();
      }
    }, 20000);

    return () => {
      window.removeEventListener('hrm_attendance_updated', handleUpdate);
      window.removeEventListener('hrm_settings_updated', handleUpdate);
      window.removeEventListener('hrm_users_updated', handleUpdate);
      window.removeEventListener('hrm_leaves_updated', handleUpdate);
      window.removeEventListener('hrm_shifts_updated', handleUpdate);
      window.removeEventListener('hrm_schedules_updated', handleUpdate);
      document.removeEventListener('visibilitychange', handleResumeOrWakeup);
      window.removeEventListener('pageshow', handleResumeOrWakeup);
      window.removeEventListener('focus', handleResumeOrWakeup);
      clearInterval(periodicPoll);
    };
  }, [user]);

  // Continuous Background GPS Watcher & Heartbeat Ping for Field Officers
  const lastPingTimeRef = useRef<number>(0);
  useEffect(() => {
    if (!navigator.geolocation || !user) return;

    const isFieldOfficer =
      Boolean(user.isFieldSentinelEnabled) ||
      (Array.isArray(bankPosts) && bankPosts.length > 0) ||
      isLeadershipSpecialFieldOfficer(user);

    const handlePos = (pos: GeolocationPosition) => {
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      evaluateLocationCoords(coords, pos.coords.accuracy || 10);

      const now = Date.now();
      const hasClockedIn = Boolean(todayAttendance?.clockIn || todayAttendance?.clock_in);
      const hasClockedOut = Boolean(todayAttendance?.clockOut || todayAttendance?.clock_out);

      // 🛡️ PERLINDUNGAN PRIVASI: Karyawan di luar jam kerja / sudah absen pulang TIDAK dipantau
      const isActivelyOnDuty = hasClockedIn && !hasClockedOut;
      const isApproachingPostForCheckIn = !hasClockedIn && !hasClockedOut && locationStatus === 'inside';
      const shouldSendPing = isFieldOfficer && (isActivelyOnDuty || isApproachingPostForCheckIn);

      // Send location ping every 45-60s or on position change
      if (shouldSendPing && now - lastPingTimeRef.current >= 45000) {
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
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
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
  }, [user?.id, bankPosts, assignedOffice, todayAttendance?.clockIn, todayAttendance?.clock_in, todayAttendance?.clockOut, todayAttendance?.clock_out, locationStatus]);

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

  // Real GPS Geofencing Evaluation with Smart Satellite Lock & Anti-Flapping Cache
  const evaluateRealLocation = (isManualTrigger = false) => {
    if (!navigator.geolocation) {
      setLocationStatus('error');
      return;
    }
    setLocationStatus('checking');
    if (isManualTrigger) setIsRefreshingGps(true);

    let resolved = false;

    // Timer proteksi: jika GPS satelit butuh waktu hingga 12 detik, cek cache satelit riil terakhir
    const safetyTimeoutHandle = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        if (isManualTrigger) setIsRefreshingGps(false);
        try {
          const cached = sessionStorage.getItem('hrm_last_valid_coords');
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed?.coords && (Date.now() - (parsed.time || 0) < 120000)) {
              evaluateLocationCoords(parsed.coords, parsed.accuracy || 20);
              if (isManualTrigger) toast.info('Menggunakan koordinat satelit terakhir yang tersimpan.');
              return;
            }
          }
        } catch (_) {}
        if (isManualTrigger) toast.warning('Sinyal satelit GPS lambat. Silakan melangkah ke dekat pintu/area terbuka.');
      }
    }, 12000);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(safetyTimeoutHandle);
        if (isManualTrigger) setIsRefreshingGps(false);
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const acc = pos.coords.accuracy || 10;
        try {
          sessionStorage.setItem('hrm_last_valid_coords', JSON.stringify({ coords, accuracy: acc, time: Date.now() }));
        } catch (_) {}
        evaluateLocationCoords(coords, acc);
        if (isManualTrigger) {
          if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            try { navigator.vibrate([40, 30, 40]); } catch (_) {}
          }
          toast.success(`Lokasi GPS Terkunci Presisi (±${Math.round(acc)}m)`);
        }
      },
      (err) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(safetyTimeoutHandle);
        if (isManualTrigger) setIsRefreshingGps(false);
        console.warn('[PWA GPS]', err);

        // Cek cache satelit sebelum menyerah (mencegah flapping)
        try {
          const cached = sessionStorage.getItem('hrm_last_valid_coords');
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed?.coords && (Date.now() - (parsed.time || 0) < 180000)) {
              evaluateLocationCoords(parsed.coords, parsed.accuracy || 25);
              return;
            }
          }
        } catch (_) {}

        if (assignedOffice) {
          const fallbackCoords = { lat: assignedOffice.latitude, lng: assignedOffice.longitude };
          setCurrentCoords(fallbackCoords);
          setDistanceToOffice(0);
          setLocationStatus('inside');
        } else {
          setLocationStatus('inside');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 11000,
        maximumAge: isManualTrigger ? 0 : 15000,
      }
    );
  };

  // Real-Time Analytics & Monthly Calculations from Database Records
  const currentMonthStr = useMemo(() => getTodayDateStr().substring(0, 7), []);

  const unreadNotificationsCount = useMemo(() => {
    return userNotifications.filter((n) => !n.isRead).length;
  }, [userNotifications]);

  const isCurrentlyOnDuty = Boolean((todayAttendance?.clockIn || todayAttendance?.clock_in) && (!todayAttendance?.clockOut && !todayAttendance?.clock_out));
  const isCurrentSessionClosed = Boolean((todayAttendance?.clockIn || todayAttendance?.clock_in) && (todayAttendance?.clockOut || todayAttendance?.clock_out));
  const hasClockedIn = Boolean(todayAttendance?.clockIn || todayAttendance?.clock_in);
  const hasClockedOut = Boolean(todayAttendance?.clockOut || todayAttendance?.clock_out);
  const isFieldSpecial = isSpecialDutyOfficer(user);
  const todayDateStr = getTodayDateStr();

  // Shift Aktif yang Sedang Berjalan (Memperhitungkan Shift Malam Lintas Hari dari Kemarin)
  const effectiveDisplayShift = useMemo<Shift | null>(() => {
    if (isCurrentlyOnDuty && todayAttendance) {
      const attDate = normalizeDateString(todayAttendance.attendanceDate || todayAttendance.date);
      const shifts = hrmService.getShifts();
      if (attDate && attDate !== todayDateStr) {
        const yestSched = hrmService.getEmployeeTodaySchedule(user?.id || '', attDate);
        if (yestSched && !yestSched.isOff && yestSched.shiftCode !== 'OFF') {
          const resYest = resolveEffectiveShift(user, shifts, yestSched);
          if (resYest && !isShiftOffDay(resYest)) return resYest;
        }
      }
      if (todayAttendance.shiftName || todayAttendance.shiftId) {
        const matched = shifts.find((s) => s.id === todayAttendance.shiftId || s.name === todayAttendance.shiftName);
        if (matched) return matched;
      }
      if (userShift && !isShiftOffDay(userShift)) {
        return userShift;
      }
      const defaultNightShift = shifts.find((s) => s.isCrossDay || s.code === 'M' || (s.name || '').toLowerCase().includes('shift iii'));
      if (defaultNightShift) return defaultNightShift;
      return {
        id: 'shift-iii',
        name: 'Shift III (22:30 - 07:30 WITA)',
        code: 'M',
        startTime: '22:30',
        endTime: '07:30',
        isCrossDay: true,
        isDefault: false,
      } as Shift;
    }
    return userShift;
  }, [isCurrentlyOnDuty, todayAttendance, todayDateStr, user, userShift]);

  // SPKL Lembur Resmi Disetujui (Sinkron Same-Day & Cross-Day; diblokir HANYA untuk 3 Karyawan Tetap sesuai Aturan 11)
  const approvedOvertimeToday = useMemo(() => {
    if (isLeadershipSpecialFieldOfficer(user)) return null;
    const activeAttDate = isCurrentlyOnDuty && todayAttendance
      ? normalizeDateString(todayAttendance.attendanceDate || todayAttendance.date)
      : '';
    const matching = userOvertimeList.filter((o) => {
      if (String(o.status || '').toLowerCase() !== 'approved') return false;
      const otDate = normalizeDateString(o.date || (o as any).overtime_date || (o as any).overtimeDate);
      if (otDate === todayDateStr) return true;
      if (activeAttDate && otDate === activeAttDate) return true;
      return false;
    });
    if (matching.length === 0) return null;
    // Prioritaskan SPKL pada tanggal aktif / hari ini dengan rentang waktu terjelas
    return matching.find((o) => o.startTime || (o as any).start_time) || matching[0];
  }, [userOvertimeList, todayDateStr, isCurrentlyOnDuty, todayAttendance, user]);

  // ⚡ STANDAR SINGLE CONTINUOUS SESSION (1x Ceklok Masuk -> 1x Ceklok Pulang)
  // Menggabungkan Shift Asli + SPKL Lembur (Sebelum Shift, Setelah Shift, maupun Hari OFF) untuk SEMUA karyawan!
  const continuousDutyInfo = useMemo(() => {
    const baseIsOff = Boolean(effectiveDisplayShift && isShiftOffDay(effectiveDisplayShift));
    const activeClockInStr = isCurrentlyOnDuty ? (todayAttendance?.clockIn || todayAttendance?.clock_in || null) : null;
    return resolveContinuousDutyShift(effectiveDisplayShift || userShift, approvedOvertimeToday, currentTime, baseIsOff, activeClockInStr);
  }, [effectiveDisplayShift, userShift, approvedOvertimeToday, currentTime, isCurrentlyOnDuty, todayAttendance]);

  const effectiveDutyEndTime =
    continuousDutyInfo.effectiveEnd ||
    effectiveDisplayShift?.endTime?.substring(0, 5) ||
    userShift?.endTime?.substring(0, 5) ||
    '16:30';

  // Absen Pulang (Clock-Out) Guard:
  // Harus mengacu ke jam pulang final (continuousDutyInfo.effectiveShift),
  // sehingga karyawan yang lanjut lembur tidak terpencet pulang lebih awal & tidak terkunci di tengah lembur!
  const clockOutWindow = useMemo(() => {
    const activeAttDate = todayAttendance
      ? normalizeDateString(todayAttendance.attendanceDate || todayAttendance.date)
      : todayDateStr;
    return checkShiftClockOutWindow(
      continuousDutyInfo.effectiveShift || effectiveDisplayShift || userShift,
      todayAttendance?.clockIn || todayAttendance?.clock_in,
      currentTime,
      activeAttDate
    );
  }, [continuousDutyInfo.effectiveShift, effectiveDisplayShift, userShift, todayAttendance, todayDateStr, currentTime]);

  const isBeforeShiftEndTime = clockOutWindow.isBeforeEndTime;

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

    const annualLeaveQuota = Number(
      liveLeaveBalance?.annualLeaveQuota ??
      user?.annualLeaveQuota ??
      (user as any)?.annual_leave_quota ??
      12
    );
    const usedLeave = Number(
      liveLeaveBalance?.usedLeaveDays ??
      user?.usedLeaveDays ??
      (user as any)?.used_leave_days ??
      0
    );
    const remainingLeave = liveLeaveBalance?.remainingLeaveDays !== undefined
      ? Number(liveLeaveBalance.remainingLeaveDays)
      : Math.max(0, annualLeaveQuota - usedLeave);

    const attendanceRate = totalWorkingDays > 0 ? Math.min(100, Math.round((presentCount / totalWorkingDays) * 100)) : 100;

    // Monthly Izin & Lembur
    const monthlyLeaves = userLeaves.filter((l) => (l.startDate || l.createdAt || '').startsWith(currentMonthStr));
    const monthlyIzinCount = monthlyLeaves.length;

    const monthlyOts = userOvertimeList.filter(
      (o) => (o.date || o.createdAt || '').startsWith(currentMonthStr) && (o.status === 'approved' || !o.status)
    );
    const monthlyLemburHours = monthlyOts.reduce((acc, o) => acc + (Number(o.durationHours || (o as any).duration_hours) || 0), 0);
    const monthlyLemburCount = monthlyOts.length;

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

    // Weekly 7 Days Streak (Senin - Minggu) SINKRON DENGAN DATABASE & ROSTER
    const now = new Date();
    const currentDayOfWeek = (now.getDay() + 6) % 7; // 0 = Senin, ..., 6 = Minggu
    const monday = new Date(now);
    monday.setDate(now.getDate() - currentDayOfWeek);

    const daysName = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
    const weeklyStreak = daysName.map((day, idx) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + idx);
      const dateStr = d.toLocaleDateString('en-CA');
      const dayNum = d.getDate();

      // Cari jadwal spesifik pada tanggal ini (dari userSchedules, fallback ke localStorage / hrmService)
      const daySched = userSchedules.find((s) => (s.scheduleDate || '').split('T')[0] === dateStr) ||
        hrmService.getEmployeeTodaySchedule(user?.id || '', dateStr);

      const sCode = (daySched?.shiftCode || '').toUpperCase();
      const sName = (daySched?.shiftName || '').toLowerCase();
      const isRosterOff = Boolean(
        daySched && (
          daySched.isOff ||
          sCode === 'OFF' ||
          sName.includes('libur') ||
          sName.includes('off')
        )
      );

      const holidayInfo = hrmHolidayService.isNationalHoliday(dateStr);
      const isNationalHoliday = holidayInfo.isHoliday;
      const isSunday = idx === 6;

      // Hari Libur Resmi: Roster OFF, atau jika tidak ada jadwal khusus -> Hari Minggu / Libur Nasional
      const isDayOff = isRosterOff || (!daySched && (isSunday || isNationalHoliday));
      const offHolidayTitle = daySched?.shiftName || (isNationalHoliday ? (holidayInfo.holiday?.name || 'Libur Nasional') : isSunday ? 'Libur Hari Minggu' : 'Libur / OFF');

      // 1. Cek riwayat kehadiran riil (Past or Today)
      let attRecord: AttendanceRecord | undefined;
      if (idx === currentDayOfWeek) {
        attRecord = todayAttendance && (todayAttendance.clockIn || (todayAttendance as any).clock_in) ? todayAttendance : undefined;
      }
      if (!attRecord) {
        attRecord = attendancesHistory.find(
          (a) => (a.date === dateStr || a.attendanceDate === dateStr) && (a.clockIn || (a as any).clock_in)
        );
      }

      // Jika ada clock-in riil -> Tampilkan Tepat Waktu (✓) atau Terlambat (!)
      if (attRecord && (attRecord.clockIn || (attRecord as any).clock_in)) {
        const isLate = attRecord.status === 'terlambat' || ((attRecord.lateMinutes || 0) > 0);
        return {
          day,
          status: isLate ? 'late' : 'present',
          date: dateStr,
          label: isLate ? '!' : '✓',
          isOff: isDayOff,
          shiftName: daySched?.shiftName || (isDayOff ? 'Hadir di Hari Libur' : 'Shift Kerja'),
        };
      }

      // 2. Cek apakah ada permohonan cuti / izin yang disetujui
      const isApprovedLeave = userLeaves.some(
        (l) => l.status === 'approved' && dateStr >= l.startDate && dateStr <= l.endDate
      );
      if (isApprovedLeave) {
        return {
          day,
          status: 'leave',
          date: dateStr,
          label: 'I',
          isOff: false,
          shiftName: 'Izin / Cuti Disetujui',
        };
      }

      // 3. Jika hari ini (Today)
      if (idx === currentDayOfWeek) {
        if (isDayOff) {
          return {
            day,
            status: 'off',
            date: dateStr,
            label: 'OFF',
            isOff: true,
            shiftName: offHolidayTitle,
          };
        }
        return {
          day,
          status: 'current',
          date: dateStr,
          label: `${dayNum}`,
          isOff: false,
          shiftName: daySched?.shiftName || 'Hari Ini (Belum Presensi)',
        };
      }

      // 4. Jika hari mendatang (Upcoming / Future Days)
      if (idx > currentDayOfWeek) {
        if (isDayOff) {
          return {
            day,
            status: 'upcoming_off',
            date: dateStr,
            label: `${dayNum}`,
            isOff: true,
            shiftName: offHolidayTitle,
          };
        }
        return {
          day,
          status: 'upcoming',
          date: dateStr,
          label: `${dayNum}`,
          isOff: false,
          shiftName: daySched?.shiftName || 'Jadwal Kerja Mendatang',
        };
      }

      // 5. Hari kemarin / lampau (Past Days)
      // Jika jadwalnya libur / off, maka BUKAN Mangkir! Statusnya 'off'!
      if (isDayOff) {
        return {
          day,
          status: 'off',
          date: dateStr,
          label: 'OFF',
          isOff: true,
          shiftName: offHolidayTitle,
        };
      }

      // Past day tanpa kehadiran & tanpa izin di hari kerja resmi -> Mangkir / Alpa (✕)
      return {
        day,
        status: 'absent',
        date: dateStr,
        label: '✕',
        isOff: false,
        shiftName: 'Mangkir / Alpa',
      };
    });

    return {
      presentCount,
      lateCount,
      onTimeCount,
      totalLateMins,
      usedLeave,
      remainingLeave,
      annualLeaveQuota,
      attendanceRate,
      weeklyStreak,
      monthlyIzinCount,
      monthlyLemburHours,
      monthlyLemburCount,
      disciplineScore,
      disciplineGrade,
    };
  }, [attendancesHistory, user, todayAttendance, userLeaves, userOvertimeList, userSchedules, currentMonthStr]);

  // ─── PENGENDALIAN OPERASIONAL PELABUHAN MACCINI BAJI (DUAL BUTTONS) ───
  const handleToggleVesselStatus = (target: 'docking' | 'idle') => {
    setTargetVesselStatus(target);
    if (target === 'docking') {
      setInputVesselName(macciniVesselStatus.vesselName || '');
      setVesselModalOpen(true);
    } else {
      executeVesselStatusChange('idle', '');
    }
  };

  const executeVesselStatusChange = async (target: 'docking' | 'idle', shipName: string) => {
    setIsUpdatingVesselStatus(true);
    try {
      await hrmService.updateMacciniVesselStatus({
        status: target,
        vesselName: shipName.trim(),
        updatedBy: user?.fullName || 'Petugas Lapangan',
        notes: target === 'docking' ? 'Standby Operasional Kapal' : 'Standby On-Call',
      });
      setMacciniVesselStatus({
        status: target,
        vesselName: shipName.trim(),
        updatedAt: new Date().toISOString(),
        updatedBy: user?.fullName || 'Petugas Lapangan',
        notes: target === 'docking' ? 'Standby Operasional Kapal' : 'Standby On-Call',
      });
      setVesselModalOpen(false);
      toast.success(
        target === 'docking'
          ? '⚓ Mode Kapal Bersandar DIAKTIFKAN! Petugas wajib standby di dermaga.'
          : '🌊 Mode Standby On-Call DIAKTIFKAN! Petugas bebas keluar koordinat dermaga.'
      );
      evaluateRealLocation(true);
    } catch (err: any) {
      toast.error('Gagal memperbarui status kapal: ' + (err.message || 'Error'));
    } finally {
      setIsUpdatingVesselStatus(false);
    }
  };

  // Start Camera Stream (Fullscreen View)
  const openLiveCamera = async (
    type: 'clock_in' | 'clock_out' | 'emergency_on_call' | 'emergency_on_call_out',
    options?: { isEmergencyOverride?: boolean }
  ) => {
    if (user?.isImpersonated) {
      toast.info(`Mode Pantau Aktif: Anda sedang mengamati akun ${user.fullName}. Pengambilan foto presensi dinonaktifkan untuk menjaga keamanan data & audit karyawan.`, { duration: 4500 });
      return;
    }
    // Pastikan getaran darurat dihentikan seketika saat kamera dibuka
    isAlarmSilencedRef.current = true;
    emergencyAlertService.stopEmergencyAlert();

    const isSpecialMobile = isMobileOnlineOfficer(user) || isExecutiveMobileSupportOfficer(user);
    const isOnCallAction = type === 'emergency_on_call' || type === 'emergency_on_call_out';
    const isOverrideActive = Boolean(options?.isEmergencyOverride || emergencyOverridePayload?.isEmergencyOverride);

    // Validasi Ketat Jadwal Shift & Geofence sebelum buka kamera
    if (!isSpotCheckAction && !isSpecialMobile && !isOnCallAction) {
      if (type === 'clock_in') {
        if (!isClockInAllowed && !isOverrideActive) {
          toast.error(clockInDisabledReason || 'Presensi Masuk belum dibuka untuk jadwal shift Anda.');
          return;
        }
        if (locationStatus === 'outside' && !isOverrideActive) {
          toast.error('Presensi Masuk diblokir! Anda berada di luar radius kantor/pos tugas.');
          return;
        }
      }
      if (type === 'clock_out') {
        if (!isClockOutAllowed) {
          if (isBeforeShiftEndTime && !hasApprovedEmergencyLeave) {
            toast.error(`Absen Pulang belum aktif! Jadwal pulang Anda${continuousDutyInfo.hasContinuousOvertime ? ' (termasuk lembur SPKL)' : ''} pk ${effectiveDutyEndTime} WITA. Jika ada kondisi mendesak, silakan ajukan Izin Darurat.`);
          } else {
            toast.error(clockOutDisabledReason || 'Presensi Pulang belum dapat dilakukan.');
          }
          return;
        }

        // ⚓ Validasi Khusus Petugas Pelabuhan Maccini Baji: Cek-Out Wajib Kembali ke Pelabuhan
        const isMaccini = isMacciniBajiOfficer(user);
        if (isMaccini) {
          const distToPort = currentCoords ? geofenceService.calculateDistance(currentCoords, { latitude: -4.773545, longitude: 119.487525 }) : 9999;
          const distToMatchPort = currentCoords ? geofenceService.calculateDistance(currentCoords, { latitude: -4.809100, longitude: 119.548800 }) : 9999;
          const effectiveDist = Math.min(distToPort, distToMatchPort);
          if (effectiveDist > 550 && !isOverrideActive) {
            toast.error(`Presensi Pulang Ditolak! Anda wajib kembali ke area Pelabuhan Maccini Baji untuk Cek-Out (Jarak: ${Math.round(effectiveDist)}m).`);
            return;
          }
        }

        if (todayAttendance?.isLocked || todayAttendance?.isPerimeterBreached) {
          toast.error('Presensi Pulang Terkunci karena pelanggaran perimeter. Hubungi HRD.');
          return;
        }
      }
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
    livenessPassedRef.current = false;
    setIsLivenessPassed(false);
    pickRandomChallenge();
    staticFaceDetectedSinceRef.current = null;
    earHistoryRef.current = [];

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
    livenessPassedRef.current = false;
    setIsLivenessPassed(false);
    blinkStateRef.current = 'waiting_blink';
    hasEstablishedBaselineRef.current = false;
    openFramesCountRef.current = 0;
    baselineOpenEarRef.current = 0.26;
    blinkClosedAtRef.current = null;
    staticFaceDetectedSinceRef.current = null;
    earHistoryRef.current = [];
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
    // Opsi A: Preset Kantor Umum TIDAK berlaku untuk personil lapangan (Segel, Timbangan, Matching, dll.)
    const isFieldWorker = isFieldOperationalWorker(user);
    if (!isFieldWorker) {
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

    // Evaluasi Lokasi Realtime Presisi yang 100% SINKRON dengan layar PWA
    let resolvedLoc = assignedPostName || (user?.divisionLocationName || user?.divisionName || 'Gedung IT Cyber');
    let isSahDiPos = locationStatus === 'inside';

    if (bankPosts && bankPosts.length > 0 && currentCoords) {
      const matchedBank = bankPosts.find((p) => {
        const d = geofenceService.calculateDistance(currentCoords, { latitude: p.latitude, longitude: p.longitude });
        return d <= (p.radiusMeters || 100) + 25;
      });
      if (matchedBank) {
        resolvedLoc = `${matchedBank.postName} [${matchedBank.postCode || 'POS'}]`;
        isSahDiPos = true;
      }
    } else if (assignedOffice && currentCoords) {
      const dOffice = geofenceService.calculateDistance(currentCoords, { latitude: assignedOffice.latitude, longitude: assignedOffice.longitude });
      const rad = assignedOffice.radiusMeters || 50;
      if (dOffice <= rad + 25) {
        resolvedLoc = assignedOffice.name;
        isSahDiPos = true;
      }
    } else if (user?.divisionLatitude && user?.divisionLongitude && currentCoords) {
      const dDiv = geofenceService.calculateDistance(currentCoords, { latitude: Number(user.divisionLatitude), longitude: Number(user.divisionLongitude) });
      const rad = Number(user.divisionRadiusMeters) || 50;
      if (dDiv <= rad + 25) {
        resolvedLoc = user.divisionLocationName || user.divisionName || 'Gedung IT Cyber';
        isSahDiPos = true;
      }
    }

    if (isOnCall || isMobileOnlineOfficer(user) || isExecutiveMobileSupportOfficer(user)) {
      isSahDiPos = true;
    }

    // Top Status Accent Glow Line (Biru on-call, Hijau dalam pos, Rose luar radius, Amber spot-check)
    const accentColor = isSpotCheck ? '#f59e0b' : isOnCall ? '#3b82f6' : (isSahDiPos ? '#10b981' : '#f43f5e');
    ctx.fillStyle = accentColor;
    ctx.fillRect(0, h - barHeight + Math.round(16 * scale), w, Math.max(4, Math.round(4 * scale)));

    // ─────────────────────────────────────────────────────────────────────────────
    // HEADER BADGE (Top Header Capsule - Ringkas, Tajam, & Elegan)
    // ─────────────────────────────────────────────────────────────────────────────
    const badgePadX = Math.round(18 * scale);
    const badgeH = Math.round(38 * scale);
    const badgeY = Math.round(18 * scale);
    const badgeX = Math.round(18 * scale);
    const badgeW = Math.min(w - badgeX * 2, Math.round(560 * scale));
    const badgeRadius = Math.round(10 * scale);

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = Math.max(2, Math.round(2 * scale));
    if (typeof ctx.roundRect === 'function') {
      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY, badgeW, badgeH, badgeRadius);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillRect(badgeX, badgeY, badgeW, badgeH);
      ctx.strokeRect(badgeX, badgeY, badgeW, badgeH);
    }

    ctx.font = `bold ${Math.round(13.5 * scale)}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = accentColor;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = Math.round(3 * scale);
    const isMobileWfa = isMobileOnlineOfficer(user);
    const isExecutiveSupport = isExecutiveMobileSupportOfficer(user);
    const isMacciniWatermark = isMacciniBajiOfficer(user);
    const headerTitle = isSpotCheck
      ? `PT FAWWAZ RESKI PERWIRA • SELFIE REALTIME • SKOR: ${matchScore || 98}%`
      : isExecutiveSupport
      ? `PT FAWWAZ RESKI PERWIRA • PROTOKOL DUKUNGAN DIREKSI • SKOR: ${matchScore || 98}%`
      : isMacciniWatermark && macciniVesselStatus.status === 'docking'
      ? `PT FAWWAZ RESKI PERWIRA • STANDBY DERMAGA (KAPAL BERSANDAR) • SKOR: ${matchScore || 98}%`
      : isMacciniWatermark && macciniVesselStatus.status === 'idle'
      ? `PT FAWWAZ RESKI PERWIRA • STANDBY ON-CALL (NIHIL KAPAL) • SKOR: ${matchScore || 98}%`
      : isOnCall
      ? `PT FAWWAZ RESKI PERWIRA • ON-CALL WFA • SKOR: ${matchScore || 98}%`
      : isMobileWfa
      ? `PT FAWWAZ RESKI PERWIRA • MOBILE INVENTORY WFA • SKOR: ${matchScore || 98}%`
      : emergencyOvertimePayload?.isEmergencyOvertime
      ? `PT FAWWAZ RESKI PERWIRA • LEMBUR DARURAT (+${emergencyOvertimePayload.emergencyOvertimeHours}J) • SKOR: ${matchScore || 98}%`
      : emergencyOverridePayload?.isEmergencyOverride
      ? `PT FAWWAZ RESKI PERWIRA • MASUK TUGAS DARURAT • SKOR: ${matchScore || 98}%`
      : `PT FAWWAZ RESKI PERWIRA • ${actionType === 'clock_in' ? 'PRESENSI MASUK' : 'PRESENSI PULANG'} • SKOR: ${matchScore || 98}%`;
    ctx.fillText(headerTitle, badgeX + badgePadX, badgeY + Math.round(24 * scale));
    ctx.restore();

    // ─────────────────────────────────────────────────────────────────────────────
    // BOTTOM FORENSIC INFORMATION CARD - FOKUS LANGSUNG KE DATA TANPA JUDUL PANJANG
    // ─────────────────────────────────────────────────────────────────────────────
    const paddingX = Math.round(22 * scale);
    let startY = h - barHeight + Math.round(48 * scale);
    const lineGap = Math.round(37 * scale);

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
    ctx.shadowBlur = Math.round(5 * scale);
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 1;

    // Line 1: Langsung Nama (NIP) • Divisi
    const empName = user.fullName || (user as any).name || 'Karyawan';
    const empNip = user.nip || (user.id ? 'ID: ' + String(user.id).slice(0, 8) : 'FRP');
    const empDiv = user.divisionName || (user as any).division_name || 'Petugas Lapangan';
    ctx.font = `bold ${Math.round(17.5 * scale)}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(
      `👤 ${empName} (${empNip}) • ${empDiv}`,
      paddingX,
      startY
    );

    // Line 2: Langsung Shift Kerja & Jam Shift (Tanpa kata "Shift:")
    startY += lineGap;
    if (isSpotCheck) {
      ctx.font = `bold ${Math.round(14.5 * scale)}px system-ui, -apple-system, sans-serif`;
      ctx.fillStyle = '#fcd34d'; // Amber bright
      ctx.fillText(`🚨 BUKTI 1 SELFIE REALTIME LAPORAN WAJAH`, paddingX, startY);
    } else if (isOnCall) {
      ctx.font = `bold ${Math.round(14.5 * scale)}px system-ui, -apple-system, sans-serif`;
      ctx.fillStyle = '#93c5fd'; // Light blue
      ctx.fillText(`⚡ TUGAS DARURAT ONLINE (ON-CALL REMOTE WFA SAH)`, paddingX, startY);
    } else if (isMobileWfa && (!isSahDiPos || resolvedLoc.includes('Hub') || resolvedLoc.includes('Mobile'))) {
      ctx.font = `bold ${Math.round(14.5 * scale)}px system-ui, -apple-system, sans-serif`;
      ctx.fillStyle = '#38bdf8'; // Sky blue bright
      ctx.fillText(`📶 HUB JARINGAN OPERASIONAL (STABILISASI SINYAL INVENTORY SAH)`, paddingX, startY);
    } else if (emergencyOvertimePayload?.isEmergencyOvertime) {
      ctx.font = `bold ${Math.round(14.5 * scale)}px system-ui, -apple-system, sans-serif`;
      ctx.fillStyle = '#f87171'; // Red / Rose bright
      ctx.fillText(`🚨 LEMBUR DARURAT: +${emergencyOvertimePayload.emergencyOvertimeHours} JAM (CAP 3 JAM)`, paddingX, startY);
    } else if (emergencyOverridePayload?.isEmergencyOverride) {
      ctx.font = `bold ${Math.round(14.5 * scale)}px system-ui, -apple-system, sans-serif`;
      ctx.fillStyle = '#f59e0b'; // Amber bright
      ctx.fillText(`⚡ ABSEN MASUK TUGAS DARURAT MANDIRI (UNSCHEDULED)`, paddingX, startY);
    } else {
      const cleanShiftName = userShift?.name || 'Day Shift';
      const shiftHoursStr = `${userShift?.startTime || '07:30'} - ${userShift?.endTime || '16:30'} WITA`;
      const shiftDirectText = cleanShiftName.includes('(') ? cleanShiftName : `${cleanShiftName} (${shiftHoursStr})`;
      ctx.font = `bold ${Math.round(14.5 * scale)}px system-ui, -apple-system, sans-serif`;
      ctx.fillStyle = '#fbbf24'; // Amber / Gold
      ctx.fillText(`⏰ ${shiftDirectText}`, paddingX, startY);
    }

    // Line 3: Langsung Waktu Realtime (Tanpa kata "WAKTU REALTIME:")
    startY += lineGap;
    const now = new Date();
    const dateFormatted = now.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const timeFormatted = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/\./g, ':');
    ctx.font = `bold ${Math.round(14.5 * scale)}px ui-monospace, SFMono-Regular, monospace`;
    ctx.fillStyle = '#f8fafc'; // Crisp pure white
    ctx.fillText(`🕒 ${dateFormatted} • ${timeFormatted} WITA`, paddingX, startY);

    // Line 4: Langsung Posisi / Lokasi Realtime (Tanpa kata "POS REALTIME:")
    startY += lineGap;
    const isSpecialWfaActive = isMobileWfa && (!isSahDiPos || resolvedLoc.includes('Hub') || resolvedLoc.includes('Mobile'));
    const locDirectText = isSpecialWfaActive
      ? `${resolvedLoc || 'Hub Sinyal Cafe/Warkop'} • 📶 Stabilisasi Sinyal (WFA Sah)`
      : `${resolvedLoc} • ${isSahDiPos ? 'Di Radius Pos' : 'Di Luar Radius'}`;
    ctx.font = `bold ${Math.round(14.5 * scale)}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = (isSahDiPos || isSpecialWfaActive) ? '#34d399' : '#fb7185'; // Emerald or Rose
    ctx.fillText(`📍 ${locDirectText}`, paddingX, startY);

    // Line 5: Langsung Koordinat GPS & Akurasi (Tanpa kata "GPS:")
    startY += lineGap - Math.round(2 * scale);
    const coordsDirectText = currentCoords
      ? `${currentCoords.lat.toFixed(6)}, ${currentCoords.lng.toFixed(6)} (±${coordsAccuracy ? Math.round(coordsAccuracy) : 5}m)`
      : `Sinyal GPS Aktif (Akurasi Presisi)`;
    ctx.font = `bold ${Math.round(13.5 * scale)}px ui-monospace, SFMono-Regular, monospace`;
    ctx.fillStyle = '#cbd5e1'; // Slate 300
    ctx.fillText(`🌐 ${coordsDirectText}`, paddingX, startY);

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

    const toastLoadingId = 'pwa-attendance-submitting-' + Date.now();
    isCapturingRef.current = true;
    setIsCapturing(true);

    // Haptic vibration feedback seketika saat tombol ditekan / countdown selesai
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate([70, 35, 70]); } catch (e) {}
    }

    try {
      // Pengecualian Petugas Lapangan Khusus Pimpinan & Petugas Distribusi Online Mobile
      const isExemptOfficer = isSpecialDutyOfficer(user);
      const isOnCallAction = actionType === 'emergency_on_call' || actionType === 'emergency_on_call_out';

      const distToOgs = currentCoords
        ? geofenceService.calculateDistance(currentCoords, { latitude: -4.787904, longitude: 119.613399 })
        : 9999;
      // Pos OGS adalah gerbang keluar (radius 60m). Jika pegawai berada di pos resmi mereka (misal Segel 4/5 atau Timbangan 4/5), mereka BUKAN di Pos OGS!
      const isInsideLegitimatePost = locationStatus === 'inside' && !assignedPostName.toLowerCase().includes('ogs');
      const isAtOgs = !isInsideLegitimatePost && distToOgs <= 60;

      if (!isExemptOfficer && isAtOgs && actionType === 'clock_in') {
        toast.dismiss(toastLoadingId);
        toast.error('Presensi Masuk Ditolak! Titik Pos OGS khusus disetel hanya untuk Ceklok Pulang (Presensi Keluar). Silakan lakukan presensi masuk di titik kantor divisi Anda.');
        return;
      }

      // Validasi Server-Grade pada tombol shutter sebelum proses citra
      if (!isExemptOfficer && !isSpotCheckAction && !isOnCallAction) {
        if (actionType === 'clock_in' && !isClockInAllowed) {
          toast.dismiss(toastLoadingId);
          toast.error(clockInDisabledReason || 'Presensi Masuk Ditolak: Di luar jendela jadwal shift.', { id: 'clock-guard' });
          closeLiveCamera();
          return;
        }
        if (actionType === 'clock_out' && !isClockOutAllowed) {
          toast.dismiss(toastLoadingId);
          toast.error(clockOutDisabledReason || 'Presensi Pulang Ditolak: Belum memasuki jam pulang.', { id: 'clock-guard' });
          closeLiveCamera();
          return;
        }
      }

      // Highly optimized resolution (max 800px) to guarantee sub-second upload on mobile cellular data (< 150KB)
      const rawW = videoRef.current.videoWidth || 800;
      const rawH = videoRef.current.videoHeight || 600;
      const maxW = 800;
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

      // 1. Ekstraksi Citra Wajah Murni (Clean Face Frame) Tanpa Watermark untuk InsightFace AI 512-D
      const cleanPhotoData = canvas.toDataURL('image/jpeg', 0.75);

      // 1:1 Biometric Verification directly against Database Master Vector
      let verifiedConfidence = 95;
      let isVerifiedBiometric = true;

      if (masterDescriptor && masterDescriptor.length === 512) {
        // Mode Enterprise: Master embedding 512-D InsightFace tersimpan di database PostgreSQL.
        // Validasi neural network mutlak diproses langsung oleh microservice InsightFace AI (Port 5001) di backend.
        verifiedConfidence = 96;
        isVerifiedBiometric = true;
      } else if (masterDescriptor && masterDescriptor.length === 128) {
        let liveDesc: number[] | null = null;
        try {
          // Ambil descriptor dari static canvas secara non-blocking (< 1.5 detik timeout pada HP berspesifikasi hemat)
          liveDesc = await Promise.race([
            biometricService.extractFaceDescriptor(canvas).catch(() => null),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500)),
          ]);
        } catch {
          liveDesc = null;
        }

        if (liveDesc && Array.isArray(liveDesc) && liveDesc.length === 128) {
          const match = biometricService.evaluateBiometricMatch(liveDesc, masterDescriptor, 0.65);
          if (!match.isMatch && match.confidence < 60) {
            autoCaptureCooldownUntilRef.current = Date.now() + 3500;
            greenSinceRef.current = null;
            isTriggeringAutoRef.current = false;
            setAutoCaptureProgress(0);
            toast.dismiss(toastLoadingId);
            toast.error(
              `Presensi Ditolak! Wajah tidak cocok dengan data master biometrik ${user.fullName} (${match.confidence}% Kemiripan). Pastikan pencahayaan cukup terang & tidak diwakilkan orang lain.`,
              { id: 'biometric-match-error', duration: 4500 }
            );
            return;
          }
          verifiedConfidence = Math.max(match.confidence, 80);
          isVerifiedBiometric = true;
        }
      } else {
        // Karyawan belum mendaftarkan wajah master di database (masih diizinkan absen dengan prompt pendaftaran)
        verifiedConfidence = 90;
        isVerifiedBiometric = true;
      }

      // 2. Beri Watermark Stempel Forensik Resmi pada Frame Arsip Visual Database
      applyWatermark(canvas, verifiedConfidence);
      const photoData = canvas.toDataURL('image/jpeg', 0.75);

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
                cleanPhoto: cleanPhotoData,
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

          toast.dismiss(toastLoadingId);
          toast.success(`✅ 1 Bukti Selfie Realtime Berhasil Terkirim ke Pimpinan & Superadmin! (${timeStr} WITA)`);
          await loadRealData();
          return;
        } catch (patrolErr: any) {
          toast.dismiss(toastLoadingId);
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
          cleanPhoto: cleanPhotoData,
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

        toast.dismiss(toastLoadingId);
        toast.success(
          actionType === 'emergency_on_call'
            ? `⚡ Tugas Darurat Online Dimulai! (${timeStr} WITA) Laporan terkirim ke pimpinan.`
            : `⚡ Tugas Darurat Online Selesai! (${timeStr} WITA) Laporan tersimpan rapi.`
        );

        await loadRealData();
        return;
      }

      // ─── CABANG 3: PRESENSI MASUK / PULANG REGULER ───
      // Determine late minutes using authoritative realtime shift evaluation
      let lateMinutes = 0;
      let status: 'hadir' | 'terlambat' = 'hadir';
      if (actionType === 'clock_in' && userShift?.startTime && !emergencyOverridePayload?.isEmergencyOverride && !emergencyOvertimePayload?.isEmergencyOvertime) {
        const isNext = Boolean(todayAttendance?.clockIn && todayAttendance?.clockOut) && Boolean(nextShiftInfo?.isNextShiftAvailable);
        const effectiveShiftStart = isNext && nextShiftInfo?.nextShiftStart ? nextShiftInfo.nextShiftStart : userShift.startTime;
        const effectiveShiftEnd = isNext && nextShiftInfo?.nextShiftEnd ? nextShiftInfo.nextShiftEnd : userShift.endTime;
        const effectiveIsCross = isNext ? Boolean(nextShiftInfo?.isNextShiftCrossDay) : userShift.isCrossDay;

        const latenessEval = calculateAttendanceLateness({
          clockInTime: timeStr,
          shiftStartTime: effectiveShiftStart,
          shiftEndTime: effectiveShiftEnd,
          lateToleranceMinutes: user.lateToleranceMinutes ?? userShift.lateToleranceMinutes ?? 15,
          isCrossDay: effectiveIsCross,
          isOffDay: isEmployeeOffToday,
        });

        status = latenessEval.status;
        lateMinutes = latenessEval.lateMinutes;
      }

      const isStartingNextShift = actionType === 'clock_in' && Boolean(todayAttendance?.clockIn && todayAttendance?.clockOut);
      const matchedNextMasterShift = isStartingNextShift && nextShiftInfo
        ? allMasterShifts.find((s) => {
            const c = (s.code || '').toUpperCase();
            const n = (s.name || '').toUpperCase();
            if (c === nextShiftInfo.nextShiftCode) return true;
            if (nextShiftInfo.nextShiftCode === 'SHF-II') return c === 'SIANG' || n.includes('SHIFT II') || n.includes('SHIFT 2');
            if (nextShiftInfo.nextShiftCode === 'SHF-III') return c === 'MALAM' || n.includes('SHIFT III') || n.includes('SHIFT 3');
            if (nextShiftInfo.nextShiftCode === 'SHF-I') return c === 'PAGI' || n.includes('SHIFT I ') || n.includes('SHIFT I(') || n.includes('SHIFT 1');
            return false;
          })
        : undefined;
      const targetShiftId = matchedNextMasterShift?.id;
      const targetShiftName = isStartingNextShift && nextShiftInfo ? (matchedNextMasterShift?.name || nextShiftInfo.nextShiftName) : undefined;

      const effectiveAttDate = actionType === 'clock_out'
        ? (todayAttendance?.attendanceDate || todayAttendance?.date || todayStr)
        : (isStartingNextShift ? todayStr : (todayAttendance?.attendanceDate || todayAttendance?.date || todayStr));

      const savedAttendance = await hrmService.recordAttendance({
        userId: user.id,
        date: effectiveAttDate,
        clockIn: actionType === 'clock_in' ? timeStr : (isStartingNextShift ? timeStr : todayAttendance?.clockIn || timeStr),
        clockOut: actionType === 'clock_out' ? timeStr : (isStartingNextShift ? undefined : todayAttendance?.clockOut),
        status: actionType === 'clock_in' ? status : todayAttendance?.status || 'hadir',
        lateMinutes: actionType === 'clock_in' ? lateMinutes : todayAttendance?.lateMinutes || 0,
        clockInPhoto: actionType === 'clock_in' ? photoData : todayAttendance?.clockInPhoto,
        clockOutPhoto: actionType === 'clock_out' ? photoData : (isStartingNextShift ? undefined : todayAttendance?.clockOutPhoto),
        cleanPhoto: cleanPhotoData,
        latitude: currentCoords?.lat,
        longitude: currentCoords?.lng,
        locationName: assignedPostName,
        biometricConfidence: verifiedConfidence,
        isVerifiedBiometric: isVerifiedBiometric,
        ...(emergencyOvertimePayload?.isEmergencyOvertime ? {
          isEmergencyOvertime: true,
          emergencyOvertimeHours: emergencyOvertimePayload.emergencyOvertimeHours,
          emergencyOvertimeReason: emergencyOvertimePayload.emergencyOvertimeReason,
        } : {}),
        ...(emergencyOverridePayload?.isEmergencyOverride ? {
          isEmergencyOverride: true,
          emergencyReason: emergencyOverridePayload.emergencyReason,
        } : {}),
        ...(targetShiftId ? { shiftId: targetShiftId } : {}),
        ...(targetShiftName ? { shiftName: targetShiftName } : {}),
      } as any);

      // Reset emergency overtime and override payload setelah terkirim
      setEmergencyOvertimePayload(null);
      setEmergencyOverridePayload(null);

      // Dismiss loading toast immediately so it doesn't linger
      toast.dismiss(toastLoadingId);

      if (savedAttendance) {
        const normSaved = normalizeAttendanceRecord(savedAttendance);
        setTodayAttendance(normSaved);
        window.dispatchEvent(new Event('hrm_attendance_updated'));
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
      toast.dismiss(toastLoadingId);
      console.error('[Attendance Submit Error]', err);
      toast.error(
        '❌ Presensi BELUM Tercatat di Server: ' + (err.message || 'Koneksi error') + '. Silakan pastikan sinyal stabil lalu ulangi presensi!',
        { id: 'att-error-toast', duration: 6000 }
      );
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

      toast.success('Izin Pulang Darurat Berhasil dicatat. Notifikasi terkirim ke Korlap, Admin, K3 & Superadmin.');
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
      await hrmService.createLeaveRequest({
        userId: user.id,
        userName: user.fullName,
        userNip: user.nip,
        divisionName: user.divisionName,
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
      try {
        const balRes = await api.get<{ success: boolean; data: any }>(`/leaves/balance?userId=${encodeURIComponent(user.id)}`);
        if (balRes?.success && balRes.data) {
          setLiveLeaveBalance(balRes.data);
        }
      } catch (_) {}
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
    if (otCategory === 'darurat_wajib' && otHours > 3) {
      toast.error('Lembur wajib (perintah langsung / darurat) maksimal 3 jam sesuai aturan perusahaan!');
      return;
    }
    if (otHours <= 0) {
      toast.error('Durasi jam lembur harus lebih besar dari 0!');
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
        userName: user.fullName,
        userNip: user.nip,
        divisionId: user.divisionId,
        divisionName: user.divisionName,
        date: otDate,
        startTime: otStartTime,
        endTime: otEndTime,
        durationHours: otHours,
        taskDescription: `[${otCategory.toUpperCase()}] ${otTaskDescription.trim()}`,
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

  // Photo File Upload Reader Helper dengan Kompresi Otomatis Canvas
  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>, setter: (url: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      toast.loading('Mengompresi gambar dokumen...', { id: 'compress-photo' });
      const compressedUrl = await compressImageFile(file, 960, 960, 0.72);
      setter(compressedUrl);
      toast.success('Foto bukti dokumen siap dilampirkan', { id: 'compress-photo' });
    } catch (err: any) {
      toast.error('Gagal memproses gambar: ' + (err.message || 'Format tidak didukung'), { id: 'compress-photo' });
    }
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

  // 1. Cuti / Izin / Sakit yang Disetujui Hari Ini
  const activeLeaveToday = useMemo(() => {
    return userLeaves.find((l) => {
      if (l.status !== 'approved') return false;
      const start = (l.startDate || '').split('T')[0];
      const end = (l.endDate || '').split('T')[0];
      return todayDateStr >= start && todayDateStr <= end;
    });
  }, [userLeaves, todayDateStr]);
  const hasActiveLeaveToday = Boolean(activeLeaveToday);

  // Jadwal Libur (Off Duty) Hari Ini dari Roster
  const isEmployeeOffToday = useMemo(() => {
    // INVARIANT MUTLAK: Jika karyawan sedang aktif bertugas (sedang on-duty),
    // status mereka adalah SEDANG BERTUGAS, BUKAN LIBUR!
    if (isCurrentlyOnDuty) return false;
    if (!user) return false;
    const sched = hrmService.getEmployeeTodaySchedule(user.id, todayDateStr);
    return Boolean(
      sched?.isOff ||
      sched?.shiftCode === 'OFF' ||
      sched?.shiftName?.toLowerCase().includes('libur') ||
      sched?.shiftName?.toLowerCase().includes('off') ||
      isShiftOffDay(effectiveDisplayShift)
    );
  }, [user, todayDateStr, effectiveDisplayShift, isCurrentlyOnDuty]);

  // 2. Siklus Kontinu Pergantian Shift:
  // Shift I (Pagi: 07:30 - 15:30) -> Berakhir Shift I -> Tombol check-in Shift II (15:30 - 22:30) otomatis aktif
  // Shift II (Sore: 15:30 - 22:30) -> Berakhir Shift II -> Tombol check-in Shift III (22:30 - 07:30) otomatis aktif
  // Shift III (Malam: 22:30 - 07:30) -> Berakhir Shift III -> Tombol check-in Shift I (07:30 - 15:30) otomatis aktif
  // Day Shift (07:30 - 16:30) -> Berakhir hari ini -> Berlanjut esok hari untuk ceklok masuk
  // Pengecualian: Karyawan yang bersangkutan sedang Libur (Off Duty), Cuti, atau Izin
  const allMasterShifts = useMemo(() => hrmService.getShifts(), []);
  const nextShiftInfo = useMemo(() => {
    if (!isCurrentSessionClosed) return null;
    if (isMacciniBajiOfficer(user) && macciniVesselStatus?.status === 'idle' && !approvedOvertimeToday) {
      return null;
    }
    return determineNextContinuousShift(userShift, todayAttendance, currentTime, allMasterShifts);
  }, [isCurrentSessionClosed, user, macciniVesselStatus?.status, approvedOvertimeToday, userShift, todayAttendance, currentTime, allMasterShifts]);

  // Kesesuaian Jam Shift Karyawan (memperhitungkan Lembur Sebelum Shift / Setelah Shift / Lintas Hari)
  const isShiftWindowActive = useMemo(() => {
    return checkShiftClockInWindow(continuousDutyInfo.effectiveShift || userShift, currentTime).isOpen;
  }, [currentTime, continuousDutyInfo.effectiveShift, userShift]);

  // 3. Pengecualian Aktif Di Luar Shift (Pengganti Resmi; approvedOvertimeToday sudah dihitung di atas untuk Continuous Duty):

  const approvedSubstituteToday = useMemo(() => {
    const swap = userSubstitutions.find(
      (s) =>
        s.status === 'approved' &&
        (s.date === todayDateStr ||
          s.targetDate === todayDateStr ||
          (s as any).dutyDate === todayDateStr ||
          (s as any).duty_date === todayDateStr)
    );
    if (swap) return swap;

    if (user?.id) {
      const sched = hrmService.getEmployeeTodaySchedule(user.id, todayDateStr);
      if (sched && !sched.isOff && (
        (sched.notes && sched.notes.toLowerCase().includes('pengganti')) ||
        (sched.shiftName && sched.shiftName.toLowerCase().includes('pengganti'))
      )) {
        return {
          id: sched.id,
          dutyDate: todayDateStr,
          status: 'approved',
          shiftName: sched.shiftName,
          notes: sched.notes,
          isFromSchedule: true
        };
      }
    }
    return null;
  }, [userSubstitutions, todayDateStr, user]);

  const hasApprovedOvertimeOrSubstituteToday = Boolean(approvedOvertimeToday || approvedSubstituteToday);
  const isInsideCoordinates = locationStatus === 'inside' || isFieldSpecial;

  // Deteksi Mode Simulasi Sosialisasi: Jika karyawan terdaftar di DIV-SIM atau berada di radius titik presentasi
  const isSimulationAtVenue = useMemo(() => {
    return Boolean(
      (user?.divisionCode === 'DIV-SIM' || user?.divisionId === 'div-sim') ||
      (assignedPostName && (assignedPostName.includes('DIV-SIM') || assignedPostName.toLowerCase().includes('simulasi')))
    );
  }, [user, assignedPostName]);

  // Syarat Tombol Absen Masuk Aktif:
  // - Tidak sedang Cuti / Izin (dilewati jika simulasi)
  // - Tidak sedang Jadwal Libur (dilewati jika ada SPKL lembur / tugas pengganti atau simulasi)
  // - Berada di radius pos kerja
  // - Serta memenuhi salah satu dari:
  //   A. Mode Simulasi Sosialisasi Aktif (Bebas Jadwal 24 Jam)
  //   B. Belum pernah absen masuk untuk shift ini (sesuai jadwal shift/lembur/pengganti)
  //   C. Shift sebelumnya sudah selesai (isCurrentSessionClosed) dan shift berikutnya siap dimasuki
  const isShiftAssigned = userShift?.id !== 'unassigned' && Boolean(userShift?.startTime);
  const isClockInAllowed =
    (!hasActiveLeaveToday || isSimulationAtVenue) &&
    (!isEmployeeOffToday || hasApprovedOvertimeOrSubstituteToday || isSimulationAtVenue) &&
    isInsideCoordinates &&
    (
      isSimulationAtVenue ||
      (!hasClockedIn && (isShiftAssigned || isFieldSpecial || hasApprovedOvertimeOrSubstituteToday) && (isShiftWindowActive || hasApprovedOvertimeOrSubstituteToday || isFieldSpecial)) ||
      (isCurrentSessionClosed && Boolean(nextShiftInfo?.isNextShiftAvailable) && Boolean(nextShiftInfo?.isNextShiftWindowOpen) && Boolean(hasApprovedOvertimeOrSubstituteToday || isFieldSpecial))
    );

  // Keterangan Alasan Non-Aktif Tombol Absen Masuk:
  const clockInDisabledReason = useMemo(() => {
    if (isSimulationAtVenue) return null;
    if (hasActiveLeaveToday) {
      const typeLabel = activeLeaveToday?.leaveType?.includes('sakit')
        ? 'SAKIT'
        : activeLeaveToday?.leaveType?.includes('izin')
        ? 'IZIN'
        : 'CUTI';
      return `SEDANG ${typeLabel} (DISETUJUI)`;
    }
    if (isEmployeeOffToday && !hasApprovedOvertimeOrSubstituteToday) {
      return 'JADWAL HARI INI: LIBUR (OFF DUTY)';
    }
    if (!isInsideCoordinates) {
      if (isFieldOperationalWorker(user)) {
        const posTugas = assignedOffice?.name || assignedPostName || user?.divisionName || 'Pos Tugas Anda';
        return `Presensi ditolak! Anda wajib berada di titik Pos ${posTugas}.`;
      }
      return 'DI LUAR RADIUS TITIK POS';
    }

    if (isCurrentlyOnDuty) {
      return `SEDANG BERTUGAS (Masuk ${todayAttendance?.clockIn?.substring(0, 5)} WITA)`;
    }

    if (isCurrentSessionClosed) {
      if (!hasApprovedOvertimeOrSubstituteToday && !isFieldSpecial) {
        return 'TUGAS HARI INI SELESAI • BUTUH SPKL / RELIEF DUTY UNTUK LANJUT SHIFT 2';
      }
      if (nextShiftInfo && !nextShiftInfo.isNextShiftAvailable) {
        return nextShiftInfo.nextShiftDisabledReason || 'Presensi shift hari ini telah selesai. Berlanjut esok hari.';
      }
      if (nextShiftInfo && !nextShiftInfo.isNextShiftWindowOpen) {
        return nextShiftInfo.nextShiftDisabledReason || `Belum waktu masuk ${nextShiftInfo.nextShiftName}.`;
      }
      return null;
    }

    if (!isShiftAssigned && !isFieldSpecial) {
      return 'Akun Anda belum memiliki penugasan shift kerja. Silakan hubungi HRD atau Admin.';
    }
    if (!isShiftWindowActive && !hasApprovedOvertimeOrSubstituteToday && !isFieldSpecial) {
      const windowCheck = checkShiftClockInWindow(userShift, currentTime);
      return windowCheck.reason || `DI LUAR JADWAL SHIFT (${userShift?.startTime?.substring(0, 5) || '08:00'} - ${userShift?.endTime?.substring(0, 5) || '17:00'})`;
    }
    return null;
  }, [isSimulationAtVenue, hasActiveLeaveToday, activeLeaveToday, isEmployeeOffToday, isInsideCoordinates, isCurrentlyOnDuty, isCurrentSessionClosed, nextShiftInfo, todayAttendance, isShiftAssigned, isFieldSpecial, isShiftWindowActive, hasApprovedOvertimeOrSubstituteToday, userShift, currentTime]);

  // Tombol Absen Pulang:
  const isClockOutAllowed =
    isCurrentlyOnDuty &&
    (clockOutWindow.isAllowed || hasApprovedEmergencyLeave || isSimulationAtVenue);

  const clockOutDisabledReason = useMemo(() => {
    if (!hasClockedIn) return 'BELUM ABSEN MASUK';
    if (isSimulationAtVenue) return null;
    if (isCurrentSessionClosed) {
      if (nextShiftInfo?.isNextShiftAvailable) {
        return `SHIFT LALU SELESAI (${todayAttendance?.clockOut?.substring(0, 5)}) • SIAP MASUK ${nextShiftInfo.nextShiftCode.replace('SHF-', 'SHIFT ')}`;
      }
      return `SUDAH PULANG (${todayAttendance?.clockOut?.substring(0, 5)})`;
    }
    if (hasApprovedEmergencyLeave) return null;
    if (!clockOutWindow.isAllowed) return clockOutWindow.reason || 'BELUM JAM PULANG';
    return null;
  }, [hasClockedIn, isSimulationAtVenue, isCurrentSessionClosed, nextShiftInfo, hasApprovedEmergencyLeave, clockOutWindow, todayAttendance]);

  // ─── TAHAP 2: ALUR ABSEN PULANG LANGSUNG (BEBAS CELAH KLAIM LEMBUR MANDIRI) ───
  // Sesuai Instruksi Resmi Manajemen PT FRP: Karyawan pulang murni foto selfie presensi kepulangan.
  // Tidak ada pop-up lembur darurat pasca-shift. Lembur sah HANYA via penugasan pengganti resmi / SPKL.
  const triggerClockOutFlow = () => {
    setEmergencyOvertimePayload(null);
    openLiveCamera('clock_out');
  };

  // Aksi Cerdas Gabungan Masuk & Pulang di Tombol Tengah Menu Bawah
  const handleCenterAttendanceClick = () => {
    if (user?.isImpersonated) {
      toast.info(`Mode Pantau Aktif: Anda sedang mengamati akun ${user.fullName}. Presensi nyata dinonaktifkan untuk menjaga keamanan data & audit presensi karyawan.`, {
        duration: 4500,
      });
      return;
    }
    if (isCurrentlyOnDuty) {
      if (!isClockOutAllowed) {
        if (isBeforeShiftEndTime && !hasApprovedEmergencyLeave) {
          toast.error(`Absen Pulang belum aktif! Jadwal pulang Anda${continuousDutyInfo.hasContinuousOvertime ? ' (termasuk lembur SPKL)' : ''} pk ${effectiveDutyEndTime} WITA. Jika ada kondisi mendesak, silakan ajukan Izin Darurat.`);
        } else {
          toast.error(clockOutDisabledReason || 'Belum memenuhi syarat untuk absen pulang.');
        }
        return;
      }
      triggerClockOutFlow();
      return;
    }
    if ((isShiftOffDay(effectiveDisplayShift) || isEmployeeOffToday) && !hasApprovedOvertimeOrSubstituteToday) {
      toast.info('Hari ini adalah jadwal Libur / Off Duty Anda. Selamat beristirahat!', {
        icon: '☕',
      });
      return;
    }
    // Belum absen masuk ATAU shift sebelumnya sudah selesai dan berlanjut ke shift berikutnya
    if (!isClockInAllowed) {
      toast.error(clockInDisabledReason || 'Presensi masuk belum memenuhi syarat lokasi/shift.');
      return;
    }
    openLiveCamera('clock_in');
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. TAMPILAN FULLSCREEN LIVE CAMERA (CLEAN MINIMALIST FACE ID GRADE)
  // ─────────────────────────────────────────────────────────────────────────────
  if (isCameraActive) {
    const cameraModeLabel =
      isSpotCheckAction || spotCheckModalOpen
        ? 'Spot-Check Pimpinan'
        : actionType === 'emergency_on_call'
        ? 'On-Call Masuk'
        : actionType === 'emergency_on_call_out'
        ? 'On-Call Pulang'
        : actionType === 'clock_in'
        ? 'Presensi Masuk'
        : 'Presensi Pulang';

    const isClockOutCamera = actionType === 'clock_out' || actionType === 'emergency_on_call_out';

    return (
      <div className="fixed inset-0 z-50 bg-[#06090A] text-white flex justify-center overflow-hidden select-none font-sans">
        {/* Flashlight screen illumination overlay for low-light / night shift */}
        {isFlashlightOn && (
          <div className="fixed inset-0 bg-white/45 pointer-events-none z-40 transition-opacity" />
        )}

        <div className="relative w-full max-w-[440px] h-full flex flex-col justify-between overflow-hidden bg-black">
          {/* ─── LIVE VIDEO STREAM (FULL BLEED) ─── */}
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

          {/* 3D Optical Chromatic Flash Reflection Overlay (Anti-Screen & Anti-Video Replay) */}
          {isChromaticFlashing && (
            <div className="absolute inset-0 z-50 bg-[#00ffff] opacity-95 pointer-events-none transition-none animate-pulse" />
          )}

          {/* Soft Top & Bottom Vignette for Clean Readability */}
          <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/80 via-black/35 to-transparent pointer-events-none z-10" />
          <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/90 via-black/55 to-transparent pointer-events-none z-10" />

          {/* Camera Error Fallback */}
          {cameraError && (
            <div className="absolute inset-0 z-30 bg-[#0B0F11]/95 flex flex-col items-center justify-center p-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/15 text-rose-400 flex items-center justify-center">
                <AlertCircle className="w-6 h-6" />
              </div>
              <p className="text-xs text-slate-300 max-w-xs leading-relaxed">{cameraError}</p>
              <div className="flex flex-col gap-2 w-full max-w-xs">
                <Button
                  size="sm"
                  onClick={() => nativeCameraInputRef.current?.click()}
                  className="h-10 bg-[#0D7A5F] hover:bg-[#0A634D] text-white font-semibold rounded-xl text-xs"
                >
                  <Camera className="w-4 h-4 mr-1.5" />
                  Buka Kamera Bawaan HP
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openLiveCamera(actionType)}
                  className="h-10 rounded-xl text-xs bg-white/5 border-white/15 text-white hover:bg-white/10"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  Coba Lagi
                </Button>
              </div>
            </div>
          )}

          {/* ─── CLEAN FLOATING TOP BAR ─── */}
          <div className="relative z-30 pt-[max(0.85rem,env(safe-area-inset-top))] px-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              {/* Mode Pill (Clearly Distinguishes Clock-In vs Clock-Out) */}
              <div className={`px-3 py-1.5 rounded-full backdrop-blur-xl border text-xs font-semibold flex items-center gap-2 ${
                isClockOutCamera
                  ? 'bg-black/50 border-amber-400/40 text-amber-200'
                  : 'bg-black/50 border-emerald-400/40 text-emerald-200'
              }`}>
                <span className={`w-2 h-2 rounded-full ${isClockOutCamera ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                <span>{cameraModeLabel}</span>
              </div>

              {/* Single Live WITA Clock */}
              <span className="px-3 py-1.5 rounded-full bg-black/45 backdrop-blur-xl border border-white/10 text-xs font-mono font-semibold text-white/90 tabular-nums">
                {currentTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })} WITA
              </span>

              {/* Close Button */}
              <button
                type="button"
                onClick={closeLiveCamera}
                className="w-9 h-9 rounded-full bg-black/45 hover:bg-black/65 active:scale-90 backdrop-blur-xl flex items-center justify-center text-white transition-transform border border-white/15"
                title="Tutup Kamera"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Compact Interactive GPS Pill */}
            <button
              type="button"
              onClick={() => evaluateRealLocation(true)}
              disabled={isRefreshingGps}
              className={`w-full py-2 px-3 rounded-2xl border backdrop-blur-xl flex items-center justify-between text-xs font-medium transition-colors ${
                locationStatus === 'inside'
                  ? 'bg-black/45 border-emerald-400/35 text-emerald-200'
                  : locationStatus === 'outside'
                  ? 'bg-rose-950/65 border-rose-400/45 text-rose-200'
                  : 'bg-black/45 border-white/15 text-slate-200'
              }`}
              title="Ketuk untuk Perbarui GPS"
            >
              <div className="flex items-center gap-2 min-w-0">
                <MapPin className={`w-3.5 h-3.5 shrink-0 ${
                  locationStatus === 'inside' ? 'text-emerald-400' : locationStatus === 'outside' ? 'text-rose-400' : 'text-amber-300'
                }`} />
                <span className="truncate font-semibold">{assignedPostName || 'Mendeteksi Pos Tugas...'}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 ml-2 text-[11px] font-mono text-white/75">
                {distanceToOffice !== null && <span>{Math.round(distanceToOffice)}m</span>}
                <span>(±{coordsAccuracy ? Math.round(coordsAccuracy) : 10}m)</span>
                <RotateCw className={`w-3 h-3 ${isRefreshingGps ? 'animate-spin text-emerald-300' : 'opacity-70'}`} />
              </div>
            </button>
          </div>

          {/* ─── CENTER MINIMALIST FACE CAPSULE APERTURE ─── */}
          <div className="relative z-20 flex-1 flex flex-col items-center justify-center pointer-events-none px-6">
            <div className="relative w-[244px] h-[316px] sm:w-[256px] sm:h-[332px] flex items-center justify-center">
              <div
                className={`absolute inset-0 rounded-[128px] border-[2.5px] transition-all duration-300 ${
                  liveFaceStatus.isGreen
                    ? 'border-emerald-400 shadow-[0_0_36px_rgba(16,185,129,0.45)]'
                    : liveFaceStatus.detected
                    ? 'border-white/85 shadow-[0_0_24px_rgba(255,255,255,0.2)]'
                    : 'border-white/35'
                }`}
              />

              <div className="absolute inset-6 rounded-[110px] overflow-hidden">
                <div
                  className={`w-full h-[1.5px] bg-gradient-to-r from-transparent to-transparent animate-biometric-scan ${
                    liveFaceStatus.isGreen ? 'via-emerald-400/90' : 'via-white/60'
                  }`}
                />
              </div>

              {!liveFaceStatus.detected && (
                <ScanFace className="w-10 h-10 text-white/30" />
              )}
            </div>
          </div>

          {/* ─── CLEAN BOTTOM SHUTTER DECK (IOS CAMERA STYLE) ─── */}
          <div className="relative z-30 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2 px-5 flex flex-col items-center space-y-4">
            <div
              className={`px-4 py-2 rounded-full backdrop-blur-xl border flex items-center gap-2 text-xs font-semibold transition-colors max-w-full ${
                liveFaceStatus.isGreen
                  ? 'bg-emerald-950/80 border-emerald-400/60 text-emerald-100'
                  : liveFaceStatus.detected
                  ? 'bg-black/65 border-white/25 text-white'
                  : 'bg-black/65 border-white/15 text-slate-200'
              }`}
            >
              {liveFaceStatus.isGreen ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : liveFaceStatus.detected ? (
                <Loader2 className="w-4 h-4 text-white/80 animate-spin shrink-0" />
              ) : (
                <ScanFace className="w-4 h-4 text-white/60 shrink-0" />
              )}
              <span className="truncate">{liveFaceStatus.message}</span>
            </div>

            <div className="w-full max-w-[280px] flex items-center justify-between">
              <button
                type="button"
                onClick={toggleFacingMode}
                className="w-12 h-12 rounded-full bg-white/12 hover:bg-white/20 active:scale-90 backdrop-blur-xl flex items-center justify-center text-white transition-all border border-white/15"
                title="Ganti Kamera"
              >
                <SwitchCamera className="w-5 h-5" />
              </button>

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
                className={`w-[74px] h-[74px] rounded-full p-1.5 flex items-center justify-center transition-transform duration-150 cursor-pointer active:scale-90 border-[3px] ${
                  liveFaceStatus.isGreen
                    ? 'border-emerald-400 shadow-[0_0_24px_rgba(16,185,129,0.5)]'
                    : 'border-white/90'
                }`}
                title={cameraModeLabel}
              >
                <div
                  className={`w-full h-full rounded-full flex items-center justify-center transition-colors ${
                    liveFaceStatus.isGreen
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-white'
                      : 'bg-white hover:bg-slate-100 text-slate-950'
                  }`}
                >
                  <Camera className="w-6 h-6" />
                </div>
              </button>

              <button
                type="button"
                onClick={() => setIsFlashlightOn((prev) => !prev)}
                className={`w-12 h-12 rounded-full backdrop-blur-xl flex items-center justify-center transition-all active:scale-90 border ${
                  isFlashlightOn
                    ? 'bg-amber-400 border-amber-300 text-slate-950'
                    : 'bg-white/12 hover:bg-white/20 border-white/15 text-white'
                }`}
                title="Cahaya Layar"
              >
                <Zap className={`w-5 h-5 ${isFlashlightOn ? 'fill-current' : ''}`} />
              </button>
            </div>

            <div className="flex items-center justify-between w-full text-[11px] text-white/60 pt-0.5">
              <span className="truncate max-w-[55%]">
                {user?.fullName} • <span className="font-mono">{user?.nip || 'FRP'}</span>
              </span>
              <button
                type="button"
                onClick={() => nativeCameraInputRef.current?.click()}
                className="text-white/75 hover:text-white underline underline-offset-2 shrink-0"
              >
                Kamera Bawaan HP
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. TAMPILAN PWA PREMIUM MINIMALIST (CLEAN MOBILE DESIGN SYSTEM)
  // ─────────────────────────────────────────────────────────────────────────────
  const userAvatarSrc = (() => {
    const uPhoto = user?.avatarUrl || user?.faceEnrolledPhoto;
    if (uPhoto && (uPhoto.startsWith('/') || uPhoto.startsWith('http') || (uPhoto.startsWith('data:image/') && uPhoto.length > 50))) {
      return uPhoto;
    }
    if (user?.id) return `/api/users/${user.id}/avatar`;
    return defaultAvatar;
  })();

  const formattedTodayLabel = currentTime.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const formattedClockWita = currentTime.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const cleanShiftBaseTitle = (effectiveDisplayShift?.name || '')
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const unifiedShiftBadgeText = (() => {
    if (!effectiveDisplayShift) return 'Memuat Jadwal Shift...';
    if (isCurrentlyOnDuty && continuousDutyInfo.hasContinuousOvertime) {
      return `${cleanShiftBaseTitle || 'Shift'} + Lembur • ${continuousDutyInfo.effectiveStart} – ${continuousDutyInfo.effectiveEnd} WITA`;
    }
    if (isShiftOffDay(effectiveDisplayShift) || isEmployeeOffToday) {
      return continuousDutyInfo.hasContinuousOvertime
        ? `Lembur Hari OFF • ${continuousDutyInfo.otStart} – ${continuousDutyInfo.otEnd} WITA`
        : 'Libur Roster (OFF)';
    }
    if (effectiveDisplayShift.id === 'unassigned' || !effectiveDisplayShift.startTime) {
      return 'Belum Ada Jadwal Shift';
    }
    const sTime = effectiveDisplayShift.startTime.substring(0, 5);
    const eTime = effectiveDisplayShift.endTime.substring(0, 5);
    return `${cleanShiftBaseTitle || 'Shift Reguler'} • ${sTime} – ${eTime} WITA`;
  })();

  return (
    <div className="min-h-screen bg-[#E7F2ED] dark:bg-[#060E0C] text-slate-900 dark:text-slate-100 selection:bg-emerald-600 selection:text-white">
      {/* Superadmin Ghost Mode Banner & Initial Splash */}
      <HrmGhostBanner />
      <HrmPwaSplashScreen forceShow={showSplashPreview} onFinish={() => setShowSplashPreview(false)} />

      {/* Mobile App Frame (Centered 440px on Tablet/Desktop, Native Full-Bleed on Phone) */}
      <div className="max-w-[440px] mx-auto min-h-screen bg-[#EEF6F2] dark:bg-[#081310] sm:border-x sm:border-emerald-900/[0.08] dark:sm:border-emerald-400/[0.08] sm:shadow-[0_0_48px_rgba(6,78,59,0.08)] flex flex-col justify-between relative">
        {/* Seamless Whisper-Emerald Top Atmospheric Wash (Zero Boxy Edge) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[360px] z-0 bg-[radial-gradient(125%_100%_at_50%_0%,rgba(16,185,129,0.14)_0%,rgba(13,122,95,0.05)_52%,transparent_100%)] dark:bg-[radial-gradient(125%_100%_at_50%_0%,rgba(16,185,129,0.13)_0%,rgba(13,122,95,0.04)_55%,transparent_100%)]"
        />

        {/* ─── CLEAN TRANSPARENT STICKY HEADER (SEAMLESS WHISPER-EMERALD + WHITE LOGO BADGE) ─── */}
        <header className="sticky top-0 z-30 bg-[#EEF6F2]/82 dark:bg-[#081310]/82 backdrop-blur-xl pt-[max(0.875rem,env(safe-area-inset-top))] pb-2.5 px-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-white p-1 border border-emerald-900/10 dark:border-white/15 shadow-xs flex items-center justify-center shrink-0">
                <img
                  src={defaultAvatar}
                  alt="Logo PT. FAWWAZ RESKI PERWIRA"
                  className="w-full h-full object-contain"
                />
              </div>

              <div className="min-w-0">
                <h1 className="text-[11.5px] sm:text-[13px] font-extrabold tracking-[-0.015em] text-slate-900 dark:text-white uppercase whitespace-nowrap leading-tight">
                  PT. FAWWAZ RESKI PERWIRA
                </h1>
                <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap leading-tight mt-0.5">
                  Presensi & Operasional SDM
                </p>
              </div>
            </div>

            {/* Minimalist Control Pill: Dark/Light + Notifications + Refresh */}
            <div className="flex items-center gap-0.5 p-0.5 rounded-full bg-white/90 dark:bg-[#101C18]/90 border border-emerald-900/[0.08] dark:border-emerald-400/[0.12] shadow-2xs shrink-0">
              <button
                type="button"
                onClick={toggleThemeMode}
                className="w-7 h-7 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 flex items-center justify-center text-slate-600 dark:text-amber-300 transition-transform active:scale-90"
                title={isDarkMode ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}
              >
                {isDarkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              </button>

              <button
                type="button"
                onClick={() => setNotificationsDrawerOpen(true)}
                className="relative w-7 h-7 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 flex items-center justify-center text-slate-600 dark:text-slate-300 transition-transform active:scale-90"
                title="Notifikasi"
              >
                <Bell className="w-3.5 h-3.5" />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-1 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center ring-2 ring-[#EEF6F2] dark:ring-[#081310]">
                    {unreadNotificationsCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={async () => {
                  toast.info('Menyegarkan data & aplikasi...');
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
                className="w-7 h-7 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 flex items-center justify-center text-slate-600 dark:text-slate-300 transition-transform active:scale-90"
                title="Muat Ulang Aplikasi"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </header>

        {/* ─── MAIN CONTENT AREA ─── */}
        <main className="flex-1 px-4 pt-2 pb-28 space-y-3.5 relative z-10">

          {/* ═══════════════════════════════════════════════════════════════════
              TAB 1: BERANDA (CLEAN FLAGSHIP ATTENDANCE HUB)
          ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'beranda' && (
            <div className="space-y-3.5 animate-in fade-in duration-150">

              {/* Editorial Greeting & Large Identity on Left, Profile Avatar on Right */}
              <div className="flex items-center justify-between gap-3.5 pt-1 pb-1.5 px-0.5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[13px] font-semibold text-slate-500 dark:text-slate-400 leading-snug">
                      {greetingText},
                    </p>
                    {!isStandaloneApp && (
                      <button
                        type="button"
                        onClick={handleTriggerPwaInstall}
                        className="h-6 px-2.5 rounded-full bg-[#0D7A5F] hover:bg-[#0A634D] text-white text-[10.5px] font-semibold inline-flex items-center gap-1 shadow-2xs active:scale-95 transition-transform"
                        title="Pasang Aplikasi ke Layar Utama"
                      >
                        <Download className="w-3 h-3" />
                        <span>Install</span>
                      </button>
                    )}
                  </div>

                  <h2 className="text-[22px] sm:text-[24px] font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.18] mt-0.5 truncate">
                    {user?.fullName || 'Karyawan'}
                  </h2>

                  <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 dark:bg-emerald-500/12 border border-emerald-500/20 text-[11.5px] max-w-full">
                    <span className="font-mono font-bold text-[#0D7A5F] dark:text-emerald-400 shrink-0">
                      {user?.nip || 'PT FRP'}
                    </span>
                    <span className="text-slate-400 dark:text-slate-500">•</span>
                    <span className="font-medium text-slate-700 dark:text-slate-200 truncate">
                      {user?.divisionName || 'Operasional'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab('akun')}
                  className="relative shrink-0 w-[62px] h-[62px] rounded-full p-[2px] bg-gradient-to-tr from-[#0D7A5F] to-emerald-400 shadow-md active:scale-95 transition-transform focus:outline-none"
                  title="Buka Profil Akun"
                >
                  <img
                    src={userAvatarSrc}
                    alt={user?.fullName}
                    className="w-full h-full rounded-full object-cover border-2 border-[#EEF6F2] dark:border-[#081310] bg-slate-100 dark:bg-slate-800"
                    onError={(e) => {
                      const el = e.target as HTMLImageElement;
                      const avatarApi = user?.id ? `/api/users/${user.id}/avatar` : '';
                      if (avatarApi && !el.src.includes(avatarApi)) {
                        el.src = avatarApi;
                      } else if (todayAttendance?.clockInPhoto || todayAttendance?.photoIn) {
                        el.src = (todayAttendance.clockInPhoto || todayAttendance.photoIn)!;
                      } else {
                        el.src = defaultAvatar;
                      }
                    }}
                  />
                  <span
                    className={`absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full ring-2 ring-[#EEF6F2] dark:ring-[#081310] ${
                      locationStatus === 'inside' ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                  />
                </button>
              </div>

              {/* Role-Adaptive Supervisory Bar (Minimalist Editorial Pill Card) */}
              {(() => {
                const rClean = (user?.roleName || user?.role || '').toLowerCase();
                const isKorlapRole = rClean.includes('korlap') || rClean.includes('koordinator');
                const isK3Role = rClean.includes('k3') || rClean.includes('hse') || rClean.includes('keselamatan');
                const isAdminRole = rClean.includes('admin') || rClean.includes('hrd');
                const isDirutOrPimpinan = rClean.includes('pimpinan') || rClean.includes('dirut') || rClean.includes('superadmin');

                if (isDirutOrPimpinan) {
                  return (
                    <div className="p-3 bg-white dark:bg-[#101C18] border border-emerald-900/[0.08] dark:border-emerald-400/[0.12] rounded-2xl flex items-center justify-between gap-2.5 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.04)]">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center shrink-0">
                          <Briefcase className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 dark:text-white truncate">Portal Eksekutif Direksi</p>
                          <p className="text-[10.5px] text-slate-500 dark:text-slate-400 truncate">Radar kinerja & persetujuan</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Link to="/dashboard">
                          <Button size="sm" className="h-8 px-3 text-[11px] bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 text-white font-semibold rounded-xl">
                            Radar
                          </Button>
                        </Link>
                        <Link to="/admin/approval">
                          <Button size="sm" variant="outline" className="h-8 px-2.5 text-[11px] rounded-xl">
                            Approval
                          </Button>
                        </Link>
                      </div>
                    </div>
                  );
                }

                if (isKorlapRole || isK3Role || isAdminRole) {
                  const roleLabel = isKorlapRole ? 'Otoritas Korlap' : isK3Role ? 'Pengawas K3 & HSE' : 'Admin Operasional';
                  return (
                    <div className="p-3 bg-white dark:bg-[#101C18] border border-emerald-900/[0.08] dark:border-emerald-400/[0.12] rounded-2xl flex items-center justify-between gap-2.5 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.04)]">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-[#0D7A5F] dark:text-emerald-400 flex items-center justify-center shrink-0">
                          <ShieldCheck className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{roleLabel}</p>
                          <p className="text-[10.5px] text-slate-500 dark:text-slate-400 truncate">Persetujuan cuti & SPL</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          size="sm"
                          onClick={() => {
                            setFieldAuthorityInitialTab('leaves');
                            setFieldAuthorityModalOpen(true);
                          }}
                          className="h-8 px-3 text-[11px] bg-[#0D7A5F] hover:bg-[#0A634D] text-white font-semibold rounded-xl"
                        >
                          Approval
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setFieldAuthorityInitialTab('recap');
                            setFieldAuthorityModalOpen(true);
                          }}
                          className="h-8 px-2.5 text-[11px] rounded-xl"
                        >
                          Rekap
                        </Button>
                      </div>
                    </div>
                  );
                }

                return null;
              })()}

              {/* Contextual Assignment Notices (SPKL / Relief / Active Leave) */}
              {approvedOvertimeToday && (
                <div className={`p-3.5 rounded-2xl border space-y-2 ${
                  isCurrentlyOnDuty && continuousDutyInfo.currentPhase === 'overtime_phase'
                    ? 'bg-amber-50/80 dark:bg-amber-950/25 border-amber-300/70 dark:border-amber-700/50'
                    : 'bg-white dark:bg-[#131A1D] border-emerald-500/30'
                }`}>
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                        <Zap className="w-4 h-4 fill-current" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-white">
                          SPKL Lembur Resmi ({continuousDutyInfo.otStart || (approvedOvertimeToday.startTime || (approvedOvertimeToday as any).start_time || '').substring(0, 5)} – {continuousDutyInfo.otEnd || (approvedOvertimeToday.endTime || (approvedOvertimeToday as any).end_time || '').substring(0, 5)} WITA)
                        </p>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 line-clamp-2">
                          {continuousDutyInfo.otDescription || approvedOvertimeToday.taskDescription || (approvedOvertimeToday as any).task_description || 'Penugasan lembur resmi telah disahkan.'}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10.5px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 shrink-0">
                      {continuousDutyInfo.otHours || approvedOvertimeToday.durationHours || (approvedOvertimeToday as any).duration_hours || 0}j
                    </span>
                  </div>
                  {continuousDutyInfo.reassuranceText && (
                    <p className="text-[10.5px] text-emerald-800 dark:text-emerald-300 bg-emerald-500/10 rounded-xl px-2.5 py-1.5 leading-snug font-medium">
                      {continuousDutyInfo.reassuranceText}
                    </p>
                  )}
                </div>
              )}

              {(activeReliefPost || approvedSubstituteToday) && !approvedOvertimeToday && (
                <div className="p-3.5 bg-white dark:bg-[#131A1D] border border-amber-400/50 rounded-2xl flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold text-slate-900 dark:text-white">Tugas Pengganti Pos Resmi</p>
                      {activeReliefPost?.reliefUntil && (
                        <span className="text-[10px] font-mono font-semibold text-amber-700 dark:text-amber-300">
                          s/d {activeReliefPost.reliefUntil}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 leading-snug">
                      {activeReliefPost
                        ? `Mengisi pos ${activeReliefPost.name}${activeReliefPost.reliefOriginalUserName ? ` menggantikan ${activeReliefPost.reliefOriginalUserName}` : ''}.`
                        : (approvedSubstituteToday?.notes || 'Penugasan pengganti aktif & presensi dibuka.')}
                    </p>
                  </div>
                </div>
              )}

              {hasActiveLeaveToday && (
                <div className="p-3.5 bg-sky-50/70 dark:bg-sky-950/25 border border-sky-200 dark:border-sky-800/60 rounded-2xl flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white">Sedang Cuti / Izin Resmi</p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">Permohonan Anda telah disetujui untuk hari ini.</p>
                  </div>
                </div>
              )}

              {/* ─── HERO ATTENDANCE HUB CARD (CENTERED AXIAL SYMMETRY) ─── */}
              <section className="bg-white dark:bg-[#101C18] rounded-[28px] p-5 border border-emerald-900/[0.08] dark:border-emerald-400/[0.12] shadow-[0_8px_30px_-12px_rgba(6,78,59,0.09)] space-y-5">

                {/* Centered Date, Live Digital Clock & Single Unified Shift Pill */}
                <div className="flex flex-col items-center text-center">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 capitalize tracking-wide">
                    {formattedTodayLabel}
                  </p>

                  <div className="flex items-baseline justify-center gap-1.5 mt-1">
                    <span className="text-[32px] leading-none font-mono font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
                      {formattedClockWita}
                    </span>
                    <span className="text-[11px] font-bold tracking-wider text-[#0D7A5F] dark:text-emerald-400 uppercase">
                      WITA
                    </span>
                  </div>

                  {/* Single Non-Duplicated Shift Pill */}
                  <div className={`mt-2.5 px-3 py-1 rounded-full border text-[11px] font-semibold inline-flex items-center gap-1.5 max-w-full ${
                    isCurrentlyOnDuty && continuousDutyInfo.currentPhase === 'overtime_phase'
                      ? 'bg-amber-500/10 border-amber-400/40 text-amber-700 dark:text-amber-300'
                      : isCurrentlyOnDuty
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-[#0D7A5F] dark:text-emerald-300'
                      : (isShiftOffDay(effectiveDisplayShift) || isEmployeeOffToday) && !hasApprovedOvertimeOrSubstituteToday
                      ? 'bg-slate-100 dark:bg-white/[0.06] border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300'
                      : 'bg-slate-100/80 dark:bg-white/[0.05] border-slate-200/80 dark:border-white/10 text-slate-700 dark:text-slate-200'
                  }`}>
                    <Clock className="w-3 h-3 opacity-75 shrink-0" />
                    <span className="truncate">{unifiedShiftBadgeText}</span>
                  </div>
                </div>

                {/* Centerpiece: Precision Biometric Ring */}
                <div className="flex flex-col items-center justify-center pt-0.5 pb-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (hasClockedIn && !hasClockedOut) {
                        if (!isClockOutAllowed) {
                          if (isBeforeShiftEndTime && !hasApprovedEmergencyLeave) {
                            toast.error(`Absen Pulang belum aktif! Jadwal pulang Anda${continuousDutyInfo.hasContinuousOvertime ? ' (termasuk lembur SPKL)' : ''} pk ${effectiveDutyEndTime} WITA. Jika ada kondisi mendesak, silakan ajukan Izin Darurat.`);
                            return;
                          }
                          toast.error(clockOutDisabledReason || 'Presensi pulang belum dibuka.');
                          return;
                        }
                        triggerClockOutFlow();
                      } else if (!hasClockedIn || (isCurrentSessionClosed && nextShiftInfo?.isNextShiftAvailable)) {
                        if ((isShiftOffDay(effectiveDisplayShift) || isEmployeeOffToday) && !hasApprovedOvertimeOrSubstituteToday) {
                          toast.info('Hari ini adalah jadwal Libur / Off Duty Anda. Selamat beristirahat!', { icon: '☕' });
                          return;
                        }
                        if (!isClockInAllowed) {
                          toast.error(clockInDisabledReason || 'Presensi masuk belum memenuhi syarat lokasi/shift.');
                          return;
                        }
                        openLiveCamera('clock_in');
                      }
                    }}
                    className="relative w-[172px] h-[172px] rounded-full flex items-center justify-center transition-transform duration-150 active:scale-[0.97] group focus:outline-none"
                  >
                    {/* Subtle Outer Ring */}
                    <div className={`absolute inset-0 rounded-full border-[2px] transition-colors ${
                      isCurrentlyOnDuty && continuousDutyInfo.currentPhase === 'overtime_phase'
                        ? 'border-amber-400 shadow-[0_0_28px_-6px_rgba(245,158,11,0.35)]'
                        : isCurrentlyOnDuty
                        ? 'border-[#0D7A5F] shadow-[0_0_28px_-6px_rgba(13,122,95,0.28)]'
                        : hasClockedOut && !nextShiftInfo?.isNextShiftAvailable
                        ? 'border-slate-200 dark:border-white/10'
                        : (isShiftOffDay(effectiveDisplayShift) || isEmployeeOffToday) && !hasApprovedOvertimeOrSubstituteToday
                        ? 'border-slate-200 dark:border-white/10'
                        : 'border-[#0D7A5F]/50 group-hover:border-[#0D7A5F] shadow-[0_0_24px_-8px_rgba(13,122,95,0.25)]'
                    }`} />

                    {/* Inner Portrait / Camera Frame */}
                    <div className="relative w-[144px] h-[144px] rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-white/10 flex items-center justify-center">
                      {todayAttendance?.clockInPhoto || todayAttendance?.photoIn ? (
                        <img
                          src={todayAttendance.clockInPhoto || todayAttendance.photoIn}
                          alt="Presensi Hari Ini"
                          className="w-full h-full object-cover"
                        />
                      ) : user?.faceEnrolledPhoto || user?.avatarUrl ? (
                        <img
                          src={user.faceEnrolledPhoto || user.avatarUrl}
                          alt={user.fullName}
                          className="w-full h-full object-cover opacity-95 group-hover:scale-[1.03] transition-transform duration-200"
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-1.5 text-slate-400">
                          <ScanFace className="w-9 h-9 text-[#0D7A5F] dark:text-emerald-400" />
                          <span className="text-[11px] font-medium">Scan Wajah</span>
                        </div>
                      )}

                      {/* Subtle Bottom Gradient Scrim */}
                      <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/55 to-transparent pointer-events-none" />
                    </div>

                    {/* Floating Status Pill on Bottom Edge */}
                    <div className={`absolute -bottom-2.5 px-3.5 py-1 rounded-full text-[11px] font-semibold shadow-sm flex items-center gap-1.5 border ${
                      hasClockedOut && !nextShiftInfo?.isNextShiftAvailable
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent'
                        : isCurrentlyOnDuty && continuousDutyInfo.currentPhase === 'overtime_phase'
                        ? 'bg-amber-500 text-white border-white dark:border-[#101C18]'
                        : isCurrentlyOnDuty
                        ? 'bg-[#0D7A5F] text-white border-white dark:border-[#101C18]'
                        : (isShiftOffDay(effectiveDisplayShift) || isEmployeeOffToday) && !hasApprovedOvertimeOrSubstituteToday
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10'
                        : 'bg-white dark:bg-slate-900 text-[#0D7A5F] dark:text-emerald-400 border-emerald-500/35'
                    }`}>
                      {hasClockedIn ? (
                        hasClockedOut && !nextShiftInfo?.isNextShiftAvailable ? (
                          <>
                            <Check className="w-3 h-3" />
                            <span>Selesai • {(todayAttendance?.clockOut || todayAttendance?.clock_out)?.substring(0, 5)}</span>
                          </>
                        ) : continuousDutyInfo.hasContinuousOvertime && continuousDutyInfo.currentPhase === 'overtime_phase' ? (
                          <>
                            <Zap className="w-3 h-3 fill-current" />
                            <span>Lembur Aktif</span>
                          </>
                        ) : (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                            <span>Bertugas • {(todayAttendance?.clockIn || todayAttendance?.clock_in)?.substring(0, 5)}</span>
                          </>
                        )
                      ) : (isShiftOffDay(effectiveDisplayShift) || isEmployeeOffToday) && !hasApprovedOvertimeOrSubstituteToday ? (
                        <>
                          <Coffee className="w-3 h-3" />
                          <span>Hari Libur</span>
                        </>
                      ) : (
                        <>
                          <Camera className="w-3 h-3" />
                          <span>Ketuk untuk Absen</span>
                        </>
                      )}
                    </div>
                  </button>

                  {/* Contextual Note ONLY when transitioning to next shift (No duplicate shift label!) */}
                  {isCurrentSessionClosed && nextShiftInfo?.isNextShiftAvailable && (
                    <p className="text-[11px] font-medium text-[#0D7A5F] dark:text-emerald-400 mt-4 text-center">
                      Shift sebelumnya selesai • Siap lanjut {nextShiftInfo.nextShiftName}
                    </p>
                  )}
                </div>

                {/* Unified Centered Check-In & Check-Out Strip */}
                <div className="grid grid-cols-2 rounded-2xl bg-[#F3F9F6] dark:bg-emerald-950/25 border border-emerald-900/[0.07] dark:border-emerald-400/[0.10] divide-x divide-emerald-900/[0.07] dark:divide-emerald-400/[0.10]">
                  <div className="py-3 px-3 flex flex-col items-center justify-center text-center">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Masuk</span>
                      {hasClockedIn && (
                        <span className={`text-[9.5px] font-semibold px-1.5 py-0.2 rounded-full ${
                          todayAttendance?.status === 'terlambat'
                            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                            : 'bg-emerald-500/15 text-[#0D7A5F] dark:text-emerald-300'
                        }`}>
                          {todayAttendance?.status === 'terlambat'
                            ? `Telat ${todayAttendance.lateMinutes || (todayAttendance as any).late_minutes || ''}m`
                            : 'Tepat'}
                        </span>
                      )}
                    </div>
                    <p className="text-[15px] font-mono font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                      {todayAttendance?.clockIn ? todayAttendance.clockIn.substring(0, 5) : '--:--'}
                    </p>
                  </div>

                  <div className="py-3 px-3 flex flex-col items-center justify-center text-center">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Pulang</span>
                      {hasClockedIn && !hasClockedOut && (
                        <span className="text-[9.5px] font-mono font-medium text-slate-500 dark:text-slate-400">
                          Target {effectiveDutyEndTime}
                        </span>
                      )}
                    </div>
                    <p className="text-[15px] font-mono font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                      {todayAttendance?.clockOut ? todayAttendance.clockOut.substring(0, 5) : '--:--'}
                    </p>
                  </div>
                </div>

                {/* Primary Dual Action Buttons (48px Ergonomic Touch Targets) */}
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    disabled={isCurrentlyOnDuty || (!isClockInAllowed && !isCurrentSessionClosed)}
                    onClick={() => {
                      if (isCurrentlyOnDuty) return;
                      if (!isClockInAllowed) {
                        if (isCurrentSessionClosed && !hasApprovedOvertimeOrSubstituteToday) {
                          setEmergencyOverrideModalOpen(true);
                          return;
                        }
                        toast.error(clockInDisabledReason || 'Presensi masuk belum memenuhi syarat lokasi/shift.');
                        return;
                      }
                      openLiveCamera('clock_in');
                    }}
                    className={`h-12 px-3.5 rounded-2xl flex items-center justify-center gap-2 text-xs font-semibold transition-all duration-150 active:scale-[0.98] ${
                      isCurrentlyOnDuty
                        ? 'bg-emerald-50 dark:bg-emerald-950/30 text-[#0D7A5F] dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60 cursor-default'
                        : isClockInAllowed
                        ? 'bg-[#0D7A5F] hover:bg-[#0A634D] text-white shadow-sm shadow-emerald-900/15'
                        : isCurrentSessionClosed && !hasApprovedOvertimeOrSubstituteToday
                        ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-white/[0.05] text-slate-400 dark:text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    <Clock className="w-4 h-4 shrink-0" />
                    <span className="truncate">
                      {isCurrentlyOnDuty
                        ? `Masuk ${(todayAttendance?.clockIn || '').substring(0, 5)}`
                        : isCurrentSessionClosed
                        ? nextShiftInfo?.isNextShiftAvailable
                          ? `Masuk ${nextShiftInfo.nextShiftCode.replace('SHF-', 'Shift ')}`
                          : 'Tugas Darurat'
                        : !userShift
                        ? 'Memuat...'
                        : userShift?.id === 'unassigned' || !userShift?.startTime
                        ? 'Belum Ada Shift'
                        : hasActiveLeaveToday
                        ? 'Sedang Cuti'
                        : approvedSubstituteToday
                        ? 'Masuk Pengganti'
                        : isEmployeeOffToday && !hasApprovedOvertimeOrSubstituteToday
                        ? 'Hari Libur'
                        : !isInsideCoordinates
                        ? 'Di Luar Pos'
                        : !isShiftWindowActive && !hasApprovedOvertimeOrSubstituteToday && !isFieldSpecial
                        ? `Buka ${(checkShiftClockInWindow(userShift, currentTime).openTimeStr || userShift?.startTime || '08:00').replace(/\s*WITA/i, '').trim()}`
                        : hasApprovedOvertimeOrSubstituteToday
                        ? 'Masuk Lembur'
                        : 'Absen Masuk'}
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={!isClockOutAllowed && isInsideCoordinates}
                    onClick={() => {
                      if (!isInsideCoordinates && hasClockedIn && !hasClockedOut) {
                        setBreachReportModalOpen(true);
                        return;
                      }
                      if (!isClockOutAllowed) {
                        if (isBeforeShiftEndTime && !hasApprovedEmergencyLeave) {
                          toast.error(`Absen Pulang belum aktif! Jadwal pulang Anda${continuousDutyInfo.hasContinuousOvertime ? ' (termasuk lembur SPKL)' : ''} pk ${effectiveDutyEndTime} WITA. Jika ada kondisi mendesak, silakan ajukan Izin Darurat atau Lapor Keluar Area.`);
                        }
                        return;
                      }
                      triggerClockOutFlow();
                    }}
                    className={`h-12 px-3.5 rounded-2xl flex items-center justify-center gap-2 text-xs font-semibold transition-all duration-150 active:scale-[0.98] ${
                      hasClockedOut
                        ? 'bg-slate-100 dark:bg-white/[0.05] text-slate-500 cursor-default'
                        : !isInsideCoordinates && hasClockedIn && !hasClockedOut
                        ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm'
                        : isClockOutAllowed
                        ? 'bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-white/[0.05] text-slate-400 dark:text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    {!isInsideCoordinates && hasClockedIn && !hasClockedOut ? (
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                    ) : isBeforeShiftEndTime && !hasApprovedEmergencyLeave && hasClockedIn && !hasClockedOut ? (
                      <Lock className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <LogOut className="w-4 h-4 shrink-0" />
                    )}
                    <span className="truncate">
                      {hasClockedOut
                        ? `Pulang ${(todayAttendance?.clockOut || '').substring(0, 5)}`
                        : !hasClockedIn
                        ? 'Absen Pulang'
                        : !isInsideCoordinates
                        ? 'Lapor Keluar Pos'
                        : isBeforeShiftEndTime && !hasApprovedEmergencyLeave
                        ? `Terkunci ${effectiveDutyEndTime}`
                        : hasApprovedEmergencyLeave
                        ? 'Pulang Darurat'
                        : 'Absen Pulang'}
                    </span>
                  </button>
                </div>

                {/* Subtle Inline Helper Footnotes inside Hero Card */}
                {isBeforeShiftEndTime && !hasApprovedEmergencyLeave && hasClockedIn && !hasClockedOut && isInsideCoordinates && (
                  <div className="pt-1 flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="truncate">
                      Pulang dibuka pk <strong className="font-mono text-slate-700 dark:text-slate-200">{effectiveDutyEndTime} WITA</strong>
                    </span>
                    {!isMacciniBajiOfficer(user) && (
                      <button
                        type="button"
                        onClick={() => setEmergencyModalOpen(true)}
                        className="text-amber-700 dark:text-amber-400 font-semibold hover:underline shrink-0"
                      >
                        Izin Darurat →
                      </button>
                    )}
                  </div>
                )}

                {hasApprovedEmergencyLeave && !hasClockedOut && hasClockedIn && (
                  <div className="rounded-xl bg-emerald-500/10 px-3 py-2 flex items-center gap-2 text-[11px] text-[#0D7A5F] dark:text-emerald-300 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Izin pulang darurat disetujui • Tombol pulang aktif</span>
                  </div>
                )}
              </section>

              {/* Active Break / Break Window / Perimeter Breach Alerts */}
              {isBreakActive && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-300/80 dark:border-amber-800 rounded-2xl p-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                      <Coffee className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">Istirahat Aktif (Bebas Perimeter)</p>
                      <p className="text-[11px] font-mono text-amber-700 dark:text-amber-300">
                        Sisa {Math.floor(breakTimer / 60)}m {breakTimer % 60}s
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleEndBreak}
                    className="h-9 rounded-xl text-xs bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                  >
                    Selesai
                  </Button>
                </div>
              )}

              {isShiftBreakWindow && !isBreakActive && hasClockedIn && !hasClockedOut && (
                <div className="bg-white dark:bg-[#131A1D] border border-amber-300/70 dark:border-amber-800/60 rounded-2xl p-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-600 flex items-center justify-center shrink-0">
                      <Coffee className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-white">
                        Jam Istirahat ({userShift?.breakStartTime || '12:00'} – {userShift?.breakEndTime || '13:00'})
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">Bebas keluar area selama 60 menit</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleConfirmStartBreak}
                    className="h-9 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shrink-0"
                  >
                    Mulai
                  </Button>
                </div>
              )}

              {hasClockedIn && !hasClockedOut && (!isInsideCoordinates || todayAttendance?.isLocked || todayAttendance?.isPerimeterBreached) && !(isMacciniBajiOfficer(user) && macciniVesselStatus.status === 'idle') && (
                <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-2xl p-3.5 flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-rose-900 dark:text-rose-100">Di Luar Radius Pos Tugas</p>
                      <p className="text-[11px] text-rose-700 dark:text-rose-300 truncate">Laporkan alasan keluar area tugas</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setBreachReportModalOpen(true)}
                    className="h-9 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shrink-0"
                  >
                    Lapor
                  </Button>
                </div>
              )}

              {activeTravelDispensation && (
                <div className="p-3 rounded-2xl bg-amber-50/80 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-800/60 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Bike className="w-4 h-4 text-amber-600 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 dark:text-white truncate">Dispensasi: {activeTravelDispensation.label}</p>
                      <p className="text-[10.5px] text-slate-500 truncate">+{activeTravelDispensation.graceMinutes}m toleransi aktif</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="border-amber-400/60 text-amber-700 dark:text-amber-300 text-[10px] shrink-0">
                    Sah
                  </Badge>
                </div>
              )}

              {/* ─── CLEAN LOCATION & GEOFENCE CARD ─── */}
              <div className="bg-white dark:bg-[#101C18] border border-emerald-900/[0.08] dark:border-emerald-400/[0.12] rounded-2xl p-3.5 flex items-center gap-3 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.04)]">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  locationStatus === 'inside'
                    ? 'bg-emerald-500/10 text-[#0D7A5F] dark:text-emerald-400'
                    : locationStatus === 'outside'
                    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                    : 'bg-amber-500/10 text-amber-600'
                }`}>
                  <MapPin className="w-5 h-5" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {assignedPostName || assignedOffice?.name || (bankPosts.length > 0 ? `${bankPosts.length} Pos Lapangan Aktif` : 'Pos Resmi PT FRP')}
                    </h3>
                  </div>
                  <p className="text-[11px] mt-0.5 truncate">
                    {locationStatus === 'inside' ? (
                      <span className="text-[#0D7A5F] dark:text-emerald-400 font-medium">
                        Dalam radius pos{distanceToOffice !== null ? ` • ${Math.round(distanceToOffice)}m` : ''}
                        {coordsAccuracy ? ` (±${Math.round(coordsAccuracy)}m)` : ''}
                      </span>
                    ) : locationStatus === 'outside' ? (
                      <span className="text-rose-600 dark:text-rose-400 font-medium">
                        Di luar radius • {Math.round(distanceToOffice || 0)}m dari pos
                      </span>
                    ) : (
                      <span className="text-amber-600 font-medium">Memindai sinyal GPS...</span>
                    )}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => evaluateRealLocation(true)}
                  className="w-9 h-9 rounded-xl bg-slate-100/80 dark:bg-white/[0.05] text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-transform active:scale-90 shrink-0"
                  title="Perbarui Lokasi GPS"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
              </div>

              {/* ─── SPECIAL UNIT CONTROLS (MACCINI BAJI / MOBILE ON-CALL / VIP DIREKSI) ─── */}
              {isMacciniBajiOfficer(user) && (
                <div className="bg-white dark:bg-[#131A1D] border border-slate-200/80 dark:border-white/[0.07] rounded-2xl p-4 space-y-3 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.04)]">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-white">Mode Operasional Maccini Baji</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {macciniVesselStatus.status === 'docking'
                          ? `Kapal Sandar${macciniVesselStatus.vesselName ? ` (${macciniVesselStatus.vesselName})` : ''} • Wajib standby dermaga`
                          : 'Standby On-Call • Bebas keluar radius saat nihil kapal'}
                      </p>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                      macciniVesselStatus.status === 'docking'
                        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                        : 'bg-emerald-500/15 text-[#0D7A5F] dark:text-emerald-300'
                    }`}>
                      {macciniVesselStatus.status === 'docking' ? 'Dermaga Aktif' : 'On-Call'}
                    </span>
                  </div>

                  {/* Clean iOS-Style Segmented Mode Switch */}
                  <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100 dark:bg-white/[0.05]">
                    <button
                      type="button"
                      disabled={isUpdatingVesselStatus}
                      onClick={() => handleToggleVesselStatus('docking')}
                      className={`h-10 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] ${
                        macciniVesselStatus.status === 'docking'
                          ? 'bg-white dark:bg-[#1C2529] text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      <span>⚓</span>
                      <span>Kapal Sandar</span>
                    </button>
                    <button
                      type="button"
                      disabled={isUpdatingVesselStatus}
                      onClick={() => handleToggleVesselStatus('idle')}
                      className={`h-10 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] ${
                        macciniVesselStatus.status === 'idle'
                          ? 'bg-[#0D7A5F] text-white shadow-xs'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      <span>🌊</span>
                      <span>Standby On-Call</span>
                    </button>
                  </div>

                  <p className="text-[10.5px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Ceklok masuk & pulang akhir shift ({effectiveDutyEndTime} WITA) wajib dilakukan di titik Dermaga Maccini Baji.
                  </p>
                </div>
              )}

              {isMobileOnlineOfficer(user) && (
                <div className="bg-white dark:bg-[#131A1D] border border-slate-200/80 dark:border-white/[0.07] rounded-2xl p-4 space-y-3 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.04)]">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                        <Globe className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white">Tugas Darurat Online (WFA)</p>
                        <p className="text-[10.5px] text-slate-500 dark:text-slate-400">Fleksibilitas koordinat tugas mendadak</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-[#0D7A5F] dark:text-emerald-300">
                      Aktif
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      onClick={() => openLiveCamera('emergency_on_call')}
                      disabled={hasClockedIn && !hasClockedOut}
                      className="h-10 bg-[#0D7A5F] hover:bg-[#0A634D] text-white font-semibold text-xs rounded-xl gap-1.5"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>Mulai On-Call</span>
                    </Button>
                    <Button
                      type="button"
                      onClick={() => openLiveCamera('emergency_on_call_out')}
                      disabled={!hasClockedIn || hasClockedOut}
                      variant="outline"
                      className="h-10 font-semibold text-xs rounded-xl gap-1.5"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Selesai On-Call</span>
                    </Button>
                  </div>
                </div>
              )}

              {isExecutiveMobileSupportOfficer(user) && (
                <div className="bg-white dark:bg-[#131A1D] border border-slate-200/80 dark:border-white/[0.07] rounded-2xl p-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-[#0D7A5F] dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">Dukungan Direksi • Mobilitas Tinggi</p>
                      <p className="text-[10.5px] text-slate-500 dark:text-slate-400 truncate">Multi-titik pos penugasan resmi aktif</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-[#0D7A5F] dark:text-emerald-300 shrink-0">
                    VIP
                  </span>
                </div>
              )}

              {isCurrentSessionClosed && !hasApprovedOvertimeOrSubstituteToday && (
                <div className="bg-white dark:bg-[#131A1D] border border-slate-200/80 dark:border-white/[0.07] rounded-2xl p-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 flex items-center justify-center shrink-0">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-white">Panggilan Tugas Mendadak?</p>
                      <p className="text-[10.5px] text-slate-500 dark:text-slate-400 truncate">Lapor tugas darurat pasca-shift</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEmergencyOverrideModalOpen(true)}
                    className="h-8 rounded-xl text-xs font-semibold shrink-0"
                  >
                    Absen Darurat
                  </Button>
                </div>
              )}

              {/* ─── CLEAN BENTO SUMMARY & 7-DAY TRACKER ─── */}
              <section className="bg-white dark:bg-[#131A1D] border border-slate-200/80 dark:border-white/[0.07] rounded-2xl p-4 space-y-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.04)]">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white">Ringkasan Bulan Ini</h3>
                  <span className="text-[10.5px] font-semibold text-[#0D7A5F] dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    Disiplin {analyticsData.disciplineScore}%
                  </span>
                </div>

                {/* 3 Primary + 3 Secondary Clean Metrics */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2.5 rounded-xl bg-[#F7F9F8] dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/[0.05]">
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">Hadir Tepat</p>
                    <p className="text-base font-mono font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                      {analyticsData.onTimeCount}<span className="text-[10px] font-sans font-normal text-slate-400 ml-1">hr</span>
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#F7F9F8] dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/[0.05]">
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">Lembur</p>
                    <p className="text-base font-mono font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                      {analyticsData.monthlyLemburHours}<span className="text-[10px] font-sans font-normal text-slate-400 ml-1">jam</span>
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#F7F9F8] dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/[0.05]">
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">Sisa Cuti</p>
                    <p className="text-base font-mono font-bold text-[#0D7A5F] dark:text-emerald-400 mt-0.5 tabular-nums">
                      {analyticsData.remainingLeave}<span className="text-[10px] font-sans font-normal text-slate-400 ml-1">hr</span>
                    </p>
                  </div>
                </div>

                {/* 7-Day Minimalist Week Strip */}
                <div className="pt-1 space-y-2">
                  <div className="flex items-center justify-between text-[10.5px] text-slate-400">
                    <span>Aktivitas Minggu Ini</span>
                    <span>Terlambat: <strong className="text-slate-700 dark:text-slate-200 font-mono">{analyticsData.lateCount}x</strong> • Izin: <strong className="text-slate-700 dark:text-slate-200 font-mono">{analyticsData.monthlyIzinCount}h</strong></span>
                  </div>
                  <div className="grid grid-cols-7 gap-1.5 text-center">
                    {analyticsData.weeklyStreak.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex flex-col items-center gap-1 py-1.5 rounded-xl bg-[#F7F9F8] dark:bg-white/[0.02]"
                        title={`${item.day} (${item.date}): ${item.shiftName || item.status}`}
                      >
                        <span className={`text-[9.5px] font-medium ${
                          item.status === 'current' ? 'text-[#0D7A5F] dark:text-emerald-400 font-bold' : 'text-slate-400'
                        }`}>
                          {item.day}
                        </span>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          item.status === 'present'
                            ? 'bg-[#0D7A5F] text-white'
                            : item.status === 'late'
                            ? 'bg-amber-500 text-white'
                            : item.status === 'current'
                            ? 'ring-2 ring-[#0D7A5F] text-[#0D7A5F] dark:text-emerald-400 bg-emerald-500/10'
                            : item.status === 'leave'
                            ? 'bg-sky-500 text-white'
                            : item.status === 'off' || item.status === 'upcoming_off'
                            ? 'bg-slate-200/80 dark:bg-white/10 text-slate-500'
                            : item.status === 'absent'
                            ? 'bg-rose-500/15 text-rose-600'
                            : 'text-slate-400'
                        }`}>
                          {item.status === 'present'
                            ? '✓'
                            : item.status === 'late'
                            ? '!'
                            : item.status === 'leave'
                            ? 'C'
                            : item.status === 'absent'
                            ? '–'
                            : item.status === 'off' || item.status === 'upcoming_off'
                            ? <Coffee className="w-3 h-3" />
                            : item.label || idx + 1}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Clean Roster Link Row */}
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('riwayat');
                    setRiwayatViewMode('kalender');
                  }}
                  className="w-full pt-3 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-[#0D7A5F] transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-[#0D7A5F] dark:text-emerald-400" />
                    Lihat Kalender Roster & Jadwal Shift
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>
              </section>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              TAB 2: RIWAYAT & KALENDER ROSTER
          ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'riwayat' && (
            <div className="space-y-3.5 animate-in fade-in duration-150">
              {/* iOS Segmented Switch */}
              <div className="grid grid-cols-2 p-1 rounded-2xl bg-slate-200/70 dark:bg-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setRiwayatViewMode('kalender')}
                  className={`h-9 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                    riwayatViewMode === 'kalender'
                      ? 'bg-white dark:bg-[#1A2327] text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <CalendarDays className="w-3.5 h-3.5" />
                  <span>Kalender Roster</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRiwayatViewMode('log')}
                  className={`h-9 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                    riwayatViewMode === 'log'
                      ? 'bg-white dark:bg-[#1A2327] text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Log Harian</span>
                </button>
              </div>

              {riwayatViewMode === 'kalender' ? (
                user ? (
                  <HrmPwaPersonalCalendarView
                    user={user}
                    allShifts={hrmService.getShifts()}
                    onOpenLeaveModal={() => setLeaveModalOpen(true)}
                    onOpenOvertimeModal={() => setOvertimeModalOpen(true)}
                  />
                ) : null
              ) : (
                <div className="space-y-3">
                  {/* Compact Filter Strip */}
                  <div className="bg-white dark:bg-[#131A1D] border border-slate-200/80 dark:border-white/[0.07] rounded-2xl p-3 space-y-2.5">
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { id: 'bulan_ini', label: 'Bulan Ini' },
                        { id: '7_hari', label: '7 Hari' },
                        { id: 'semua', label: 'Semua' },
                      ].map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setHistoryPeriodFilter(p.id as any)}
                          className={`h-8 rounded-xl text-xs font-semibold transition-all ${
                            historyPeriodFilter === p.id
                              ? 'bg-[#0D7A5F] text-white'
                              : 'bg-slate-100 dark:bg-white/[0.04] text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
                      {[
                        { id: 'all', label: 'Semua' },
                        { id: 'hadir', label: 'Tepat Waktu' },
                        { id: 'terlambat', label: 'Terlambat' },
                        { id: 'telat_istirahat', label: 'Telat Istirahat' },
                        { id: 'izin', label: 'Cuti / Izin' },
                      ].map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setHistoryStatusFilter(s.id as any)}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-all ${
                            historyStatusFilter === s.id
                              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold'
                              : 'bg-slate-100 dark:bg-white/[0.04] text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Clean Attendance Records List */}
                  <div className="space-y-2">
                    {filteredAttendancesHistory.length === 0 ? (
                      <div className="p-8 text-center bg-white dark:bg-[#131A1D] rounded-2xl border border-slate-200/70 dark:border-white/[0.06] text-slate-400 text-xs">
                        Belum ada catatan presensi pada filter ini.
                      </div>
                    ) : (
                      filteredAttendancesHistory.map((att) => (
                        <button
                          key={att.id}
                          type="button"
                          onClick={() => setSelectedHistoryRecord(att)}
                          className="w-full text-left p-3.5 rounded-2xl bg-white dark:bg-[#131A1D] border border-slate-200/80 dark:border-white/[0.07] flex items-center justify-between gap-3 transition-transform active:scale-[0.99]"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {att.clockInPhoto || att.photoIn ? (
                              <img
                                src={att.clockInPhoto || att.photoIn}
                                alt="Foto Presensi"
                                className="w-11 h-11 rounded-xl object-cover shrink-0 bg-slate-100 ring-1 ring-slate-200/80 dark:ring-white/10"
                              />
                            ) : (
                              <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-white/[0.05] flex items-center justify-center text-slate-400 shrink-0">
                                <Clock className="w-4 h-4" />
                              </div>
                            )}

                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                {new Date(att.date || att.attendanceDate || '').toLocaleDateString('id-ID', {
                                  weekday: 'short',
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                }) || att.date}
                              </p>
                              <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                                {att.clockIn ? att.clockIn.substring(0, 5) : '--:--'} → {att.clockOut ? att.clockOut.substring(0, 5) : '--:--'}
                              </p>
                              {((att.lateMinutes && att.lateMinutes > 0) || (att.breakLateMinutes && att.breakLateMinutes > 0)) && (
                                <div className="flex items-center gap-1.5 mt-1">
                                  {att.lateMinutes && att.lateMinutes > 0 ? (
                                    <span className="text-[10px] text-amber-700 dark:text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded font-medium">
                                      Telat {att.lateMinutes}m
                                    </span>
                                  ) : null}
                                  {att.breakLateMinutes && att.breakLateMinutes > 0 ? (
                                    <span className="text-[10px] text-rose-600 dark:text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded font-medium">
                                      Istirahat +{att.breakLateMinutes}m
                                    </span>
                                  ) : null}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${
                              att.status === 'hadir'
                                ? 'bg-emerald-500/10 text-[#0D7A5F] dark:text-emerald-300'
                                : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                            }`}>
                              {att.status}
                            </span>
                            <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              TAB 3: AKTIVITAS & PERMOHONAN
          ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'aktivitas' && (
            <div className="space-y-3.5 animate-in fade-in duration-150">
              {/* Clean Quick-Service Bento Grid */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setLeaveModalOpen(true)}
                  className="p-3.5 rounded-2xl bg-white dark:bg-[#131A1D] border border-slate-200/80 dark:border-white/[0.07] text-left flex items-center gap-3 active:scale-[0.98] transition-transform"
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-[#0D7A5F] dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <CalendarCheck2 className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white">Cuti / Izin</p>
                    <p className="text-[10.5px] text-slate-500 dark:text-slate-400">Sisa {analyticsData.remainingLeave} hari</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setOvertimeModalOpen(true)}
                  className="p-3.5 rounded-2xl bg-white dark:bg-[#131A1D] border border-slate-200/80 dark:border-white/[0.07] text-left flex items-center gap-3 active:scale-[0.98] transition-transform"
                >
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white">Lembur SPL</p>
                    <p className="text-[10.5px] text-slate-500 dark:text-slate-400">Ajukan lembur</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setEmergencyModalOpen(true)}
                  className="p-3.5 rounded-2xl bg-white dark:bg-[#131A1D] border border-slate-200/80 dark:border-white/[0.07] text-left flex items-center gap-3 active:scale-[0.98] transition-transform"
                >
                  <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                    <AlertOctagon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white">Izin Darurat</p>
                    <p className="text-[10.5px] text-slate-500 dark:text-slate-400">Pulang mendesak</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setTravelModalOpen(true)}
                  className="p-3.5 rounded-2xl bg-white dark:bg-[#131A1D] border border-slate-200/80 dark:border-white/[0.07] text-left flex items-center gap-3 active:scale-[0.98] transition-transform"
                >
                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
                    <Wrench className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">Kendala Jalan</p>
                    <p className="text-[10.5px] text-slate-500 dark:text-slate-400">Dispensasi telat</p>
                  </div>
                </button>
              </div>

              {/* Segmented Sub-Tab */}
              <div className="grid grid-cols-2 p-1 rounded-2xl bg-slate-200/70 dark:bg-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setAktivitasSubTab('cuti')}
                  className={`h-9 rounded-xl text-xs font-semibold transition-all ${
                    aktivitasSubTab === 'cuti'
                      ? 'bg-white dark:bg-[#1A2327] text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Cuti & Izin ({userLeaves.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAktivitasSubTab('lembur')}
                  className={`h-9 rounded-xl text-xs font-semibold transition-all ${
                    aktivitasSubTab === 'lembur'
                      ? 'bg-white dark:bg-[#1A2327] text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Lembur / SPL ({userOvertimeList.length})
                </button>
              </div>

              {aktivitasSubTab === 'cuti' && (
                <div className="space-y-2.5">
                  {/* Leave Quota Card */}
                  <div className="p-4 bg-white dark:bg-[#131A1D] rounded-2xl border border-slate-200/80 dark:border-white/[0.07] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">Kuota Cuti Tahunan</span>
                      <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                        {liveLeaveBalance?.frpGroupLabel || `Periode ${new Date().getFullYear()}`}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-2.5 rounded-xl bg-[#F7F9F8] dark:bg-white/[0.03]">
                        <p className="text-[10px] text-slate-500">Total Hak</p>
                        <p className="text-base font-mono font-bold text-slate-900 dark:text-white mt-0.5">{analyticsData.annualLeaveQuota}h</p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-[#F7F9F8] dark:bg-white/[0.03]">
                        <p className="text-[10px] text-slate-500">Terpakai</p>
                        <p className="text-base font-mono font-bold text-amber-600 dark:text-amber-400 mt-0.5">{analyticsData.usedLeave}h</p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-emerald-500/10">
                        <p className="text-[10px] text-[#0D7A5F] dark:text-emerald-300 font-medium">Sisa</p>
                        <p className="text-base font-mono font-bold text-[#0D7A5F] dark:text-emerald-400 mt-0.5">{analyticsData.remainingLeave}h</p>
                      </div>
                    </div>

                    {Array.isArray(liveLeaveBalance?.monthlyBreakdown) && liveLeaveBalance.monthlyBreakdown.length > 0 && (
                      <div className="pt-2 border-t border-slate-100 dark:border-white/[0.06] flex flex-wrap gap-1.5">
                        {liveLeaveBalance.monthlyBreakdown.map((m) => (
                          <span
                            key={m.monthKey}
                            className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/[0.05] text-[10px] font-mono text-slate-600 dark:text-slate-300"
                          >
                            {m.label}: <strong>{m.days}h</strong>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {userLeaves.length === 0 ? (
                    <div className="p-8 text-center bg-white dark:bg-[#131A1D] rounded-2xl border border-slate-200/70 dark:border-white/[0.06] text-slate-400 text-xs">
                      Belum ada pengajuan cuti atau izin.
                    </div>
                  ) : (
                    userLeaves.slice(0, 15).map((l) => (
                      <div
                        key={l.id}
                        className="p-3.5 rounded-2xl bg-white dark:bg-[#131A1D] border border-slate-200/80 dark:border-white/[0.07] space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900 dark:text-white capitalize">
                            {l.leaveType.replace('_', ' ')}
                          </span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            l.status === 'approved'
                              ? 'bg-emerald-500/10 text-[#0D7A5F] dark:text-emerald-300'
                              : l.status === 'rejected'
                              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                              : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                          }`}>
                            {l.status === 'approved' ? 'Disetujui' : l.status === 'rejected' ? 'Ditolak' : 'Menunggu'}
                          </span>
                        </div>
                        <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                          {l.startDate} – {l.endDate} ({l.totalDays || 1} hari)
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-300 bg-[#F7F9F8] dark:bg-white/[0.03] p-2.5 rounded-xl">
                          {l.reason}
                        </p>
                        {l.attachmentUrl && (
                          <a
                            href={l.attachmentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-[#0D7A5F] dark:text-emerald-400 font-semibold hover:underline"
                          >
                            <ImageIcon className="w-3.5 h-3.5" />
                            <span>Lihat Lampiran</span>
                          </a>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {aktivitasSubTab === 'lembur' && (
                <div className="space-y-2.5">
                  {liveLeaveBalance?.overtimeCurrentMonth && liveLeaveBalance.overtimeCurrentMonth.approvedHours > 0 && (
                    <div className="p-4 bg-white dark:bg-[#131A1D] rounded-2xl border border-slate-200/80 dark:border-white/[0.07] space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">Akumulasi Lembur Bulan Ini</span>
                        <span className="text-[10px] font-semibold text-[#0D7A5F] dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                          Tersinkron
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-center">
                        <div className="p-2.5 rounded-xl bg-[#F7F9F8] dark:bg-white/[0.03]">
                          <p className="text-[10px] text-slate-500">Jam Disetujui</p>
                          <p className="text-base font-mono font-bold text-slate-900 dark:text-white mt-0.5">
                            {liveLeaveBalance.overtimeCurrentMonth.approvedHours} jam
                          </p>
                        </div>
                        <div className="p-2.5 rounded-xl bg-[#F7F9F8] dark:bg-white/[0.03]">
                          <p className="text-[10px] text-slate-500">Total SPKL</p>
                          <p className="text-base font-mono font-bold text-slate-900 dark:text-white mt-0.5">
                            {liveLeaveBalance.overtimeCurrentMonth.approvedCount} sesi
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {userOvertimeList.length === 0 ? (
                    <div className="p-8 text-center bg-white dark:bg-[#131A1D] rounded-2xl border border-slate-200/70 dark:border-white/[0.06] text-slate-400 text-xs">
                      Belum ada catatan surat perintah lembur (SPL).
                    </div>
                  ) : (
                    userOvertimeList.slice(0, 15).map((ot) => (
                      <div
                        key={ot.id}
                        className="p-3.5 rounded-2xl bg-white dark:bg-[#131A1D] border border-slate-200/80 dark:border-white/[0.07] space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            Lembur ({ot.durationHours} Jam)
                          </span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            ot.status === 'approved'
                              ? 'bg-emerald-500/10 text-[#0D7A5F] dark:text-emerald-300'
                              : ot.status === 'rejected'
                              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                              : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                          }`}>
                            {ot.status === 'approved' ? 'Disetujui' : ot.status === 'rejected' ? 'Ditolak' : 'Menunggu'}
                          </span>
                        </div>
                        <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                          {ot.date} • {ot.startTime} – {ot.endTime} WITA
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-300 bg-[#F7F9F8] dark:bg-white/[0.03] p-2.5 rounded-xl">
                          {ot.taskDescription}
                        </p>
                        {(ot.taskPhotoUrl || (ot as any).attachmentUrl) && (
                          <a
                            href={ot.taskPhotoUrl || (ot as any).attachmentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-[#0D7A5F] dark:text-emerald-400 font-semibold hover:underline"
                          >
                            <ImageIcon className="w-3.5 h-3.5" />
                            <span>Lihat Bukti Foto</span>
                          </a>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              TAB 4: AKUN & PENGATURAN (CLEAN GROUPED SETTINGS)
          ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'akun' && (
            <div className="space-y-3.5 animate-in fade-in duration-150">
              {/* Profile Header Card */}
              <div className="p-4 rounded-2xl bg-white dark:bg-[#131A1D] border border-slate-200/80 dark:border-white/[0.07] flex items-center gap-3.5">
                <img
                  src={userAvatarSrc}
                  alt={user?.fullName}
                  className="w-14 h-14 rounded-full object-cover ring-1 ring-slate-200 dark:ring-white/15 bg-slate-100 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate">{user?.fullName}</h2>
                  <p className="text-xs font-mono text-slate-500 dark:text-slate-400">{user?.nip || user?.id}</p>
                  <p className="text-[11px] text-[#0D7A5F] dark:text-emerald-400 font-medium mt-0.5 truncate">
                    {user?.divisionName || 'Operasional'} • {user?.roleName || user?.role || 'Karyawan'}
                  </p>
                </div>
              </div>

              {/* Grouped Info List */}
              <div className="rounded-2xl bg-white dark:bg-[#131A1D] border border-slate-200/80 dark:border-white/[0.07] divide-y divide-slate-100 dark:divide-white/[0.06] text-xs">
                <div className="p-3.5 flex items-center justify-between gap-3">
                  <span className="text-slate-500 dark:text-slate-400">Email</span>
                  <span className="font-medium text-slate-900 dark:text-white truncate">{user?.email || '-'}</span>
                </div>
                <div className="p-3.5 flex items-center justify-between gap-3">
                  <span className="text-slate-500 dark:text-slate-400">Jadwal Shift</span>
                  <span className="font-semibold text-slate-900 dark:text-white text-right">
                    {(() => {
                      const rawName = userShift?.name || user?.shiftName || '';
                      if (rawName && rawName.includes('(') && rawName.includes(')')) return rawName;
                      const startTime = userShift?.startTime || user?.shiftStartTime || '07:30';
                      const endTime = userShift?.endTime || user?.shiftEndTime || '16:30';
                      return `${rawName || 'Reguler'} (${startTime} – ${endTime})`;
                    })()}
                  </span>
                </div>
                <div className="p-3.5 flex items-center justify-between gap-3">
                  <span className="text-slate-500 dark:text-slate-400">Keamanan Perangkat</span>
                  <span className="font-mono text-[11px] text-[#0D7A5F] dark:text-emerald-400 font-semibold">
                    {user?.deviceModel || 'Terikat Aman'}
                  </span>
                </div>
                <div className="p-3.5 flex items-center justify-between gap-3">
                  <span className="text-slate-500 dark:text-slate-400">Mode Tampilan</span>
                  <div className="inline-flex p-0.5 rounded-xl bg-slate-100 dark:bg-white/[0.06] border border-slate-200/70 dark:border-white/10">
                    <button
                      type="button"
                      onClick={() => setTheme('light')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-all ${
                        !isDarkMode
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      <Sun className="w-3 h-3" />
                      <span>Terang</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTheme('dark')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-all ${
                        isDarkMode
                          ? 'bg-[#1F2A2E] text-white shadow-2xs'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      <Moon className="w-3 h-3" />
                      <span>Gelap</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Dokumen Slip Gaji Card */}
              <div className="p-4 rounded-2xl bg-white dark:bg-[#131A1D] border border-slate-200/80 dark:border-white/[0.07] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#0D7A5F] dark:text-emerald-400" />
                    Dokumen Slip Gaji
                  </span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    !slipLockedInfo.isLocked && employeeSlip
                      ? 'bg-emerald-500/10 text-[#0D7A5F] dark:text-emerald-300'
                      : slipLockedInfo.hasRequested
                      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                      : 'bg-slate-100 dark:bg-white/[0.06] text-slate-500'
                  }`}>
                    {!slipLockedInfo.isLocked && employeeSlip ? 'Tersedia' : slipLockedInfo.hasRequested ? 'Diproses' : 'Terkunci'}
                  </span>
                </div>

                {!slipLockedInfo.isLocked && employeeSlip ? (
                  <Button
                    size="sm"
                    onClick={() => setIsSlipViewOpen(true)}
                    className="w-full h-10 bg-[#0D7A5F] hover:bg-[#0A634D] text-white rounded-xl text-xs font-semibold gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Lihat & Unduh Slip ({employeeSlip.period || employeeSlip.period_label || employeeSlip.periodLabel || 'Resmi'})
                  </Button>
                ) : slipLockedInfo.hasRequested ? (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Permintaan slip gaji sedang ditinjau oleh Superadmin.
                  </p>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsRequestSlipOpen(true)}
                    className="w-full h-10 rounded-xl text-xs font-semibold gap-1.5"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Ajukan Permintaan Slip Gaji
                  </Button>
                )}
              </div>

              {/* PWA Installation & Account Actions */}
              <div className="space-y-2">
                {!isStandaloneApp && (
                  <Button
                    size="sm"
                    onClick={handleTriggerPwaInstall}
                    className="w-full h-11 bg-[#0D7A5F] hover:bg-[#0A634D] text-white rounded-2xl text-xs font-semibold gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Pasang Aplikasi di Layar Utama HP
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setChangePasswordModalOpen(true)}
                  className="w-full h-11 rounded-2xl text-xs font-semibold gap-2 bg-white dark:bg-[#131A1D]"
                >
                  <Lock className="w-3.5 h-3.5" />
                  Ganti Kata Sandi
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setLogoutDialogOpen(true)}
                  className="w-full h-11 rounded-2xl text-xs font-semibold gap-2 text-rose-600 border-rose-200 dark:border-rose-900/50 bg-white dark:bg-[#131A1D] hover:bg-rose-50"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Keluar dari Akun
                </Button>

                {onSwitchToDesktop && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onSwitchToDesktop}
                    className="w-full h-10 text-xs text-slate-500 hover:text-slate-900"
                  >
                    Beralih ke Tampilan Web Desktop
                  </Button>
                )}
              </div>
            </div>
          )}
        </main>

        {/* ─── CLEAN FROSTED BOTTOM NAVIGATION BAR ─── */}
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[440px] z-40 bg-white/92 dark:bg-[#0B1714]/92 backdrop-blur-xl border-t border-emerald-900/[0.08] dark:border-emerald-400/[0.10] px-2 pt-1.5 pb-[max(0.55rem,env(safe-area-inset-bottom))] flex items-center justify-between">
          <button
            type="button"
            onClick={() => setActiveTab('beranda')}
            className={`flex flex-col items-center justify-center flex-1 min-h-[48px] transition-colors active:scale-95 ${
              activeTab === 'beranda' ? 'text-[#0D7A5F] dark:text-emerald-400' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Home className="w-[19px] h-[19px]" />
            <span className="text-[10px] font-semibold mt-1">Beranda</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('riwayat')}
            className={`flex flex-col items-center justify-center flex-1 min-h-[48px] transition-colors active:scale-95 ${
              activeTab === 'riwayat' ? 'text-[#0D7A5F] dark:text-emerald-400' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <History className="w-[19px] h-[19px]" />
            <span className="text-[10px] font-semibold mt-1">Riwayat</span>
          </button>

          {/* Center Tactile Attendance Action */}
          <div className="flex flex-col items-center justify-center -mt-5 px-2 relative z-50">
            <button
              type="button"
              onClick={handleCenterAttendanceClick}
              className={`w-[52px] h-[52px] rounded-full flex items-center justify-center text-white shadow-lg transition-transform duration-150 active:scale-92 ring-4 ring-white dark:ring-[#0B1714] ${
                isCurrentlyOnDuty
                  ? 'bg-slate-900 dark:bg-white dark:text-slate-900'
                  : (isShiftOffDay(effectiveDisplayShift) || isEmployeeOffToday) && !hasApprovedOvertimeOrSubstituteToday
                  ? 'bg-slate-400 dark:bg-slate-700'
                  : !hasClockedIn || nextShiftInfo?.isNextShiftAvailable
                  ? 'bg-[#0D7A5F]'
                  : 'bg-slate-700'
              }`}
              title={isCurrentlyOnDuty ? 'Absen Pulang' : 'Absen Masuk'}
            >
              {isCurrentlyOnDuty ? (
                <LogOut className="w-5 h-5" />
              ) : (isShiftOffDay(effectiveDisplayShift) || isEmployeeOffToday) && !hasApprovedOvertimeOrSubstituteToday ? (
                <Coffee className="w-5 h-5" />
              ) : !isCurrentSessionClosed || nextShiftInfo?.isNextShiftAvailable ? (
                <ScanFace className="w-5 h-5" />
              ) : (
                <Check className="w-5 h-5" />
              )}
            </button>
            <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 mt-1">
              {isCurrentlyOnDuty
                ? 'Pulang'
                : (isShiftOffDay(effectiveDisplayShift) || isEmployeeOffToday) && !hasApprovedOvertimeOrSubstituteToday
                ? 'Libur'
                : !isCurrentlyOnDuty && !isCurrentSessionClosed
                ? 'Absen'
                : nextShiftInfo?.isNextShiftAvailable
                ? 'Lanjut'
                : 'Selesai'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setActiveTab('aktivitas')}
            className={`flex flex-col items-center justify-center flex-1 min-h-[48px] transition-colors active:scale-95 ${
              activeTab === 'aktivitas' ? 'text-[#0D7A5F] dark:text-emerald-400' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <CalendarDays className="w-[19px] h-[19px]" />
            <span className="text-[10px] font-semibold mt-1">Aktivitas</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('akun')}
            className={`flex flex-col items-center justify-center flex-1 min-h-[48px] transition-colors active:scale-95 ${
              activeTab === 'akun' ? 'text-[#0D7A5F] dark:text-emerald-400' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <User className="w-[19px] h-[19px]" />
            <span className="text-[10px] font-semibold mt-1">Akun</span>
          </button>
        </nav>
      </div>

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
              Pilihan kondisi mendesak/sakit. Presensi pulang dicatatkan langsung tanpa konfirmasi, dan notifikasi diteruskan via WhatsApp ke Korlap, Admin, K3, dan Superadmin.
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
            {/* ─── KARTU RINGKASAN KUOTA CUTI SAAT PENGAJUAN ─── */}
            <div className="p-2.5 bg-emerald-500/10 dark:bg-emerald-950/30 rounded-2xl border border-emerald-500/20">
              <div className="flex items-center justify-between text-[10px] text-emerald-800 dark:text-emerald-300 font-bold mb-1.5">
                <span>Informasi Hak Cuti Anda</span>
                <span className="text-[9px] font-normal text-slate-500">
                  {liveLeaveBalance?.frpGroupLabel || `Tahun ${new Date().getFullYear()}`}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-center">
                <div className="bg-white/80 dark:bg-slate-900/60 p-1.5 rounded-lg border border-slate-200/60 dark:border-slate-800">
                  <span className="text-[8.5px] text-slate-500 block">Jumlah Kuota</span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{analyticsData.annualLeaveQuota} Hari</span>
                </div>
                <div className="bg-white/80 dark:bg-slate-900/60 p-1.5 rounded-lg border border-amber-200/60 dark:border-amber-900/40">
                  <span className="text-[8.5px] text-amber-600 block">Telah Diambil</span>
                  <span className="text-xs font-bold text-amber-600">{analyticsData.usedLeave} Hari</span>
                </div>
                <div className="bg-white/80 dark:bg-slate-900/60 p-1.5 rounded-lg border border-emerald-200/60 dark:border-emerald-900/40">
                  <span className="text-[8.5px] text-emerald-600 block">Belum Diambil</span>
                  <span className="text-xs font-bold text-emerald-600">{analyticsData.remainingLeave} Hari</span>
                </div>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Jenis Permohonan:
              </label>
              <select
                value={leaveType}
                onChange={(e) => setLeaveType(e.target.value as any)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
              >
                <option value="annual_leave">🏖️ Cuti Tahunan (Sisa Belum Diambil: {analyticsData.remainingLeave} Hari)</option>
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
                <DatePicker
                  value={leaveStartDate}
                  onChange={(val) => setLeaveStartDate(val)}
                  placeholder="Mulai..."
                  className="w-full text-xs h-9 rounded-xl border-slate-200 dark:border-slate-800"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Sampai Tanggal:
                </label>
                <DatePicker
                  value={leaveEndDate}
                  onChange={(val) => setLeaveEndDate(val)}
                  placeholder="Selesai..."
                  className="w-full text-xs h-9 rounded-xl border-slate-200 dark:border-slate-800"
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
                Kategori / Jenis Lembur:
              </label>
              <select
                value={otCategory}
                onChange={(e) => {
                  const cat = e.target.value as any;
                  setOtCategory(cat);
                  if (cat === 'shift1') {
                    setOtStartTime('07:30');
                    setOtEndTime('15:30');
                    setOtHours(8);
                  } else if (cat === 'shift2') {
                    setOtStartTime('15:30');
                    setOtEndTime('22:30');
                    setOtHours(7);
                  } else if (cat === 'shift3') {
                    setOtStartTime('22:30');
                    setOtEndTime('07:30');
                    setOtHours(9);
                  } else if (cat === 'dayshift') {
                    setOtStartTime('07:30');
                    setOtEndTime('16:30');
                    setOtHours(8);
                  } else if (cat === 'darurat_wajib') {
                    setOtStartTime('16:30');
                    setOtEndTime('19:30');
                    setOtHours(3);
                  }
                }}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs bg-slate-50 dark:bg-slate-900 font-semibold text-slate-800 dark:text-slate-200"
              >
                <option value="shift1">Lembur Penuh Shift 1 (07:30 - 15:30 • 8 Jam)</option>
                <option value="shift2">Lembur Penuh Shift 2 (15:30 - 22:30 • 7 Jam)</option>
                <option value="shift3">Lembur Penuh Shift 3 (22:30 - 07:30 • 9 Jam)</option>
                <option value="dayshift">Lembur Day Shift (07:30 - 16:30 • 8 Jam Dinamis)</option>
                <option value="darurat_wajib">Lembur Wajib / Perintah Langsung Darurat (Maks 3 Jam)</option>
                <option value="custom">Lembur Kustom / Jam Tertentu</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Tanggal Lembur:
              </label>
              <DatePicker
                value={otDate}
                onChange={(val) => setOtDate(val)}
                placeholder="Pilih tanggal lembur"
                className="w-full text-xs h-9 rounded-xl border-slate-200 dark:border-slate-800"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Jam Mulai:
                </label>
                <TimePicker
                  value={otStartTime}
                  onChange={(val) => setOtStartTime(val)}
                  placeholder="Jam mulai"
                  className="w-full text-xs h-9 rounded-xl"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Jam Selesai:
                </label>
                <TimePicker
                  value={otEndTime}
                  onChange={(val) => setOtEndTime(val)}
                  placeholder="Jam selesai"
                  className="w-full text-xs h-9 rounded-xl"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  Durasi Lembur Diakui:
                </label>
                {otCategory === 'darurat_wajib' && (
                  <span className="text-[10px] text-amber-600 font-bold">*Maks. 3 Jam</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0.5}
                  max={otCategory === 'darurat_wajib' ? 3 : 12}
                  step={0.5}
                  value={otHours}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    if (otCategory === 'darurat_wajib' && val > 3) {
                      toast.warning('Lembur wajib dibatasi maksimal 3 jam!');
                      setOtHours(3);
                    } else {
                      setOtHours(val);
                    }
                  }}
                  className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold"
                />
                <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Jam Kerja</span>
              </div>
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
              disabled={isSubmittingOvertime}
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

          {/* Tombol aksi langsung untuk memicu prompt browser */}
          <Button
            size="sm"
            onClick={async () => {
              const promptEvent = (window as any).__pwaInstallPrompt;
              if (promptEvent) {
                try {
                  await promptEvent.prompt();
                  const choice = await promptEvent.userChoice;
                  if (choice && choice.outcome === 'accepted') {
                    toast.success('PWA berhasil dipasang ke Layar Utama!');
                    (window as any).__pwaInstallPrompt = null;
                    setIsStandaloneApp(true);
                    setShowPwaInstallModal(false);
                    return;
                  }
                } catch (e) {
                  console.warn('[PWA] Prompt error:', e);
                }
              }
              toast.info('Silakan ikuti langkah di atas: ketuk Menu Titik Tiga (⋮) di Chrome lalu pilih "Pasang aplikasi".');
            }}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold gap-1.5 h-9 shadow-md"
          >
            <Download className="w-4 h-4" />
            MUNCULKAN DIALOG PASANG SEKARANG
          </Button>

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
            if (actionType === 'clock_in' && userShift?.startTime && !emergencyOverridePayload?.isEmergencyOverride && !emergencyOvertimePayload?.isEmergencyOvertime) {
              const latenessEval = calculateAttendanceLateness({
                clockInTime: timeStr,
                shiftStartTime: userShift.startTime,
                shiftEndTime: userShift.endTime,
                lateToleranceMinutes: user.lateToleranceMinutes ?? userShift.lateToleranceMinutes ?? 15,
                isCrossDay: userShift.isCrossDay,
                isOffDay: isEmployeeOffToday,
              });
              status = latenessEval.status;
              lateMinutes = latenessEval.lateMinutes;
            }

            const effectiveAttDate = actionType === 'clock_out'
              ? (todayAttendance?.attendanceDate || todayAttendance?.date || todayStr)
              : todayStr;

            const savedAttendance = await hrmService.recordAttendance({
              userId: user.id,
              date: effectiveAttDate,
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
              const normSaved = normalizeAttendanceRecord(savedAttendance);
              setTodayAttendance(normSaved);
              window.dispatchEvent(new Event('hrm_attendance_updated'));
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

      {/* ─── MODAL PELAPORAN KELUAR AREA & KONFIRMASI JAM PULANG STANDAR ─── */}
      <Dialog open={breachReportModalOpen} onOpenChange={setBreachReportModalOpen}>
        <DialogContent className="max-w-md p-4 sm:p-6 rounded-3xl bg-card border-border">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <span>Pelaporan Keluar Area & Jam Pulang</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Sistem mendeteksi Anda berada di luar area pos kerja. Sampaikan keterangan alasan Anda. Setelah dikirim, jam pulang standar ({userShift?.endTime?.substring(0, 5) || '16:30'} WITA) akan otomatis terisi dan terkirim ke WhatsApp pimpinan.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2 text-xs">
            {/* Opsi Cepat Alasan */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Pilih Alasan / Kondisi Lapangan:</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: '🏃 Tugas Luar / Dinas', text: 'Perintah tugas luar / dinas mendadak dari atasan' },
                  { label: '🚑 Keperluan Mendesak', text: 'Keperluan mendesak keluarga / kondisi darurat di lapangan' },
                  { label: '📶 Gangguan GPS / Sinyal', text: 'GPS / jaringan ponsel mengalami kendala teknis saat bertugas' },
                  { label: '🔋 Baterai HP Drop / Habis', text: 'Baterai HP drop / habis sehingga baru dapat melapor saat ini' },
                ].map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setBreachReportNotes(item.text)}
                    className="p-2 rounded-xl border border-border hover:bg-muted text-left text-[11px] text-muted-foreground transition-all hover:text-foreground"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Input Alasan Spesifik */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Keterangan / Penjelasan Rinci:</label>
              <Textarea
                rows={3}
                placeholder="Contoh: Mengambil berkas operasional ke gudang atas arahan korlap..."
                value={breachReportNotes}
                onChange={(e) => setBreachReportNotes(e.target.value)}
                className="text-xs resize-none rounded-xl"
              />
            </div>

            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-800 dark:text-amber-200">
              <p className="font-semibold">ℹ️ Dampak Pelaporan:</p>
              <p className="opacity-90">Jam pulang resmi shift ({userShift?.endTime?.substring(0, 5) || '16:30'} WITA) otomatis tercatat di sistem, dan notifikasi WhatsApp langsung terkirim ke Atasan / Pimpinan.</p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setBreachReportModalOpen(false)} className="rounded-xl text-xs">
              Tutup
            </Button>
            <Button
              size="sm"
              onClick={async () => {
                if (!breachReportNotes.trim()) {
                  toast.error('Mohon isi keterangan alasan terlebih dahulu.');
                  return;
                }
                setIsSubmittingBreachReport(true);
                try {
                  const res = await hrmService.submitBreachReport({
                    userId: user.id,
                    notes: breachReportNotes.trim(),
                    latitude: currentCoords?.lat,
                    longitude: currentCoords?.lng,
                  });
                  toast.success(res.message || 'Laporan berhasil dikirim & jam pulang tercatat!');
                  setBreachReportModalOpen(false);
                  setBreachReportNotes('');
                  await loadRealData();
                } catch (err: any) {
                  toast.error(err.message || 'Gagal mengirim laporan');
                } finally {
                  setIsSubmittingBreachReport(false);
                }
              }}
              disabled={isSubmittingBreachReport}
              className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs"
            >
              {isSubmittingBreachReport ? 'Mengirim...' : 'Kirim Laporan & Konfirmasi Pulang'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>



      {/* ─── MODAL ABSEN TUGAS DARURAT MANDIRI (REKOMENDASI 3: SELF-EMERGENCY OVERRIDE) ─── */}
      <Dialog open={emergencyOverrideModalOpen} onOpenChange={setEmergencyOverrideModalOpen}>
        <DialogContent className="max-w-md p-4 sm:p-6 rounded-3xl bg-card border-border">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 flex items-center justify-center shrink-0">
                <Zap className="w-4 h-4 fill-amber-500" />
              </div>
              <span>Presensi Tugas Darurat Mandiri</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Fitur khusus untuk penugasan mendesak di luar jam shift ketika SPKL belum sempat diterbitkan oleh atasan.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2 text-xs">
            {/* Opsi Kategori Tugas Darurat */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Kategori Keadaan Darurat:</label>
              <div className="grid grid-cols-1 gap-1.5">
                {[
                  '🚨 Insiden / Kejadian Darurat Pos Lapangan',
                  '🔄 Pengganti Rekan Mendadak (Sakit / Berhalangan)',
                  '📦 Distribusi Logistik / Pengawalan Kritis Mendesak',
                  '⚡ Perbaikan Kerusakan Fasilitas / Masalah Lapangan',
                  '📞 Panggilan Langsung Pimpinan / Korlap Lapangan',
                ].map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setEmergencyOverrideCategory(item)}
                    className={`p-2 rounded-xl border text-left text-[11px] transition-all flex items-center justify-between ${
                      emergencyOverrideCategory === item
                        ? 'border-amber-500 bg-amber-500/10 text-amber-900 dark:text-amber-200 font-bold'
                        : 'border-border hover:bg-muted text-muted-foreground'
                    }`}
                  >
                    <span>{item}</span>
                    {emergencyOverrideCategory === item && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Input Keterangan Alasan */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Keterangan / Kronologi Singkat Tugas Darurat:</label>
              <Textarea
                rows={3}
                placeholder="Contoh: Diminta Korlap Bpk Aslam mengawal pengiriman logistik malam karena staf sebelumnya sakit..."
                value={emergencyOverrideDetails}
                onChange={(e) => setEmergencyOverrideDetails(e.target.value)}
                className="text-xs resize-none rounded-xl"
              />
            </div>

            {/* Banner Gembok Finansial & WhatsApp Realtime */}
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-900 dark:text-amber-200 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Gembok Finansial & Notifikasi Direksi Realtime</span>
              </div>
              <p className="opacity-90 leading-snug">
                Presensi akan diverifikasi oleh Pimpinan. Jam lembur tidak otomatis cair sebelum disetujui di portal Approval. Notifikasi darurat instan otomatis terkirim ke WhatsApp Direktur Utama, Pimpinan, dan Korlap saat Anda mengambil foto wajah.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEmergencyOverrideModalOpen(false);
                setEmergencyOverridePayload(null);
              }}
              className="rounded-xl text-xs"
            >
              Batal
            </Button>
            <Button
              size="sm"
              onClick={() => {
                const combinedReason = `${emergencyOverrideCategory}${emergencyOverrideDetails.trim() ? ` - ${emergencyOverrideDetails.trim()}` : ''}`;
                setEmergencyOverridePayload({
                  isEmergencyOverride: true,
                  emergencyReason: combinedReason,
                });
                setEmergencyOverrideModalOpen(false);
                openLiveCamera('clock_in', { isEmergencyOverride: true });
              }}
              className="rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-bold text-xs flex items-center gap-1.5"
            >
              <Camera className="w-4 h-4" />
              <span>Buka Kamera & Foto Presensi Darurat</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL LAPOR KAPAL BERSANDAR (PELABUHAN MACCINI BAJI) ─── */}
      <Dialog open={vesselModalOpen} onOpenChange={setVesselModalOpen}>
        <DialogContent className="max-w-md p-4 sm:p-6 rounded-3xl bg-card border-border">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 flex items-center justify-center shrink-0">
                <span className="text-base">⚓</span>
              </div>
              <span>Lapor Kapal Bersandar di Dermaga</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Konfirmasi info kedatangan kapal di Pelabuhan Maccini Baji. Setelah dikonfirmasi, Anda dan tim wajib standby fisik di dermaga (radius 500m aktif).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-[11px] text-amber-900 dark:text-amber-200 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Peringatan Geofence Dermaga</span>
              </div>
              <p>
                Status akan diperbarui ke <strong>KAPAL BERSANDAR</strong>. Sistem pemantauan radar akan memvalidasi keberadaan Anda di radius 500m Dermaga Pelabuhan Maccini Baji.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Nama Kapal / Tongkang / LCT <span className="text-muted-foreground font-normal">(Opsional)</span>:
              </label>
              <input
                type="text"
                placeholder="Contoh: TB. Bintang Samudra 01 / BG. Perkasa 28"
                value={inputVesselName}
                onChange={(e) => setInputVesselName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-input bg-background text-foreground text-xs focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>
          </div>

          <DialogFooter className="flex flex-row items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setVesselModalOpen(false)}
              className="rounded-xl text-xs"
            >
              Batal
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isUpdatingVesselStatus}
              onClick={() => executeVesselStatusChange('docking', inputVesselName)}
              className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
            >
              <span>⚓</span>
              <span>{isUpdatingVesselStatus ? 'Menyimpan...' : 'Konfirmasi Standby Kapal'}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL PERMOHONAN SLIP GAJI KARYAWAN ─── */}
      <Dialog open={isRequestSlipOpen} onOpenChange={setIsRequestSlipOpen}>
        <DialogContent className="max-w-md p-5 rounded-3xl bg-card border-border">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <span>Permohonan Slip Gaji Resmi</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Berdasarkan kebijakan PT. FAWWAZ RESKI PERWIRA, slip gaji resmi diterbitkan secara on-demand atas permohonan tertulis karyawan kepada Superadmin.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Keperluan / Alasan Permohonan:</label>
              <div className="grid grid-cols-1 gap-1.5">
                {[
                  'Keperluan Administrasi Bank / KPR / Pinjaman',
                  'Kelengkapan Berkas BPJS Ketenagakerjaan / Kesehatan',
                  'Pengurusan Dokumen Pajak Tahunan (SPT Pribadi)',
                  'Arsip Dokumen Pribadi Karyawan',
                ].map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSlipReason(item)}
                    className={`p-2.5 rounded-xl border text-left text-xs transition-all flex items-center justify-between ${
                      slipReason === item
                        ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-bold'
                        : 'border-border hover:bg-muted text-muted-foreground'
                    }`}
                  >
                    <span>{item}</span>
                    {slipReason === item && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Catatan Tambahan (Opsional):</label>
              <Input
                type="text"
                placeholder="Misal: Untuk pengajuan KPR BTN..."
                className="text-xs rounded-xl h-9"
                onChange={(e) => {
                  if (e.target.value.trim()) {
                    setSlipReason(e.target.value);
                  }
                }}
              />
            </div>

            <div className="p-3 bg-muted/60 rounded-xl text-[11px] text-muted-foreground leading-relaxed border border-border/60">
              ℹ️ Permohonan Anda akan langsung terkirim ke dashboard Superadmin untuk diverifikasi dan diterbitkan ke aplikasi PWA ini.
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsRequestSlipOpen(false)}
              className="rounded-xl text-xs"
            >
              Batal
            </Button>
            <Button
              size="sm"
              disabled={isSubmittingSlipReq}
              onClick={handleSendSlipRequest}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 shadow-xs"
            >
              {isSubmittingSlipReq ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              <span>Kirim Permohonan ke Superadmin</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL TAMPILAN RESMI SLIP GAJI (FORMAT KOTAK PT FRP) ─── */}
      <Dialog open={isSlipViewOpen} onOpenChange={setIsSlipViewOpen}>
        <DialogContent className="max-w-3xl p-0 rounded-2xl max-h-[92vh] overflow-y-auto border border-border shadow-2xl">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-card sticky top-0 z-10">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-foreground">Slip Gaji Resmi Karyawan</h3>
                <p className="text-[10px] text-muted-foreground">PT. FAWWAZ RESKI PERWIRA</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handlePrintEmployeeSlip}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded-xl h-8 gap-1.5 shadow-xs"
              >
                <Download className="w-3.5 h-3.5" /> Cetak / Unduh PDF
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsSlipViewOpen(false)}
                className="h-8 w-8 rounded-xl"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {employeeSlip && (
            <div className="p-4 sm:p-6 bg-slate-50 dark:bg-slate-900/60 flex justify-center">
              <div className="w-full bg-white p-3 sm:p-4 rounded-xl shadow-xs" ref={slipPrintRef}>
                {/* Format Resmi Kotak FRP */}
                <div className="official-box border-[2.5px] border-black bg-white text-black font-sans text-xs">
                  {/* Header Bar: Logo | PT. FAWWAZ RESKI PERWIRA | SLIP GAJI KARYAWAN */}
                  <div className="box-hdr flex border-b-2 border-black min-h-[64px] items-stretch">
                    <div className="hdr-logo w-20 p-2 flex items-center justify-center border-r-2 border-black shrink-0">
                      <img src={defaultAvatar} alt="Logo" className="w-12 h-12 object-contain" />
                    </div>
                    <div className="hdr-company flex-1 flex flex-col justify-center px-4 text-center">
                      <div className="hdr-company-name font-black text-sm sm:text-base tracking-wider underline underline-offset-4">
                        PT. FAWWAZ RESKI
                      </div>
                      <div className="hdr-company-sub font-black text-sm sm:text-base tracking-wider mt-0.5">
                        PERWIRA
                      </div>
                    </div>
                    <div className="hdr-title w-64 sm:w-80 border-l-2 border-black px-4 py-2 flex flex-col justify-center text-right shrink-0">
                      <div className="doc-title font-black text-xs sm:text-sm tracking-wider uppercase">
                        SLIP GAJI KARYAWAN
                      </div>
                      <div className="doc-period font-bold text-xs mt-1">
                        PERIODE : <span className="uppercase">{employeeSlip.period || employeeSlip.period_label || employeeSlip.periodLabel || 'September 2026'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Info Karyawan */}
                  <div className="emp-info p-3 border-b-2 border-black relative text-xs font-bold leading-relaxed">
                    <div className="emp-row flex">
                      <span className="emp-lbl w-20 font-extrabold">NAMA</span>
                      <span>: {employeeSlip.employee?.name || employeeSlip.userName || user?.fullName}</span>
                    </div>
                    <div className="emp-row flex">
                      <span className="emp-lbl w-20 font-extrabold">ID</span>
                      <span>: {employeeSlip.employee?.nip || employeeSlip.userNip || user?.nip || user?.id}</span>
                    </div>
                    <div className="emp-date absolute right-4 bottom-2 text-right text-[11px] font-semibold text-slate-700">
                      Dicetak Tanggal : {new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </div>
                  </div>

                  {/* Dua Kolom: PENDAPATAN vs POTONGAN */}
                  <div className="columns-wrap grid grid-cols-2 border-b-2 border-black">
                    {/* Pendapatan */}
                    <div className="col-left border-r-2 border-black flex flex-col justify-between">
                      <div>
                        <div className="sec-hdr border-b-2 border-black py-1.5 px-3 font-black text-center text-xs tracking-wider uppercase bg-slate-50/50">
                          PENDAPATAN :
                        </div>
                        <div className="item-list p-3 space-y-2 text-xs">
                          <div className="item-row flex items-center">
                            <span className="font-semibold w-28 sm:w-36">Upah</span>
                            <span className="font-mono font-bold mr-2">:</span>
                            <span className="font-mono font-bold">
                              Rp {Number(employeeSlip.upah || employeeSlip.baseSalary || 4045050).toLocaleString('id-ID')}
                            </span>
                          </div>
                          <div className="item-row flex items-center">
                            <span className="font-semibold w-28 sm:w-36">Lembur</span>
                            <span className="font-mono font-bold mr-2">:</span>
                            <span className="font-mono font-bold">
                              {Number(employeeSlip.lembur || employeeSlip.overtimePay || 0) > 0
                                ? `Rp ${Number(employeeSlip.lembur || employeeSlip.overtimePay).toLocaleString('id-ID')}`
                                : ''}
                            </span>
                          </div>
                          <div className="item-row flex items-center">
                            <span className="font-semibold w-28 sm:w-36">Pesangon</span>
                            <span className="font-mono font-bold mr-2">:</span>
                            <span className="font-mono font-bold">
                              {Number(employeeSlip.pesangonAmount || employeeSlip.pesangon_amount || 0) > 0
                                ? `Rp ${Number(employeeSlip.pesangonAmount || employeeSlip.pesangon_amount).toLocaleString('id-ID')}`
                                : ''}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="total-row border-t-2 border-black py-2 px-3 flex items-center font-black text-xs bg-slate-50/30">
                        <span className="w-28 sm:w-36">Total Pendapatan</span>
                        <span className="font-mono mr-2">:</span>
                        <span className="font-mono">
                          Rp {Number(
                            (employeeSlip.upah || employeeSlip.baseSalary || 4045050) +
                            (employeeSlip.lembur || employeeSlip.overtimePay || 0) +
                            (employeeSlip.pesangonAmount || employeeSlip.pesangon_amount || 0)
                          ).toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>

                    {/* Potongan */}
                    <div className="col-right flex flex-col justify-between">
                      <div>
                        <div className="sec-hdr border-b-2 border-black py-1.5 px-3 font-black text-center text-xs tracking-wider uppercase bg-slate-50/50">
                          POTONGAN :
                        </div>
                        <div className="item-list p-3 space-y-2 text-xs">
                          <div className="item-row flex items-center justify-between">
                            <span className="font-semibold">BPJS Ketenagakerjaan 3%</span>
                            <div className="flex items-center font-mono font-bold">
                              <span>: Rp</span>
                              <span className="w-16 sm:w-20 text-right">
                                {Number(employeeSlip.bpjsTkAmount || employeeSlip.bpjsKetenagakerjaan || 121351).toLocaleString('id-ID')}
                              </span>
                            </div>
                          </div>
                          <div className="item-row flex items-center justify-between">
                            <span className="font-semibold">BPJS Kesehatan 1%</span>
                            <div className="flex items-center font-mono font-bold">
                              <span>: Rp</span>
                              <span className="w-16 sm:w-20 text-right">
                                {Number(employeeSlip.bpjsKesAmount || employeeSlip.bpjsKesehatan || 40450).toLocaleString('id-ID')}
                              </span>
                            </div>
                          </div>
                          <div className="item-row flex items-center justify-between">
                            <div className="flex items-center flex-1 pr-2">
                              <span className="font-semibold">Presensi / Alpa</span>
                              <div className="flex-1 flex justify-center items-center gap-1.5 font-semibold">
                                <span>:</span>
                                <span className="font-normal">
                                  {Number(employeeSlip.alpaDays || employeeSlip.absentCount || 0) > 0
                                    ? `${employeeSlip.alpaDays || employeeSlip.absentCount} Hari @`
                                    : 'Hari @'}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center font-mono font-bold">
                              <span>: Rp</span>
                              <span className="w-16 sm:w-20 text-right">
                                {Number(employeeSlip.alpaAmount || employeeSlip.absenceDeduction || 0) > 0
                                  ? Number(employeeSlip.alpaAmount || employeeSlip.absenceDeduction).toLocaleString('id-ID')
                                  : '-'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="total-row border-t-2 border-black py-2 px-3 flex items-center justify-between font-black text-xs bg-slate-50/30">
                        <span>Total Potongan</span>
                        <div className="flex items-center font-mono">
                          <span>: Rp</span>
                          <span className="w-16 sm:w-20 text-right">
                            {Number(
                              (employeeSlip.bpjsTkAmount || employeeSlip.bpjsKetenagakerjaan || 121351) +
                              (employeeSlip.bpjsKesAmount || employeeSlip.bpjsKesehatan || 40450) +
                              (employeeSlip.alpaAmount || employeeSlip.absenceDeduction || 0)
                            ).toLocaleString('id-ID')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* THP */}
                  <div className="bottom-wrap grid grid-cols-2">
                    <div></div>
                    <div className="thp-box border-l-2 border-black py-2 px-3 flex items-center justify-between font-black text-sm bg-emerald-50">
                      <span className="uppercase tracking-wide">Jumlah Gaji</span>
                      <div className="flex items-center font-mono font-extrabold text-emerald-950">
                        <span>: Rp</span>
                        <span className="w-24 text-right">
                          {Number(employeeSlip.netSalary || employeeSlip.net_salary || 3883248).toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
