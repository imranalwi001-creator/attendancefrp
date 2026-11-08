import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Clock,
  Calendar,
  CalendarDays,
  FileText,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  X,
  ShieldCheck,
  ShieldAlert,
  Smartphone,
  Mail,
  Phone,
  Maximize2,
  Coins,
  Palmtree,
  Sparkles,
  Info,
} from 'lucide-react';
import { UserProfile, AttendanceRecord } from '@/types/hrm';

interface HrmEmployeeQuickProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: {
    user: UserProfile;
    attendance?: AttendanceRecord | null;
    shift?: any;
    status?: string;
    absentSubtype?: string;
    monthlyOvertimeHours?: number;
    monthlyOvertimeCount?: number;
    todayOvertimeHours?: number;
    todayOvertimePay?: number;
    monthlyOvertimePay?: number;
    totalLateMinutes?: number;
    lateCount?: number;
    anomaly?: any;
  } | null;
  onOpenCalendar?: (user: UserProfile) => void;
  onOpenRealtimeReport?: (user: UserProfile, attendance?: AttendanceRecord | null, shift?: any) => void;
  onOpenPhotoPreview?: (photoData: {
    url: string;
    userName: string;
    userNip: string;
    time: string;
    biometricScore?: number;
    geofenceDistance?: number;
  }) => void;
}

