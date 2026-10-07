import React, { useState, useEffect } from 'react';
import { hrmService, getTodayDateStr } from '@/services/hrmService';
import { DisciplinaryRecord, DisciplinaryStatus, SpType, UserProfile, PerimeterViolation } from '@/types/hrm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  ShieldAlert,
  AlertTriangle,
  Plus,
  Search,
  Filter,
  RefreshCw,
  FileCheck2,
  Trash2,
  CheckCircle2,
  FileText,
  Clock,
  MapPin,
} from 'lucide-react';

export const HrmPelanggaranManagementTab: React.FC = () => {
  const [records, setRecords] = useState<DisciplinaryRecord[]>([]);
  const [violations, setViolations] = useState<PerimeterViolation[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [divisions, setDivisions] = useState<any[]>([]);
  const [selectedDivision, setSelectedDivision] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Issue SP Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [userId, setUserId] = useState('');
  const [spType, setSpType] = useState<SpType>('sp1');
  const [letterNumber, setLetterNumber] = useState('');
  const [violationDate, setViolationDate] = useState(getTodayDateStr());
  const [violationType, setViolationType] = useState('Pelanggaran Disiplin & Presensi');
  const [description, setDescription] = useState('');
  const [sanction, setSanction] = useState('Peringatan tertulis dan pembinaan kedisiplinan kerja selama 6 bulan.');
  const [validUntil, setValidUntil] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 6);
    return d.toISOString().split('T')[0];
  });
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = () => {
    setIsLoading(true);
    setUsers(hrmService.getUsers());
    setDivisions(hrmService.getDivisions());
    setRecords(hrmService.getDisciplinaryRecords());
    setViolations(hrmService.getPerimeterViolations());
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
    const handleSync = () => loadData();
    window.addEventListener('hrm_disciplinary_updated', handleSync);
    window.addEventListener('hrm_data_updated', handleSync);
    return () => {
      window.removeEventListener('hrm_disciplinary_updated', handleSync);
      window.removeEventListener('hrm_data_updated', handleSync);
    };
  }, []);

  const handleOpenIssue = () => {
    const randomSeq = String(Math.floor(100 + Math.random() * 900));
    setLetterNumber(`SP-${randomSeq}/HRD-FRP/${new Date().getFullYear()}`);
    setUserId(users[0]?.id || '');
    setSpType('sp1');
    setViolationDate(getTodayDateStr());
    setViolationType('Pelanggaran Disiplin / Keterlambatan Akumulatif');
    setDescription('');
    setSanction('Peringatan tertulis dan pembinaan kedisiplinan kerja selama 6 bulan.');
    const d = new Date();
    d.setMonth(d.getMonth() + 6);
    setValidUntil(d.toISOString().split('T')[0]);
    setNotes('');
    setModalOpen(true);
  };

  const handleSaveSP = async () => {
    if (!userId || !description.trim()) {
      toast.error('Pilih karyawan dan isi deskripsi pelanggaran');
      return;
    }
    setIsSubmitting(true);
    try {
      const selectedUserObj = users.find((u) => u.id === userId);
      const res = await hrmService.addDisciplinaryRecord({
        userId,
        userName: selectedUserObj?.fullName || selectedUserObj?.name,
        userNip: selectedUserObj?.nip || '',
        divisionName: selectedUserObj?.divisionName || selectedUserObj?.division || '-',
        spType,
        letterNumber,
        violationDate,
        violationType,
        description,
        sanction,
        issuedByName: 'Super Administrator',
        validUntil,
        status: 'active',
        notes,
      });

      if (res.success) {
        toast.success(`Surat Peringatan (${spType.toUpperCase()}) berhasil diterbitkan dan disinkronkan ke database.`);
        setModalOpen(false);
        loadData();
      } else {
        toast.error(res.error || 'Gagal menerbitkan sanksi pelanggaran');
      }
    } catch (err: any) {
      toast.error('Terjadi kesalahan saat memproses data');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: DisciplinaryStatus) => {
    try {
      const res = await hrmService.updateDisciplinaryStatus(
        id,
        newStatus,
        newStatus === 'revoked' ? 'Sanksi dicabut oleh Superadmin' : 'Status diperbarui'
      );
      if (res.success) {
        toast.success('Status sanksi pelanggaran berhasil diperbarui.');
        loadData();
      } else {
        toast.error(res.error || 'Gagal memperbarui status sanksi');
      }
    } catch (err: any) {
      toast.error('Terjadi kesalahan sistem');
    }
  };

  const handleDeleteSP = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus data surat peringatan ini?')) return;
    try {
      const res = await hrmService.deleteDisciplinaryRecord(id);
      if (res.success) {
        toast.success('Surat peringatan berhasil dihapus.');
        loadData();
      } else {
        toast.error(res.error || 'Gagal menghapus');
      }
    } catch (err: any) {
      toast.error('Gagal menghapus');
    }
  };

  const filteredRecords = records.filter((r) => {
    const user = users.find((u) => u.id === r.userId);
    const uName = r.userName || user?.fullName || '';
    const uNip = r.userNip || user?.nip || '';
    const uDiv = r.divisionName || user?.divisionName || user?.division || '';

    const matchesSearch =
      uName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      uNip.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.letterNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.description || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesDivision =
      selectedDivision === 'all' || uDiv.toLowerCase() === selectedDivision.toLowerCase();

    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;

    return matchesSearch && matchesDivision && matchesStatus;
  });

  // Calculate Metrics
  const totalSP = records.length;
  const activeSP = records.filter((r) => r.status === 'active').length;
  const activeBreaches = violations.filter((v) => v.status === 'active').length;
  const sp1Count = records.filter((r) => r.spType === 'sp1' && r.status === 'active').length;
  const sp2_3Count = records.filter((r) => (r.spType === 'sp2' || r.spType === 'sp3') && r.status === 'active').length;

  const getSpBadge = (sp: SpType) => {
    switch (sp) {
      case 'tegoran_lisan':
        return <Badge className="bg-sky-500 text-white text-[11px]">Teguran Lisan</Badge>;
      case 'sp1':
        return <Badge className="bg-amber-500 text-white text-[11px] font-bold">SP 1</Badge>;
      case 'sp2':
        return <Badge className="bg-orange-600 text-white text-[11px] font-bold">SP 2</Badge>;
      case 'sp3':
        return <Badge className="bg-rose-600 text-white text-[11px] font-bold">SP 3 (Terakhir)</Badge>;
      default:
        return <Badge variant="outline" className="text-[11px] uppercase">{sp}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <Card className="border-border bg-card shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Total SP Diterbitkan</p>
              <p className="text-xl font-bold text-foreground">{totalSP}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Sanksi SP Aktif</p>
              <p className="text-xl font-bold text-rose-600">{activeSP}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Perimeter Breach Radar</p>
              <p className="text-xl font-bold text-amber-600">{activeBreaches} Kasus</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-500/10 text-orange-600 flex items-center justify-center shrink-0">
              <FileCheck2 className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">SP 1 (Aktif)</p>
              <p className="text-xl font-bold text-orange-600">{sp1Count}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-500/10 text-red-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">SP 2 & SP 3</p>
              <p className="text-xl font-bold text-red-600">{sp2_3Count}</p>
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
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                Manajemen Sanksi Kedisiplinan & Surat Peringatan (SP)
              </CardTitle>
              <CardDescription className="text-xs">
                Dokumentasi sanksi resmi, pelanggaran perimeter geofence, masa berlaku 6 bulan, dan berita acara kepatuhan hukum.
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
                Muat Ulang
              </Button>
              <Button
                size="sm"
                onClick={handleOpenIssue}
                className="h-8 text-xs rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold gap-1.5 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                Terbitkan Surat Peringatan (SP)
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Cari nama, NIP, no surat..."
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
                  <SelectValue placeholder="Status Sanksi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="active">Aktif</SelectItem>
                  <SelectItem value="expired">Kedaluwarsa</SelectItem>
                  <SelectItem value="revoked">Dicabut / Diampuni</SelectItem>
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
                    <th className="py-3 px-4 text-center">Tingkat SP</th>
                    <th className="py-3 px-4">Nomor Surat</th>
                    <th className="py-3 px-4 text-center">Tgl Terbit</th>
                    <th className="py-3 px-4 text-center">Berlaku Hingga</th>
                    <th className="py-3 px-4">Uraian Pelanggaran</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-muted-foreground">
                        Belum ada catatan sanksi surat peringatan yang terdaftar.
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((r) => {
                      const user = users.find((u) => u.id === r.userId);
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
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            {getSpBadge(r.spType)}
                          </td>
                          <td className="py-3 px-4 font-mono font-medium text-foreground whitespace-nowrap">
                            {r.letterNumber || '-'}
                          </td>
                          <td className="py-3 px-4 text-center font-mono whitespace-nowrap">
                            {r.violationDate}
                          </td>
                          <td className="py-3 px-4 text-center font-mono whitespace-nowrap">
                            {r.validUntil || '-'}
                          </td>
                          <td className="py-3 px-4 max-w-xs truncate text-[11px] text-muted-foreground" title={r.description}>
                            {r.description}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${
                                r.status === 'active'
                                  ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-300'
                                  : r.status === 'revoked'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                  : 'bg-muted text-muted-foreground'
                              }`}
                            >
                              {r.status === 'active' ? 'Aktif' : r.status === 'revoked' ? 'Dicabut' : 'Kedaluwarsa'}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {r.status === 'active' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleUpdateStatus(r.id, 'revoked')}
                                  className="h-7 text-[11px] rounded-lg text-emerald-600 hover:bg-emerald-50 border-emerald-200"
                                >
                                  Cabut SP
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteSP(r.id)}
                                className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-rose-600"
                                title="Hapus Data"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
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

      {/* Geofence Perimeter Violations Audit Trail */}
      {violations.length > 0 && (
        <Card className="border-border bg-card shadow-xs">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <MapPin className="w-4 h-4 text-rose-600" />
              Audit Trail Insiden Perimeter Breach (Geofence)
            </CardTitle>
            <CardDescription className="text-xs">
              Deteksi otomatis karyawan yang meninggalkan perimeter area tugas saat jam operasional.
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-4">
            <div className="border border-border rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs text-foreground">
                <thead className="bg-muted/40 border-b border-border uppercase text-[11px] text-muted-foreground font-semibold">
                  <tr>
                    <th className="py-3 px-4">Karyawan</th>
                    <th className="py-3 px-4">Divisi</th>
                    <th className="py-3 px-4 text-center">Waktu Deteksi</th>
                    <th className="py-3 px-4 text-center">Jarak di Luar Area</th>
                    <th className="py-3 px-4">Status & Catatan Resolusi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {violations.slice(0, 10).map((v) => (
                    <tr key={v.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-semibold text-foreground">
                        {v.userName} ({v.nip || '-'})
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {v.divisionName || '-'}
                      </td>
                      <td className="py-3 px-4 text-center font-mono">
                        {v.detectedAt ? new Date(v.detectedAt).toLocaleString('id-ID') : '-'}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-rose-600">
                        {Math.round(v.distanceMeters || 0)} Meter
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        <Badge
                          variant="outline"
                          className={v.status === 'active' ? 'bg-rose-50 text-rose-700 border-rose-300' : 'bg-muted text-muted-foreground'}
                        >
                          {v.status === 'active' ? 'Pelanggaran Aktif' : 'Terselesaikan'}
                        </Badge>
                        {v.resolutionNotes && <span className="ml-2 text-[11px]">({v.resolutionNotes})</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal Terbitkan SP */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              Penerbitan Surat Peringatan (SP) Resmi
            </DialogTitle>
            <DialogDescription className="text-xs">
              Terbitkan sanksi pelanggaran kedisiplinan resmi untuk karyawan yang melanggar aturan kerja.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Pilih Karyawan</Label>
              <Select value={userId} onValueChange={setUserId}>
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
                <Label className="text-xs font-semibold">Tingkat Sanksi</Label>
                <Select value={spType} onValueChange={(val: SpType) => setSpType(val)}>
                  <SelectTrigger className="h-9 text-xs rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tegoran_lisan">Teguran Lisan</SelectItem>
                    <SelectItem value="sp1">Surat Peringatan I (SP 1)</SelectItem>
                    <SelectItem value="sp2">Surat Peringatan II (SP 2)</SelectItem>
                    <SelectItem value="sp3">Surat Peringatan III (SP 3 / Terakhir)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Nomor Surat</Label>
                <Input
                  value={letterNumber}
                  onChange={(e) => setLetterNumber(e.target.value)}
                  className="h-9 text-xs rounded-xl font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Tanggal Terbit</Label>
                <Input
                  type="date"
                  value={violationDate}
                  onChange={(e) => setViolationDate(e.target.value)}
                  className="h-9 text-xs rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Masa Berlaku Hingga</Label>
                <Input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="h-9 text-xs rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Jenis Pelanggaran</Label>
              <Input
                placeholder="Contoh: Keterlambatan kumulatif > 120 menit..."
                value={violationType}
                onChange={(e) => setViolationType(e.target.value)}
                className="h-9 text-xs rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Uraian / Kronologi Pelanggaran</Label>
              <Input
                placeholder="Deskripsikan secara objektif kronologi pelanggaran..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="h-9 text-xs rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Sanksi / Pembinaan</Label>
              <Input
                placeholder="Sanksi yang dijatuhkan..."
                value={sanction}
                onChange={(e) => setSanction(e.target.value)}
                className="h-9 text-xs rounded-xl"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setModalOpen(false)} className="rounded-xl">
              Batal
            </Button>
            <Button
              size="sm"
              onClick={handleSaveSP}
              disabled={isSubmitting}
              className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold"
            >
              {isSubmitting ? 'Menerbitkan...' : 'Terbitkan Sanksi SP'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
