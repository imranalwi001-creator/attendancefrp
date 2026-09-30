import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useInstitution } from '@/contexts/InstitutionContext';
import { AuthLoadingSkeleton } from '@/components/layout/LoadingFallback';

export function AdminRoute() {
  const { user, supabaseUser, loading } = useAuth();
  const { workspaceType } = useInstitution();
  const location = useLocation();

  // Wait until auth + role are fully resolved
  if (loading || (supabaseUser && !user)) {
    return <AuthLoadingSkeleton />;
  }

  // Not authenticated - redirect to login
  if (!supabaseUser || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Allow admin OR guru with mandiri workspace
  const isGuruMandiri = user.role === 'guru' && workspaceType === 'mandiri';
  const isAdmin = user.role === 'admin';

  if (!isAdmin && !isGuruMandiri) {
    return <Navigate to="/app/dashboard" replace />;
  }

  return <Outlet />;
}

