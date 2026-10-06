import React, { useState, useEffect } from 'react';
import { useHrmAuth } from '@/contexts/HrmAuthContext';
import { hrmService, getTodayDateStr } from '@/services/hrmService';
import {
  ShieldCheck,
  Users,
  Building2,
  Settings,
  ArrowRight,
  FileCheck2,
  Sparkles,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Award,
  Upload,
  ShieldAlert,
  Activity,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Link } from 'react-router-dom';
import { HrmPimpinanDashboard } from './HrmPimpinanDashboard';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

export const HrmSuperadminDashboard: React.FC = () => {
  const { user } = useHrmAuth();
  const [viewMode, setViewMode] = useState<'admin' | 'executive'>('admin');
  const [userCount, setUserCount] = useState(0);
  const [roleCount, setRoleCount] = useState(0);
  const [divisionCount, setDivisionCount] = useState(0);
  const [todayAttCount, setTodayAttCount] = useState(0);
  const [todayLateCount, setTodayLateCount] = useState(0);
  const [pendingLeaveCount, setPendingLeaveCount] = useState(0);
  const [office, setOffice] = useState(hrmService.getOfficeLocation());

  // Analytics data
  const [trendData, setTrendData] = useState<any[]>([]);
  const [divisionStats, setDivisionStats] = useState<any[]>([]);
  const [rankings, setRankings] = useState<any[]>([]);

  useEffect(() => {
    const users = hrmService.getUsers();
    setUserCount(users.length);

    const roles = hrmService.getRoles();
    setRoleCount(roles.length);

    const divs = hrmService.getDivisions();
    setDivisionCount(divs.length);

    const today = getTodayDateStr();
    const atts = hrmService.getAttendances(today);
    setTodayAttCount(atts.length);
    setTodayLateCount(atts.filter((a) => a.status === 'terlambat').length);

    const leaves = hrmService.getLeaves();
    const pending = leaves.filter((l) => l.status === 'pending').length;
    setPendingLeaveCount(pending);

    const violations = hrmService.getPerimeterViolations();
    setActiveBreachCount(violations.filter((v) => v.status === 'active').length);

    // Load rich analytics
    setTrendData(hrmService.getAttendanceTrend(7));
    setDivisionStats(hrmService.getDivisionAnalytics());
    setRankings(hrmService.getEmployeeDisciplineRankings());
  }, []);

  const [activeBreachCount, setActiveBreachCount] = useState(0);

  const totalEmployees = userCount;
  const attendancePercentage = totalEmployees > 0 ? Math.round((todayAttCount / totalEmployees) * 100) : 0;
  const onTimeToday = todayAttCount - todayLateCount;

  // Donut chart status distribution
  const pieData = [
    { name: 'Tepat Waktu', value: Math.max(onTimeToday, 0), color: '#0d9488' }, // primary tosca
    { name: 'Terlambat', value: todayLateCount, color: '#f59e0b' }, // amber
    { name: 'Belum Hadir', value: Math.max(totalEmployees - todayAttCount, 0), color: '#cbd5e1' }, // slate
  ];

  if (viewMode === 'executive') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between p-3.5 bg-card border border-border rounded-xl">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewMode('admin')}
            className="rounded-xl text-xs gap-1.5 font-semibold h-8"
          >
            ← Kembali ke Pusat Kendali Superadmin
          </Button>
          <div className="flex items-center gap-2">
            <Badge className="bg-emerald-600 text-white text-xs">Radar Eksekutif Direksi Aktif</Badge>
          </div>
        </div>
        <HrmPimpinanDashboard />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Superadmin Header Card - Clean & Uniform */}
      <div className="bg-card border border-border rounded-2xl p-6 md:p-7 text-foreground shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Pusat Kendali Super Administrator & Analytics</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Dashboard Analitik & Monitoring Karyawan
            </h1>
            <p className="text-muted-foreground text-sm max-w-xl">
              Selamat datang, {user?.fullName}. Pantau progres produktivitas, visualisasi kehadiran harian, perbandingan performa divisi, dan ekspor laporan kepegawaian.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => setViewMode('executive')}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-sm rounded-xl gap-1.5 h-9"
            >
              <Activity className="w-3.5 h-3.5" /> Radar Analisis Direksi
            </Button>
            <Link to="/admin/karyawan">
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-xs shadow-sm rounded-xl gap-1.5 h-9">
                <Users className="w-3.5 h-3.5" /> Daftarkan Karyawan
              </Button>
            </Link>
            <Link to="/admin/laporan">
              <Button variant="outline" className="text-xs rounded-xl gap-2 font-medium h-9">
                <FileSpreadsheet className="w-4 h-4 text-primary" /> Cetak & Rekap
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Geofence Perimeter Breach Alert Banner (If Active Violations Detected) */}
      {activeBreachCount > 0 && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-rose-600 text-white shrink-0 animate-bounce">
              <ShieldAlert size={18} />
            </div>
            <div>
              <p className="font-bold text-rose-950 dark:text-rose-100 text-sm">
                Radar Perimeter: {activeBreachCount} Karyawan Terdeteksi Meninggalkan Area Kantor!
              </p>
              <p className="text-rose-800 dark:text-rose-300 text-xs mt-0.5">
                Tombol checkout presensi telah dinonaktifkan secara otomatis. Pelanggaran terekam di database PostgreSQL untuk evaluasi kinerja.
              </p>
            </div>
          </div>
          <Link to="/monitoring">
            <Button size="sm" variant="destructive" className="rounded-xl text-xs h-8 px-3 font-semibold shrink-0 gap-1.5 shadow-xs">
              <ShieldAlert className="w-3.5 h-3.5" />
              Tinjau di Live Monitoring
            </Button>
          </Link>
        </div>
      )}

      {/* KPI Overview Cards - Clean & Uniform 5-Column Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card className="border-border bg-card rounded-xl shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Karyawan</p>
              <p className="text-2xl font-bold text-foreground">{userCount}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card rounded-xl shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Presensi Hari Ini</p>
              <p className="text-2xl font-bold text-foreground">
                {todayAttCount} <span className="text-xs font-normal text-muted-foreground">({attendancePercentage}%)</span>
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card rounded-xl shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Keterlambatan Hari Ini</p>
              <p className="text-2xl font-bold text-foreground">
                {todayLateCount} <span className="text-xs font-normal text-muted-foreground">Orang</span>
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card rounded-xl shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Antrian Izin & Cuti</p>
              <p className="text-2xl font-bold text-foreground">
                {pendingLeaveCount} <span className="text-xs font-normal text-muted-foreground">Pending</span>
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className={`border-border bg-card rounded-xl shadow-sm transition-colors ${activeBreachCount > 0 ? 'border-rose-500/40 bg-rose-500/5' : ''}`}>
          <Link to="/monitoring">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${activeBreachCount > 0 ? 'bg-rose-500/15 text-rose-600 animate-pulse' : 'bg-muted text-muted-foreground'}`}>
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Pelanggaran Perimeter</p>
                <p className={`text-2xl font-bold font-mono ${activeBreachCount > 0 ? 'text-rose-600' : 'text-foreground'}`}>
                  {activeBreachCount} <span className="text-xs font-normal text-muted-foreground">Terkunci</span>
                </p>
              </div>
            </CardContent>
          </Link>
        </Card>
      </div>

      {/* Visual Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 1: 7-Day Attendance Trend (AreaChart) */}
        <Card className="lg:col-span-2 border-border bg-card rounded-xl shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  Tren Kehadiran & Ketepatan Waktu (7 Hari Terakhir)
                </CardTitle>
                <CardDescription className="text-xs">
                  Fluktuasi kehadiran tepat waktu vs terlambat secara harian.
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-[11px] bg-primary/10 text-primary border-primary/20">
                Live Data
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="pt-2">
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorHadir" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0d9488" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#0d9488" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="colorTerlambat" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
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
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
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
                    fill="url(#colorHadir)"
                  />
                  <Area
                    type="monotone"
                    dataKey="terlambat"
                    name="Terlambat"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorTerlambat)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground pt-2 border-t border-border mt-2">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-primary" />
                <span>Hadir Tepat Waktu</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <span>Terlambat</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Chart 2: Today's Status Distribution (Pie / Donut) */}
        <Card className="border-border bg-card rounded-xl shadow-sm flex flex-col justify-between">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              <Award className="w-4 h-4 text-primary" />
              Komposisi Kehadiran Hari Ini
            </CardTitle>
            <CardDescription className="text-xs">
              Distribusi status dari total {totalEmployees} karyawan.
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-0 flex flex-col items-center justify-center">
            <div className="h-[190px] w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderRadius: '10px',
                      border: '1px solid #e2e8f0',
                      fontSize: '11px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="w-full space-y-2 pt-2 border-t border-border text-xs">
              {pieData.map((p) => (
                <div key={p.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                    <span className="text-muted-foreground">{p.name}</span>
                  </div>
                  <span className="font-semibold text-foreground">{p.value} Karyawan</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Division Performance Comparison (Bar Chart) */}
      <Card className="border-border bg-card rounded-xl shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                Perbandingan Kedisiplinan per Divisi / Departemen
              </CardTitle>
              <CardDescription className="text-xs">
                Rasio kehadiran tepat waktu dan tingkat keterlambatan di masing-masing divisi.
              </CardDescription>
            </div>
            <Link to="/admin/divisi">
              <Button variant="ghost" size="sm" className="text-xs text-primary hover:text-primary gap-1">
                Kelola Divisi <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </CardHeader>

        <CardContent className="pt-2">
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={divisionStats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.6} />
                <XAxis dataKey="code" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="onTimeCount" name="Tepat Waktu" fill="#0d9488" radius={[4, 4, 0, 0]} />
                <Bar dataKey="lateCount" name="Terlambat" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Employee Progress & Discipline Rankings Table */}
      <Card className="border-border bg-card rounded-xl shadow-sm overflow-hidden">
        <CardHeader className="border-b border-border pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                <Award className="w-4 h-4 text-primary" />
                Laporan Progres & Skor Kedisiplinan Karyawan
              </CardTitle>
              <CardDescription className="text-xs">
                Detail pemantauan tingkat kepatuhan jam kerja, total keterlambatan, dan rata-rata jam kerja harian.
              </CardDescription>
            </div>
            <Link to="/admin/laporan">
              <Button variant="outline" size="sm" className="text-xs gap-1.5 border-border rounded-xl">
                Lihat Laporan Lengkap
              </Button>
            </Link>
          </div>
        </CardHeader>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-foreground">
            <thead className="bg-muted/40 border-b border-border uppercase text-[11px] text-muted-foreground font-medium tracking-wider">
              <tr>
                <th className="py-3 px-4 w-12 text-center">#</th>
                <th className="py-3 px-4">Karyawan</th>
                <th className="py-3 px-4">Divisi</th>
                <th className="py-3 px-4 text-center">Total Presensi</th>
                <th className="py-3 px-4 text-center">Tepat Waktu</th>
                <th className="py-3 px-4 text-center">Keterlambatan</th>
                <th className="py-3 px-4 text-center">Rata-rata Jam Kerja</th>
                <th className="py-3 px-4 text-right">Skor Kedisiplinan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rankings.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-muted-foreground">
                    Belum ada data presensi karyawan yang tercatat.
                  </td>
                </tr>
              ) : (
                rankings.slice(0, 6).map((emp, index) => (
                  <tr key={emp.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 text-center font-bold text-muted-foreground">
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        {emp.avatarUrl ? (
                          <img
                            src={emp.avatarUrl}
                            alt={emp.fullName}
                            className="w-7 h-7 rounded-full object-cover border border-primary/20 shrink-0"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-[11px] shrink-0">
                            {emp.fullName.charAt(0)}
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-foreground">{emp.fullName}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{emp.nip}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs font-medium text-foreground whitespace-nowrap">
                      {emp.divisionName || '-'}
                    </td>
                    <td className="py-3 px-4 text-center font-medium text-foreground">
                      {emp.totalAttendance} Hari
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="text-primary font-semibold">{emp.onTimeCount}</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {emp.lateCount > 0 ? (
                        <span className="text-amber-600 font-medium">
                          {emp.lateCount}x ({emp.totalLateMinutes}m)
                        </span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center font-mono">
                      {emp.avgWorkHours} Jam/Hari
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="font-bold text-primary">{emp.score}%</span>
                        <div className="w-16">
                          <Progress value={emp.score} className="h-1.5" />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
