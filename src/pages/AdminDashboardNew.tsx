import { Users, Building, UserCheck, Activity, BookOpen, School, GraduationCap } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useInstitution } from '@/contexts/InstitutionContext';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { StatCard, KalenderPendidikanCard, KehadiranGuruCard, AcademicYearCard } from '@/components/dashboard';
import { KehadiranStaffSummaryCard } from '@/components/dashboard/KehadiranStaffSummaryCard';
import { KehadiranStaffCard } from '@/components/dashboard/KehadiranStaffCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, PieChart, Pie, Cell } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';

const tenantGrowthData = [
  { month: 'Jan', new: 10, total: 45 },
  { month: 'Feb', new: 15, total: 60 },
  { month: 'Mar', new: 22, total: 82 },
  { month: 'Apr', new: 18, total: 100 },
  { month: 'Mei', new: 24, total: 124 },
];

const educationLevelDistributionData = [
  { name: 'SD/MI', value: 45, fill: 'var(--color-sd)' },
  { name: 'SMP/MTs', value: 35, fill: 'var(--color-smp)' },
  { name: 'SMA/SMK', value: 20, fill: 'var(--color-sma)' },
  { name: 'Pesantren', value: 24, fill: 'var(--color-pesantren)' },
];

const chartConfig = {
  new: { label: "Tenant Baru", color: "hsl(var(--primary))" },
  total: { label: "Total Tenant", color: "hsl(var(--primary)/0.5)" },
  sd: { label: "SD/MI", color: "hsl(var(--chart-1))" },
  smp: { label: "SMP/MTs", color: "hsl(var(--chart-2))" },
  sma: { label: "SMA/SMK", color: "hsl(var(--chart-3))" },
  pesantren: { label: "Pesantren", color: "hsl(var(--chart-4))" },
};

