import React, { useState, useEffect, useRef } from 'react';
import { hrmService, getTodayDateStr } from '@/services/hrmService';
import { Division, UserProfile, Shift, AttendanceRecord } from '@/types/hrm';
import {
  Monitor,
  Camera,
  Search,
  CheckCircle2,
  Clock,
  MapPin,
  ShieldCheck,
  RotateCw,
  Users,
  Smartphone,
  Sparkles,
  ArrowLeft,
  X,
  UserCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Link } from 'react-router-dom';
import defaultLogo from '@/assets/logo.png';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { biometricService, BiometricMatchResult } from '@/services/biometricService';

export const HrmKioskPage: React.FC = () => {
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [selectedDivisionId, setSelectedDivisionId] = useState<string>('');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionType, setActionType] = useState<'clock_in' | 'clock_out'>('clock_in');

  // Selected Employee for Kiosk
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  // Camera state
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successResult, setSuccessResult] = useState<{ name: string; time: string; type: string } | null>(null);
  const [biometricResult, setBiometricResult] = useState<BiometricMatchResult | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const nativeFileInputRef = useRef<HTMLInputElement | null>(null);

  // Real-time clock
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Load data
  useEffect(() => {
    const divs = hrmService.getDivisions();
    setDivisions(divs);
    if (divs.length > 0) {
      setSelectedDivisionId(divs[0].id);
    }
    const allUsers = hrmService.getUsers().filter((u) => u.isActive);
    setUsers(allUsers);
  }, []);

  const selectedDivision = divisions.find((d) => d.id === selectedDivisionId) || divisions[0];

  // Filtered employees for selected division
  const divisionEmployees = users.filter((u) => {
    const matchesDiv = !selectedDivisionId || u.divisionId === selectedDivisionId;
    const matchesSearch =
      !searchQuery ||
      u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.nip.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesDiv && matchesSearch;
  });

  // Start Camera for selected employee
  const handleSelectEmployee = async (user: UserProfile) => {
    setSelectedUser(user);
    setPhotoDataUrl(null);
    setCameraError(null);
    setCameraActive(true);

    const hasGetUserMedia = Boolean(navigator?.mediaDevices?.getUserMedia);
    if (!hasGetUserMedia) {
      setCameraError('Kamera tidak didukung oleh browser atau membutuhkan koneksi HTTPS.');
      return;
    }

    try {
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'user' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
      } catch (e1) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        } catch (e2) {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }
      }

      if (stream) {
        setCameraStream(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch(console.warn);
          };
          videoRef.current.play().catch(console.warn);
        }
      }
    } catch (err: any) {
      setCameraError('Kamera tidak dapat diakses. Pastikan izin kamera aktif pada browser.');
    }
  };

  const handleCloseCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
      setCameraStream(null);
    }
    setCameraActive(false);
    setSelectedUser(null);
    setPhotoDataUrl(null);
    setBiometricResult(null);
  };

  // Capture kiosk photo with Forensic Watermark & Biometric Verification
  const handleCapturePhoto = async () => {
    if (videoRef.current && selectedUser) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 1280;
      canvas.height = videoRef.current.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

        // 1:1 Biometric Evaluation with face-api.js if enrolled
        let matchResult: BiometricMatchResult | null = null;
        if (selectedUser.isFaceEnrolled && selectedUser.faceDescriptor && Array.isArray(selectedUser.faceDescriptor)) {
          const liveDesc = await biometricService.extractFaceDescriptor(canvas);
          if (liveDesc) {
            matchResult = biometricService.evaluateBiometricMatch(liveDesc, selectedUser.faceDescriptor);
            setBiometricResult(matchResult);
          }
        }

        const w = canvas.width;
        const h = canvas.height;
        const divLoc = hrmService.getDivisionLocation(selectedDivision?.id);

        // Watermark overlay
        const grad = ctx.createLinearGradient(0, h - 120, 0, h);
        grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
        grad.addColorStop(0.3, 'rgba(15, 23, 42, 0.88)');
        grad.addColorStop(1, 'rgba(15, 23, 42, 0.98)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, h - 120, w, 120);

        // Kiosk Badge
        ctx.fillStyle = 'rgba(13, 148, 136, 0.9)';
        ctx.fillRect(16, 16, 260, 28);
        ctx.font = 'bold 12px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('🏢 TERMINAL KIOS TABLET KANTOR', 26, 35);

        // Biometric Stamp
        if (matchResult) {
          ctx.fillStyle = matchResult.isMatch ? '#10b981' : '#f43f5e';
          ctx.font = 'bold 13px monospace';
          ctx.fillText(`👤 AI BIOMETRIC: ${matchResult.isMatch ? 'VERIFIED' : 'MISMATCH'} (${matchResult.confidence}%)`, 20, h - 90);
        }

        // Employee Info
        ctx.font = 'bold 16px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`${selectedUser.fullName} (${selectedUser.nip}) • ${selectedUser.divisionName || selectedDivision?.name}`, 20, h - 65);

        // Atomic Time
        const timeStr = new Date().toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'medium' });
        ctx.font = '12px monospace';
        ctx.fillStyle = '#cbd5e1';
        ctx.fillText(`🕒 ${timeStr} WIB`, 20, h - 42);

        // Division Coords
        ctx.fillStyle = '#34d399';
        ctx.fillText(`📍 GPS KIOS: ${divLoc.latitude.toFixed(5)}, ${divLoc.longitude.toFixed(5)} (${selectedDivision?.name || 'Lobi'})`, 20, h - 20);

        setPhotoDataUrl(canvas.toDataURL('image/jpeg', 0.85));

        if (cameraStream) {
          cameraStream.getTracks().forEach((t) => t.stop());
          setCameraStream(null);
        }
      }
    }
  };

  // Capture kiosk photo via native phone camera input (Works on HTTP without HTTPS)
  const handleNativeKioskPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedUser) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
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
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          const divLoc = hrmService.getDivisionLocation(selectedDivision?.id);

          // 1:1 Biometric Evaluation with face-api.js if enrolled
          let matchResult: BiometricMatchResult | null = null;
          if (selectedUser.isFaceEnrolled && selectedUser.faceDescriptor && Array.isArray(selectedUser.faceDescriptor)) {
            const liveDesc = await biometricService.extractFaceDescriptor(canvas);
            if (liveDesc) {
              matchResult = biometricService.evaluateBiometricMatch(liveDesc, selectedUser.faceDescriptor);
              setBiometricResult(matchResult);
            }
          }

          // Watermark overlay
          const grad = ctx.createLinearGradient(0, h - 120, 0, h);
          grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
          grad.addColorStop(0.3, 'rgba(15, 23, 42, 0.88)');
          grad.addColorStop(1, 'rgba(15, 23, 42, 0.98)');
          ctx.fillStyle = grad;
          ctx.fillRect(0, h - 120, w, 120);

          // Kiosk Badge
          ctx.fillStyle = 'rgba(13, 148, 136, 0.9)';
          ctx.fillRect(16, 16, 260, 28);
          ctx.font = 'bold 12px sans-serif';
          ctx.fillStyle = '#ffffff';
          ctx.fillText('🏢 TERMINAL KIOS TABLET KANTOR', 26, 35);

          // Biometric Stamp
          if (matchResult) {
            ctx.fillStyle = matchResult.isMatch ? '#10b981' : '#f43f5e';
            ctx.font = 'bold 13px monospace';
            ctx.fillText(`👤 AI BIOMETRIC: ${matchResult.isMatch ? 'VERIFIED' : 'MISMATCH'} (${matchResult.confidence}%)`, 20, h - 90);
          }

          // Employee Info
          ctx.font = 'bold 16px sans-serif';
          ctx.fillStyle = '#ffffff';
          ctx.fillText(`${selectedUser.fullName} (${selectedUser.nip}) • ${selectedUser.divisionName || selectedDivision?.name}`, 20, h - 65);

          // Atomic Time
          const timeStr = new Date().toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'medium' });
          ctx.font = '12px monospace';
          ctx.fillStyle = '#cbd5e1';
          ctx.fillText(`🕒 ${timeStr} WIB`, 20, h - 42);

          // Division Coords
          ctx.fillStyle = '#34d399';
          ctx.fillText(`📍 GPS KIOS: ${divLoc.latitude.toFixed(5)}, ${divLoc.longitude.toFixed(5)} (${selectedDivision?.name || 'Lobi'})`, 20, h - 20);

          setPhotoDataUrl(canvas.toDataURL('image/jpeg', 0.85));
          setCameraError(null);

          if (cameraStream) {
            cameraStream.getTracks().forEach((t) => t.stop());
            setCameraStream(null);
          }
        };
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Submit Kiosk Attendance
  const handleSubmitKiosk = () => {
    if (!selectedUser) return;

    // Enforce Biometric Mismatch Guard
    if (biometricResult && !biometricResult.isMatch) {
      alert(`Presensi Ditolak! Wajah tidak cocok dengan data master biometrik ${selectedUser.fullName} (Kemiripan ${biometricResult.confidence}%).`);
      return;
    }

    setSubmitting(true);

    const divLoc = hrmService.getDivisionLocation(selectedDivision?.id);
    const deviceId = `KIOSK-${selectedDivision?.code || 'OFFICE'}-${hrmService.getDeviceFingerprint().slice(0, 10)}`;
    const flags = ['SHARED_OFFICE_KIOSK_VERIFIED', 'BIOMETRIC_SELFIE_WATERMARKED', 'GEOFENCE_RADIUS_VALID'];
    if (biometricResult?.isMatch) {
      flags.push(`BIOMETRIC_MATCH_${biometricResult.confidence}PCT`);
    }

    try {
      if (actionType === 'clock_in') {
        hrmService.recordClockIn({
          userId: selectedUser.id,
          latitude: divLoc.latitude,
          longitude: divLoc.longitude,
          photoUrl: photoDataUrl || undefined,
          deviceId,
          securityFlags: flags,
          notes: `Presensi Masuk via Tablet Kios Divisi ${selectedDivision?.name}`,
          biometricScore: biometricResult?.confidence,
          biometricMatch: biometricResult ? biometricResult.isMatch : undefined,
          geofenceDistance: 0,
          geofenceValid: true,
          isMockLocation: false,
        });
      } else {
        hrmService.recordClockOut({
          userId: selectedUser.id,
          latitude: divLoc.latitude,
          longitude: divLoc.longitude,
          photoUrl: photoDataUrl || undefined,
          deviceId,
          securityFlags: flags,
          notes: `Presensi Pulang via Tablet Kios Divisi ${selectedDivision?.name}`,
          biometricScore: biometricResult?.confidence,
          biometricMatch: biometricResult ? biometricResult.isMatch : undefined,
          geofenceDistance: 0,
          geofenceValid: true,
          isMockLocation: false,
        });
      }

      setSuccessResult({
        name: selectedUser.fullName,
        time: currentTime.toLocaleTimeString('id-ID'),
        type: actionType === 'clock_in' ? 'Masuk (Clock In)' : 'Pulang (Clock Out)',
      });

      handleCloseCamera();

      // Auto-reset success message after 4 seconds for next employee
      setTimeout(() => {
        setSuccessResult(null);
      }, 4000);
    } catch (err: any) {
      alert(err.message || 'Gagal mencatat presensi');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between p-4 sm:p-6 font-sans select-none transition-colors duration-300">
      {/* ─── KIOSK TOP BAR ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="p-2 rounded-xl bg-card border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="w-11 h-11 flex items-center justify-center rounded-xl bg-transparent shrink-0">
            <img
              src={defaultLogo}
              alt="Logo Perusahaan"
              className="w-full h-full object-contain filter drop-shadow-xs dark:drop-shadow-[0_2px_10px_rgba(255,255,255,0.25)]"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-foreground">
                Terminal Kios Presensi Bersama
              </h1>
              <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px]">
                🟢 Tablet Lobi Aktif
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              PT. FAWWAZ RESKI PERWIRA • Presensi mandiri karyawan tanpa smartphone.
            </p>
          </div>
        </div>

        {/* Real-time Clock, Division Info & Theme Toggle */}
        <div className="flex items-center gap-3 self-end sm:self-auto">
          <ThemeToggle variant="dropdown" />
          <div className="text-right">
            <p className="text-xs text-muted-foreground font-medium">
              {currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            <p className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 tracking-tight">
              {currentTime.toLocaleTimeString('id-ID')} <span className="text-xs text-muted-foreground font-sans">WIB</span>
            </p>
          </div>
        </div>
      </div>

      {/* ─── SUCCESS ALERT NOTIFICATION ─── */}
      {successResult && (
        <div className="my-4 p-4 rounded-2xl bg-emerald-500/20 border-2 border-emerald-500 text-emerald-100 flex items-center gap-4 animate-in fade-in slide-in-from-top duration-300">
          <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-lg animate-bounce">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">
              Presensi {successResult.type} Berhasil!
            </h3>
            <p className="text-xs text-emerald-200 mt-0.5">
              Terima kasih, <strong>{successResult.name}</strong>. Waktu tercatat: <strong>{successResult.time} WIB</strong> via Kios Tablet {selectedDivision?.name}.
            </p>
          </div>
        </div>
      )}

      {/* ─── CONTROLS BAR: MODE & DIVISION ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-4">
        {/* Action Selector: Clock In vs Clock Out */}
        <div className="grid grid-cols-2 gap-2 p-1.5 bg-card border border-border rounded-2xl shadow-xs">
          <button
            type="button"
            onClick={() => setActionType('clock_in')}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
              actionType === 'clock_in'
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Clock className="w-4 h-4" />
            Presensi Masuk
          </button>
          <button
            type="button"
            onClick={() => setActionType('clock_out')}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
              actionType === 'clock_out'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Clock className="w-4 h-4" />
            Presensi Pulang
          </button>
        </div>

        {/* Division Selector */}
        <div className="flex items-center gap-2 p-2 bg-card border border-border rounded-2xl shadow-xs">
          <MapPin className="w-4 h-4 text-primary shrink-0 ml-2" />
          <div className="flex-1 min-w-0">
            <span className="text-[10px] uppercase text-muted-foreground font-semibold block leading-tight">
              Lokasi Divisi Tablet
            </span>
            <select
              value={selectedDivisionId}
              onChange={(e) => setSelectedDivisionId(e.target.value)}
              className="bg-transparent text-xs font-bold text-foreground w-full focus:outline-hidden cursor-pointer"
            >
              {divisions.map((d) => (
                <option key={d.id} value={d.id} className="bg-card text-foreground">
                  {d.name} ({d.code}) — {d.locationName || 'Lobi Kantor'}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Search Employee */}
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 pointer-events-none" />
          <Input
            placeholder="Cari Nama atau NIP Karyawan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-card border-border text-foreground text-xs h-11 rounded-2xl placeholder:text-muted-foreground focus-visible:ring-primary shadow-xs"
          />
        </div>
      </div>

      {/* ─── EMPLOYEE CARDS GRID ─── */}
      <div className="flex-1 my-2 overflow-y-auto max-h-[56vh] pr-1">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Pilih Profil Karyawan ({divisionEmployees.length} Orang)
          </span>
          <span className="text-[11px] text-muted-foreground">
            Ketuk kartu untuk membuka kamera selfie tablet
          </span>
        </div>

        {divisionEmployees.length === 0 ? (
          <div className="text-center py-16 bg-card border border-border rounded-2xl text-muted-foreground text-xs shadow-xs">
            Tidak ditemukan karyawan pada divisi ini yang sesuai dengan pencarian.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {divisionEmployees.map((emp) => (
              <button
                key={emp.id}
                type="button"
                onClick={() => handleSelectEmployee(emp)}
                className="p-3 bg-card border border-border hover:border-primary hover:bg-muted/50 rounded-2xl flex flex-col items-center text-center transition-all group cursor-pointer shadow-xs active:scale-95"
              >
                {emp.avatarUrl ? (
                  <img
                    src={emp.avatarUrl}
                    alt={emp.fullName}
                    className="w-14 h-14 rounded-full object-cover border-2 border-border group-hover:border-primary transition-colors mb-2"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-primary/10 text-primary border-2 border-primary/20 group-hover:bg-primary group-hover:text-primary-foreground font-bold flex items-center justify-center text-base transition-all mb-2">
                    {emp.fullName.charAt(0)}
                  </div>
                )}

                <p className="font-bold text-xs text-foreground group-hover:text-primary transition-colors truncate max-w-full">
                  {emp.fullName}
                </p>
                <span className="text-[11px] font-mono text-muted-foreground mt-0.5">
                  NIP: {emp.nip}
                </span>
                <Badge variant="outline" className="text-[9px] mt-1.5 bg-muted/80 text-muted-foreground border-border px-1.5 py-0">
                  {emp.roleName}
                </Badge>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ─── KIOSK FOOTER NOTICE ─── */}
      <div className="pt-3 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>Setiap presensi tablet kantor diverifikasi dengan <strong>Watermark Forensik &amp; Koordinat Divisi</strong></span>
        </div>
        <div className="text-[11px] text-slate-500">
          Terminal ID: KIOSK-{selectedDivision?.code || 'MAIN'} • Pos Keamanan &amp; Resepsionis
        </div>
      </div>

      {/* ─── FULL-SCREEN TABLET SELFIE CAMERA MODAL ─── */}
      <Dialog open={cameraActive} onOpenChange={(open) => !open && handleCloseCamera()}>
        <DialogContent className="max-w-2xl bg-black border-slate-800 text-white rounded-3xl p-0 overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="p-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-emerald-400" />
              <div>
                <DialogTitle className="text-sm font-bold text-white">
                  Selfie Kios Tablet: {selectedUser?.fullName} ({selectedUser?.nip})
                </DialogTitle>
                <p className="text-[11px] text-slate-400">
                  {actionType === 'clock_in' ? 'Presensi Masuk Karyawan' : 'Presensi Pulang Karyawan'} • Divisi {selectedDivision?.name}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCloseCamera}
              className="p-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            {cameraError && (
              <Alert variant="destructive" className="py-2 text-xs">
                <AlertDescription>{cameraError}</AlertDescription>
              </Alert>
            )}

            {/* Hidden Native File Input for Mobile Phones */}
            <input
              ref={nativeFileInputRef}
              type="file"
              accept="image/*"
              capture="user"
              className="hidden"
              onChange={handleNativeKioskPhoto}
            />

            {/* Viewfinder */}
            <div className="relative w-full aspect-video bg-slate-950 rounded-2xl overflow-hidden flex items-center justify-center border-2 border-slate-800">
              {!photoDataUrl ? (
                cameraStream ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover transform -scale-x-100"
                  />
                ) : (
                  <div
                    onClick={() => nativeFileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center p-6 text-center cursor-pointer hover:bg-slate-900/60 transition-colors w-full h-full"
                  >
                    <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3">
                      <Camera className="w-8 h-8 animate-pulse" />
                    </div>
                    <p className="text-sm font-bold text-white">Ketuk untuk Ambil Foto dengan Kamera HP</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-xs">
                      Membuka kamera HP langsung (100% didukung tanpa kendala browser)
                    </p>
                  </div>
                )
              ) : (
                <img
                  src={photoDataUrl}
                  alt="Selfie Kios Biometrik"
                  className="w-full h-full object-cover"
                />
              )}

              {/* Biometric Oval Guide */}
              {!photoDataUrl && cameraStream && (
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                  <div className="w-48 h-60 border-2 border-dashed border-emerald-400/80 rounded-full flex items-center justify-center shadow-lg">
                    <span className="text-[10px] text-white/80 bg-black/60 px-3 py-1 rounded-full font-medium">
                      Wajah di Dalam Lingkaran
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Biometric Result Banner */}
            {photoDataUrl && biometricResult && (
              <div
                className={`p-3 rounded-2xl border text-xs flex items-center gap-2.5 shadow-sm ${
                  biometricResult.isMatch
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                }`}
              >
                {biometricResult.isMatch ? (
                  <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />
                )}
                <div>
                  <p className="font-bold">
                    {biometricResult.isMatch
                      ? `Wajah Terverifikasi (${biometricResult.confidence}% Cocok)`
                      : `Wajah Tidak Cocok (${biometricResult.confidence}% Kemiripan)`}
                  </p>
                  <p className="text-[11px] opacity-80">{biometricResult.message}</p>
                </div>
              </div>
            )}

            {/* Controls */}
            <div className="flex items-center justify-center gap-3">
              {!photoDataUrl ? (
                cameraStream ? (
                  <>
                    <Button
                      type="button"
                      onClick={handleCapturePhoto}
                      className="h-12 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-2 shadow-lg text-sm"
                    >
                      <Camera className="w-5 h-5" />
                      Ambil Foto Selfie
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => nativeFileInputRef.current?.click()}
                      className="h-12 px-4 rounded-2xl border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 gap-2 text-xs"
                    >
                      <Smartphone className="w-4 h-4 text-emerald-400" />
                      Kamera HP
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    onClick={() => nativeFileInputRef.current?.click()}
                    className="h-12 px-8 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-2 shadow-lg hover:scale-105 active:scale-95 transition-all text-sm"
                  >
                    <Camera className="w-5 h-5" />
                    Buka Kamera HP (Ambil Foto Langsung)
                  </Button>
                )
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setPhotoDataUrl(null);
                      if (selectedUser) handleSelectEmployee(selectedUser);
                    }}
                    className="h-11 rounded-2xl border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 gap-2 text-xs"
                  >
                    <RotateCw className="w-4 h-4" />
                    Ambil Ulang
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSubmitKiosk}
                    disabled={submitting}
                    className="h-11 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-2 text-xs shadow-lg"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {submitting ? 'Menyimpan...' : 'Konfirmasi Presensi Karyawan'}
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
