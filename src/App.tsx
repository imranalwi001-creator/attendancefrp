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
import { HrmPwaSplashScreen } from '@/components/pwa/HrmPwaSplashScreen';

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
import { HrmSuperadminDashboard } from '@/pages/hrm/HrmSuperadminDashboard';
import { HrmPresensiPage } from '@/pages/hrm/HrmPresensiPage';
import { HrmLemburPage } from '@/pages/hrm/HrmLemburPage';
import { HrmShiftPage } from '@/pages/hrm/HrmShiftPage';
import { HrmCutiPage } from '@/pages/hrm/HrmCutiPage';
import { HrmKinerjaPage } from '@/pages/hrm/HrmKinerjaPage';
import { HrmPelanggaranPage } from '@/pages/hrm/HrmPelanggaranPage';
import { HrmAnalyticsPage } from '@/pages/hrm/HrmAnalyticsPage';

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
              {/* PWA Initial Launch Splash Screen (Lampiran 4) */}
              <HrmPwaSplashScreen />
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

                {/* Admin / HRD / Pimpinan / Dirut / Keuangan / Pengawas / Korlap / K3 Management Routes */}
                <Route
                  path="/admin/approval"
                  element={
                    <HrmProtectedRoute allowedRoles={['superadmin', 'admin', 'hrd', 'pimpinan', 'dirut', 'pengawas', 'korlap', 'k3', 'kepala_regu']}>
                      <HrmApprovalPage />
                    </HrmProtectedRoute>
                  }
                />

                <Route
                  path="/admin/monitoring"
                  element={
                    <HrmProtectedRoute allowedRoles={['superadmin', 'admin', 'hrd', 'pimpinan', 'dirut', 'pengawas', 'korlap', 'k3', 'kepala_regu']}>
                      <HrmLiveMonitoringPage />
                    </HrmProtectedRoute>
                  }
                />

                <Route
                  path="/admin/laporan"
                  element={
                    <HrmProtectedRoute allowedRoles={['superadmin', 'admin', 'hrd', 'pimpinan', 'dirut', 'keuangan', 'pengawas', 'korlap', 'k3', 'kepala_regu']}>
                      <HrmReportsPage />
                    </HrmProtectedRoute>
                  }
                />

                {/* Super Admin & Admin Specific Master Data */}
                <Route
                  path="/admin/karyawan"
                  element={
                    <HrmProtectedRoute allowedRoles={['superadmin', 'admin', 'hrd', 'korlap']}>
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
                    <HrmProtectedRoute allowedRoles={['superadmin', 'admin', 'keuangan', 'pimpinan', 'dirut']}>
                      <HrmPayrollPage />
                    </HrmProtectedRoute>
                  }
                />

                {/* Modul Superadmin Baru: Presensi, Lembur, Shift, Cuti, Kinerja, Pelanggaran & Analytics */}
                <Route
                  path="/admin/presensi"
                  element={
                    <HrmProtectedRoute allowedRoles={['superadmin', 'admin', 'hrd']}>
                      <HrmPresensiPage />
                    </HrmProtectedRoute>
                  }
                />
                <Route
                  path="/admin/lembur"
                  element={
                    <HrmProtectedRoute allowedRoles={['superadmin', 'admin', 'hrd', 'keuangan', 'pimpinan']}>
                      <HrmLemburPage />
                    </HrmProtectedRoute>
                  }
                />
                <Route
                  path="/admin/shift"
                  element={
                    <HrmProtectedRoute allowedRoles={['superadmin', 'admin', 'hrd', 'korlap']}>
                      <HrmShiftPage />
                    </HrmProtectedRoute>
                  }
                />
                <Route
                  path="/admin/cuti"
                  element={
                    <HrmProtectedRoute allowedRoles={['superadmin', 'admin', 'hrd', 'pimpinan']}>
                      <HrmCutiPage />
                    </HrmProtectedRoute>
                  }
                />
                <Route
                  path="/admin/izin-cuti"
                  element={
                    <HrmProtectedRoute allowedRoles={['superadmin', 'admin', 'hrd', 'pimpinan']}>
                      <HrmCutiPage />
                    </HrmProtectedRoute>
                  }
                />
                <Route
                  path="/admin/kinerja"
                  element={
                    <HrmProtectedRoute allowedRoles={['superadmin', 'admin', 'hrd', 'pimpinan', 'dirut']}>
                      <HrmKinerjaPage />
                    </HrmProtectedRoute>
                  }
                />
                <Route
                  path="/admin/pelanggaran"
                  element={
                    <HrmProtectedRoute allowedRoles={['superadmin', 'admin', 'hrd', 'pimpinan']}>
                      <HrmPelanggaranPage />
                    </HrmProtectedRoute>
                  }
                />
                <Route
                  path="/admin/analytics"
                  element={
                    <HrmProtectedRoute allowedRoles={['superadmin', 'admin', 'hrd', 'pimpinan', 'dirut', 'keuangan']}>
                      <HrmAnalyticsPage />
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
