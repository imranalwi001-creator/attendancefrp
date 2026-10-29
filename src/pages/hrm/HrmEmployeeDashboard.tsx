import React from 'react';
import { Navigate } from 'react-router-dom';
import { useHrmAuth } from '@/contexts/HrmAuthContext';
import { HrmPwaAttendanceView } from '@/components/hrm/HrmPwaAttendanceView';

interface HrmEmployeeDashboardProps {
  onSwitchToDesktop?: () => void;
}

/**
 * HrmEmployeeDashboard:
 * Menyajikan antarmuka presensi mandiri resmi bagi staf & karyawan operasional.
 * Pimpinan dan Direktur Utama dibebaskan sepenuhnya dari kewajiban absensi mandiri,
 * sehingga diarahkan langsung ke Dashboard Eksekutif.
 */
export const HrmEmployeeDashboard: React.FC<HrmEmployeeDashboardProps> = ({ onSwitchToDesktop }) => {
  const { role } = useHrmAuth();
  const cleanRole = (role || '').toLowerCase().replace(/[\s_-]/g, '');

  if (['pimpinan', 'dirut'].some((r) => cleanRole.includes(r))) {
    return <Navigate to="/dashboard" replace />;
  }

  return <HrmPwaAttendanceView onSwitchToDesktop={onSwitchToDesktop} />;
};

export default HrmEmployeeDashboard;
