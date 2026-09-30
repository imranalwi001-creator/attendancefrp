import { User, LogOut, Bell } from 'lucide-react';
import logo from '@/assets/logo.png';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useNotifications } from '@/hooks/useNotifications';

interface HeaderProps {
  onMenuClick?: () => void;
}

const formatTimestamp = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export function Header({ onMenuClick }: HeaderProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const { notifications, unreadCount, markAsRead } = useNotifications(5);

  const isAdminRoute = location.pathname.startsWith('/admin');

  const handleLogout = async () => {
    await logout();
    navigate('/login');
    setShowLogoutDialog(false);
  };

  const handleNotificationClick = async (notificationId: string, isRead: boolean) => {
    if (!isRead) {
      await markAsRead(notificationId);
    }
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      admin: 'Administrator',
      guru: 'Guru / Wali Kelas',
      walikelas: 'Wali Kelas',
      Pembina: 'Pembina',
      staff: 'Staff',
      santri: 'Santri',
      orangtua: 'Orang Tua'
    };
    return labels[role] || role;
  };

  const getProfilePath = () => {
    if (!user) return '/app/profil';
    switch (user.role) {
      case 'santri':
        return '/app/profil';
      case 'orangtua':
        return '/app/profil-orangtua';
      case 'guru':
      case 'walikelas':
      case 'Pembina':
      case 'staff':
        return '/app/profil-staff';
      default:
        return '/app/profil';
    }
  };

  return (
    <header className={cn(
      'sticky top-0 z-30 w-full bg-card',
      isAdminRoute ? 'lg:border-b lg:border-border/60 border-b shadow-sm lg:shadow-none' : 'border-b shadow-sm',
    )}>
      <div className="flex h-14 md:h-16 items-center justify-between px-3 md:px-6">
        <div className="flex items-center gap-2 md:gap-4">
          <div className="flex items-center gap-2 md:gap-3 lg:hidden">
            <img src={logo} alt="LMS Digiss Logo" className="h-8 w-8 md:h-10 md:w-10 rounded-lg md:rounded-xl shadow-md object-contain" />
            <div className="hidden sm:block">
              <h1 className="text-base md:text-lg font-bold text-foreground">LMS Digiss</h1>
              <p className="text-[10px] md:text-xs text-muted-foreground">Learning Management System</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 md:gap-2">
          {user && (
            <>
              <Popover>
                <PopoverTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="relative rounded-full border border-border/40 bg-card/50 transition-all duration-300 hover:bg-primary hover:text-primary-foreground hover:border-primary hover:scale-105 h-8 w-8 md:h-10 md:w-10"
                  >
                    <Bell className="h-4 w-4 md:h-5 md:w-5" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 md:-top-1 md:-right-1 h-4 w-4 md:h-5 md:w-5 rounded-full bg-destructive text-destructive-foreground text-[10px] md:text-xs flex items-center justify-center font-medium">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent 
                  align="end" 
                  className="w-80 p-0 bg-background border border-border shadow-lg"
                  sideOffset={8}
                >
                  <div className="flex items-center justify-between p-4 border-b border-border">
                    <h3 className="font-semibold text-foreground">Notifikasi</h3>
                    <span className="text-sm text-primary">
                      {unreadCount} Belum Dilihat
                    </span>
                  </div>
                  <ScrollArea className="h-80">
                    <div className="divide-y divide-border">
                      {notifications.length > 0 ? (
                        notifications.map((notification) => (
                          <div 
                            key={notification.id}
                            onClick={() => handleNotificationClick(notification.id, notification.is_read)}
                            className={`p-4 flex gap-3 hover:bg-muted/50 cursor-pointer transition-colors ${
                              !notification.is_read ? 'border-l-4 border-l-primary bg-primary/5' : ''
                            }`}
                          >
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <Bell className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground">
                                {notification.title}
                              </p>
                              <p className="text-sm text-muted-foreground leading-relaxed mt-0.5">
                                {notification.message}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {formatTimestamp(notification.created_at)}
                              </p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-8 text-center text-muted-foreground">
                          Tidak ada notifikasi
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                  <div className="p-3 border-t border-border">
                    <Button 
                      className="w-full" 
                      variant="default"
                      onClick={() => navigate(isAdminRoute ? '/admin/notifikasi' : '/app/notifikasi')}
                    >
                      Lihat Semua
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-1.5 md:gap-2 rounded-full bg-card/50 transition-all duration-300 hover:bg-primary hover:text-primary-foreground active:scale-95 h-8 md:h-10 px-2 md:px-3">
                    <div className="flex h-6 w-6 md:h-8 md:w-8 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors duration-200">
                      <User className="h-3.5 w-3.5 md:h-4 md:w-4" />
                    </div>
                    <div className="hidden md:block text-left">
                      <p className="text-sm font-medium">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{getRoleLabel(user.role)}</p>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Akun Saya</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium">{user.name}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  {!isAdminRoute && (
                    <DropdownMenuItem onClick={() => navigate(getProfilePath())}>
                      <User className="mr-2 h-4 w-4" />
                      Profil
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => setShowLogoutDialog(true)} className="text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>

      <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Logout</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin keluar dari sistem? Anda perlu login kembali untuk mengakses aplikasi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogout} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Ya, Logout
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  );
}
