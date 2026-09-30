import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AuthLoadingSkeleton } from '@/components/layout/LoadingFallback';

export function UserRoute() {
  const { user, supabaseUser, loading } = useAuth();
  const location = useLocation();

  // Wait until auth + role are fully resolved
  if (loading || (supabaseUser && !user)) {
    return <AuthLoadingSkeleton />;
  }

  // Not authenticated - redirect to login
  if (!supabaseUser || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Admin should use admin routes - redirect immediately
  if (user.role === 'admin') {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return <Outlet />;
}

