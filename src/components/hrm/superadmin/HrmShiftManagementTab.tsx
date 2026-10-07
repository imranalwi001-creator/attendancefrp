import React, { useState, useEffect } from 'react';
import { hrmService } from '@/services/hrmService';
import { Shift, UserProfile, ShiftSwapRecord } from '@/types/hrm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  CalendarClock,
  Clock,
  Plus,
  Edit2,
  Users,
  ArrowRightLeft,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Search,
  Building2,
} from 'lucide-react';

export const HrmShiftManagementTab: React.FC = () => {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [divisions, setDivisions] = useState<any[]>([]);
  const [shiftSwaps, setShiftSwaps] = useState<ShiftSwapRecord[]>([]);
  const [selectedDivision, setSelectedDivision] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Shift Modal State
  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [shiftName, setShiftName] = useState('');
  const [startTime, setStartTime] = useState('07:30');
  const [endTime, setEndTime] = useState('16:30');
  const [lateTolerance, setLateTolerance] = useState(15);
  const [isDefault, setIsDefault] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Re-assign Employee Shift Modal State
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [targetShiftId, setTargetShiftId] = useState<string>('');

  const loadData = () => {
    setIsLoading(true);
    setShifts(hrmService.getShifts());
    setUsers(hrmService.getUsers());
    setDivisions(hrmService.getDivisions());
    setShiftSwaps(hrmService.getShiftSwaps());
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
    const handleSync = () => loadData();
    window.addEventListener('hrm_shifts_updated', handleSync);
    window.addEventListener('hrm_users_updated', handleSync);
    window.addEventListener('hrm_data_updated', handleSync);
    return () => {
      window.removeEventListener('hrm_shifts_updated', handleSync);
      window.removeEventListener('hrm_users_updated', handleSync);
      window.removeEventListener('hrm_data_updated', handleSync);
    };
  }, []);

  const handleOpenAddShift = () => {
    setEditingShift(null);
    setShiftName('');
    setStartTime('07:30');
    setEndTime('16:30');
    setLateTolerance(15);
    setIsDefault(false);
    setShiftModalOpen(true);
  };

  const handleOpenEditShift = (s: Shift) => {
    setEditingShift(s);
    setShiftName(s.name);
    setStartTime(s.startTime ? s.startTime.substring(0, 5) : '07:30');
    setEndTime(s.endTime ? s.endTime.substring(0, 5) : '16:30');
    setLateTolerance(s.lateToleranceMinutes || 15);
    setIsDefault(s.isDefault || false);
    setShiftModalOpen(true);
  };

  const handleSaveShift = async () => {
    if (!shiftName.trim()) {
      toast.error('Nama shift wajib diisi');
      return;
    }
    setIsSubmitting(true);
    try {
      if (editingShift) {
        await hrmService.updateShift(editingShift.id, {
          name: shiftName,
          startTime: `${startTime}:00`,
          endTime: `${endTime}:00`,
          lateToleranceMinutes: Number(lateTolerance),
          isDefault,
        });
        toast.success('Pola shift berhasil diperbarui.');
      } else {
        await hrmService.addShift({
          name: shiftName,
          startTime: `${startTime}:00`,
          endTime: `${endTime}:00`,
          lateToleranceMinutes: Number(lateTolerance),
          isDefault,
        });
        toast.success('Shift baru berhasil ditambahkan.');
      }
      setShiftModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error('Gagal menyimpan master shift');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenAssign = (u: UserProfile) => {
    setSelectedUser(u);
    setTargetShiftId(u.shiftId || (shifts[0] ? shifts[0].id : ''));
    setAssignModalOpen(true);
  };

  const handleSaveUserShift = async () => {
    if (!selectedUser || !targetShiftId) return;
    setIsSubmitting(true);
    try {
      const targetShift = shifts.find((s) => s.id === targetShiftId);
      await hrmService.updateUser(selectedUser.id, {
        shiftId: targetShiftId,
        shiftName: targetShift?.name,
      });
      toast.success(`Jadwal shift untuk ${selectedUser.fullName} berhasil diperbarui di database & PWA.`);
      setAssignModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error('Gagal memperbarui shift karyawan');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApproveSwap = async (swapId: string, isApprove: boolean) => {
    try {
      const res = await hrmService.approveShiftSwap(swapId, 'Super Administrator', isApprove);
      if (res.success) {
        toast.success(`Permohonan tukar shift berhasil ${isApprove ? 'disetujui' : 'ditolak'}.`);
        loadData();
      } else {
        toast.error(res.error || 'Gagal memproses permohonan tukar shift');
      }
    } catch (err: any) {
      toast.error('Terjadi kesalahan sistem');
    }
  };

  const filteredUsers = users.filter((u) => {
    const uName = u.fullName || u.name || '';
    const uNip = u.nip || '';
    const uDiv = u.divisionName || u.division || '';

    const matchesSearch =
      uName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      uNip.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesDivision =
      selectedDivision === 'all' || uDiv.toLowerCase() === selectedDivision.toLowerCase();

    return matchesSearch && matchesDivision;
  });

  return (
    <div className="space-y-6">
      {/* Master Shifts Cards */}
      <Card className="border-border bg-card shadow-xs">
        <CardHeader className="pb-3 border-b border-border">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-primary" />
                Master Jam Kerja & Konfigurasi Shift
              </CardTitle>
              <CardDescription className="text-xs">
                Atur pola jam kerja operasional, batas toleransi keterlambatan, dan rotasi jadwal 24/7.
              </CardDescription>
            </div>

            <Button
              size="sm"
              onClick={handleOpenAddShift}
              className="h-8 text-xs rounded-xl bg-primary text-primary-foreground font-semibold gap-1.5 shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              Tambah Shift Baru
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {shifts.map((s) => (
              <div
                key={s.id}
                className="p-3.5 rounded-xl border border-border bg-muted/20 hover:bg-muted/40 transition-colors flex flex-col justify-between space-y-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-xs text-foreground truncate">{s.name}</p>
                    {s.isDefault && (
                      <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] h-5">
                        Default
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-primary">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{s.startTime?.substring(0, 5)} - {s.endTime?.substring(0, 5)} WITA</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Toleransi Terlambat: <span className="font-semibold text-foreground">{s.lateToleranceMinutes || 15} Menit</span>
                  </p>
                </div>

                <div className="pt-2 border-t border-border flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenEditShift(s)}
                    className="h-7 text-[11px] rounded-lg gap-1"
                  >
                    <Edit2 className="w-3 h-3 text-primary" />
                    Edit Shift
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Employee Shift Assignment Table */}
      <Card className="border-border bg-card shadow-xs">
        <CardHeader className="pb-3 border-b border-border">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                Penugasan Shift per Karyawan & Divisi
              </CardTitle>
              <CardDescription className="text-xs">
                Tentukan shift kerja aktif untuk masing-masing karyawan yang tersinkronisasi otomatis ke aplikasi PWA.
              </CardDescription>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={isLoading}
              className="h-8 text-xs rounded-xl gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Muat Ulang
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          </div>

          <div className="border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-foreground">
                <thead className="bg-muted/40 border-b border-border uppercase text-[11px] text-muted-foreground font-semibold">
                  <tr>
                    <th className="py-3 px-4">Karyawan</th>
                    <th className="py-3 px-4">Divisi</th>
                    <th className="py-3 px-4">Jabatan</th>
                    <th className="py-3 px-4">Shift Aktif Database</th>
                    <th className="py-3 px-4 text-center">Jam Operasional</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-muted-foreground">
                        Tidak ada data karyawan ditemukan.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const userShift = shifts.find((s) => s.id === u.shiftId) || shifts[0];
                      return (
                        <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-4">
                            <div>
                              <p className="font-semibold text-foreground">{u.fullName || u.name}</p>
                              <p className="text-[10px] text-muted-foreground font-mono">{u.nip || '-'}</p>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                            {u.divisionName || u.division || '-'}
                          </td>
                          <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                            {u.jobTitle || u.roleName || '-'}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[11px]">
                              {u.shiftName || userShift?.name || 'Day Shift'}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-medium text-foreground whitespace-nowrap">
                            {userShift?.startTime?.substring(0, 5)} - {userShift?.endTime?.substring(0, 5)} WITA
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenAssign(u)}
                              className="h-7 text-[11px] rounded-lg gap-1"
                            >
                              <CalendarClock className="w-3 h-3 text-primary" />
                              Ubah Shift
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

      {/* Shift Swap Requests Table */}
      {shiftSwaps.length > 0 && (
        <Card className="border-border bg-card shadow-xs">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-primary" />
              Permohonan Tukar Shift (Shift Swap)
            </CardTitle>
            <CardDescription className="text-xs">
              Alur persetujuan pertukaran jadwal antar rekan kerja tanpa mengacaukan rekapitulasi data.
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-4">
            <div className="border border-border rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs text-foreground">
                <thead className="bg-muted/40 border-b border-border uppercase text-[11px] text-muted-foreground font-semibold">
                  <tr>
                    <th className="py-3 px-4">Pengaju (Karyawan A)</th>
                    <th className="py-3 px-4">Pengganti (Karyawan B)</th>
                    <th className="py-3 px-4 text-center">Tanggal Tukar</th>
                    <th className="py-3 px-4">Alasan</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {shiftSwaps.map((sw) => (
                    <tr key={sw.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-semibold text-foreground">
                        {sw.requester_name || 'Karyawan A'}
                      </td>
                      <td className="py-3 px-4 font-semibold text-foreground">
                        {sw.substitute_name || 'Karyawan B'}
                      </td>
                      <td className="py-3 px-4 text-center font-mono">
                        {sw.swap_date}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground truncate max-w-xs">
                        {sw.reason}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant="outline" className="text-[11px] capitalize">
                          {sw.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {sw.status === 'pending' || sw.status === 'pending_danru' ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              onClick={() => handleApproveSwap(sw.id, true)}
                              className="h-7 text-[11px] rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-2"
                            >
                              Setujui
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleApproveSwap(sw.id, false)}
                              className="h-7 text-[11px] rounded-lg border-rose-300 text-rose-600 hover:bg-rose-50 px-2"
                            >
                              Tolak
                            </Button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">Telah Diproses</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal Add/Edit Master Shift */}
      <Dialog open={shiftModalOpen} onOpenChange={setShiftModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-primary" />
              {editingShift ? 'Edit Konfigurasi Shift' : 'Tambah Master Shift Baru'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Konfigurasi jam masuk, jam kepulangan, dan batas toleransi absensi.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Nama Shift</Label>
              <Input
                placeholder="Contoh: Shift III (22:30 - 07:30 WITA)"
                value={shiftName}
                onChange={(e) => setShiftName(e.target.value)}
                className="h-9 text-xs rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Jam Mulai</Label>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="h-9 text-xs rounded-xl font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Jam Selesai</Label>
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="h-9 text-xs rounded-xl font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Toleransi Keterlambatan (Menit)</Label>
              <Input
                type="number"
                value={lateTolerance}
                onChange={(e) => setLateTolerance(Number(e.target.value))}
                className="h-9 text-xs rounded-xl font-mono"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setShiftModalOpen(false)} className="rounded-xl">
              Batal
            </Button>
            <Button
              size="sm"
              onClick={handleSaveShift}
              disabled={isSubmitting}
              className="rounded-xl bg-primary text-primary-foreground font-semibold"
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan Shift'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Ubah Shift Karyawan */}
      <Dialog open={assignModalOpen} onOpenChange={setAssignModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-primary" />
              Perbarui Penugasan Shift Karyawan
            </DialogTitle>
            <DialogDescription className="text-xs">
              Pilih shift baru untuk karyawan. Jadwal baru akan langsung tampil di dashboard PWA karyawan.
            </DialogDescription>
          </DialogHeader>

          {selectedUser && (
            <div className="space-y-4 py-2 text-xs">
              <div className="p-3 bg-muted/40 rounded-xl border border-border">
                <p className="font-semibold text-foreground">{selectedUser.fullName || selectedUser.name}</p>
                <p className="text-muted-foreground font-mono text-[11px]">NIP: {selectedUser.nip || '-'} • Divisi: {selectedUser.divisionName || selectedUser.division || '-'}</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Pilih Shift Baru</Label>
                <Select value={targetShiftId} onValueChange={setTargetShiftId}>
                  <SelectTrigger className="h-9 text-xs rounded-xl">
                    <SelectValue placeholder="Pilih shift..." />
                  </SelectTrigger>
                  <SelectContent>
                    {shifts.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} ({s.startTime?.substring(0, 5)} - {s.endTime?.substring(0, 5)} WITA)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setAssignModalOpen(false)} className="rounded-xl">
              Batal
            </Button>
            <Button
              size="sm"
              onClick={handleSaveUserShift}
              disabled={isSubmitting}
              className="rounded-xl bg-primary text-primary-foreground font-semibold"
            >
              {isSubmitting ? 'Menyimpan...' : 'Terapkan Shift'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
