import React, { useState, useEffect } from 'react';
import { hrmService } from '@/services/hrmService';
import { OvertimeRecord, OvertimeStatus, UserProfile } from '@/types/hrm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Clock,
  CheckCircle2,
  XCircle,
  FileCheck2,
  DollarSign,
  Search,
  Filter,
  Camera,
  RefreshCw,
  AlertCircle,
  Briefcase,
} from 'lucide-react';

export const HrmLemburManagementTab: React.FC = () => {
  const [records, setRecords] = useState<OvertimeRecord[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [divisions, setDivisions] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedDivision, setSelectedDivision] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Approval Modal State
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [selectedOt, setSelectedOt] = useState<OvertimeRecord | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [actionNotes, setActionNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Photo Preview Modal
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const loadData = () => {
    setIsLoading(true);
    setUsers(hrmService.getUsers());
    setDivisions(hrmService.getDivisions());
    const otList = hrmService.getOvertimeRecords();
    setRecords(otList);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
    const handleSync = () => loadData();
    window.addEventListener('hrm_overtime_updated', handleSync);
    window.addEventListener('hrm_data_updated', handleSync);
    return () => {
      window.removeEventListener('hrm_overtime_updated', handleSync);
      window.removeEventListener('hrm_data_updated', handleSync);
    };
  }, []);

  const filteredRecords = records.filter((r) => {
    const user = users.find((u) => u.id === r.userId);
    const uName = r.userName || user?.fullName || '';
    const uNip = r.userNip || user?.nip || '';
    const uDiv = r.divisionName || user?.divisionName || user?.division || '';

    const matchesSearch =
      uName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      uNip.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.taskDescription || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesDivision =
      selectedDivision === 'all' || uDiv.toLowerCase() === selectedDivision.toLowerCase();

    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;

    return matchesSearch && matchesDivision && matchesStatus;
  });

  // Calculate Metrics
  const totalSPKL = records.length;
  const pendingCount = records.filter((r) => r.status === 'pending').length;
  const approvedCount = records.filter((r) => r.status === 'approved' || r.status === 'completed').length;
  const totalHours = records
    .filter((r) => r.status === 'approved' || r.status === 'completed')
    .reduce((acc, curr) => acc + (Number(curr.approvedHours ?? curr.durationHours) || 0), 0);
  const totalPayEstimate = records
    .filter((r) => r.status === 'approved' || r.status === 'completed')
    .reduce((acc, curr) => acc + (Number(curr.compensationAmount ?? curr.totalPay) || 0), 0);

  const handleOpenAction = (rec: OvertimeRecord, type: 'approve' | 'reject') => {
    setSelectedOt(rec);
    setActionType(type);
    setActionNotes(type === 'approve' ? 'Disetujui oleh Super Administrator' : 'Tidak memenuhi kualifikasi lembur');
    setActionModalOpen(true);
  };

  const handleExecuteAction = async () => {
    if (!selectedOt) return;
    setIsSubmitting(true);
    try {
      const res = await hrmService.updateOvertimeStatus(
        selectedOt.id,
        actionType === 'approve' ? 'approved' : 'rejected',
        'Super Administrator',
        actionNotes
      );

      if (res.success) {
        toast.success(
          `Pengajuan SPKL lembur berhasil ${actionType === 'approve' ? 'disetujui' : 'ditolak'} dan tersinkron ke database.`
        );
        setActionModalOpen(false);
        loadData();
      } else {
        toast.error(res.error || 'Gagal memperbarui status lembur');
      }
    } catch (err: any) {
      toast.error('Terjadi kesalahan saat memproses status');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: OvertimeStatus) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-emerald-600 text-white hover:bg-emerald-700 text-[11px]">Disetujui</Badge>;
      case 'completed':
        return <Badge className="bg-blue-600 text-white hover:bg-blue-700 text-[11px]">Selesai Bertugas</Badge>;
      case 'pending':
        return <Badge className="bg-amber-500 text-white hover:bg-amber-600 text-[11px] animate-pulse">Menunggu</Badge>;
      case 'rejected':
        return <Badge variant="destructive" className="text-[11px]">Ditolak</Badge>;
      default:
        return <Badge variant="outline" className="text-[11px]">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Metric Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <Card className="border-border bg-card shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Briefcase className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Total SPKL</p>
              <p className="text-xl font-bold text-foreground">{totalSPKL}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Perlu Approval</p>
              <p className="text-xl font-bold text-amber-600">{pendingCount}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">SPKL Disetujui</p>
              <p className="text-xl font-bold text-emerald-600">{approvedCount}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-600 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Total Jam Lembur</p>
              <p className="text-xl font-bold text-sky-600">{totalHours.toFixed(1)} Jam</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center shrink-0">
              <DollarSign className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Estimasi Upah PP35</p>
              <p className="text-base font-bold font-mono text-purple-600">
                Rp {totalPayEstimate > 0 ? (totalPayEstimate / 1000).toFixed(0) + 'k' : '0'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card className="border-border bg-card shadow-xs">
        <CardHeader className="pb-3 border-b border-border">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-primary" />
                Daftar Surat Perintah Kerja Lembur (SPKL Digital)
              </CardTitle>
              <CardDescription className="text-xs">
                Verifikasi penugasan lembur sebelum/sesudah jam kerja dengan kalkulasi pengali PP No. 35/2021.
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
          {/* Controls Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Cari nama, NIP, atau tugas..."
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

            <div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue placeholder="Status Persetujuan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="pending">Menunggu Persetujuan</SelectItem>
                  <SelectItem value="approved">Disetujui</SelectItem>
                  <SelectItem value="completed">Selesai</SelectItem>
                  <SelectItem value="rejected">Ditolak</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Table */}
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-foreground">
                <thead className="bg-muted/40 border-b border-border uppercase text-[11px] text-muted-foreground font-semibold">
                  <tr>
                    <th className="py-3 px-4">Karyawan</th>
                    <th className="py-3 px-4">Divisi</th>
                    <th className="py-3 px-4 text-center">Tanggal</th>
                    <th className="py-3 px-4 text-center">Jam & Durasi</th>
                    <th className="py-3 px-4">Uraian Tugas Lembur</th>
                    <th className="py-3 px-4 text-center">Bukti Foto</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Kompensasi</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-muted-foreground">
                        Belum ada pengajuan lembur yang tercatat.
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((r) => {
                      const user = users.find((u) => u.id === r.userId);
                      const photo =
                        r.taskPhotoUrl ||
                        (r.completionPhotos && r.completionPhotos.length > 0 ? r.completionPhotos[0] : null);
                      const dur = Number(r.approvedHours ?? r.durationHours) || 0;
                      const comp = Number(r.compensationAmount ?? r.totalPay) || 0;

                      return (
                        <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-4">
                            <div>
                              <p className="font-semibold text-foreground">{r.userName || user?.fullName || 'Karyawan'}</p>
                              <p className="text-[10px] text-muted-foreground font-mono">{r.userNip || user?.nip || '-'}</p>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                            {r.divisionName || user?.divisionName || '-'}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap font-medium text-foreground">
                            {r.date}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <span className="font-mono">{r.startTime} - {r.endTime}</span>
                            <p className="text-[10px] text-muted-foreground font-semibold">({dur} Jam)</p>
                          </td>
                          <td className="py-3 px-4 max-w-xs truncate text-[11px] text-muted-foreground">
                            {r.taskDescription || 'Pekerjaan operasional'}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {photo ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setPhotoPreview(photo)}
                                className="h-6 w-6 p-0 rounded-lg text-primary hover:bg-primary/10"
                                title="Lihat Foto Bukti"
                              >
                                <Camera className="w-3.5 h-3.5" />
                              </Button>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            {getStatusBadge(r.status)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-medium text-foreground whitespace-nowrap">
                            {comp > 0 ? `Rp ${comp.toLocaleString('id-ID')}` : '-'}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            {r.status === 'pending' ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  size="sm"
                                  onClick={() => handleOpenAction(r, 'approve')}
                                  className="h-7 text-[11px] rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-2"
                                >
                                  Setujui
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleOpenAction(r, 'reject')}
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
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modal Action Approval/Rejection */}
      <Dialog open={actionModalOpen} onOpenChange={setActionModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              {actionType === 'approve' ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Konfirmasi Persetujuan SPKL Lembur
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 text-rose-600" />
                  Tolak Pengajuan Lembur
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {actionType === 'approve'
                ? 'Lembur yang disetujui akan diakumulasikan ke rekapan jam kerja dan slip penggajian periode berjalan.'
                : 'Berikan alasan penolakan agar karyawan menerima pemberitahuan resmi di aplikasi.'}
            </DialogDescription>
          </DialogHeader>

          {selectedOt && (
            <div className="space-y-3 py-2 text-xs">
              <div className="p-3 bg-muted/40 rounded-xl border border-border space-y-1">
                <p className="font-semibold text-foreground">{selectedOt.userName}</p>
                <p className="text-muted-foreground">
                  Tanggal: {selectedOt.date} • Durasi: {selectedOt.durationHours} Jam ({selectedOt.startTime} - {selectedOt.endTime})
                </p>
                <p className="text-[11px] text-muted-foreground italic mt-1">"{selectedOt.taskDescription}"</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Catatan Verifikasi</label>
                <Input
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  className="h-9 text-xs rounded-xl"
                  placeholder="Catatan..."
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setActionModalOpen(false)} className="rounded-xl">
              Batal
            </Button>
            <Button
              size="sm"
              onClick={handleExecuteAction}
              disabled={isSubmitting}
              className={`rounded-xl text-white font-semibold ${
                actionType === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
              }`}
            >
              {isSubmitting ? 'Memproses...' : actionType === 'approve' ? 'Ya, Setujui Lembur' : 'Tolak Lembur'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Preview Bukti Foto */}
      {photoPreview && (
        <Dialog open={Boolean(photoPreview)} onOpenChange={() => setPhotoPreview(null)}>
          <DialogContent className="max-w-md p-4 text-center">
            <DialogHeader>
              <DialogTitle className="text-sm font-bold flex items-center justify-center gap-2">
                <Camera className="w-4 h-4 text-primary" />
                Bukti Foto Pelaksanaan Tugas Lembur
              </DialogTitle>
            </DialogHeader>
            <div className="mt-3 flex justify-center">
              <img
                src={photoPreview}
                alt="Bukti Lembur"
                className="max-h-80 w-auto rounded-xl object-contain border border-border shadow-md"
              />
            </div>
            <div className="mt-4 flex justify-end">
              <Button size="sm" variant="outline" onClick={() => setPhotoPreview(null)} className="rounded-xl">
                Tutup
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
