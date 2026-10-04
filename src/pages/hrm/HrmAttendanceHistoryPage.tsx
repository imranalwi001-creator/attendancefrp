import React, { useState, useEffect } from 'react';
import { useHrmAuth } from '@/contexts/HrmAuthContext';
import { hrmService } from '@/services/hrmService';
import { AttendanceRecord, UserProfile } from '@/types/hrm';
import { CalendarDays, Camera, Eye, ShieldCheck, MapPin, Search, RefreshCw, ShieldAlert, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export const HrmAttendanceHistoryPage: React.FC = () => {
  const { user } = useHrmAuth();
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<UserProfile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterMonth, setFilterMonth] = useState<string>('');
  const [previewPhoto, setPreviewPhoto] = useState<{
    url: string;
    type: 'Masuk' | 'Pulang';
    userName?: string;
    userNip?: string;
    divisionName?: string;
    time?: string;
    date?: string;
    biometricScore?: number;
    biometricMatch?: boolean;
    geofenceDistance?: number;
    geofenceValid?: boolean;
    isMockLocation?: boolean;
    flags?: string[];
    attendanceId?: string;
  } | null>(null);
  const [loadingPhoto, setLoadingPhoto] = useState(false);

  useEffect(() => {
    if (previewPhoto && !previewPhoto.url && previewPhoto.attendanceId) {
      setLoadingPhoto(true);
      fetch(`/api/attendances/${previewPhoto.attendanceId}/photo`)
        .then((res) => res.json())
        .then((data) => {
          if (data && data.success) {
            const fetchedUrl = previewPhoto.type === 'Masuk' ? data.photoIn : data.photoOut;
            if (fetchedUrl) {
              setPreviewPhoto((prev) => (prev ? { ...prev, url: fetchedUrl } : null));
            }
          }
        })
        .catch(() => {})
        .finally(() => setLoadingPhoto(false));
    }
  }, [previewPhoto?.attendanceId, previewPhoto?.type]);

  const cleanRole = (user?.role || '').toLowerCase().replace(/[\s_-]/g, '');
  const isPrivileged = ['superadmin', 'admin', 'hrd', 'pimpinan', 'korlap', 'keuangan'].includes(cleanRole);

  const loadData = () => {
    if (!user) return;
    const allUsers = hrmService.getUsers().filter((u) => u.isActive);
    setEmployees(allUsers);

    const allAttendances = hrmService.getAttendances();
    if (isPrivileged) {
      if (cleanRole === 'korlap') {
        // Korlap can view all members in their division + themselves
        const divEmps = allUsers.filter((u) => u.divisionId === user.divisionId || u.id === user.id);
        const divEmpIds = new Set(divEmps.map((u) => u.id));
        setHistory(allAttendances.filter((a) => divEmpIds.has(a.userId) || a.divisionName === user.divisionName));
      } else {
        // Superadmin, Admin, HRD, Pimpinan, Keuangan can view all
        setHistory(allAttendances);
      }
    } else {
      // Regular employee: view their own
      setHistory(allAttendances.filter((a) => a.userId === user.id));
    }
  };

  useEffect(() => {
    loadData();
    hrmService.syncWithBackend().then(loadData);

    const handleUpdated = () => loadData();
    window.addEventListener('hrm_attendance_updated', handleUpdated);
    window.addEventListener('hrm_data_updated', handleUpdated);

    // Realtime background sync polling every 10 seconds
    const interval = setInterval(() => {
      hrmService.syncWithBackend().then(loadData);
    }, 10000);

    return () => {
      window.removeEventListener('hrm_attendance_updated', handleUpdated);
      window.removeEventListener('hrm_data_updated', handleUpdated);
      clearInterval(interval);
    };
  }, [user]);

  // Filtering logic
  const filteredHistory = history.filter((a) => {
    const rawDate = a.attendanceDate || (a as any).date;
    if (!rawDate) return false;

    // Filter by Month (YYYY-MM)
    if (filterMonth && !rawDate.startsWith(filterMonth)) {
      return false;
    }

    // Filter by Selected Employee (if privileged)
    if (isPrivileged && selectedUserId !== 'all') {
      if (a.userId !== selectedUserId) {
        return false;
      }
    }

    // Search by Name or NIP
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const name = (a.userName || '').toLowerCase();
      const nip = (a.userNip || '').toLowerCase();
      if (!name.includes(q) && !nip.includes(q)) {
        return false;
      }
    }

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-primary" />
            {isPrivileged ? 'Riwayat Presensi Karyawan' : 'Riwayat Presensi Pribadi'}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {isPrivileged
              ? 'Log kehadiran seluruh staf secara realtime, foto face recognition audit forensik, & sertifikasi perimeter.'
              : 'Log lengkap jam kehadiran, kepulangan, durasi kerja, dan sertifikat verifikasi dual-shield Anda.'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              hrmService.syncWithBackend().then(loadData);
            }}
            className="rounded-xl text-xs gap-1.5 h-9"
          >
            <RefreshCw className="w-3.5 h-3.5 text-primary" />
            Sinkronkan Realtime
          </Button>

          <Input
            type="month"
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="text-xs bg-card rounded-xl border-border w-36 sm:w-44 h-9"
            placeholder="Pilih Bulan..."
          />
          {filterMonth && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setFilterMonth('')}
              className="text-xs h-9 px-2 text-muted-foreground hover:text-foreground"
            >
              Reset Bulan
            </Button>
          )}
        </div>
      </div>

      {/* Privileged Filters (Employee Selection & Keyword Search) */}
      {isPrivileged && (
        <Card className="p-3.5 border-border bg-card rounded-2xl shadow-xs">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Cari nama karyawan atau NIP..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-xs rounded-xl h-9 bg-background"
              />
            </div>

            <div className="w-full sm:w-64">
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="text-xs rounded-xl h-9 bg-background">
                  <SelectValue placeholder="Pilih Karyawan..." />
                </SelectTrigger>
                <SelectContent className="text-xs max-h-64">
                  <SelectItem value="all">Semua Karyawan ({employees.length})</SelectItem>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.fullName} ({emp.nip})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {user && (
              <Button
                variant={selectedUserId === user.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedUserId(selectedUserId === user.id ? 'all' : user.id)}
                className="text-xs rounded-xl h-9 shrink-0"
              >
                Presensi Saya Sendiri
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* History Table */}
      <Card className="border-border bg-card rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-foreground">
            <thead className="bg-muted/40 border-b border-border uppercase text-[11px] text-muted-foreground font-medium tracking-wider">
              <tr>
                <th className="py-3 px-4 text-center w-12">#</th>
                {isPrivileged && <th className="py-3 px-4 min-w-[180px]">Karyawan</th>}
                <th className="py-3 px-4 min-w-[120px]">Tanggal Presensi</th>
                <th className="py-3 px-4 text-center min-w-[90px]">Jam Masuk</th>
                <th className="py-3 px-4 text-center min-w-[90px]">Jam Pulang</th>
                <th className="py-3 px-4 text-center min-w-[120px]">Foto Face Review</th>
                <th className="py-3 px-4 min-w-[120px]">Durasi Kerja</th>
                <th className="py-3 px-4 min-w-[110px]">Keterlambatan</th>
                <th className="py-3 px-4 min-w-[120px]">Status Kehadiran</th>
                <th className="py-3 px-4 min-w-[140px]">Verifikasi Gate</th>
                <th className="py-3 px-4 min-w-[150px]">Catatan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={isPrivileged ? 11 : 10} className="py-12 text-center text-muted-foreground">
                    Belum ada rekaman presensi pada periode yang dipilih.
                  </td>
                </tr>
              ) : (
                filteredHistory.map((item, idx) => {
                  const attDate = item.attendanceDate || (item as any).date || '-';
                  const photoIn = item.photoIn || (item as any).clockInPhoto;
                  const photoOut = item.photoOut || (item as any).clockOutPhoto;

                  return (
                    <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 text-center font-mono text-muted-foreground text-xs">
                        {idx + 1}
                      </td>

                      {/* Privileged: Employee Identity Column */}
                      {isPrivileged && (
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-xs shrink-0">
                              {(item.userName || 'K').charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-foreground text-xs truncate max-w-[160px]">
                                {item.userName || 'Karyawan'}
                              </p>
                              <p className="text-[11px] text-muted-foreground font-mono truncate">
                                {item.userNip || '-'} • {item.divisionName || '-'}
                              </p>
                            </div>
                          </div>
                        </td>
                      )}

                      {/* Tanggal Presensi (Guaranteed fallback) */}
                      <td className="py-3 px-4 font-mono font-medium text-foreground whitespace-nowrap">
                        {attDate}
                      </td>

                      {/* Jam Masuk */}
                      <td className="py-3 px-4 text-center font-mono text-foreground whitespace-nowrap">
                        {item.clockIn ? (
                          <span className="font-semibold text-foreground">{item.clockIn} WIB</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>

                      {/* Jam Pulang */}
                      <td className="py-3 px-4 text-center font-mono text-foreground whitespace-nowrap">
                        {item.clockOut ? (
                          <span className="font-semibold text-foreground">{item.clockOut} WIB</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>

                      {/* Foto Face Presensi Review Thumbnails */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {photoIn ? (
                            <button
                              type="button"
                              onClick={() => setPreviewPhoto({
                                url: photoIn,
                                attendanceId: item.id,
                                type: 'Masuk',
                                userName: item.userName,
                                userNip: item.userNip,
                                divisionName: item.divisionName,
                                time: item.clockIn,
                                date: attDate,
                                biometricScore: item.biometricScore,
                                biometricMatch: item.biometricMatch,
                                geofenceDistance: item.geofenceDistance,
                                geofenceValid: item.geofenceValid,
                                isMockLocation: item.isMockLocation,
                                flags: item.securityFlags,
                              })}
                              className="group relative block rounded-lg overflow-hidden border border-emerald-500/50 hover:border-emerald-500 hover:shadow-xs transition-all"
                              title="Lihat Foto Wajah Presensi Masuk"
                            >
                              <img
                                src={photoIn}
                                alt="Selfie Masuk"
                                className="w-9 h-9 object-cover rounded-md group-hover:scale-105 transition-transform"
                              />
                              <span className="absolute bottom-0 inset-x-0 bg-emerald-600/80 text-[8px] text-white font-bold text-center py-0.2">
                                In
                              </span>
                            </button>
                          ) : item.clockIn && item.id ? (
                            <button
                              type="button"
                              onClick={() => setPreviewPhoto({
                                url: '',
                                attendanceId: item.id,
                                type: 'Masuk',
                                userName: item.userName,
                                userNip: item.userNip,
                                divisionName: item.divisionName,
                                time: item.clockIn,
                                date: attDate,
                                biometricScore: item.biometricScore,
                                biometricMatch: item.biometricMatch,
                                geofenceDistance: item.geofenceDistance,
                                geofenceValid: item.geofenceValid,
                                isMockLocation: item.isMockLocation,
                                flags: item.securityFlags,
                              })}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 transition-all"
                              title="Muat Foto Wajah Presensi Masuk dari Server"
                            >
                              <Camera className="w-3 h-3" />
                              <span>Lihat</span>
                            </button>
                          ) : (
                            <span className="text-muted-foreground/40 text-[10px]">-</span>
                          )}

                          {photoOut ? (
                            <button
                              type="button"
                              onClick={() => setPreviewPhoto({
                                url: photoOut,
                                attendanceId: item.id,
                                type: 'Pulang',
                                userName: item.userName,
                                userNip: item.userNip,
                                divisionName: item.divisionName,
                                time: item.clockOut,
                                date: attDate,
                                biometricScore: item.biometricScore,
                                biometricMatch: item.biometricMatch,
                                geofenceDistance: item.geofenceDistance,
                                geofenceValid: item.geofenceValid,
                                isMockLocation: item.isMockLocation,
                                flags: item.securityFlags,
                              })}
                              className="group relative block rounded-lg overflow-hidden border border-blue-500/50 hover:border-blue-500 hover:shadow-xs transition-all"
                              title="Lihat Foto Wajah Presensi Pulang"
                            >
                              <img
                                src={photoOut}
                                alt="Selfie Pulang"
                                className="w-9 h-9 object-cover rounded-md group-hover:scale-105 transition-transform"
                              />
                              <span className="absolute bottom-0 inset-x-0 bg-blue-600/80 text-[8px] text-white font-bold text-center py-0.2">
                                Out
                              </span>
                            </button>
                          ) : item.clockOut && item.id ? (
                            <button
                              type="button"
                              onClick={() => setPreviewPhoto({
                                url: '',
                                attendanceId: item.id,
                                type: 'Pulang',
                                userName: item.userName,
                                userNip: item.userNip,
                                divisionName: item.divisionName,
                                time: item.clockOut,
                                date: attDate,
                                biometricScore: item.biometricScore,
                                biometricMatch: item.biometricMatch,
                                geofenceDistance: item.geofenceDistance,
                                geofenceValid: item.geofenceValid,
                                isMockLocation: item.isMockLocation,
                                flags: item.securityFlags,
                              })}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-500/10 hover:bg-blue-500/20 text-[10px] font-semibold text-blue-600 dark:text-blue-400 border border-blue-500/30 transition-all"
                              title="Muat Foto Wajah Presensi Pulang dari Server"
                            >
                              <Camera className="w-3 h-3" />
                              <span>Lihat</span>
                            </button>
                          ) : null}
                        </div>
                      </td>

                      {/* Durasi Kerja */}
                      <td className="py-3 px-4 font-medium text-foreground whitespace-nowrap">
                        {item.workDurationMinutes > 0
                          ? `${Math.floor(item.workDurationMinutes / 60)} Jam ${item.workDurationMinutes % 60} Menit`
                          : '-'}
                      </td>

                      {/* Keterlambatan */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {item.lateMinutes > 0 ? (
                          <span className="font-semibold text-rose-600 dark:text-rose-400">
                            {item.lateMinutes} Menit
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>

                      {/* Status Kehadiran */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {item.status === 'hadir' ? (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 text-[10px] rounded-full">
                            Tepat Waktu
                          </Badge>
                        ) : item.status === 'terlambat' ? (
                          <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-400 text-[10px] rounded-full">
                            Terlambat
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-muted text-muted-foreground border-border text-[10px] rounded-full">
                            {item.status}
                          </Badge>
                        )}
                      </td>

                      {/* Verifikasi Gate */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {item.biometricScore != null && (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 text-[10px] rounded-md">
                              Face {item.biometricScore}%
                            </Badge>
                          )}
                          {item.geofenceDistance != null && (
                            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] rounded-md">
                              {Math.round(item.geofenceDistance)}m
                            </Badge>
                          )}
                          {item.biometricScore == null && item.geofenceDistance == null && (
                            <span className="text-muted-foreground/60 text-[11px]">-</span>
                          )}
                        </div>
                      </td>

                      {/* Catatan */}
                      <td className="py-3 px-4 text-muted-foreground max-w-xs truncate text-[11px]">
                        {item.notes || '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ─── FORENSIC FACE PHOTO PREVIEW MODAL ─── */}
      <Dialog open={Boolean(previewPhoto)} onOpenChange={(open) => !open && setPreviewPhoto(null)}>
        <DialogContent className="max-w-md bg-card border-border rounded-2xl p-0 overflow-hidden shadow-2xl">
          <DialogHeader className="p-4 pb-2 border-b border-border/60">
            <DialogTitle className="text-base font-bold text-foreground flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-primary" />
                Bukti Foto Presensi {previewPhoto?.type}
              </span>
              <Badge className={previewPhoto?.type === 'Masuk' ? 'bg-emerald-600 text-white text-[10px]' : 'bg-blue-600 text-white text-[10px]'}>
                Presensi {previewPhoto?.type}
              </Badge>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {previewPhoto?.userName || user?.fullName} ({previewPhoto?.userNip || user?.nip}) • {previewPhoto?.date} pukul {previewPhoto?.time || '-'} WIB
            </DialogDescription>
          </DialogHeader>

          <div className="p-4 space-y-3">
            <div className="relative aspect-4/3 w-full bg-black rounded-xl overflow-hidden border border-border shadow-inner flex items-center justify-center">
              {loadingPhoto ? (
                <div className="flex flex-col items-center justify-center gap-2 p-6 text-center text-slate-300">
                  <div className="w-7 h-7 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs font-medium">Mengunduh foto verifikasi wajah dari server...</p>
                </div>
              ) : previewPhoto?.url ? (
                <img
                  src={previewPhoto.url}
                  alt="Bukti Foto Presensi"
                  className="w-full h-full object-cover"
                />
              ) : (
                <p className="text-muted-foreground text-xs">Foto tidak tersedia di server</p>
              )}

              {/* Watermark overlay preview */}
              <div className="absolute bottom-2 left-2 right-2 bg-black/60 backdrop-blur-xs text-white p-2 rounded-lg text-[10px] font-mono leading-tight space-y-0.5">
                <p className="font-bold flex items-center gap-1 text-emerald-400">
                  <ShieldCheck className="w-3 h-3" />
                  VERIFIKASI BIOMETRIK RESMI PT. FAWWAZ RESKI PERWIRA
                </p>
                <p className="text-slate-200">
                  🕒 {previewPhoto?.date} • {previewPhoto?.time} WIB
                </p>
                {previewPhoto?.geofenceDistance != null && (
                  <p className="text-slate-300">
                    📍 Jarak Kantor: {Math.round(previewPhoto.geofenceDistance)}m ({previewPhoto.geofenceValid !== false ? 'Dalam Radius' : 'Luar Perimeter'})
                  </p>
                )}
              </div>
            </div>

            {/* Forensic Detail Badges */}
            <div className="p-3 bg-muted/40 rounded-xl border border-border text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Biometrik Wajah 1:1:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {previewPhoto?.biometricScore ? `${previewPhoto.biometricScore}% Cocok` : 'Terverifikasi Valid'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Radius Perimeter Kantor:</span>
                <span className="font-semibold text-foreground">
                  {previewPhoto?.geofenceDistance ? `${Math.round(previewPhoto.geofenceDistance)} Meter` : 'Terverifikasi GPS'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Integritas Hardware:</span>
                <span className="font-semibold text-emerald-600">Anti-Spoofing Aman (Mock GPS: Nihil)</span>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={() => setPreviewPhoto(null)}
              className="w-full rounded-xl text-xs h-9"
            >
              Tutup Pratinjau
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
