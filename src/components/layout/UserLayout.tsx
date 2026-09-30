import { lazy, Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { UserDesktopSidebar, USER_SIDEBAR_WIDTH } from './UserDesktopSidebar';
import { NotificationAlert } from './NotificationAlert';
import { useNotifications } from '@/hooks/useNotifications';
import { useAuth } from '@/contexts/AuthContext';

const FloatingChatButton = lazy(() => import('@/components/chatbot').then((module) => ({ default: module.FloatingChatButton })));
const ActiveSessionBadge = lazy(() => import('@/components/jadwal/ActiveSessionBadge').then((module) => ({ default: module.ActiveSessionBadge })));

const AI_CHAT_ROLES = new Set(['guru', 'walikelas', 'pembina', 'guru_ekskul', 'santri']);
const ACTIVE_SESSION_ROLES = new Set(['guru', 'walikelas', 'pembina']);

export function UserLayout() {
  const { latestAlert, dismissAlert } = useNotifications(5);
  const { user } = useAuth();
  const normalizedRole = user?.role?.toLowerCase();
  const canUseAiChat = normalizedRole ? AI_CHAT_ROLES.has(normalizedRole) : false;
  const canShowActiveSession = normalizedRole ? ACTIVE_SESSION_ROLES.has(normalizedRole) : false;

  return (
    <div className="min-h-screen bg-background">
      <UserDesktopSidebar />
      <div className="lg:pl-[280px]" style={{ ['--user-sidebar-w' as any]: `${USER_SIDEBAR_WIDTH}px` }}>
        <Header />
        <NotificationAlert notification={latestAlert} onDismiss={dismissAlert} />
        <main className="flex-1 pt-3 sm:pt-4 md:pt-6 pb-20 lg:pb-8 px-2 sm:px-3 md:px-6">
          <div className="container max-w-7xl mx-auto px-0">
            <Outlet />
          </div>
        </main>
      </div>
      {/* Bottom nav: hanya mobile/tablet */}
      <div className="lg:hidden">
        <Sidebar />
      </div>
      <Suspense fallback={null}>
        {canShowActiveSession && <ActiveSessionBadge />}
        {canUseAiChat && <FloatingChatButton />}
      </Suspense>
    </div>
  );
}
