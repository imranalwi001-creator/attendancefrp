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
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  const [divisions, setDivisions] = useState(hrmService.getDivisions());
  const [users, setUsers] = useState(hrmService.getUsers());
  const [todayAttendances, setTodayAttendances] = useState(hrmService.getAttendances(getTodayDateStr()));
  const [pendingLeaves, setPendingLeaves] = useState(
    hrmService.getLeaves().filter((l) => l.status === 'pending')
  );

  const [timeframe, setTimeframe] = useState<'7' | '14' | '30'>('7');
  const [trendData, setTrendData] = useState<any[]>([]);
  const [divisionAnalytics, setDivisionAnalytics] = useState<any[]>([]);
  const [overtimeAnalytics, setOvertimeAnalytics] = useState(hrmService.getOvertimeAnalytics());
  const [salaryProfiles, setSalaryProfiles] = useState(hrmService.getSalaryProfiles());

  useEffect(() => {
    setDivisions(hrmService.getDivisions());
    setUsers(hrmService.getUsers());
    setTodayAttendances(hrmService.getAttendances(getTodayDateStr()));
    setPendingLeaves(hrmService.getLeaves().filter((l) => l.status === 'pending'));

    const violations = hrmService.getPerimeterViolations();
    setActiveBreachCount(violations.filter((v) => v.status === 'active').length);

    setTrendData(hrmService.getAttendanceTrend(Number(timeframe)));
    setDivisionAnalytics(hrmService.getDivisionAnalytics());
    setOvertimeAnalytics(hrmService.getOvertimeAnalytics());
    
    // Live synchronization with database
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
        } else {
          setSalaryProfiles(hrmService.getSalaryProfiles());
        }
      })
      .catch(() => {
        setSalaryProfiles(hrmService.getSalaryProfiles());
      });
  }, [timeframe]);

  const [activeBreachCount, setActiveBreachCount] = useState(0);

  const totalEmployees = users.length;
  const totalPresentToday = todayAttendances.length;
  const todayLate = todayAttendances.filter((a) => a.status === 'terlambat').length;
  const attendanceRate = totalEmployees > 0 ? Math.round((totalPresentToday / totalEmployees) * 100) : 0;
  const onTimeRateToday = totalPresentToday > 0 ? Math.round(((totalPresentToday - todayLate) / totalPresentToday) * 100) : 100;

  // Financial aggregates for Pimpinan / Executive Board
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
  const estimatedTaxPph21 = Math.round(totalBaseSalary * 0.025);
  const estimatedTotalPayroll = totalBaseSalary + approvedOvertimeBudget + estimatedBpjs;

  return (
    <div className="space-y-6">
      {/* Pimpinan Header Card - Clean & Uniform */}
      <div className="bg-card border border-border rounded-2xl p-6 md:p-7 text-foreground shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20">
              <Briefcase className="w-3.5 h-3.5" />
              <span>Portal Eksekutif & Direksi Pimpinan</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Ikhtisar Eksekutif & Produktivitas Organisasi
            </h1>
            <p className="text-muted-foreground text-sm max-w-xl">
              Pantau laporan kedisiplinan tingkat makro, efisiensi kerja per departemen, dan persetujuan kebijakan cuti.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link to="/admin/approval">
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium shadow-sm rounded-xl gap-1.5">
                <FileCheck2 className="w-3.5 h-3.5" />
                Persetujuan Cuti ({pendingLeaves.length})
              </Button>
            </Link>
            <Link to="/admin/laporan">
              <Button variant="outline" className="border-border hover:bg-muted text-foreground text-xs rounded-xl gap-1.5">
                <FileSpreadsheet className="w-3.5 h-3.5 text-primary" />
                Laporan Lengkap & Cetak
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
                Radar Integritas: {activeBreachCount} Karyawan Terdeteksi Meninggalkan Radius Divisi
              </p>
              <p className="text-rose-800 dark:text-rose-300 text-xs mt-0.5">
                Sistem mengunci otomatis akses kepulangan presensi dan mencatat insiden ini ke dalam rapor kedisiplinan kinerja tahunan.
              </p>
            </div>
          </div>
          <Link to="/monitoring">
            <Button size="sm" variant="destructive" className="rounded-xl text-xs h-8 px-3 font-semibold shrink-0 gap-1.5 shadow-xs">
              <ShieldAlert className="w-3.5 h-3.5" />
              Lihat di Live Monitoring
            </Button>
          </Link>
        </div>
      )}

      {/* KPI Cards - 5-Column Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card className="border-border bg-card rounded-xl shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Tingkat Kehadiran</p>
              <Target className="w-4 h-4 text-primary" />
            </div>
            <p className="text-2xl font-bold text-foreground mt-1.5">{attendanceRate}%</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {totalPresentToday} dari {totalEmployees} Staf
            </p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card rounded-xl shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Ketepatan Waktu</p>
              <Award className="w-4 h-4 text-primary" />
            </div>
            <p className="text-2xl font-bold text-foreground mt-1.5">{onTimeRateToday}%</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {todayLate} Keterlambatan hari ini
            </p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card rounded-xl shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Departemen / Divisi</p>
              <Building2 className="w-4 h-4 text-primary" />
            </div>
            <p className="text-2xl font-bold text-foreground mt-1.5">{divisions.length} Unit</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Seluruh unit kerja aktif
            </p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card rounded-xl shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Permohonan Cuti</p>
              <FileCheck2 className="w-4 h-4 text-primary" />
            </div>
            <p className="text-2xl font-bold text-foreground mt-1.5">{pendingLeaves.length} Berkas</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Menunggu konfirmasi
            </p>
          </CardContent>
        </Card>

        <Card className={`border-border bg-card rounded-xl shadow-sm transition-colors ${activeBreachCount > 0 ? 'border-rose-500/40 bg-rose-500/5' : ''}`}>
          <Link to="/monitoring">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">Pelanggaran Perimeter</p>
                <ShieldAlert className={`w-4 h-4 ${activeBreachCount > 0 ? 'text-rose-600 animate-pulse' : 'text-muted-foreground'}`} />
              </div>
              <p className={`text-2xl font-bold font-mono mt-1.5 ${activeBreachCount > 0 ? 'text-rose-600' : 'text-foreground'}`}>
                {activeBreachCount} Kasus
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Checkout dinonaktifkan
              </p>
            </CardContent>
          </Link>
        </Card>
      </div>

      {/* Main Analytical Chart: Attendance Trends with Rate */}
      <Card className="border-border bg-card rounded-xl shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Tren Produktivitas & Tingkat Kehadiran Eksekutif
              </CardTitle>
              <CardDescription className="text-xs">
                Pergerakan persentase kehadiran tepat waktu karyawan per hari.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Rentang:</span>
              <Select value={timeframe} onValueChange={(val: any) => setTimeframe(val)}>
                <SelectTrigger className="h-8 text-xs w-[130px] rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 Hari Terakhir</SelectItem>
                  <SelectItem value="14">14 Hari Terakhir</SelectItem>
                  <SelectItem value="30">30 Hari Terakhir</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-2">
          <div className="h-[270px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="pimpinanGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0d9488" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#0d9488" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.6} />
                <XAxis dataKey="displayDate" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="hadir"
                  name="Tepat Waktu"
                  stroke="#0d9488"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#pimpinanGradient)"
                />
                <Area
                  type="monotone"
                  dataKey="terlambat"
                  name="Terlambat"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  fillOpacity={0.1}
                  fill="#f59e0b"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Division Performance Breakdown & Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Division On-Time Rate Bars */}
        <Card className="border-border bg-card rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              Tingkat Kedisiplinan per Divisi (Bulan Ini)
            </CardTitle>
            <CardDescription className="text-xs">
              Persentase kehadiran tepat waktu karyawan pada masing-masing unit kerja.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {divisionAnalytics.map((d) => (
              <div key={d.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">{d.name} ({d.code})</span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{d.employeeCount} Karyawan</span>
                    <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                      {d.onTimeRate}% Disiplin
                    </Badge>
                  </div>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${d.onTimeRate}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Executive Action Directives Card */}
        <Card className="border-border bg-card rounded-xl shadow-sm flex flex-col justify-between">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              <Award className="w-4 h-4 text-primary" />
              Rekomendasi Kebijakan & Catatan Pimpinan
            </CardTitle>
            <CardDescription className="text-xs">
              Analisis otomatis sistem berdasarkan data presensi terkini.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3 text-xs">
            <div className="p-3 bg-muted/40 border border-border rounded-xl space-y-1">
              <p className="font-semibold text-foreground">Kedisiplinan Tertinggi:</p>
              <p className="text-muted-foreground">
                Divisi dengan tingkat ketepatan waktu terbaik adalah{' '}
                <strong className="text-foreground">
                  {divisionAnalytics[0]?.name || 'Teknologi Informasi'}
                </strong>{' '}
                dengan rasio kepatuhan{' '}
                <span className="text-primary font-bold">
                  {divisionAnalytics[0]?.onTimeRate || 100}%
                </span>.
              </p>
            </div>

            <div className="p-3 bg-muted/40 border border-border rounded-xl space-y-1">
              <p className="font-semibold text-foreground">Pemantauan Pengajuan Izin:</p>
              <p className="text-muted-foreground">
                Terdapat <strong className="text-foreground">{pendingLeaves.length} permohonan cuti</strong> yang menunggu verifikasi pimpinan. Pastikan ketersediaan staf sebelum menyetujui jadwal cuti.
              </p>
            </div>

            <div className="pt-2">
              <Link to="/admin/laporan">
                <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground text-xs rounded-xl gap-2 font-medium">
                  <FileSpreadsheet className="w-4 h-4" /> Buka Laporan Lengkap & Cetak Dokumen
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Executive Financial & Payroll Overview Section */}
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
