import React, { useState, useEffect, useMemo } from 'react';
import { hrmService } from '@/services/hrmService';
import { api } from '@/services/apiClient';
import { EmployeeKpiRecord, KpiGrade, UserProfile, AttendanceRecord } from '@/types/hrm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { MonthPicker } from '@/components/ui/month-picker';
import { toast } from 'sonner';
import {
  Award,
  TrendingUp,
  Search,
  RefreshCw,
  Edit2,
  Plus,
  CheckCircle2,
  AlertCircle,
  FileText,
  UserX,
  UserCheck,
  Clock,
  ShieldAlert,
  Info,
} from 'lucide-react';

export const HrmKinerjaManagementTab: React.FC = () => {
  const currentMonthStr = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [selectedDivision, setSelectedDivision] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterEvaluationStatus, setFilterEvaluationStatus] = useState<string>('all'); // all | evaluated | pending | not_enrolled
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [divisions, setDivisions] = useState<any[]>([]);
  const [kpiList, setKpiList] = useState<EmployeeKpiRecord[]>([]);
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Evaluation Modal
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [existingKpi, setExistingKpi] = useState<EmployeeKpiRecord | null>(null);
  const [manualAttScore, setManualAttScore] = useState<number | null>(null);
  const [opScore, setOpScore] = useState<number>(85);
  const [compScore, setCompScore] = useState<number>(85);
  const [feedback, setFeedback] = useState<string>('Pencapaian target operasional baik dan disiplin dalam bertugas.');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const selectedMonthLabel = useMemo(() => {
    const parts = (selectedMonth || currentMonthStr).split('-').map(Number);
    const d = new Date(parts[0] || new Date().getFullYear(), (parts[1] || 1) - 1, 1);
    return d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  }, [selectedMonth, currentMonthStr]);

  // Cek apakah karyawan sudah melakukan pendaftaran (enrollment biometrik wajah)
  const isUserEnrolled = (u: UserProfile) => {
    return Boolean(
      u.faceEnrolledPhoto ||
      (u as any).face_enrolled_photo ||
      (u as any).facePhotoUrl ||
      (u as any).face_photo_url ||
      u.avatarUrl
    );
  };

  // Kalkulasi rekam jejak presensi aktual di bulan terpilih
  const getUserMonthAttendanceStats = (u: UserProfile) => {
    const enrolled = isUserEnrolled(u);
    const userAtts = attendances.filter((a) => {
      const isUser =
        a.userId === u.id ||
        a.userId === u.nip ||
        (a.userNip && a.userNip === u.nip) ||
        (a.userId && a.userId === u.email);
      const aDate = a.attendanceDate || (a as any).date;
      return isUser && aDate && aDate.startsWith(selectedMonth);
    });

    if (!enrolled) {
      return {
        isEnrolled: false,
        hasAttendance: false,
        totalDays: 0,
        onTimeDays: 0,
        lateDays: 0,
        totalLateMinutes: 0,
        breaches: 0,
        attendanceScore: null,
        statusText: 'Belum Terdaftar / Belum Enroll',
      };
    }

    if (userAtts.length === 0) {
      return {
        isEnrolled: true,
        hasAttendance: false,
        totalDays: 0,
        onTimeDays: 0,
        lateDays: 0,
        totalLateMinutes: 0,
        breaches: 0,
        attendanceScore: 0,
        statusText: 'Nihil Presensi (0 Hari)',
      };
    }

    const onTimeDays = userAtts.filter((a) => a.status === 'hadir').length;
    const lateAtts = userAtts.filter((a) => a.status === 'terlambat' || (a.lateMinutes && a.lateMinutes > 0));
    const lateDays = lateAtts.length;
    const totalLateMinutes = userAtts.reduce((sum, a) => sum + (a.lateMinutes || 0), 0);
    const breaches = userAtts.reduce((sum, a) => sum + (a.perimeterBreachCount || (a.isPerimeterBreached ? 1 : 0)), 0);

    // Deteksi Mangkir (Alfa / Alpa / Tidak hadir tanpa keterangan)
    const alfaAtts = userAtts.filter((a) => a.status === 'alfa' || a.status === 'alpa' || a.status === 'alpha');
    const alfaDays = alfaAtts.length;

    // Formula presensi berbasis hari kerja efektif bulan berjalan (patokan 22 hari kerja standar)
    const effectiveDays = onTimeDays * 1.0 + lateDays * 0.75;
    let score = Math.round((effectiveDays / 22) * 100);
    if (score > 100) score = 100;

    // Penalti MANGKIR (Alfa): -20 Poin per hari mangkir (Strict Kebijakan PT FRP)
    if (alfaDays > 0) {
      score = Math.max(0, score - (alfaDays * 20));
    }

    // Penalti akumulasi keterlambatan
    if (totalLateMinutes > 120) score = Math.max(0, score - 10);
    else if (totalLateMinutes > 60) score = Math.max(0, score - 5);

    // Penalti perimeter breach
    score = Math.max(0, score - breaches * 5);

    return {
      isEnrolled: true,
      hasAttendance: true,
      totalDays: userAtts.length,
      onTimeDays,
      lateDays,
      alfaDays,
      totalLateMinutes,
      breaches,
      attendanceScore: score,
      statusText: alfaDays > 0 
        ? `${score}% (${userAtts.length} Hari, ${alfaDays} Mangkir)` 
        : `${score}% (${userAtts.length} Hari Hadir)`,
    };
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      // 1. Ambil daftar karyawan
      const usersRes = await api.get<{ success: boolean; data: UserProfile[] }>('/users');
      if (usersRes && usersRes.success && Array.isArray(usersRes.data)) {
        const active = usersRes.data.filter((u) => u.isActive);
        setUsers(active);
        hrmService.setInMemoryUsers(usersRes.data);
      } else {
        setUsers(hrmService.getUsers().filter((u) => u.isActive));
      }

      setDivisions(hrmService.getDivisions());

      // 2. Fetch KPI bulan terpilih langsung dari PostgreSQL VPS
      const kpiRes = await fetch(`/api/kpi?month=${selectedMonth}`);
      if (kpiRes.ok) {
        const kpiJson = await kpiRes.json();
        if (kpiJson.success && Array.isArray(kpiJson.data)) {
          setKpiList(kpiJson.data);
        } else {
          setKpiList(hrmService.getKpiRecords(selectedMonth));
        }
      } else {
        setKpiList(hrmService.getKpiRecords(selectedMonth));
      }

      // 3. Fetch presensi bulan terpilih langsung dari PostgreSQL VPS
      const attRes = await fetch(`/api/attendances?month=${selectedMonth}`);
      if (attRes.ok) {
        const attJson = await attRes.json();
        if (attJson.success && Array.isArray(attJson.data)) {
          setAttendances(attJson.data);
        } else {
          setAttendances(hrmService.getAttendances());
        }
      } else {
        setAttendances(hrmService.getAttendances());
      }
    } catch (e) {
      console.warn('Load KPI data error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const handleSync = () => loadData();
    window.addEventListener('hrm_kpi_updated', handleSync);
    window.addEventListener('hrm_data_updated', handleSync);
    window.addEventListener('hrm_attendance_updated', handleSync);
    return () => {
      window.removeEventListener('hrm_kpi_updated', handleSync);
      window.removeEventListener('hrm_data_updated', handleSync);
      window.removeEventListener('hrm_attendance_updated', handleSync);
    };
  }, [selectedMonth]);

  const handleOpenEvaluation = (user: UserProfile) => {
    setSelectedUser(user);
    const existing = kpiList.find((k) => k.userId === user.id);
    setExistingKpi(existing || null);

    const attStats = getUserMonthAttendanceStats(user);

    if (existing) {
      setManualAttScore(existing.attendanceScore);
      setOpScore(existing.operationalScore);
      setCompScore(existing.competencyScore);
      setFeedback(existing.feedback || '');
    } else {
      setManualAttScore(attStats.attendanceScore !== null ? attStats.attendanceScore : 0);
      setOpScore(80);
      setCompScore(80);
      if (!attStats.isEnrolled) {
        setFeedback('Catatan: Karyawan belum melakukan enrollment biometrik wajah resmi.');
      } else if (!attStats.hasAttendance) {
        setFeedback('Catatan: Belum ada log kehadiran di bulan ini. Evaluasi disesuaikan dengan penugasan.');
      } else {
        setFeedback('Pencapaian target operasional baik dan disiplin dalam bertugas.');
      }
    }
    setModalOpen(true);
  };

  const handleSaveEvaluation = async () => {
    if (!selectedUser) return;
    setIsSubmitting(true);
    try {
      const attStats = getUserMonthAttendanceStats(selectedUser);
      const effectiveAttScore = manualAttScore !== null ? manualAttScore : (attStats.attendanceScore || 0);

      // Formula Pembobotan Resmi: 30% Kehadiran + 50% Operasional + 20% Kompetensi
      const finalScore = Math.round(effectiveAttScore * 0.3 + opScore * 0.5 + compScore * 0.2);

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
        attendanceScore: effectiveAttScore,
        operationalScore: opScore,
        competencyScore: compScore,
        finalScore,
        grade,
        evaluatorName: 'Super Administrator',
        feedback,
        status: 'final',
      });

      if (res.success) {
        toast.success(`Evaluasi KPI untuk ${selectedUser.fullName || selectedUser.name} berhasil disimpan di database.`);
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

  // Filtered Users List with their KPI and Attendance Integrity Status
  const userRowData = useMemo(() => {
    return users.map((u) => {
      const kpi = kpiList.find((k) => k.userId === u.id);
      const attStats = getUserMonthAttendanceStats(u);
      const isEvaluated = Boolean(kpi);

      let statusCategory: 'evaluated' | 'pending' | 'zero_attendance' | 'not_enrolled' = 'pending';
      if (isEvaluated) {
        statusCategory = 'evaluated';
      } else if (!attStats.isEnrolled) {
        statusCategory = 'not_enrolled';
      } else if (!attStats.hasAttendance) {
        statusCategory = 'zero_attendance';
      } else {
        statusCategory = 'pending';
      }

      return {
        user: u,
        kpi,
        attStats,
        isEvaluated,
        statusCategory,
      };
    });
  }, [users, kpiList, attendances, selectedMonth]);

  const filteredRows = useMemo(() => {
    return userRowData.filter(({ user: u, statusCategory }) => {
      const uName = u.fullName || u.name || '';
      const uNip = u.nip || '';
      const uDiv = u.divisionName || u.division || '';

      const matchesSearch =
        uName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        uNip.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesDivision =
        selectedDivision === 'all' || uDiv.toLowerCase() === selectedDivision.toLowerCase();

      const matchesStatus =
        filterEvaluationStatus === 'all' || statusCategory === filterEvaluationStatus;

      return matchesSearch && matchesDivision && matchesStatus;
    });
  }, [userRowData, searchQuery, selectedDivision, filterEvaluationStatus]);

  // Calculate Real-World Valid Metrics (Tanpa Nilai Fiktif)
  const totalEmployees = users.length;
  const enrolledCount = users.filter((u) => isUserEnrolled(u)).length;
  const notEnrolledCount = totalEmployees - enrolledCount;
  const evaluatedCount = kpiList.length;
  const pendingCount = users.filter((u) => isUserEnrolled(u) && !kpiList.some((k) => k.userId === u.id)).length;
  const gradeACount = kpiList.filter((k) => k.grade === 'A').length;
  const gradeBCount = kpiList.filter((k) => k.grade === 'B').length;
  const gradeC_DCount = kpiList.filter((k) => k.grade === 'C' || k.grade === 'D').length;
  const avgFinalScore =
    evaluatedCount > 0
      ? Math.round(kpiList.reduce((acc, curr) => acc + (curr.finalScore || 0), 0) / evaluatedCount)
      : 0;

  return (
    <div className="space-y-6">
      {/* Metric Cards - Nilai Realistis Otoritatif Database */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <Card className="border-border bg-card shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Rata-rata Skor KPI</p>
              <p className="text-xl font-bold text-foreground">
                {evaluatedCount > 0 ? `${avgFinalScore}%` : '-'}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {evaluatedCount > 0 ? `Dari ${evaluatedCount} dinilai` : 'Belum ada penilaian'}
              </p>
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
              <p className="text-xl font-bold text-purple-600">
                {evaluatedCount} <span className="text-xs font-normal text-muted-foreground">/ {totalEmployees}</span>
              </p>
              <p className="text-[10px] text-muted-foreground">Periode {selectedMonthLabel}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Menunggu Penilaian</p>
              <p className="text-xl font-bold text-amber-600">{pendingCount} Orang</p>
              <p className="text-[10px] text-muted-foreground">Perlu evaluasi atasan</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Terdaftar Biometrik</p>
              <p className="text-xl font-bold text-emerald-600">{enrolledCount} Orang</p>
              <p className="text-[10px] text-muted-foreground">Wajah ter-enroll</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
              <UserX className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Belum Terdaftar</p>
              <p className="text-xl font-bold text-rose-600">{notEnrolledCount} Orang</p>
              <p className="text-[10px] text-muted-foreground">Belum enroll biometrik</p>
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
                Manajemen Kinerja &amp; Scorecard KPI Karyawan
              </CardTitle>
              <CardDescription className="text-xs">
                Penilaian terverifikasi database: Bobot Kehadiran Riil (30%) + Target Operasional Lapangan (50%) + Kompetensi (20%).
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
              Muat Ulang Data
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-4 space-y-4">
          {/* Filter Bar */}
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

            <div>
              <Select value={filterEvaluationStatus} onValueChange={setFilterEvaluationStatus}>
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue placeholder="Status Evaluasi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="evaluated">Sudah Dievaluasi</SelectItem>
                  <SelectItem value="pending">Menunggu Penilaian</SelectItem>
                  <SelectItem value="zero_attendance">Nihil Presensi (0 Hari)</SelectItem>
                  <SelectItem value="not_enrolled">Belum Terdaftar / Enroll</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tabel KPI Karyawan Transparan */}
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-foreground">
                <thead className="bg-muted/40 border-b border-border uppercase text-[11px] text-muted-foreground font-semibold">
                  <tr>
                    <th className="py-3 px-4">Karyawan</th>
                    <th className="py-3 px-4">Divisi &amp; Jabatan</th>
                    <th className="py-3 px-4 text-center">Skor Kehadiran (30%)</th>
                    <th className="py-3 px-4 text-center">Skor Lapangan (50%)</th>
                    <th className="py-3 px-4 text-center">Kompetensi (20%)</th>
                    <th className="py-3 px-4 text-center">Skor Akhir</th>
                    <th className="py-3 px-4 text-center">Predikat Grade</th>
                    <th className="py-3 px-4">Feedback Evaluator</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-muted-foreground">
                        Tidak ada data karyawan yang cocok dengan kriteria filter.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map(({ user: u, kpi, attStats, isEvaluated, statusCategory }) => {
                      return (
                        <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                          {/* Kolom Karyawan & Status Enrollment */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-xs shrink-0">
                                {u.fullName ? u.fullName.charAt(0) : 'K'}
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <p className="font-semibold text-foreground">{u.fullName || u.name}</p>
                                  {!attStats.isEnrolled && (
                                    <span className="w-2 h-2 rounded-full bg-rose-500" title="Belum Enroll Biometrik" />
                                  )}
                                </div>
                                <p className="text-[10px] text-muted-foreground font-mono">
                                  {u.nip || '-'} • {attStats.isEnrolled ? (
                                    <span className="text-emerald-600 font-sans">Terdaftar Biometrik</span>
                                  ) : (
                                    <span className="text-rose-500 font-sans font-medium">Belum Terdaftar</span>
                                  )}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Kolom Divisi */}
                          <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                            {u.divisionName || u.division || '-'}
                          </td>

                          {/* Kolom Skor Kehadiran (30%) */}
                          <td className="py-3 px-4 text-center font-mono font-medium">
                            {isEvaluated ? (
                              <Badge variant="outline" className="text-[11px] font-mono bg-emerald-50 text-emerald-700 border-emerald-200">
                                {kpi!.attendanceScore}%
                              </Badge>
                            ) : !attStats.isEnrolled ? (
                              <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground border-border">
                                Belum Terdaftar
                              </Badge>
                            ) : !attStats.hasAttendance ? (
                              <Badge variant="outline" className="text-[10px] bg-rose-50 text-rose-700 border-rose-200">
                                0% (0 Hari)
                              </Badge>
                            ) : (
                              <div className="flex flex-col items-center gap-1">
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] font-mono ${
                                    attStats.alfaDays && attStats.alfaDays > 0
                                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                                      : attStats.attendanceScore! >= 80
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : 'bg-amber-50 text-amber-700 border-amber-200'
                                  }`}
                                  title={`${attStats.totalDays} hari total (${attStats.onTimeDays} tepat waktu, ${attStats.lateDays} telat, ${attStats.alfaDays || 0} mangkir)`}
                                >
                                  {attStats.attendanceScore}% ({attStats.totalDays}h)
                                </Badge>
                                {attStats.alfaDays && attStats.alfaDays > 0 ? (
                                  <span className="text-[9px] font-bold text-rose-600 font-mono bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                                    {attStats.alfaDays}x Mangkir (-{attStats.alfaDays * 20}p)
                                  </span>
                                ) : null}
                              </div>
                            )}
                          </td>

                          {/* Kolom Skor Lapangan (50%) */}
                          <td className="py-3 px-4 text-center font-mono font-medium">
                            {isEvaluated ? `${kpi!.operationalScore}%` : <span className="text-muted-foreground/40">-</span>}
                          </td>

                          {/* Kolom Kompetensi (20%) */}
                          <td className="py-3 px-4 text-center font-mono font-medium">
                            {isEvaluated ? `${kpi!.competencyScore}%` : <span className="text-muted-foreground/40">-</span>}
                          </td>

                          {/* Kolom Skor Akhir */}
                          <td className="py-3 px-4 text-center font-mono font-bold">
                            {isEvaluated ? (
                              <span className="text-primary font-bold text-sm">{kpi!.finalScore}%</span>
                            ) : (
                              <span className="text-muted-foreground/40 font-normal">-</span>
                            )}
                          </td>

                          {/* Kolom Predikat Grade */}
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            {isEvaluated ? (
                              <Badge
                                className={`text-[11px] font-bold ${
                                  kpi!.grade === 'A'
                                    ? 'bg-emerald-600 text-white'
                                    : kpi!.grade === 'B'
                                    ? 'bg-sky-600 text-white'
                                    : 'bg-amber-500 text-white'
                                }`}
                              >
                                Grade {kpi!.grade}
                              </Badge>
                            ) : !attStats.isEnrolled ? (
                              <Badge variant="outline" className="text-[10px] bg-muted/60 text-muted-foreground border-border">
                                Belum Memenuhi Syarat
                              </Badge>
                            ) : !attStats.hasAttendance ? (
                              <Badge variant="outline" className="text-[10px] bg-rose-50 text-rose-700 border-rose-200">
                                Nihil Presensi
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 border-amber-500/30">
                                Menunggu Penilaian
                              </Badge>
                            )}
                          </td>

                          {/* Kolom Feedback */}
                          <td className="py-3 px-4 max-w-xs truncate text-[11px] text-muted-foreground">
                            {isEvaluated ? (
                              kpi!.feedback || 'Belum diisi ulasan feedback'
                            ) : !attStats.isEnrolled ? (
                              <span className="text-muted-foreground/50 italic">Karyawan belum melakukan pendaftaran wajah biometrik</span>
                            ) : !attStats.hasAttendance ? (
                              <span className="text-muted-foreground/50 italic">Karyawan belum pernah melakukan presensi di periode ini</span>
                            ) : (
                              <span className="text-amber-700/80 italic">Menunggu input evaluasi operasional &amp; kompetensi</span>
                            )}
                          </td>

                          {/* Kolom Aksi */}
                          <td className="py-3 px-4 text-right">
                            <Button
                              variant={isEvaluated ? 'outline' : 'default'}
                              size="sm"
                              onClick={() => handleOpenEvaluation(u)}
                              className={`h-7 text-[11px] rounded-lg gap-1 px-2.5 font-medium ${
                                !isEvaluated
                                  ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs'
                                  : 'border-border text-foreground hover:bg-muted'
                              }`}
                              title={isEvaluated ? 'Perbarui Evaluasi KPI' : 'Input Nilai Evaluasi KPI'}
                            >
                              {isEvaluated ? (
                                <>
                                  <Edit2 className="w-3 h-3 text-primary" />
                                  <span>Edit Nilai</span>
                                </>
                              ) : (
                                <>
                                  <Plus className="w-3 h-3" />
                                  <span>Beri Nilai KPI</span>
                                </>
                              )}
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

      {/* Modal Evaluasi KPI Interaktif */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md rounded-2xl border border-border shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-foreground">
              <Award className="w-4 h-4 text-primary" />
              Evaluasi Kinerja (KPI) Periode {selectedMonthLabel}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Masukkan pembobotan nilai operasional dan kompetensi karyawan. Skor kehadiran disinkronkan otomatis dari database presensi.
            </DialogDescription>
          </DialogHeader>

          {selectedUser && (() => {
            const attStats = getUserMonthAttendanceStats(selectedUser);
            const effectiveAttScore = manualAttScore !== null ? manualAttScore : (attStats.attendanceScore || 0);
            const liveFinalScore = Math.round(effectiveAttScore * 0.3 + opScore * 0.5 + compScore * 0.2);
            let liveGrade: KpiGrade = 'B';
            if (liveFinalScore >= 90) liveGrade = 'A';
            else if (liveFinalScore >= 75) liveGrade = 'B';
            else if (liveFinalScore >= 60) liveGrade = 'C';
            else liveGrade = 'D';

            return (
              <div className="space-y-4 py-1 text-xs">
                {/* Info Karyawan & Audit Kehadiran Database */}
                <div className="p-3 bg-muted/40 rounded-xl border border-border space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-foreground text-sm">{selectedUser.fullName || selectedUser.name}</p>
                      <p className="text-muted-foreground font-mono text-[11px]">
                        NIP: {selectedUser.nip || '-'} • Divisi: {selectedUser.divisionName || selectedUser.division || '-'}
                      </p>
                    </div>
                    {attStats.isEnrolled ? (
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                        Terdaftar Biometrik
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 text-[10px]">
                        Belum Terdaftar
                      </Badge>
                    )}
                  </div>

                  {/* Audit Kehadiran Riil */}
                  <div className="p-2.5 rounded-lg bg-background/80 border border-border/80 space-y-1 text-[11px]">
                    <div className="flex items-center justify-between font-semibold text-foreground">
                      <span>Audit Presensi Bulan {selectedMonthLabel}:</span>
                      <span className="font-mono text-primary font-bold">
                        {attStats.hasAttendance ? `${attStats.totalDays} Hari Hadir` : '0 Hari Hadir (Nihil)'}
                      </span>
                    </div>
                    <div className="text-[10px] text-muted-foreground flex items-center justify-between">
                      <span>Tepat Waktu: {attStats.onTimeDays} • Terlambat: {attStats.lateDays} ({attStats.totalLateMinutes} mnt)</span>
                      <span>Pelanggaran Perimeter: {attStats.breaches}x</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border flex items-center justify-between text-[11px]">
                    <span className="font-medium text-foreground">Skor Kehadiran Riil (Bobot 30%):</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold font-mono text-sm text-primary">{effectiveAttScore}%</span>
                    </div>
                  </div>
                </div>

                {!attStats.isEnrolled && (
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-[11px] flex items-center gap-2">
                    <Info size={16} className="shrink-0" />
                    <span>Perhatian: Karyawan ini belum mendaftarkan wajah biometrik di sistem. Nilai kehadiran dasar dimulai dari 0%.</span>
                  </div>
                )}

                {/* Input Skor Operasional */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs font-semibold">Skor Operasional &amp; Target Lapangan (Bobot 50%)</Label>
                    <span className="font-mono font-bold text-primary">{opScore}%</span>
                  </div>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={opScore}
                    onChange={(e) => setOpScore(Math.min(100, Math.max(0, Number(e.target.value))))}
                    className="h-9 text-xs rounded-xl font-mono"
                  />
                  <p className="text-[10px] text-muted-foreground">Kepatuhan POS tugas, ketepatan patroli lapangan, dan penyelesaian instruksi kerja.</p>
                </div>

                {/* Input Skor Kompetensi */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs font-semibold">Skor Kompetensi &amp; Integritas (Bobot 20%)</Label>
                    <span className="font-mono font-bold text-primary">{compScore}%</span>
                  </div>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={compScore}
                    onChange={(e) => setCompScore(Math.min(100, Math.max(0, Number(e.target.value))))}
                    className="h-9 text-xs rounded-xl font-mono"
                  />
                  <p className="text-[10px] text-muted-foreground">Kepatuhan atribut seragam, kerjasama tim, dan etika kerja.</p>
                </div>

                {/* Live Preview Skor Akhir & Grade */}
                <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-muted-foreground">Kalkulasi Skor Akhir KPI</p>
                    <p className="text-lg font-bold font-mono text-primary">{liveFinalScore}%</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-muted-foreground">Predikat Grade</p>
                    <Badge
                      className={`text-xs font-bold ${
                        liveGrade === 'A'
                          ? 'bg-emerald-600 text-white'
                          : liveGrade === 'B'
                          ? 'bg-sky-600 text-white'
                          : 'bg-amber-500 text-white'
                      }`}
                    >
                      Grade {liveGrade}
                    </Badge>
                  </div>
                </div>

                {/* Feedback Evaluator */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Ulasan &amp; Arahan Evaluator</Label>
                  <Input
                    placeholder="Catatan evaluasi kinerja, arahan target, atau rekomendasi..."
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    className="h-9 text-xs rounded-xl"
                  />
                </div>
              </div>
            );
          })()}

          <DialogFooter className="gap-2 pt-2 border-t border-border">
            <Button variant="outline" size="sm" onClick={() => setModalOpen(false)} className="rounded-xl text-xs">
              Batal
            </Button>
            <Button
              size="sm"
              onClick={handleSaveEvaluation}
              disabled={isSubmitting}
              className="rounded-xl bg-primary text-primary-foreground font-semibold text-xs shadow-xs"
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan Penilaian KPI'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
