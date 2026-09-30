import { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Home, BookOpen, FileText, Calendar, ClipboardList, UserCheck, GraduationCap, User, BookMarked, CalendarDays, Menu, FileQuestion, FolderOpen, Moon, Receipt, Palmtree, Library } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useWalikelasData } from '@/hooks/useWalikelasData';
import { useRamadhanConfig } from '@/hooks/useMonitoringRamadhan';
import { useLiburanConfigMonitoring } from '@/hooks/useMonitoringLiburan';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

const menuColors = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-orange-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-cyan-500',
];

export function Sidebar() {
  const { user } = useAuth();
  const { isWalikelas } = useWalikelasData();
  const { data: ramadhanConfig } = useRamadhanConfig();
  const { data: liburanConfig } = useLiburanConfigMonitoring();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleNavigate = (path: string) => {
    navigate(path);
    setDrawerOpen(false);
  };

  const getMenuConfig = () => {
    if (!user) return { primaryItems: [], moreItems: [] };

    switch (user.role) {
      case 'guru':
      case 'walikelas':
      case 'Pembina': {
        const primary = [
          { icon: Home, label: 'Beranda', path: '/app/dashboard' },
          { icon: Calendar, label: 'Jadwal', path: '/app/jadwal-guru' },
          { icon: BookOpen, label: 'Mapel', path: '/app/mapel' },
        ];
        
        const more = [
          { icon: FolderOpen, label: 'Bahan Belajar', path: '/app/bahan-belajar', color: menuColors[5] },
          { icon: FileQuestion, label: 'Ujian', path: '/app/ujian-guru', color: menuColors[4] },
          { icon: CalendarDays, label: 'Kalender', path: '/app/kalender', color: menuColors[0] },
          { icon: UserCheck, label: 'Kehadiran', path: '/app/kehadiran', color: menuColors[1] },
          { icon: ClipboardList, label: 'Izin', path: '/app/pengajuan-izin', color: menuColors[2] },
          { icon: BookMarked, label: 'Tahfidz', path: '/app/tahfidz-guru', color: 'bg-green-600' },
          ...(ramadhanConfig ? [{ icon: Moon, label: 'Monitoring Ramadhan', path: '/app/monitoring-ramadhan', color: 'bg-teal-500' }] : []),
          ...(liburanConfig ? [{ icon: Palmtree, label: 'Kontroling Liburan', path: '/app/monitoring-liburan', color: 'bg-orange-500' }] : []),
        ];
        
        if (isWalikelas) {
          more.unshift({ icon: GraduationCap, label: 'Penilaian', path: '/app/penilaian', color: menuColors[3] });
        }
        
        return { primaryItems: primary, moreItems: more };
      }
      case 'guru_ekskul':
        return {
          primaryItems: [
            { icon: Home, label: 'Beranda', path: '/app/dashboard' },
            { icon: Calendar, label: 'Jadwal', path: '/app/jadwal-guru' },
            { icon: BookOpen, label: 'Ekskul', path: '/app/mapel' },
          ],
          moreItems: [
            { icon: UserCheck, label: 'Kehadiran', path: '/app/kehadiran', color: menuColors[0] },
            { icon: ClipboardList, label: 'Izin', path: '/app/pengajuan-izin', color: menuColors[1] },
          ],
        };
      case 'santri':
        return {
          primaryItems: [
            { icon: Home, label: 'Beranda', path: '/app/dashboard' },
            { icon: BookOpen, label: 'Mapel', path: '/app/mapel' },
            { icon: BookMarked, label: 'Tahfidz', path: '/app/tahfidz' },
            ...(liburanConfig ? [{ icon: Palmtree, label: 'Liburan', path: '/app/liburan' }] : []),
          ],
          moreItems: [
            ...(ramadhanConfig ? [{ icon: Moon, label: 'Ramadhan', path: '/app/ramadhan', color: 'bg-teal-500' }] : []),
            { icon: FolderOpen, label: 'Bahan Belajar', path: '/app/bahan-belajar', color: menuColors[2] },
            { icon: Library, label: 'Perpustakaan', path: '/app/perpustakaan', color: 'bg-violet-500' },
            { icon: FileText, label: 'Raport', path: '/app/raport', color: menuColors[0] },
            { icon: User, label: 'Profil', path: '/app/profil', color: menuColors[1] },
          ],
        };
      case 'orangtua':
        return {
          primaryItems: [
            { icon: Home, label: 'Beranda', path: '/app/dashboard' },
            { icon: Receipt, label: 'Tagihan', path: '/app/tagihan' },
            ...(liburanConfig ? [{ icon: Palmtree, label: 'Liburan', path: '/app/liburan' }] : []),
            { icon: User, label: 'Profil', path: '/app/profil-orangtua' },
          ],
          moreItems: [
            { icon: UserCheck, label: 'Kehadiran Anak', path: '/app/kehadiran-santri', color: menuColors[0] },
          ],
        };
      case 'staff':
        return {
          primaryItems: [
            { icon: Home, label: 'Beranda', path: '/app/dashboard' },
            { icon: UserCheck, label: 'Kehadiran', path: '/app/kehadiran' },
            { icon: ClipboardList, label: 'Izin', path: '/app/pengajuan-izin' },
          ],
          moreItems: [
            { icon: User, label: 'Profil', path: '/app/profil-staff', color: menuColors[0] },
          ],
        };
      default:
        return { primaryItems: [], moreItems: [] };
    }
  };

  const { primaryItems, moreItems } = getMenuConfig();
  
  const isMoreMenuActive = moreItems.some(item => 
    location.pathname.startsWith(item.path)
  );

  const showMoreButton = moreItems.length > 0;

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/40 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70 shadow-lg safe-area-inset-bottom">
        <div className="container max-w-2xl mx-auto px-2 md:px-4">
          <div className="flex items-center justify-between py-2 md:py-3">
            {primaryItems.map((item, index) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  cn(
                    'group relative flex flex-1 flex-col items-center justify-center gap-0.5 md:gap-1.5 rounded-lg md:rounded-xl py-1.5 md:py-2 text-[10px] md:text-xs font-medium transition-all duration-200',
                    isActive
                      ? 'text-primary bg-primary/10'
                      : 'text-muted-foreground hover:text-primary hover:bg-primary/5 active:scale-95'
                  )
                }
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {({ isActive }) => (
                  <>
                    <item.icon 
                      className={cn(
                        "h-4 w-4 md:h-5 md:w-5 transition-all duration-300 ease-out",
                        !isActive && "group-hover:scale-110 group-hover:text-primary"
                      )} 
                      strokeWidth={isActive ? 2.5 : 2} 
                    />
                    <span className={cn(
                      "text-[9px] md:text-[10px] transition-all duration-200",
                      isActive && "font-semibold"
                    )}>
                      {item.label}
                    </span>
                    {isActive && (
                      <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-8 md:w-10 h-0.5 bg-primary rounded-full" />
                    )}
                  </>
                )}
              </NavLink>
            ))}
            
            {showMoreButton && (
              <button
                onClick={() => setDrawerOpen(true)}
                className={cn(
                  'group relative flex flex-1 flex-col items-center justify-center gap-0.5 md:gap-1.5 rounded-lg md:rounded-xl py-1.5 md:py-2 text-[10px] md:text-xs font-medium transition-all duration-200',
                  isMoreMenuActive
                    ? 'text-primary bg-primary/10'
                    : 'text-muted-foreground hover:text-primary hover:bg-primary/5 active:scale-95'
                )}
              >
                <Menu 
                  className={cn(
                    "h-4 w-4 md:h-5 md:w-5 transition-all duration-300 ease-out",
                    !isMoreMenuActive && "group-hover:scale-110 group-hover:text-primary"
                  )} 
                  strokeWidth={isMoreMenuActive ? 2.5 : 2} 
                />
                <span className={cn(
                  "text-[9px] md:text-[10px] transition-all duration-200",
                  isMoreMenuActive && "font-semibold"
                )}>
                  Lainnya
                </span>
                {isMoreMenuActive && (
                  <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-8 md:w-10 h-0.5 bg-primary rounded-full" />
                )}
              </button>
            )}
          </div>
        </div>
      </nav>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader className="pb-4">
            <SheetTitle>Menu Lainnya</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-4 gap-4 pb-6">
            {moreItems.map((item) => {
              const isActive = location.pathname.startsWith(item.path);
              return (
                <button
                  key={item.path}
                  onClick={() => handleNavigate(item.path)}
                  className={cn(
                    "flex flex-col items-center gap-2 p-3 rounded-xl transition-all",
                    isActive 
                      ? "bg-primary/10 ring-2 ring-primary/30" 
                      : "hover:bg-muted active:scale-95"
                  )}
                >
                  <div className={cn(
                    "p-3 rounded-xl text-white",
                    item.color || 'bg-primary'
                  )}>
                    <item.icon className="h-5 w-5" strokeWidth={2} />
                  </div>
                  <span className={cn(
                    "text-xs text-center",
                    isActive ? "font-semibold text-primary" : "text-muted-foreground"
                  )}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
