import React, { useState, useEffect } from 'react';
import { hrmService } from '@/services/hrmService';
import { LeaveRequest, LeaveStatus, UserProfile } from '@/types/hrm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  CalendarDays,
  CheckCircle2,
  XCircle,
  FileText,
  Clock,
  Search,
  RefreshCw,
  FileCheck2,
  CalendarCheck,
  Paperclip,
} from 'lucide-react';

export const HrmCutiManagementTab: React.FC = () => {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [divisions, setDivisions] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedDivision, setSelectedDivision] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Approval Modal State
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState<LeaveRequest | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [actionNotes, setActionNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Attachment Preview Modal
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);

  const loadData = () => {
    setIsLoading(true);
    setUsers(hrmService.getUsers());
    setDivisions(hrmService.getDivisions());
    const lList = hrmService.getLeaves();
    setLeaves(lList);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
    const handleSync = () => loadData();
    window.addEventListener('hrm_leaves_updated', handleSync);
    window.addEventListener('hrm_data_updated', handleSync);
    return () => {
      window.removeEventListener('hrm_leaves_updated', handleSync);
      window.removeEventListener('hrm_data_updated', handleSync);
    };
  }, []);

  const filteredLeaves = leaves.filter((l) => {
    const user = users.find((u) => u.id === l.userId);
    const uName = l.userName || user?.fullName || '';
    const uNip = l.userNip || user?.nip || '';
    const uDiv = l.divisionName || user?.divisionName || user?.division || '';

    const matchesSearch =
      uName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      uNip.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (l.reason || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesDivision =
      selectedDivision === 'all' || uDiv.toLowerCase() === selectedDivision.toLowerCase();

    const matchesStatus = statusFilter === 'all' || l.status === statusFilter;

    return matchesSearch && matchesDivision && matchesStatus;
  });

  // Calculate Metrics
  const totalLeaves = leaves.length;
  const pendingLeaves = leaves.filter((l) => l.status === 'pending').length;
  const approvedLeaves = leaves.filter((l) => l.status === 'approved').length;
  const sickLeaves = leaves.filter((l) => l.leaveType === 'sakit' && l.status === 'approved').length;
  const annualLeaves = leaves.filter((l) => l.leaveType === 'cuti_tahunan' && l.status === 'approved').length;

  const handleOpenAction = (leave: LeaveRequest, type: 'approve' | 'reject') => {
    setSelectedLeave(leave);
    setActionType(type);
    setActionNotes(type === 'approve' ? 'Disetujui oleh Super Administrator' : 'Permohonan cuti tidak dapat disetujui');
    setActionModalOpen(true);
  };

  const handleExecuteAction = async () => {
    if (!selectedLeave) return;
    setIsSubmitting(true);
    try {
      const res = await hrmService.updateLeaveStatus(
        selectedLeave.id,
        actionType === 'approve' ? 'approved' : 'rejected',
        'Super Administrator',
        actionNotes
      );

      if (res.success) {
        toast.success(
          `Permohonan cuti/izin berhasil ${actionType === 'approve' ? 'disetujui' : 'ditolak'} dan tersinkron ke database.`
        );
        setActionModalOpen(false);
        loadData();
      } else {
        toast.error(res.error || 'Gagal memproses permohonan cuti');
      }
    } catch (err: any) {
      toast.error('Terjadi kesalahan saat memproses status');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: LeaveStatus) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-emerald-600 text-white hover:bg-emerald-700 text-[11px]">Disetujui</Badge>;
      case 'pending':
        return <Badge className="bg-amber-500 text-white hover:bg-amber-600 text-[11px] animate-pulse">Menunggu</Badge>;
      case 'rejected':
        return <Badge variant="destructive" className="text-[11px]">Ditolak</Badge>;
      default:
        return <Badge variant="outline" className="text-[11px]">{status}</Badge>;
    }
  };

  const getLeaveTypeBadge = (type: string) => {
    const labels: Record<string, string> = {
      cuti_tahunan: 'Cuti Tahunan',
      sakit: 'Sakit',
      izin: 'Izin Keperluan',
      cuti_menikah: 'Cuti Menikah',
      cuti_melahirkan: 'Cuti Melahirkan',
      cuti_duka: 'Cuti Duka',
      izin_darurat: 'Izin Darurat',
    };
    return (
      <Badge variant="outline" className="bg-muted text-foreground text-[11px] font-medium border-border">
        {labels[type] || type}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Metric Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <Card className="border-border bg-card shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <CalendarDays className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Total Pengajuan</p>
              <p className="text-xl font-bold text-foreground">{totalLeaves}</p>
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
              <p className="text-xl font-bold text-amber-600">{pendingLeaves}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Disetujui</p>
              <p className="text-xl font-bold text-emerald-600">{approvedLeaves}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-600 flex items-center justify-center shrink-0">
              <CalendarCheck className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Cuti Tahunan</p>
              <p className="text-xl font-bold text-sky-600">{annualLeaves}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Izin Sakit</p>
              <p className="text-xl font-bold text-purple-600">{sickLeaves}</p>
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
                Manajemen Data Izin & Cuti Karyawan
              </CardTitle>
              <CardDescription className="text-xs">
                Verifikasi pengajuan cuti tahunan, izin sakit (lampiran dokter), serta pembaruan saldo cuti otomatis.
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Cari nama, NIP, atau alasan..."
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
                  <SelectItem value="rejected">Ditolak</SelectItem>
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
                    <th className="py-3 px-4">Kategori Permohonan</th>
                    <th className="py-3 px-4 text-center">Tanggal & Durasi</th>
                    <th className="py-3 px-4">Alasan</th>
                    <th className="py-3 px-4 text-center">Lampiran</th>
                    <th className="py-3 px-4 text-center">Sisa Saldo</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredLeaves.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-muted-foreground">
                        Belum ada permohonan izin atau cuti yang tercatat.
                      </td>
                    </tr>
                  ) : (
                    filteredLeaves.map((l) => {
                      const user = users.find((u) => u.id === l.userId);
                      return (
                        <tr key={l.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-4">
                            <div>
                              <p className="font-semibold text-foreground">{l.userName || user?.fullName || 'Karyawan'}</p>
                              <p className="text-[10px] text-muted-foreground font-mono">{l.userNip || user?.nip || '-'}</p>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                            {l.divisionName || user?.divisionName || '-'}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            {getLeaveTypeBadge(l.leaveType)}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <span className="font-mono">{l.startDate} s/d {l.endDate}</span>
                            <p className="text-[10px] text-muted-foreground font-semibold">({l.totalDays || 1} Hari)</p>
                          </td>
                          <td className="py-3 px-4 max-w-xs truncate text-[11px] text-muted-foreground">
                            {l.reason || '-'}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {l.attachmentUrl ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setAttachmentPreview(l.attachmentUrl!)}
                                className="h-6 w-6 p-0 rounded-lg text-primary hover:bg-primary/10"
                                title="Lihat Berkas Lampiran"
                              >
                                <Paperclip className="w-3.5 h-3.5" />
                              </Button>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-medium text-foreground">
                            {user?.annualLeaveQuota ?? 12} Hari
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            {getStatusBadge(l.status)}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            {l.status === 'pending' ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  size="sm"
                                  onClick={() => handleOpenAction(l, 'approve')}
                                  className="h-7 text-[11px] rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-2"
                                >
                                  Setujui
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleOpenAction(l, 'reject')}
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
                  Konfirmasi Persetujuan Cuti / Izin
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 text-rose-600" />
                  Tolak Pengajuan Cuti / Izin
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {actionType === 'approve'
                ? 'Persetujuan ini akan otomatis memotong kuota saldo cuti tahunan karyawan (jika berlaku).'
                : 'Berikan alasan penolakan permohonan cuti.'}
            </DialogDescription>
          </DialogHeader>

          {selectedLeave && (
            <div className="space-y-3 py-2 text-xs">
              <div className="p-3 bg-muted/40 rounded-xl border border-border space-y-1">
                <p className="font-semibold text-foreground">{selectedLeave.userName}</p>
                <p className="text-muted-foreground">
                  Periode: {selectedLeave.startDate} s/d {selectedLeave.endDate} ({selectedLeave.totalDays} Hari)
                </p>
                <p className="text-[11px] text-muted-foreground italic mt-1">"{selectedLeave.reason}"</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Catatan Keputusan</label>
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
              {isSubmitting ? 'Memproses...' : actionType === 'approve' ? 'Ya, Setujui Permohonan' : 'Tolak Permohonan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Preview Lampiran */}
      {attachmentPreview && (
        <Dialog open={Boolean(attachmentPreview)} onOpenChange={() => setAttachmentPreview(null)}>
          <DialogContent className="max-w-md p-4 text-center">
            <DialogHeader>
              <DialogTitle className="text-sm font-bold flex items-center justify-center gap-2">
                <Paperclip className="w-4 h-4 text-primary" />
                Bukti Lampiran Permohonan Izin / Cuti
              </DialogTitle>
            </DialogHeader>
            <div className="mt-3 flex justify-center">
              <img
                src={attachmentPreview}
                alt="Lampiran"
                className="max-h-80 w-auto rounded-xl object-contain border border-border shadow-md"
              />
            </div>
            <div className="mt-4 flex justify-end">
              <Button size="sm" variant="outline" onClick={() => setAttachmentPreview(null)} className="rounded-xl">
                Tutup
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
