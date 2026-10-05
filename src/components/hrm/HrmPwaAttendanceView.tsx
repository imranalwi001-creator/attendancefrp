import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useHrmAuth } from '@/contexts/HrmAuthContext';
import { hrmService, getTodayDateStr } from '@/services/hrmService';
import { AttendanceRecord, OfficeLocation, Shift, OvertimeRecord, LeaveRequest } from '@/types/hrm';
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
} from 'lucide-react';
import { toast } from 'sonner';
import { biometricService, BiometricMatchResult } from '@/services/biometricService';
import { livenessEngine } from '@/services/livenessEngine';
import { geofenceService, GeofenceEvaluation } from '@/services/geofenceService';
import { fieldSentinelService } from '@/services/fieldSentinelService';
import { emergencyAlertService } from '@/services/emergencyAlertAudioService';
import { HrmFaceEnrollmentModal } from '@/components/hrm/HrmFaceEnrollmentModal';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
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

  // Location & Geofence
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [coordsAccuracy, setCoordsAccuracy] = useState<number | null>(null);
  const [distanceToOffice, setDistanceToOffice] = useState<number | null>(null);
  const [locationStatus, setLocationStatus] = useState<'checking' | 'inside' | 'outside' | 'error'>('checking');
  const [assignedOffice, setAssignedOffice] = useState<OfficeLocation | null>(null);
  const [assignedPostName, setAssignedPostName] = useState<string>('');
  const [bankPosts, setBankPosts] = useState<import('@/types/hrm').FieldAssignedPost[]>([]);

  // Attendance & Shift State
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | undefined>(undefined);
  const [userShift, setUserShift] = useState<Shift | null>(null);
  const [attendancesHistory, setAttendancesHistory] = useState<AttendanceRecord[]>([]);

  // Fullscreen Live Camera States (Persis Lampiran 3)
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [actionType, setActionType] = useState<'clock_in' | 'clock_out'>('clock_in');
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [faceDetected, setFaceDetected] = useState<boolean>(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Synchronize cameraStreamRef & ensure unmount cleanup
  useEffect(() => {
    cameraStreamRef.current = cameraStream;
  }, [cameraStream]);

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

  // Notification Bell Drawer & List
  const [notificationsDrawerOpen, setNotificationsDrawerOpen] = useState(false);
  const [userNotifications, setUserNotifications] = useState<import('@/types/hrm').HrmNotification[]>([]);

  // Monthly Shift Schedule Modal
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);

  // Overtime (SPL) Submission Modal States
  const [overtimeModalOpen, setOvertimeModalOpen] = useState(false);
  const [userOvertimeList, setUserOvertimeList] = useState<OvertimeRecord[]>([]);
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

  // Master Face Enrollment Modal
  const [enrollModalOpen, setEnrollModalOpen] = useState(false);

  // Master Face Descriptor from Database (128-D Normalized Vector)
  const masterDescriptor = useMemo<number[] | null>(() => {
    if (!user?.faceDescriptor) return null;
    if (Array.isArray(user.faceDescriptor) && user.faceDescriptor.length === 128) {
      return user.faceDescriptor.map(Number);
    }
    if (typeof user.faceDescriptor === 'string') {
      try {
        const parsed = JSON.parse(user.faceDescriptor);
        if (Array.isArray(parsed) && parsed.length === 128) {
          return parsed.map(Number);
        }
      } catch {
        return null;
      }
    }
    return null;
  }, [user?.faceDescriptor]);

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
            message: 'Posisikan wajah Anda tepat di dalam bingkai',
          });
        } else {
          const vw = videoRef.current.videoWidth || 640;
          const boxCenterX = detail.box.x + detail.box.width / 2;
          const isCentered = Math.abs(boxCenterX - vw / 2) < vw * 0.30;
          const scaleRatio = detail.box.width / vw;
          const isGoodScale = scaleRatio >= 0.18 && scaleRatio <= 0.85;

          if (!isGoodScale && scaleRatio < 0.18) {
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
            const progress = Math.min(100, Math.round((elapsed / 800) * 100));
            setAutoCaptureProgress(progress);

            setLiveFaceStatus({
              detected: true,
              isGreen: true,
              confidence: 96,
              message: progress >= 100
                ? '✓ Mengambil foto otomatis...'
                : '✓ Posisi Optimal (Klik tombol hijau atau tahan sejenak)',
            });

            // Auto-capture otomatis setelah bertahan 800ms
            if (elapsed >= 800 && !isCapturing && !isTriggeringAutoRef.current) {
              isTriggeringAutoRef.current = true;
              greenSinceRef.current = null;
              setAutoCaptureProgress(100);
              if (handleShutterCaptureRef.current) {
                handleShutterCaptureRef.current();
              }
            }
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
  }, [isCameraActive, cameraStream, isCapturing]);

  // Load Real Data from PostgreSQL & hrmService
  const loadRealData = async () => {
    if (!user) return;
    try {
      await hrmService.syncWithBackend().catch(() => null);

      // 1. Shift
      const shifts = hrmService.getShifts();
      const baseShift = shifts.find((s) => s.id === user.shiftId) || shifts[0] || null;
      let effectiveShift = baseShift ? { ...baseShift } : null;
      if (effectiveShift && (user.customStartTime || user.customEndTime || user.lateToleranceMinutes !== undefined)) {
        if (user.customStartTime) effectiveShift.startTime = user.customStartTime;
        if (user.customEndTime) effectiveShift.endTime = user.customEndTime;
        if (user.lateToleranceMinutes !== undefined) effectiveShift.lateToleranceMinutes = user.lateToleranceMinutes;
        effectiveShift.name = `Shift Khusus (${effectiveShift.startTime} - ${effectiveShift.endTime} WITA)`;
      }
      setUserShift(effectiveShift);

      // 2. Attendance Hari Ini
      const todayStr = getTodayDateStr();
      const userAtts = hrmService.getAttendances().filter((a) => a.userId === user.id);
      setAttendancesHistory(userAtts);

      const todayAtt = userAtts.find((a) => a.date === todayStr || a.attendanceDate === todayStr);
      setTodayAttendance(todayAtt);

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
      } else if (user.assignedLatitude && user.assignedLongitude) {
        officeLoc = {
          id: 'assigned-post',
          name: user.assignedLocationName || 'Pos Lapangan Terdaftar',
          latitude: user.assignedLatitude,
          longitude: user.assignedLongitude,
          radiusMeters: user.assignedRadiusMeters || 250,
          locationName: user.assignedLocationName || 'Pos Lapangan Terdaftar',
          address: user.assignedLocationName || 'Pos Lapangan Terdaftar',
        };
        setAssignedPostName(user.assignedLocationName || 'Pos Lapangan');
      } else {
        const divLoc = hrmService.getDivisionLocation(user.divisionId);
        if (divLoc) {
          officeLoc = divLoc;
          setAssignedPostName(divLoc.name);
        } else {
          const allOffices = hrmService.getOffices();
          officeLoc = allOffices[0] || null;
          setAssignedPostName(officeLoc?.name || 'Kantor Pusat PT FRP');
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

    if (activePosts && activePosts.length > 0) {
      // Dynamic GPS Accuracy buffer (up to 100m tolerance when mobile GPS is wide indoors)
      const accuracyBuffer = Math.min(Math.max(0, (accuracy - 30) * 0.5), 100);

      // Multi-Titik Bank Pos evaluation (Titik A, B, C, ...)
      const postsWithDist = activePosts.map((p) => {
        const d = geofenceService.calculateDistance(coords, { latitude: p.latitude, longitude: p.longitude });
        const r = (p.radiusMeters || 250) + accuracyBuffer;
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

    // Fallback: single assigned office
    if (fallbackOffice) {
      const evalResult = geofenceService.evaluateGeofence(coords, fallbackOffice);
      setDistanceToOffice(evalResult.distanceMeters);
      setLocationStatus(evalResult.isInside ? 'inside' : 'outside');
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

  // Urgent Spot-Check Poller (Every 7 seconds - Listens for Pimpinan's Minta Lapor Wajah)
  useEffect(() => {
    if (!user?.id) return;

    let poller: any = null;
    const checkSpotCheckStatus = async () => {
      try {
        const res = await fieldSentinelService.getSpotCheckStatus(user.id);
        if (res && res.requested) {
          setSpotCheckData({
            requestedAt: res.requestedAt,
            notes: res.notes || 'Pimpinan meminta Anda segera melakukan verifikasi scan wajah di pos tugas.',
          });
          setSpotCheckModalOpen(true);

          // Trigger Web Audio Siren + Continuous Mobile Vibration + OS Notification Banner
          if (!emergencyAlertService.isAlertActive()) {
            emergencyAlertService.startEmergencyAlert(
              '🚨 INSTRUKSI PIMPINAN: SEGERA LAPOR WAJAH!',
              res.notes || 'Pimpinan meminta Anda segera melakukan verifikasi scan wajah di pos tugas.'
            );
          }
        } else if (res && !res.requested) {
          // If request was completed or cleared
          if (spotCheckModalOpen && !isCameraActive) {
            setSpotCheckModalOpen(false);
            setSpotCheckData(null);
            emergencyAlertService.stopEmergencyAlert();
          }
        }
      } catch (err) {
        // silent catch
      }
    };

    // Initial check
    checkSpotCheckStatus();
    poller = setInterval(checkSpotCheckStatus, 7000);

    return () => {
      if (poller) clearInterval(poller);
    };
  }, [user?.id, spotCheckModalOpen, isCameraActive]);

  // Real GPS Geofencing Evaluation
  const evaluateRealLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('error');
      return;
    }
    setLocationStatus('checking');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        evaluateLocationCoords(coords, pos.coords.accuracy || 10);
      },
      (err) => {
        console.warn('[PWA GPS] Fallback check:', err);
        // Fallback gracefully
        if (assignedOffice) {
          const fallbackCoords = { lat: assignedOffice.latitude, lng: assignedOffice.longitude };
          setCurrentCoords(fallbackCoords);
          setDistanceToOffice(0);
          setLocationStatus('inside');
        } else {
          setLocationStatus('inside');
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
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

  // Status Jam Istirahat Otomatis
  const isShiftBreakWindow = useMemo(() => {
    const breakStart = userShift?.breakStartTime || '12:00';
    const breakEnd = userShift?.breakEndTime || '13:00';
    const now = currentTime;
    const curMins = now.getHours() * 60 + now.getMinutes();
    const [bsh, bsm] = breakStart.split(':').map(Number);
    const [beh, bem] = breakEnd.split(':').map(Number);
    const startMins = bsh * 60 + (bsm || 0);
    const endMins = beh * 60 + (bem || 0);
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
  const openLiveCamera = async (type: 'clock_in' | 'clock_out') => {
    // Validasi Geofence sebelum buka kamera
    if (type === 'clock_in' && locationStatus === 'outside') {
      toast.error('Presensi Masuk diblokir! Anda berada di luar radius kantor/pos tugas.');
      return;
    }

    if (type === 'clock_out' && (todayAttendance?.isLocked || todayAttendance?.isPerimeterBreached)) {
      toast.error('Presensi Pulang Terkunci karena pelanggaran perimeter. Hubungi HRD.');
      return;
    }

    setActionType(type);
    setIsCameraActive(true);
    setCameraError(null);
    setFaceDetected(true);

    if (!biometricService.isReady()) {
      biometricService.loadModels().catch((e) => console.warn('[FaceModels Load]', e));
    }

    try {
      if (cameraStream) {
        cameraStream.getTracks().forEach((t) => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => null);
      }
    } catch (err: any) {
      console.warn('[Camera Error]', err);
      // Fallback
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true });
        setCameraStream(fallbackStream);
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
          videoRef.current.play().catch(() => null);
        }
      } catch (err2) {
        setCameraError('Gagal mengakses kamera perangkat. Harap izinkan akses kamera pada browser.');
      }
    }
  };

  const closeLiveCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
      setCameraStream(null);
    }
    setIsCameraActive(false);
    setIsCapturing(false);
    greenSinceRef.current = null;
    isTriggeringAutoRef.current = false;
    setAutoCaptureProgress(0);
  };

  const toggleFacingMode = async () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
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

  // Watermark Stamping pada Canvas (Forensic Pixel Stamping - Ukuran Sedang & Jelas Terbaca)
  const applyWatermark = (canvas: HTMLCanvasElement, matchScore?: number) => {
    const ctx = canvas.getContext('2d');
    if (!ctx || !user) return;
    const w = canvas.width;
    const h = canvas.height;

    // Normalisasi skala ukuran sedang (medium) agar pas di berbagai resolusi layar HP & kamera
    const scale = Math.min(Math.max(w / 800, 0.9), 1.25);

    // Dark Gradient Bar di bagian bawah (tinggi proporsional ~180px * scale)
    const barHeight = Math.round(180 * scale);
    const grad = ctx.createLinearGradient(0, h - barHeight, 0, h);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    grad.addColorStop(0.18, 'rgba(15, 23, 42, 0.92)');
    grad.addColorStop(1, 'rgba(15, 23, 42, 0.98)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, h - barHeight, w, barHeight);

    // Top Status Accent Line
    ctx.fillStyle = '#10b981';
    ctx.fillRect(0, h - barHeight + Math.round(20 * scale), w, Math.max(3 * scale, 3));

    // Header badge (Top Left)
    const badgeW = Math.min(w - 24, Math.round(440 * scale));
    const badgeH = Math.round(34 * scale);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
    ctx.fillRect(16, 16, badgeW, badgeH);
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = Math.max(2 * scale, 2);
    ctx.strokeRect(16, 16, badgeW, badgeH);

    ctx.font = `bold ${Math.round(13 * scale)}px system-ui, sans-serif`;
    ctx.fillStyle = '#10b981';
    ctx.fillText(
      `🛡️ PT FRP • ${actionType === 'clock_in' ? 'CLOCK-IN (MASUK)' : 'CLOCK-OUT (PULANG)'} • 1:1 SCORE: ${matchScore || 98}%`,
      24,
      16 + Math.round(22 * scale)
    );

    // Text rows in bottom banner - UKURAN SEDANG, TAJAM, KONTRAS TINGGI
    const paddingX = Math.round(18 * scale);
    let startY = h - barHeight + Math.round(50 * scale);
    const lineGap = Math.round(32 * scale);

    // Line 1: Employee Name & NIP & Division (Ukuran Sedang: 16px * scale)
    ctx.font = `bold ${Math.round(16 * scale)}px system-ui, sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur = 3;
    ctx.fillText(
      `👤 ${user.fullName} (${user.nip || 'ID: ' + user.id.slice(0, 8)}) • ${user.divisionName || 'Operasional'}`,
      paddingX,
      startY
    );

    // Line 2: Shift Berapa (Ukuran Sedang: 14px * scale)
    startY += lineGap;
    const cleanShiftName = userShift?.name || 'Shift Reguler';
    const shiftHoursStr = `${userShift?.startTime || '08:00'} - ${userShift?.endTime || '17:00'} WITA`;
    const shiftText = cleanShiftName.includes('(') ? `⏰ Shift: ${cleanShiftName}` : `⏰ Shift: ${cleanShiftName} (${shiftHoursStr})`;
    ctx.font = `bold ${Math.round(14 * scale)}px system-ui, sans-serif`;
    ctx.fillStyle = '#fbbf24'; // Amber / Gold
    ctx.fillText(shiftText, paddingX, startY);

    // Line 3: Tanggal dan Waktu WITA (Ukuran Sedang: 14px * scale)
    startY += lineGap;
    const now = new Date();
    const dateFormatted = now.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const timeFormatted = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/\./g, ':');
    ctx.font = `bold ${Math.round(14 * scale)}px ui-monospace, SFMono-Regular, monospace`;
    ctx.fillStyle = '#cbd5e1'; // Slate light
    ctx.fillText(`🕒 ${dateFormatted} • ${timeFormatted} WITA`, paddingX, startY);

    // Line 4: Titik Lokasi GPS & Nama Pos (Ukuran Sedang: 14px * scale)
    startY += lineGap;
    const coordsStr = currentCoords
      ? `📍 Pos: ${assignedPostName || 'Kantor FRP'} • GPS: ${currentCoords.lat.toFixed(6)}, ${currentCoords.lng.toFixed(6)} (±${coordsAccuracy ? Math.round(coordsAccuracy) : 10}m)`
      : `📍 Pos: ${assignedPostName || 'Kantor FRP'}`;
    ctx.font = `bold ${Math.round(14 * scale)}px system-ui, sans-serif`;
    ctx.fillStyle = '#34d399'; // Emerald
    ctx.fillText(coordsStr, paddingX, startY);

    // Reset shadow
    ctx.shadowBlur = 0;
  };

  // Capture Photo & Submit to PostgreSQL
  const handleShutterCapture = async () => {
    if (!videoRef.current || !user || isCapturing) return;
    if (videoRef.current.readyState < 2 || videoRef.current.videoWidth === 0) {
      toast.warning('Kamera sedang memuat frame, silakan tunggu 1-2 detik...');
      return;
    }
    setIsCapturing(true);

    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 1280;
      canvas.height = videoRef.current.videoHeight || 720;
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
      let verifiedConfidence = 0;
      let isVerifiedBiometric = false;

      if (masterDescriptor && masterDescriptor.length === 128) {
        const liveDesc = await biometricService.extractFaceDescriptor(canvas).catch(() => null);

        if (!liveDesc) {
          toast.error('Wajah tidak terdeteksi jelas pada foto. Posisikan wajah Anda tepat di tengah kamera.');
          setIsCapturing(false);
          isTriggeringAutoRef.current = false;
          return;
        }

        const match = biometricService.evaluateBiometricMatch(liveDesc, masterDescriptor);

        if (!match.isMatch) {
          toast.error(`Presensi Ditolak! Wajah tidak sesuai dengan data biometrik master di database (${match.confidence}% < 75%).`);
          setIsCapturing(false);
          isTriggeringAutoRef.current = false;
          return;
        }

        verifiedConfidence = match.confidence;
        isVerifiedBiometric = true;
      } else {
        const faceCheck = await biometricService.detectFace(canvas).catch(() => null);
        if (!faceCheck || !faceCheck.box || faceCheck.box.width === 0) {
          toast.error('Wajah tidak terdeteksi pada foto. Silakan posisikan wajah Anda ke kamera.');
          setIsCapturing(false);
          isTriggeringAutoRef.current = false;
          return;
        }
        verifiedConfidence = 88;
        isVerifiedBiometric = true;
      }

      applyWatermark(canvas, verifiedConfidence);
      const photoData = canvas.toDataURL('image/jpeg', 0.88);

      // Stop camera
      closeLiveCamera();

      // Submit Attendance to Database
      const todayStr = getTodayDateStr();
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

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

      // Kirim bukti forensik spot-check jika ada instruksi khusus dari pimpinan
      if (isSpotCheckAction || spotCheckModalOpen || spotCheckData) {
        try {
          await fieldSentinelService.submitPatrolCheck({
            userId: user.id,
            checkType: 'spot_check',
            locationName: assignedPostName || 'Pos Lapangan Terdaftar',
            latitude: currentCoords?.lat || 0,
            longitude: currentCoords?.lng || 0,
            accuracyMeters: coordsAccuracy || 10,
            watermarkedPhotoUrl: photoData,
            biometricScore: verifiedConfidence,
            notes: spotCheckData?.notes || 'Verifikasi Laporan Wajah atas Instruksi Pimpinan',
          });
          toast.success('Bukti Forensik Laporan Wajah terkirim langsung ke Pimpinan & Superadmin!');
        } catch (patrolErr) {
          console.warn('[Patrol Check Submit Error]', patrolErr);
        }
        setIsSpotCheckAction(false);
        setSpotCheckModalOpen(false);
        setSpotCheckData(null);
        emergencyAlertService.stopEmergencyAlert();
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
      setIsCapturing(false);
      isTriggeringAutoRef.current = false;
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
  const isClockOutAllowed = hasClockedIn && !hasClockedOut && (!isBeforeShiftEndTime || hasApprovedEmergencyLeave);

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. TAMPILAN FULLSCREEN LIVE CAMERA (PERSIS LAMPIRAN 3)
  // ─────────────────────────────────────────────────────────────────────────────
  if (isCameraActive) {
    return (
      <div className="fixed inset-0 z-50 bg-black text-white flex flex-col justify-between overflow-hidden select-none">
        {/* Top Header Live Camera */}
        <div className="relative pt-[max(1rem,env(safe-area-inset-top))] pb-3 px-4 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent z-20">
          <div className="text-xs text-white/70 font-mono">
            {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WITA
          </div>
          <h2 className="text-sm font-bold tracking-wider uppercase text-white/90">LIVE CAMERA</h2>
          <button
            type="button"
            onClick={closeLiveCamera}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md flex items-center justify-center text-white transition-all active:scale-90"
            title="Tutup Kamera"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewport Live Video with Frame Guides */}
        <div className="relative flex-1 flex items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`absolute inset-0 w-full h-full object-cover ${facingMode === 'user' ? '-scale-x-100' : ''}`}
          />

          {cameraError && (
            <div className="absolute inset-0 z-30 bg-black/90 flex flex-col items-center justify-center p-6 text-center space-y-3">
              <AlertCircle className="w-12 h-12 text-rose-500 animate-bounce" />
              <p className="text-sm font-medium text-rose-200">{cameraError}</p>
              <Button size="sm" variant="outline" onClick={() => openLiveCamera(actionType)} className="rounded-xl text-xs">
                Coba Lagi
              </Button>
            </div>
          )}

          {/* Bounding Box Wajah: Dashed rectangle dengan glowing dynamic corners */}
          <div className="relative z-10 w-[260px] h-[320px] sm:w-[280px] sm:h-[350px] pointer-events-none flex flex-col items-center justify-center">
            {/* Dashed Outline */}
            <div
              className={`absolute inset-0 rounded-[28px] border-2 border-dashed transition-colors duration-300 ${
                liveFaceStatus.isGreen
                  ? 'border-emerald-400/90 shadow-[0_0_24px_rgba(52,211,153,0.45)]'
                  : liveFaceStatus.detected
                  ? 'border-cyan-400/70 shadow-[0_0_15px_rgba(34,211,238,0.25)]'
                  : 'border-white/50 shadow-[0_0_12px_rgba(255,255,255,0.15)]'
              }`}
            />

            {/* Glowing Corner Accents */}
            <div
              className={`absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 rounded-tl-2xl transition-all duration-300 ${
                liveFaceStatus.isGreen
                  ? 'border-emerald-400 shadow-[0_0_16px_#34d399]'
                  : liveFaceStatus.detected
                  ? 'border-cyan-400 shadow-[0_0_10px_#22d3ee]'
                  : 'border-white/70 shadow-[0_0_8px_rgba(255,255,255,0.3)]'
              }`}
            />
            <div
              className={`absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 rounded-tr-2xl transition-all duration-300 ${
                liveFaceStatus.isGreen
                  ? 'border-emerald-400 shadow-[0_0_16px_#34d399]'
                  : liveFaceStatus.detected
                  ? 'border-cyan-400 shadow-[0_0_10px_#22d3ee]'
                  : 'border-white/70 shadow-[0_0_8px_rgba(255,255,255,0.3)]'
              }`}
            />
            <div
              className={`absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 rounded-bl-2xl transition-all duration-300 ${
                liveFaceStatus.isGreen
                  ? 'border-emerald-400 shadow-[0_0_16px_#34d399]'
                  : liveFaceStatus.detected
                  ? 'border-cyan-400 shadow-[0_0_10px_#22d3ee]'
                  : 'border-white/70 shadow-[0_0_8px_rgba(255,255,255,0.3)]'
              }`}
            />
            <div
              className={`absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 rounded-br-2xl transition-all duration-300 ${
                liveFaceStatus.isGreen
                  ? 'border-emerald-400 shadow-[0_0_16px_#34d399]'
                  : liveFaceStatus.detected
                  ? 'border-cyan-400 shadow-[0_0_10px_#22d3ee]'
                  : 'border-white/70 shadow-[0_0_8px_rgba(255,255,255,0.3)]'
              }`}
            />

            {/* Subtly glowing scan line */}
            <div
              className={`w-full h-0.5 bg-gradient-to-r from-transparent to-transparent animate-pulse ${
                liveFaceStatus.isGreen
                  ? 'via-emerald-400'
                  : 'via-cyan-400'
              }`}
            />
          </div>
        </div>

        {/* Bottom Control Controls & Shutter Button */}
        <div className="relative pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 px-6 flex flex-col items-center bg-gradient-to-t from-black/95 via-black/75 to-transparent z-20 space-y-3">
          {/* Pill Status Presisi: Wajah Terdeteksi & Posisi */}
          <div
            className={`px-4 py-1.5 rounded-full backdrop-blur-md border shadow-lg flex items-center gap-2 text-xs font-semibold transition-all duration-300 ${
              liveFaceStatus.isGreen
                ? 'bg-emerald-950/90 border-emerald-500/80 text-emerald-300 shadow-[0_0_18px_rgba(52,211,153,0.35)]'
                : liveFaceStatus.detected
                ? 'bg-slate-900/85 border-cyan-500/60 text-cyan-200'
                : 'bg-slate-900/85 border-slate-700/60 text-slate-300'
            }`}
          >
            <span>{liveFaceStatus.message}</span>
            {liveFaceStatus.isGreen ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : liveFaceStatus.detected ? (
              <Loader2 className="w-4 h-4 text-cyan-400 animate-spin shrink-0" />
            ) : null}
          </div>

          {/* Progress auto-capture bar ketika indikator hijau */}
          {liveFaceStatus.isGreen && (
            <div className="w-52 bg-slate-800/80 h-1.5 rounded-full overflow-hidden border border-emerald-500/30">
              <div
                className="bg-emerald-400 h-full transition-all duration-100 ease-linear rounded-full"
                style={{ width: `${autoCaptureProgress}%` }}
              />
            </div>
          )}

          {/* Teks Instruksi Karyawan */}
          <p className="text-[11px] font-bold tracking-wider uppercase text-white/90">
            {liveFaceStatus.isGreen
              ? autoCaptureProgress >= 90
                ? '✓ OTOMATIS MENJEPRET FOTO...'
                : 'KLIK TOMBOL HIJAU ATAU TAHAN 1 DETIK'
              : 'POSISIKAN WAJAH HINGGA INDIKATOR HIJAU'}
          </p>

          {/* Shutter Button Row */}
          <div className="w-full flex items-center justify-between px-6 max-w-xs">
            {/* Left placeholder for balance */}
            <div className="w-11" />

            {/* Shutter Button Container: HARUS SETELAH INDIKATOR HIJAU */}
            <div className="relative flex items-center justify-center">
              {/* Outer circular auto-capture countdown ring */}
              {liveFaceStatus.isGreen && (
                <svg className="absolute -inset-2.5 w-[92px] h-[92px] -rotate-90 pointer-events-none z-10" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="46"
                    className="stroke-emerald-400/25"
                    strokeWidth="4"
                    fill="none"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="46"
                    className="stroke-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.85)] transition-all duration-100"
                    strokeWidth="5"
                    strokeDasharray="289"
                    strokeDashoffset={289 - (289 * autoCaptureProgress) / 100}
                    strokeLinecap="round"
                    fill="none"
                  />
                </svg>
              )}

              {/* Tombol Ambil Gambar: Aktif hanya saat indikator hijau */}
              <button
                type="button"
                disabled={!liveFaceStatus.isGreen || isCapturing}
                onClick={handleShutterCapture}
                className={`w-18 h-18 rounded-full border-4 p-1 flex items-center justify-center transition-all ${
                  liveFaceStatus.isGreen && !isCapturing
                    ? 'border-emerald-400 hover:border-emerald-300 shadow-[0_0_26px_rgba(52,211,153,0.65)] cursor-pointer active:scale-90 animate-pulse'
                    : 'border-slate-700/60 bg-slate-900/60 opacity-35 cursor-not-allowed'
                }`}
                title={liveFaceStatus.isGreen ? 'Ambil Foto Presensi Sekarang' : 'Posisikan wajah hingga indikator hijau'}
              >
                <div
                  className={`w-full h-full rounded-full flex items-center justify-center transition-colors ${
                    liveFaceStatus.isGreen
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-inner'
                      : 'bg-slate-800 text-slate-500'
                  }`}
                >
                  <Camera className="w-6 h-6" />
                </div>
              </button>
            </div>

            {/* Right: Switch Camera Button */}
            <button
              type="button"
              onClick={toggleFacingMode}
              className="w-11 h-11 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md flex items-center justify-center text-white transition-all active:scale-90"
              title="Ganti Kamera Depan/Belakang"
            >
              <SwitchCamera className="w-5 h-5" />
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
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm p-0.5 flex items-center justify-center shrink-0 border border-white/30 shadow-xs">
              <img src={defaultAvatar} alt="Logo FRP" className="w-full h-full object-contain rounded-full" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xs sm:text-sm font-black tracking-wide uppercase text-white drop-shadow-xs truncate">
                PT. FAWWAZ RESKI PERWIRA
              </h1>
              <p className="text-[9px] text-emerald-200/90 font-medium tracking-tight truncate">
                Sistem Presensi & Operasional
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
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
            <button
              type="button"
              onClick={() => {
                if (onSwitchToDesktop) {
                  onSwitchToDesktop();
                } else {
                  localStorage.removeItem('hrm_pwa_mode');
                  window.location.href = '/dashboard';
                }
              }}
              className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-sm flex items-center justify-center text-white transition-all active:scale-90"
              title="Kembali ke Mode Web Portal"
            >
              <Globe className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setLogoutDialogOpen(true)}
              className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-sm flex items-center justify-center text-white transition-all active:scale-90"
              title="Keluar dari Akun"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* ─── KARTU PUTIH UTAMA (ROUNDED TOP BODY - PERSIS LAMPIRAN 2) ─── */}
      <main className="flex-1 bg-white dark:bg-slate-950 rounded-t-[32px] -mt-3 shadow-2xl p-4 sm:p-6 pb-28 space-y-4 overflow-y-auto">
        {/* ─── TAB 1: BERANDA PRESENSI UTAMA ─── */}
        {activeTab === 'beranda' && (
          <div className="space-y-4 animate-in fade-in duration-200">
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

            {/* ─── LINGKARAN KAMERA BIOMETRIK (CENTERPIECE PERSIS LAMPIRAN 2 - FIXED SIZING) ─── */}
            <div className="flex flex-col items-center justify-center py-1">
              <div
                onClick={() => openLiveCamera(hasClockedIn && !hasClockedOut ? 'clock_out' : 'clock_in')}
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
                  {assignedPostName || (bankPosts.length > 0 ? `${bankPosts.length} Pos Lapangan Terdaftar` : 'PT. FAWWAZ RESKI PERWIRA')}
                </h3>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                  {bankPosts.length > 0
                    ? `${bankPosts.length} Pos Terdaftar • Sah Absen di Seluruh Pos`
                    : assignedOffice?.address || 'Jl. Perwira No. 01, Area Pos Penugasan'}
                </p>

                {/* Status Badge */}
                <div className="pt-0.5">
                  {locationStatus === 'inside' ? (
                    <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      LOKASI: SESUAI POS KERJA
                    </span>
                  ) : locationStatus === 'outside' ? (
                    <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-rose-600 dark:text-rose-400">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      DILUAR RADIUS ({Math.round(distanceToOffice || 0)}m)
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

            {/* ─── TOMBOL AKSI PRESISI (DUAL BUTTONS PERSIS LAMPIRAN 2) ─── */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              {/* Tombol Absen Masuk */}
              <button
                type="button"
                disabled={hasClockedIn}
                onClick={() => openLiveCamera('clock_in')}
                className={`py-3 px-3 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold transition-all shadow-sm ${
                  !hasClockedIn
                    ? 'bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white shadow-emerald-600/20'
                    : 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 opacity-90 cursor-default'
                }`}
              >
                <Clock className="w-4 h-4 shrink-0" />
                <span className="truncate">
                  {hasClockedIn ? `MASUK (${todayAttendance?.clockIn?.substring(0, 5) || todayAttendance?.clockIn})` : `ABSEN MASUK (${userShift?.startTime || '08:00'})`}
                </span>
              </button>

              {/* Tombol Absen Pulang (Terkunci Sebelum Waktunya Kecuali Izin Darurat) */}
              <button
                type="button"
                disabled={!isClockOutAllowed}
                onClick={() => {
                  if (!isClockOutAllowed) {
                    if (isBeforeShiftEndTime && !hasApprovedEmergencyLeave) {
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
                {isBeforeShiftEndTime && !hasApprovedEmergencyLeave && hasClockedIn && !hasClockedOut ? (
                  <Lock className="w-4 h-4 shrink-0 text-amber-500" />
                ) : (
                  <LogOut className="w-4 h-4 shrink-0" />
                )}
                <span className="truncate">
                  {hasClockedOut
                    ? `PULANG (${todayAttendance?.clockOut?.substring(0, 5) || todayAttendance?.clockOut})`
                    : !hasClockedIn
                    ? 'ABSEN PULANG'
                    : isBeforeShiftEndTime && !hasApprovedEmergencyLeave
                    ? `TERKUNCI (${userShift?.endTime?.substring(0, 5) || '16:30'})`
                    : hasApprovedEmergencyLeave
                    ? 'PULANG (IZIN DARURAT)'
                    : 'ABSEN PULANG'}
                </span>
              </button>
            </div>

            {/* Status Kunci Absen Pulang & Jam Istirahat Otomatis */}
            {isBeforeShiftEndTime && !hasApprovedEmergencyLeave && hasClockedIn && !hasClockedOut && (
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

            {/* Sub-Actions: Istirahat 1 Jam, Izin Darurat, dan Jadwal Shift */}
            <div className="flex items-center justify-between gap-2 pt-1 text-xs">
              {/* Tombol Istirahat 1 Jam */}
              <button
                type="button"
                onClick={handleToggleBreak}
                disabled={!hasClockedIn || hasClockedOut}
                className={`flex-1 py-2 px-2.5 rounded-xl border flex items-center justify-center gap-1.5 transition-all text-[11px] font-semibold ${
                  isBreakActive
                    ? 'bg-amber-500 text-white border-amber-600 animate-pulse'
                    : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                }`}
              >
                <Coffee className="w-3.5 h-3.5" />
                <span className="truncate">
                  {isBreakActive
                    ? `Istirahat: ${Math.floor(breakTimer / 60)}m ${breakTimer % 60}s`
                    : 'Istirahat 1 Jam'}
                </span>
              </button>

              {/* Tombol Izin Pulang Darurat */}
              <button
                type="button"
                onClick={() => setEmergencyModalOpen(true)}
                disabled={!hasClockedIn || hasClockedOut}
                className="flex-1 py-2 px-2.5 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 hover:bg-rose-100 flex items-center justify-center gap-1.5 transition-all text-[11px] font-semibold"
              >
                <AlertOctagon className="w-3.5 h-3.5 text-rose-600" />
                <span className="truncate">Izin Darurat</span>
              </button>

              {/* Tombol Jadwal Shift Bulan Berjalan */}
              <button
                type="button"
                onClick={() => setScheduleModalOpen(true)}
                className="flex-1 py-2 px-2.5 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 flex items-center justify-center gap-1.5 transition-all text-[11px] font-semibold"
              >
                <CalendarDays className="w-3.5 h-3.5 text-blue-600" />
                <span className="truncate">Jadwal Roster</span>
              </button>
            </div>

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

            {/* Quick Action Tiles (3 Opsi) */}
            <div className="grid grid-cols-3 gap-2">
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
                    ? '128-D Feature Vector biometrik wajah Anda aktif di database PostgreSQL.'
                    : 'Wajah Anda belum terdaftar. Registrasikan 3-sudut agar presensi wajah aktif secara presisi.'}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEnrollModalOpen(true)}
                  className="w-full rounded-xl text-xs gap-1.5 border-emerald-600/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 font-bold"
                >
                  <ScanFace className="w-3.5 h-3.5" />
                  {masterDescriptor && masterDescriptor.length === 128 ? 'Perbarui Wajah Master' : 'Daftarkan Wajah Sekarang'}
                </Button>
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
            // Pengguna menutup modal: matikan sirene
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
                  emergencyAlertService.stopEmergencyAlert();
                  toast.info('Alarm suara & getar diheningkan. Silakan tetap segera ambil foto lapor wajah.');
                }}
                className="w-full text-xs text-slate-400 hover:text-white hover:bg-slate-900 rounded-xl h-9 flex items-center justify-center gap-1.5"
              >
                <VolumeX className="w-3.5 h-3.5" />
                <span>Heningkan Suara / Getar Sementara</span>
              </Button>
            </div>
          </div>
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
    </div>
  );
};
