import React, { useState, useEffect } from 'react';
import { hrmService, getTodayDateStr } from '@/services/hrmService';
import { AttendanceRecord, AttendanceStatus, UserProfile } from '@/types/hrm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileEdit,
  Plus,
  Search,
  Filter,
  Camera,
  MapPin,
  RefreshCw,
  Users,
  ShieldCheck,
} from 'lucide-react';

export const HrmPresensiManagementTab: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateStr());
  const [selectedDivision, setSelectedDivision] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [divisions, setDivisions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Correction Modal State
  const [correctModalOpen, setCorrectModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const [editStatus, setEditStatus] = useState<AttendanceStatus>('hadir');
  const [editClockIn, setEditClockIn] = useState<string>('');
  const [editClockOut, setEditClockOut] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');
  const [editLateMinutes, setEditLateMinutes] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Manual Entry Modal State
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [manualUserId, setManualUserId] = useState<string>('');
  const [manualDate, setManualDate] = useState<string>(getTodayDateStr());
  const [manualStatus, setManualStatus] = useState<AttendanceStatus>('hadir');
  const [manualClockIn, setManualClockIn] = useState<string>('07:30');
  const [manualClockOut, setManualClockOut] = useState<string>('16:30');
  const [manualNotes, setManualNotes] = useState<string>('');

  // Photo Preview Modal
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);

  const loadData = () => {
    setIsLoading(true);
    const uList = hrmService.getUsers();
    setUsers(uList);
    setDivisions(hrmService.getDivisions());

    const atts = hrmService.getAttendances(selectedDate);
    setAttendances(atts);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
    const handleSync = () => loadData();
    window.addEventListener('hrm_attendance_updated', handleSync);
    window.addEventListener('hrm_data_updated', handleSync);
    return () => {
      window.removeEventListener('hrm_attendance_updated', handleSync);
      window.removeEventListener('hrm_data_updated', handleSync);
    };
  }, [selectedDate]);

  // Filter attendances
  const filteredAttendances = attendances.filter((att) => {
    const user = users.find((u) => u.id === att.userId);
    const userName = att.userName || user?.fullName || '';
    const userNip = att.userNip || user?.nip || '';
    const userDiv = att.divisionName || user?.divisionName || user?.division || '';

    const matchesSearch =
      userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      userNip.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesDivision =
      selectedDivision === 'all' ||
      userDiv.toLowerCase() === selectedDivision.toLowerCase();

    const matchesStatus =
      statusFilter === 'all' || att.status === statusFilter;

    return matchesSearch && matchesDivision && matchesStatus;
  });

  // Calculate Metrics
  const totalAtt = attendances.length;
  const onTimeCount = attendances.filter((a) => a.status === 'hadir').length;
  const lateCount = attendances.filter((a) => a.status === 'terlambat').length;
  const leaveCount = attendances.filter((a) => a.status === 'izin' || a.status === 'cuti' || a.status === 'sakit').length;
  const alphaCount = attendances.filter((a) => a.status === 'alpha').length;

  const handleOpenCorrect = (rec: AttendanceRecord) => {
    setSelectedRecord(rec);
    setEditStatus(rec.status);
    setEditClockIn(rec.clockIn ? rec.clockIn.substring(0, 5) : '07:30');
    setEditClockOut(rec.clockOut ? rec.clockOut.substring(0, 5) : '16:30');
    setEditNotes(rec.notes || '');
    setEditLateMinutes(rec.lateMinutes || 0);
    setCorrectModalOpen(true);
  };

  const handleSaveCorrection = async () => {
    if (!selectedRecord) return;
    setIsSubmitting(true);
    try {
      const res = await hrmService.correctAttendance(selectedRecord.id, {
        status: editStatus,
        clockIn: editClockIn ? `${editClockIn}:00` : undefined,
        clockOut: editClockOut ? `${editClockOut}:00` : undefined,
        notes: editNotes,
        lateMinutes: editStatus === 'terlambat' ? Number(editLateMinutes) : 0,
      });

      if (res.success) {
        toast.success('Data presensi berhasil dikoreksi dan disinkronkan ke PostgreSQL & PWA Karyawan.');
        setCorrectModalOpen(false);
        loadData();
      } else {
        toast.error(res.error || 'Gagal menyimpan koreksi presensi');
      }
    } catch (err: any) {
      toast.error('Terjadi kesalahan sistem saat menyimpan');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveManualEntry = async () => {
    if (!manualUserId) {
      toast.error('Pilih karyawan terlebih dahulu');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await hrmService.addManualAttendance({
        userId: manualUserId,
        attendanceDate: manualDate,
        status: manualStatus,
        clockIn: manualClockIn ? `${manualClockIn}:00` : '07:30:00',
        clockOut: manualClockOut ? `${manualClockOut}:00` : '16:30:00',
        notes: manualNotes || 'Input manual oleh Superadmin',
        lateMinutes: manualStatus === 'terlambat' ? 15 : 0,
      });

      if (res.success) {
        toast.success('Data presensi manual berhasil dicatat di database.');
        setManualModalOpen(false);
        setManualNotes('');
        loadData();
      } else {
        toast.error(res.error || 'Gagal menyimpan presensi manual');
      }
    } catch (err: any) {
      toast.error('Terjadi kesalahan saat memproses');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: AttendanceStatus) => {
    switch (status) {
      case 'hadir':
        return <Badge className="bg-emerald-600 text-white hover:bg-emerald-700 text-[11px]">Tepat Waktu</Badge>;
      case 'terlambat':
        return <Badge className="bg-amber-500 text-white hover:bg-amber-600 text-[11px]">Terlambat</Badge>;
      case 'izin':
      case 'cuti':
      case 'sakit':
        return <Badge className="bg-sky-500 text-white hover:bg-sky-600 text-[11px] capitalize">{status}</Badge>;
      case 'alpha':
        return <Badge variant="destructive" className="text-[11px]">Alpha</Badge>;
      default:
        return <Badge variant="outline" className="text-[11px]">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Metric Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <Card className="border-border bg-card shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Total Tercatat</p>
              <p className="text-xl font-bold text-foreground">{totalAtt}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Tepat Waktu</p>
              <p className="text-xl font-bold text-emerald-600">{onTimeCount}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Terlambat</p>
              <p className="text-xl font-bold text-amber-600">{lateCount}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-600 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Izin / Cuti</p>
              <p className="text-xl font-bold text-sky-600">{leaveCount}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Alpha / Mangkir</p>
              <p className="text-xl font-bold text-rose-600">{alphaCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Action Header */}
      <Card className="border-border bg-card shadow-xs">
        <CardHeader className="pb-3 border-b border-border">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                Manajemen Data Presensi & Kehadiran
              </CardTitle>
              <CardDescription className="text-xs">
                Kelola, verifikasi biometrik, dan koreksi data kehadiran seluruh karyawan secara terpusat.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadData}
                disabled={isLoading}
                className="h-8 text-xs rounded-xl gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                Sinkronkan
              </Button>
              <Button
                size="sm"
                onClick={() => setManualModalOpen(true)}
                className="h-8 text-xs rounded-xl bg-primary text-primary-foreground font-semibold gap-1.5 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                Tambah Presensi Manual
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-4 space-y-4">
          {/* Controls Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Cari nama atau NIP..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs rounded-xl"
              />
            </div>

            <div>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-9 text-xs rounded-xl"
              />
            </div>

            <div>
              <Select value={selectedDivision} onValueChange={setSelectedDivision}>
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue placeholder="Pilih Divisi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Divisi</SelectItem>
                  {divisions.map((d) => (
                    <SelectItem key={d.id || d.name} value={d.name}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue placeholder="Status Kehadiran" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="hadir">Tepat Waktu</SelectItem>
                  <SelectItem value="terlambat">Terlambat</SelectItem>
                  <SelectItem value="izin">Izin</SelectItem>
                  <SelectItem value="sakit">Sakit</SelectItem>
                  <SelectItem value="alpha">Alpha</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Attendances Table */}
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-foreground">
                <thead className="bg-muted/40 border-b border-border uppercase text-[11px] text-muted-foreground font-semibold">
                  <tr>
                    <th className="py-3 px-4">Karyawan</th>
                    <th className="py-3 px-4">Divisi</th>
                    <th className="py-3 px-4 text-center">Jam Masuk</th>
                    <th className="py-3 px-4 text-center">Jam Pulang</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Biometrik</th>
                    <th className="py-3 px-4">Titik Pos / Catatan</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredAttendances.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-muted-foreground">
                        Tidak ada catatan presensi yang sesuai pada tanggal {selectedDate}.
                      </td>
                    </tr>
                  ) : (
                    filteredAttendances.map((att) => {
                      const user = users.find((u) => u.id === att.userId);
                      const photoUrl = att.clockInPhoto || att.photoIn;
                      return (
                        <tr key={att.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              {photoUrl ? (
                                <img
                                  src={photoUrl}
                                  alt="Selfie"
                                  onClick={() => setPhotoPreviewUrl(photoUrl)}
                                  className="w-8 h-8 rounded-full object-cover border border-primary/30 cursor-pointer hover:opacity-80 shrink-0"
                                  title="Klik untuk melihat foto selfie"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-xs shrink-0">
                                  {(att.userName || user?.fullName || 'K').charAt(0)}
                                </div>
                              )}
                              <div>
                                <p className="font-semibold text-foreground">{att.userName || user?.fullName || 'Karyawan'}</p>
                                <p className="text-[10px] text-muted-foreground font-mono">{att.userNip || user?.nip || '-'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                            {att.divisionName || user?.divisionName || user?.division || '-'}
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-medium text-foreground">
                            {att.clockIn ? att.clockIn.substring(0, 5) : '-'}
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-medium text-foreground">
                            {att.clockOut ? att.clockOut.substring(0, 5) : '-'}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            {getStatusBadge(att.status)}
                            {att.lateMinutes && att.lateMinutes > 0 ? (
                              <p className="text-[10px] text-amber-600 font-mono mt-0.5">+{att.lateMinutes}m</p>
                            ) : null}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {att.biometricScore != null ? (
                              <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-300">
                                {Math.round(att.biometricScore * (att.biometricScore <= 1 ? 100 : 1))}% Match
                              </Badge>
                            ) : (
                              <span className="text-[11px] text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4 max-w-xs truncate text-[11px] text-muted-foreground">
                            {att.notes || (att.locationStatus === 'inside' ? 'Dalam radius pos kantor' : 'Presensi GPS')}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenCorrect(att)}
                              className="h-7 text-[11px] rounded-lg gap-1 px-2.5"
                            >
                              <FileEdit className="w-3 h-3 text-primary" />
                              Koreksi
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modal Koreksi Presensi */}
      <Dialog open={correctModalOpen} onOpenChange={setCorrectModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <FileEdit className="w-4 h-4 text-primary" />
              Koreksi Data Presensi Karyawan
            </DialogTitle>
            <DialogDescription className="text-xs">
              Ubah jam kehadiran, status absensi, atau berikan catatan dispensasi khusus pimpinan.
            </DialogDescription>
          </DialogHeader>

          {selectedRecord && (
            <div className="space-y-4 py-2 text-xs">
              <div className="p-3 bg-muted/40 rounded-xl border border-border">
                <p className="font-semibold text-sm text-foreground">{selectedRecord.userName}</p>
                <p className="text-muted-foreground font-mono text-[11px]">NIP: {selectedRecord.userNip || '-'} • Tanggal: {selectedRecord.date || selectedDate}</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Status Presensi</Label>
                <Select value={editStatus} onValueChange={(val: AttendanceStatus) => setEditStatus(val)}>
                  <SelectTrigger className="h-9 text-xs rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hadir">Hadir Tepat Waktu</SelectItem>
                    <SelectItem value="terlambat">Terlambat</SelectItem>
                    <SelectItem value="izin">Izin</SelectItem>
                    <SelectItem value="sakit">Sakit</SelectItem>
                    <SelectItem value="cuti">Cuti</SelectItem>
                    <SelectItem value="alpha">Alpha (Mangkir)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Jam Masuk</Label>
                  <Input
                    type="time"
                    value={editClockIn}
                    onChange={(e) => setEditClockIn(e.target.value)}
                    className="h-9 text-xs rounded-xl font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Jam Pulang</Label>
                  <Input
                    type="time"
                    value={editClockOut}
                    onChange={(e) => setEditClockOut(e.target.value)}
                    className="h-9 text-xs rounded-xl font-mono"
                  />
                </div>
              </div>

              {editStatus === 'terlambat' && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Menit Keterlambatan</Label>
                  <Input
                    type="number"
                    value={editLateMinutes}
                    onChange={(e) => setEditLateMinutes(Number(e.target.value))}
                    className="h-9 text-xs rounded-xl font-mono"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Catatan Koreksi / Alasan Dispensasi</Label>
                <Input
                  placeholder="Contoh: Koreksi absensi karena dinas luar atas instruksi Direktur..."
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="h-9 text-xs rounded-xl"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setCorrectModalOpen(false)} className="rounded-xl">
              Batal
            </Button>
            <Button
              size="sm"
              onClick={handleSaveCorrection}
              disabled={isSubmitting}
              className="rounded-xl bg-primary text-primary-foreground font-semibold"
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan Koreksi'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Tambah Presensi Manual */}
      <Dialog open={manualModalOpen} onOpenChange={setManualModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Plus className="w-4 h-4 text-primary" />
              Input Presensi Manual Karyawan
            </DialogTitle>
            <DialogDescription className="text-xs">
              Tambahkan catatan kehadiran untuk karyawan yang tidak membawa ponsel atau kendala teknis.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Pilih Karyawan</Label>
              <Select value={manualUserId} onValueChange={setManualUserId}>
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue placeholder="Pilih Karyawan..." />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.fullName || u.name} ({u.nip || '-'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Tanggal</Label>
                <Input
                  type="date"
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  className="h-9 text-xs rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Status Kehadiran</Label>
                <Select value={manualStatus} onValueChange={(val: AttendanceStatus) => setManualStatus(val)}>
                  <SelectTrigger className="h-9 text-xs rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hadir">Tepat Waktu</SelectItem>
                    <SelectItem value="terlambat">Terlambat</SelectItem>
                    <SelectItem value="izin">Izin</SelectItem>
                    <SelectItem value="sakit">Sakit</SelectItem>
                    <SelectItem value="alpha">Alpha</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Jam Masuk</Label>
                <Input
                  type="time"
                  value={manualClockIn}
                  onChange={(e) => setManualClockIn(e.target.value)}
                  className="h-9 text-xs rounded-xl font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Jam Pulang</Label>
                <Input
                  type="time"
                  value={manualClockOut}
                  onChange={(e) => setManualClockOut(e.target.value)}
                  className="h-9 text-xs rounded-xl font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Keterangan / Alasan</Label>
              <Input
                placeholder="Presensi manual diverifikasi langsung oleh HR / Superadmin"
                value={manualNotes}
                onChange={(e) => setManualNotes(e.target.value)}
                className="h-9 text-xs rounded-xl"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setManualModalOpen(false)} className="rounded-xl">
              Batal
            </Button>
            <Button
              size="sm"
              onClick={handleSaveManualEntry}
              disabled={isSubmitting}
              className="rounded-xl bg-primary text-primary-foreground font-semibold"
            >
              {isSubmitting ? 'Menyimpan...' : 'Tambahkan Presensi'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Preview Foto Selfie */}
      {photoPreviewUrl && (
        <Dialog open={Boolean(photoPreviewUrl)} onOpenChange={() => setPhotoPreviewUrl(null)}>
          <DialogContent className="max-w-md p-4 text-center">
            <DialogHeader>
              <DialogTitle className="text-sm font-bold flex items-center justify-center gap-2">
                <Camera className="w-4 h-4 text-primary" />
                Bukti Foto Presensi Biometrik
              </DialogTitle>
            </DialogHeader>
            <div className="mt-3 flex justify-center">
              <img
                src={photoPreviewUrl}
                alt="Selfie Biometrik"
                className="max-h-80 w-auto rounded-xl object-contain border border-border shadow-md"
              />
            </div>
            <div className="mt-4 flex justify-end">
              <Button size="sm" variant="outline" onClick={() => setPhotoPreviewUrl(null)} className="rounded-xl">
                Tutup
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