export const HrmEmployeeQuickProfileModal: React.FC<HrmEmployeeQuickProfileModalProps> = ({
  isOpen,
  onClose,
  data,
  onOpenCalendar,
  onOpenRealtimeReport,
  onOpenPhotoPreview,
}) => {
  const [photoZoomOpen, setPhotoZoomOpen] = useState(false);

  if (!data || !data.user) return null;

  const {
    user: u,
    attendance: att,
    shift,
    status,
    absentSubtype,
    monthlyOvertimeHours = 0,
    monthlyOvertimeCount = 0,
    todayOvertimeHours = 0,
    todayOvertimePay = 0,
    monthlyOvertimePay = 0,
    anomaly,
  } = data;

  // Resolusi Foto Profil / Master Biometrik
  const rawPhoto =
    u.avatarUrl ||
    u.faceEnrolledPhoto ||
    (u as any).face_enrolled_photo ||
    (u as any).face_photo_url ||
    (u as any).facePhotoUrl ||
    att?.clockInPhoto ||
    att?.photoIn;

  const photo =
    typeof rawPhoto === 'string' &&
    (rawPhoto.startsWith('data:image/') || rawPhoto.startsWith('http') || rawPhoto.startsWith('/'))
      ? rawPhoto
      : null;

  // Tentukan Grup Lembur Sah (80 Personil Operasional)
  const isShipmentGroup =
    u.operationalGroup === 'SHIPMENT' ||
    (u.nip && u.nip.replace(/\D/g, '').length >= 5 && parseInt(u.nip.replace(/\D/g, '').slice(-3), 10) >= 34);
  const isRumahTanggaGroup =
    u.operationalGroup === 'RUMAH TANGGA' ||
    (u.nip && u.nip.replace(/\D/g, '').length >= 5 && parseInt(u.nip.replace(/\D/g, '').slice(-3), 10) <= 33);

  const groupLabel = isShipmentGroup
    ? 'Grup SHIPMENT (Plafon Lembur Rp 72 Jt)'
    : isRumahTanggaGroup
    ? 'Grup RUMAH TANGGA (Plafon Lembur Rp 4 Jt)'
    : 'Staf / Operasional Non-Lembur';

  // Kuota Cuti (Aturan Baku: 12 Hari / Tahun, Use-It-Or-Lose-It)
  const annualQuota = u.annualLeaveQuota || 12;
  const usedDays = u.usedLeaveDays || 0;
  const remainingLeaveDays = Math.max(0, annualQuota - usedDays);

  // Status Kehadiran Hari Ini
  const isLate = status === 'terlambat' || status === 'late' || (att?.lateMinutes && att.lateMinutes > 0);
  const isPresent = !!att?.clockIn;
  const isOff = absentSubtype === 'off' || shift?.name?.toLowerCase().includes('off') || shift?.name?.toLowerCase().includes('libur');

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-3xl rounded-3xl p-0 overflow-hidden border border-border/80 shadow-2xl bg-card max-h-[92vh] flex flex-col">
          {/* Header Banner Modern */}
          <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-900 text-white p-6 relative shrink-0">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/90 hover:text-white transition-colors"
              title="Tutup Modal"
            >
              <X size={18} />
            </button>

            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
              {/* Foto Profil Besar & Tajam */}
              <div className="relative group shrink-0">
                {photo ? (
                  <div
                    onClick={() => {
                      if (onOpenPhotoPreview && photo) {
                        onOpenPhotoPreview({
                          url: photo,
                          userName: u.fullName,
                          userNip: u.nip,
                          time: att?.clockIn || 'Master Wajah',
                          biometricScore: att?.biometricScore,
                          geofenceDistance: att?.clockInDistance,
                        });
                      } else {
                        setPhotoZoomOpen(true);
                      }
                    }}
                    className="relative cursor-pointer rounded-2xl overflow-hidden ring-4 ring-emerald-500/40 shadow-2xl hover:ring-emerald-400 transition-all duration-300 w-28 h-28 sm:w-32 sm:h-32 bg-slate-800"
                    title="Klik untuk memperbesar foto wajah"
                  >
                    <img
                      src={photo}
                      alt={u.fullName}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-medium gap-1">
                      <Maximize2 size={16} /> Perbesar
                    </div>
                  </div>
                ) : (
                  <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl bg-emerald-900/60 border-2 border-emerald-500/30 text-emerald-300 font-bold flex flex-col items-center justify-center shadow-xl">
                    <span className="text-4xl">{u.fullName.charAt(0)}</span>
                    <span className="text-[10px] text-emerald-400/80 mt-1 uppercase tracking-wider font-sans">
                      Tanpa Foto
                    </span>
                  </div>
                )}

                {/* Badge Status Wajah */}
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap">
                  {photo ? (
                    <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[10px] px-2 py-0.5 shadow-md flex items-center gap-1 border border-emerald-400/40">
                      <ShieldCheck size={11} /> Biometrik OK
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-600 hover:bg-amber-600 text-white text-[10px] px-2 py-0.5 shadow-md flex items-center gap-1 border border-amber-400/40">
                      <AlertTriangle size={11} /> Belum Terdaftar
                    </Badge>
                  )}
                </div>
              </div>

              {/* Data Identitas Header */}
              <div className="text-center sm:text-left space-y-1.5 flex-1 min-w-0">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <Badge variant="outline" className="bg-white/10 text-emerald-300 border-white/20 text-[11px] font-mono">
                    {u.nip || 'NIP -'}
                  </Badge>
                  <Badge variant="outline" className="bg-emerald-500/20 text-emerald-200 border-emerald-400/30 text-[11px]">
                    {u.divisionName || 'Unit Operasional'}
                  </Badge>
                  <Badge variant="outline" className="bg-blue-500/20 text-blue-200 border-blue-400/30 text-[11px]">
                    {u.roleName || (u.role === 'admin' ? 'Superadmin' : 'Karyawan')}
                  </Badge>
                </div>

                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white truncate" title={u.fullName}>
                  {u.fullName}
                </h2>

                <p className="text-xs text-emerald-200/80 font-medium">
                  {groupLabel}
                </p>

                {/* Info Kontak Cepat */}
                <div className="pt-1 flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs text-slate-300">
                  {u.email && (
                    <span className="flex items-center gap-1">
                      <Mail size={12} className="text-emerald-400" />
                      <span className="font-mono">{u.email}</span>
                    </span>
                  )}
                  {u.phone && (
                    <a
                      href={`https://wa.me/${u.phone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 hover:text-emerald-300 transition-colors"
                      title="Kirim pesan WhatsApp"
                    >
                      <Phone size={12} className="text-emerald-400" />
                      <span className="font-mono">{u.phone}</span>
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Body Konten Detail Scrollable */}
          <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1 text-xs">
            {/* 3 Kartu Metrik Utama: Jadwal Live, Lembur, Cuti */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {/* Kartu 1: Jadwal Live & Status Hari Ini */}
              <Card className="border-border/80 bg-card rounded-2xl shadow-xs overflow-hidden">
                <div className="bg-muted/50 px-4 py-2.5 border-b border-border/70 flex items-center justify-between">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <Clock size={14} className="text-primary" /> Jadwal Live Shift
                  </span>
                  {isOff ? (
                    <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300 text-[10px]">
                      Libur / OFF
                    </Badge>
                  ) : isLate ? (
                    <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 text-[10px]">
                      Terlambat
                    </Badge>
                  ) : isPresent ? (
                    <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]">
                      Hadir
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-muted text-muted-foreground border-border text-[10px]">
                      Belum Hadir
                    </Badge>
                  )}
                </div>
                <CardContent className="p-4 space-y-2.5">
                  <div>
                    <p className="text-[11px] text-muted-foreground">Shift Ditugaskan:</p>
                    <p className="font-bold text-foreground text-sm">
                      {shift?.name || (isOff ? 'Libur Terjadwal' : 'Shift Reguler')}
                    </p>
                    {shift?.start && shift?.end && (
                      <p className="font-mono text-primary font-semibold text-xs mt-0.5">
                        {shift.start} - {shift.end} WITA
                      </p>
                    )}
                  </div>

                  <div className="pt-2 border-t border-border/60 space-y-1.5 font-mono text-[11px]">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Clock-In:</span>
                      <span className="font-semibold text-foreground">
                        {att?.clockIn ? `${att.clockIn} WITA` : '-'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Clock-Out:</span>
                      <span className="font-semibold text-foreground">
                        {att?.clockOut ? `${att.clockOut} WITA` : '-'}
                      </span>
                    </div>
                    {att?.biometricScore != null && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Skor Wajah:</span>
                        <span className="font-semibold text-emerald-600">
                          {att.biometricScore}% Match
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Kartu 2: Informasi Lembur (SPKL) */}
              <Card className="border-border/80 bg-card rounded-2xl shadow-xs overflow-hidden">
                <div className="bg-muted/50 px-4 py-2.5 border-b border-border/70 flex items-center justify-between">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <Coins size={14} className="text-amber-500" /> Lembur (SPKL)
                  </span>
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">
                    Bulan Berjalan
                  </Badge>
                </div>
                <CardContent className="p-4 space-y-2.5">
                  <div>
                    <p className="text-[11px] text-muted-foreground">Total Jam Lembur:</p>
                    <div className="flex items-baseline gap-1.5 mt-0.5">
                      <span className="text-2xl font-extrabold text-foreground font-mono">
                        {monthlyOvertimeHours.toFixed(1)}
                      </span>
                      <span className="text-xs text-muted-foreground">Jam</span>
                      <span className="text-[11px] text-muted-foreground ml-auto font-mono">
                        ({monthlyOvertimeCount}x Penugasan)
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border/60 space-y-1 text-[11px]">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Lembur Hari Ini:</span>
                      <span className="font-semibold text-foreground font-mono">
                        {todayOvertimeHours > 0 ? `+${todayOvertimeHours.toFixed(1)} Jam` : '-'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Estimasi Upah:</span>
                      <span className="font-semibold text-amber-600 font-mono">
                        {monthlyOvertimePay > 0
                          ? `Rp ${Math.round(monthlyOvertimePay).toLocaleString('id-ID')}`
                          : 'Rp 0'}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground/80 italic mt-1">
                      *Hak lembur berlaku bagi 80 personil sah operasional/lapangan FRP.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Kartu 3: Informasi Cuti (Quota Tracking) */}
              <Card className="border-border/80 bg-card rounded-2xl shadow-xs overflow-hidden">
                <div className="bg-muted/50 px-4 py-2.5 border-b border-border/70 flex items-center justify-between">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <Palmtree size={14} className="text-emerald-600" /> Hak Cuti Tahunan
                  </span>
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                    Use-It-Or-Lose-It
                  </Badge>
                </div>
                <CardContent className="p-4 space-y-2.5">
                  <div>
                    <p className="text-[11px] text-muted-foreground">Sisa Kuota Cuti:</p>
                    <div className="flex items-baseline gap-1.5 mt-0.5">
                      <span className="text-2xl font-extrabold text-emerald-600 font-mono">
                        {remainingLeaveDays}
                      </span>
                      <span className="text-xs text-muted-foreground">/ {annualQuota} Hari</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border/60 space-y-1 text-[11px]">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Cuti Terpakai:</span>
                      <span className="font-semibold text-foreground font-mono">
                        {usedDays} Hari
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Kompensasi Kas:</span>
                      <span className="font-semibold text-rose-600 text-[10px]">
                        Tidak Dapat Diuangkan
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground/80 italic mt-1">
                      *Hak cuti yang tidak diambil hangus di akhir periode tahunan.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Informasi Lokasi Pos Penugasan & Telemetri Forensik */}
            <Card className="border-border/80 bg-card rounded-2xl shadow-xs">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
                    <MapPin size={14} className="text-rose-500" /> Pos &amp; Wilayah Tugas Resmi
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Area Geofence Terikat
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-muted/30 p-3 rounded-xl border border-border/60">
                  <div>
                    <p className="text-[11px] text-muted-foreground">Pos / Lokasi Aktif:</p>
                    <p className="font-semibold text-foreground text-xs mt-0.5">
                      {u.currentActivePostName || u.assignedLocationName || att?.locationName || 'Wilayah Divisi / Sesuai Roster'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Status Perimeter:</p>
                    <p className="font-semibold text-xs mt-0.5 flex items-center gap-1 text-emerald-600">
                      <CheckCircle2 size={13} /> Patuh Dalam Radius Resmi
                    </p>
                  </div>
                  {u.registeredDeviceId && (
                    <div className="sm:col-span-2 flex items-center gap-2 pt-1 border-t border-border/50 text-[11px] text-muted-foreground">
                      <Smartphone size={13} />
                      <span>Device Terdaftar: <span className="font-mono text-foreground">{u.deviceModel || u.registeredDeviceId.slice(0, 16)}...</span></span>
                    </div>
                  )}
                </div>

                {anomaly && (
                  <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 flex items-start gap-2 text-rose-800 dark:text-rose-200 text-[11px]">
                    <ShieldAlert size={14} className="text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Peringatan Radar / Anomali Terdeteksi:</p>
                      <p className="text-[10px]">{anomaly.message || 'Perlu verifikasi manual oleh admin.'}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Footer Tombol Aksi Cepat */}
          <div className="p-4 bg-muted/40 border-t border-border/70 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="text-[11px] text-muted-foreground hidden sm:block">
              PT. FAWWAZ RESKI PERWIRA • Sistem Presensi Forensik
            </div>

            <div className="flex items-center gap-2 ml-auto">
              {onOpenCalendar && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onClose();
                    onOpenCalendar(u);
                  }}
                  className="rounded-xl text-xs gap-1.5 h-8 border-border hover:bg-muted"
                >
                  <CalendarDays size={13} className="text-primary" />
                  Kalender Presensi
                </Button>
              )}

              {onOpenRealtimeReport && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onClose();
                    onOpenRealtimeReport(u, att, shift);
                  }}
                  className="rounded-xl text-xs gap-1.5 h-8 border-border hover:bg-muted"
                >
                  <FileText size={13} className="text-emerald-600" />
                  Laporan Realtime
                </Button>
              )}

              <Button
                size="sm"
                variant="default"
                onClick={onClose}
                className="rounded-xl text-xs h-8 px-4"
              >
                Tutup
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Zoom Foto Master Full Resolusi */}
      {photoZoomOpen && photo && (
        <Dialog open={photoZoomOpen} onOpenChange={setPhotoZoomOpen}>
          <DialogContent className="max-w-md rounded-2xl p-4 border border-border shadow-2xl bg-card text-center">
            <DialogHeader>
              <DialogTitle className="text-sm font-bold text-foreground">
                Foto Wajah Master: {u.fullName}
              </DialogTitle>
              <DialogDescription className="text-xs font-mono text-muted-foreground">
                NIP: {u.nip} • {u.divisionName}
              </DialogDescription>
            </DialogHeader>
            <div className="my-3 rounded-xl overflow-hidden bg-slate-900 border border-border">
              <img src={photo} alt={u.fullName} className="w-full h-auto max-h-[60vh] object-contain mx-auto" />
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setPhotoZoomOpen(false)} className="rounded-xl text-xs">
                Tutup
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};
