import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';

import { ThemeProvider } from 'next-themes';

import { HrmAuthProvider } from '@/contexts/HrmAuthContext';
import { HrmProtectedRoute } from '@/components/hrm/HrmProtectedRoute';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// HRM Pages
import { HrmLogin } from '@/pages/hrm/HrmLogin';
import { HrmDashboard } from '@/pages/hrm/HrmDashboard';
import { HrmEmployeeDashboard } from '@/pages/hrm/HrmEmployeeDashboard';
import { HrmLeavePage } from '@/pages/hrm/HrmLeavePage';
import { HrmAttendanceHistoryPage } from '@/pages/hrm/HrmAttendanceHistoryPage';
import { HrmApprovalPage } from '@/pages/hrm/HrmApprovalPage';
import { HrmLiveMonitoringPage } from '@/pages/hrm/HrmLiveMonitoringPage';
import { HrmReportsPage } from '@/pages/hrm/HrmReportsPage';
import { HrmEmployeesPage } from '@/pages/hrm/HrmEmployeesPage';
import { HrmDivisionsPage } from '@/pages/hrm/HrmDivisionsPage';
import { HrmRolesPage } from '@/pages/hrm/HrmRolesPage';
import { HrmSettingsPage } from '@/pages/hrm/HrmSettingsPage';
import { HrmPayrollPage } from '@/pages/hrm/HrmPayrollPage';
import { HrmKioskPage } from '@/pages/hrm/HrmKioskPage';
import { HrmMobileEnrollPage } from '@/pages/hrm/HrmMobileEnrollPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export const App: React.FC = () => {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange={false}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <HrmAuthProvider>
            <ErrorBoundary>
              <BrowserRouter>
              <Routes>
                {/* Root directs to Login if not logged in, or Dashboard if logged in */}
                <Route path="/" element={<Navigate to="/dashboard" replace />} />

                {/* Login Page (No signup option) */}
                <Route path="/login" element={<HrmLogin />} />

                {/* Authenticated Routes with Adaptive HRM Layout */}
                <Route
                  path="/dashboard"
                  element={
                    <HrmProtectedRoute>
                      <HrmDashboard />
                    </HrmProtectedRoute>
                  }
                />

                <Route
                  path="/presensi"
                  element={
                    <HrmProtectedRoute>
                      <HrmEmployeeDashboard />
                    </HrmProtectedRoute>
                  }
                />

                {/* Shared Division Kiosk Mode (for employees without smartphones) */}
                <Route
                  path="/kios"
                  element={<HrmKioskPage />}
                />

                {/* Mobile Smartphone QR Handoff Face Enrollment Route */}
                <Route
                  path="/enroll-face"
                  element={<HrmMobileEnrollPage />}
                />

                <Route
                  path="/pengajuan"
                  element={
                    <HrmProtectedRoute>
                      <HrmLeavePage />
                    </HrmProtectedRoute>
                  }
                />

                <Route
                  path="/riwayat"
                  element={
                    <HrmProtectedRoute>
                      <HrmAttendanceHistoryPage />
                    </HrmProtectedRoute>
                  }
                />

                {/* Admin / HRD / Pimpinan / Keuangan Management Routes */}
                <Route
                  path="/admin/approval"
                  element={
                    <HrmProtectedRoute allowedRoles={['superadmin', 'admin', 'hrd', 'pimpinan', 'pengawas']}>
                      <HrmApprovalPage />
                    </HrmProtectedRoute>
                  }
                />

                <Route
                  path="/admin/monitoring"
                  element={
                    <HrmProtectedRoute allowedRoles={['superadmin', 'admin', 'hrd', 'pimpinan', 'pengawas']}>
                      <HrmLiveMonitoringPage />
                    </HrmProtectedRoute>
                  }
                />

                <Route
                  path="/admin/laporan"
                  element={
                    <HrmProtectedRoute allowedRoles={['superadmin', 'admin', 'hrd', 'pimpinan', 'keuangan', 'pengawas']}>
                      <HrmReportsPage />
                    </HrmProtectedRoute>
                  }
                />

                {/* Super Admin & Admin Specific Master Data */}
                <Route
                  path="/admin/karyawan"
                  element={
                    <HrmProtectedRoute allowedRoles={['superadmin', 'admin']}>
                      <HrmEmployeesPage />
                    </HrmProtectedRoute>
                  }
                />

                <Route
                  path="/admin/divisi"
                  element={
                    <HrmProtectedRoute allowedRoles={['superadmin']}>
                      <HrmDivisionsPage />
                    </HrmProtectedRoute>
                  }
                />

                <Route
                  path="/admin/roles"
                  element={
                    <HrmProtectedRoute allowedRoles={['superadmin']}>
                      <HrmRolesPage />
                    </HrmProtectedRoute>
                  }
                />

                <Route
                  path="/admin/pengaturan"
                  element={
                    <HrmProtectedRoute allowedRoles={['superadmin']}>
                      <HrmSettingsPage />
                    </HrmProtectedRoute>
                  }
                />

                <Route
                  path="/admin/payroll"
                  element={
                    <HrmProtectedRoute allowedRoles={['superadmin', 'admin', 'keuangan', 'pimpinan']}>
                      <HrmPayrollPage />
                    </HrmProtectedRoute>
                  }
                />

                {/* Fallback redirect */}
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </BrowserRouter>
          </ErrorBoundary>
        </HrmAuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
};

export default App;
