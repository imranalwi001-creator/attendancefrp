import React, { useState, useEffect } from 'react';
import { useHrmAuth } from '@/contexts/HrmAuthContext';
import { hrmService, getTodayDateStr } from '@/services/hrmService';
import { api } from '@/services/apiClient';
import {
  Briefcase,
  Building2,
  FileCheck2,
  Users,
  CheckCircle2,
  TrendingUp,
  Clock,
  Award,
  CalendarDays,
  FileSpreadsheet,
  ArrowRight,
  Target,
  ShieldAlert,
  Banknote,
  Wallet,
  CreditCard,
  DollarSign,
  Search,
  Filter,
  AlertTriangle,
  Sparkles,
  ChevronRight,
  Printer,
  Calendar,
  Layers,
  Activity,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link } from 'react-router-dom';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
} from 'recharts';

export const HrmPimpinanDashboard: React.FC = () => {
  const { user } = useHrmAuth();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  // Basic States
  const [divisions, setDivisions] = useState(hrmService.getDivisions());
  const [users, setUsers] = useState(hrmService.getUsers());
  const [todayAttendances, setTodayAttendances] = useState(hrmService.getAttendances(getTodayDateStr()));
  const [pendingLeaves, setPendingLeaves] = useState(
    hrmService.getLeaves().filter((l) => l.status === 'pending')
  );
  const [activeBreachCount, setActiveBreachCount] = useState(0);

  // Executive Radar Analytics State from Database
  const [radarData, setRadarData] = useState<any>(null);
  const [loadingRadar, setLoadingRadar] = useState(false);

  // Field Recap Roster State (Individual drill-down)
  const [rosterData, setRosterData] = useState<any[]>([]);
  const [rosterDivisionFilter, setRosterDivisionFilter] = useState<string>('all');
  const [rosterSearch, setRosterSearch] = useState<string>('');
  const [loadingRoster, setLoadingRoster] = useState(false);

  // Financial aggregates
  const [salaryProfiles, setSalaryProfiles] = useState(hrmService.getSalaryProfiles());
  const [overtimeAnalytics, setOvertimeAnalytics] = useState(hrmService.getOvertimeAnalytics());

  const loadExecutiveData = async () => {
    setLoadingRadar(true);
    try {
      const res = await hrmService.getExecutiveRadar({ year: selectedYear });
      if (res && res.success && res.data) {
        setRadarData(res.data);
      }
    } catch (e) {
      console.warn('Failed to load executive radar:', e);
    } finally {
      setLoadingRadar(false);
    }

    setLoadingRoster(true);
    try {
      const recapRes = await hrmService.getFieldRecap({ period: 'year' });
      if (recapRes && recapRes.success && recapRes.data?.roster) {
        setRosterData(recapRes.data.roster);
      }
    } catch (e) {
      console.warn('Failed to load roster:', e);
    } finally {
      setLoadingRoster(false);
    }
  };

  useEffect(() => {
    setDivisions(hrmService.getDivisions());
    setUsers(hrmService.getUsers());
    setTodayAttendances(hrmService.getAttendances(getTodayDateStr()));
    setPendingLeaves(hrmService.getLeaves().filter((l) => l.status === 'pending'));

    const violations = hrmService.getPerimeterViolations();
    setActiveBreachCount(violations.filter((v) => v.status === 'active').length);
    setOvertimeAnalytics(hrmService.getOvertimeAnalytics());

    loadExecutiveData();

    // Live sync salary profiles
    api.get<{ success: boolean; data: any[] }>('/payroll/profiles')
      .then((res) => {
        if (res && res.success && Array.isArray(res.data)) {
          const mapped = res.data.map((sp: any) => ({
            id: sp.id,
            userId: sp.user_id,
            baseSalary: Number(sp.base_salary) || 4045050,
            positionAllowance: Number(sp.position_allowance) || 0,
            transportAllowance: Number(sp.transport_allowance) || 0,
            mealAllowance: Number(sp.meal_allowance) || 0,
            housingAllowance: 0,
            healthAllowance: 0,
            otherAllowances: [],
            taxSetting: sp.tax_setting || 'gross',
            employeeType: sp.employee_type || 'tetap',
            bankName: sp.bank_name || '',
            bankAccount: sp.bank_account_number || '',
            bankAccountName: sp.bank_account_holder || '',
            effectiveDate: '',
          }));
          setSalaryProfiles(mapped);
        }
      })
      .catch(() => {});
  }, [selectedYear]);

  // KPIs
  const totalEmployees = radarData?.kpis?.totalEmployees ?? users.length;
  const todayHadir = radarData?.kpis?.todayHadir ?? todayAttendances.length;
  const todayTepat = radarData?.kpis?.todayTepat ?? todayAttendances.filter((a) => a.status === 'hadir').length;
  const todayLate = radarData?.kpis?.todayLate ?? todayAttendances.filter((a) => a.status === 'terlambat').length;
  const attendanceRate = radarData?.kpis?.todayAttendanceRate ?? (totalEmployees > 0 ? Math.round((todayHadir / totalEmployees) * 100) : 0);
  const onTimeRateToday = radarData?.kpis?.todayPunctualityRate ?? (todayHadir > 0 ? Math.round((todayTepat / todayHadir) * 100) : 100);

  // Financial Formatting
  const fmtRp = (n: number) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(n);

  const totalBaseSalary = salaryProfiles.length > 0
    ? salaryProfiles.reduce((acc, p) => acc + (p.baseSalary || 0) + (p.positionAllowance || 0) + (p.transportAllowance || 0), 0)
    : users.length * 4045050;
  const approvedOvertimeBudget = overtimeAnalytics.approvedPay || 0;
  const estimatedBpjs = Math.round(totalBaseSalary * 0.04);
  const estimatedTotalPayroll = totalBaseSalary + approvedOvertimeBudget + estimatedBpjs;

  // Filtered Roster for individual drilldown
  const filteredRoster = rosterData.filter((r) => {
    const matchDiv = rosterDivisionFilter === 'all' || r.division_id === rosterDivisionFilter || r.division_name === rosterDivisionFilter;
    const matchSearch = !rosterSearch.trim() ||
      r.full_name?.toLowerCase().includes(rosterSearch.toLowerCase()) ||
      r.nip?.toLowerCase().includes(rosterSearch.toLowerCase()) ||
      r.division_name?.toLowerCase().includes(rosterSearch.toLowerCase());
    return matchDiv && matchSearch;
  });

  // Watchlist & Top Performers
  const watchlist = [...rosterData]
    .sort((a, b) => (Number(b.total_mangkir) * 10 + Number(b.total_terlambat)) - (Number(a.total_mangkir) * 10 + Number(a.total_terlambat)))
    .filter((r) => Number(r.total_mangkir) > 0 || Number(r.total_terlambat) > 1)
    .slice(0, 4);

  const topPerformers = [...rosterData]
    .sort((a, b) => Number(b.tepat_waktu) - Number(a.tepat_waktu))
    .filter((r) => Number(r.total_mangkir) === 0)
    .slice(0, 4);

  return (
    <div className="space-y-6">
      {/* Pimpinan / Dirut Executive Header Card */}
      <div className="bg-gradient-to-br from-card via-card to-primary/5 border border-border rounded-2xl p-6 md:p-7 text-foreground shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold border border-primary/20">
              <Briefcase className="w-3.5 h-3.5" />
              <span>Portal Eksekutif Direktur Utama & Pimpinan FRP</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
              Dashboard Analisis Kinerja & Radar Eksekutif
            </h1>
            <p className="text-muted-foreground text-xs md:text-sm max-w-2xl">
              Tolak ukur progres kinerja karyawan menyeluruh, pola operasional seluruh divisi dan per individu secara realtime untuk penentuan kebijakan strategis.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
              <SelectTrigger className="h-9 text-xs w-[120px] rounded-xl font-semibold border-border">
                <Calendar className="w-3.5 h-3.5 mr-1.5 text-primary" />
                <SelectValue placeholder="Tahun" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2026">Tahun 2026</SelectItem>
                <SelectItem value="2025">Tahun 2025</SelectItem>
                <SelectItem value="2024">Tahun 2024</SelectItem>
              </SelectContent>
            </Select>

            <Link to="/admin/approval">
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-sm rounded-xl gap-1.5 h-9">
                <FileCheck2 className="w-3.5 h-3.5" />
                Persetujuan Direksi ({pendingLeaves.length})
              </Button>
            </Link>

            <Link to="/admin/laporan">
              <Button variant="outline" className="border-border hover:bg-muted text-foreground text-xs font-semibold rounded-xl gap-1.5 h-9">
                <FileSpreadsheet className="w-3.5 h-3.5 text-primary" />
                Laporan & Cetak
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Perimeter Breach Alert for Executives */}
      {activeBreachCount > 0 && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-rose-600 text-white shrink-0 animate-bounce">
              <ShieldAlert size={18} />
            </div>
            <div>
              <p className="font-bold text-rose-950 dark:text-rose-100 text-sm">
                Radar Integritas: {activeBreachCount} Karyawan Terdeteksi Di Luar Radius Penugasan
              </p>
              <p className="text-rose-800 dark:text-rose-300 text-xs mt-0.5">
                Sistem mendeteksi deviasi posisi GPS dari seluruh pos penugasan aktif dan mencatatnya ke audit trail kedisiplinan.
              </p>
            </div>
          </div>
          <Link to="/admin/monitoring">
            <Button size="sm" variant="destructive" className="rounded-xl text-xs h-8 px-3 font-semibold shrink-0 gap-1.5 shadow-xs">
              <ShieldAlert className="w-3.5 h-3.5" />
              Buka Radar Monitoring
            </Button>
          </Link>
        </div>
      )}

      {/* KPI Cards - 5-Column Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <Card className="border-border bg-card rounded-xl shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Tingkat Kehadiran Hari Ini</p>
              <Target className="w-4 h-4 text-primary" />
            </div>
            <p className="text-2xl font-bold text-foreground mt-1.5">{attendanceRate}%</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {todayHadir} dari {totalEmployees} Personil
            </p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card rounded-xl shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Rasio Ketepatan Waktu</p>
              <Award className="w-4 h-4 text-primary" />
            </div>
            <p className="text-2xl font-bold text-emerald-600 mt-1.5">{onTimeRateToday}%</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {todayLate} Terlambat hari ini
            </p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card rounded-xl shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Unit Kerja / Divisi</p>
              <Building2 className="w-4 h-4 text-primary" />
            </div>
            <p className="text-2xl font-bold text-foreground mt-1.5">{divisions.length} Unit</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Terpantau aktif di sistem
            </p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card rounded-xl shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Permohonan Cuti & SPL</p>
              <FileCheck2 className="w-4 h-4 text-primary" />
            </div>
            <p className="text-2xl font-bold text-amber-600 mt-1.5">{pendingLeaves.length} Berkas</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Menunggu keputusan
            </p>
          </CardContent>
        </Card>

        <Card className={`border-border bg-card rounded-xl shadow-sm transition-colors ${activeBreachCount > 0 ? 'border-rose-500/40 bg-rose-500/5' : ''}`}>
          <Link to="/admin/monitoring">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">Pelanggaran Area</p>
                <ShieldAlert className={`w-4 h-4 ${activeBreachCount > 0 ? 'text-rose-600 animate-pulse' : 'text-muted-foreground'}`} />
              </div>
              <p className={`text-2xl font-bold font-mono mt-1.5 ${activeBreachCount > 0 ? 'text-rose-600' : 'text-foreground'}`}>
                {activeBreachCount} Kasus
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Monitoring perimeter pos
              </p>
            </CardContent>
          </Link>
        </Card>
      </div>

      {/* GRAFIK 1: TREN MULTI-BULAN (12 BULAN KOMPARATIF SEPANJANG TAHUN) */}
      <Card className="border-border bg-card rounded-xl shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Tren Kinerja 12 Bulan (Januari - Desember {selectedYear})
              </CardTitle>
              <CardDescription className="text-xs">
                Perbandingan volume kehadiran tepat waktu, keterlambatan, alpa/mangkir, dan jam lembur per bulan.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[11px] font-mono border-border bg-muted/40">
                Tahun Buku {selectedYear}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-2">
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={radarData?.monthlyTrends || []}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="hadirGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0d9488" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#0d9488" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="lateGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="alpaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#e11d48" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#e11d48" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.6} />
                <XAxis dataKey="month_name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    fontSize: '12px',
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Area type="monotone" dataKey="hadir" name="Tepat Waktu" stroke="#0d9488" strokeWidth={2.5} fill="url(#hadirGrad)" />
                <Area type="monotone" dataKey="terlambat" name="Terlambat" stroke="#f59e0b" strokeWidth={2} fill="url(#lateGrad)" />
                <Area type="monotone" dataKey="mangkir" name="Mangkir (Alpa)" stroke="#e11d48" strokeWidth={2} fill="url(#alpaGrad)" />
                <Line type="monotone" dataKey="lembur_jam" name="Jam Lembur" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* DUA GRAFIK KOMPARASI: MATRIKS DIVISI & DETEKSI POLA HARI MINGGUAN */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Matriks Komparatif Divisi */}
        <Card className="border-border bg-card rounded-xl shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              Matriks Kinerja Komparatif Antar Divisi ({selectedYear})
            </CardTitle>
            <CardDescription className="text-xs">
              Perbandingan tingkat kedisiplinan hadir, pelanggaran alpa, dan beban lembur tiap divisi.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={radarData?.divisionMatrix || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.6} />
                  <XAxis dataKey="division_code" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      fontSize: '12px',
                    }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Bar dataKey="total_hadir" name="Total Hadir" fill="#0d9488" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="total_terlambat" name="Terlambat" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="total_mangkir" name="Alpa/Mangkir" fill="#e11d48" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Deteksi Pola Hari Lapangan (Day of Week Critical Pattern) */}
        <Card className="border-border bg-card rounded-xl shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Activity className="w-4 h-4 text-amber-500" />
              Deteksi Pola Hari Lapangan (Pola Keterlambatan & Alpa)
            </CardTitle>
            <CardDescription className="text-xs">
              Membaca pola hari apa yang paling rawan terjadi pelanggaran jam masuk atau ketidakhadiran.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={radarData?.dayPatterns || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.6} />
                  <XAxis dataKey="day_name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      fontSize: '12px',
                    }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Bar dataKey="total_terlambat" name="Terlambat" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="total_mangkir" name="Mangkir (Alpa)" fill="#e11d48" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* WATCHLIST PEMBINAAN & PERSONIL TELADAN */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Watchlist Pembinaan */}
        <Card className="border-border bg-card rounded-xl shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2 text-rose-600">
              <AlertTriangle className="w-4 h-4" />
              Watchlist Evaluasi & Pembinaan Kedisiplinan
            </CardTitle>
            <CardDescription className="text-xs">
              Personil dengan frekuensi mangkir atau keterlambatan tertinggi yang memerlukan arahan Direksi.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5 pt-2">
            {watchlist.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                Seluruh karyawan menunjukkan tingkat kedisiplinan yang memuaskan.
              </p>
            ) : (
              watchlist.map((w) => (
                <div key={w.user_id} className="p-2.5 bg-rose-500/5 border border-rose-500/20 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <p className="font-semibold text-foreground">{w.full_name}</p>
                    <p className="text-[10.5px] text-muted-foreground font-mono">{w.nip} • {w.division_name}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant="destructive" className="text-[10px]">
                      {w.total_mangkir > 0 ? `${w.total_mangkir} Alpa` : `${w.total_terlambat}x Telat`}
                    </Badge>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{w.total_late_minutes || 0} Menit telat</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Personil Paling Disiplin */}
        <Card className="border-border bg-card rounded-xl shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2 text-emerald-600">
              <Sparkles className="w-4 h-4" />
              Personil Teladan & Kepatuhan Terbaik
            </CardTitle>
            <CardDescription className="text-xs">
              Karyawan dengan rekor kehadiran tepat waktu tertinggi tanpa catatan mangkir.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5 pt-2">
            {topPerformers.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">Belum ada data rekapan.</p>
            ) : (
              topPerformers.map((t) => (
                <div key={t.user_id} className="p-2.5 bg-emerald-500/5 border border-emerald-500/20 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <p className="font-semibold text-foreground">{t.full_name}</p>
                    <p className="text-[10.5px] text-muted-foreground font-mono">{t.nip} • {t.division_name}</p>
                  </div>
                  <div className="text-right">
                    <Badge className="bg-emerald-600 text-white text-[10px]">
                      {t.tepat_waktu} Sesi Tepat
                    </Badge>
                    <p className="text-[10px] text-emerald-700 dark:text-emerald-400 mt-0.5">0 Alpa • Prima</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* REKAPAN KINERJA MENYELURUH PER INDIVIDU KARYAWAN (INDIVIDUAL DRILL-DOWN) */}
      <Card className="border-border bg-card rounded-xl shadow-sm overflow-hidden">
        <CardHeader className="border-b border-border bg-muted/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                Rekapan Data & Progres Kinerja Per Individu Karyawan
              </CardTitle>
              <CardDescription className="text-xs">
                Data komprehensif kehadiran, alpa, izin, dan lembur seluruh personil lintas divisi sepanjang tahun {selectedYear}.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Select value={rosterDivisionFilter} onValueChange={setRosterDivisionFilter}>
                <SelectTrigger className="h-8 text-xs rounded-xl w-[140px]">
                  <SelectValue placeholder="Semua Divisi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Divisi</SelectItem>
                  {divisions.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Cari nama / NIP..."
                  value={rosterSearch}
                  onChange={(e) => setRosterSearch(e.target.value)}
                  className="h-8 text-xs pl-8 rounded-xl w-[160px]"
                />
              </div>
            </div>
          </div>
        </CardHeader>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-foreground">
            <thead className="bg-muted/40 border-b border-border uppercase text-[11px] text-muted-foreground font-medium tracking-wider">
              <tr>
                <th className="py-3 px-4">Nama & NIP</th>
                <th className="py-3 px-4">Divisi</th>
                <th className="py-3 px-4">Kehadiran</th>
                <th className="py-3 px-4">Keterlambatan</th>
                <th className="py-3 px-4">Mangkir (Alpa)</th>
                <th className="py-3 px-4">Cuti & Sakit</th>
                <th className="py-3 px-4">Lembur (SPL)</th>
                <th className="py-3 px-4 text-right">Status Kepatuhan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredRoster.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted-foreground">
                    Tidak ada data personil ditemukan.
                  </td>
                </tr>
              ) : (
                filteredRoster.map((r) => {
                  const hadir = Number(r.total_hadir || 0);
                  const tepat = Number(r.tepat_waktu || 0);
                  const telat = Number(r.total_terlambat || 0);
                  const alpa = Number(r.total_mangkir || 0);
                  const cuti = Number(r.total_cuti || 0);
                  const sakit = Number(r.total_sakit || 0);
                  const otHours = Number(r.total_lembur_hours || 0);
                  const punctuality = hadir > 0 ? Math.round((tepat / hadir) * 100) : 100;

                  return (
                    <tr key={r.user_id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4">
                        <p className="font-semibold text-foreground">{r.full_name}</p>
                        <p className="text-[11px] text-muted-foreground font-mono">{r.nip}</p>
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-medium text-foreground">{r.division_name || 'Operasional'}</p>
                        <p className="text-[10px] text-muted-foreground capitalize">{r.role_name || 'Staf'}</p>
                      </td>
                      <td className="py-3 px-4 font-mono">
                        <span className="font-semibold text-emerald-600">{tepat} Tepat</span>
                        <span className="text-[10px] text-muted-foreground block">dari {hadir} hadir</span>
                      </td>
                      <td className="py-3 px-4 font-mono">
                        {telat > 0 ? (
                          <div>
                            <span className="font-semibold text-amber-600">{telat}x</span>
                            <span className="text-[10px] text-muted-foreground block">({r.total_late_minutes || 0} mnt)</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">0x</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {alpa > 0 ? (
                          <Badge variant="destructive" className="text-[10px] font-bold">
                            {alpa} Hari Alpa
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-[10px]">Nihil</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px]">
                        <span>{cuti} Cuti</span>
                        <span className="text-muted-foreground block text-[10px]">{sakit} Sakit</span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px]">
                        {otHours > 0 ? (
                          <div>
                            <span className="font-semibold text-blue-600">{otHours} Jam</span>
                            <span className="text-[10px] text-muted-foreground block">
                              Rp {Number(r.total_lembur_comp || 0).toLocaleString('id-ID')}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-[10px]">0 Jam</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {alpa > 1 ? (
                          <Badge variant="outline" className="bg-rose-500/10 text-rose-600 border-rose-500/20 text-[10px]">
                            Perlu Pembinaan
                          </Badge>
                        ) : punctuality >= 90 ? (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">
                            {punctuality}% Disiplin
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px]">
                            {punctuality}% Waspada
                          </Badge>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* EXECUTIVE FINANCIAL & PAYROLL OVERVIEW */}
      <Card className="border-border bg-card rounded-xl shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                <Banknote className="w-4 h-4 text-emerald-600" />
                Ikhtisar Eksekutif: Anggaran Penggajian & Beban Lembur Terverifikasi
              </CardTitle>
              <CardDescription className="text-xs">
                Monitoring komparatif biaya operasional tenaga kerja, kepatuhan lembur, dan kewajiban perpajakan PPh 21 TER serta BPJS.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/admin/payroll">
                <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs rounded-xl gap-1.5 shadow-xs">
                  <Banknote className="w-3.5 h-3.5" />
                  Rincian Slip Gaji Karyawan
                </Button>
              </Link>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-muted/40 border border-border">
              <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-primary" /> Estimasi Beban Gaji Bruto
              </p>
              <p className="text-lg font-bold text-foreground mt-1">{fmtRp(totalBaseSalary)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Berdasarkan {users.length} personil aktif</p>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <p className="text-[11px] font-medium text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-amber-600" /> Beban Lembur Terverifikasi
              </p>
              <p className="text-lg font-bold text-amber-700 dark:text-amber-300 mt-1">{fmtRp(approvedOvertimeBudget)}</p>
              <p className="text-[10px] text-amber-800 dark:text-amber-300/80 mt-0.5">{overtimeAnalytics.totalHours} Jam lembur disetujui</p>
            </div>

            <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <p className="text-[11px] font-medium text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-blue-600" /> Iuran Wajib BPJS (Est.)
              </p>
              <p className="text-lg font-bold text-blue-700 dark:text-blue-300 mt-1">{fmtRp(estimatedBpjs)}</p>
              <p className="text-[10px] text-blue-800 dark:text-blue-300/80 mt-0.5">Ketenagakerjaan & Kesehatan</p>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <p className="text-[11px] font-medium text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                <Banknote className="w-3.5 h-3.5 text-emerald-600" /> Total Komitmen Penggajian
              </p>
              <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300 mt-1">{fmtRp(estimatedTotalPayroll)}</p>
              <p className="text-[10px] text-emerald-800 dark:text-emerald-300/80 mt-0.5">Perkiraan realisasi bulan berjalan</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
