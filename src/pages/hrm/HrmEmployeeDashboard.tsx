import React from 'react';
import { HrmPwaAttendanceView } from '@/components/hrm/HrmPwaAttendanceView';

interface HrmEmployeeDashboardProps {
  onSwitchToDesktop?: () => void;
}

/**
 * HrmEmployeeDashboard:
 * Menyajikan 100% antarmuka PWA resmi yang responsif & modern untuk semua perangkat
 * (baik browser desktop PC, laptop, browser mobile, maupun aplikasi terinstall PWA).
 */
export const HrmEmployeeDashboard: React.FC<HrmEmployeeDashboardProps> = ({ onSwitchToDesktop }) => {
  return <HrmPwaAttendanceView onSwitchToDesktop={onSwitchToDesktop} />;
};

export default HrmEmployeeDashboard;
