import React, { useState, useEffect } from 'react';
import { hrmService } from '@/services/hrmService';
import { EmployeeKpiRecord, KpiGrade, UserProfile } from '@/types/hrm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { MonthPicker } from '@/components/ui/month-picker';
import { customNotify } from '@/lib/customNotification';
import {
  Award,
  TrendingUp,
  Search,
  Filter,
  RefreshCw,
  Edit2,
  Plus,
  CheckCircle2,
  AlertCircle,
  FileText,
} from 'lucide-react';

export const HrmKinerjaManagementTab: React.FC = () => {
  const currentMonthStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [selectedDivision, setSelectedDivision] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [divisions, setDivisions] = useState<any[]>([]);
  const [kpiList, setKpiList] = useState<EmployeeKpiRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Evaluation Modal
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [existingKpi, setExistingKpi] = useState<EmployeeKpiRecord | null>(null);
  const [opScore, setOpScore] = useState<number>(85);
  const [compScore, setCompScore] = useState<number>(85);
  const [feedback, setFeedback] = useState<string>('Pencapaian target operasional baik dan disiplin dalam bertugas.');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const loadData = () => {
    setIsLoading(true);
    setUsers(hrmService.getUsers());
    setDivisions(hrmService.getDivisions());
    const kpis = hrmService.getKpiRecords(selectedMonth);
    setKpiList(kpis);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
    const handleSync = () => loadData();
    window.addEventListener('hrm_kpi_updated', handleSync);
    window.addEventListener('hrm_data_updated', handleSync);
    return () => {
      window.removeEventListener('hrm_kpi_updated', handleSync);
      window.removeEventListener('hrm_data_updated', handleSync);
    };
  }, [selectedMonth]);

  // Compute auto discipline score from attendance history
  const getComputedDisciplineScore = (userId: string) => {
    const attendances = hrmService.getAttendances();
    const userAtts = attendances.filter((a) => a.userId === userId);
    if (userAtts.length === 0) return 95; // Default good base

    const lateCount = userAtts.filter((a) => a.status === 'terlambat').length;
    const alphaCount = userAtts.filter((a) => a.status === 'alpha').length;
    const score = Math.max(100 - lateCount * 2 - alphaCount * 10, 40);
    return score;
  };

  const handleOpenEvaluation = (user: UserProfile) => {
    setSelectedUser(user);
    const existing = kpiList.find((k) => k.userId === user.id);
    setExistingKpi(existing || null);

    if (existing) {
      setOpScore(existing.operationalScore);
      setCompScore(existing.competencyScore);
      setFeedback(existing.feedback || '');
    } else {
      setOpScore(85);
      setCompScore(85);
      setFeedback('Kinerja operasional memuaskan dan memenuhi standar disiplin kerja.');
    }
    setModalOpen(true);
  };

  const handleSaveEvaluation = async () => {
    if (!selectedUser) return;
    setIsSubmitting(true);
    try {
      const attScore = getComputedDisciplineScore(selectedUser.id);
      // Formula: 30% Kehadiran + 50% Operasional + 20% Kompetensi
      const finalScore = Math.round(attScore * 0.3 + opScore * 0.5 + compScore * 0.2);
      let grade: KpiGrade = 'B';
      if (finalScore >= 90) grade = 'A';
      else if (finalScore >= 75) grade = 'B';
      else if (finalScore >= 60) grade = 'C';
      else grade = 'D';

      const res = await hrmService.saveKpiRecord({
        userId: selectedUser.id,
        userName: selectedUser.fullName || selectedUser.name,
        userNip: selectedUser.nip || '',
        divisionName: selectedUser.divisionName || selectedUser.division || '-',
        periodMonth: selectedMonth,
        attendanceScore: attScore,
        operationalScore: opScore,
        competencyScore: compScore,
        finalScore,
        grade,
        evaluatorName: 'Super Administrator',
        feedback,
        status: 'final',
      });

      if (res.success) {
        toast.success(`Evaluasi KPI untuk ${selectedUser.fullName} berhasil disimpan di database.`);
        setModalOpen(false);
        loadData();
      } else {
        toast.error(res.error || 'Gagal menyimpan KPI');
      }
    } catch (err: any) {
      toast.error('Terjadi kesalahan sistem saat menyimpan');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered Users List with their KPI
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

  // Calculate Metrics
  const evaluatedCount = kpiList.length;
  const gradeACount = kpiList.filter((k) => k.grade === 'A').length;
  const gradeBCount = kpiList.filter((k) => k.grade === 'B').length;
  const gradeC_DCount = kpiList.filter((k) => k.grade === 'C' || k.grade === 'D').length;
  const avgFinalScore =
    evaluatedCount > 0 ? Math.round(kpiList.reduce((acc, curr) => acc + curr.finalScore, 0) / evaluatedCount) : 0;

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <Card className="border-border bg-card shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Rata-rata Skor KPI</p>
              <p className="text-xl font-bold text-foreground">{avgFinalScore}%</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Predikat Grade A</p>
              <p className="text-xl font-bold text-emerald-600">{gradeACount} Orang</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-600 flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Predikat Grade B</p>
              <p className="text-xl font-bold text-sky-600">{gradeBCount} Orang</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Perlu Bimbingan (C/D)</p>
              <p className="text-xl font-bold text-amber-600">{gradeC_DCount} Orang</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Telah Dievaluasi</p>
              <p className="text-xl font-bold text-purple-600">{evaluatedCount}/{users.length}</p>
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
                <Award className="w-4 h-4 text-primary" />
                Manajemen Kinerja & Scorecard KPI Karyawan
              </CardTitle>
              <CardDescription className="text-xs">
                Integrasi otomatis metrik kehadiran database (bobot 30%) dengan pencapaian operasional lapangan (50%) dan kompetensi (20%).
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
                placeholder="Cari nama atau NIP..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs rounded-xl"
              />
            </div>

            <div>
              <MonthPicker
                value={selectedMonth}
                onChange={(m) => setSelectedMonth(m)}
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
                    <th className="py-3 px-4 text-center">Skor Kehadiran (30%)</th>
                    <th className="py-3 px-4 text-center">Skor Lapangan (50%)</th>
                    <th className="py-3 px-4 text-center">Kompetensi (20%)</th>
                    <th className="py-3 px-4 text-center">Skor Akhir</th>
                    <th className="py-3 px-4 text-center">Grade</th>
                    <th className="py-3 px-4">Feedback Evaluator</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-muted-foreground">
                        Tidak ada karyawan ditemukan.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const kpi = kpiList.find((k) => k.userId === u.id);
                      const attScore = kpi ? kpi.attendanceScore : getComputedDisciplineScore(u.id);
                      const finalScore = kpi ? kpi.finalScore : Math.round(attScore * 0.3 + 85 * 0.5 + 85 * 0.2);
                      const grade = kpi ? kpi.grade : finalScore >= 90 ? 'A' : finalScore >= 75 ? 'B' : 'C';

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
                          <td className="py-3 px-4 text-center font-mono font-medium">
                            <span className={attScore >= 80 ? 'text-emerald-600' : 'text-amber-600'}>
                              {attScore}%
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-medium">
                            {kpi ? `${kpi.operationalScore}%` : '-'}
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-medium">
                            {kpi ? `${kpi.competencyScore}%` : '-'}
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-bold text-primary">
                            <div className="flex items-center justify-center gap-1.5">
                              <span>{finalScore}%</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <Badge
                              className={`text-[11px] font-bold ${
                                grade === 'A'
                                  ? 'bg-emerald-600 text-white'
                                  : grade === 'B'
                                  ? 'bg-sky-600 text-white'
                                  : 'bg-amber-500 text-white'
                              }`}
                            >
                              Grade {grade}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 max-w-xs truncate text-[11px] text-muted-foreground">
                            {kpi?.feedback || 'Belum diisi ulasan feedback'}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenEvaluation(u)}
                              className="h-7 text-[11px] rounded-lg gap-1 px-2.5"
                            >
                              <Edit2 className="w-3 h-3 text-primary" />
                              {kpi ? 'Edit KPI' : 'Evaluasi'}
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

      {/* Modal Evaluasi KPI */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Award className="w-4 h-4 text-primary" />
              Evaluasi Kinerja (KPI) Periode {selectedMonth}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Masukkan pembobotan nilai operasional, kompetensi, dan catatan coaching untuk karyawan.
            </DialogDescription>
          </DialogHeader>

          {selectedUser && (
            <div className="space-y-4 py-2 text-xs">
              <div className="p-3 bg-muted/40 rounded-xl border border-border">
                <p className="font-semibold text-foreground">{selectedUser.fullName || selectedUser.name}</p>
                <p className="text-muted-foreground font-mono text-[11px]">NIP: {selectedUser.nip || '-'} • Divisi: {selectedUser.divisionName || selectedUser.division || '-'}</p>
                <div className="mt-2 pt-2 border-t border-border flex items-center justify-between text-[11px]">
                  <span>Skor Kehadiran Riil Database (Bobot 30%):</span>
                  <span className="font-bold text-primary">{getComputedDisciplineScore(selectedUser.id)}%</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <Label className="text-xs font-semibold">Skor Operasional & Target Lapangan (Bobot 50%)</Label>
                  <span className="font-mono font-bold text-primary">{opScore}%</span>
                </div>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={opScore}
                  onChange={(e) => setOpScore(Number(e.target.value))}
                  className="h-9 text-xs rounded-xl font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <Label className="text-xs font-semibold">Skor Kompetensi & Integritas (Bobot 20%)</Label>
                  <span className="font-mono font-bold text-primary">{compScore}%</span>
                </div>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={compScore}
                  onChange={(e) => setCompScore(Number(e.target.value))}
                  className="h-9 text-xs rounded-xl font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Feedback & Evaluasi Pimpinan</Label>
                <Input
                  placeholder="Catatan evaluasi kinerja, arahan, atau rekomendasi promosi..."
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  className="h-9 text-xs rounded-xl"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setModalOpen(false)} className="rounded-xl">
              Batal
            </Button>
            <Button
              size="sm"
              onClick={handleSaveEvaluation}
              disabled={isSubmitting}
              className="rounded-xl bg-primary text-primary-foreground font-semibold"
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan Penilaian KPI'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
