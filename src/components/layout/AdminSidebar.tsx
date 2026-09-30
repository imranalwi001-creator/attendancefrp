import { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { LayoutDashboard, Users, UserCheck, Settings, Grid3X3, BookOpen, GraduationCap, Calendar, ClipboardCheck, FileText, Image, MessageCircleHeart, CalendarDays, FileCheck, ScrollText, FileQuestion, FolderOpen, BookMarked, Receipt, Library, Building2, Activity, ShieldCheck } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useInstitution } from '@/contexts/InstitutionContext';

const adminMenuItems = [{
  icon: LayoutDashboard,
  label: 'Dashboard',
  path: '/admin/dashboard'
}, {
  icon: Users,
  label: 'Users',
  path: '/admin/users'
}, {
  icon: UserCheck,
  label: 'Kehadiran Belajar',
  path: '/admin/kehadiran'
}];

const moreMenuItems = [{
  icon: GraduationCap,
  label: 'Kelas',
  description: 'Manajemen kelas & wali kelas',
  path: '/admin/kelas',
  color: 'bg-purple-500'
}, {
  icon: BookOpen,
  label: 'Mata Pelajaran',
  description: 'Kelola mapel & pengampu',
  path: '/admin/mapel',
  color: 'bg-orange-500'
}, {
  icon: FolderOpen,
  label: 'Bahan Belajar',
  description: 'Materi Google Drive',
  path: '/admin/bahan-belajar',
  color: 'bg-lime-500'
}, {
  icon: Calendar,
  label: 'Jadwal',
  description: 'Atur jadwal pembelajaran',
  path: '/admin/jadwal',
  color: 'bg-cyan-500'
}, {
  icon: FileText,
  label: 'Penilaian',
  description: 'Nilai & rapor santri',
  path: '/admin/penilaian',
  color: 'bg-amber-500'
}, {
  icon: Image,
  label: 'Banner',
  description: 'Kelola banner informasi',
  path: '/admin/banners',
  color: 'bg-indigo-500'
}, {
  icon: MessageCircleHeart,
  label: 'Konseling',
  description: 'Layanan konseling santri',
  path: '/admin/konseling',
  color: 'bg-pink-500'
}, {
  icon: CalendarDays,
  label: 'Kalender',
  description: 'Kalender pendidikan',
  path: '/admin/kalender',
  color: 'bg-teal-500'
}, {
  icon: UserCheck,
  label: 'Kehadiran Staff',
  description: 'Kehadiran guru & staff',
  path: '/admin/kehadiran-staff',
  color: 'bg-emerald-500'
}, {
  icon: FileCheck,
  label: 'Pengajuan Izin',
  description: 'Kelola pengajuan izin',
  path: '/admin/pengajuan-izin',
  color: 'bg-sky-500'
}, {
  icon: FileQuestion,
  label: 'Ujian',
  description: 'Kelola ujian santri',
  path: '/admin/ujian',
  color: 'bg-rose-500'
}, {
  icon: BookMarked,
  label: 'Tahfidz',
  description: 'Manajemen tahfidz santri',
  path: '/admin/tahfidz',
  color: 'bg-green-600'
}, {
  icon: Receipt,
  label: 'Tagihan',
  description: 'Kelola tagihan santri',
  path: '/admin/tagihan',
  color: 'bg-yellow-500'
}, {
  icon: Library,
  label: 'Perpustakaan',
  description: 'Inventaris & sirkulasi buku',
  path: '/admin/perpustakaan',
  color: 'bg-violet-500'
}, {
  icon: ScrollText,
  label: 'Aktifitas Log',
  description: 'Catatan aksi user',
  path: '/admin/activity-log',
  color: 'bg-slate-500'
}, {
  icon: Settings,
  label: 'Settings',
  description: 'Pengaturan sistem',
  path: '/admin/settings',
  color: 'bg-gray-500'
}];

const superadminMenuItems = [{
  icon: LayoutDashboard,
  label: 'Dashboard',
  path: '/admin/dashboard'
}, {
  icon: Building2,
  label: 'Tenants',
  path: '/admin/tenants'
}, {
  icon: Activity,
  label: 'Monitoring',
  path: '/admin/monitoring'
}];

const superadminMoreMenuItems = [{
  icon: Receipt,
  label: 'Billing',
  description: 'Manajemen tagihan SaaS',
  path: '/admin/billing',
  color: 'bg-green-500'
}, {
  icon: ShieldCheck,
  label: 'Superadmins',
  description: 'Manajemen pengguna global',
  path: '/admin/superadmins',
  color: 'bg-purple-500'
}, {
  icon: Settings,
  label: 'SaaS Settings',
  description: 'Konfigurasi aplikasi',
  path: '/admin/saas-settings',
  color: 'bg-gray-500'
}];

export function AdminSidebar() {
  const { workspaceType } = useInstitution();
  const isSuperadmin = workspaceType === 'mandiri';
  const currentMenuItems = isSuperadmin ? superadminMenuItems : adminMenuItems;
  const currentMoreMenuItems = isSuperadmin ? superadminMoreMenuItems : moreMenuItems;

  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const isMoreMenuActive = currentMoreMenuItems.some(item => location.pathname.startsWith(item.path));

  const handleNavigate = (path: string) => {
    navigate(path);
    setOpen(false);
  };

  return <>
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background pb-[env(safe-area-inset-bottom)]">
      <nav className="w-full px-2 sm:px-4">
        <ul className="flex items-center justify-around py-1.5 sm:py-2">
          {currentMenuItems.map(item => {
            const Icon = item.icon;
            return <li key={item.path}>
              <NavLink to={item.path} className={({
                isActive
              }) => cn('group relative flex flex-col items-center gap-1 rounded-lg px-3 py-1.5 sm:px-4 sm:py-2 text-[10px] sm:text-xs font-medium transition-all duration-200', isActive ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-primary active:bg-primary/10')}>
                {({
                  isActive
                }) => <>
                  <Icon className={cn('h-5 w-5 transition-all', isActive && 'fill-current')} />
                  <span className="text-center leading-tight whitespace-nowrap">{item.label}</span>
                </>}
              </NavLink>
            </li>;
          })}
          {/* Lainnya Menu */}
          <li>
            <button
              onClick={() => setOpen(true)}
              className={cn(
                'group relative flex flex-col items-center gap-1 rounded-lg px-3 py-1.5 sm:px-4 sm:py-2 text-[10px] sm:text-xs font-medium transition-all duration-200',
                isMoreMenuActive ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-primary active:bg-primary/10'
              )}
            >
              <Grid3X3 className={cn('h-5 w-5 transition-all', isMoreMenuActive && 'fill-current')} />
              <span className="text-center leading-tight whitespace-nowrap">Lainnya</span>
            </button>
          </li>
        </ul>
      </nav>
    </div>

    {/* More Menu Dialog */}
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-8">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-xl font-semibold">Menu Lainnya</SheetTitle>
        </SheetHeader>
        
        <div className="grid grid-cols-4 gap-3">
          {currentMoreMenuItems.map(item => (
            <button
              key={item.path}
              onClick={() => handleNavigate(item.path)}
              className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-muted transition-all duration-200 text-center group"
            >
              <div className={`p-2.5 rounded-xl ${item.color} text-white group-hover:scale-110 transition-transform duration-200`}>
                <item.icon className="h-5 w-5" />
              </div>
              <p className="font-medium text-foreground text-xs leading-tight">{item.label}</p>
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  </>;
}