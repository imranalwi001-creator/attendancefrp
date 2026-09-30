import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import logo from '@/assets/logo.png';
import {
  Home, BookOpen, FileText, Calendar, ClipboardList, UserCheck,
  GraduationCap, User, BookMarked, CalendarDays, FileQuestion,
  FolderOpen, Moon, Receipt, Palmtree, Library, ChevronDown, ChevronRight, Layers, Building, School,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useWalikelasData } from '@/hooks/useWalikelasData';
import { useRamadhanConfig } from '@/hooks/useMonitoringRamadhan';
import { useLiburanConfigMonitoring } from '@/hooks/useMonitoringLiburan';
import { useInstitution } from '@/contexts/InstitutionContext';

type Item = { icon: any; label: string; path: string };
type Group = { label: string; items: Item[] };

export const USER_SIDEBAR_WIDTH = 280;

const isPathActive = (pathname: string, path: string) =>
  pathname === path || pathname.startsWith(path + '/');

function useUserGroups(): Group[] {
  const { user } = useAuth();
  const { isWalikelas } = useWalikelasData();
  const { data: ramadhanConfig } = useRamadhanConfig();
  const { data: liburanConfig } = useLiburanConfigMonitoring();
  const { getStudentLabel, getReligionSubjectLabel, hasExams, hasBoarding, workspaceType } = useInstitution();

  if (!user) return [];

  switch (user.role) {
    case 'guru':
    case 'walikelas':
    case 'Pembina': {
      const administrasi: Item[] = [];
      if (workspaceType === 'mandiri') {
        administrasi.push(
          { icon: Building, label: 'Profil Institusi', path: '/admin/settings' },
          { icon: Calendar, label: 'Tahun Ajar & Kalender', path: '/admin/kalender' },
          { icon: School, label: 'Data Kelas & Siswa', path: '/admin/kelas' },
          { icon: BookOpen, label: 'Data Mata Pelajaran', path: '/admin/mapel' }
        );
      }

      const akademik: Item[] = [
        { icon: Layers, label: 'Perangkat Pembelajaran', path: '/app/perangkat-pembelajaran' },
        { icon: FolderOpen, label: 'Bahan Belajar', path: '/app/bahan-belajar' },
      ];
      
      if (hasExams) {
        akademik.push({ icon: FileQuestion, label: 'Ujian', path: '/app/ujian-guru' });
      }
      
      if (hasBoarding) {
        akademik.push({ icon: BookMarked, label: getReligionSubjectLabel(), path: '/app/tahfidz-guru' });
      }

      if (isWalikelas) {
        akademik.unshift({ icon: GraduationCap, label: 'Penilaian', path: '/app/penilaian' });
      }
      const layanan: Item[] = [
        { icon: UserCheck, label: 'Kehadiran', path: '/app/kehadiran' },
        { icon: ClipboardList, label: 'Pengajuan Izin', path: '/app/pengajuan-izin' },
      ];
      const lainnya: Item[] = [
        { icon: CalendarDays, label: 'Kalender', path: '/app/kalender' },
        { icon: User, label: 'Profil', path: '/app/profil-staff' },
      ];
      if (ramadhanConfig) lainnya.unshift({ icon: Moon, label: 'Monitoring Ramadhan', path: '/app/monitoring-ramadhan' });
      if (liburanConfig) lainnya.unshift({ icon: Palmtree, label: 'Kontroling Liburan', path: '/app/monitoring-liburan' });

      const menus: Group[] = [
        {
          label: 'MENU UTAMA',
          items: [
            { icon: Home, label: 'Beranda', path: '/app/dashboard' },
            { icon: Calendar, label: 'Jadwal Mengajar', path: '/app/jadwal-guru' },
            { icon: BookOpen, label: 'Mata Pelajaran', path: '/app/mapel' },
          ],
        }
      ];

      if (administrasi.length > 0) {
        menus.push({ label: 'ADMINISTRASI MANDIRI', items: administrasi });
      }

      menus.push(
        { label: 'AKADEMIK', items: akademik },
        { label: 'KEHADIRAN & LAYANAN', items: layanan },
        { label: 'LAINNYA', items: lainnya }
      );

      return menus;
    }
    case 'guru_ekskul':
      return [
        {
          label: 'MENU UTAMA',
          items: [
            { icon: Home, label: 'Beranda', path: '/app/dashboard' },
            { icon: Calendar, label: 'Jadwal', path: '/app/jadwal-guru' },
            { icon: BookOpen, label: 'Ekskul', path: '/app/mapel' },
          ],
        },
        {
          label: 'KEHADIRAN & LAYANAN',
          items: [
            { icon: UserCheck, label: 'Kehadiran', path: '/app/kehadiran' },
            { icon: ClipboardList, label: 'Pengajuan Izin', path: '/app/pengajuan-izin' },
          ],
        },
      ];
    case 'santri': {
      const utama: Item[] = [
        { icon: Home, label: 'Beranda', path: '/app/dashboard' },
        { icon: BookOpen, label: 'Mata Pelajaran', path: '/app/mapel' },
      ];
      if (hasBoarding) utama.push({ icon: BookMarked, label: getReligionSubjectLabel(), path: '/app/tahfidz' });
      
      const akademik: Item[] = [
        { icon: FolderOpen, label: 'Bahan Belajar', path: '/app/bahan-belajar' },
        { icon: Library, label: 'Perpustakaan', path: '/app/perpustakaan' },
        { icon: FileText, label: 'Raport', path: '/app/raport' },
      ];
      const lainnya: Item[] = [
        { icon: User, label: 'Profil', path: '/app/profil' },
      ];
      if (liburanConfig) utama.push({ icon: Palmtree, label: 'Liburan', path: '/app/liburan' });
      if (ramadhanConfig) lainnya.unshift({ icon: Moon, label: 'Ramadhan', path: '/app/ramadhan' });
      return [
        { label: 'MENU UTAMA', items: utama },
        { label: 'AKADEMIK', items: akademik },
        { label: 'LAINNYA', items: lainnya },
      ];
    }
    case 'orangtua': {
      const utama: Item[] = [
        { icon: Home, label: 'Beranda', path: '/app/dashboard' },
        { icon: Receipt, label: 'Tagihan', path: '/app/tagihan' },
      ];
      if (liburanConfig) utama.push({ icon: Palmtree, label: 'Liburan', path: '/app/liburan' });
      return [
        { label: 'MENU UTAMA', items: utama },
        {
          label: 'KEHADIRAN & LAYANAN',
          items: [
            { icon: UserCheck, label: `Kehadiran ${getStudentLabel()}`, path: '/app/kehadiran-santri' },
          ],
        },
        {
          label: 'LAINNYA',
          items: [{ icon: User, label: 'Profil', path: '/app/profil-orangtua' }],
        },
      ];
    }
    case 'staff':
      return [
        {
          label: 'MENU UTAMA',
          items: [{ icon: Home, label: 'Beranda', path: '/app/dashboard' }],
        },
        {
          label: 'KEHADIRAN & LAYANAN',
          items: [
            { icon: UserCheck, label: 'Kehadiran', path: '/app/kehadiran' },
            { icon: ClipboardList, label: 'Pengajuan Izin', path: '/app/pengajuan-izin' },
          ],
        },
        {
          label: 'LAINNYA',
          items: [{ icon: User, label: 'Profil', path: '/app/profil-staff' }],
        },
      ];
    default:
      return [];
  }
}

export function UserDesktopSidebar() {
  const location = useLocation();
  const groups = useUserGroups();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const toggle = (label: string) =>
    setOpenGroups(p => ({ ...p, [label]: p[label] === false }));

  if (groups.length === 0) return null;

  return (
    <aside
      className="hidden lg:flex fixed top-0 left-0 bottom-0 z-40 flex-col bg-card border-r border-border"
      style={{ width: USER_SIDEBAR_WIDTH }}
    >
      <div className="h-14 md:h-16 px-4 flex items-center gap-3 shrink-0">
        <img src={logo} alt="LMS Digiss" className="h-10 w-10 rounded-xl shadow-sm object-contain" />
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground leading-tight">LMS Digiss</p>
          <p className="text-[11px] text-muted-foreground truncate">Learning Management System</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-soft px-3 pt-3 pb-3 space-y-4">
        {groups.map(group => {
          const isOpen = openGroups[group.label] !== false;
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
