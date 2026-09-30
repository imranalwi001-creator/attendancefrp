import React from 'react';
import { useHrmAuth } from '@/contexts/HrmAuthContext';
import { HrmEmployeeDashboard } from './HrmEmployeeDashboard';
import { HrmSuperadminDashboard } from './HrmSuperadminDashboard';
import { HrmHrdDashboard } from './HrmHrdDashboard';
import { HrmPimpinanDashboard } from './HrmPimpinanDashboard';
import { HrmKeuanganDashboard } from './HrmKeuanganDashboard';

export const HrmDashboard: React.FC = () => {
  const { role } = useHrmAuth();
  const cleanRole = (role || '').toLowerCase().replace(/[\s_-]/g, '');

  if (cleanRole === 'superadmin' || cleanRole.includes('superadmin')) {
    return <HrmSuperadminDashboard />;
  }
  if (['admin', 'hrd'].includes(cleanRole) || cleanRole.includes('admin') || cleanRole.includes('hrd')) {
    return <HrmHrdDashboard />;
  }
  if (cleanRole === 'pimpinan') {
    return <HrmPimpinanDashboard />;
  }
  if (cleanRole === 'keuangan') {
    return <HrmKeuanganDashboard />;
  }
  return <HrmEmployeeDashboard />;
};
