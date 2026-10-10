import React, { useState, useEffect } from 'react';
import { useHrmAuth } from '@/contexts/HrmAuthContext';
import { HrmEmployeeDashboard } from './HrmEmployeeDashboard';
import { HrmSuperadminDashboard } from './HrmSuperadminDashboard';
import { HrmHrdDashboard } from './HrmHrdDashboard';
import { HrmPimpinanDashboard } from './HrmPimpinanDashboard';
import { HrmKeuanganDashboard } from './HrmKeuanganDashboard';

export const HrmDashboard: React.FC = () => {
  const { role } = useHrmAuth();
  const cleanRole = (role || '').toLowerCase().replace(/[\s_-]/g, '');

  const checkIsMobileOrPwa = () => {
    if (typeof window === 'undefined') return false;
    const isMobileDevice = Boolean(
      window.innerWidth <= 768 ||
      /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent)
    );
    const isPwa = Boolean(
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://') ||
      localStorage.getItem('hrm_pwa_mode') === 'true'
    );
    return isMobileDevice || isPwa;
  };

  const [isMobile, setIsMobile] = useState<boolean>(checkIsMobileOrPwa);
  const [preferDesktop, setPreferDesktop] = useState<boolean>(() => {
    return sessionStorage.getItem('hrm_prefer_desktop_dashboard') === 'true';
  });

  useEffect(() => {
    const handleResize = () => setIsMobile(checkIsMobileOrPwa());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSwitchToDesktop = () => {
    sessionStorage.setItem('hrm_prefer_desktop_dashboard', 'true');
    setPreferDesktop(true);
  };

  const handleSwitchToPwa = () => {
    sessionStorage.removeItem('hrm_prefer_desktop_dashboard');
    setPreferDesktop(false);
  };

  // 1. Pada perangkat Mobile Smartphone / PWA Mode:
  // Semua karyawan (termasuk staf Keuangan, Admin, HRD, dll.) yang membuka aplikasi di HP
  // WAJIB mendapatkan antarmuka PWA Presensi resmi (HrmEmployeeDashboard / HrmPwaAttendanceView),
  // kecuali Superadmin yang mengelola radar / pimpinan, atau jika user secara eksplisit memilih mode desktop.
  if (isMobile && !preferDesktop && !['superadmin'].includes(cleanRole)) {
    return <HrmEmployeeDashboard onSwitchToDesktop={handleSwitchToDesktop} />;
  }

  // 2. Pada Desktop Browser PC/Laptop (atau jika memilih mode desktop):
  if (cleanRole === 'superadmin' || cleanRole.includes('superadmin')) {
    return <HrmSuperadminDashboard />;
  }
  if (['admin', 'hrd'].includes(cleanRole) || cleanRole.includes('admin') || cleanRole.includes('hrd')) {
    return <HrmHrdDashboard onSwitchToPwa={isMobile ? handleSwitchToPwa : undefined} />;
  }
  if (cleanRole === 'pimpinan' || cleanRole.includes('pimpinan') || cleanRole === 'dirut' || cleanRole.includes('dirut')) {
    return <HrmPimpinanDashboard />;
  }
  if (cleanRole === 'keuangan') {
    return <HrmKeuanganDashboard onSwitchToPwa={isMobile ? handleSwitchToPwa : undefined} />;
  }

  return <HrmEmployeeDashboard onSwitchToDesktop={handleSwitchToDesktop} />;
};
