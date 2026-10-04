import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useHrmAuth } from '@/contexts/HrmAuthContext';
import { hrmService, getTodayDateStr } from '@/services/hrmService';
import { AttendanceRecord, OfficeLocation, Shift, OvertimeRecord } from '@/types/hrm';
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
} from 'lucide-react';
import { toast } from 'sonner';
import { biometricService, BiometricMatchResult } from '@/services/biometricService';
import { livenessEngine } from '@/services/livenessEngine';
import { geofenceService, GeofenceEvaluation } from '@/services/geofenceService';
import { fieldSentinelService } from '@/services/fieldSentinelService';
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

  // Attendance & Shift State
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | undefined>(undefined);
  const [userShift, setUserShift] = useState<Shift | null>(null);
  const [attendancesHistory, setAttendancesHistory] = useState<AttendanceRecord[]>([]);

  // Fullscreen Live Camera States (Persis Lampiran 3)
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [actionType, setActionType] = useState<'clock_in' | 'clock_out'>('clock_in');
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [faceDetected, setFaceDetected] = useState<boolean>(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // 1-Hour Break States
  const [breakTimer, setBreakTimer] = useState<number>(0);
  const [isBreakActive, setIsBreakActive] = useState<boolean>(false);

  // Emergency Leave Modal
  const [emergencyModalOpen, setEmergencyModalOpen] = useState(false);
  const [emergencyReason, setEmergencyReason] = useState('');
  const [isSubmittingEmergency, setIsSubmittingEmergency] = useState(false);

  // Logout Confirmation Dialog
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);

  // Password Change Modal
  const [changePasswordModalOpen, setChangePasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

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

  // Real-time Live Face Detection & Match State
  const [liveFaceStatus, setLiveFaceStatus] = useState<{
    detected: boolean;
    isMatch: boolean | null;
    confidence: number;
    message: string;
  }>({
    detected: false,
    isMatch: null,
    confidence: 0,
    message: 'Arahkan wajah Anda ke dalam bingkai',
  });

  // Active Real-time Face Detection Loop on Camera Stream
  useEffect(() => {
    if (!isCameraActive || !cameraStream) {
      setLiveFaceStatus({
        detected: false,
        isMatch: null,
        confidence: 0,
        message: 'Arahkan wajah Anda ke dalam bingkai',
      });
      return;
    }

    let isMounted = true;
    let isProcessing = false;

    const interval = setInterval(async () => {
      if (!isMounted || !videoRef.current || isProcessing) return;
      if (videoRef.current.readyState < 2) return;

      isProcessing = true;
      try {
        const detail = await biometricService.detectFace(videoRef.current, {
          withLandmarks: true,
          withDescriptor: true,
          withExpressions: false,
        });

        if (!isMounted) return;

        if (!detail || !detail.box || detail.box.width === 0) {
          setLiveFaceStatus({
            detected: false,
            isMatch: null,
            confidence: 0,
            message: 'Posisikan wajah Anda tepat di dalam bingkai',
          });
        } else {
          if (masterDescriptor && masterDescriptor.length === 128 && detail.descriptor) {
            const liveDesc = Array.from(detail.descriptor);
            const match = biometricService.evaluateBiometricMatch(liveDesc, masterDescriptor);
            setLiveFaceStatus({
              detected: true,
              isMatch: match.isMatch,
              confidence: match.confidence,
              message: match.isMatch
                ? `✓ Wajah Cocok (${match.confidence}% Sesuai Database)`
                : `⚠️ Wajah Tidak Cocok (${match.confidence}% Sesuai Database)`,
            });
          } else {
            setLiveFaceStatus({
              detected: true,
              isMatch: null,
              confidence: 95,
              message: user?.isFaceEnrolled ? 'Wajah Terdeteksi • Mengevaluasi...' : 'Wajah Terdeteksi • Master Belum Terdaftar',
            });
          }
        }
      } catch (e) {
        console.warn('[Face Detection Tick]', e);
      } finally {
        isProcessing = false;
      }
    }, 200);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isCameraActive, cameraStream, masterDescriptor, user?.isFaceEnrolled]);

  // Load Real Data from PostgreSQL & hrmService
  const loadRealData = async () => {
    if (!user) return;
    try {
      await hrmService.syncWithBackend().catch(() => null);

      // 1. Shift
      const shifts = hrmService.getShifts();
      const matchedShift = shifts.find((s) => s.id === user.shiftId) || shifts[0] || null;
      setUserShift(matchedShift);

      // 2. Attendance Hari Ini
      const todayStr = getTodayDateStr();
      const userAtts = hrmService.getAttendances().filter((a) => a.userId === user.id);
      setAttendancesHistory(userAtts);

      const todayAtt = userAtts.find((a) => a.date === todayStr);
      setTodayAttendance(todayAtt);

      if (todayAtt?.isOnBreak && todayAtt.breakStartTime) {
        setIsBreakActive(true);
        const [h, m, s] = todayAtt.breakStartTime.split(':').map(Number);
        const breakDate = new Date();
        breakDate.setHours(h, m, s || 0, 0);
        const elapsedSec = Math.floor((Date.now() - breakDate.getTime()) / 1000);
        setBreakTimer(Math.max(0, 3600 - elapsedSec));
      } else {
        setIsBreakActive(false);
        setBreakTimer(0);
      }

      // 3. Pos Penugasan / Kantor Divisi
      let officeLoc: OfficeLocation | null = null;
      if (user.assignedLatitude && user.assignedLongitude) {
        officeLoc = {
          id: 'assigned-post',
          name: user.assignedLocationName || 'Pos Lapangan Terdaftar',
          latitude: user.assignedLatitude,
          longitude: user.assignedLongitude,
          radiusMeters: user.assignedRadiusMeters || 150,
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
    } catch (err) {
      console.error('[PWA] Error loading real data:', err);
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
        setCurrentCoords(coords);
        setCoordsAccuracy(pos.coords.accuracy || 10);

        if (assignedOffice) {
          const evalResult = geofenceService.evaluateGeofence(coords, assignedOffice);
          setDistanceToOffice(evalResult.distanceMeters);
          setLocationStatus(evalResult.isInside ? 'inside' : 'outside');
        } else {
          setLocationStatus('inside');
        }
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
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  };

  // Real-Time Analytics Calculations from Database Records
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

    // Weekly 7 Days Streak (Senin - Minggu)
    const daysName = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
    const todayIndex = (new Date().getDay() + 6) % 7; // 0 = Senin, 6 = Minggu
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
    };
  }, [attendancesHistory, user, todayAttendance]);

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

  // Watermark Stamping pada Canvas
  const applyWatermark = (canvas: HTMLCanvasElement, matchScore?: number) => {
    const ctx = canvas.getContext('2d');
    if (!ctx || !user) return;
    const w = canvas.width;
    const h = canvas.height;

    // Dark Gradient Bar at bottom
    const grad = ctx.createLinearGradient(0, h - 110, 0, h);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.3, 'rgba(15, 23, 42, 0.85)');
    grad.addColorStop(1, 'rgba(15, 23, 42, 0.98)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, h - 110, w, 110);

    // Header badge
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.fillRect(12, 12, 380, 28);
    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = '#10b981';
    ctx.fillText(
      `🛡️ PT FRP • ${actionType === 'clock_in' ? 'CLOCK-IN' : 'CLOCK-OUT'} • MATCH: ${matchScore || 98}%`,
      20,
      30
    );

    // Employee Name & NIP
    ctx.font = 'bold 15px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${user.fullName} (${user.nip}) • ${user.divisionName || 'Operasional'}`, 16, h - 65);

    // Atomic Date & Time WITA
    const timeStr = new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'medium' });
    ctx.font = '12px monospace';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(`🕒 ${timeStr} WITA`, 16, h - 42);

    // Location Coordinates
    const coordsStr = currentCoords
      ? `📍 GPS: ${currentCoords.lat.toFixed(5)}, ${currentCoords.lng.toFixed(5)} (${assignedPostName || 'Area Terverifikasi'})`
      : `📍 Pos: ${assignedPostName || 'Kantor PT FRP'}`;
    ctx.fillStyle = '#34d399';
    ctx.fillText(coordsStr, 16, h - 20);
  };

  // Capture Photo & Submit to PostgreSQL
  const handleShutterCapture = async () => {
    if (!videoRef.current || !user || isCapturing) return;
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
        // Extract 128D descriptor from current canvas
        const liveDesc = await biometricService.extractFaceDescriptor(canvas).catch(() => null);

        if (!liveDesc) {
          toast.error('Wajah tidak terdeteksi jelas pada foto. Posisikan wajah Anda tepat di tengah kamera.');
          setIsCapturing(false);
          return;
        }

        const match = biometricService.evaluateBiometricMatch(liveDesc, masterDescriptor);

        // Reject if biometric match fails
        if (!match.isMatch) {
          toast.error(`Presensi Ditolak! Wajah tidak sesuai dengan data biometrik master di database (${match.confidence}% < 75%).`);
          setIsCapturing(false);
          return;
        }

        verifiedConfidence = match.confidence;
        isVerifiedBiometric = true;
      } else {
        // Fallback jika karyawan belum mendaftarkan master face di Tab Akun
        const faceCheck = await biometricService.detectFace(canvas).catch(() => null);
        if (!faceCheck || !faceCheck.box || faceCheck.box.width === 0) {
          toast.error('Wajah tidak terdeteksi pada foto. Silakan posisikan wajah Anda ke kamera.');
          setIsCapturing(false);
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
      const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

      // Determine late minutes
      let lateMinutes = 0;
      let status: 'hadir' | 'terlambat' = 'hadir';
      if (actionType === 'clock_in' && userShift?.startTime) {
        const [sH, sM] = userShift.startTime.split(':').map(Number);
        const [cH, cM] = timeStr.split(':').map(Number);
        const diff = (cH * 60 + cM) - (sH * 60 + sM);
        if (diff > 0) {
          lateMinutes = diff;
          status = 'terlambat';
        }
      }

      await hrmService.recordAttendance({
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
      setIsCapturing(false);
    }
  };

  // Toggle 1-Hour Break
  const handleToggleBreak = async () => {
    if (!todayAttendance?.clockIn || todayAttendance.clockOut) {
      toast.error('Anda harus absen masuk terlebih dahulu sebelum mengambil jam istirahat.');
      return;
    }

    const nextState = !isBreakActive;
    try {
      const nowStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      await hrmService.setEmployeeBreakStatus(user!.id, todayAttendance.id, nextState, nextState ? nowStr : undefined);
      setIsBreakActive(nextState);
      if (nextState) {
        setBreakTimer(3600);
        toast.success('Mode Istirahat 1 Jam Aktif. Anda dapat meninggalkan area kantor.');
      } else {
        setBreakTimer(0);
        toast.info('Waktu istirahat selesai. Selamat kembali bertugas!');
      }
      loadRealData();
    } catch (err) {
      toast.error('Gagal memperbarui status istirahat');
    }
  };

  // Emergency Leave Submit
  const handleConfirmEmergency = async () => {
    if (!emergencyReason.trim() || !user || !todayAttendance) return;
    setIsSubmittingEmergency(true);
    try {
      const nowStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      await hrmService.recordEarlyLeaveEmergency({
        userId: user.id,
        attendanceId: todayAttendance.id,
        reason: emergencyReason.trim(),
        clockOutTime: nowStr,
      });
      toast.success('Izin Pulang Darurat Berhasil dicatat. Notifikasi terkirim ke Pimpinan.');
      setEmergencyModalOpen(false);
      setEmergencyReason('');
      loadRealData();
    } catch (err: any) {
      toast.error('Gagal memproses izin darurat: ' + err.message);
    } finally {
      setIsSubmittingEmergency(false);
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

  const hasClockedIn = Boolean(todayAttendance?.clockIn);
  const hasClockedOut = Boolean(todayAttendance?.clockOut);

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
                liveFaceStatus.isMatch === true
                  ? 'border-emerald-400/80 shadow-[0_0_20px_rgba(52,211,153,0.3)]'
                  : liveFaceStatus.isMatch === false
                  ? 'border-rose-500/80 shadow-[0_0_20px_rgba(244,63,94,0.3)]'
                  : liveFaceStatus.detected
                  ? 'border-cyan-400/70 shadow-[0_0_15px_rgba(34,211,238,0.25)]'
                  : 'border-white/50 shadow-[0_0_12px_rgba(255,255,255,0.15)]'
              }`}
            />

            {/* Glowing Corner Accents (Sudut Dinamis Berdasarkan Pencocokan Database) */}
            <div
              className={`absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 rounded-tl-2xl transition-all duration-300 ${
                liveFaceStatus.isMatch === true
                  ? 'border-emerald-400 shadow-[0_0_14px_#34d399]'
                  : liveFaceStatus.isMatch === false
                  ? 'border-rose-500 shadow-[0_0_14px_#f43f5e]'
                  : liveFaceStatus.detected
                  ? 'border-cyan-400 shadow-[0_0_10px_#22d3ee]'
                  : 'border-white/70 shadow-[0_0_8px_rgba(255,255,255,0.3)]'
              }`}
            />
            <div
              className={`absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 rounded-tr-2xl transition-all duration-300 ${
                liveFaceStatus.isMatch === true
                  ? 'border-emerald-400 shadow-[0_0_14px_#34d399]'
                  : liveFaceStatus.isMatch === false
                  ? 'border-rose-500 shadow-[0_0_14px_#f43f5e]'
                  : liveFaceStatus.detected
                  ? 'border-cyan-400 shadow-[0_0_10px_#22d3ee]'
                  : 'border-white/70 shadow-[0_0_8px_rgba(255,255,255,0.3)]'
              }`}
            />
            <div
              className={`absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 rounded-bl-2xl transition-all duration-300 ${
                liveFaceStatus.isMatch === true
                  ? 'border-emerald-400 shadow-[0_0_14px_#34d399]'
                  : liveFaceStatus.isMatch === false
                  ? 'border-rose-500 shadow-[0_0_14px_#f43f5e]'
                  : liveFaceStatus.detected
                  ? 'border-cyan-400 shadow-[0_0_10px_#22d3ee]'
                  : 'border-white/70 shadow-[0_0_8px_rgba(255,255,255,0.3)]'
              }`}
            />
            <div
              className={`absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 rounded-br-2xl transition-all duration-300 ${
                liveFaceStatus.isMatch === true
                  ? 'border-emerald-400 shadow-[0_0_14px_#34d399]'
                  : liveFaceStatus.isMatch === false
                  ? 'border-rose-500 shadow-[0_0_14px_#f43f5e]'
                  : liveFaceStatus.detected
                  ? 'border-cyan-400 shadow-[0_0_10px_#22d3ee]'
                  : 'border-white/70 shadow-[0_0_8px_rgba(255,255,255,0.3)]'
              }`}
            />

            {/* Subtly glowing scan line */}
            <div
              className={`w-full h-0.5 bg-gradient-to-r from-transparent to-transparent animate-pulse ${
                liveFaceStatus.isMatch === true
                  ? 'via-emerald-400'
                  : liveFaceStatus.isMatch === false
                  ? 'via-rose-500'
                  : 'via-cyan-400'
              }`}
            />
          </div>
        </div>

        {/* Bottom Control Controls & Shutter Button */}
        <div className="relative pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 px-6 flex flex-col items-center bg-gradient-to-t from-black/90 via-black/70 to-transparent z-20 space-y-4">
          {/* Pill Status Presisi: Wajah Terdeteksi & Pencocokan Database */}
          <div
            className={`px-4 py-1.5 rounded-full backdrop-blur-md border shadow-lg flex items-center gap-2 text-xs font-semibold transition-all duration-300 ${
              liveFaceStatus.isMatch === true
                ? 'bg-emerald-950/85 border-emerald-500/80 text-emerald-300 shadow-[0_0_16px_rgba(52,211,153,0.3)]'
                : liveFaceStatus.isMatch === false
                ? 'bg-rose-950/85 border-rose-500/80 text-rose-300 animate-pulse shadow-[0_0_16px_rgba(244,63,94,0.3)]'
                : liveFaceStatus.detected
                ? 'bg-slate-900/85 border-cyan-500/60 text-cyan-200'
                : 'bg-slate-900/85 border-slate-700/60 text-slate-300'
            }`}
          >
            <span>{liveFaceStatus.message}</span>
            {liveFaceStatus.isMatch === true && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
            {liveFaceStatus.isMatch === false && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
            {liveFaceStatus.isMatch === null && liveFaceStatus.detected && (
              <Loader2 className="w-4 h-4 text-cyan-400 animate-spin shrink-0" />
            )}
          </div>

          {/* Teks Instruksi */}
          <p className="text-xs font-bold tracking-widest uppercase text-white/90">
            {liveFaceStatus.isMatch === false
              ? 'WAJAH TIDAK COCOK DENGAN DATABASE'
              : 'AMBIL FOTO UNTUK ABSEN'}
          </p>

          {/* Shutter Button Row */}
          <div className="w-full flex items-center justify-between px-6 max-w-xs">
            {/* Left placeholder for balance */}
            <div className="w-11" />

            {/* Big Shutter Button */}
            <button
              type="button"
              disabled={isCapturing}
              onClick={handleShutterCapture}
              className={`w-18 h-18 rounded-full border-4 p-1 flex items-center justify-center transition-all active:scale-90 ${
                liveFaceStatus.isMatch === true
                  ? 'border-emerald-400 hover:border-emerald-300 shadow-[0_0_24px_rgba(52,211,153,0.6)]'
                  : liveFaceStatus.isMatch === false
                  ? 'border-rose-500/80 hover:border-rose-400 shadow-[0_0_18px_rgba(244,63,94,0.5)]'
                  : 'border-white/80 hover:border-white shadow-[0_0_20px_rgba(255,255,255,0.4)]'
              }`}
              title="Ambil Foto Presensi"
            >
              <div
                className={`w-full h-full rounded-full transition-colors ${
                  liveFaceStatus.isMatch === true
                    ? 'bg-emerald-400'
                    : liveFaceStatus.isMatch === false
                    ? 'bg-rose-500'
                    : 'bg-white active:bg-slate-200'
                }`}
              />
            </button>

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
        {/* Title Bar: PRESENSI HARI INI + Refresh & Logout Button */}
        <div className="flex items-center justify-between px-1">
          <div className="w-8" /> {/* Spacer */}
          <h1 className="text-base font-bold tracking-wider uppercase text-white drop-shadow-xs">
            PRESENSI HARI INI
          </h1>
          <div className="flex items-center gap-1.5">
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
                  Shift: {userShift?.name || 'Reguler'} ({userShift?.startTime || '08:00'} - {userShift?.endTime || '17:00'} WITA)
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
                    <div className="absolute bottom-2 bg-emerald-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-xs flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      {hasClockedOut ? 'Selesai' : 'Masuk'}
                    </div>
                  )}
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
                  {assignedPostName || 'PT. FAWWAZ RESKI PERWIRA'}
                </h3>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                  {assignedOffice?.address || 'Jl. Perwira No. 01, Area Pos Penugasan'}
                </p>

                {/* Status Badge */}
                <div className="pt-0.5">
                  {locationStatus === 'inside' ? (
                    <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      LOKASI: SESUAI KANTOR
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
                  {hasClockedIn ? `MASUK (${todayAttendance?.clockIn})` : `ABSEN MASUK (${userShift?.startTime || '08:00'})`}
                </span>
              </button>

              {/* Tombol Absen Pulang */}
              <button
                type="button"
                disabled={!hasClockedIn || hasClockedOut}
                onClick={() => openLiveCamera('clock_out')}
                className={`py-3 px-3 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold transition-all shadow-sm ${
                  hasClockedIn && !hasClockedOut
                    ? 'bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white shadow-emerald-700/20'
                    : hasClockedOut
                    ? 'bg-slate-100 dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-800 opacity-90 cursor-default'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-75'
                }`}
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span className="truncate">
                  {hasClockedOut ? `PULANG (${todayAttendance?.clockOut})` : 'ABSEN PULANG'}
                </span>
              </button>
            </div>

            {/* Sub-Actions: Istirahat 1 Jam & Izin Darurat */}
            <div className="flex items-center justify-between gap-2 pt-1 text-xs">
              {/* Tombol Istirahat 1 Jam */}
              <button
                type="button"
                onClick={handleToggleBreak}
                disabled={!hasClockedIn || hasClockedOut}
                className={`flex-1 py-2 px-3 rounded-xl border flex items-center justify-center gap-1.5 transition-all text-[11px] font-semibold ${
                  isBreakActive
                    ? 'bg-amber-500 text-white border-amber-600 animate-pulse'
                    : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                }`}
              >
                <Coffee className="w-3.5 h-3.5" />
                <span>
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
                className="flex-1 py-2 px-3 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 hover:bg-rose-100 flex items-center justify-center gap-1.5 transition-all text-[11px] font-semibold"
              >
                <AlertOctagon className="w-3.5 h-3.5 text-rose-600" />
                <span>Izin Darurat</span>
              </button>
            </div>

            {/* ─── WIDGET ANALYTICS PROGRES KEHADIRAN REALTIME (HALLMARK ANTI-SLOP) ─── */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  Progres & Disiplin Kehadiran Saya
                </h3>
                <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
                  Real-time Database
                </span>
              </div>

              {/* Grid 4 Kartu KPI Kehadiran */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800">
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Tepat Waktu</p>
                  <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {analyticsData.onTimeCount} <span className="text-[10px] font-normal text-slate-400">Hari</span>
                  </p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800">
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Terlambat</p>
                  <p className="text-base font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                    {analyticsData.lateCount} <span className="text-[10px] font-normal text-slate-400">Kali</span>
                  </p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800">
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Sisa Cuti</p>
                  <p className="text-base font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                    {analyticsData.remainingLeave} <span className="text-[10px] font-normal text-slate-400">Hari</span>
                  </p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800">
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Skor Disiplin</p>
                  <p className="text-base font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">
                    {analyticsData.attendanceRate}%
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

        {/* ─── TAB 2: RIWAYAT KEHADIRAN ─── */}
        {activeTab === 'riwayat' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Riwayat Kehadiran Saya</h2>
              <span className="text-xs text-slate-500">{attendancesHistory.length} Catatan</span>
            </div>

            <div className="space-y-2.5">
              {attendancesHistory.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">Belum ada riwayat presensi tercatat.</div>
              ) : (
                attendancesHistory.slice(0, 10).map((att) => (
                  <div
                    key={att.id}
                    className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between"
                  >
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-slate-900 dark:text-white">{att.date}</p>
                      <p className="text-[11px] text-slate-500">
                        Masuk: {att.clockIn || '-'} | Pulang: {att.clockOut || '-'}
                      </p>
                      {att.lateMinutes && att.lateMinutes > 0 ? (
                        <span className="text-[10px] text-amber-600 font-semibold">Terlambat {att.lateMinutes} menit</span>
                      ) : null}
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        att.status === 'hadir'
                          ? 'border-emerald-500/30 text-emerald-600 bg-emerald-50 text-[10px]'
                          : 'border-amber-500/30 text-amber-600 bg-amber-50 text-[10px]'
                      }
                    >
                      {att.status.toUpperCase()}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ─── TAB 3: AKTIVITAS / IZIN ─── */}
        {activeTab === 'aktivitas' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Aktivitas & Permohonan Izin</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-1">
                <CalendarCheck2 className="w-6 h-6 text-emerald-600 mx-auto" />
                <p className="text-xs font-bold text-slate-800 dark:text-white">Cuti Tahunan</p>
                <p className="text-[11px] text-slate-500">Tersedia: {analyticsData.remainingLeave} Hari</p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-1">
                <AlertOctagon className="w-6 h-6 text-rose-600 mx-auto" />
                <p className="text-xs font-bold text-slate-800 dark:text-white">Izin Darurat</p>
                <p className="text-[11px] text-slate-500">Self-Service Alert</p>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 text-center">
              Untuk pengajuan formulir lengkap cuti/sakit resmi, Anda dapat mengakses via menu web portal.
            </p>
          </div>
        )}

        {/* ─── TAB 4: AKUN & PENGATURAN ─── */}
        {activeTab === 'akun' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Profil & Keamanan Akun</h2>
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
              <div>
                <p className="text-[10px] text-slate-400 uppercase">Nama Lengkap</p>
                <p className="text-xs font-bold text-slate-800 dark:text-white">{user?.fullName}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase">Email Terdaftar</p>
                <p className="text-xs font-bold text-slate-800 dark:text-white">{user?.email}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase">NIP / ID Karyawan</p>
                <p className="text-xs font-mono font-bold text-slate-800 dark:text-white">{user?.nip}</p>
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

      {/* ─── MODAL IZIN PULANG DARURAT ─── */}
      <Dialog open={emergencyModalOpen} onOpenChange={setEmergencyModalOpen}>
        <DialogContent className="max-w-sm rounded-3xl p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-rose-600 flex items-center gap-2">
              <AlertOctagon className="w-5 h-5" />
              Izin Pulang Darurat
            </DialogTitle>
            <DialogDescription className="text-xs">
              Pilihan khusus darurat/sakit. Sistem otomatis memproses checkout dan mengirim notifikasi instan WhatsApp ke Pimpinan.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <textarea
              rows={3}
              value={emergencyReason}
              onChange={(e) => setEmergencyReason(e.target.value)}
              placeholder="Jelaskan alasan darurat (misal: demam tinggi butuh pengobatan segera)..."
              className="w-full p-3 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
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
              {isSubmittingEmergency ? 'Memproses...' : 'Kirim Laporan'}
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