const AdminDashboardNew = () => {
  const { workspaceType, getStudentLabel } = useInstitution();
  const { user } = useAuth();
  
  // Deteksi Superadmin Global (mendukung workspace mandiri & akun admin platform)
  const isSuperadmin = 
    workspaceType === 'mandiri' || 
    user?.email === 'admin@pesantren.app' || 
    user?.email === 'admin@digiss.app' || 
    user?.email === 'superadmin@digiss.app';
  
  // Deteksi Guru Mandiri yang masuk ke AdminDashboard
  const isGuruMandiri = workspaceType === 'mandiri' && !isSuperadmin;


  // Fetch statistics - using head: true for count-only
  const { data: stats, isLoading: isStatsLoading } = useQuery({
    queryKey: ['admin-stats', isSuperadmin, workspaceType],
    queryFn: async () => {
      const [
        { count: usersCount },
        { count: mapelCount },
        { count: kelasCount },
        { count: santriCount },
        { count: sekolahCount },
        { count: guruMandiriCount },
        { count: siswaGlobalCount }
      ] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('mapel').select('id', { count: 'exact', head: true }).eq('status', 'aktif'),
        supabase.from('kelas').select('id', { count: 'exact', head: true }).eq('status', 'aktif'),
        supabase.from('user_roles').select('user_id', { count: 'exact', head: true }).eq('role', 'santri'),
        supabase.from('workspaces').select('id', { count: 'exact', head: true }).eq('type', 'sekolah'),
        supabase.from('profiles').select('id, workspaces!inner(id)', { count: 'exact', head: true }).eq('workspace_role', 'guru').eq('workspaces.type', 'mandiri'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('workspace_role', 'santri')
      ]);
      return {
        users: usersCount || 0,
        mapel: mapelCount || 0,
        kelas: kelasCount || 0,
        santri: santriCount || 0,
        sekolah: sekolahCount || 0,
        guruMandiri: guruMandiriCount || 0,
        siswaGlobal: siswaGlobalCount || 0
      };
    },
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  const { data: recentActivities, isLoading: isActivitiesLoading } = useQuery({
    queryKey: ['admin-activity-recent'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('id, user_name, user_role, description, created_at, category')
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 30,
    refetchOnWindowFocus: false,
  });

  const isEmptyStats =
    (stats?.users ?? 0) === 0 &&
    (stats?.santri ?? 0) === 0 &&
    (stats?.mapel ?? 0) === 0 &&
    (stats?.kelas ?? 0) === 0;

  const statCardsGlobal = [
    { icon: Building, label: 'Total Sekolah / Tenant', value: stats?.sekolah || 0, to: '/admin/tenants' },
    { icon: UserCheck, label: 'Total Guru Mandiri', value: stats?.guruMandiri || 0, to: '/admin/users' },
    { icon: Users, label: 'Total Siswa (Global)', value: stats?.siswaGlobal || 0, to: '/admin/users' },
    { icon: Activity, label: 'Monthly Active Users', value: '42K', to: '/admin/users' }
  ];

  const statCardsLocal = [
    { icon: Users, label: 'Total Users', value: stats?.users || 0, to: '/admin/users' },
    { icon: GraduationCap, label: `Total ${getStudentLabel()}`, value: stats?.santri || 0, to: '/admin/users' },
    { icon: BookOpen, label: 'Mata Pelajaran', value: stats?.mapel || 0, to: '/admin/mapel' },
    { icon: School, label: 'Kelas', value: stats?.kelas || 0, to: '/admin/kelas' }
  ];

  const statCards = isSuperadmin ? statCardsGlobal : statCardsLocal;

  return (
    <div className="space-y-6">
      <div className="space-y-4 animate-fade-in">
        <h1 className="font-bold tracking-tight bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-2xl">
          {isSuperadmin 
            ? 'Superadmin Control Center' 
            : isGuruMandiri 
              ? 'Dashboard Administrasi Mandiri' 
              : 'Dashboard Admin Sekolah'}
        </h1>
        <p className="text-muted-foreground text-sm">
          {isSuperadmin 
            ? 'Pantau performa global dari seluruh instansi dan pengguna aplikasi LMS Digiss.'
            : isGuruMandiri
              ? 'Kelola data siswa, mata pelajaran, dan profil mandiri Anda.'
              : 'Pantau ringkasan data akademik dan pengguna di sekolah Anda.'}
        </p>
        
        {/* Academic Year & Semester Info Card - Only for School Admin and Guru Mandiri */}
        {!isSuperadmin && <AcademicYearCard />}
      </div>

      {/* Stats Cards */}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {isStatsLoading
          ? [...Array(4)].map((_, i) => (
            <Card key={i} className="animate-fade-in" style={{ animationDelay: `${i * 80}ms` }}>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-16" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
          : statCards.map((stat, index) => (
            <Link key={stat.label} to={stat.to} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg">
              <StatCard
                icon={stat.icon}
                label={stat.label}
                value={stat.value}
                animationDelay={index * 100}
              />
            </Link>
          ))}
      </div>

      {!isStatsLoading && isEmptyStats && (
        <Card className="border border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background animate-fade-in" style={{ animationDelay: '320ms' }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base md:text-lg">Mulai Setup Data</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Data masih kosong. Mulai dari Tahun Ajaran, Kelas, Mapel, lalu Users.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="default" size="sm">
                <Link to="/admin/settings">Atur Tahun Ajaran</Link>
              </Button>
              <Button asChild variant="btn_sec" size="sm">
                <Link to="/admin/kelas">Tambah Kelas</Link>
              </Button>
              <Button asChild variant="btn_sec" size="sm">
                <Link to="/admin/mapel">Tambah Mapel</Link>
              </Button>
              <Button asChild variant="btn_sec" size="sm">
                <Link to="/admin/users">Tambah Users</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Grid for Announcements or System Health */}
      {isSuperadmin ? (
        <div className="grid gap-6 lg:grid-cols-2 animate-fade-in" style={{ animationDelay: '400ms' }}>
          {/* Quick Actions */}
          <Card className="rounded-2xl border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Building className="h-4 w-4 text-primary" /> Aksi Cepat Pengelolaan SaaS
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <Button asChild variant="outline" className="h-auto p-3 flex flex-col items-start gap-1 justify-start text-left border-border hover:border-primary/40 hover:bg-primary/5">
                <Link to="/admin/tenants">
                  <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                    <Building className="h-3.5 w-3.5 text-primary" /> Kelola Tenants
                  </span>
                  <span className="text-[11px] text-muted-foreground font-normal">Daftar & tambah sekolah baru</span>
                </Link>
              </Button>

              <Button asChild variant="outline" className="h-auto p-3 flex flex-col items-start gap-1 justify-start text-left border-border hover:border-primary/40 hover:bg-primary/5">
                <Link to="/admin/monitoring">
                  <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5 text-primary" /> Sistem Monitoring
                  </span>
                  <span className="text-[11px] text-muted-foreground font-normal">Kesehatan DB & token AI</span>
                </Link>
              </Button>

              <Button asChild variant="outline" className="h-auto p-3 flex flex-col items-start gap-1 justify-start text-left border-border hover:border-primary/40 hover:bg-primary/5">
                <Link to="/admin/billing">
                  <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                    <Building className="h-3.5 w-3.5 text-primary" /> Billing & Lisensi
                  </span>
                  <span className="text-[11px] text-muted-foreground font-normal">Tagihan & pembayaran tenant</span>
                </Link>
              </Button>

              <Button asChild variant="outline" className="h-auto p-3 flex flex-col items-start gap-1 justify-start text-left border-border hover:border-primary/40 hover:bg-primary/5">
                <Link to="/admin/saas-settings">
                  <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5 text-primary" /> Konfigurasi SaaS
                  </span>
                  <span className="text-[11px] text-muted-foreground font-normal">Atur WhatsApp & branding</span>
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* System Health Card */}
          <Card className="rounded-2xl border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4 text-emerald-600" /> Status Server & Layanan
              </CardTitle>
              <Button asChild variant="link" className="h-auto p-0 text-xs text-primary">
                <Link to="/admin/monitoring">Detail Monitoring →</Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center p-2.5 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-xs">
                <span className="font-medium">Database Supabase (PostgreSQL 17)</span>
                <span className="font-mono bg-emerald-500/20 px-2 py-0.5 rounded text-[11px]">Normal (99.9% Uptime)</span>
              </div>
              <div className="flex justify-between items-center p-2.5 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-xs">
                <span className="font-medium">Storage & Media Assets</span>
                <span className="font-mono bg-emerald-500/20 px-2 py-0.5 rounded text-[11px]">Terhubung</span>
              </div>
              <div className="flex justify-between items-center p-2.5 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-xs">
                <span className="font-medium">Authentication & GoTrue API</span>
                <span className="font-mono bg-emerald-500/20 px-2 py-0.5 rounded text-[11px]">Aktif</span>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <>
          <div className="animate-fade-in" style={{ animationDelay: '350ms' }}>
            <KehadiranStaffCard />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-6">
              <div className="animate-fade-in" style={{ animationDelay: '400ms' }}>
                <KalenderPendidikanCard />
              </div>
              {/* Only show Staff summary for real schools, Guru Mandiri doesn't have staff */}
              {!isGuruMandiri && (
                <div className="animate-fade-in" style={{ animationDelay: '450ms' }}>
                  <KehadiranStaffSummaryCard />
                </div>
              )}
            </div>
            <div className="animate-fade-in" style={{ animationDelay: '500ms' }}>
              <KehadiranGuruCard />
            </div>
          </div>
        </>
      )}

      {/* Charts Section - SaaS Global Metrics */}
      {isSuperadmin && (
        <div className="grid gap-6 lg:grid-cols-7 animate-fade-in" style={{ animationDelay: '520ms' }}>
          <Card className="col-span-1 lg:col-span-4">
            <CardHeader>
              <CardTitle>Pertumbuhan Tenant (Bulan ini)</CardTitle>
            </CardHeader>
            <CardContent className="pl-0">
              <ChartContainer config={chartConfig} className="min-h-[300px] w-full">
                <BarChart accessibilityLayer data={tenantGrowthData}>
                  <CartesianGrid vertical={false} />
                  <XAxis 
                    dataKey="month" 
                    tickLine={false} 
                    tickMargin={10} 
                    axisLine={false} 
                  />
                  <YAxis 
                    tickLine={false} 
                    axisLine={false} 
                    tickMargin={10} 
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar dataKey="new" fill="var(--color-new)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="total" fill="var(--color-total)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
          
          <Card className="col-span-1 lg:col-span-3">
            <CardHeader>
              <CardTitle>Distribusi Jenjang Pendidikan</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="min-h-[300px] w-full">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                  <Pie
                    data={educationLevelDistributionData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                  >
                    {educationLevelDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <ChartLegend content={<ChartLegendContent />} className="-translate-y-2 flex-wrap gap-2 [&>*]:justify-center" />
                </PieChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="animate-fade-in" style={{ animationDelay: '550ms' }}>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-base md:text-lg">Aktivitas Terbaru</CardTitle>
          <Button asChild variant="link" className="h-auto p-0 text-sm">
            <Link to="/admin/activity-log">Lihat semua</Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {isActivitiesLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/5" />
                    <Skeleton className="h-3 w-2/5" />
                  </div>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              ))}
            </div>
          ) : recentActivities && recentActivities.length > 0 ? (
            recentActivities.map((log: any) => (
              <div key={log.id} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {log.description}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {log.user_name ? `${log.user_name} • ` : ''}{formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: localeId })}
                  </p>
                </div>
                <Badge variant="secondary" className="shrink-0">
                  {log.category || 'Aktivitas'}
                </Badge>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              Belum ada aktivitas yang tercatat.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboardNew;
