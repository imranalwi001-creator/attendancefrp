import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import logo from '@/assets/logo.png';
import {
  LayoutDashboard, Users, UserCheck, Settings, BookOpen, GraduationCap,
  Calendar, FileText, Image, MessageCircleHeart, CalendarDays, FileCheck,
  ScrollText, FileQuestion, FolderOpen, BookMarked, Receipt, Library,
  ChevronDown, ChevronRight, Building2, Activity, ShieldCheck
} from 'lucide-react';
import { useInstitution } from '@/contexts/InstitutionContext';

type Item = { icon: any; label: string; path: string };
type Group = { label: string; items: Item[] };

const sekolahGroups: Group[] = [
  {
    label: 'MENU UTAMA',
    items: [
      { icon: LayoutDashboard, label: 'Dashboard', path: '/admin/dashboard' },
      { icon: Users, label: 'Users', path: '/admin/users' },
      { icon: GraduationCap, label: 'Kelas', path: '/admin/kelas' },
      { icon: BookOpen, label: 'Mata Pelajaran', path: '/admin/mapel' },
      { icon: Calendar, label: 'Jadwal', path: '/admin/jadwal' },
      { icon: CalendarDays, label: 'Kalender', path: '/admin/kalender' },
    ],
  },
  {
    label: 'AKADEMIK',
    items: [
      { icon: FileText, label: 'Penilaian', path: '/admin/penilaian' },
      { icon: FileQuestion, label: 'Ujian', path: '/admin/ujian' },
      { icon: BookMarked, label: 'Tahfidz', path: '/admin/tahfidz' },
      { icon: FolderOpen, label: 'Bahan Belajar', path: '/admin/bahan-belajar' },
      { icon: Library, label: 'Perpustakaan', path: '/admin/perpustakaan' },
    ],
  },
  {
    label: 'KEHADIRAN & LAYANAN',
    items: [
      { icon: UserCheck, label: 'Kehadiran Belajar', path: '/admin/kehadiran' },
      { icon: UserCheck, label: 'Kehadiran Staff', path: '/admin/kehadiran-staff' },
      { icon: FileCheck, label: 'Pengajuan Izin', path: '/admin/pengajuan-izin' },
      { icon: MessageCircleHeart, label: 'Konseling', path: '/admin/konseling' },
      { icon: Receipt, label: 'Tagihan', path: '/admin/tagihan' },
    ],
  },
  {
    label: 'SISTEM',
    items: [
      { icon: Image, label: 'Banner', path: '/admin/banners' },
      { icon: ScrollText, label: 'Aktifitas Log', path: '/admin/activity-log' },
      { icon: Settings, label: 'Pengaturan', path: '/admin/settings' },
    ],
  },
];

const superadminGroups: Group[] = [
  {
    label: 'MENU UTAMA',
    items: [
      { icon: LayoutDashboard, label: 'Dashboard', path: '/admin/dashboard' },
      { icon: Building2, label: 'Tenants / Sekolah', path: '/admin/tenants' },
      { icon: Activity, label: 'Sistem Monitoring', path: '/admin/monitoring' },
      { icon: Receipt, label: 'Billing & Subscriptions', path: '/admin/billing' },
    ],
  },
  {
    label: 'PENGATURAN GLOBAL',
    items: [
      { icon: ShieldCheck, label: 'Superadmin Users', path: '/admin/superadmins' },
      { icon: Settings, label: 'Konfigurasi SaaS', path: '/admin/saas-settings' },
    ],
  },
];

export const ADMIN_SIDEBAR_WIDTH = 280;

const isPathActive = (pathname: string, path: string) =>
  pathname === path || pathname.startsWith(path + '/');

export function AdminDesktopSidebar() {
  const location = useLocation();
  const { workspaceType } = useInstitution();
  
  const groups = workspaceType === 'sekolah' ? sekolahGroups : superadminGroups;
  
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(groups.map(g => [g.label, true])),
  );

  const toggle = (label: string) =>
    setOpenGroups(p => ({ ...p, [label]: !p[label] }));

  return (
    <aside
      className="hidden lg:flex fixed top-0 left-0 bottom-0 z-40 flex-col bg-card border-r border-border"
      style={{ width: ADMIN_SIDEBAR_WIDTH }}
    >
      {/* Brand */}
      <div className="h-14 md:h-16 px-4 flex items-center gap-3 shrink-0">
        <img src={logo} alt="LMS Digiss" className="h-10 w-10 rounded-xl shadow-sm object-contain" />
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground leading-tight">LMS Digiss</p>
          <p className="text-[11px] text-muted-foreground truncate">Learning Management System</p>
        </div>
      </div>

      {/* Menu (scrollable) */}
      <div className="flex-1 overflow-y-auto scrollbar-soft px-3 pt-3 pb-3 space-y-4">
        {groups.map(group => {
          const isOpen = openGroups[group.label];
          return (
            <div key={group.label} className="space-y-1">
              <button
                type="button"
                onClick={() => toggle(group.label)}
                className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-semibold tracking-wider text-muted-foreground hover:text-foreground transition-colors"
              >
                <span>{group.label}</span>
                <ChevronDown
                  className={cn('h-3.5 w-3.5 transition-transform', !isOpen && '-rotate-90')}
                />
              </button>
              {isOpen && (
                <div className="space-y-0.5">
                  {group.items.map(item => {
                    const Icon = item.icon;
                    const active = isPathActive(location.pathname, item.path);
                    return (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                          active
                            ? 'bg-primary/10 text-primary'
                            : 'text-foreground hover:bg-muted',
                        )}
                      >
                        <Icon className={cn('h-5 w-5 shrink-0', active ? 'text-primary' : 'text-foreground')} strokeWidth={1.75} />
                        <span className="truncate">{item.label}</span>
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Help footer */}
      <div className="px-3 pt-4 pb-5 shrink-0">
        <button
          type="button"
          className="w-full text-left rounded-2xl bg-primary/5 border border-primary/10 p-4 hover:bg-primary/10 transition-colors group"
        >
          <p className="text-sm font-semibold text-foreground">Butuh bantuan?</p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="text-[12px] text-primary font-medium">Kunjungi Pusat Bantuan</span>
            <ChevronRight className="h-4 w-4 text-primary shrink-0 transition-transform group-hover:translate-x-0.5" />
          </div>
        </button>
      </div>
    </aside>
  );
}
