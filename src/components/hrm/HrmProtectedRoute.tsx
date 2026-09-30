import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useHrmAuth } from '@/contexts/HrmAuthContext';
import { HrmLayout } from './HrmLayout';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export const HrmProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { isAuthenticated, isLoading, role } = useHrmAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-foreground space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground font-medium">Memuat data sesi HRM...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check role permission if specified
  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = role.toLowerCase();
    if (userRole !== 'superadmin' && !allowedRoles.includes(userRole)) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <HrmLayout>{children}</HrmLayout>;
};
