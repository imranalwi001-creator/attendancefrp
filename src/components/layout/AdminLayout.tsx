import { lazy, Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { AdminSidebar } from './AdminSidebar';
import { AdminDesktopSidebar } from './AdminDesktopSidebar';
import { UserDesktopSidebar } from './UserDesktopSidebar';
import { Sidebar as UserMobileSidebar } from './Sidebar';
import { NotificationAlert } from './NotificationAlert';
import { useNotifications } from '@/hooks/useNotifications';
import { useAuth } from '@/contexts/AuthContext';

const FloatingChatButton = lazy(() => import('@/components/chatbot').then((module) => ({ default: module.FloatingChatButton })));
const ActiveSessionBadge = lazy(() => import('@/components/jadwal/ActiveSessionBadge').then((module) => ({ default: module.ActiveSessionBadge })));

const AI_CHAT_ROLES = new Set(['guru', 'walikelas', 'pembina', 'guru_ekskul', 'santri']);
const ACTIVE_SESSION_ROLES = new Set(['guru', 'walikelas', 'pembina']);

export function AdminLayout() {
  const { latestAlert, dismissAlert } = useNotifications(5);
  const { user } = useAuth();
  const normalizedRole = user?.role?.toLowerCase();
  const canUseAiChat = normalizedRole ? AI_CHAT_ROLES.has(normalizedRole) : false;
  const canShowActiveSession = normalizedRole ? ACTIVE_SESSION_ROLES.has(normalizedRole) : false;
  const isGuru = user?.role === 'guru';

  return (
    <div className="min-h-screen bg-muted/20">
      {isGuru ? <UserDesktopSidebar /> : <AdminDesktopSidebar />}
      <main className="lg:pl-[280px] flex-1 pb-24 lg:pb-8">
        <Header />
        <NotificationAlert notification={latestAlert} onDismiss={dismissAlert} />
        <div className="pt-6 px-4 sm:px-6">
          <Outlet />
        </div>
      </main>
      <div className="lg:hidden">
        {isGuru ? <UserMobileSidebar /> : <AdminSidebar />}
      </div>
      <Suspense fallback={null}>
        {canShowActiveSession && <ActiveSessionBadge />}
        {canUseAiChat && <FloatingChatButton />}
      </Suspense>
    </div>
  );
}
