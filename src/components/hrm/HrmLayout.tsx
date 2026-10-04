import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useHrmAuth } from '@/contexts/HrmAuthContext';
import defaultLogo from '@/assets/logo.png';
import { hrmService } from '@/services/hrmService';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Clock,
  CalendarCheck2,
  Users,
  ShieldCheck,
  Building2,
  FileSpreadsheet,
  Settings,
  LogOut,
  Menu,
  X,
  FileCheck2,
  CalendarDays,
  UserCheck,
  ChevronDown,
  Camera,
  CheckCircle2,
  Banknote,
  TrendingUp,
  Bell,
  CheckCheck,
  ShieldAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PwaInstallButton } from '@/components/pwa/PwaInstallButton';
import { ApkDownloadButton } from '@/components/hrm/ApkDownloadModal';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { systemNotificationService } from '@/services/systemNotificationService';

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
  roles?: string[];
}

export const HrmLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, role, logout } = useHrmAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const normalizeRole = (r?: string) => (r || '').toLowerCase().replace(/[\s_-]/g, '');
  const currentRole = normalizeRole(role);

  // Standalone PWA Mode Detection (Lampiran 2 & 3)
  const isPwaStandalone = React.useMemo(() => {
    if (typeof window === 'undefined') return false;
    if (localStorage.getItem('hrm_force_desktop_mode') === 'true') return false;
    const urlParams = new URLSearchParams(window.location.search);
    return Boolean(
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://') ||
      urlParams.get('source') === 'pwa' ||
      urlParams.get('mode') === 'app' ||
      localStorage.getItem('hrm_pwa_mode') === 'true'
    );
  }, []);

  if (isPwaStandalone && (location.pathname === '/presensi' || location.pathname === '/dashboard')) {
    return <div className="min-h-screen bg-[#14532D] text-foreground">{children}</div>;
  }

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('hrm_sidebar_collapsed') === 'true';
  });
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const [appSettings, setAppSettings] = useState(hrmService.getAppSettings());

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('hrm_sidebar_collapsed', String(next));
      return next;
    });
  };

  useEffect(() => {
    const handleSettingsUpdate = () => {
      setAppSettings(hrmService.getAppSettings());
    };
    window.addEventListener('hrm_settings_updated', handleSettingsUpdate);
    return () => window.removeEventListener('hrm_settings_updated', handleSettingsUpdate);
  }, []);

  // Notifications State & Real-time Listeners
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState<number>(0);

  const refreshNotifications = () => {
    if (!user) return;
    const notifs = hrmService.getNotifications(user.id, currentRole);
    setNotifications(notifs);
    setUnreadNotifCount(notifs.filter((n: any) => !n.isRead).length);
  };

  useEffect(() => {
    systemNotificationService.requestPermission();
    refreshNotifications();
    hrmService.fetchBackendNotifications(user?.id, currentRole).then(() => {
      refreshNotifications();
    });
    hrmService.syncWithBackend().then(refreshNotifications);
    window.addEventListener('hrm_notifications_updated', refreshNotifications);
    window.addEventListener('hrm_leaves_updated', refreshNotifications);
    window.addEventListener('hrm_overtime_updated', refreshNotifications);
    window.addEventListener('hrm_data_updated', refreshNotifications);
    return () => {
      window.removeEventListener('hrm_notifications_updated', refreshNotifications);
      window.removeEventListener('hrm_leaves_updated', refreshNotifications);
      window.removeEventListener('hrm_overtime_updated', refreshNotifications);
      window.removeEventListener('hrm_data_updated', refreshNotifications);
    };
  }, [user?.id, currentRole]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Today's attendance calculation for floating center camera button
  const todayAtt = user ? hrmService.getUserTodayAttendance(user.id) : undefined;
  const shifts = hrmService.getShifts();
  const userShift = shifts.find((s) => s.id === user?.shiftId) || shifts[0];
  const hasClockedIn = Boolean(todayAtt?.clockIn);
  const hasClockedOut = Boolean(todayAtt?.clockOut);

  const isTimeForClockOut = (() => {
    if (!userShift?.endTime) return true;
    const now = new Date();
    const [endHours, endMinutes] = userShift.endTime.split(':').map(Number);
    const shiftEndTime = new Date(now);
    shiftEndTime.setHours(endHours, endMinutes, 0, 0);
    const earliestClockOutTime = new Date(shiftEndTime.getTime() - 15 * 60 * 1000);
    return now >= earliestClockOutTime;
  })();

  const canClockIn = !hasClockedIn;
  const isWaitingClockOut = hasClockedIn && !hasClockedOut && !isTimeForClockOut;
  const canClockOut = hasClockedIn && !hasClockedOut && isTimeForClockOut;
  const isCompleted = hasClockedIn && hasClockedOut;

  const navItems: NavItem[] = [
    {
      label: 'Dashboard',
      path: '/dashboard',
      icon: LayoutDashboard,
    },
    {
      label: 'Presensi Saya',
      path: '/presensi',
      icon: Clock,
      // Semua pengguna / karyawan memiliki akses presensi mandiri
    },
    {
      label: 'Pengajuan Cuti / Izin',
      path: '/pengajuan',
      icon: CalendarCheck2,
      // Semua pengguna / karyawan berhak mengajukan izin/cuti
    },
    {
      label: 'Riwayat Presensi',
      path: '/riwayat',
      icon: CalendarDays,
      // Semua pengguna / karyawan dapat melihat riwayat kehadiran pribadi
    },
    {
      label: 'Persetujuan Izin',
      path: '/admin/approval',
      icon: FileCheck2,
      roles: ['superadmin', 'admin', 'hrd', 'pimpinan', 'pengawas', 'korlap', 'kepala_regu'],
    },
    {
      label: 'Monitoring Presensi',
      path: '/admin/monitoring',
      icon: UserCheck,
      roles: ['superadmin', 'admin', 'hrd', 'pimpinan', 'pengawas', 'korlap', 'kepala_regu'],
    },
    {
      label: 'Rekap & Laporan',
      path: '/admin/laporan',
      icon: FileSpreadsheet,
      roles: ['superadmin', 'admin', 'hrd', 'pimpinan', 'keuangan', 'pengawas', 'korlap', 'kepala_regu'],
    },
    {
      label: 'Penggajian (Payroll)',
      path: '/admin/payroll',
      icon: Banknote,
      roles: ['superadmin', 'admin', 'keuangan', 'pimpinan'],
    },
    {
      label: 'Data Karyawan',
      path: '/admin/karyawan',
      icon: Users,
      roles: ['superadmin', 'admin', 'hrd', 'korlap'],
    },
    {
      label: 'Kelola Divisi',
      path: '/admin/divisi',
      icon: Building2,
      roles: ['superadmin'],
    },
    {
      label: 'Kelola Role & Akses',
      path: '/admin/roles',
      icon: ShieldCheck,
      roles: ['superadmin'],
    },
    {
      label: 'Pengaturan Kantor',
      path: '/admin/pengaturan',
      icon: Settings,
      roles: ['superadmin'],
    },
  ];

  const visibleNavItems = navItems.filter((item) => {
    if (!item.roles) return true;
    if (currentRole === 'superadmin' || currentRole.includes('superadmin')) return true;
    return item.roles.some((reqRole) => normalizeRole(reqRole) === currentRole);
  });

  // Mobile Bottom Navigation Bar Items (Primary 4 items + "Lainnya" button)
  const getPrimaryMobileItems = () => {
    if (['superadmin', 'admin', 'hrd', 'pimpinan', 'pengawas', 'korlap', 'kepala_regu', 'kepalaregu'].some((r) => currentRole.includes(r))) {
      return [
        { label: 'Beranda', path: '/dashboard', icon: LayoutDashboard },
        { label: 'Monitor', path: '/admin/monitoring', icon: UserCheck },
        { label: 'Approval', path: '/admin/approval', icon: FileCheck2 },
        { label: 'Laporan', path: '/admin/laporan', icon: FileSpreadsheet },
      ];
    }
    if (currentRole === 'keuangan') {
      return [
        { label: 'Beranda', path: '/dashboard', icon: LayoutDashboard },
        { label: 'Payroll', path: '/admin/payroll', icon: Banknote },
        { label: 'Laporan', path: '/admin/laporan', icon: FileSpreadsheet },
        { label: 'Presensi', path: '/presensi', icon: Clock },
      ];
    }
    // Default karyawan
    return [
      { label: 'Beranda', path: '/dashboard', icon: LayoutDashboard },
      { label: 'Presensi', path: '/presensi', icon: Clock },
      { label: 'Pengajuan', path: '/pengajuan', icon: CalendarCheck2 },
      { label: 'Riwayat', path: '/riwayat', icon: CalendarDays },
    ];
  };

  const primaryMobileItems = getPrimaryMobileItems();

  const getRoleBadge = (r: string) => {
    const labels: Record<string, string> = {
      superadmin: 'Super Admin',
      admin: 'Admin HRD',
      hrd: 'HRD Staff',
      pimpinan: 'Pimpinan',
      keuangan: 'Keuangan',
      karyawan: 'Karyawan',
      pengawas: 'Pengawas',
      korlap: 'Korlap',
      kepala_regu: 'Danru',
      kepalaregu: 'Danru',
    };
    const isSuper = r === 'superadmin';
    return (
      <Badge
        variant="outline"
        className={cn(
          'text-[11px] font-medium rounded-md px-2 py-0.5',
          isSuper
            ? 'bg-primary/10 text-primary border-primary/20'
            : 'bg-muted/40 text-foreground border-border'
        )}
      >
        {labels[r] || r}
      </Badge>
    );
  };

  const isCompact = isSidebarCollapsed && !isSidebarHovered;

  const renderNotificationBell = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative h-9 w-9 p-0 rounded-xl text-foreground hover:bg-muted hover:text-primary transition-colors flex items-center justify-center border border-border/70"
          title="Notifikasi Masuk (Cuti, Lembur, Pengganti)"
        >
          <Bell className="w-4 h-4" />
          {unreadNotifCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-xs animate-pulse">
              {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 sm:w-96 max-h-[480px] overflow-y-auto p-0 shadow-2xl border border-border">
        <div className="flex items-center justify-between p-3 border-b border-border bg-muted/40 sticky top-0 backdrop-blur-xs z-10">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" />
            <h4 className="font-semibold text-xs text-foreground">Notifikasi Sistem</h4>
            {unreadNotifCount > 0 && (
              <Badge variant="destructive" className="text-[10px] h-4 px-1.5 py-0">
                {unreadNotifCount} Baru
              </Badge>
            )}
          </div>
          {unreadNotifCount > 0 && (
            <button
              onClick={() => {
                hrmService.markAllNotificationsAsRead(user?.id, currentRole);
                refreshNotifications();
              }}
              className="text-[11px] text-primary hover:underline font-medium"
            >
              Tandai Semua Dibaca
            </button>
          )}
        </div>
        {notifications.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-xs">
            <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
            Belum ada notifikasi baru
          </div>
        ) : (
          <div className="divide-y divide-border">
            {notifications.slice(0, 20).map((n) => (
              <div
                key={n.id}
                onClick={() => {
                  hrmService.markNotificationAsRead(n.id);
                  refreshNotifications();
                  
                  // Role-based smart tab routing
                  if (['superadmin', 'admin', 'hrd', 'pimpinan', 'pengawas'].includes(currentRole)) {
                    const isOt = n.type === 'overtime' || (n.title || '').toLowerCase().includes('lembur');
                    navigate(`/admin/approval?tab=${isOt ? 'overtime' : 'leaves'}`);
                  } else {
                    const isOt = n.type === 'overtime' || (n.title || '').toLowerCase().includes('lembur');
                    navigate(`/pengajuan?tab=${isOt ? 'overtime' : 'leaves'}`);
                  }
                }}
                className={cn(
                  'p-3 cursor-pointer hover:bg-muted/60 transition-colors flex gap-2.5 items-start',
                  !n.isRead ? 'bg-primary/5 font-medium' : 'opacity-85'
                )}
              >
                <div
                  className={cn(
                    'w-7 h-7 rounded-lg shrink-0 flex items-center justify-center mt-0.5',
                    n.type === 'leave'
                      ? 'bg-sky-500/10 text-sky-600'
                      : n.type === 'overtime'
                      ? 'bg-purple-500/10 text-purple-600'
                      : n.type === 'warning'
                      ? 'bg-amber-500/10 text-amber-600'
                      : 'bg-primary/10 text-primary'
                  )}
                >
                  {n.type === 'leave' ? (
                    <CalendarCheck2 className="w-3.5 h-3.5" />
                  ) : n.type === 'overtime' ? (
                    <Clock className="w-3.5 h-3.5" />
                  ) : (
                    <Bell className="w-3.5 h-3.5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <p className={cn('text-xs truncate text-foreground', !n.isRead ? 'font-bold' : 'font-medium')}>
                      {n.title}
                    </p>
                    {!n.isRead ? (
                      <span className="w-2 h-2 rounded-full bg-primary shrink-0 ring-2 ring-primary/20 animate-pulse" />
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 px-1.5 py-0.5 rounded-full shrink-0 font-medium">
                        <CheckCheck className="w-3 h-3" />
                        Sudah dibaca
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5 leading-snug">
                    {n.message}
                  </p>
                  <p className="text-[10px] text-muted-foreground/70 mt-1 flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />
                    {new Date(n.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
        {['superadmin', 'admin', 'hrd', 'pimpinan', 'pengawas'].includes(currentRole) && (
          <div className="p-2 border-t border-border bg-muted/20 text-center sticky bottom-0 backdrop-blur-xs">
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs h-7 text-primary border-primary/20 hover:bg-primary/10"
              onClick={() => navigate('/admin/approval')}
            >
              Buka Halaman Persetujuan (Approval)
            </Button>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row transition-colors duration-200 w-full max-w-[100vw] overflow-x-hidden">
      {/* DESKTOP SIDEBAR - LMS DIGISS ORIGINAL THEME WITH COMPACT & HOVER EXPANSION */}
      <aside
        onMouseEnter={() => isSidebarCollapsed && setIsSidebarHovered(true)}
        onMouseLeave={() => isSidebarCollapsed && setIsSidebarHovered(false)}
        className={cn(
          'hidden md:flex flex-col bg-card border-r border-border shrink-0 fixed top-0 bottom-0 left-0 z-30 transition-all duration-300 ease-in-out',
          isCompact ? 'w-[72px]' : 'w-[260px]',
          isSidebarHovered && isSidebarCollapsed ? 'shadow-2xl z-40' : ''
        )}
      >
        {/* Brand Header */}
        <div className={cn('min-h-[60px] px-4 py-3 flex items-center border-b border-border transition-all', isCompact ? 'justify-center' : 'gap-3')}>
          <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-muted/40 dark:bg-white/10 p-1.5 backdrop-blur-xs border border-border/60 shrink-0 transition-transform hover:scale-105 shadow-xs">
            <img
              src={appSettings.logoUrl || defaultLogo}
              alt="Logo Perusahaan"
              className="h-full w-full object-contain filter drop-shadow-xs dark:drop-shadow-[0_0_10px_rgba(255,255,255,0.4)]"
            />
          </div>
          {!isCompact && (
            <div className="min-w-0 flex-1">
              <h1 className="font-bold text-foreground text-xs tracking-tight leading-snug line-clamp-2 break-words">
                {appSettings.appName || 'PT. FAWWAZ RESKI PERWIRA'}
              </h1>
            </div>
          )}
        </div>

        {/* User Card */}
        <div className={cn('m-2 rounded-xl bg-muted/30 border border-border transition-all', isCompact ? 'p-2 flex justify-center' : 'p-3')}>
          <div className={cn('flex items-center', isCompact ? 'justify-center' : 'gap-2.5')}>
            {(user?.avatarUrl || (user as any)?.faceEnrolledPhoto) ? (
              <img
                src={user?.avatarUrl || (user as any)?.faceEnrolledPhoto}
                alt={user?.fullName || ''}
                className="w-8 h-8 rounded-full object-cover shadow-2xs border border-primary/20 shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground font-semibold flex items-center justify-center text-xs shadow-2xs shrink-0">
                {user?.fullName?.charAt(0) || 'U'}
              </div>
            )}
            {!isCompact && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">{user?.fullName}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {getRoleBadge(currentRole)}
                </div>
              </div>
            )}
          </div>
          {!isCompact && (
            <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-border/60 text-[10px] text-muted-foreground">
              <span className="truncate">{user?.divisionName || 'Semua Divisi'}</span>
              <span>•</span>
              <span className="font-mono">{user?.nip}</span>
            </div>
          )}
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 px-2 py-1.5 space-y-0.5 overflow-y-auto scrollbar-soft">
          {visibleNavItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                title={isCompact ? item.label : undefined}
                className={cn(
                  'flex items-center rounded-xl text-sm font-medium transition-all',
                  isCompact ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5',
                  isActive
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-foreground hover:bg-muted hover:text-primary'
                )}
              >
                <Icon className={cn('w-4 h-4 shrink-0', isActive ? 'text-primary' : 'text-muted-foreground')} />
                {!isCompact && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Bottom Actions */}
        <div className="p-3 border-t border-border space-y-1.5">
          <ThemeToggle variant="sidebar" isCompact={isCompact} />
          <PwaInstallButton variant="sidebar" isCompact={isCompact} />
          <Button
            variant="ghost"
            onClick={handleLogout}
            title={isCompact ? 'Keluar Sistem' : undefined}
            className={cn('text-destructive hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all', isCompact ? 'w-full p-2 justify-center' : 'w-full justify-start gap-3')}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!isCompact && <span>Keluar Sistem</span>}
          </Button>
        </div>
      </aside>

      {/* MOBILE NAVBAR */}
      <header
        className="md:hidden flex items-center justify-between px-3 sm:px-4 bg-card text-foreground border-b border-border sticky top-0 z-40 w-full max-w-[100vw] overflow-hidden"
        style={{
          paddingTop: 'max(env(safe-area-inset-top, 0px), 24px)',
          minHeight: 'calc(54px + max(env(safe-area-inset-top, 0px), 24px))',
          paddingBottom: '8px',
        }}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1 mr-1.5">
          <img
            src={appSettings.logoUrl || defaultLogo}
            alt="Logo Perusahaan"
            className="w-8 h-8 object-contain filter drop-shadow-xs dark:drop-shadow-[0_2px_8px_rgba(255,255,255,0.25)] shrink-0"
          />
          <div className="flex flex-col min-w-0 truncate">
            <span className="font-bold text-xs sm:text-sm text-foreground truncate leading-tight">
              {appSettings.appName || 'PT. FAWWAZ RESKI PERWIRA'}
            </span>
            <span className="text-[10px] text-muted-foreground truncate leading-none mt-0.5">
              HRM & Attendance Gate
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          <ThemeToggle variant="dropdown" />
          <ApkDownloadButton variant="header" />
          {renderNotificationBell()}
          <div className="hidden sm:inline-flex">{getRoleBadge(currentRole)}</div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="h-8 w-8 text-foreground hover:bg-muted rounded-xl"
            title="Menu Navigasi"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      </header>

      {/* MOBILE DRAWER */}
      {mobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 bottom-16 bg-background/95 backdrop-blur-md z-30 flex flex-col p-4 space-y-2 overflow-y-auto"
          style={{ top: 'calc(54px + max(env(safe-area-inset-top, 0px), 24px))' }}
        >
          <div className="p-3 bg-muted rounded-xl mb-2 flex items-center gap-3">
            {(user?.avatarUrl || (user as any)?.faceEnrolledPhoto) ? (
              <img
                src={user?.avatarUrl || (user as any)?.faceEnrolledPhoto}
                alt={user?.fullName || ''}
                className="w-9 h-9 rounded-full object-cover shadow-sm border border-primary/20 shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground font-bold flex items-center justify-center text-xs shrink-0">
                {user?.fullName?.charAt(0) || 'U'}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-foreground text-sm truncate">{user?.fullName}</p>
                {getRoleBadge(currentRole)}
              </div>
              <p className="text-xs text-muted-foreground truncate">{user?.email} • {user?.divisionName}</p>
            </div>
          </div>
          {visibleNavItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium',
                  isActive ? 'bg-primary/10 text-primary font-semibold' : 'text-foreground hover:bg-muted'
                )}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
          <div className="pt-4 mt-auto">
            <Button
              variant="destructive"
              className="w-full gap-2 rounded-xl"
              onClick={() => {
                setMobileMenuOpen(false);
                handleLogout();
              }}
            >
              <LogOut className="w-4 h-4" />
              Keluar
            </Button>
          </div>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <main
        className={cn(
          'flex-1 flex flex-col min-w-0 w-full max-w-[100vw] overflow-x-hidden bg-background text-foreground transition-all duration-300 ease-in-out',
          isSidebarCollapsed ? 'md:pl-[72px]' : 'md:pl-[260px]'
        )}
      >
        {/* Top Header Bar */}
        <div className="hidden md:flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8 bg-card border-b border-border sticky top-0 z-20 transition-colors">
          <div className="flex items-center gap-3">
            {/* Hamburger Toggle Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSidebar}
              className="h-9 w-9 p-0 rounded-xl text-foreground hover:bg-muted hover:text-primary transition-colors flex items-center justify-center border border-border/70"
              title={isSidebarCollapsed ? "Perluas Sidebar" : "Kecilkan Sidebar"}
            >
              <Menu className="w-4 h-4" />
            </Button>

            <h2 className="text-base font-semibold text-foreground">
              {navItems.find((n) => n.path === location.pathname)?.label || 'HRM Attendance'}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle variant="dropdown" />
            <ApkDownloadButton variant="header" />
            <PwaInstallButton variant="header" />
            {renderNotificationBell()}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-muted transition-colors">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold flex items-center justify-center text-xs shadow-sm">
                    {user?.fullName?.charAt(0) || 'U'}
                  </div>
                  <div className="text-left hidden lg:block">
                    <p className="text-xs font-semibold text-foreground leading-none">{user?.fullName}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{user?.roleName}</p>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <p className="font-semibold text-foreground">{user?.fullName}</p>
                  <p className="text-xs text-muted-foreground font-normal">{user?.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/presensi')}>
                  Presensi Saya
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/pengajuan')}>
                  Pengajuan Cuti / Izin
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                  <LogOut className="w-4 h-4 mr-2" />
                  Keluar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Page Content Body */}
        <div className="flex-1 p-3 sm:p-5 lg:p-8 pb-24 md:pb-8 w-full max-w-full min-w-0 overflow-x-hidden">
          {children}
        </div>
      </main>

      {/* MOBILE BOTTOM NAVIGATION BAR WITH CENTER CAMERA BUTTON */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border px-1 py-1 flex items-center justify-around shadow-[0_-4px_20px_rgba(0,0,0,0.08)] pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {/* Item 1: Beranda */}
        <Link
          to="/dashboard"
          onClick={() => setMobileMenuOpen(false)}
          className={cn(
            'flex flex-col items-center justify-center flex-1 py-1 px-0.5 rounded-xl transition-all active:scale-90',
            location.pathname === '/dashboard'
              ? 'text-primary font-semibold'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <div
            className={cn(
              'p-1 rounded-xl transition-colors',
              location.pathname === '/dashboard' ? 'bg-primary/10 text-primary shadow-xs' : ''
            )}
          >
            <LayoutDashboard className="w-5 h-5" />
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-[60px] leading-tight">
            Beranda
          </span>
        </Link>

        {/* Item 2: Pengajuan / Monitor */}
        <Link
          to={['superadmin', 'admin', 'hrd', 'pimpinan'].includes(currentRole) ? '/admin/monitoring' : '/pengajuan'}
          onClick={() => setMobileMenuOpen(false)}
          className={cn(
            'flex flex-col items-center justify-center flex-1 py-1 px-0.5 rounded-xl transition-all active:scale-90',
            (location.pathname === '/pengajuan' || location.pathname === '/admin/monitoring')
              ? 'text-primary font-semibold'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <div
            className={cn(
              'p-1 rounded-xl transition-colors',
              (location.pathname === '/pengajuan' || location.pathname === '/admin/monitoring') ? 'bg-primary/10 text-primary shadow-xs' : ''
            )}
          >
            {['superadmin', 'admin', 'hrd', 'pimpinan'].includes(currentRole) ? (
              <UserCheck className="w-5 h-5" />
            ) : (
              <CalendarCheck2 className="w-5 h-5" />
            )}
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-[60px] leading-tight">
            {['superadmin', 'admin', 'hrd', 'pimpinan'].includes(currentRole) ? 'Monitor' : 'Pengajuan'}
          </span>
        </Link>

        {/* TOMBOL TENGAH (HERO CENTER BUTTON: KAMERA ABSEN ATAU SHORTCUT EKSEKUTIF PIMPINAN) */}
        <div className="flex flex-col items-center justify-center flex-1 -mt-5">
          {currentRole === 'pimpinan' ? (
            <Link
              to="/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className="w-13 h-13 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/30 border-4 border-card ring-2 ring-primary/20 hover:scale-105 active:scale-90 transition-all"
              title="Portal Eksekutif Pimpinan (Bebas Kewajiban Presensi)"
            >
              <TrendingUp className="w-6 h-6" />
            </Link>
          ) : canClockIn ? (
            <Link
              to="/presensi"
              onClick={() => setMobileMenuOpen(false)}
              className="w-13 h-13 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/30 border-4 border-card ring-2 ring-primary/20 hover:scale-105 active:scale-90 transition-all animate-pulse"
              title="Presensi Masuk Tersedia — Klik untuk Absen Masuk"
            >
              <Camera className="w-6 h-6" />
            </Link>
          ) : canClockOut ? (
            <Link
              to="/presensi"
              onClick={() => setMobileMenuOpen(false)}
              className="w-13 h-13 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/30 border-4 border-card ring-2 ring-primary/20 hover:scale-105 active:scale-90 transition-all animate-bounce"
              title="Waktu Pulang Tiba — Klik untuk Absen Pulang"
            >
              <Camera className="w-6 h-6" />
            </Link>
          ) : isWaitingClockOut ? (
            <Link
              to="/presensi"
              onClick={() => setMobileMenuOpen(false)}
              className="w-13 h-13 rounded-full bg-muted border-4 border-card text-muted-foreground flex items-center justify-center shadow-sm opacity-85 hover:scale-105 active:scale-90 transition-all"
              title={`Sudah masuk (${todayAtt?.clockIn}). Menunggu waktu pulang pukul ${userShift?.endTime || '17:00'}`}
            >
              <Clock className="w-5 h-5 text-muted-foreground" />
            </Link>
          ) : (
            <Link
              to="/presensi"
              onClick={() => setMobileMenuOpen(false)}
              className="w-13 h-13 rounded-full bg-emerald-500/15 border-4 border-card text-emerald-600 flex items-center justify-center shadow-sm hover:scale-105 active:scale-90 transition-all"
              title="Presensi hari ini selesai"
            >
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            </Link>
          )}
          <span className="text-[9px] font-bold mt-1 tracking-tight text-center leading-none truncate max-w-[62px]">
            {currentRole === 'pimpinan' ? (
              <span className="text-primary font-bold">Direksi</span>
            ) : (
              <>
                {canClockIn && <span className="text-primary">Masuk</span>}
                {isWaitingClockOut && <span className="text-muted-foreground">Tunggu</span>}
                {canClockOut && <span className="text-primary font-extrabold">Pulang</span>}
                {isCompleted && <span className="text-emerald-600">Selesai</span>}
              </>
            )}
          </span>
        </div>

        {/* Item 4: Riwayat / Laporan */}
        <Link
          to={['superadmin', 'admin', 'hrd', 'pimpinan'].includes(currentRole) ? '/admin/laporan' : '/riwayat'}
          onClick={() => setMobileMenuOpen(false)}
          className={cn(
            'flex flex-col items-center justify-center flex-1 py-1 px-0.5 rounded-xl transition-all active:scale-90',
            (location.pathname === '/riwayat' || location.pathname === '/admin/laporan')
              ? 'text-primary font-semibold'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <div
            className={cn(
              'p-1 rounded-xl transition-colors',
              (location.pathname === '/riwayat' || location.pathname === '/admin/laporan') ? 'bg-primary/10 text-primary shadow-xs' : ''
            )}
          >
            {['superadmin', 'admin', 'hrd', 'pimpinan'].includes(currentRole) ? (
              <FileSpreadsheet className="w-5 h-5" />
            ) : (
              <CalendarDays className="w-5 h-5" />
            )}
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-[60px] leading-tight">
            {['superadmin', 'admin', 'hrd', 'pimpinan'].includes(currentRole) ? 'Laporan' : 'Riwayat'}
          </span>
        </Link>

        {/* Item 5: Lainnya */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className={cn(
            'flex flex-col items-center justify-center flex-1 py-1 px-0.5 rounded-xl transition-all active:scale-90',
            mobileMenuOpen
              ? 'text-primary font-semibold'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <div
            className={cn(
              'p-1 rounded-xl transition-colors',
              mobileMenuOpen ? 'bg-primary/10 text-primary shadow-xs' : ''
            )}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight leading-tight">Lainnya</span>
        </button>
      </nav>

      {/* Floating Mobile PWA Install Banner */}
      <PwaInstallButton variant="mobile-banner" />
    </div>
  );
};
