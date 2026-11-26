import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHrmAuth } from '@/contexts/HrmAuthContext';
import { toast } from 'sonner';
import { hrmService, getTodayDateStr } from '@/services/hrmService';
import { api } from '@/services/apiClient';
import { AttendanceRecord, Division, EmployeeCategoryGroup, UserProfile, OvertimeRecord, PerimeterViolation, getEmployeeCategoryGroup, getEmployeeCategoryLabel, isMobileOnlineOfficer, isOfficialFrEmployee, isLeadershipSpecialFieldOfficer, isSimulationAccount, LeaveRequest, EmployeeSchedule, isMacciniBajiOfficer } from '@/types/hrm';
import { resolveEffectiveShift, calculateAttendanceLateness } from '@/lib/hrmShiftResolver';
import {
  aggregateFrpGroupPayroll,
  calculateFrpEmployeeRealtimePay,
  countWeekdaysInMonth,
  formatYearMonthId,
  getNextYearMonth,
  getPreviousYearMonth,
} from '@/lib/frpPayrollCalculations';
import {
  UserCheck,
  Clock,
  Search,
  RotateCw,
  RotateCcw,
  QrCode,
  ShieldCheck,
  AlertTriangle,
  Smartphone,
  Wifi,
  Eye,
  CheckCircle2,
  X,
  MapPin,
  ShieldAlert,
  Flame,
  Activity,
  HeartPulse,
  CalendarCheck,
  FileCheck2,
  TrendingUp,
  UserX,
  LayoutGrid,
  TableProperties,
  Lock,
  Unlock,
  Crosshair,
  Compass,
  Navigation,
  Radio,
  FileImage,
  ExternalLink,
  Calendar as CalendarIcon,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  Download,
  Printer,
  Coins,
  SlidersHorizontal,
  Filter,
  Users,
  Ship,
  Home,
  Sparkles,
  Sunrise,
  Sun,
  Moon,
  Briefcase,
  Coffee,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import QRCode from 'qrcode';
import {
  anomalyDetectionService,
  AnomalyRadarSummary,
  AnomalyRiskItem,
} from '@/services/anomalyDetectionService';
import { fieldSentinelService } from '@/services/fieldSentinelService';
import { FieldPatrolCheck } from '@/types/hrm';
import { HrmAssignFieldLocationModal } from '@/components/hrm/HrmAssignFieldLocationModal';
import { HrmPatrolWatermarkPreviewModal } from '@/components/hrm/HrmPatrolWatermarkPreviewModal';
import { HrmEmployeeMonthlyCalendarModal } from '@/components/hrm/HrmEmployeeMonthlyCalendarModal';
import { HrmEmployeeRealtimeReportModal } from '@/components/hrm/HrmEmployeeRealtimeReportModal';
import { HrmMonthlyFinancialRecapModal } from '@/components/hrm/HrmMonthlyFinancialRecapModal';
import { HrmEmployeeQuickProfileModal } from '@/components/hrm/HrmEmployeeQuickProfileModal';
import { HrmTimeSheetPdfModal } from '@/components/hrm/HrmTimeSheetPdfModal';
import { HrmSplMultiplierMatrixModal } from '@/components/hrm/HrmSplMultiplierMatrixModal';
import { HrmAnnualLeaveMatrixModal } from '@/components/hrm/HrmAnnualLeaveMatrixModal';

export const HrmLiveMonitoringPage: React.FC = () => {
  const { user } = useHrmAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [overtimes, setOvertimes] = useState<OvertimeRecord[]>([]);
  const [perimeterViolations, setPerimeterViolations] = useState<PerimeterViolation[]>([]);
  const [approvedLeaves, setApprovedLeaves] = useState<LeaveRequest[]>([]);
  const [todaySchedules, setTodaySchedules] = useState<EmployeeSchedule[]>([]);
  const [dailySchedules, setDailySchedules] = useState<EmployeeSchedule[]>([]);

  const [activeTab, setActiveTab] = useState<'all' | 'present' | 'late' | 'absent' | 'mangkir' | 'anomalies' | 'breaches' | 'field_radar'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDivision, setFilterDivision] = useState('all');
  const [filterCategory, setFilterCategory] = useState<'all' | EmployeeCategoryGroup>('all');
  const [filterShift, setFilterShift] = useState<string>('all');
  const [filterStatusCol, setFilterStatusCol] = useState<string>('all');
  const [filterOvertimeCol, setFilterOvertimeCol] = useState<string>('all');
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const defaults = {
      category: true,
      division: true,
      shift: true,
      status: true,
      clockIn: true,
      clockOut: true,
      overtime: true,
      security: true,
      actions: true,
    };
    try {
      const saved = localStorage.getItem('hrm_monitoring_visible_columns');
      if (saved) return { ...defaults, ...JSON.parse(saved) };
    } catch {}
    return defaults;
  });

  const updateVisibleColumns = (updater: (prev: typeof visibleColumns) => typeof visibleColumns) => {
    setVisibleColumns((prev: any) => {
      const next = updater(prev);
      try {
        localStorage.setItem('hrm_monitoring_visible_columns', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  // Field Sentinel & Dynamic Geofence Radar State
  const [fieldAgents, setFieldAgents] = useState<any[]>([]);
  const [assignLocationUser, setAssignLocationUser] = useState<UserProfile | null>(null);
  const [assignLocationModalOpen, setAssignLocationModalOpen] = useState(false);
  const [assignLocationTab, setAssignLocationTab] = useState<'schedule' | 'posts'>('schedule');
  const [previewWatermarkData, setPreviewWatermarkData] = useState<FieldPatrolCheck | null>(null);
  const [previewWatermarkModalOpen, setPreviewWatermarkModalOpen] = useState(false);
  const [requestingAgentId, setRequestingAgentId] = useState<string | null>(null);

  // Perimeter breach unlock authorization modal
  const [unlockModalOpen, setUnlockModalOpen] = useState(false);
  const [selectedBreach, setSelectedBreach] = useState<PerimeterViolation | null>(null);
  const [unlockReason, setUnlockReason] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);

  // Anti-fraud QR Kiosk modal
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrData, setQrData] = useState(hrmService.getDynamicOfficeQrCode());
  const [qrImageUrl, setQrImageUrl] = useState<string>('');
  const [previewForensic, setPreviewForensic] = useState<{
    url: string;
    name: string;
    nip?: string;
    division?: string;
    time?: string;
    biometricScore?: number;
    biometricMatch?: boolean;
    geofenceDistance?: number;
    geofenceValid?: boolean;
    isMockLocation?: boolean;
    lat?: number;
    lng?: number;
    securityFlags?: string[];
  } | null>(null);

  const [allAttendances, setAllAttendances] = useState<AttendanceRecord[]>([]);
  const [periodScope, setPeriodScope] = useState<'today' | 'month' | 'year'>('today');

  // ─── OPERASIONAL PELABUHAN MACCINI BAJI (STATUS KAPAL BERSANDAR & STANDBY ON-CALL) ───
  const [macciniVesselStatus, setMacciniVesselStatus] = useState<{
    status: 'idle' | 'docking';
    vesselName: string;
    updatedAt: string | null;
    updatedBy: string;
    notes: string;
  }>({ status: 'idle', vesselName: '', updatedAt: null, updatedBy: '', notes: '' });

  const handleAdminToggleMacciniStatus = async (target: 'docking' | 'idle') => {
    try {
      await hrmService.updateMacciniVesselStatus({
        status: target,
        vesselName: target === 'docking' ? (macciniVesselStatus.vesselName || 'Kapal Masuk') : '',
        updatedBy: user?.fullName || 'Superadmin Monitoring',
        notes: target === 'docking' ? 'Standby Operasional Kapal' : 'Standby On-Call',
      });
      setMacciniVesselStatus({
        status: target,
        vesselName: target === 'docking' ? (macciniVesselStatus.vesselName || 'Kapal Masuk') : '',
        updatedAt: new Date().toISOString(),
        updatedBy: user?.fullName || 'Superadmin Monitoring',
        notes: target === 'docking' ? 'Standby Operasional Kapal' : 'Standby On-Call',
      });
      toast.success(
        target === 'docking'
          ? '⚓ Status diperbarui: KAPAL BERSANDAR (Dermaga Maccini Baji terkunci 500m)'
          : '🌊 Status diperbarui: STANDBY ON-CALL (Petugas bebas keluar koordinat)'
      );
    } catch (e: any) {
      toast.error('Gagal update status kapal: ' + (e?.message || 'Error'));
    }
  };

  // Navigasi Bulan & Kalender Presensi Per Karyawan
  const currentMonthStr = getTodayDateStr().slice(0, 7);
  const pastMonthStr = React.useMemo(() => getPreviousYearMonth(currentMonthStr), [currentMonthStr]);
  const futureMonthStr = React.useMemo(() => getNextYearMonth(currentMonthStr), [currentMonthStr]);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [lampiran2ViewMode, setLampiran2ViewMode] = useState<'monthly' | 'daily'>('daily');
  const [showBudgetDetail, setShowBudgetDetail] = useState<boolean>(false);

  const currentMonthLabel = React.useMemo(() => {
    const [y, m] = currentMonthStr.split('-').map(Number);
    const d = new Date(y, m - 1, 1);
    return d.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
  }, [currentMonthStr]);

  const pastMonthLabel = React.useMemo(() => {
    const [y, m] = pastMonthStr.split('-').map(Number);
    const d = new Date(y, m - 1, 1);
    return d.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
  }, [pastMonthStr]);

  const [selectedDayDate, setSelectedDayDate] = useState<string>(''); // YYYY-MM-DD atau '' (semua tanggal di bulan)
  const targetDayDate = selectedDayDate || getTodayDateStr();
  const [calendarModalOpen, setCalendarModalOpen] = useState<boolean>(false);
  const [selectedCalendarUser, setSelectedCalendarUser] = useState<UserProfile | null>(null);
  const [isFetchingMonth, setIsFetchingMonth] = useState<boolean>(false);
  const [realtimeReportModalOpen, setRealtimeReportModalOpen] = useState<boolean>(false);
  const [selectedReportUser, setSelectedReportUser] = useState<UserProfile | null>(null);
  const [selectedReportAttendance, setSelectedReportAttendance] = useState<AttendanceRecord | null>(null);
  const [selectedReportShift, setSelectedReportShift] = useState<any>(null);
  const navigate = useNavigate();
  const [financialRecapModalOpen, setFinancialRecapModalOpen] = useState<boolean>(false);
  const [timeSheetModalOpen, setTimeSheetModalOpen] = useState<boolean>(false);
  const [splMatrixModalOpen, setSplMatrixModalOpen] = useState<boolean>(false);
  const [leaveMatrixModalOpen, setLeaveMatrixModalOpen] = useState<boolean>(false);
  const [payrollScopeGroup, setPayrollScopeGroup] = useState<'ALL' | 'SHIPMENT' | 'RUMAH TANGGA' | 'KARYAWAN TETAP'>('ALL');
  const [nextPayrollArrears, setNextPayrollArrears] = useState<any>(null);
  const [quickProfileModalOpen, setQuickProfileModalOpen] = useState<boolean>(false);
  const [selectedQuickProfile, setSelectedQuickProfile] = useState<{
    user: UserProfile;
    attendance?: AttendanceRecord | null;
    shift?: any;
    status?: string;
    absentSubtype?: string;
    monthlyOvertimeHours?: number;
    monthlyOvertimeCount?: number;
    todayOvertimeHours?: number;
    todayOvertimePay?: number;
    monthlyOvertimePay?: number;
    totalLateMinutes?: number;
    lateCount?: number;
    anomaly?: any;
  } | null>(null);

  const handleOpenQuickProfile = (payload: {
    user: UserProfile;
    attendance?: AttendanceRecord | null;
    shift?: any;
    status?: string;
    absentSubtype?: string;
    monthlyOvertimeHours?: number;
    monthlyOvertimeCount?: number;
    todayOvertimeHours?: number;
    todayOvertimePay?: number;
    monthlyOvertimePay?: number;
    totalLateMinutes?: number;
    lateCount?: number;
    anomaly?: any;
  }) => {
    setSelectedQuickProfile(payload);
    setQuickProfileModalOpen(true);
  };

  const handleOpenRealtimeReport = (u: UserProfile, att?: AttendanceRecord | null, sft?: any) => {
    setSelectedReportUser(u);
    setSelectedReportAttendance(att || null);
    setSelectedReportShift(sft || null);
    setRealtimeReportModalOpen(true);
  };

  const resolveMonitoringStatusLabel = (status: string, absentSubtype: any, att: AttendanceRecord | null) => {
    const isLate = status === 'late' || status === 'terlambat' || (att?.lateMinutes && att.lateMinutes > 0);
    if (isLate) return `TERLAMBAT (${att?.lateMinutes || 0}m)`;
    if (att?.clockIn) return 'HADIR';
    if (status === 'mangkir' || status === 'alfa' || absentSubtype === 'mangkir') return 'ALPA / MANGKIR';
    if (absentSubtype === 'off') return 'LIBUR / OFF';
    if (absentSubtype === 'unregistered') return 'BELUM REGISTRASI WAJAH';
    if (absentSubtype === 'cuti') return 'CUTI TAHUNAN';
    if (absentSubtype === 'sakit') return 'IZIN SAKIT';
    if (absentSubtype === 'izin') return 'IZIN RESMI';
    return 'BELUM HADIR';
  };

  const getCategoryFileSlug = (cat: 'all' | EmployeeCategoryGroup) => {
    if (cat === 'RUMAH TANGGA') return 'Rumah_Tangga_FR07001-FR07033';
    if (cat === 'SHIPMENT') return 'Shipment_FR07034-FR07080';
    if (cat === 'KARYAWAN TETAP') return 'Karyawan_Tetap_Takdir_Aslam_Samsi';
    return 'Semua_Karyawan';
  };

  const handleExportAllRealtimeExcel = () => {
    const exportDateStr = targetDayDate || getTodayDateStr();
    const mapRows = (items: typeof filtered) =>
      items.map(({ user: u, attendance: att, status, absentSubtype, shift }, idx) => ({
        No: idx + 1,
        NIP: u.nip,
        'Nama Karyawan': u.fullName,
        'Kelompok': getEmployeeCategoryLabel(getEmployeeCategoryGroup(u)),
        'Divisi': u.divisionName || '-',
        'Jabatan': u.roleName || u.role || 'Karyawan',
        'Shift': shift?.name || u.shiftName || 'Day Shift',
        'Status Kehadiran': resolveMonitoringStatusLabel(status, absentSubtype, att),
        'Jam Masuk': att?.clockIn ? att.clockIn.substring(0, 5) : '-',
        'Jam Pulang': att?.clockOut ? att.clockOut.substring(0, 5) : (att?.clockIn ? 'Aktif Bertugas' : '-'),
        'Durasi Kerja (Jam)': att?.workDurationMinutes ? (att.workDurationMinutes / 60).toFixed(1) : '-',
        'Terlambat (Menit)': att?.lateMinutes || 0,
        'Skor Wajah AI': att?.biometricScore ? `${att.biometricScore}%` : '-',
        'Jarak Geofence': att?.geofenceDistance != null ? `${Math.round(att.geofenceDistance)}m` : '-',
        'Lokasi Presensi': att?.notes || u.assignedLocationName || '-',
      }));

    const workbook = XLSX.utils.book_new();
    const activeSlug = getCategoryFileSlug(filterCategory);
    if (filterCategory === 'all') {
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(mapRows(filtered)), 'Semua_Karyawan');
      const rtRows = filtered.filter((i) => getEmployeeCategoryGroup(i.user) === 'RUMAH TANGGA');
      const shipRows = filtered.filter((i) => getEmployeeCategoryGroup(i.user) === 'SHIPMENT');
      const tetapRows = filtered.filter((i) => getEmployeeCategoryGroup(i.user) === 'KARYAWAN TETAP');
      if (rtRows.length > 0) XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(mapRows(rtRows)), 'Rumah_Tangga_FR07001-33');
      if (shipRows.length > 0) XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(mapRows(shipRows)), 'Shipment_FR07034-80');
      if (tetapRows.length > 0) XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(mapRows(tetapRows)), 'Karyawan_Tetap_3');
    } else {
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(mapRows(filtered)), activeSlug.slice(0, 31));
    }

    XLSX.writeFile(workbook, `Monitoring_Realtime_${activeSlug}_${exportDateStr}.xlsx`);
    toast.success(`Rekap realtime ${filtered.length} karyawan (${exportDateStr}) berhasil diunduh!`);
  };

  const handleExportAllRealtimePdf = () => {
    try {
      if (!filtered || filtered.length === 0) {
        toast.error('Tidak ada data karyawan untuk diekspor.');
        return;
      }

      const exportDateStr = targetDayDate || getTodayDateStr();
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });

      const activeCategoryTitle = filterCategory === 'all' ? 'Semua Kelompok Operasional' : getEmployeeCategoryLabel(filterCategory);

      // Header Laporan
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text('PT. FAWWAZ RESKI PERWIRA', 14, 12);
      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'normal');
      doc.text(`LAPORAN MONITORING PRESENSI & OPERASIONAL REALTIME - ${exportDateStr} (WITA)`, 14, 17);
      doc.setFontSize(7.5);
      doc.text(`Kelompok: ${activeCategoryTitle} | Total: ${filtered.length} Orang | Server: fawwazreskiperwira.com | Dicetak: ${new Date().toLocaleString('id-ID')}`, 14, 21);

      const tableHead = [
        ['No', 'NIP', 'Nama Karyawan', 'Kelompok', 'Divisi', 'Shift', 'Status Kehadiran', 'Masuk', 'Pulang', 'Telat', 'Skor Wajah', 'Jarak Pos', 'Lokasi']
      ];

      const tableBody = filtered.map(({ user: u, attendance: att, status, absentSubtype, shift }, idx) => {
        const catGroup = getEmployeeCategoryGroup(u);
        const shortCat = catGroup === 'RUMAH TANGGA'
          ? 'Rumah Tangga'
          : catGroup === 'SHIPMENT'
          ? 'Shipment'
          : catGroup === 'KARYAWAN TETAP'
          ? 'Karyawan Tetap'
          : 'Lainnya';

        return [
          idx + 1,
          u?.nip || '-',
          u?.fullName || '-',
          shortCat,
          u?.divisionName || '-',
          shift?.name || u?.shiftName || 'Day Shift',
          resolveMonitoringStatusLabel(status, absentSubtype, att),
          att?.clockIn ? att.clockIn.substring(0, 5) : '-',
          att?.clockOut ? att.clockOut.substring(0, 5) : (att?.clockIn ? 'Aktif' : '-'),
          att?.lateMinutes ? `${att.lateMinutes}m` : '-',
          att?.biometricScore ? `${att.biometricScore}%` : '-',
          att?.geofenceDistance != null ? `${Math.round(att.geofenceDistance)}m` : '-',
          att?.notes || u?.assignedLocationName || '-'
        ];
      });

      const runAutoTable = (typeof autoTable === 'function' ? autoTable : (autoTable as any)?.default) || (doc as any).autoTable;
      runAutoTable(doc, {
        startY: 24,
        head: tableHead,
        body: tableBody,
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 1.5, halign: 'center' },
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
        columnStyles: {
          2: { halign: 'left', fontStyle: 'bold' }, // Nama Karyawan
          3: { halign: 'left' }, // Kelompok
          4: { halign: 'left' }, // Divisi
          12: { halign: 'left' } // Lokasi
        },
        didDrawPage: (data: any) => {
          const totalPages = doc.getNumberOfPages ? doc.getNumberOfPages() : (doc.internal as any)?.getNumberOfPages?.() || 1;
          doc.setFontSize(7);
          doc.text(`Halaman ${data.pageNumber} dari ${totalPages}`, doc.internal.pageSize.getWidth() - 30, doc.internal.pageSize.getHeight() - 5);
        }
      });

      const filename = `Monitoring_Realtime_${getCategoryFileSlug(filterCategory)}_${exportDateStr}.pdf`;
      doc.save(filename);
      toast.success(`Laporan PDF monitoring ${filtered.length} karyawan berhasil diunduh: ${filename}`);
    } catch (err: any) {
      console.error('Export PDF error:', err);
      toast.error('Gagal mengekspor PDF: ' + (err?.message || 'Terjadi kesalahan sistem'));
    }
  };

  const loadFieldAgents = async () => {
    try {
      const agents = await fieldSentinelService.getActiveAgents();
      if (Array.isArray(agents)) {
        setFieldAgents(agents);
      }
    } catch (e) {
      console.warn('Field Sentinel fetch warning:', e);
    }
  };

  const fetchLiveUsersFast = async () => {
    try {
      const res = await api.get<{ success: boolean; data: UserProfile[] }>('/users');
      if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
        const activeUsers = res.data.filter((u) => u.isActive && isOfficialFrEmployee(u));
        setUsers(activeUsers);
        hrmService.setInMemoryUsers(res.data);
      }
    } catch (e) {
      console.warn('[LiveMonitoring] Users fetch note:', e);
    }
  };

  const syncFromLocalCache = () => {
    const today = getTodayDateStr();
    setUsers(hrmService.getUsers().filter((u) => u.isActive && isOfficialFrEmployee(u)));
    setDivisions(hrmService.getDivisions());
    setAllAttendances(hrmService.getAttendances().filter((a) => isOfficialFrEmployee(a.userNip)));
    setAttendances(hrmService.getAttendances(today).filter((a) => isOfficialFrEmployee(a.userNip)));
    setOvertimes(hrmService.getOvertimeRecords().filter((o) => isOfficialFrEmployee(o.userNip)));
    setApprovedLeaves(hrmService.getLeaves().filter((l) => l.status === 'approved'));
    setPerimeterViolations(hrmService.getPerimeterViolations().filter((v) => isOfficialFrEmployee(v.userNip)));
  };

  const loadData = () => {
    const today = getTodayDateStr();
    syncFromLocalCache();
    fetch('/api/overtime')
      .then((r) => r.json())
      .then((res) => {
        if (res.success && Array.isArray(res.data)) {
          const mapped = res.data.map((o: any) => ({
            ...o,
            userId: o.userId || o.user_id,
            userNip: o.userNip || o.user_nip,
            userName: o.userName || o.user_name,
            divisionName: o.divisionName || o.division_name,
            date: String(o.date || o.overtimeDate || o.overtime_date || '').slice(0, 10),
            startTime: o.startTime || o.start_time,
            endTime: o.endTime || o.end_time,
            durationHours: Number(o.durationHours || o.duration_hours || 0),
            approvedHours: Number(o.approvedHours || o.approved_hours || o.durationHours || o.duration_hours || 0),
            compensationAmount: Number(o.compensationAmount || o.compensation_amount || o.totalPay || o.total_pay || 0),
            totalPay: Number(o.compensationAmount || o.compensation_amount || o.totalPay || o.total_pay || 0),
            taskDescription: o.taskDescription || o.task_description || '',
            status: o.status || 'pending',
            supervisorName: o.supervisorName || o.supervisor_name || o.approvedByName || o.approved_by_name || o.approver_name || '',
          }));
          setOvertimes(mapped);
        }
      })
      .catch(() => {});
    loadFieldAgents();
    hrmService.getMacciniVesselStatus().then((s) => {
      if (s) setMacciniVesselStatus(s);
    }).catch(() => null);
    fetch('/api/leaves?status=approved')
      .then((r) => r.json())
      .then((res) => {
        if (res.success && Array.isArray(res.data)) {
          setApprovedLeaves(res.data);
        }
      })
      .catch(() => {});
    fetch(`/api/employee-schedules?date=${today}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success && Array.isArray(res.data)) {
          setTodaySchedules(res.data);
          hrmService.saveEmployeeSchedules(res.data);
        }
      })
      .catch(() => {});
  };

  const fetchLiveAttendancesFast = async () => {
    try {
      const today = getTodayDateStr();
      const currentMonth = today.slice(0, 7);
      const [resToday, resMonth] = await Promise.all([
        fetch(`/api/attendances?date=${today}&_t=${Date.now()}`),
        fetch(`/api/attendances?month=${currentMonth}&_t=${Date.now()}`),
      ]);
      if (resToday.ok) {
        const json = await resToday.json();
        if (json.success && Array.isArray(json.data)) {
          const freshTodayAtts: AttendanceRecord[] = json.data.filter((a) => isOfficialFrEmployee(a));
          setAttendances(freshTodayAtts);
        }
      }
      if (resMonth.ok) {
        const jsonM = await resMonth.json();
        if (jsonM.success && Array.isArray(jsonM.data)) {
          const freshMonthAtts: AttendanceRecord[] = jsonM.data.filter((a) => isOfficialFrEmployee(a));
          setAllAttendances(freshMonthAtts);
          hrmService.saveAttendances(freshMonthAtts);
        }
      }
    } catch (e) {
      console.warn('[LiveMonitoring] Fast fetch note:', e);
    }
  };

  useEffect(() => {
    // 1. Render instan dari local cache lalu sinkron satu kali terarah (tanpa request storm)
    loadData();
    fetchLiveUsersFast();
    fetchLiveAttendancesFast();
    hrmService.syncWithBackend().then(() => {
      syncFromLocalCache();
    });

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const handleUpdated = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        fetchLiveAttendancesFast();
        syncFromLocalCache();
      }, 300);
    };
    const handlePing = () => loadFieldAgents();
    window.addEventListener('hrm_data_updated', handleUpdated);
    window.addEventListener('hrm_overtime_updated', handleUpdated);
    window.addEventListener('hrm_attendance_updated', handleUpdated);
    window.addEventListener('hrm_users_updated', handleUpdated);
    window.addEventListener('hrm_field_ping_received', handlePing);
    window.addEventListener('hrm_patrol_check_submitted', handlePing);

    // Polling ringan setiap 10 detik (hanya saat tab aktif) agar responsif tanpa membanjiri jaringan
    let pollCycle = 0;
    const fastInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      fetchLiveAttendancesFast();
      pollCycle++;
      if (pollCycle % 2 === 0) {
        loadFieldAgents();
      }
      if (pollCycle % 6 === 0) {
        fetchLiveUsersFast();
      }
    }, 10000);

    // Master background sync setiap 60 detik saat tab aktif
    const masterInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      hrmService.syncWithBackend().then(() => {
        syncFromLocalCache();
      });
    }, 60000);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      window.removeEventListener('hrm_data_updated', handleUpdated);
      window.removeEventListener('hrm_overtime_updated', handleUpdated);
      window.removeEventListener('hrm_attendance_updated', handleUpdated);
      window.removeEventListener('hrm_users_updated', handleUpdated);
      window.removeEventListener('hrm_field_ping_received', handlePing);
      window.removeEventListener('hrm_patrol_check_submitted', handlePing);
      clearInterval(fastInterval);
      clearInterval(masterInterval);
    };
  }, []);

  // Sinkronisasi real-time Progres Lembur Bulan Berjalan (curMonth -> dibayar di nextPayrollMonth) dengan kalkulasi resmi 2x PT FRP
  React.useEffect(() => {
    const activeYm = selectedMonth || currentMonthStr;
    const nextYm = getNextYearMonth(activeYm);
    let cancelled = false;
    api
      .get<any>(`/overtime/payroll-arrears-recap?payrollMonth=${encodeURIComponent(nextYm)}`)
      .then((res) => {
        if (!cancelled && res?.success && res.data) {
          setNextPayrollArrears(res.data);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selectedMonth, currentMonthStr, overtimes.length]);

  // Sinkronisasi jadwal roster harian (hrm_employee_schedules), presensi, dan lembur (SPKL) sesuai tanggal aktif targetDayDate
  useEffect(() => {
    let isCancelled = false;
    const fetchDateData = async () => {
      try {
        const [schedRes, attRes, otRes] = await Promise.all([
          fetch(`/api/employee-schedules?date=${targetDayDate}`),
          fetch(`/api/attendances?date=${targetDayDate}&_t=${Date.now()}`),
          fetch(`/api/overtime?_t=${Date.now()}`),
        ]);
        if (schedRes.ok) {
          const jsonS = await schedRes.json();
          if (!isCancelled && jsonS.success && Array.isArray(jsonS.data)) {
            setDailySchedules(jsonS.data);
            hrmService.saveEmployeeSchedules(jsonS.data);
          }
        }
        if (attRes.ok) {
          const jsonA = await attRes.json();
          if (!isCancelled && jsonA.success && Array.isArray(jsonA.data)) {
            const freshAtts: AttendanceRecord[] = jsonA.data.filter((a: any) => isOfficialFrEmployee(a));
            setAttendances(freshAtts);
            setAllAttendances((prev) => {
              const withoutThisDate = prev.filter((a) => (a.attendanceDate || (a as any).date) !== targetDayDate);
              return [...withoutThisDate, ...freshAtts];
            });
          }
        }
        if (otRes.ok) {
          const jsonO = await otRes.json();
          if (!isCancelled && jsonO.success && Array.isArray(jsonO.data)) {
            const mapped = jsonO.data.map((o: any) => ({
              ...o,
              userId: o.userId || o.user_id,
              userNip: o.userNip || o.user_nip,
              userName: o.userName || o.user_name,
              divisionName: o.divisionName || o.division_name,
              date: String(o.date || o.overtimeDate || o.overtime_date || '').slice(0, 10),
              startTime: o.startTime || o.start_time,
              endTime: o.endTime || o.end_time,
              durationHours: Number(o.durationHours || o.duration_hours || 0),
              approvedHours: Number(o.approvedHours || o.approved_hours || o.durationHours || o.duration_hours || 0),
              compensationAmount: Number(o.compensationAmount || o.compensation_amount || o.totalPay || o.total_pay || 0),
              totalPay: Number(o.compensationAmount || o.compensation_amount || o.totalPay || o.total_pay || 0),
              taskDescription: o.taskDescription || o.task_description || '',
              status: o.status || 'pending',
              supervisorName: o.supervisorName || o.supervisor_name || o.approvedByName || o.approved_by_name || o.approver_name || '',
            }));
            setOvertimes(mapped);
          }
        }
      } catch (err) {
        console.warn('[LiveMonitoring] Fetch schedules/attendances for target date notice:', err);
      }
    };
    fetchDateData();
    return () => {
      isCancelled = true;
    };
  }, [targetDayDate]);

  // Update Dynamic QR every second
  useEffect(() => {
    if (!qrModalOpen) return;
    const timer = setInterval(() => {
      setQrData(hrmService.getDynamicOfficeQrCode());
    }, 1000);
    return () => clearInterval(timer);
  }, [qrModalOpen]);

  // Generate square 2D QR Code image
  useEffect(() => {
    if (!qrModalOpen || !qrData?.code) return;
    QRCode.toDataURL(qrData.code, {
      width: 320,
      margin: 1.5,
      color: {
        dark: '#020617',
        light: '#ffffff',
      },
    })
      .then((url) => setQrImageUrl(url))
      .catch((err) => console.error('Failed generating QR code:', err));
  }, [qrData?.code, qrModalOpen]);

  const currentYearStr = getTodayDateStr().slice(0, 4);
  const currentYear = new Date().getFullYear();

  // Parsing Tahun & Bulan Terpilih
  const [selectedYearNum, selectedMonthNum] = React.useMemo(() => {
    const parts = (selectedMonth || currentMonthStr).split('-').map(Number);
    return [parts[0] || new Date().getFullYear(), parts[1] || new Date().getMonth() + 1];
  }, [selectedMonth, currentMonthStr]);

  const selectedMonthLabel = React.useMemo(() => {
    const d = new Date(selectedYearNum, selectedMonthNum - 1, 1);
    return d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  }, [selectedYearNum, selectedMonthNum]);

  // Fungsi Fetch Presensi & Jadwal Bulan Terpilih dari PostgreSQL API
  const fetchMonthAttendances = React.useCallback(async (monthStr: string) => {
    try {
      setIsFetchingMonth(true);
      const [resAtt, resSched, resLeaves, resOt] = await Promise.all([
        fetch(`/api/attendances?month=${monthStr}`),
        fetch(`/api/employee-schedules?month=${monthStr}`),
        fetch(`/api/leaves?status=approved`),
        fetch(`/api/overtime?month=${monthStr}`),
      ]);

      if (resAtt.ok) {
        const json = await resAtt.json();
        if (json.success && Array.isArray(json.data)) {
          const monthAtts: AttendanceRecord[] = json.data;
          setAllAttendances((prev) => {
            const map = new Map(prev.map((a) => [a.id, a]));
            monthAtts.forEach((a) => map.set(a.id, a));
            return Array.from(map.values());
          });
        }
      }

      if (resSched.ok) {
        const jsonSched = await resSched.json();
        if (jsonSched.success && Array.isArray(jsonSched.data)) {
          setDailySchedules((prev) => {
            const map = new Map(prev.map((s) => [`${s.userId}_${s.scheduleDate}`, s]));
            jsonSched.data.forEach((s: any) => map.set(`${s.userId}_${s.scheduleDate}`, s));
            return Array.from(map.values());
          });
          hrmService.saveEmployeeSchedules(jsonSched.data);
        }
      }

      if (resLeaves.ok) {
        const jsonLeaves = await resLeaves.json();
        if (jsonLeaves.success && Array.isArray(jsonLeaves.data)) {
          setApprovedLeaves(jsonLeaves.data);
        }
      }

      if (resOt && resOt.ok) {
        const jsonOt = await resOt.json();
        if (jsonOt.success && Array.isArray(jsonOt.data)) {
          const mapped = jsonOt.data.map((o: any) => ({
            ...o,
            userId: o.userId || o.user_id,
            userNip: o.userNip || o.user_nip,
            userName: o.userName || o.user_name,
            divisionName: o.divisionName || o.division_name,
            date: String(o.date || o.overtimeDate || o.overtime_date || '').slice(0, 10),
            startTime: o.startTime || o.start_time,
            endTime: o.endTime || o.end_time,
            durationHours: Number(o.durationHours || o.duration_hours || 0),
            approvedHours: Number(o.approvedHours || o.approved_hours || o.durationHours || o.duration_hours || 0),
            compensationAmount: Number(o.compensationAmount || o.compensation_amount || o.totalPay || o.total_pay || 0),
            totalPay: Number(o.compensationAmount || o.compensation_amount || o.totalPay || o.total_pay || 0),
            taskDescription: o.taskDescription || o.task_description || '',
            status: o.status || 'pending',
            supervisorName: o.supervisorName || o.supervisor_name || o.approvedByName || o.approved_by_name || o.approver_name || '',
          }));
          setOvertimes((prev) => {
            const map = new Map(prev.map((o) => [o.id, o]));
            mapped.forEach((o: any) => map.set(o.id, o));
            return Array.from(map.values());
          });
        }
      }
    } catch (e) {
      console.warn('[LiveMonitoring] Fetch month note:', e);
    } finally {
      setIsFetchingMonth(false);
    }
  }, []);

  // Fetch data bulan setiap kali selectedMonth berubah, agar akumulasi Lampiran II selalu sinkron
  useEffect(() => {
    fetchMonthAttendances(selectedMonth);
  }, [selectedMonth, fetchMonthAttendances]);

  // ─── AKUMULASI STATISTIK BULANAN UNTUK LAMPIRAN II (BULAN BERJALAN & BULAN SEBELUMNYA) ───
  const monthStats = React.useMemo(() => {
    const targetMonth = selectedMonth || currentMonthStr; // 'YYYY-MM'

    // 1. Presensi Hadir pada targetMonth
    const monthAtts = (allAttendances || []).filter((a) => {
      const d = String(a.attendanceDate || (a as any).date || '').slice(0, 7);
      return d === targetMonth && isOfficialFrEmployee(a);
    });

    const hadirAtts = monthAtts.filter((a) => ['present', 'hadir', 'late', 'terlambat'].includes(a.status));
    const lateAtts = monthAtts.filter((a) => ['late', 'terlambat'].includes(a.status) || (a.lateMinutes && a.lateMinutes > 0));
    const tepatAtts = hadirAtts.filter((a) => !['late', 'terlambat'].includes(a.status) && (!a.lateMinutes || a.lateMinutes <= 0));

    // 2. Mangkir / Alpa pada targetMonth
    const mangkirAtts = monthAtts.filter((a) => ['alfa', 'mangkir'].includes(a.status) || (a as any).absentSubtype === 'mangkir');

    // 3. Sakit, Izin, Cuti dari Cuti Requests & Presensi
    const countLeaveDays = (typeKeyword: string): number => {
      let days = 0;
      (approvedLeaves || []).forEach((l) => {
        if (!isOfficialFrEmployee(l)) return;
        const lType = String(l.leaveType || (l as any).leave_type || '').toLowerCase();
        if (!lType.includes(typeKeyword)) return;

        const sStr = String(l.startDate || (l as any).start_date || '');
        const eStr = String(l.endDate || (l as any).end_date || sStr);
        if (!sStr) return;

        const s = new Date(sStr);
        const e = new Date(eStr);
        if (isNaN(s.getTime()) || isNaN(e.getTime())) return;

        const cur = new Date(s);
        let guard = 0;
        while (cur <= e && guard < 60) {
          const y = cur.getFullYear();
          const m = String(cur.getMonth() + 1).padStart(2, '0');
          if (`${y}-${m}` === targetMonth) {
            days++;
          }
          cur.setDate(cur.getDate() + 1);
          guard++;
        }
      });
      return days;
    };

    const attSakitCount = monthAtts.filter((a) => ['sick', 'sakit'].includes(a.status)).length;
    const leaveSakitDays = countLeaveDays('sakit') + countLeaveDays('sick');
    const totalSakit = Math.max(attSakitCount, leaveSakitDays);

    const leaveIzinDays = countLeaveDays('izin') + countLeaveDays('permission');
    const attIzinCount = monthAtts.filter((a) => ['izin', 'permission'].includes(a.status)).length;
    const totalIzin = Math.max(attIzinCount, leaveIzinDays);

    const attCutiCount = monthAtts.filter((a) => ['cuti', 'leave'].includes(a.status)).length;
    const leaveCutiDays = countLeaveDays('cuti') + countLeaveDays('annual');
    const totalCuti = Math.max(attCutiCount, leaveCutiDays);

    // 4. Lembur (SPKL) pada targetMonth
    const normNip = (n?: string) => (n || '').replace(/[\s.]/g, '').toUpperCase();
    const monthOts = (overtimes || []).filter((o) => {
      const oDate = String(o.date || (o as any).overtimeDate || (o as any).overtime_date || '').slice(0, 7);
      const isApp = o.status === 'approved' || (o as any).status === 'completed';
      return oDate === targetMonth && isApp && isOfficialFrEmployee(o);
    });

    const totalOtHours = monthOts.reduce((sum, o) => sum + Number(o.approvedHours || (o as any).approved_hours || o.durationHours || 0), 0);
    const totalOtPay = monthOts.reduce((sum, o) => sum + Number(o.compensationAmount || (o as any).compensation_amount || o.totalPay || 0), 0);
    const totalOtCount = monthOts.length;
    const uniqueOtUsers = new Set(monthOts.map((o) => o.userId || (o as any).user_id || normNip(o.userNip))).size;

    return {
      targetMonth,
      totalHadir: hadirAtts.length,
      totalTepat: tepatAtts.length,
      totalLate: lateAtts.length,
      totalSakit,
      totalIzin,
      totalCuti,
      totalMangkir: mangkirAtts.length,
      totalOtHours,
      totalOtPay,
      totalOtCount,
      uniqueOtUsers,
    };
  }, [selectedMonth, currentMonthStr, allAttendances, approvedLeaves, overtimes]);

  // Navigasi Bulan (Sebelumnya, Berikutnya, Berjalan)
  const handlePrevMonth = () => {
    let nextY = selectedYearNum;
    let nextM = selectedMonthNum - 1;
    if (nextM < 1) {
      nextM = 12;
      nextY -= 1;
    }
    const newMonthStr = `${nextY}-${String(nextM).padStart(2, '0')}`;
    setSelectedMonth(newMonthStr);
    setSelectedDayDate(''); // reset filter hari agar melihat full bulan baru
  };

  const handleNextMonth = () => {
    let nextY = selectedYearNum;
    let nextM = selectedMonthNum + 1;
    if (nextM > 12) {
      nextM = 1;
      nextY += 1;
    }
    const newMonthStr = `${nextY}-${String(nextM).padStart(2, '0')}`;
    setSelectedMonth(newMonthStr);
    setSelectedDayDate(''); // reset filter hari
  };

  // Helper aman pergeseran tanggal (+/- n hari tanpa bug offset zona waktu)
  const shiftDateByDays = (dateStr: string, deltaDays: number): string => {
    const parts = (dateStr || getTodayDateStr()).split('-');
    if (parts.length !== 3) return dateStr;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const d = new Date(year, month, day + deltaDays);
    const yStr = d.getFullYear();
    const mStr = String(d.getMonth() + 1).padStart(2, '0');
    const dStr = String(d.getDate()).padStart(2, '0');
    return `${yStr}-${mStr}-${dStr}`;
  };

  // Navigasi Tanggal Berurutan (H-1, H+1, Langsung ke Tanggal, Kembali ke Hari Ini)
  const handlePrevDay = () => {
    const cur = targetDayDate || getTodayDateStr();
    const prevDateStr = shiftDateByDays(cur, -1);
    setSelectedDayDate(prevDateStr);
    const newMonth = prevDateStr.slice(0, 7);
    if (newMonth !== selectedMonth) {
      setSelectedMonth(newMonth);
    }
  };

  const handleNextDay = () => {
    const cur = targetDayDate || getTodayDateStr();
    const nextDateStr = shiftDateByDays(cur, 1);
    setSelectedDayDate(nextDateStr);
    const newMonth = nextDateStr.slice(0, 7);
    if (newMonth !== selectedMonth) {
      setSelectedMonth(newMonth);
    }
  };

  const handleSelectDayDate = (dateStr: string) => {
    if (!dateStr) return;
    setSelectedDayDate(dateStr);
    const newMonth = dateStr.slice(0, 7);
    if (newMonth !== selectedMonth) {
      setSelectedMonth(newMonth);
    }
  };

  const handleResetToToday = () => {
    const today = getTodayDateStr();
    setSelectedDayDate(today);
    setSelectedMonth(today.slice(0, 7));
  };

  const handleResetToCurrentMonth = () => {
    setSelectedMonth(currentMonthStr);
    setSelectedDayDate('');
  };

  // Jumlah Hari dalam Bulan Terpilih (1 s/d 28/29/30/31)
  const daysInSelectedMonth = React.useMemo(() => {
    const totalDays = new Date(selectedYearNum, selectedMonthNum, 0).getDate();
    return Array.from({ length: totalDays }, (_, i) => {
      const dayNum = i + 1;
      const dateStr = `${selectedYearNum}-${String(selectedMonthNum).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      const d = new Date(selectedYearNum, selectedMonthNum - 1, dayNum);
      const dayName = d.toLocaleDateString('id-ID', { weekday: 'short' });
      return { dayNum, dateStr, dayName };
    });
  }, [selectedYearNum, selectedMonthNum]);

  const activePeriodAttendances = React.useMemo(() => {
    const target = targetDayDate || getTodayDateStr();
    if (periodScope === 'today' || Boolean(selectedDayDate)) {
      return allAttendances.filter((a) => (a.attendanceDate || (a as any).date) === target);
    } else if (periodScope === 'month') {
      return allAttendances.filter((a) => {
        const d = a.attendanceDate || (a as any).date;
        if (!d || !d.startsWith(selectedMonth)) return false;
        if (selectedDayDate) return d === selectedDayDate;
        return true;
      });
    } else {
      return allAttendances.filter((a) => (a.attendanceDate || (a as any).date)?.startsWith(currentYearStr));
    }
  }, [allAttendances, periodScope, selectedMonth, selectedDayDate, targetDayDate, currentYearStr]);

  // Aggregate Division Summaries
  const divisionSummaries = React.useMemo(() => {
    return divisions.map((div) => {
      const divUsers = users.filter((u) => u.divisionId === div.id);
      const divAtts = activePeriodAttendances.filter((a) =>
        divUsers.some((u) => u.id === a.userId) || a.divisionName === div.name
      );
      const presentCount = divAtts.filter((a) => a.status === 'hadir').length;
      const lateCount = divAtts.filter((a) => a.status === 'terlambat' || (a.lateMinutes && a.lateMinutes > 0)).length;
      const totalLateMinutes = divAtts.reduce((sum, a) => sum + (a.lateMinutes || 0), 0);
      const totalHours = Math.round(divAtts.reduce((sum, a) => sum + (a.workDurationMinutes || 0), 0) / 60);
      const lateDeductionEstimate = totalLateMinutes * 1000;

      return {
        division: div,
        totalEmployees: divUsers.length,
        totalRecords: divAtts.length,
        presentCount,
        lateCount,
        totalLateMinutes,
        totalHours,
        lateDeductionEstimate,
      };
    });
  }, [divisions, users, activePeriodAttendances]);

  const allShifts = React.useMemo(() => hrmService.getShifts(), []);

  // Perhitungan Realtime Finansial & Kuota Anggaran Lembur Sah (Shipment Rp 65 Jt, Wisma Rp 4 Jt, Total Rp 69 Jt)
  // + Sistem Bulan Mundur (N-1): Lembur periode N-1 dibayarkan di Payroll bulan N; lembur kerja bulan N dibayar di N+1
  // + Sinkronisasi Gaji Asli Database per Orang (Shipment & RT) & Rp 140.000/hari Tanpa Lembur/BPJS (Karyawan Tetap)
  const financialStats = React.useMemo(() => {
    const curMonth = selectedMonth || currentMonthStr; // 'YYYY-MM' (Bulan Payroll Berjalan N)
    const arrearsMonth = getPreviousYearMonth(curMonth); // 'YYYY-MM' (Bulan Kerja Lembur N-1)
    const nextPayrollMonth = getNextYearMonth(curMonth); // 'YYYY-MM' (Pembayaran Lembur Bulan Berjalan N+1)
    const officialUsers = users.filter((u) => isOfficialFrEmployee(u));

    const isApprovedOt = (o: OvertimeRecord) =>
      o.status === 'approved' || (o as any).status === 'completed';

    const curMonthOvertimes = overtimes.filter((o) => {
      const d = o.date || (o as any).createdAt || '';
      return d.startsWith(curMonth) && isApprovedOt(o);
    });

    const arrearsMonthOvertimes = overtimes.filter((o) => {
      const d = o.date || (o as any).createdAt || '';
      return d.startsWith(arrearsMonth) && isApprovedOt(o);
    });

    let shipmentSpent = 0;
    let shipmentHours = 0;
    let wismaSpent = 0;
    let wismaHours = 0;

    curMonthOvertimes.forEach((o) => {
      const u = users.find((usr) => usr.id === o.userId || usr.nip === o.userNip);
      const grp = u ? getEmployeeCategoryGroup(u) : getEmployeeCategoryGroup(o.userNip || '');
      if (grp === 'KARYAWAN TETAP') return;

      const amt = Number((o as any).compensationAmount || o.totalPay || 0);
      const hrs = Number(o.approvedHours || o.durationHours || 0);

      if (grp === 'RUMAH TANGGA') {
        wismaSpent += amt;
        wismaHours += hrs;
      } else {
        shipmentSpent += amt;
        shipmentHours += hrs;
      }
    });

    // Lembur Bulan Mundur (N-1) yang dibayarkan pada Payroll bulan curMonth (N)
    const arrearsOtPayByUserId = new Map<string, number>();
    let totalArrearsOvertimeHours = 0;

    arrearsMonthOvertimes.forEach((o) => {
      const u = users.find((usr) => usr.id === o.userId || usr.nip === o.userNip);
      const grp = u ? getEmployeeCategoryGroup(u) : getEmployeeCategoryGroup(o.userNip || '');
      if (grp === 'KARYAWAN TETAP') return;

      const amt = Number((o as any).compensationAmount || o.totalPay || 0);
      const hrs = Number(o.approvedHours || o.durationHours || 0);
      totalArrearsOvertimeHours += hrs;
      if (u?.id) {
        arrearsOtPayByUserId.set(u.id, (arrearsOtPayByUserId.get(u.id) || 0) + amt);
      }
    });

    const perUserCalcs = officialUsers.map((u) =>
      calculateFrpEmployeeRealtimePay({
        user: u,
        month: curMonth,
        attendances: allAttendances,
        monthOvertimePay: arrearsOtPayByUserId.get(u.id) || 0,
      })
    );
    const byGroup = aggregateFrpGroupPayroll(perUserCalcs);
    const workdaysInMonth = countWeekdaysInMonth(curMonth);

    const hasSyncedNextArrears =
      nextPayrollArrears &&
      nextPayrollArrears.payrollMonth === nextPayrollMonth &&
      nextPayrollArrears.totals;

    const syncedShipmentSpent = hasSyncedNextArrears ? Number(nextPayrollArrears.totals.shipment?.totalPay || 0) : shipmentSpent;
    const syncedShipmentHours = hasSyncedNextArrears ? Number(nextPayrollArrears.totals.shipment?.totalRawHours || 0) : shipmentHours;
    const syncedShipmentPaidHours = hasSyncedNextArrears ? Number(nextPayrollArrears.totals.shipment?.totalPaidHours || 0) : shipmentHours;
    const syncedWismaSpent = hasSyncedNextArrears ? Number(nextPayrollArrears.totals.rumahTangga?.totalPay || 0) : wismaSpent;
    const syncedWismaHours = hasSyncedNextArrears ? Number(nextPayrollArrears.totals.rumahTangga?.totalRawHours || 0) : wismaHours;
    const syncedWismaPaidHours = hasSyncedNextArrears ? Number(nextPayrollArrears.totals.rumahTangga?.totalPaidHours || 0) : wismaHours;
    const nextOvertimeEmployeesCount = hasSyncedNextArrears
      ? Number(nextPayrollArrears.totals.shipment?.withOvertimeCount || 0) + Number(nextPayrollArrears.totals.rumahTangga?.withOvertimeCount || 0)
      : curMonthOvertimes.length;

    const totalOvertimeSpent = hasSyncedNextArrears
      ? Number(nextPayrollArrears.totals.grandTotalPay || syncedShipmentSpent + syncedWismaSpent)
      : shipmentSpent + wismaSpent;
    const totalOvertimeHours = syncedShipmentHours + syncedWismaHours;
    const totalOvertimePaidHours = syncedShipmentPaidHours + syncedWismaPaidHours;
    const TOTAL_BUDGET = 69000000;
    const SHIPMENT_BUDGET = 65000000;
    const WISMA_BUDGET = 4000000;

    const shipmentEmployeesCount = hasSyncedNextArrears
      ? Number(nextPayrollArrears.totals.shipment?.withOvertimeCount || 0)
      : curMonthOvertimes.filter((o) => {
          const u = users.find((usr) => usr.id === o.userId || usr.nip === o.userNip);
          const grp = u ? getEmployeeCategoryGroup(u) : getEmployeeCategoryGroup(o.userNip || '');
          return grp === 'SHIPMENT';
        }).length;

    const wismaEmployeesCount = hasSyncedNextArrears
      ? Number(nextPayrollArrears.totals.rumahTangga?.withOvertimeCount || 0)
      : curMonthOvertimes.filter((o) => {
          const u = users.find((usr) => usr.id === o.userId || usr.nip === o.userNip);
          const grp = u ? getEmployeeCategoryGroup(u) : getEmployeeCategoryGroup(o.userNip || '');
          return grp === 'RUMAH TANGGA';
        }).length;

    const shipmentRemaining = Math.max(0, SHIPMENT_BUDGET - syncedShipmentSpent);
    const shipmentPercent = Math.min(100, Math.round((syncedShipmentSpent / SHIPMENT_BUDGET) * 100));
    const shipmentRemainingPercent = Math.max(0, 100 - shipmentPercent);
    const isShipmentNearLimit = shipmentPercent >= 85;
    const isShipmentExceeded = syncedShipmentSpent >= SHIPMENT_BUDGET;

    const wismaRemaining = Math.max(0, WISMA_BUDGET - syncedWismaSpent);
    const wismaPercent = Math.min(100, Math.round((syncedWismaSpent / WISMA_BUDGET) * 100));
    const wismaRemainingPercent = Math.max(0, 100 - wismaPercent);
    const isWismaNearLimit = wismaPercent >= 85;
    const isWismaExceeded = syncedWismaSpent >= WISMA_BUDGET;

    const remainingBudget = Math.max(0, TOTAL_BUDGET - totalOvertimeSpent);
    const budgetPercent = Math.min(100, Math.round((totalOvertimeSpent / TOTAL_BUDGET) * 100));
    const totalRemainingPercent = Math.max(0, 100 - budgetPercent);

    return {
      curMonth,
      curMonthLabel: formatYearMonthId(curMonth),
      curMonthShort: formatYearMonthId(curMonth, true),
      arrearsMonth,
      arrearsMonthLabel: formatYearMonthId(arrearsMonth),
      arrearsMonthShort: formatYearMonthId(arrearsMonth, true),
      nextPayrollMonth,
      nextPayrollMonthLabel: formatYearMonthId(nextPayrollMonth),
      nextPayrollMonthShort: formatYearMonthId(nextPayrollMonth, true),
      workdaysInMonth,
      totalUsers: officialUsers.length,
      TOTAL_BUDGET,
      SHIPMENT_BUDGET,
      WISMA_BUDGET,
      totalOvertimeSpent,
      totalOvertimeHours,
      totalOvertimePaidHours,
      nextOvertimeEmployeesCount,
      totalArrearsOvertimePay: byGroup.all.totalOvertimePay,
      totalArrearsOvertimeHours,
      shipmentSpent: syncedShipmentSpent,
      shipmentHours: syncedShipmentHours,
      shipmentPaidHours: syncedShipmentPaidHours,
      shipmentEmployeesCount,
      shipmentRemaining,
      shipmentPercent,
      shipmentRemainingPercent,
      isShipmentNearLimit,
      isShipmentExceeded,
      wismaSpent: syncedWismaSpent,
      wismaHours: syncedWismaHours,
      wismaPaidHours: syncedWismaPaidHours,
      wismaEmployeesCount,
      wismaRemaining,
      wismaPercent,
      wismaRemainingPercent,
      isWismaNearLimit,
      isWismaExceeded,
      remainingBudget,
      budgetPercent,
      totalRemainingPercent,
      totalBaseSalary: byGroup.all.totalBaseSalary,
      totalBpjsDeduction: byGroup.all.totalBpjs,
      totalEstimatedNet: byGroup.all.totalNetSalary,
      byGroup,
      isNearLimit: budgetPercent >= 85,
      isExceeded: totalOvertimeSpent >= TOTAL_BUDGET,
    };
  }, [selectedMonth, currentMonthStr, users, overtimes, allAttendances]);

  const isDailyView = periodScope === 'today' || Boolean(selectedDayDate);

  const monitoredList = users.map((u) => {
    if (isDailyView) {
      const att = activePeriodAttendances.find(
        (a) => ((a.attendanceDate || (a as any).date) === targetDayDate) &&
               (a.userId === u.id || a.userId === u.email || a.userId === u.nip || (a.userNip && a.userNip === u.nip))
      );

      let isLate = att && (att.status === 'terlambat' || (att.lateMinutes && att.lateMinutes > 0));
      let effectiveLateMinutes = att?.lateMinutes || 0;

      // Evaluasi jadwal kerja dan jam shift untuk mendeteksi status kehadiran secara akurat
      // Prioritaskan jadwal yang persis cocok dengan targetDayDate
      const sched =
        dailySchedules.find(
          (s) =>
            (s.scheduleDate === targetDayDate || (s as any).date === targetDayDate) &&
            (s.userId === u.id || s.userNip === u.nip || (s as any).employeeNip === u.nip)
        ) ||
        todaySchedules.find(
          (s) =>
            (s.scheduleDate === targetDayDate || (s as any).date === targetDayDate) &&
            (s.userId === u.id || s.userNip === u.nip || (s as any).employeeNip === u.nip)
        ) ||
        hrmService.getEmployeeTodaySchedule(u.id, targetDayDate);
      const uShift = resolveEffectiveShift(u, allShifts, sched);
      const nowWita = new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Makassar', hour12: false, hour: '2-digit', minute: '2-digit' });
      
      const targetDateObj = new Date(targetDayDate);
      const dayOfWeek = targetDateObj.getDay(); // 0 = Minggu (Sunday), 6 = Sabtu (Saturday)
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isSpecialLeadership = isLeadershipSpecialFieldOfficer(u);
      const isFaceEnrolled = Boolean(u.isFaceEnrolled || u.faceEnrolledPhoto || (u as any).face_enrolled_photo || (u as any).face_photo_url || (u as any).facePhotoUrl);
      const isSimAccount = isSimulationAccount(u);

      const isScheduleOff = Boolean(
        sched?.isOff === true ||
        sched?.shiftCode === 'OFF' ||
        uShift?.isOff === true ||
        uShift?.code === 'OFF' ||
        sched?.shiftName?.toLowerCase().includes('libur') ||
        uShift?.name?.toLowerCase().includes('libur')
      );

      // Cek pengajuan cuti / izin resmi yang disetujui untuk targetDayDate
      const activeLeave = approvedLeaves.find((l) => {
        const lUserId = l.userId || (l as any).user_id || (l as any).employeeId;
        const lUserNip = l.userNip || (l as any).user_nip || (l as any).employeeNip;
        const matchUser = lUserId === u.id || (Boolean(lUserNip) && lUserNip === u.nip);
        if (!matchUser) return false;
        const start = String(l.startDate || (l as any).start_date || '').slice(0, 10);
        const end = String(l.endDate || (l as any).end_date || start).slice(0, 10);
        return targetDayDate >= start && targetDayDate <= end;
      });

      const isLeaveRecord = att && (att.status === 'cuti' || att.status === 'sakit' || att.status === 'izin');
      const isOffRecord = att && (att.status === 'off' || att.status === 'libur');
      const isAlfaRecord = att && (att.status === 'alfa' || att.status === 'alpa' || att.status === 'alpha');

      let absentSubtype: 'pending_shift' | 'in_progress' | 'mangkir' | 'off' | 'cuti' | 'sakit' | 'izin' | 'unregistered' = 'in_progress';
      if (activeLeave || isLeaveRecord) {
        const leaveTypeStr = String(activeLeave?.type || (activeLeave as any)?.leaveType || (activeLeave as any)?.leave_type || att?.status || 'cuti').toLowerCase();
        if (leaveTypeStr.includes('sakit')) {
          absentSubtype = 'sakit';
        } else if (leaveTypeStr.includes('izin') || leaveTypeStr.includes('emergency')) {
          absentSubtype = 'izin';
        } else {
          absentSubtype = 'cuti';
        }
      } else if (isOffRecord || isScheduleOff) {
        // Karyawan dengan jadwal roster OFF resmi LIBUR / OFF
        absentSubtype = 'off';
      } else if (isSpecialLeadership && isWeekend) {
        // 3 Petugas Lapangan Khusus Pimpinan resmi LIBUR di akhir pekan (Sabtu & Minggu)
        absentSubtype = 'off';
      } else if (isWeekend && (!sched || sched.isOff || sched.shiftCode === 'OFF' || (!['P', 'S', 'M'].includes(sched.shiftCode || '') && (!uShift || uShift.isOff || uShift.code === 'OFF' || uShift.code === 'DAY')))) {
        // Karyawan reguler Day Shift tanpa jadwal rotasi shift di akhir pekan adalah LIBUR
        absentSubtype = 'off';
      } else if (isAlfaRecord) {
        if (!isFaceEnrolled || isSimAccount) {
          absentSubtype = 'unregistered';
        } else {
          absentSubtype = 'mangkir';
        }
      } else if (!att || !att.clockIn) {
        if (!isFaceEnrolled || isSimAccount) {
          absentSubtype = 'unregistered';
        } else if (targetDayDate === getTodayDateStr()) {
          if (uShift && uShift.startTime && uShift.endTime && uShift.startTime !== '00:00' && uShift.code !== 'OFF' && !uShift.isOff) {
            const shiftEnd = uShift.endTime.slice(0, 5);
            const shiftStart = uShift.startTime.slice(0, 5);
            const isCrossDay = Boolean(uShift.isCrossDay || shiftEnd < shiftStart);

            if (isCrossDay) {
              // Shift Lintas Hari / Malam (misal 22:30 - 07:30 WITA):
              // Pukul 12:00 s/d 22:29: pending_shift (menunggu shift malam)
              // Pukul 22:30 s/d 23:59 & 00:00 s/d 07:30: in_progress (shift sedang berlangsung)
              // Pada hari H, shift malam TIDAK BOLEH ditandai mangkir karena baru selesai besok pagi (H+1 pk 07:30 WITA)
              if (nowWita < shiftStart && nowWita >= '12:00') {
                absentSubtype = 'pending_shift';
              } else {
                absentSubtype = 'in_progress';
              }
            } else {
              // Shift Reguler Hari Sama (misal 07:30 - 15:30 atau 15:30 - 22:30)
              if (nowWita < shiftStart) {
                absentSubtype = 'pending_shift';
              } else if (nowWita >= shiftEnd) {
                absentSubtype = 'mangkir';
              } else {
                absentSubtype = 'in_progress';
              }
            }
          } else {
            absentSubtype = nowWita >= '17:00' ? 'mangkir' : 'in_progress';
          }
        } else {
          absentSubtype = targetDayDate < getTodayDateStr() ? 'mangkir' : 'pending_shift';
        }
      }

      // Realtime authoritative fallback evaluation jika status di database belum sinkron
      if (att && att.clockIn && !isLate && !isLeaveRecord && !isOffRecord) {
        if (uShift && uShift.startTime) {
          const latenessEval = calculateAttendanceLateness({
            clockInTime: att.clockIn,
            shiftStartTime: uShift.startTime,
            shiftEndTime: uShift.endTime,
            lateToleranceMinutes: u.lateToleranceMinutes ?? uShift.lateToleranceMinutes ?? 15,
            isCrossDay: uShift.isCrossDay,
          });
          if (latenessEval.status === 'terlambat' && latenessEval.lateMinutes > 0) {
            isLate = true;
            effectiveLateMinutes = latenessEval.lateMinutes;
          }
        }
      }

      let calculatedStatus: 'present' | 'late' | 'absent' | 'mangkir';
      if (activeLeave || isLeaveRecord || isOffRecord || isScheduleOff || absentSubtype === 'off') {
        calculatedStatus = 'absent';
      } else if (isAlfaRecord || (!att && absentSubtype === 'mangkir')) {
        calculatedStatus = absentSubtype === 'mangkir' ? 'mangkir' : 'absent';
      } else if (!att || !att.clockIn) {
        calculatedStatus = 'absent';
      } else if (isLate) {
        calculatedStatus = 'late';
      } else {
        calculatedStatus = 'present';
      }

      // Hitung lembur live hari target & lembur bulan berjalan untuk karyawan
      const normNip = (n?: string) => (n || '').replace(/[\s.]/g, '').toUpperCase();
      const userDayOts = overtimes.filter((o) => {
        const oUserId = o.userId || (o as any).user_id;
        const oUserNip = o.userNip || (o as any).user_nip || (o as any).employeeNip;
        const oDate = String(o.date || (o as any).overtimeDate || (o as any).overtime_date || '').slice(0, 10);
        const matchUser = oUserId === u.id || (Boolean(oUserNip) && normNip(oUserNip) === normNip(u.nip)) || (u.email && (o as any).email?.toLowerCase() === u.email?.toLowerCase());
        const isApproved = o.status === 'approved' || (o as any).status === 'completed';
        return matchUser && oDate === targetDayDate && isApproved;
      });
      const dayOt = userDayOts[0] || null;
      const dayOtHours = userDayOts.reduce((sum, o) => sum + Number(o.approvedHours || o.durationHours || 0), 0);
      const dayOtPay = userDayOts.reduce((sum, o) => sum + Number(o.compensationAmount || o.totalPay || 0), 0);

      const userMonthOts = overtimes.filter((o) => {
        const oUserId = o.userId || (o as any).user_id;
        const oUserNip = o.userNip || (o as any).user_nip || (o as any).employeeNip;
        const oDate = String(o.date || (o as any).overtimeDate || (o as any).overtime_date || (o as any).createdAt || (o as any).created_at || '').slice(0, 10);
        const matchUser = oUserId === u.id || (Boolean(oUserNip) && normNip(oUserNip) === normNip(u.nip)) || (u.email && (o as any).email?.toLowerCase() === u.email?.toLowerCase());
        const isApproved = o.status === 'approved' || (o as any).status === 'completed';
        const targetPeriod = selectedMonth || currentMonthStr;
        return matchUser && oDate.startsWith(targetPeriod) && isApproved;
      });
      const userMonthOtHours = userMonthOts.reduce((sum, o) => sum + Number(o.approvedHours || (o as any).approved_hours || o.durationHours || (o as any).duration_hours || 0), 0);
      const userMonthOtPay = userMonthOts.reduce((sum, o) => sum + Number(o.compensationAmount || (o as any).compensation_amount || o.totalPay || (o as any).total_pay || 0), 0);

      const monthlyOvertimeDates = userMonthOts.map((o) => {
        const dStr = String(o.date || (o as any).overtimeDate || (o as any).overtime_date || '').slice(0, 10);
        const dayNum = parseInt(dStr.slice(8, 10), 10);
        const hrs = Number(o.approvedHours || (o as any).approved_hours || o.durationHours || (o as any).duration_hours || 0);
        const pay = Number(o.compensationAmount || (o as any).compensation_amount || o.totalPay || (o as any).total_pay || 0);
        return {
          date: dStr,
          day: isNaN(dayNum) ? dStr : dayNum,
          hours: hrs,
          pay,
          task: o.taskDescription || (o as any).task_description || '',
          startTime: o.startTime || (o as any).start_time,
          endTime: o.endTime || (o as any).end_time,
        };
      }).sort((a, b) => a.date.localeCompare(b.date));

      return {
        user: u,
        attendance: att,
        status: calculatedStatus,
        absentSubtype,
        shift: uShift,
        totalLateMinutes: effectiveLateMinutes,
        lateCount: isLate ? 1 : 0,
        totalAttCount: (att && !isAlfaRecord && !isLeaveRecord && !isOffRecord) ? 1 : 0,
        todayOvertime: dayOt || null,
        todayOvertimeHours: dayOtHours,
        todayOvertimePay: dayOtPay,
        monthlyOvertimeHours: userMonthOtHours,
        monthlyOvertimePay: userMonthOtPay,
        monthlyOvertimeCount: userMonthOts.length,
        monthlyOvertimeDates,
      };
    } else {
      const userAtts = activePeriodAttendances.filter(
        (a) => a.userId === u.id || a.userId === u.email || a.userId === u.nip || (a.userNip && a.userNip === u.nip)
      );
      const lateAtts = userAtts.filter((a) => {
        if (a.status === 'terlambat' || (a.lateMinutes && a.lateMinutes > 0)) return true;
        if (a.clockIn) {
          const aDate = a.attendanceDate || (a as any).date;
          const uShift = resolveEffectiveShift(u, allShifts, hrmService.getEmployeeTodaySchedule(u.id, aDate));
          if (uShift && uShift.startTime) {
            const evalRes = calculateAttendanceLateness({
              clockInTime: a.clockIn,
              shiftStartTime: uShift.startTime,
              shiftEndTime: uShift.endTime,
              lateToleranceMinutes: u.lateToleranceMinutes ?? uShift.lateToleranceMinutes ?? 15,
              isCrossDay: uShift.isCrossDay,
            });
            return evalRes.status === 'terlambat';
          }
        }
        return false;
      });
      const totLateMin = lateAtts.reduce((sum, a) => {
        if (a.lateMinutes && a.lateMinutes > 0) return sum + a.lateMinutes;
        if (a.clockIn) {
          const aDate = a.attendanceDate || (a as any).date;
          const uShift = resolveEffectiveShift(u, allShifts, hrmService.getEmployeeTodaySchedule(u.id, aDate));
          if (uShift && uShift.startTime) {
            const evalRes = calculateAttendanceLateness({
              clockInTime: a.clockIn,
              shiftStartTime: uShift.startTime,
              shiftEndTime: uShift.endTime,
              lateToleranceMinutes: u.lateToleranceMinutes ?? uShift.lateToleranceMinutes ?? 15,
              isCrossDay: uShift.isCrossDay,
            });
            return sum + evalRes.lateMinutes;
          }
        }
        return sum;
      }, 0);
      const latestAtt = userAtts[userAtts.length - 1];

      // Filter Kehadiran Riil: TIDAK MENGHITUNG cuti, sakit, izin, off, alpa sebagai hari hadir
      const presentAtts = userAtts.filter((a) => {
        const isLeave = a.status === 'cuti' || a.status === 'sakit' || a.status === 'izin';
        const isOffOrAlfa = a.status === 'off' || a.status === 'libur' || a.status === 'alfa' || a.status === 'alpa';
        if (isLeave || isOffOrAlfa) return false;
        return Boolean(a.clockIn || a.status === 'hadir' || a.status === 'terlambat');
      });

      const sched = hrmService.getEmployeeTodaySchedule(u.id, getTodayDateStr());
      const uShift = resolveEffectiveShift(u, allShifts, sched);
      const userPeriodOts = overtimes.filter((o) => {
        const oUserId = o.userId || (o as any).user_id;
        const oUserNip = o.userNip || (o as any).user_nip || (o as any).employeeNip;
        const oDate = String(o.date || (o as any).overtimeDate || (o as any).overtime_date || (o as any).createdAt || (o as any).created_at || '').slice(0, 10);
        const matchPeriod = periodScope === 'month' ? oDate.startsWith(selectedMonth) : oDate.startsWith(currentYearStr);
        const matchUser = oUserId === u.id || oUserNip === u.nip || (u.email && (o as any).email === u.email);
        const isApproved = o.status === 'approved' || (o as any).status === 'completed';
        return matchUser && matchPeriod && isApproved;
      });
      const periodOtHours = userPeriodOts.reduce((sum, o) => sum + Number(o.approvedHours || (o as any).approved_hours || o.durationHours || (o as any).duration_hours || 0), 0);
      const periodOtPay = userPeriodOts.reduce((sum, o) => sum + Number(o.compensationAmount || (o as any).compensation_amount || o.totalPay || (o as any).total_pay || 0), 0);

      return {
        user: u,
        attendance: latestAtt,
        status: userAtts.length === 0 ? 'absent' : lateAtts.length > 0 ? 'late' : 'present',
        shift: uShift,
        totalLateMinutes: totLateMin,
        lateCount: lateAtts.length,
        totalAttCount: presentAtts.length,
        todayOvertime: null,
        todayOvertimeHours: 0,
        todayOvertimePay: 0,
        monthlyOvertimeHours: periodOtHours,
        monthlyOvertimePay: periodOtPay,
        monthlyOvertimeCount: userPeriodOts.length,
        monthlyOvertimeDates: userPeriodOts.map((o) => {
          const dStr = String(o.date || (o as any).overtimeDate || (o as any).overtime_date || '').slice(0, 10);
          const dayNum = parseInt(dStr.slice(8, 10), 10);
          return {
            date: dStr,
            day: isNaN(dayNum) ? dStr : dayNum,
            hours: Number(o.approvedHours || (o as any).approved_hours || o.durationHours || 0),
            pay: Number(o.compensationAmount || (o as any).compensation_amount || o.totalPay || 0),
            task: o.taskDescription || '',
            startTime: o.startTime,
            endTime: o.endTime,
          };
        }).sort((a, b) => a.date.localeCompare(b.date)),
      };
    }
  });

  const filtered = monitoredList.filter((item) => {
    const matchTab = activeTab === 'all' || item.status === activeTab;
    const matchDiv = filterDivision === 'all' || item.user.divisionId === filterDivision;
    const matchSearch =
      item.user.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.user.nip.toLowerCase().includes(searchQuery.toLowerCase());

    // Filter Kolom Jadwal Shift
    let matchShift = true;
    if (filterShift !== 'all') {
      const shiftCode = (item.shift?.code || item.shift?.name || '').toUpperCase();
      const shiftStart = (item.shift?.startTime || '').slice(0, 5);
      if (filterShift === 'OFF') {
        matchShift = item.shift?.isOff === true || shiftCode === 'OFF' || item.shift?.name?.toLowerCase().includes('libur');
      } else if (filterShift === 'cuti') {
        matchShift = item.absentSubtype === 'cuti';
      } else if (filterShift === 'P') {
        matchShift = !item.shift?.isOff && item.absentSubtype !== 'cuti' && (
          shiftCode === 'P' || 
          shiftCode.includes('PAGI') || 
          shiftCode.includes('SHIFT I') || 
          shiftCode.includes('SHIFT 1') || 
          (Boolean(item.shift?.startTime) && shiftStart.startsWith('07'))
        );
      } else if (filterShift === 'S') {
        matchShift = !item.shift?.isOff && item.absentSubtype !== 'cuti' && (
          shiftCode === 'S' || 
          shiftCode.includes('SIANG') || 
          shiftCode.includes('SORE') || 
          shiftCode.includes('SHIFT II') || 
          shiftCode.includes('SHIFT 2') || 
          (Boolean(item.shift?.startTime) && shiftStart.startsWith('15'))
        );
      } else if (filterShift === 'M') {
        matchShift = !item.shift?.isOff && item.absentSubtype !== 'cuti' && (
          shiftCode === 'M' || 
          shiftCode.includes('MALAM') || 
          shiftCode.includes('SHIFT III') || 
          shiftCode.includes('SHIFT 3') || 
          (Boolean(item.shift?.startTime) && shiftStart.startsWith('22'))
        );
      } else if (filterShift === 'DAY') {
        matchShift = !item.shift?.isOff && item.absentSubtype !== 'cuti' && !shiftStart.startsWith('07') && (
          shiftCode.includes('DAY') || 
          shiftCode.includes('PIMPINAN') || 
          shiftCode.includes('NORMAL') || 
          shiftStart.startsWith('08') || 
          (!item.shift?.code && !['P', 'S', 'M'].includes(shiftCode))
        );
      }
    }

    // Filter Kolom Status Kehadiran
    let matchStatusCol = true;
    if (filterStatusCol !== 'all') {
      if (filterStatusCol === 'present') matchStatusCol = item.status === 'present';
      else if (filterStatusCol === 'late') matchStatusCol = item.status === 'late';
      else if (filterStatusCol === 'mangkir') matchStatusCol = item.status === 'mangkir' || item.absentSubtype === 'mangkir';
      else if (filterStatusCol === 'cuti') matchStatusCol = item.absentSubtype === 'cuti';
      else if (filterStatusCol === 'izin') matchStatusCol = item.absentSubtype === 'izin' || item.absentSubtype === 'sakit';
      else if (filterStatusCol === 'off') matchStatusCol = item.absentSubtype === 'off';
      else if (filterStatusCol === 'pending') matchStatusCol = item.absentSubtype === 'pending_shift';
      else if (filterStatusCol === 'unregistered') matchStatusCol = item.absentSubtype === 'unregistered';
    }

    // Filter Kolom Kelompok
    const itemCategory = getEmployeeCategoryGroup(item.user);
    const matchCategory = filterCategory === 'all' || itemCategory === filterCategory;

    // Filter Kolom Lembur Live
    let matchOt = true;
    if (filterOvertimeCol === 'has_ot') {
      matchOt = isDailyView ? ((item.todayOvertimeHours || 0) > 0 || Boolean(item.todayOvertime)) : (((item.todayOvertimeHours || 0) > 0) || (item.monthlyOvertimeHours > 0));
    } else if (filterOvertimeCol === 'no_ot') {
      matchOt = isDailyView ? ((item.todayOvertimeHours || 0) === 0 && !item.todayOvertime) : ((item.todayOvertimeHours === 0) && (item.monthlyOvertimeHours === 0));
    }

    return matchTab && matchDiv && matchSearch && matchShift && matchStatusCol && matchOt && matchCategory;
  }).sort((a, b) => {
    const priority: Record<EmployeeCategoryGroup, number> = {
      'RUMAH TANGGA': 1,
      'SHIPMENT': 2,
      'KARYAWAN TETAP': 3,
      'OTHER': 4,
    };
    const catA = getEmployeeCategoryGroup(a.user);
    const catB = getEmployeeCategoryGroup(b.user);
    if (priority[catA] !== priority[catB]) return priority[catA] - priority[catB];
    const numA = parseInt(String(a.user.nip || '').replace(/\D/g, ''), 10) || 999999;
    const numB = parseInt(String(b.user.nip || '').replace(/\D/g, ''), 10) || 999999;
    if (numA !== numB) return numA - numB;
    return String(a.user.fullName || '').localeCompare(String(b.user.fullName || ''));
  });

  const buildCategoryStats = (list: typeof monitoredList) => ({
    total: list.length,
    present: list.filter((i) => i.status === 'present').length,
    late: list.filter((i) => i.status === 'late').length,
    mangkir: list.filter((i) => i.status === 'mangkir' || (i as any).absentSubtype === 'mangkir').length,
    absent: list.filter((i) => i.status === 'absent' && (i as any).absentSubtype !== 'mangkir').length,
  });

  const categoryMonitoringStats = {
    all: buildCategoryStats(monitoredList),
    rumahTangga: buildCategoryStats(monitoredList.filter((i) => getEmployeeCategoryGroup(i.user) === 'RUMAH TANGGA')),
    shipment: buildCategoryStats(monitoredList.filter((i) => getEmployeeCategoryGroup(i.user) === 'SHIPMENT')),
    karyawanTetap: buildCategoryStats(monitoredList.filter((i) => getEmployeeCategoryGroup(i.user) === 'KARYAWAN TETAP')),
  };

  const scopedMonitoredList = filterCategory === 'all'
    ? monitoredList
    : monitoredList.filter((i) => getEmployeeCategoryGroup(i.user) === filterCategory);

  // Rekapitulasi Presensi Real-Time per Shift (Shift I, Shift II, Shift III, Day Shift, OFF) untuk tanggal aktif (targetDayDate)
  const dailyShiftBreakdown = React.useMemo(() => {
    const list = scopedMonitoredList;

    const stats = {
      shift1: {
        id: 'P',
        name: 'Shift I (Pagi)',
        time: '07:30 WITA (Shift I & Day)',
        total: 0,
        present: 0,
        late: 0,
        unregistered: 0,
        pendingOrAbsent: 0,
      },
      shift2: {
        id: 'S',
        name: 'Shift II (Siang)',
        time: '15:30 - 22:30 WITA',
        total: 0,
        present: 0,
        late: 0,
        unregistered: 0,
        pendingOrAbsent: 0,
      },
      shift3: {
        id: 'M',
        name: 'Shift III (Malam)',
        time: '22:30 - 07:30 WITA',
        total: 0,
        present: 0,
        late: 0,
        unregistered: 0,
        pendingOrAbsent: 0,
      },
      dayShift: {
        id: 'DAY',
        name: 'Day Shift (Normal)',
        time: '08:00 - 16:00 / Khusus',
        total: 0,
        present: 0,
        late: 0,
        unregistered: 0,
        pendingOrAbsent: 0,
      },
      off: {
        id: 'OFF',
        name: 'Libur / OFF Roster',
        time: 'Bebas Dinas / Off Duty',
        total: 0,
        leave: 0,
        regularOff: 0,
      },
    };

    list.forEach((item) => {
      const shiftCode = (item.shift?.code || item.shift?.name || '').toUpperCase();
      const shiftStart = (item.shift?.startTime || '').slice(0, 5);
      const isOff = item.absentSubtype === 'off' || item.shift?.isOff === true || shiftCode === 'OFF' || item.shift?.name?.toLowerCase().includes('libur');
      const isLeave = item.absentSubtype === 'cuti' || item.absentSubtype === 'sakit' || item.absentSubtype === 'izin';
      const isPresent = Boolean(item.attendance?.clockIn || item.status === 'present' || item.status === 'late');
      const isLate = Boolean(item.status === 'late' || (item.attendance?.lateMinutes && item.attendance.lateMinutes > 0));
      const isUnregistered = item.absentSubtype === 'unregistered';

      // Opsi 1: Seluruh personil dinas pagi (07:30 / Shift I / Day Shift kebersihan/staf Rumah Tangga) disatukan ke Shift I (Pagi)
      const isMorningDuty = !isOff && !isLeave && (
        shiftCode === 'P' || 
        shiftCode.includes('PAGI') || 
        shiftCode.includes('SHIFT I') || 
        shiftCode.includes('SHIFT 1') || 
        (shiftStart.startsWith('07'))
      );

      if (isLeave) {
        stats.off.total++;
        stats.off.leave++;
      } else if (isOff) {
        stats.off.total++;
        stats.off.regularOff++;
      } else if (isMorningDuty) {
        stats.shift1.total++;
        if (isPresent) {
          stats.shift1.present++;
          if (isLate) stats.shift1.late++;
        } else if (isUnregistered) {
          stats.shift1.unregistered++;
        } else {
          stats.shift1.pendingOrAbsent++;
        }
      } else if (shiftCode === 'S' || shiftCode.includes('SIANG') || shiftCode.includes('SORE') || shiftCode.includes('SHIFT II') || shiftCode.includes('SHIFT 2') || shiftStart === '15:30') {
        stats.shift2.total++;
        if (isPresent) {
          stats.shift2.present++;
          if (isLate) stats.shift2.late++;
        } else if (isUnregistered) {
          stats.shift2.unregistered++;
        } else {
          stats.shift2.pendingOrAbsent++;
        }
      } else if (shiftCode === 'M' || shiftCode.includes('MALAM') || shiftCode.includes('SHIFT III') || shiftCode.includes('SHIFT 3') || shiftStart === '22:30') {
        stats.shift3.total++;
        if (isPresent) {
          stats.shift3.present++;
          if (isLate) stats.shift3.late++;
        } else if (isUnregistered) {
          stats.shift3.unregistered++;
        } else {
          stats.shift3.pendingOrAbsent++;
        }
      } else {
        // Day Shift Staf Khusus / Non-07:30
        stats.dayShift.total++;
        if (isPresent) {
          stats.dayShift.present++;
          if (isLate) stats.dayShift.late++;
        } else if (isUnregistered) {
          stats.dayShift.unregistered++;
        } else {
          stats.dayShift.pendingOrAbsent++;
        }
      }
    });

    return stats;
  }, [scopedMonitoredList]);

  // Rekapitulasi Presensi Real-Time Lembur (SPKL) untuk tanggal aktif (targetDayDate)
  const dailyOvertimeStats = React.useMemo(() => {
    const list = scopedMonitoredList;
    const itemsWithOt = list.filter((i) => (i.todayOvertimeHours || 0) > 0 || Boolean(i.todayOvertime));

    const totalCount = itemsWithOt.length;
    const totalHours = itemsWithOt.reduce((sum, i) => sum + (i.todayOvertimeHours || 0), 0);
    const totalPay = itemsWithOt.reduce((sum, i) => sum + (i.todayOvertimePay || 0), 0);

    const shipmentCount = itemsWithOt.filter((i) => getEmployeeCategoryGroup(i.user) === 'SHIPMENT').length;
    const rtCount = itemsWithOt.filter((i) => getEmployeeCategoryGroup(i.user) === 'RUMAH TANGGA').length;
    const tetapCount = itemsWithOt.filter((i) => getEmployeeCategoryGroup(i.user) === 'KARYAWAN TETAP').length;

    // Deteksi relief pos / setelah shift / hari off
    let afterShiftCount = 0;
    let beforeShiftCount = 0;
    let offShiftCount = 0;

    itemsWithOt.forEach((i) => {
      const isOff = i.absentSubtype === 'off' || i.shift?.isOff === true || (i.shift?.code || '').toUpperCase() === 'OFF';
      const schedStart = (i.shift?.startTime || '').slice(0, 5);
      const otStart = (i.todayOvertime?.startTime || (i.todayOvertime as any)?.start_time || '').slice(0, 5);

      if (isOff) {
        offShiftCount++;
      } else if (otStart && schedStart && otStart < schedStart) {
        beforeShiftCount++;
      } else {
        afterShiftCount++;
      }
    });

    const employees = itemsWithOt.map((i) => ({
      id: i.user.id,
      name: i.user.name,
      nip: i.user.nip,
      hours: i.todayOvertimeHours || 0,
      pay: i.todayOvertimePay || 0,
      startTime: i.todayOvertime?.startTime || (i.todayOvertime as any)?.start_time,
      endTime: i.todayOvertime?.endTime || (i.todayOvertime as any)?.end_time,
      task: i.todayOvertime?.taskDescription || (i.todayOvertime as any)?.task_description || '',
      category: getEmployeeCategoryGroup(i.user),
    }));

    return {
      totalCount,
      totalHours,
      totalPay,
      shipmentCount,
      rtCount,
      tetapCount,
      afterShiftCount,
      beforeShiftCount,
      offShiftCount,
      employees,
    };
  }, [scopedMonitoredList]);

  const presentCount = scopedMonitoredList.filter((i) => i.status === 'present').length;
  const lateCount = scopedMonitoredList.filter((i) => i.status === 'late').length;
  const mangkirCount = scopedMonitoredList.filter((i) => i.status === 'mangkir' || (i as any).absentSubtype === 'mangkir').length;
  const absentCount = scopedMonitoredList.filter((i) => i.status === 'absent' && (i as any).absentSubtype !== 'mangkir').length;
  const leaveCount = scopedMonitoredList.filter((i) => ['cuti', 'sakit', 'izin'].includes((i as any).absentSubtype)).length;
  const offRosterCount = scopedMonitoredList.filter((i) => (i as any).absentSubtype === 'off').length;
  const unregisteredCount = scopedMonitoredList.filter((i) => (i as any).absentSubtype === 'unregistered').length;
  const pendingShiftCount = scopedMonitoredList.filter((i) => ['pending_shift', 'in_progress'].includes((i as any).absentSubtype) && i.status === 'absent').length;
  const activeBreaches = perimeterViolations.filter((v) => {
    if (v.status !== 'active') return false;
    const u = users.find((usr) => usr.id === v.userId || usr.nip === v.userNip);
    if (u && isMacciniBajiOfficer(u) && macciniVesselStatus.status !== 'docking') {
      return false;
    }
    return true;
  });

  const radarSummary: AnomalyRadarSummary = React.useMemo(() => {
    return anomalyDetectionService.analyzeWorkforceAnomalies(users, activePeriodAttendances, overtimes);
  }, [users, activePeriodAttendances, overtimes]);

  const getCategoryBadgeMeta = (group: EmployeeCategoryGroup) => {
    switch (group) {
      case 'RUMAH TANGGA':
        return {
          shortLabel: '🏠 Rumah Tangga',
          label: '🏠 Rumah Tangga (FR07001–FR07033)',
          badgeClass: 'bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800',
        };
      case 'SHIPMENT':
        return {
          shortLabel: '🚢 Shipment',
          label: '🚢 Shipment (FR07034–FR07080)',
          badgeClass: 'bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800',
        };
      case 'KARYAWAN TETAP':
        return {
          shortLabel: '⭐ Karyawan Tetap',
          label: '⭐ Karyawan Tetap (Takdir, Aslam, Samsi)',
          badgeClass: 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
        };
      default:
        return {
          shortLabel: 'Lainnya',
          label: 'Karyawan Operasional',
          badgeClass: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900/40 dark:text-slate-300 dark:border-slate-700',
        };
    }
  };

  return (
    <div className="space-y-4">
      {/* ═══ LAPIS 1: UNIFIED EXECUTIVE HEADER + MENU DOKUMEN TERPADU ═══ */}
      <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                LIVE MONITORING WITA
              </span>
              {activeBreaches.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab('breaches')}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-[11px] font-bold hover:bg-rose-500/20 transition-colors"
                >
                  <Lock size={11} /> {activeBreaches.length} Pelanggaran Perimeter
                </button>
              )}
              {radarSummary.items.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab('anomalies')}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-[11px] font-bold hover:bg-amber-500/20 transition-colors"
                >
                  <ShieldAlert size={11} /> {radarSummary.items.length} Anomali
                </button>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground">
              Monitoring Presensi &amp; Radar Lapangan
            </h1>
            <p className="text-xs text-muted-foreground">
              Pengawasan kedatangan real-time, validasi biometrik &amp; GPS, serta radar petugas lapangan PT. FAWWAZ RESKI PERWIRA.
            </p>
          </div>

          {/* Primary Clean Actions (Tanpa Deretan Tombol Warna-Warni) */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Popover Dokumen, Rekap & Export Terpadu */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  className="h-9 px-3.5 rounded-xl text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                >
                  <FileSpreadsheet size={14} />
                  <span>Dokumen &amp; Export</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 p-2.5 rounded-2xl shadow-xl border border-border bg-card z-50 space-y-1">
                <p className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Formulir &amp; Matriks Resmi PT FRP
                </p>
                <button
                  type="button"
                  onClick={() => setTimeSheetModalOpen(true)}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-muted/70 text-left text-xs font-semibold text-foreground transition-colors"
                >
                  <FileSpreadsheet size={14} className="text-indigo-600 shrink-0" />
                  <div>
                    <p className="leading-tight">Time Sheet 41-Kolom</p>
                    <p className="text-[10px] text-muted-foreground font-normal">PDF / Excel Tenaga Alih Daya</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setSplMatrixModalOpen(true)}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-muted/70 text-left text-xs font-semibold text-foreground transition-colors"
                >
                  <Sparkles size={14} className="text-amber-600 shrink-0" />
                  <div>
                    <p className="leading-tight">Matriks Input SPL (7-Baris)</p>
                    <p className="text-[10px] text-muted-foreground font-normal">Sinkron DB, PWA &amp; Pengali Lembur</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setLeaveMatrixModalOpen(true)}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-muted/70 text-left text-xs font-semibold text-foreground transition-colors"
                >
                  <CalendarDays size={14} className="text-teal-600 shrink-0" />
                  <div>
                    <p className="leading-tight">Form Rekap Cuti Tahunan</p>
                    <p className="text-[10px] text-muted-foreground font-normal">Kuota cuti &amp; sinkronisasi PWA</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setFinancialRecapModalOpen(true)}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-muted/70 text-left text-xs font-semibold text-foreground transition-colors"
                >
                  <Coins size={14} className="text-emerald-600 shrink-0" />
                  <div>
                    <p className="leading-tight">Rekap Gaji &amp; Lembur Bulanan</p>
                    <p className="text-[10px] text-muted-foreground font-normal">Plafon anggaran &amp; estimasi payroll</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`/admin/lembur?tab=arrears&payrollMonth=${encodeURIComponent(financialStats.nextPayrollMonth)}`)}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-muted/70 text-left text-xs font-semibold text-foreground transition-colors"
                >
                  <ExternalLink size={14} className="text-emerald-600 shrink-0" />
                  <div>
                    <p className="leading-tight">Proses Lembur → Payroll {financialStats.nextPayrollMonthShort}</p>
                    <p className="text-[10px] text-muted-foreground font-normal">Buka halaman manajemen SPKL</p>
                  </div>
                </button>

                <div className="my-1.5 border-t border-border/70" />
                <p className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Unduh Data Tabel Aktif ({filtered.length} Org)
                </p>
                <div className="grid grid-cols-2 gap-1.5 px-1 pb-0.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleExportAllRealtimeExcel}
                    className="h-8 text-xs rounded-xl gap-1.5 border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
                  >
                    <Download size={12} /> Excel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleExportAllRealtimePdf}
                    className="h-8 text-xs rounded-xl gap-1.5 border-rose-500/40 text-rose-700 dark:text-rose-300"
                  >
                    <FileText size={12} /> PDF
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setQrModalOpen(true)}
              className="h-9 px-3 rounded-xl text-xs font-semibold gap-1.5"
            >
              <QrCode size={14} /> QR Dinamis
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={loadData}
              className="h-9 px-3 rounded-xl text-xs font-semibold gap-1.5"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isFetchingMonth ? 'animate-spin' : ''}`} /> Sync
            </Button>
          </div>
        </div>

        {/* Strip Ringkas 1-Baris Plafon Lembur & Estimasi Payroll (Dapat Dibuka Kapan Saja) */}
        <div className="pt-3 border-t border-border/70">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 text-xs">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <div className="flex items-center gap-1.5">
                <Coins size={14} className="text-amber-600 shrink-0" />
                <span className="text-muted-foreground">Lembur {financialStats.curMonthShort}:</span>
                <strong className="font-mono text-foreground">
                  Rp {financialStats.totalOvertimeSpent.toLocaleString('id-ID')}
                </strong>
                <span className="text-muted-foreground font-mono">/ Rp 69 Jt ({financialStats.budgetPercent}%)</span>
                <Badge
                  variant="outline"
                  className={`text-[10px] font-bold px-2 py-0 ${
                    financialStats.isExceeded
                      ? 'border-rose-500/50 bg-rose-500/10 text-rose-700 dark:text-rose-300'
                      : financialStats.isNearLimit
                      ? 'border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                      : 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                  }`}
                >
                  {financialStats.isExceeded ? 'Habis' : financialStats.isNearLimit ? 'Siaga' : 'Aman'}
                </Badge>
              </div>
              <div className="hidden sm:block h-3.5 w-px bg-border" />
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Est. Payroll ({financialStats.curMonthShort}):</span>
                <strong className="font-mono text-foreground">
                  Rp {financialStats.byGroup.all.totalNetSalary.toLocaleString('id-ID')}
                </strong>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowBudgetDetail((v) => !v)}
              className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline self-start md:self-auto shrink-0"
            >
              {showBudgetDetail ? 'Tutup Rincian Plafon & Payroll ▲' : 'Lihat Rincian Plafon & Payroll ▾'}
            </button>
          </div>

          {showBudgetDetail && (
            <div className="mt-3 pt-3 border-t border-border/60 space-y-3 animate-in fade-in duration-150">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                {/* 1. Shipment */}
                <div className="p-3 bg-muted/35 rounded-xl border border-border/80 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
                        <Ship size={13} className="text-blue-600" /> Shipment (47 Org)
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground">Plafon 65 Jt</span>
                    </div>
                    <p className="text-sm font-extrabold font-mono text-foreground">
                      Rp {financialStats.shipmentSpent.toLocaleString('id-ID')}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {financialStats.shipmentEmployeesCount} Org • {financialStats.shipmentHours}j real / {financialStats.shipmentPaidHours}j bayar ({financialStats.shipmentPercent}%)
                    </p>
                    <div className="w-full bg-muted rounded-full h-1.5 mt-2 overflow-hidden">
                      <div
                        className={`h-1.5 rounded-full ${financialStats.isShipmentExceeded ? 'bg-rose-600' : financialStats.isShipmentNearLimit ? 'bg-amber-500' : 'bg-blue-600'}`}
                        style={{ width: `${Math.min(100, financialStats.shipmentPercent)}%` }}
                      />
                    </div>
                  </div>
                  <p className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 mt-2">
                    Sisa: Rp {financialStats.shipmentRemaining.toLocaleString('id-ID')} ({financialStats.shipmentRemainingPercent}%)
                  </p>
                </div>

                {/* 2. Rumah Tangga */}
                <div className="p-3 bg-muted/35 rounded-xl border border-border/80 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
                        <Home size={13} className="text-amber-600" /> Rumah Tangga (33 Org)
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground">Plafon 4 Jt</span>
                    </div>
                    <p className="text-sm font-extrabold font-mono text-foreground">
                      Rp {financialStats.wismaSpent.toLocaleString('id-ID')}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {financialStats.wismaEmployeesCount} Org • {financialStats.wismaHours}j real / {financialStats.wismaPaidHours}j bayar ({financialStats.wismaPercent}%)
                    </p>
                    <div className="w-full bg-muted rounded-full h-1.5 mt-2 overflow-hidden">
                      <div
                        className={`h-1.5 rounded-full ${financialStats.isWismaExceeded ? 'bg-rose-600' : financialStats.isWismaNearLimit ? 'bg-amber-500' : 'bg-amber-600'}`}
                        style={{ width: `${Math.min(100, financialStats.wismaPercent)}%` }}
                      />
                    </div>
                  </div>
                  <p className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 mt-2">
                    Sisa: Rp {financialStats.wismaRemaining.toLocaleString('id-ID')} ({financialStats.wismaRemainingPercent}%)
                  </p>
                </div>

                {/* 3. Total Konsolidasi */}
                <div className="p-3 bg-muted/35 rounded-xl border border-border/80 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
                        <Coins size={13} className="text-emerald-600" /> Total Lembur (80 Org)
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground">Plafon 69 Jt</span>
                    </div>
                    <p className="text-sm font-extrabold font-mono text-amber-600 dark:text-amber-400">
                      Rp {financialStats.totalOvertimeSpent.toLocaleString('id-ID')}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {financialStats.nextOvertimeEmployeesCount} Org • {financialStats.totalOvertimeHours}j real / {financialStats.totalOvertimePaidHours}j bayar ({financialStats.budgetPercent}%)
                    </p>
                    <div className="w-full bg-muted rounded-full h-1.5 mt-2 overflow-hidden">
                      <div
                        className={`h-1.5 rounded-full ${financialStats.isExceeded ? 'bg-rose-600' : financialStats.isNearLimit ? 'bg-amber-500' : 'bg-emerald-600'}`}
                        style={{ width: `${Math.min(100, financialStats.budgetPercent)}%` }}
                      />
                    </div>
                  </div>
                  <p className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 mt-2">
                    Sisa: Rp {financialStats.remainingBudget.toLocaleString('id-ID')} ({financialStats.totalRemainingPercent}%)
                  </p>
                </div>

                {/* 4. Estimasi Payroll */}
                <div className="p-3 bg-muted/35 rounded-xl border border-border/80 flex flex-col justify-between">
                  {(() => {
                    const activeBucket =
                      payrollScopeGroup === 'SHIPMENT'
                        ? financialStats.byGroup.shipment
                        : payrollScopeGroup === 'RUMAH TANGGA'
                        ? financialStats.byGroup.rumahTangga
                        : payrollScopeGroup === 'KARYAWAN TETAP'
                        ? financialStats.byGroup.karyawanTetap
                        : financialStats.byGroup.all;
                    return (
                      <>
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="text-[11px] font-bold text-foreground">Est. Payroll ({financialStats.curMonthShort})</span>
                          <span className="text-[10px] font-semibold text-emerald-600">{payrollScopeGroup}</span>
                        </div>
                        <p className="text-sm font-extrabold font-mono text-foreground">
                          Rp {activeBucket.totalNetSalary.toLocaleString('id-ID')}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
                          {payrollScopeGroup === 'KARYAWAN TETAP'
                            ? `${financialStats.workdaysInMonth} Hr × Rp 140rb • Non-Lembur • BPJS Rp 0`
                            : `Pokok ${(activeBucket.totalBaseSalary / 1e6).toFixed(1)} Jt • OT ${financialStats.arrearsMonthShort}: +${(activeBucket.totalOvertimePay / 1e6).toFixed(1)} Jt • BPJS -${(activeBucket.totalBpjs / 1e6).toFixed(1)} Jt`}
                        </p>
                      </>
                    );
                  })()}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { key: 'ALL' as const, label: `Semua (${financialStats.byGroup.all.employeeCount})`, amount: financialStats.byGroup.all.totalNetSalary },
                    { key: 'SHIPMENT' as const, label: `Shipment (${financialStats.byGroup.shipment.employeeCount})`, amount: financialStats.byGroup.shipment.totalNetSalary },
                    { key: 'RUMAH TANGGA' as const, label: `R. Tangga (${financialStats.byGroup.rumahTangga.employeeCount})`, amount: financialStats.byGroup.rumahTangga.totalNetSalary },
                    { key: 'KARYAWAN TETAP' as const, label: `Tetap (${financialStats.byGroup.karyawanTetap.employeeCount})`, amount: financialStats.byGroup.karyawanTetap.totalNetSalary },
                  ].map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setPayrollScopeGroup(opt.key)}
                      className={`px-2.5 py-1 rounded-lg border font-semibold transition-all ${
                        payrollScopeGroup === opt.key
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-background text-foreground border-border hover:bg-muted'
                      }`}
                    >
                      {opt.label}: <span className="font-mono">Rp {opt.amount.toLocaleString('id-ID')}</span>
                    </button>
                  ))}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setFinancialRecapModalOpen(true)}
                  className="h-7 text-[11px] rounded-lg font-semibold"
                >
                  Buka Rincian Lengkap →
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ LAPIS 2: NAVIGASI TUNGGAL (KELOMPOK + PERIODE + PITA TANGGAL 1–30 TANPA DUPLIKASI) ═══ */}
      <div className="bg-card border border-border rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Single Group Selector */}
          <div className="flex flex-wrap items-center gap-1 p-1 bg-muted/60 rounded-xl border border-border/60 w-fit">
            {[
              { id: 'all' as const, label: `Semua (${categoryMonitoringStats.all.total})` },
              { id: 'SHIPMENT' as const, label: `Shipment (${categoryMonitoringStats.shipment.total})` },
              { id: 'RUMAH TANGGA' as const, label: `Rumah Tangga (${categoryMonitoringStats.rumahTangga.total})` },
              { id: 'KARYAWAN TETAP' as const, label: `Tetap (${categoryMonitoringStats.karyawanTetap.total})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterCategory(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  filterCategory === tab.id
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/70'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Single Period Scope + Single Month Stepper */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-0.5 p-1 bg-muted/60 rounded-xl border border-border/60">
              <button
                type="button"
                onClick={() => { setPeriodScope('today'); setLampiran2ViewMode('daily'); }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  periodScope === 'today' ? 'bg-foreground text-background shadow-xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Harian
              </button>
              <button
                type="button"
                onClick={() => { setPeriodScope('month'); setSelectedDayDate(''); setLampiran2ViewMode('monthly'); }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  periodScope === 'month' ? 'bg-foreground text-background shadow-xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Bulanan
              </button>
              <button
                type="button"
                onClick={() => { setPeriodScope('year'); setSelectedDayDate(''); setLampiran2ViewMode('monthly'); }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  periodScope === 'year' ? 'bg-foreground text-background shadow-xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {currentYear}
              </button>
            </div>

            <div className="flex items-center gap-0.5 p-1 bg-muted/60 rounded-xl border border-border/60">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="w-7 h-7 rounded-lg hover:bg-background flex items-center justify-center text-muted-foreground hover:text-foreground"
                title="Bulan Sebelumnya"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-xs font-bold font-mono text-foreground px-2 min-w-[100px] text-center">
                {selectedMonthLabel}
              </span>
              <button
                type="button"
                onClick={handleNextMonth}
                className="w-7 h-7 rounded-lg hover:bg-background flex items-center justify-center text-muted-foreground hover:text-foreground"
                title="Bulan Berikutnya"
              >
                <ChevronRight size={14} />
              </button>
            </div>

            {targetDayDate !== getTodayDateStr() && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleResetToToday}
                className="h-8 text-[11px] font-bold text-emerald-700 dark:text-emerald-400"
              >
                Hari Ini
              </Button>
            )}
          </div>
        </div>

        {/* Sequential Date Strip (1..30/31) — 1-Klik Ganti Tanggal */}
        {isDailyView && (
          <div className="pt-2.5 border-t border-border/60 space-y-2">
            <div className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <CalendarIcon size={14} className="text-emerald-600 shrink-0" />
                <span className="font-bold text-foreground">
                  {new Date(targetDayDate).toLocaleDateString('id-ID', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
                {targetDayDate === getTodayDateStr() && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                    Hari Ini
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handlePrevDay}
                  className="px-2 py-1 rounded-lg bg-muted/60 hover:bg-muted text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                >
                  ← H-1
                </button>
                <button
                  type="button"
                  onClick={handleNextDay}
                  className="px-2 py-1 rounded-lg bg-muted/60 hover:bg-muted text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                >
                  H+1 →
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-thin">
              {daysInSelectedMonth.map((d) => {
                const isSelected = targetDayDate === d.dateStr;
                const isTodayBtn = d.dateStr === getTodayDateStr();
                const isFutureBtn = d.dateStr > getTodayDateStr();
                const dayOtCount = overtimes.filter((o) => {
                  const oDate = String(o.date || (o as any).overtimeDate || (o as any).overtime_date || '').slice(0, 10);
                  const isApproved = o.status === 'approved' || (o as any).status === 'completed';
                  return oDate === d.dateStr && isApproved && isOfficialFrEmployee(o);
                }).length;

                return (
                  <button
                    key={d.dateStr}
                    type="button"
                    onClick={() => handleSelectDayDate(d.dateStr)}
                    title={`${d.dayName}, ${d.dateStr}${dayOtCount > 0 ? ` • ${dayOtCount} lembur SPKL` : ''}`}
                    className={`relative min-w-[34px] h-10 px-1.5 rounded-xl font-mono text-xs font-bold transition-all shrink-0 flex flex-col items-center justify-center ${
                      isSelected
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : isTodayBtn
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/50 hover:bg-emerald-500/25'
                        : isFutureBtn
                        ? 'bg-muted/25 text-muted-foreground/50 hover:bg-muted/50'
                        : 'bg-muted/50 text-foreground/85 hover:bg-emerald-500/10 hover:text-emerald-700 dark:hover:text-emerald-300'
                    }`}
                  >
                    <span className="text-[8.5px] font-sans uppercase leading-none opacity-75">{d.dayName.slice(0, 2)}</span>
                    <span className="leading-tight mt-0.5">{d.dayNum}</span>
                    {dayOtCount > 0 && (
                      <span
                        className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full text-[8px] font-extrabold flex items-center justify-center ${
                          isSelected ? 'bg-amber-300 text-amber-950' : 'bg-amber-500 text-white'
                        }`}
                      >
                        {dayOtCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ─── KONTROL OPERASIONAL PELABUHAN MACCINI BAJI (Tampil saat filter divisi Maccini Baji aktif) ─── */}
      {(() => {
        if (filterDivision === 'all') return null;
        const selectedDivObj = divisions.find((d) => d.id === filterDivision);
        const isMacciniFiltered = selectedDivObj && (
          selectedDivObj.code === 'PLB' ||
          selectedDivObj.code === 'MMB' ||
          selectedDivObj.name?.toLowerCase().includes('maccini')
        );
        if (!isMacciniFiltered) return null;

        return (
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 rounded-2xl p-3.5 sm:p-4 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-xl shrink-0">
                ⚓
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-xs sm:text-sm tracking-wide text-white">
                    OPERASIONAL PELABUHAN MACCINI BAJI
                  </span>
                  <Badge className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    macciniVesselStatus.status === 'docking'
                      ? 'bg-amber-500 text-amber-950 hover:bg-amber-500'
                      : 'bg-emerald-600 text-white hover:bg-emerald-600'
                  }`}>
                    {macciniVesselStatus.status === 'docking' ? '⚓ KAPAL BERSANDAR' : '🌊 STANDBY ON-CALL'}
                  </Badge>
                  {macciniVesselStatus.updatedAt && (
                    <span className="text-[10px] text-indigo-300 font-mono">
                      (Diperbarui: {new Date(macciniVesselStatus.updatedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WITA oleh {macciniVesselStatus.updatedBy})
                    </span>
                  )}
                </div>
                <p className="text-xs text-indigo-200">
                  {macciniVesselStatus.status === 'docking'
                    ? `Kapal Sandar${macciniVesselStatus.vesselName ? ` (${macciniVesselStatus.vesselName})` : ''} • Seluruh petugas lapangan MMB wajib standby fisik di dermaga (Geofence 500m terkunci aktif).`
                    : 'Nihil Kapal di Dermaga • Petugas diberikan dispensasi sah Standby On-Call di luar radius dermaga tanpa alarm pelanggaran perimeter.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
              <Button
                type="button"
                size="sm"
                onClick={() => handleAdminToggleMacciniStatus('docking')}
                className={`h-8 px-3 text-xs font-bold rounded-xl transition-all ${
                  macciniVesselStatus.status === 'docking'
                    ? 'bg-amber-500 text-amber-950 ring-2 ring-amber-300'
                    : 'bg-slate-800 hover:bg-amber-500 hover:text-amber-950 text-slate-200 border border-slate-700'
                }`}
              >
                ⚓ Lapor Standby Kapal
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => handleAdminToggleMacciniStatus('idle')}
                className={`h-8 px-3 text-xs font-bold rounded-xl transition-all ${
                  macciniVesselStatus.status === 'idle'
                    ? 'bg-emerald-600 text-white ring-2 ring-emerald-300'
                    : 'bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-200 border border-slate-700'
                }`}
              >
                🌊 Standby On-Call
              </Button>
            </div>
          </div>
        );
      })()}

      {/* ═══ LAPIS 3: TAB MODUL UTAMA (SELALU TERLIHAT 1-KLIK) + 6 KPI BERSIH + FILTER SHIFT ═══ */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          {
            id: 'all' as const,
            isActive: !['field_radar', 'breaches', 'anomalies'].includes(activeTab),
            label: 'Presensi Karyawan',
            count: scopedMonitoredList.length,
            icon: Users,
            badgeCls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
          },
          {
            id: 'field_radar' as const,
            isActive: activeTab === 'field_radar',
            label: 'Radar Petugas Lapangan',
            count: fieldAgents.length > 0 ? fieldAgents.length : 3,
            icon: Radio,
            badgeCls: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300',
          },
          {
            id: 'breaches' as const,
            isActive: activeTab === 'breaches',
            label: 'Pelanggaran Perimeter',
            count: activeBreaches.length,
            icon: Lock,
            badgeCls: activeBreaches.length > 0 ? 'bg-rose-500 text-white' : 'bg-muted text-muted-foreground',
          },
          {
            id: 'anomalies' as const,
            isActive: activeTab === 'anomalies',
            label: 'Audit Anomali',
            count: radarSummary.items.length,
            icon: ShieldAlert,
            badgeCls: radarSummary.items.length > 0 ? 'bg-amber-500 text-white' : 'bg-muted text-muted-foreground',
          },
        ].map((mod) => {
          const ModIcon = mod.icon;
          return (
            <button
              key={mod.id}
              type="button"
              onClick={() => setActiveTab(mod.id)}
              className={`px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all ${
                mod.isActive
                  ? 'bg-card border-emerald-500 text-foreground shadow-xs ring-1 ring-emerald-500/30'
                  : 'bg-muted/40 border-border/70 text-muted-foreground hover:text-foreground hover:bg-card'
              }`}
            >
              <ModIcon size={14} className={mod.isActive ? 'text-emerald-600' : ''} />
              <span>{mod.label}</span>
              <span className={`px-1.5 py-0.2 rounded-full font-mono text-[10.5px] font-extrabold ${mod.badgeCls}`}>
                {mod.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 6 KPI Status Kehadiran Bersih (Hanya saat berada di modul Presensi Karyawan) */}
      {!['field_radar', 'breaches', 'anomalies'].includes(activeTab) && (
        <div className="space-y-3">
          {isDailyView ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2.5">
              <button
                type="button"
                onClick={() => { setActiveTab(activeTab === 'present' ? 'all' : 'present'); setFilterStatusCol('all'); }}
                className={`p-3.5 rounded-2xl border text-left transition-all ${
                  activeTab === 'present' ? 'border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500/30' : 'border-border bg-card hover:border-emerald-500/50'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground">
                  <span>Hadir Tepat</span>
                  <CheckCircle2 size={14} className="text-emerald-600" />
                </div>
                <p className="text-2xl font-mono font-black text-emerald-600 dark:text-emerald-400 mt-1">
                  {presentCount} <span className="text-[11px] font-sans font-semibold text-muted-foreground">Org</span>
                </p>
              </button>

              <button
                type="button"
                onClick={() => { setActiveTab(activeTab === 'late' ? 'all' : 'late'); setFilterStatusCol('all'); }}
                className={`p-3.5 rounded-2xl border text-left transition-all ${
                  activeTab === 'late' ? 'border-amber-500 bg-amber-500/10 ring-1 ring-amber-500/30' : 'border-border bg-card hover:border-amber-500/50'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground">
                  <span>Terlambat</span>
                  <Clock size={14} className="text-amber-600" />
                </div>
                <p className="text-2xl font-mono font-black text-amber-600 dark:text-amber-400 mt-1">
                  {lateCount} <span className="text-[11px] font-sans font-semibold text-muted-foreground">Org</span>
                </p>
              </button>

              <button
                type="button"
                onClick={() => { setActiveTab('all'); setFilterStatusCol(filterStatusCol === 'cuti' ? 'all' : 'cuti'); }}
                className={`p-3.5 rounded-2xl border text-left transition-all ${
                  filterStatusCol === 'cuti' || filterStatusCol === 'izin' ? 'border-sky-500 bg-sky-500/10 ring-1 ring-sky-500/30' : 'border-border bg-card hover:border-sky-500/50'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground">
                  <span>Cuti / Izin</span>
                  <CalendarCheck size={14} className="text-sky-600" />
                </div>
                <p className="text-2xl font-mono font-black text-sky-600 dark:text-sky-400 mt-1">
                  {leaveCount} <span className="text-[11px] font-sans font-semibold text-muted-foreground">Org</span>
                </p>
              </button>

              <button
                type="button"
                onClick={() => { setActiveTab('all'); setFilterStatusCol(filterStatusCol === 'off' ? 'all' : 'off'); }}
                className={`p-3.5 rounded-2xl border text-left transition-all ${
                  filterStatusCol === 'off' ? 'border-slate-500 bg-slate-500/10 ring-1 ring-slate-400/40' : 'border-border bg-card hover:border-slate-400'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground">
                  <span>OFF Roster</span>
                  <Coffee size={14} className="text-slate-500" />
                </div>
                <p className="text-2xl font-mono font-black text-slate-700 dark:text-slate-200 mt-1">
                  {offRosterCount} <span className="text-[11px] font-sans font-semibold text-muted-foreground">Org</span>
                </p>
              </button>

              <button
                type="button"
                onClick={() => { setActiveTab(activeTab === 'mangkir' ? 'all' : 'mangkir'); setFilterStatusCol('all'); }}
                className={`p-3.5 rounded-2xl border text-left transition-all ${
                  activeTab === 'mangkir'
                    ? 'border-rose-600 bg-rose-500/15 ring-1 ring-rose-500/40'
                    : mangkirCount > 0
                    ? 'border-rose-300 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/20 hover:border-rose-500'
                    : 'border-border bg-card hover:border-rose-400'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground">
                  <span>Mangkir</span>
                  <UserX size={14} className="text-rose-600" />
                </div>
                <p className="text-2xl font-mono font-black text-rose-600 dark:text-rose-400 mt-1">
                  {mangkirCount} <span className="text-[11px] font-sans font-semibold text-muted-foreground">Org</span>
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('all');
                  const targetFilter = unregisteredCount > 0 ? 'unregistered' : 'pending';
                  setFilterStatusCol(filterStatusCol === targetFilter ? 'all' : targetFilter);
                }}
                className={`p-3.5 rounded-2xl border text-left transition-all ${
                  filterStatusCol === 'unregistered' || filterStatusCol === 'pending'
                    ? 'border-purple-500 bg-purple-500/10 ring-1 ring-purple-500/30'
                    : 'border-border bg-card hover:border-purple-400'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground">
                  <span>Blm Daftar / Tunggu</span>
                  <AlertTriangle size={14} className="text-purple-600" />
                </div>
                <p className="text-2xl font-mono font-black text-purple-600 dark:text-purple-400 mt-1">
                  {unregisteredCount + pendingShiftCount}{' '}
                  <span className="text-[10.5px] font-sans font-medium text-muted-foreground">
                    ({unregisteredCount}•{pendingShiftCount})
                  </span>
                </p>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2.5">
              <div className="p-3.5 rounded-2xl border border-border bg-card">
                <span className="text-[11px] font-bold text-muted-foreground block">Hadir ({selectedMonthLabel})</span>
                <p className="text-2xl font-mono font-black text-emerald-600 dark:text-emerald-400 mt-1">
                  {monthStats.totalHadir} <span className="text-[11px] font-sans font-semibold text-muted-foreground">Hr</span>
                </p>
              </div>
              <div className="p-3.5 rounded-2xl border border-border bg-card">
                <span className="text-[11px] font-bold text-muted-foreground block">Terlambat</span>
                <p className="text-2xl font-mono font-black text-amber-600 dark:text-amber-400 mt-1">
                  {monthStats.totalLate} <span className="text-[11px] font-sans font-semibold text-muted-foreground">Hr</span>
                </p>
              </div>
              <div className="p-3.5 rounded-2xl border border-border bg-card">
                <span className="text-[11px] font-bold text-muted-foreground block">Cuti Tahunan</span>
                <p className="text-2xl font-mono font-black text-sky-600 dark:text-sky-400 mt-1">
                  {monthStats.totalCuti} <span className="text-[11px] font-sans font-semibold text-muted-foreground">Hr</span>
                </p>
              </div>
              <div className="p-3.5 rounded-2xl border border-border bg-card">
                <span className="text-[11px] font-bold text-muted-foreground block">Izin &amp; Sakit</span>
                <p className="text-2xl font-mono font-black text-indigo-600 dark:text-indigo-400 mt-1">
                  {monthStats.totalIzin + monthStats.totalSakit} <span className="text-[11px] font-sans font-semibold text-muted-foreground">Hr</span>
                </p>
              </div>
              <div className="p-3.5 rounded-2xl border border-border bg-card">
                <span className="text-[11px] font-bold text-muted-foreground block">Mangkir / Alpa</span>
                <p className="text-2xl font-mono font-black text-rose-600 dark:text-rose-400 mt-1">
                  {monthStats.totalMangkir} <span className="text-[11px] font-sans font-semibold text-muted-foreground">Hr</span>
                </p>
              </div>
              <div className="p-3.5 rounded-2xl border border-amber-400/40 bg-amber-500/5">
                <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 block">Total Lembur SPKL</span>
                <p className="text-2xl font-mono font-black text-amber-600 dark:text-amber-400 mt-1">
                  {monthStats.totalOtHours} <span className="text-[11px] font-sans font-semibold text-muted-foreground">Jam ({monthStats.totalOtCount}x)</span>
                </p>
              </div>
            </div>
          )}

          {/* Baris Pill Filter Shift Cepat 1-Baris (Menggantikan 6 Kartu Besar Duplikat) */}
          {isDailyView && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-[11px] font-bold text-muted-foreground mr-1">Filter Shift:</span>
              {[
                { id: 'all', label: 'Semua Shift', sub: `${scopedMonitoredList.length}` },
                { id: 'P', label: 'Shift I (07:30)', sub: `${dailyShiftBreakdown.shift1.present}/${dailyShiftBreakdown.shift1.total}` },
                { id: 'S', label: 'Shift II (15:30)', sub: `${dailyShiftBreakdown.shift2.present}/${dailyShiftBreakdown.shift2.total}` },
                { id: 'M', label: 'Shift III (22:30)', sub: `${dailyShiftBreakdown.shift3.present}/${dailyShiftBreakdown.shift3.total}` },
                { id: 'DAY', label: 'Day Shift', sub: `${dailyShiftBreakdown.dayShift.present}/${dailyShiftBreakdown.dayShift.total}` },
                { id: 'OFF', label: 'OFF / Cuti', sub: `${dailyShiftBreakdown.off.total}` },
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setFilterShift(filterShift === s.id ? 'all' : s.id)}
                  className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-semibold transition-all flex items-center gap-1.5 ${
                    filterShift === s.id
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-card border-border text-foreground hover:bg-muted/50'
                  }`}
                >
                  <span>{s.label}</span>
                  <span className={`font-mono text-[10.5px] font-bold ${filterShift === s.id ? 'text-emerald-100' : 'text-muted-foreground'}`}>
                    {s.sub}
                  </span>
                </button>
              ))}

              <button
                type="button"
                onClick={() => setFilterOvertimeCol(filterOvertimeCol === 'has_ot' ? 'all' : 'has_ot')}
                className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-semibold transition-all flex items-center gap-1.5 ${
                  filterOvertimeCol === 'has_ot'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300 hover:bg-amber-500/20'
                }`}
              >
                <Flame size={12} />
                <span>Ada Lembur SPKL</span>
                <span className="font-mono font-bold">
                  {dailyOvertimeStats.totalCount} Org ({dailyOvertimeStats.totalHours}j)
                </span>
              </button>
            </div>
          )}

          {/* ═══ LAPIS 4: TOOLBAR TABEL RAMPING 1-BARIS (ZERO DUPLIKASI FILTER) ═══ */}
          <div className="bg-card border border-border rounded-2xl p-3 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 shadow-2xs">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative flex-1 min-w-[200px] max-w-xs">
                <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  placeholder="Cari nama atau NIP..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 text-xs rounded-xl h-9"
                />
              </div>

              <div className="w-[180px]">
                <Select value={filterDivision} onValueChange={setFilterDivision}>
                  <SelectTrigger className="text-xs rounded-xl h-9">
                    <SelectValue placeholder="Semua Divisi" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Divisi</SelectItem>
                    {divisions.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="w-[165px]">
                <Select value={filterStatusCol} onValueChange={setFilterStatusCol}>
                  <SelectTrigger className="text-xs rounded-xl h-9">
                    <SelectValue placeholder="Semua Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Status</SelectItem>
                    <SelectItem value="present">Hadir Tepat</SelectItem>
                    <SelectItem value="late">Terlambat</SelectItem>
                    <SelectItem value="cuti">Cuti Tahunan</SelectItem>
                    <SelectItem value="izin">Izin / Sakit</SelectItem>
                    <SelectItem value="mangkir">Mangkir / Alpa</SelectItem>
                    <SelectItem value="off">OFF / Libur</SelectItem>
                    <SelectItem value="pending">Menunggu Shift</SelectItem>
                    <SelectItem value="unregistered">Belum Daftar Wajah</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(filterShift !== 'all' || filterStatusCol !== 'all' || filterOvertimeCol !== 'all' || filterDivision !== 'all' || filterCategory !== 'all' || searchQuery || activeTab !== 'all') && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setActiveTab('all');
                    setFilterShift('all');
                    setFilterStatusCol('all');
                    setFilterOvertimeCol('all');
                    setFilterDivision('all');
                    setFilterCategory('all');
                    setSearchQuery('');
                  }}
                  className="h-9 px-2.5 text-xs rounded-xl text-rose-600 hover:bg-rose-500/10 font-semibold gap-1"
                >
                  <X size={13} /> Reset
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0 justify-between lg:justify-end">
              <span className="text-[11px] font-mono text-muted-foreground">
                <strong className="text-foreground">{filtered.length}</strong> / {scopedMonitoredList.length} Org
              </span>

              {/* Popover Visibilitas Kolom */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 px-2.5 text-xs rounded-xl gap-1.5 font-semibold"
                    title="Atur kolom tabel"
                  >
                    <SlidersHorizontal size={13} />
                    <span className="hidden sm:inline">Kolom</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-60 p-3 rounded-2xl shadow-xl border border-border bg-card z-50">
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between pb-1.5 border-b border-border/70">
                      <span className="text-xs font-bold text-foreground">Visibilitas Kolom</span>
                      <button
                        type="button"
                        onClick={() => updateVisibleColumns(() => ({
                          category: true, division: true, shift: true, status: true,
                          clockIn: true, clockOut: true, overtime: true, security: true, actions: true,
                        }))}
                        className="text-[10px] text-primary hover:underline font-semibold"
                      >
                        Reset
                      </button>
                    </div>
                    <div className="space-y-1.5 text-xs">
                      {[
                        { key: 'category' as const, label: 'Kelompok / Kategori' },
                        { key: 'division' as const, label: 'Divisi & Jabatan' },
                        { key: 'shift' as const, label: 'Jadwal Shift' },
                        { key: 'status' as const, label: 'Status Kehadiran' },
                        { key: 'clockIn' as const, label: 'Jam Masuk' },
                        { key: 'clockOut' as const, label: 'Jam Pulang' },
                        { key: 'overtime' as const, label: 'Lembur (Jam)' },
                        { key: 'security' as const, label: 'Verifikasi Keamanan' },
                        { key: 'actions' as const, label: 'Tindakan & Laporan' },
                      ].map((col) => (
                        <label key={col.key} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-1 rounded-lg">
                          <Checkbox
                            checked={visibleColumns[col.key]}
                            onCheckedChange={(v) => updateVisibleColumns((p) => ({ ...p, [col.key]: Boolean(v) }))}
                          />
                          <span className="text-foreground font-medium">{col.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {/* View Mode Toggle */}
              <div className="flex items-center gap-0.5 bg-muted/60 p-1 rounded-xl border border-border">
                <Button
                  type="button"
                  variant={viewMode === 'table' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 px-2 text-xs rounded-lg gap-1"
                  onClick={() => setViewMode('table')}
                >
                  <TableProperties size={13} />
                  <span className="hidden sm:inline">Tabel</span>
                </Button>
                <Button
                  type="button"
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 px-2 text-xs rounded-lg gap-1"
                  onClick={() => setViewMode('grid')}
                >
                  <LayoutGrid size={13} />
                  <span className="hidden sm:inline">Kartu</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── CONDITIONAL VIEW: ANOMALY RADAR OR PERIMETER BREACHES OR DATAGRID/CARDS ── */}
      {activeTab === 'anomalies' ? (
        <div className="space-y-4">
          <div className="p-4 bg-card border border-border rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-muted text-foreground border border-border">
                <ShieldAlert size={20} className="text-rose-600" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground">
                  Pusat Audit Integritas Presensi
                </h2>
                <p className="text-xs text-muted-foreground">
                  Deteksi kepatuhan perangkat ganda (titip absen), anomali koordinat batas perimeter, dan beban jam kerja berlebih.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-rose-600 text-white font-mono text-xs">
                {radarSummary.criticalCount + radarSummary.highCount} Prioritas Tinggi
              </Badge>
              <Badge variant="outline" className="font-mono text-xs border-border">
                {radarSummary.totalScanned} Total Dipindai
              </Badge>
            </div>
          </div>

          {radarSummary.items.length === 0 ? (
            <Card className="rounded-2xl border-dashed border-emerald-500/40 bg-emerald-500/5 text-center p-8">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center mb-3">
                <ShieldCheck size={26} />
              </div>
              <h3 className="font-bold text-sm text-foreground">Integritas Kehadiran Optimal</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Tidak ada anomali atau indikasi kecurangan perangkat yang terdeteksi pada seluruh presensi karyawan hari ini.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {radarSummary.items.map((item) => {
                const isCritical = item.severity === 'critical';
                const isHigh = item.severity === 'high';
                return (
                  <Card
                    key={item.userId}
                    className={`rounded-2xl border p-4 shadow-xs space-y-3 transition-all ${
                      isCritical
                        ? 'border-rose-500/40 bg-rose-500/5'
                        : isHigh
                        ? 'border-amber-500/40 bg-amber-500/5'
                        : 'border-border bg-card'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${
                            isCritical
                              ? 'bg-rose-600 text-white'
                              : isHigh
                              ? 'bg-amber-600 text-white'
                              : 'bg-muted text-foreground'
                          }`}
                        >
                          {item.userName.charAt(0)}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-foreground">{item.userName}</p>
                          <p className="text-[11px] text-muted-foreground font-mono">
                            {item.nip} • {item.divisionName}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[10px] uppercase tracking-wider font-bold ${
                          isCritical
                            ? 'bg-rose-600 text-white border-transparent'
                            : isHigh
                            ? 'bg-amber-500 text-white border-transparent'
                            : 'bg-muted text-muted-foreground border-border'
                        }`}
                      >
                        Skor Risiko: {item.overallRiskScore}
                      </Badge>
                    </div>

                    {/* Breakdown Sub-Risiko */}
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/70 text-center">
                      <div className="p-2 rounded-xl bg-background/60 border border-border/60">
                        <p className="text-[10px] text-muted-foreground">Kecurangan Perangkat</p>
                        <p className={`text-xs font-bold font-mono mt-0.5 ${item.deviceCollisionScore > 40 ? 'text-rose-600' : 'text-foreground'}`}>
                          {item.deviceCollisionScore}%
                        </p>
                      </div>
                      <div className="p-2 rounded-xl bg-background/60 border border-border/60">
                        <p className="text-[10px] text-muted-foreground">Radius Perimeter</p>
                        <p className={`text-xs font-bold font-mono mt-0.5 ${item.geofenceAnomalyScore > 40 ? 'text-amber-600' : 'text-foreground'}`}>
                          {item.geofenceAnomalyScore}%
                        </p>
                      </div>
                      <div className="p-2 rounded-xl bg-background/60 border border-border/60">
                        <p className="text-[10px] text-muted-foreground">Beban Lembur</p>
                        <p className={`text-xs font-bold font-mono mt-0.5 ${item.burnoutRiskScore > 40 ? 'text-orange-600' : 'text-foreground'}`}>
                          {item.burnoutRiskScore}%
                        </p>
                      </div>
                    </div>

                    {/* Detailed Reason Explanations */}
                    <div className="p-2.5 rounded-xl bg-muted/40 border border-border/70 space-y-1 text-xs">
                      {item.reasons.map((r, i) => (
                        <p key={i} className="text-muted-foreground flex items-start gap-1.5 leading-relaxed">
                          <span className="text-rose-500 font-bold">•</span>
                          <span>{r}</span>
                        </p>
                      ))}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      ) : activeTab === 'breaches' ? (
        /* ── DEDICATED PERIMETER BREACH DISCIPLINE AUDIT DATAGRID ── */
        <div className="space-y-4">
          <div className="p-4 bg-card border border-border rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 border border-rose-500/20">
                <ShieldAlert size={20} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground">
                  Audit Pelanggaran Perimeter Kerja & Kunci Presensi Pulang
                </h2>
                <p className="text-xs text-muted-foreground">
                  Daftar staf yang terdeteksi keluar dari batas radius kantor saat jam kerja aktif tanpa izin. Presensi kepulangan otomatis dinonaktifkan demi integritas data kinerja.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-rose-600 text-white font-mono text-xs">
                {activeBreaches.length} Checkout Terkunci
              </Badge>
              <Badge variant="outline" className="font-mono text-xs border-border">
                {perimeterViolations.length} Total Riwayat
              </Badge>
            </div>
          </div>

          {perimeterViolations.length === 0 ? (
            <Card className="rounded-2xl border-dashed border-emerald-500/40 bg-emerald-500/5 text-center p-8">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center mb-3">
                <ShieldCheck size={26} />
              </div>
              <h3 className="font-bold text-sm text-foreground">Disiplin Perimeter 100% Terjaga</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Tidak ada karyawan yang terdeteksi meninggalkan area kerja kantor divisi saat jam kerja berlangsung.
              </p>
            </Card>
          ) : (
            <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow className="text-xs">
                    <TableHead className="w-12 text-center">#</TableHead>
                    <TableHead>Karyawan</TableHead>
                    <TableHead>Divisi</TableHead>
                    <TableHead>Waktu Terdeteksi Keluar</TableHead>
                    <TableHead>Jarak Di Luar Radius</TableHead>
                    <TableHead>Status Kunci</TableHead>
                    <TableHead>Catatan Pelanggaran</TableHead>
                    <TableHead className="text-right">Tindakan Otorisasi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {perimeterViolations.map((v, idx) => {
                    const u = users.find((usr) => usr.id === v.userId);
                    const div = divisions.find((d) => d.id === v.divisionId);
                    const isLocked = v.status === 'active';
                    return (
                      <TableRow key={v.id} className="text-xs hover:bg-muted/30">
                        <TableCell className="text-center font-mono text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-bold text-foreground">{u?.fullName || v.userName || 'Karyawan'}</p>
                            <p className="text-[11px] text-muted-foreground font-mono">{u?.nip || v.nip || '-'}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium text-foreground">{div?.name || v.divisionName || '-'}</span>
                        </TableCell>
                        <TableCell className="font-mono">
                          {new Date(v.detectedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} WITA
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] gap-1 border-rose-500/30 text-rose-600 bg-rose-500/10 font-mono">
                            <MapPin size={10} /> {Math.round(v.distanceMeters)} meter
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {isLocked ? (
                            <Badge className="bg-rose-600 text-white text-[10px] gap-1">
                              <Lock size={10} /> TERKUNCI
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px] gap-1">
                              <CheckCircle2 size={10} /> DIBUKA KUNCI
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[220px]">
                          <p className="truncate text-muted-foreground" title={v.notes}>
                            {v.notes}
                          </p>
                          {v.resolutionNotes && (
                            <p className="text-[10px] text-emerald-600 truncate mt-0.5" title={v.resolutionNotes}>
                              Otorisasi: {v.resolutionNotes} ({v.resolvedByName || v.resolvedBy})
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {isLocked ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedBreach(v);
                                setUnlockReason('');
                                setUnlockModalOpen(true);
                              }}
                              className="h-7 px-2.5 text-xs rounded-xl gap-1 border-rose-500/40 text-rose-600 hover:bg-rose-500/10 font-semibold"
                            >
                              <Unlock size={12} /> Buka Kunci Presensi
                            </Button>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">Telah Disetujui</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      ) : activeTab === 'field_radar' ? (
        /* ── FIELD SENTINEL & DYNAMIC GEOFENCE RADAR COMMAND CENTER ── */
        <div className="space-y-4">
          {/* Header Banner */}
          <div className="p-4 bg-gradient-to-r from-indigo-900/90 via-slate-900 to-indigo-950 text-white rounded-2xl border border-indigo-700/40 shadow-md">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="p-2.5 rounded-xl bg-indigo-600/30 border border-indigo-400/30 text-indigo-300 relative">
                  <Crosshair className="w-6 h-6 animate-pulse" />
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-white tracking-wide">
                      Field Sentinel &amp; Dynamic Geofence Radar
                    </h2>
                    <Badge className="bg-indigo-500/20 text-indigo-200 border-indigo-400/30 text-[10px] font-mono">
                      LIVE RADAR
                    </Badge>
                  </div>
                  <p className="text-xs text-indigo-200/80 mt-0.5">
                    Pemantauan ketat &amp; presisi GPS live untuk petugas lapangan PT. FAWWAZ RESKI PERWIRA. Sinkronisasi radius dinamis dan bukti foto forensik kriptografis.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={loadFieldAgents}
                  className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs h-8 rounded-xl gap-1.5"
                >
                  <RotateCw className="w-3.5 h-3.5" /> Segarkan Radar
                </Button>
              </div>
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {(fieldAgents.length > 0 ? fieldAgents : users.filter((u) => u.isFieldSentinelEnabled)).map((agent: any) => {
              const isMobileSpecialist = isMobileOnlineOfficer(agent);
              const isMaccini = isMacciniBajiOfficer(agent);
              const isMacciniOnCall = isMaccini && macciniVesselStatus.status !== 'docking';
              const isBreached = agent.isOutOfBounds && !isMobileSpecialist && !isMacciniOnCall;
              const pingTime = agent.lastKnownPingAt ? new Date(agent.lastKnownPingAt).getTime() : null;
              const pingAgeMinutes = pingTime ? Math.floor((Date.now() - pingTime) / 60000) : null;
              const isLiveNow = pingAgeMinutes !== null && pingAgeMinutes <= 15;
              const isStale = pingAgeMinutes !== null && pingAgeMinutes > 15;
              const hasPing = Boolean(agent.lastKnownPingAt);
              const latestCheck = agent.latestPatrolCheck;

              return (
                <Card
                  key={agent.id}
                  className={`rounded-2xl border transition-all overflow-hidden shadow-xs flex flex-col justify-between ${
                    isBreached
                      ? 'border-rose-500/60 bg-rose-500/5 ring-1 ring-rose-500/30'
                      : isLiveNow
                      ? 'border-emerald-500/40 bg-card hover:border-emerald-500/60'
                      : isStale
                      ? 'border-amber-500/30 bg-card'
                      : 'border-border bg-card'
                  }`}
                >
                  <div className="p-4 space-y-3.5 flex-1">
                    {/* Agent Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          {(() => {
                            const rawAgentPhoto = agent.avatarUrl || agent.facePhotoUrl || (agent as any).faceEnrolledPhoto || (agent as any).face_enrolled_photo || (agent as any).face_photo_url;
                            const agentPhoto = (typeof rawAgentPhoto === 'string' && (rawAgentPhoto.startsWith('data:image/') || rawAgentPhoto.startsWith('http') || rawAgentPhoto.startsWith('/')))
                              ? rawAgentPhoto
                              : null;
                            return agentPhoto ? (
                              <img
                                src={agentPhoto}
                                alt={agent.fullName}
                                className="w-11 h-11 rounded-full object-cover border-2 border-indigo-500/40"
                                onError={(e) => {
                                  const target = e.currentTarget;
                                  target.style.display = 'none';
                                  const fallback = target.nextElementSibling;
                                  if (fallback) (fallback as HTMLElement).style.display = 'flex';
                                }}
                              />
                            ) : null;
                          })()}
                          <div
                            className="w-11 h-11 rounded-full bg-indigo-600/20 text-indigo-700 dark:text-indigo-300 font-bold flex items-center justify-center border border-indigo-500/30 text-sm"
                            style={{
                              display: (() => {
                                const rawAgentPhoto = agent.avatarUrl || agent.facePhotoUrl || (agent as any).faceEnrolledPhoto || (agent as any).face_enrolled_photo || (agent as any).face_photo_url;
                                return (typeof rawAgentPhoto === 'string' && (rawAgentPhoto.startsWith('data:image/') || rawAgentPhoto.startsWith('http') || rawAgentPhoto.startsWith('/'))) ? 'none' : 'flex';
                              })(),
                            }}
                          >
                            {agent.fullName?.charAt(0) || 'P'}
                          </div>
                          <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-card ${
                            isBreached ? 'bg-rose-500 animate-ping' : isLiveNow ? 'bg-emerald-500 animate-pulse' : isStale ? 'bg-amber-500' : 'bg-slate-400'
                          }`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h3 className="font-bold text-sm text-foreground">{agent.fullName}</h3>
                            <Badge variant="outline" className="text-[9px] font-mono border-indigo-300 text-indigo-600 dark:text-indigo-400">
                              SENTINEL
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground font-mono">
                            {agent.nip || agent.nrp || 'FRP-FIELD'} • {agent.divisionName || 'Operasional Lapangan'}
                          </p>
                        </div>
                      </div>

                      {/* Status Tag */}
                      {isBreached ? (
                        <Badge className="bg-rose-600 text-white text-[10px] font-bold gap-1 animate-pulse">
                          <AlertTriangle size={11} /> KELUAR ({Math.round(agent.outOfBoundsDistance || 0)}m)
                        </Badge>
                      ) : isMacciniOnCall ? (
                        <Badge className="bg-emerald-600 text-white text-[10px] font-bold gap-1 shadow-xs">
                          <CheckCircle2 size={11} /> 🌊 STANDBY ON-CALL
                        </Badge>
                      ) : isMaccini && macciniVesselStatus.status === 'docking' ? (
                        <Badge className="bg-amber-600 text-white text-[10px] font-bold gap-1 shadow-xs">
                          <CheckCircle2 size={11} /> ⚓ STANDBY DERMAGA
                        </Badge>
                      ) : isMobileSpecialist ? (
                        <Badge className="bg-sky-600 text-white text-[10px] font-bold gap-1">
                          <Wifi size={11} /> WFA SAH (MOBILE)
                        </Badge>
                      ) : isLiveNow ? (
                        <Badge className="bg-emerald-600 text-white text-[10px] font-semibold gap-1">
                          <CheckCircle2 size={11} /> DI PERIMETER
                        </Badge>
                      ) : isStale ? (
                        <Badge className="bg-amber-600/90 text-white text-[10px] font-medium gap-1">
                          <Clock size={11} /> OFFLINE ({pingAgeMinutes < 60 ? `${pingAgeMinutes}m lalu` : `${Math.floor(pingAgeMinutes / 60)}j lalu`})
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground text-[10px] font-mono">
                          MENUNGGU PING
                        </Badge>
                      )}
                    </div>

                    {/* Geofence Multi-Pos Perimeter Info */}
                    <div className="p-3 bg-muted/40 rounded-xl border border-border/70 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground flex items-center gap-1 font-medium">
                          <MapPin size={12} className="text-indigo-600" /> Pos Aktif Terdeteksi:
                        </span>
                        <span className="font-bold text-foreground truncate max-w-[190px]">
                          {isMacciniOnCall ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                              🌊 Maccini Baji (Standby On-Call)
                            </span>
                          ) : isLiveNow && agent.currentActivePostName ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                              🟢 {agent.currentActivePostName} (Live)
                            </span>
                          ) : isMobileSpecialist ? (
                            <span className="text-sky-600 dark:text-sky-400 font-bold flex items-center gap-1">
                              📶 Hub Jaringan / Mobile WFA (Sah)
                            </span>
                          ) : isBreached ? (
                            <span className="text-rose-600 dark:text-rose-400 font-bold">
                              🔴 Di Luar Radius Pos
                            </span>
                          ) : agent.currentActivePostName && isStale ? (
                            <span className="text-amber-600 dark:text-amber-400 font-medium">
                              🟠 Terakhir: {agent.currentActivePostName}
                            </span>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500 font-normal italic">
                              Menunggu Sinyal GPS
                            </span>
                          )}
                        </span>
                      </div>

                      {/* Jadwal Jam Kerja Khusus */}
                      <div className="flex items-center justify-between font-mono text-[11px] pt-1 border-t border-border/50">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Clock size={11} className="text-emerald-600" /> Jam Kerja &amp; Toleransi:
                        </span>
                        <Badge
                          variant="outline"
                          onClick={() => {
                            setAssignLocationUser(agent);
                            setAssignLocationTab('schedule');
                            setAssignLocationModalOpen(true);
                          }}
                          className="text-[10px] font-mono py-0.5 px-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 cursor-pointer transition-colors"
                          title="Klik untuk mengubah Jam Masuk, Jam Pulang & Toleransi Keterlambatan"
                        >
                          ⏰ {agent.customStartTime || agent.shiftStartTime || '07:30'} - {agent.customEndTime || agent.shiftEndTime || '16:30'} WITA (Tol: {agent.lateToleranceMinutes ?? 15}m)
                        </Badge>
                      </div>

                      {/* Bank Pos Badges */}
                      {agent.assignedPosts && agent.assignedPosts.length > 0 ? (
                        <div className="space-y-1 pt-1 border-t border-border/60">
                          <span className="text-[10px] text-muted-foreground block font-medium">
                            Bank Pos Terdaftar ({agent.assignedPosts.length} Titik Sah):
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {agent.assignedPosts.map((p: any) => (
                              <Badge
                                key={p.id}
                                variant="outline"
                                className={`text-[9px] font-mono py-0 px-1.5 ${
                                  isLiveNow && agent.currentActivePostName === p.postName
                                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 font-bold'
                                    : p.isRelief
                                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300 font-bold'
                                    : 'bg-muted/40 border-border text-muted-foreground'
                                }`}
                                title={`${p.postName} (Radius: ${p.radiusMeters}m)${p.isRelief ? ` [Relief Duty s/d ${p.reliefUntil || 'Selesai'}]` : ''}`}
                              >
                                {p.isRelief ? '⭐ ' : ''}{p.postCode}: {p.postName}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between font-mono text-[11px]">
                          <span className="text-muted-foreground">Radius Aman:</span>
                          <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                            {agent.assignedRadiusMeters || 150} Meter
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Live Position Radar Ping */}
                    <div className="p-3 rounded-xl border border-indigo-500/20 bg-indigo-50/30 dark:bg-indigo-950/20 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-indigo-700 dark:text-indigo-300 font-semibold flex items-center gap-1">
                          <Radio size={12} className={isLiveNow ? 'animate-pulse text-emerald-500' : isStale ? 'text-amber-500' : 'text-slate-400'} />
                          Live Sinyal GPS:
                        </span>
                        <span className="text-[11px] font-mono text-muted-foreground">
                          {agent.lastKnownPingAt ? (
                            <>
                              {new Date(agent.lastKnownPingAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} WITA
                              {isLiveNow && <span className="text-emerald-500 font-semibold ml-1">(Live)</span>}
                              {isStale && <span className="text-amber-600 dark:text-amber-400 font-medium ml-1">({pingAgeMinutes < 60 ? `${pingAgeMinutes}m lalu` : `${Math.floor(pingAgeMinutes / 60)}j lalu`})</span>}
                            </>
                          ) : 'Belum terdeteksi'}
                        </span>
                      </div>
                      {agent.lastKnownLatitude && agent.lastKnownPingAt ? (
                        <div className="flex items-center justify-between text-[11px] font-mono">
                          <span className="text-muted-foreground">{isLiveNow ? 'Posisi Live:' : 'Posisi Terakhir:'}</span>
                          <span className="font-bold text-foreground">
                            {agent.lastKnownLatitude.toFixed(6)}, {agent.lastKnownLongitude?.toFixed(6)}
                          </span>
                        </div>
                      ) : (
                        <p className="text-[11px] text-muted-foreground italic">
                          Aplikasi ponsel petugas belum mengirim sinyal GPS aktif.
                        </p>
                      )}
                      {agent.lastKnownAccuracy && agent.lastKnownPingAt && (
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>Akurasi Hardware:</span>
                          <span className="font-mono">±{Math.round(agent.lastKnownAccuracy)} Meter</span>
                        </div>
                      )}
                    </div>

                    {/* Latest Forensic Watermark Photo Thumbnail */}
                    {(() => {
                      const photoSrc = latestCheck?.photoUrl || latestCheck?.watermarked_photo_url || latestCheck?.watermarkedPhotoUrl || latestCheck?.photo_url;
                      const matchScore = latestCheck?.faceMatchScore
                        ? (latestCheck.faceMatchScore > 1 ? Math.round(latestCheck.faceMatchScore) : Math.round(latestCheck.faceMatchScore * 100))
                        : Math.round(latestCheck?.biometricScore || latestCheck?.biometric_score || 98);
                      const checkedTime = latestCheck?.checkedAt || latestCheck?.createdAt || latestCheck?.created_at;
                      const locName = latestCheck?.locationName || latestCheck?.location_name || agent.assignedLocationName || 'Pos Lapangan';

                      return (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium text-foreground flex items-center gap-1">
                              <FileImage size={12} className="text-primary" /> Bukti Selfie / Spot-Check:
                            </span>
                            {photoSrc && (
                              <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30 bg-emerald-500/10 font-mono">
                                {matchScore}% Wajah Cocok
                              </Badge>
                            )}
                          </div>

                          {photoSrc ? (
                            <div
                              onClick={() => {
                                setPreviewWatermarkData({
                                  ...latestCheck,
                                  photoUrl: photoSrc,
                                  userName: agent.fullName,
                                  userNip: agent.nip,
                                  locationName: locName,
                                  time: checkedTime ? new Date(checkedTime).toISOString() : new Date().toISOString(),
                                  isWithinRadius: latestCheck?.isWithinRadius !== false && latestCheck?.is_within_radius !== false,
                                  distance: latestCheck?.distanceFromTarget || latestCheck?.distance_from_target || latestCheck?.distance || 0,
                                });
                                setPreviewWatermarkModalOpen(true);
                              }}
                              className="relative rounded-xl overflow-hidden border border-border group cursor-pointer aspect-video bg-black/40 hover:border-primary transition-all shadow-xs"
                            >
                              <img
                                src={photoSrc}
                                alt="Bukti Selfie Forensik"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent flex flex-col justify-end p-2 text-white">
                                <p className="text-[11px] font-bold truncate">
                                  {locName}
                                </p>
                                <p className="text-[10px] text-zinc-300 font-mono flex items-center justify-between">
                                  <span>{checkedTime ? new Date(checkedTime).toLocaleTimeString('id-ID') : ''} WITA</span>
                                  <span className="underline text-indigo-300 group-hover:text-white font-semibold">Perbesar Bukti &rarr;</span>
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="p-3 rounded-xl border border-dashed border-border/80 text-center text-xs text-muted-foreground bg-muted/20">
                              Belum ada foto selfie terverifikasi.
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Action Buttons */}
                  <div className="p-3 border-t border-border bg-muted/20 flex flex-wrap items-center gap-1.5">
                    <Button
                      size="sm"
                      disabled={requestingAgentId === agent.id}
                      onClick={async () => {
                        setRequestingAgentId(agent.id);
                        try {
                          await fieldSentinelService.requestSpotCheck(agent.id, 'Verifikasi Lapangan Mendadak dari Pimpinan / Superadmin');
                          toast.success(`Instruksi verifikasi spot-check telah dikirim ke perangkat ${agent.fullName}. Layar kamera forensik otomatis muncul pada HP petugas.`);
                        } catch (err: any) {
                          toast.error(err.message || 'Gagal mengirim instruksi spot-check.');
                        } finally {
                          setRequestingAgentId(null);
                        }
                      }}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs h-8 gap-1 font-semibold"
                    >
                      {requestingAgentId === agent.id ? (
                        <>Mengirim...</>
                      ) : (
                        <>
                          <Crosshair size={13} /> Minta Lapor Wajah
                        </>
                      )}
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setAssignLocationUser(agent);
                        setAssignLocationTab('schedule');
                        setAssignLocationModalOpen(true);
                      }}
                      className="rounded-xl text-xs h-8 gap-1 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 font-medium"
                      title="Atur Jam Masuk, Jam Pulang & Toleransi Keterlambatan"
                    >
                      <Clock size={13} /> Jam Kerja
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setAssignLocationUser(agent);
                        setAssignLocationTab('posts');
                        setAssignLocationModalOpen(true);
                      }}
                      className="rounded-xl text-xs h-8 gap-1 border-indigo-500/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/10"
                      title="Buka Bank Pos Tugas Lapangan (Multi-Titik A, B, C)"
                    >
                      <MapPin size={13} /> Bank Pos
                    </Button>

                    {(agent.lastKnownLatitude || agent.assignedLatitude) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const lat = agent.lastKnownLatitude || agent.assignedLatitude;
                          const lng = agent.lastKnownLongitude || agent.assignedLongitude;
                          window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
                        }}
                        className="rounded-xl text-xs h-8 p-2 text-muted-foreground hover:text-foreground"
                        title="Buka Peta Google Maps"
                      >
                        <ExternalLink size={13} />
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      ) : viewMode === 'table' ? (
        /* ── CLEAN & PROFESSIONAL ENTERPRISE DATAGRID / TABLE ── */
        <div className="rounded-2xl border border-border/80 bg-card shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="hover:bg-transparent border-b border-border/70 text-xs">
                  <TableHead className="w-12 text-center font-semibold text-muted-foreground">#</TableHead>
                  <TableHead className="min-w-[200px] font-semibold text-muted-foreground">Karyawan</TableHead>
                  {visibleColumns.category && <TableHead className="min-w-[140px] font-semibold text-muted-foreground">Kelompok</TableHead>}
                  {visibleColumns.division && <TableHead className="min-w-[140px] font-semibold text-muted-foreground">Divisi &amp; Jabatan</TableHead>}
                  {visibleColumns.shift && <TableHead className="min-w-[125px] text-center font-semibold text-muted-foreground">Jadwal Shift</TableHead>}
                  {visibleColumns.status && (
                    <TableHead className="min-w-[125px] text-center font-semibold text-muted-foreground">
                      {isDailyView ? 'Status Kehadiran' : 'Total Kehadiran'}
                    </TableHead>
                  )}
                  {visibleColumns.clockIn && (
                    <TableHead className="min-w-[100px] text-center font-semibold text-muted-foreground">
                      {isDailyView ? 'Jam Masuk' : 'Frekuensi Terlambat'}
                    </TableHead>
                  )}
                  {visibleColumns.clockOut && (
                    <TableHead className="min-w-[100px] text-center font-semibold text-muted-foreground">
                      {isDailyView ? 'Jam Pulang' : 'Denda Payroll'}
                    </TableHead>
                  )}
                  {visibleColumns.overtime && (
                    <TableHead className="min-w-[120px] text-center font-semibold text-muted-foreground">
                      {isDailyView ? 'Lembur (Jam) Live' : 'Total Lembur'}
                    </TableHead>
                  )}
                  {visibleColumns.security && <TableHead className="min-w-[160px] font-semibold text-muted-foreground">Verifikasi Keamanan</TableHead>}
                  {visibleColumns.actions && <TableHead className="min-w-[210px] text-right font-semibold text-muted-foreground">Tindakan &amp; Laporan</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border/60">
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2 + Object.values(visibleColumns).filter(Boolean).length} className="py-12 text-center text-muted-foreground text-xs">
                      Tidak ada data karyawan yang sesuai dengan kriteria filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map(({ user: u, attendance: att, status, absentSubtype, shift, totalLateMinutes, lateCount, totalAttCount, todayOvertime, todayOvertimeHours, todayOvertimePay, monthlyOvertimeHours, monthlyOvertimePay, monthlyOvertimeCount, monthlyOvertimeDates }, idx) => {
                    const userAnomaly = radarSummary.items.find((i) => i.userId === u.id);

                    // Deteksi Cerdas Kasus Lembur Sebelum Shift (Shift Pengganti Masuk Lebih Awal)
                    const otStart = todayOvertime?.startTime ? String(todayOvertime.startTime).substring(0, 5) : '';
                    const otEnd = todayOvertime?.endTime ? String(todayOvertime.endTime).substring(0, 5) : '';
                    const schedStart = shift?.startTime ? String(shift.startTime).substring(0, 5) : '';
                    const clockInStr = att?.clockIn ? String(att.clockIn).substring(0, 5) : '';
                    const isSambungMundur = Boolean(
                      todayOvertime &&
                      todayOvertimeHours && todayOvertimeHours > 0 &&
                      clockInStr &&
                      schedStart &&
                      otStart &&
                      otStart < schedStart &&
                      clockInStr < schedStart
                    );
                    return (
                      <TableRow key={u.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="text-center font-mono text-xs text-muted-foreground/80">
                          {idx + 1}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenQuickProfile({
                                  user: u,
                                  attendance: att,
                                  shift,
                                  status,
                                  absentSubtype,
                                  monthlyOvertimeHours,
                                  monthlyOvertimeCount,
                                  todayOvertimeHours,
                                  todayOvertimePay,
                                  monthlyOvertimePay,
                                  totalLateMinutes,
                                  lateCount,
                                  anomaly: userAnomaly,
                                });
                              }}
                              className="relative cursor-pointer group/avatar hover:scale-110 active:scale-95 transition-all duration-200 shrink-0"
                              title="Klik untuk melihat foto profil & info lengkap"
                            >
                              {(() => {
                                const rawPhoto = u.avatarUrl || u.faceEnrolledPhoto || (u as any).face_enrolled_photo || (u as any).face_photo_url || (u as any).facePhotoUrl || att?.clockInPhoto || att?.photoIn;
                                const photo = (typeof rawPhoto === 'string' && (rawPhoto.startsWith('data:image/') || rawPhoto.startsWith('http') || rawPhoto.startsWith('/')))
                                  ? rawPhoto
                                  : null;
                                return photo ? (
                                  <img
                                    src={photo}
                                    alt={u.fullName}
                                    loading="lazy"
                                    decoding="async"
                                    className="w-8 h-8 rounded-full object-cover border-2 border-primary/30 group-hover/avatar:border-primary shrink-0 shadow-xs ring-1 ring-transparent group-hover/avatar:ring-primary/40 transition-all"
                                    onError={(e) => {
                                      const target = e.currentTarget;
                                      target.style.display = 'none';
                                      const fallback = target.nextElementSibling;
                                      if (fallback) (fallback as HTMLElement).style.display = 'flex';
                                    }}
                                  />
                                ) : null;
                              })()}
                              <div
                                className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-xs shrink-0 border border-primary/20 group-hover/avatar:bg-primary/20 group-hover/avatar:border-primary/50 transition-all"
                                style={{
                                  display: (() => {
                                    const rawPhoto = u.avatarUrl || u.faceEnrolledPhoto || (u as any).face_enrolled_photo || (u as any).face_photo_url || (u as any).facePhotoUrl || att?.clockInPhoto || att?.photoIn;
                                    return (typeof rawPhoto === 'string' && (rawPhoto.startsWith('data:image/') || rawPhoto.startsWith('http') || rawPhoto.startsWith('/'))) ? 'none' : 'flex';
                                  })(),
                                }}
                              >
                                {u.fullName.charAt(0)}
                              </div>
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="font-semibold text-foreground text-xs truncate max-w-[180px]" title={u.fullName}>
                                  {u.fullName}
                                </p>
                                {userAnomaly && (
                                  <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" title="Terdeteksi anomali presensi" />
                                )}
                              </div>
                              <p className="text-[11px] text-muted-foreground font-mono truncate">
                                {u.nip}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        {visibleColumns.category && (
                          <TableCell>
                            {(() => {
                              const meta = getCategoryBadgeMeta(getEmployeeCategoryGroup(u));
                              return (
                                <Badge variant="outline" className={`${meta.badgeClass} text-[10px] rounded-full px-2 py-0.5 font-semibold whitespace-nowrap`}>
                                  {meta.shortLabel}
                                </Badge>
                              );
                            })()}
                          </TableCell>
                        )}
                        {visibleColumns.division && (
                          <TableCell>
                            <p className="text-xs font-medium text-foreground truncate max-w-[160px]">{u.divisionName || '-'}</p>
                            <p className="text-[11px] text-muted-foreground capitalize">
                              {u.role === 'admin' ? 'Administrator' : u.role === 'hr' ? 'HR Staff' : 'Karyawan'}
                            </p>
                          </TableCell>
                        )}
                        {visibleColumns.shift && (
                          <TableCell className="text-center">
                            {shift?.isOff || shift?.code === 'OFF' ? (
                              <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 text-[10px] font-medium">
                                Libur / OFF
                              </Badge>
                            ) : shift ? (
                              <div className="inline-flex flex-col items-center">
                                <Badge variant="outline" className="text-[10px] font-semibold px-2 py-0.5 border-indigo-500/30 bg-indigo-50/70 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                                  {shift.code || shift.name}
                                </Badge>
                                <span className="text-[10px] text-muted-foreground font-mono mt-0.5">
                                  {shift.startTime ? `${shift.startTime.slice(0, 5)} - ${shift.endTime.slice(0, 5)}` : 'Non-Shift'}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground font-mono">Day Shift</span>
                            )}
                          </TableCell>
                        )}
                        {visibleColumns.status && (
                          <TableCell className="text-center">
                            {isDailyView ? (
                              isSambungMundur ? (
                                <div className="inline-flex flex-col items-center gap-0.5">
                                  <Badge className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-[10px] rounded-full px-2 py-0.5 shadow-xs gap-1">
                                    <Clock size={10} /> Lembur Pengganti
                                  </Badge>
                                  <span className="text-[9.5px] font-mono text-muted-foreground">
                                    Shift {shift?.code || 'Resmi'}: pk {schedStart}
                                  </span>
                                </div>
                              ) : status === 'present' ? (
                                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800 text-[11px] rounded-full px-2.5 py-0.5 font-medium">
                                  Tepat Waktu
                                </Badge>
                              ) : status === 'late' ? (
                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-emerald-800 text-[11px] rounded-full px-2.5 py-0.5 font-medium">
                                  Telat {att?.lateMinutes || 0}m
                                </Badge>
                              ) : absentSubtype === 'off' ? (
                                <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 text-[11px] rounded-full px-2.5 py-0.5 font-medium">
                                  Libur / OFF
                                </Badge>
                              ) : absentSubtype === 'unregistered' ? (
                                <Badge variant="outline" className="bg-amber-50/80 text-amber-800 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 text-[11px] rounded-full px-2.5 py-0.5 font-medium">
                                  Belum Registrasi Wajah
                                </Badge>
                              ) : absentSubtype === 'cuti' ? (
                                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-950/40 dark:text-purple-400 text-[11px] rounded-full px-2.5 py-0.5 font-medium">
                                  Cuti Tahunan
                                </Badge>
                              ) : absentSubtype === 'sakit' ? (
                                <Badge variant="outline" className="bg-pink-50 text-pink-700 border-pink-300 dark:bg-pink-950/40 dark:text-pink-400 text-[11px] rounded-full px-2.5 py-0.5 font-medium">
                                  Izin Sakit
                                </Badge>
                              ) : absentSubtype === 'izin' ? (
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/40 dark:text-blue-400 text-[11px] rounded-full px-2.5 py-0.5 font-medium">
                                  Izin Resmi
                                </Badge>
                              ) : absentSubtype === 'mangkir' ? (
                                <div className="flex flex-col items-center gap-0.5">
                                  <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800 text-[11px] rounded-full px-2.5 py-0.5 font-bold shadow-xs">
                                    Mangkir / Alpa
                                  </Badge>
                                  {att?.notes?.includes('Hak Cuti') ? (
                                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold" title={att.notes}>Potong Cuti</span>
                                  ) : att?.notes?.includes('Lembur') ? (
                                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold" title={att.notes}>Potong Lembur</span>
                                  ) : att?.notes?.includes('Gaji Pokok') ? (
                                    <span className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold" title={att.notes}>Potong Gaji</span>
                                  ) : null}
                                </div>
                              ) : absentSubtype === 'pending_shift' ? (
                                <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-400 text-[11px] rounded-full px-2.5 py-0.5">
                                  Shift Pk {shift?.startTime ? shift.startTime.slice(0, 5) : '-'}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-muted text-muted-foreground border-border text-[11px] rounded-full px-2.5 py-0.5">
                                  Belum Hadir
                                </Badge>
                              )
                            ) : (
                              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[11px] rounded-full px-2.5 py-0.5 font-mono font-medium">
                                {totalAttCount} Hari Hadir
                              </Badge>
                            )}
                          </TableCell>
                        )}
                        {visibleColumns.clockIn && (
                          <TableCell className="text-center">
                            {isDailyView ? (
                              isSambungMundur ? (
                                <div className="inline-flex flex-col items-center">
                                  <span className="font-mono text-xs font-bold text-amber-700 dark:text-amber-400">
                                    {clockInStr} WITA
                                  </span>
                                  <span className="text-[9px] font-semibold text-amber-600 dark:text-amber-400">
                                    (Masuk Lembur)
                                  </span>
                                  <span className="text-[8.5px] font-mono text-muted-foreground">
                                    Resmi: {schedStart}
                                  </span>
                                </div>
                              ) : (
                                <span className={`font-mono text-xs ${att?.clockIn ? 'font-medium text-foreground' : 'text-muted-foreground/40'}`}>
                                  {att?.clockIn ? `${att.clockIn} WITA` : '-'}
                                </span>
                              )
                            ) : (
                              lateCount > 0 ? (
                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[11px] rounded-full px-2.5 py-0.5 font-medium">
                                  {lateCount}x ({totalLateMinutes} mnt)
                                </Badge>
                              ) : (
                                <span className="text-[11px] text-emerald-600 font-medium">Nihil (0 mnt)</span>
                              )
                            )}
                          </TableCell>
                        )}
                        {visibleColumns.clockOut && (
                          <TableCell className="text-center">
                            {isDailyView ? (
                              <span className={`font-mono text-xs ${att?.clockOut ? 'font-medium text-foreground' : 'text-muted-foreground/40'}`}>
                                {att?.clockOut ? `${att.clockOut} WITA` : '-'}
                              </span>
                            ) : (
                              <span className="font-mono text-xs font-bold text-rose-600">
                                Rp {(totalLateMinutes * 1000).toLocaleString('id-ID')}
                              </span>
                            )}
                          </TableCell>
                        )}
                        {visibleColumns.overtime && (
                          <TableCell className="text-center">
                            {isDailyView ? (
                              todayOvertimeHours && todayOvertimeHours > 0 ? (
                                <div className="inline-flex flex-col items-center">
                                  <Badge className="bg-amber-500 hover:bg-amber-600 text-white font-mono text-[10px] px-2 py-0.5 gap-1 shadow-2xs">
                                    <Clock size={10} /> {todayOvertimeHours} Jam
                                  </Badge>
                                  {otStart && otEnd && (
                                    <span className="text-[9.5px] font-mono font-semibold text-foreground/80 mt-0.5">
                                      {otStart} - {otEnd}
                                    </span>
                                  )}
                                  <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 font-mono mt-0.5" title="Kompensasi lembur hari ini">
                                    Rp {todayOvertimePay?.toLocaleString('id-ID')}
                                  </span>
                                  {todayOvertime?.taskDescription && (
                                    <span className="text-[9px] font-medium text-amber-800 dark:text-amber-300 max-w-[130px] truncate" title={todayOvertime.taskDescription}>
                                      {todayOvertime.taskDescription}
                                    </span>
                                  )}
                                  {monthlyOvertimeHours > todayOvertimeHours && (
                                    <span className="text-[9px] text-muted-foreground font-mono mt-0.5" title="Total akumulasi lembur bulan berjalan">
                                      Total Bln: {monthlyOvertimeHours}J (Rp {monthlyOvertimePay?.toLocaleString('id-ID')})
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span
                                  className="text-xs text-muted-foreground/30 font-mono"
                                  title={monthlyOvertimeHours > 0 ? `Tidak ada lembur pada tanggal ${targetDayDate} (Total lembur ${selectedMonthLabel}: ${monthlyOvertimeHours} Jam)` : 'Tidak ada lembur'}
                                >
                                  -
                                </span>
                              )
                            ) : (
                              monthlyOvertimeHours && monthlyOvertimeHours > 0 ? (
                                <div className="inline-flex flex-col items-center">
                                  <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 font-mono text-[10px] px-2 py-0.5">
                                    {monthlyOvertimeHours} Jam ({monthlyOvertimeCount || 1}x)
                                  </Badge>
                                  <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 font-mono mt-0.5">
                                    Rp {monthlyOvertimePay?.toLocaleString('id-ID')}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground/30 font-mono">-</span>
                              )
                            )}
                          </TableCell>
                        )}
                        {visibleColumns.security && (
                          <TableCell>
                            {absentSubtype === 'cuti' ? (
                              <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 text-[10px] gap-1 rounded-full font-medium">
                                <CheckCircle2 size={10} /> Disahkan Direksi
                              </Badge>
                            ) : absentSubtype === 'sakit' ? (
                              <Badge variant="outline" className="bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/40 dark:text-pink-400 text-[10px] gap-1 rounded-full font-medium">
                                <Activity size={10} /> Surat Dokter
                              </Badge>
                            ) : absentSubtype === 'izin' ? (
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 text-[10px] gap-1 rounded-full font-medium">
                                <CheckCircle2 size={10} /> Izin Disahkan
                              </Badge>
                            ) : absentSubtype === 'off' ? (
                              <span className="text-muted-foreground/40 text-xs">-</span>
                            ) : att && att.clockIn ? (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {/* Shield 1: Face-API Biometric 1:1 Verification */}
                                {att.biometricScore != null ? (
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] gap-1 rounded-full ${
                                      att.biometricMatch !== false
                                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300'
                                        : 'bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300'
                                    }`}
                                    title={`Skor Kemiripan Biometrik 1:1: ${att.biometricScore}%`}
                                  >
                                    <ShieldCheck size={10} />
                                    Face {att.biometricScore}%
                                  </Badge>
                                ) : att.securityFlags?.includes('BIOMETRIC_SELFIE_WATERMARKED') ? (
                                  <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800 text-[10px] gap-1 rounded-full">
                                    <ShieldCheck size={10} /> Face Valid
                                  </Badge>
                                ) : null}

                                {/* Shield 2: Geofence Spatial Perimeter & Distance */}
                                {att.isMockLocation || att.isMockSuspected ? (
                                  <Badge className="bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800 text-[10px] gap-1 rounded-full">
                                    <AlertTriangle size={10} /> Mock GPS
                                  </Badge>
                                ) : att.geofenceDistance != null ? (
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] gap-1 rounded-full ${
                                      att.geofenceValid !== false
                                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800'
                                        : 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800'
                                    }`}
                                    title={`Jarak ke perimeter divisi: ${Math.round(att.geofenceDistance)} meter`}
                                  >
                                    <MapPin size={10} />
                                    {Math.round(att.geofenceDistance)}m {att.geofenceValid !== false ? 'Valid' : 'Luar'}
                                  </Badge>
                                ) : att.securityFlags?.includes('DYNAMIC_QR_OFFICE_VERIFIED') || att.securityFlags?.includes('TERMINAL_BARCODE_VERIFIED') ? (
                                  <Badge className="bg-cyan-50 text-cyan-800 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-400 dark:border-cyan-800 text-[10px] gap-1 rounded-full">
                                    <ShieldCheck size={10} /> Terminal OK
                                  </Badge>
                                ) : (
                                  <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800 text-[10px] gap-1 rounded-full">
                                    <ShieldCheck size={10} /> Terverifikasi
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground/40 text-xs">-</span>
                            )}
                          </TableCell>
                        )}
                        {visibleColumns.actions && (
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {(() => {
                                const isMacciniUser = isMacciniBajiOfficer(u);
                                const isMacciniOnCallUser = isMacciniUser && macciniVesselStatus.status !== 'docking';
                                if (isMacciniOnCallUser) {
                                  return (
                                    <Badge className="bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 text-[10px] gap-1 font-semibold rounded-lg shadow-2xs">
                                      🌊 On-Call Sah
                                    </Badge>
                                  );
                                }
                                return (att?.isPerimeterBreached || att?.isLocked) ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2 text-[10px] rounded-lg gap-1 border-rose-500/40 text-rose-600 hover:bg-rose-500/10 font-semibold"
                                    onClick={() => {
                                      const existingViolation = perimeterViolations.find((v) => v.userId === u.id && v.status === 'active');
                                      const vToUse = existingViolation || ({
                                        id: `violation-${u.id}`,
                                        userId: u.id,
                                        attendanceId: att?.id,
                                        divisionId: u.divisionId,
                                        violationDate: getTodayDateStr(),
                                        detectedAt: new Date().toISOString(),
                                        distanceMeters: att?.geofenceDistance || 120,
                                        status: 'active',
                                        notes: 'Terdeteksi meninggalkan perimeter area kantor pada jam operasional.',
                                        createdAt: new Date().toISOString(),
                                        updatedAt: new Date().toISOString(),
                                      } as PerimeterViolation);
                                      setSelectedBreach(vToUse);
                                      setUnlockReason('');
                                      setUnlockModalOpen(true);
                                    }}
                                    title="Buka Kunci Presensi Pulang"
                                  >
                                    <Unlock size={11} /> Buka Kunci
                                  </Button>
                                ) : null;
                              })()}
                              {/* REKOMENDASI 3: Remote Unlock oleh Admin/Korlap untuk Karyawan Aktif Bekerja */}
                              {att?.clockIn && !att?.clockOut && (
                                att?.isRemoteUnlocked ? (
                                  <Badge className="bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 text-[10px] gap-1 font-semibold rounded-lg">
                                    <Unlock size={10} /> Terbuka
                                  </Badge>
                                ) : !(att?.isPerimeterBreached || att?.isLocked) ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2 text-[10px] rounded-lg gap-1 border-primary/40 text-primary hover:bg-primary/10 font-semibold"
                                    onClick={() => {
                                      const adminName = user?.fullName || 'Admin / Korlap';
                                      hrmService.remoteUnlockAttendance(u.id, adminName, 'Izin kepulangan dibuka via Monitoring');
                                      toast.success(`Kunci checkout ${u.fullName} berhasil dibuka! Notifikasi telah dikirim ke perangkat karyawan.`);
                                      loadData();
                                    }}
                                    title="Buka Kunci Kepulangan (Rekomendasi 3)"
                                  >
                                    <Unlock size={11} /> Buka Kunci
                                  </Button>
                                ) : null
                              )}
                              {/* Tombol Kalender Presensi Bulanan Per Karyawan */}
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-[11px] rounded-lg gap-1 border-primary/30 text-primary hover:bg-primary/10 font-medium"
                                onClick={() => {
                                  setSelectedCalendarUser(u);
                                  setCalendarModalOpen(true);
                                }}
                                title={`Buka Kalender Presensi ${u.fullName}`}
                              >
                                <CalendarDays size={12} /> Kalender
                              </Button>

                              {/* Tombol Unduh Laporan Realtime Per Karyawan */}
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-[11px] rounded-lg gap-1 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 font-medium"
                                onClick={() => handleOpenRealtimeReport(u, att, shift)}
                                title={`Unduh Laporan Realtime & Forensik ${u.fullName}`}
                              >
                                <FileSpreadsheet size={12} /> Laporan
                              </Button>

                              {att?.photoIn || (att as any)?.clockInPhoto || att?.photoOut || (att as any)?.clockOutPhoto ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-[11px] rounded-lg gap-1 text-primary hover:bg-primary/10"
                                  onClick={() => setPreviewForensic({
                                    url: (att?.photoIn || (att as any)?.clockInPhoto || att?.photoOut || (att as any)?.clockOutPhoto)!,
                                    name: u.fullName,
                                    nip: u.nip,
                                    division: u.divisionName,
                                    time: att?.clockIn || att?.clockOut,
                                    biometricScore: att?.biometricScore,
                                    biometricMatch: att?.biometricMatch,
                                    geofenceDistance: att?.geofenceDistance,
                                    geofenceValid: att?.geofenceValid,
                                    isMockLocation: att?.isMockLocation,
                                    lat: att?.clockInLat || (att as any)?.latIn,
                                    lng: att?.clockInLong || (att as any)?.longIn,
                                    securityFlags: att?.securityFlags,
                                  })}
                                >
                                  <Eye size={12} /> Forensik
                                </Button>
                              ) : null}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Datagrid Summary Bar */}
          <div className="px-4 py-3 border-t border-border/70 bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              Menampilkan <strong className="text-foreground font-semibold">{filtered.length}</strong> dari <strong className="text-foreground font-semibold">{users.length}</strong> karyawan
            </span>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Tepat Waktu
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500" /> Terlambat
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-400" /> Libur / OFF
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500" /> Mangkir / Alpa
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-muted-foreground/50" /> Belum Hadir
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* Real-time Cards Grid Fallback */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.length === 0 ? (
            <div className="col-span-full py-12 text-center text-muted-foreground text-sm">
              Tidak ada data staf yang sesuai dengan filter.
            </div>
          ) : (
            filtered.map(({ user: u, attendance: att, status, absentSubtype, shift }) => {
              const userAnomaly = radarSummary.items.find((i) => i.userId === u.id);
              return (
              <Card key={u.id} className="border-border/80 bg-card rounded-2xl shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenQuickProfile({
                            user: u,
                            attendance: att,
                            shift,
                            status,
                            absentSubtype,
                            monthlyOvertimeHours,
                            monthlyOvertimeCount,
                            todayOvertimeHours,
                            todayOvertimePay,
                            monthlyOvertimePay,
                            totalLateMinutes,
                            lateCount,
                            anomaly: userAnomaly,
                          });
                        }}
                        className="relative cursor-pointer group/avatar hover:scale-110 active:scale-95 transition-all duration-200 shrink-0"
                        title="Klik untuk melihat foto profil & info lengkap"
                      >
                        {(() => {
                          const rawPhoto = u.avatarUrl || u.faceEnrolledPhoto || (u as any).face_enrolled_photo || (u as any).face_photo_url || (u as any).facePhotoUrl || att?.clockInPhoto || att?.photoIn;
                          const photo = (typeof rawPhoto === 'string' && (rawPhoto.startsWith('data:image/') || rawPhoto.startsWith('http') || rawPhoto.startsWith('/')))
                            ? rawPhoto
                            : null;
                          return photo ? (
                            <img
                              src={photo}
                              alt={u.fullName}
                              loading="lazy"
                              decoding="async"
                              className="w-9 h-9 rounded-full object-cover border-2 border-primary/30 group-hover/avatar:border-primary shrink-0 shadow-xs ring-1 ring-transparent group-hover/avatar:ring-primary/40 transition-all"
                              onError={(e) => {
                                const target = e.currentTarget;
                                target.style.display = 'none';
                                const fallback = target.nextElementSibling;
                                if (fallback) (fallback as HTMLElement).style.display = 'flex';
                              }}
                            />
                          ) : null;
                        })()}
                        <div
                          className="w-9 h-9 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-xs shrink-0 border border-primary/20 group-hover/avatar:bg-primary/20 group-hover/avatar:border-primary/50 transition-all"
                          style={{
                            display: (() => {
                              const rawPhoto = u.avatarUrl || u.faceEnrolledPhoto || (u as any).face_enrolled_photo || (u as any).face_photo_url || (u as any).facePhotoUrl || att?.clockInPhoto || att?.photoIn;
                              return (typeof rawPhoto === 'string' && (rawPhoto.startsWith('data:image/') || rawPhoto.startsWith('http') || rawPhoto.startsWith('/'))) ? 'none' : 'flex';
                            })(),
                          }}
                        >
                          {u.fullName.charAt(0)}
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="font-semibold text-foreground text-xs">{u.fullName}</p>
                          {userAnomaly && (
                            <span className="w-2 h-2 rounded-full bg-rose-500" title="Terdeteksi anomali presensi" />
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground font-mono">
                          {u.nip} • {u.divisionName || '-'}
                        </p>
                        {(() => {
                          const meta = getCategoryBadgeMeta(getEmployeeCategoryGroup(u));
                          return (
                            <Badge variant="outline" className={`${meta.badgeClass} text-[9px] rounded-full px-2 py-0 mt-1 font-semibold inline-flex`}>
                              {meta.shortLabel}
                            </Badge>
                          );
                        })()}
                      </div>
                    </div>

                  {status === 'present' ? (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] rounded-full">
                      Tepat Waktu
                    </Badge>
                  ) : status === 'late' ? (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] rounded-full">
                      Telat {att?.lateMinutes}m
                    </Badge>
                  ) : absentSubtype === 'off' ? (
                    <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300 text-[10px] rounded-full font-medium">
                      Libur / OFF
                    </Badge>
                  ) : absentSubtype === 'unregistered' ? (
                    <Badge variant="outline" className="bg-amber-50/80 text-amber-800 border-amber-200 text-[10px] rounded-full font-medium">
                      Belum Registrasi Wajah
                    </Badge>
                  ) : absentSubtype === 'cuti' ? (
                    <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-300 text-[10px] rounded-full font-medium">
                      Cuti Tahunan
                    </Badge>
                  ) : absentSubtype === 'sakit' ? (
                    <Badge variant="outline" className="bg-pink-50 text-pink-700 border-pink-300 text-[10px] rounded-full font-medium">
                      Izin Sakit
                    </Badge>
                  ) : absentSubtype === 'izin' ? (
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300 text-[10px] rounded-full font-medium">
                      Izin Resmi
                    </Badge>
                  ) : absentSubtype === 'mangkir' ? (
                    <div className="flex flex-col items-end gap-0.5">
                      <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-300 text-[10px] rounded-full font-bold shadow-xs">
                        Mangkir / Alpa
                      </Badge>
                      {att?.notes?.includes('Hak Cuti') ? (
                        <span className="text-[9px] text-emerald-600 font-semibold" title={att.notes}>Potong Cuti</span>
                      ) : att?.notes?.includes('Lembur') ? (
                        <span className="text-[9px] text-amber-600 font-semibold" title={att.notes}>Potong Lembur</span>
                      ) : att?.notes?.includes('Gaji Pokok') ? (
                        <span className="text-[9px] text-rose-600 font-semibold" title={att.notes}>Potong Gaji</span>
                      ) : null}
                    </div>
                  ) : absentSubtype === 'pending_shift' ? (
                    <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-200 text-[10px] rounded-full">
                      Shift Pk {shift?.startTime ? shift.startTime.slice(0, 5) : '-'}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-muted text-muted-foreground border-border text-[10px] rounded-full">
                      Belum Hadir
                    </Badge>
                  )}
                </div>

                <div className="p-2.5 bg-muted/30 rounded-xl border border-border/70 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Jam Masuk:</span>
                    <span className="font-mono font-medium text-foreground">
                      {att?.clockIn ? `${att.clockIn} WITA` : '-'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Jam Pulang:</span>
                    <span className="font-mono font-medium text-foreground">
                      {att?.clockOut ? `${att.clockOut} WITA` : '-'}
                    </span>
                  </div>
                </div>

                {/* Anti-Fraud Dual-Shield Inspection Stamp */}
                {att && (
                  <div className="flex items-center justify-between pt-1 border-t border-border/60">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Shield 1: Face-API Biometric */}
                      {att.biometricScore != null ? (
                        <Badge
                          variant="outline"
                          className={`text-[10px] gap-1 rounded-full ${
                            att.biometricMatch !== false
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300'
                              : 'bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300'
                          }`}
                        >
                          <ShieldCheck size={10} />
                          {att.biometricScore}% Match
                        </Badge>
                      ) : att.securityFlags?.includes('BIOMETRIC_SELFIE_WATERMARKED') ? (
                        <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[10px] gap-1 rounded-full">
                          <ShieldCheck size={10} /> Face Valid
                        </Badge>
                      ) : null}

                      {/* Shield 2: Geofence Spatial Perimeter */}
                      {att.isMockLocation || att.isMockSuspected ? (
                        <Badge className="bg-rose-50 text-rose-700 border-rose-200 text-[10px] gap-1 rounded-full">
                          <AlertTriangle size={10} /> Mock GPS
                        </Badge>
                      ) : att.geofenceDistance != null ? (
                        <Badge
                          variant="outline"
                          className={`text-[10px] gap-1 rounded-full ${
                            att.geofenceValid !== false
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400'
                              : 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400'
                          }`}
                        >
                          <MapPin size={10} />
                          {Math.round(att.geofenceDistance)}m
                        </Badge>
                      ) : (
                        <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[10px] gap-1 rounded-full">
                          <ShieldCheck size={10} /> Valid
                        </Badge>
                      )}
                    </div>

                    {att.photoIn && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-[10px] rounded-lg gap-1 text-primary hover:bg-primary/10 shrink-0"
                        onClick={() => setPreviewForensic({
                          url: att.photoIn!,
                          name: u.fullName,
                          nip: u.nip,
                          division: u.divisionName,
                          time: att.clockIn,
                          biometricScore: att.biometricScore,
                          biometricMatch: att.biometricMatch,
                          geofenceDistance: att.geofenceDistance,
                          geofenceValid: att.geofenceValid,
                          isMockLocation: att.isMockLocation,
                          lat: att.clockInLat,
                          lng: att.clockInLong,
                          securityFlags: att.securityFlags,
                        })}
                      >
                        <Eye size={11} /> Forensik
                      </Button>
                    )}
                  </div>
                )}

                {/* Tombol Kalender & Laporan Realtime Karyawan */}
                <div className="pt-2 border-t border-border/60 grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 w-full text-[11px] rounded-xl gap-1.5 border-primary/30 text-primary hover:bg-primary/10 font-medium"
                    onClick={() => {
                      setSelectedCalendarUser(u);
                      setCalendarModalOpen(true);
                    }}
                    title={`Buka Kalender Presensi ${u.fullName}`}
                  >
                    <CalendarDays size={12} />
                    <span>Kalender</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 w-full text-[11px] rounded-xl gap-1.5 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 font-medium"
                    onClick={() => handleOpenRealtimeReport(u, att, shift)}
                    title={`Unduh Laporan Realtime & Forensik ${u.fullName}`}
                  >
                    <FileSpreadsheet size={12} />
                    <span>Laporan</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
          })
        )}
      </div>
      )}

      {/* Terminal QR Dinamis Kantor Dialog */}
      <Dialog open={qrModalOpen} onOpenChange={setQrModalOpen}>
        <DialogContent className="max-w-md rounded-2xl border border-border shadow-2xl text-center">
          <DialogHeader>
            <div className="mx-auto w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-1">
              <QrCode size={24} />
            </div>
            <DialogTitle className="text-lg font-bold text-foreground">
              Terminal QR Dinamis Kantor
            </DialogTitle>
            <DialogDescription className="text-xs">
              Tampilkan layar ini di monitor lobi kantor. Kode berputar secara otomatis demi mencegah presensi dari luar area.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Square 2D QR Matrix Box */}
            <div className="p-5 bg-slate-950 rounded-2xl border border-slate-800 flex flex-col items-center justify-center shadow-xl">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest block mb-3">
                ARAHKAN KAMERA HP KE KODE QR
              </span>

              {/* Real 2D Square QR Code Graphic */}
              <div className="p-3 bg-white rounded-2xl shadow-lg border-4 border-emerald-500/40 inline-flex items-center justify-center transition-transform hover:scale-[1.02]">
                {qrImageUrl ? (
                  <img
                    src={qrImageUrl}
                    alt="QR Code Presensi Kantor"
                    className="w-56 h-56 sm:w-64 sm:h-64 object-contain rounded-xl"
                  />
                ) : (
                  <div className="w-56 h-56 flex items-center justify-center bg-slate-100 rounded-xl text-slate-400 text-xs font-medium">
                    Membuat Kode QR...
                  </div>
                )}
              </div>

              {/* Text Token Fallback */}
              <div className="text-center mt-3.5 space-y-1">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                  Token Alternatif (Input Manual):
                </span>
                <p className="font-mono text-lg sm:text-xl font-black tracking-widest text-emerald-400 bg-slate-900 px-4 py-1.5 rounded-xl border border-slate-700 select-all inline-block">
                  {qrData.code}
                </p>
              </div>

              {/* Progress Countdown Bar */}
              <div className="w-full max-w-xs mt-3 space-y-1">
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full transition-all duration-1000 ease-linear rounded-full"
                    style={{ width: `${(qrData.remainingSeconds / 10) * 100}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-400 text-center">
                  Berputar otomatis dalam <strong className="text-emerald-400 font-mono">{qrData.remainingSeconds} detik</strong>
                </p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Forensic Photo & Dual-Shield Database Telemetry Modal */}
      {previewForensic && (
        <Dialog open={!!previewForensic} onOpenChange={() => setPreviewForensic(null)}>
          <DialogContent className="max-w-2xl rounded-2xl p-0 overflow-hidden border border-border shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-border bg-card">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-foreground">Sertifikat Forensik Presensi Dual-Shield</h3>
                  <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                    Database Perusahaan Synchronized
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {previewForensic.name} ({previewForensic.nip || '-'}) • {previewForensic.division || 'Umum'} • Jam {previewForensic.time || '-'} WITA
                </p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => setPreviewForensic(null)} className="h-8 w-8 rounded-xl">
                <X size={15} />
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border bg-card">
              {/* Left Column: Forensic Selfie Photo */}
              <div className="p-4 bg-slate-950 flex flex-col items-center justify-center">
                <div className="relative group w-full flex items-center justify-center">
                  <img
                    src={previewForensic.url}
                    alt="Forensic Watermark"
                    className="max-h-[50vh] w-full rounded-xl object-contain shadow-lg cursor-zoom-in group-hover:opacity-95 transition-opacity"
                    onClick={() => {
                      const win = window.open();
                      if (win) {
                        win.document.write(`<body style="margin:0;background:#0f172a;display:flex;align-items:center;justify-center;min-height:100vh;"><img src="${previewForensic.url}" style="max-width:100%;height:auto;box-shadow:0 10px 25px rgba(0,0,0,0.5);"/></body>`);
                      }
                    }}
                    title="Klik untuk melihat foto dalam resolusi asli penuh"
                  />
                </div>
                <div className="flex items-center justify-between w-full mt-2.5 px-1">
                  <p className="text-[10px] text-slate-400 truncate">
                    Cryptographic forensic watermark
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-[10px] bg-white/10 hover:bg-white/20 text-white border-white/20 px-2 rounded-lg gap-1 shrink-0"
                    onClick={() => {
                      const win = window.open();
                      if (win) {
                        win.document.write(`<body style="margin:0;background:#0f172a;display:flex;align-items:center;justify-content:center;min-height:100vh;"><img src="${previewForensic.url}" style="max-width:100%;height:auto;box-shadow:0 10px 25px rgba(0,0,0,0.5);"/></body>`);
                      }
                    }}
                  >
                    <ExternalLink size={10} /> Perbesar Foto Penuh
                  </Button>
                </div>
              </div>

              {/* Right Column: Synchronized Database Verification Audit */}
              <div className="p-4 space-y-3.5 text-xs">
                <div>
                  <h4 className="font-bold text-foreground text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-primary" /> Verifikasi Gate Database
                  </h4>

                  {/* Shield 1 Telemetry */}
                  <div className="p-3 rounded-xl bg-muted/40 border border-border/80 space-y-1.5 mb-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground flex items-center gap-1">
                        🛡️ Shield 1: Face-API Biometrik 1:1
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-bold ${
                          previewForensic.biometricMatch !== false
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300'
                            : 'bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300'
                        }`}
                      >
                        {previewForensic.biometricScore != null ? `${previewForensic.biometricScore}% Match` : 'Terverifikasi'}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Model ResNet-34 128-D Euclidean Centroid vs Master Profile Enrollment.
                    </p>
                  </div>

                  {/* Shield 2 Telemetry */}
                  <div className="p-3 rounded-xl bg-muted/40 border border-border/80 space-y-1.5 mb-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground flex items-center gap-1">
                        📍 Shield 2: Geofence Perimeter
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-bold ${
                          previewForensic.geofenceValid !== false
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300'
                            : 'bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300'
                        }`}
                      >
                        {previewForensic.geofenceDistance != null ? `${Math.round(previewForensic.geofenceDistance)}m` : 'Area Valid'}
                        {previewForensic.geofenceValid !== false ? ' (Dalam Area)' : ' (Luar Area)'}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Metrik Haversine &amp; Polygon Ray-Casting ke titik perimeter divisi.
                    </p>
                  </div>

                  {/* Anti-Spoof Telemetry */}
                  <div className="p-3 rounded-xl bg-muted/40 border border-border/80 space-y-1.5 mb-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground flex items-center gap-1">
                        📡 Integritas GPS &amp; Perangkat
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-bold ${
                          previewForensic.isMockLocation
                            ? 'bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300'
                        }`}
                      >
                        {previewForensic.isMockLocation ? '⚠️ Mock GPS Terdeteksi' : 'Hardware GPS Asli'}
                      </Badge>
                    </div>
                    {previewForensic.lat != null && previewForensic.lng != null && (
                      <p className="text-[11px] font-mono text-muted-foreground">
                        Koordinat: {previewForensic.lat.toFixed(5)}, {previewForensic.lng.toFixed(5)}
                      </p>
                    )}
                  </div>

                  {/* Audit Security Flags */}
                  {previewForensic.securityFlags && previewForensic.securityFlags.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Security Audit Flags:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {previewForensic.securityFlags.map((flag, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground text-[10px] font-mono border border-border"
                          >
                            {flag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ─── MODAL OTORISASI PEMBUKAAN KUNCI PRESENSI (HRD / PIMPINAN) ─── */}
      <Dialog open={unlockModalOpen} onOpenChange={setUnlockModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Unlock className="w-5 h-5 text-emerald-600" />
              Otorisasi Pembukaan Kunci Presensi Pulang
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Tindakan ini akan memulihkan akses Checkout presensi bagi karyawan yang mengalami insiden pelanggaran perimeter.
            </DialogDescription>
          </DialogHeader>

          {selectedBreach && (
            <div className="space-y-4 py-2 text-xs">
              <div className="p-3 bg-muted/40 rounded-xl border border-border space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Karyawan:</span>
                  <span className="font-bold text-foreground">
                    {users.find((u) => u.id === selectedBreach.userId)?.fullName || selectedBreach.userName || selectedBreach.userId}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Jarak Terdeteksi:</span>
                  <span className="font-semibold text-rose-600 font-mono">
                    {Math.round(selectedBreach.distanceMeters)} Meter di Luar Perimeter
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Waktu Insiden:</span>
                  <span className="font-mono text-foreground">
                    {new Date(selectedBreach.detectedAt).toLocaleTimeString('id-ID')} WITA
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-medium text-foreground text-xs">
                  Catatan Pertimbangan / Otorisasi Pembukaan:
                </label>
                <Textarea
                  placeholder="Contoh: Karyawan telah diverifikasi mendapat tugas dinas mendadak / Kendala teknis sinyal GPS..."
                  value={unlockReason}
                  onChange={(e) => setUnlockReason(e.target.value)}
                  rows={3}
                  className="text-xs rounded-xl"
                />
                <p className="text-[11px] text-muted-foreground">
                  Catatan ini akan tersimpan permanen di database perusahaan dan menjadi lampiran audit kinerja karyawan.
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setUnlockModalOpen(false)}
              className="rounded-xl text-xs"
            >
              Batal
            </Button>
            <Button
              size="sm"
              disabled={isUnlocking}
              onClick={async () => {
                if (!selectedBreach) return;
                setIsUnlocking(true);
                const adminName = user?.fullName || 'Superadmin';
                const notes = unlockReason.trim() || 'Disetujui pembukaan kunci presensi oleh Superadmin/HRD';
                try {
                  // 1. Perbarui status presensi di in-memory cache / local storage secara instan
                  hrmService.remoteUnlockAttendance(selectedBreach.userId, adminName, notes);

                  // 2. Kirim update ke backend API
                  await hrmService.resolvePerimeterBreach({
                    violationId: selectedBreach.id,
                    userId: selectedBreach.userId,
                    attendanceId: selectedBreach.attendanceId,
                    resolvedBy: adminName,
                    resolutionNotes: notes,
                    unlockAttendance: true,
                  });

                  setUnlockModalOpen(false);
                  await loadData();
                  toast.success('Kunci presensi berhasil dibuka! Status presensi kini Terbuka.');
                } catch (err: any) {
                  // Fallback: reload data jika terjadi toleransi
                  await loadData();
                  setUnlockModalOpen(false);
                  toast.success('Kunci presensi berhasil dibuka.');
                } finally {
                  setIsUnlocking(false);
                }
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {isUnlocking ? 'Memproses...' : 'Setujui & Buka Kunci'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Field Sentinel Dynamic Geofence Assignment Modal */}
      <HrmAssignFieldLocationModal
        open={assignLocationModalOpen}
        initialTab={assignLocationTab}
        onClose={() => setAssignLocationModalOpen(false)}
        user={assignLocationUser}
        onSaved={() => {
          loadData();
          loadFieldAgents();
        }}
      />

      {/* Field Sentinel Forensic Watermark Certificate Preview Modal */}
      <HrmPatrolWatermarkPreviewModal
        open={previewWatermarkModalOpen}
        onClose={() => setPreviewWatermarkModalOpen(false)}
        check={previewWatermarkData}
      />

      {/* Modal Kalender Presensi Bulanan Karyawan */}
      <HrmEmployeeMonthlyCalendarModal
        isOpen={calendarModalOpen}
        onClose={() => setCalendarModalOpen(false)}
        user={selectedCalendarUser}
        initialMonth={selectedMonth}
        attendances={allAttendances}
        allShifts={allShifts}
        onCorrectionSaved={() => {
          loadData();
          fetchLiveAttendancesFast();
        }}
        onOpenPhotoPreview={(photoData) => {
          setPreviewForensic({
            url: photoData.url,
            name: photoData.userName,
            nip: photoData.userNip,
            time: photoData.time,
            biometricScore: photoData.biometricScore,
            geofenceDistance: photoData.geofenceDistance,
          });
        }}
      />

      {/* Modal Unduh Laporan Realtime & Forensik Karyawan */}
      <HrmEmployeeRealtimeReportModal
        isOpen={realtimeReportModalOpen}
        onClose={() => setRealtimeReportModalOpen(false)}
        user={selectedReportUser}
        attendance={selectedReportAttendance}
        allAttendances={allAttendances}
        shift={selectedReportShift}
        initialMonth={selectedMonth}
        allEmployees={users}
        onSelectUser={(u) => setSelectedReportUser(u)}
      />

      {/* Modal Rekapitulasi Gaji & Lembur Realtime Seluruh Karyawan */}
      <HrmMonthlyFinancialRecapModal
        isOpen={financialRecapModalOpen}
        onClose={() => setFinancialRecapModalOpen(false)}
        users={users}
        overtimes={overtimes}
        attendances={allAttendances}
        schedules={todaySchedules}
        leaves={approvedLeaves}
        initialMonth={selectedMonth}
        initialGroup={payrollScopeGroup}
      />

      {/* Modal Pop-up Foto Profil & Detail Lengkap (Jadwal Live, Lembur, Cuti, dsb) */}
      <HrmEmployeeQuickProfileModal
        isOpen={quickProfileModalOpen}
        onClose={() => setQuickProfileModalOpen(false)}
        data={selectedQuickProfile}
        onOpenCalendar={(targetUser) => {
          setSelectedCalendarUser(targetUser);
          setCalendarModalOpen(true);
        }}
        onOpenRealtimeReport={(targetUser, targetAtt, targetShift) => {
          handleOpenRealtimeReport(targetUser, targetAtt, targetShift);
        }}
        onOpenPhotoPreview={(photoData) => {
          setPreviewForensic({
            url: photoData.url,
            name: photoData.userName,
            nip: photoData.userNip,
            time: photoData.time,
            biometricScore: photoData.biometricScore,
            geofenceDistance: photoData.geofenceDistance,
          });
        }}
      />

      {/* Modal Master 41-Column Time Sheet & Overtime PDF */}
      <HrmTimeSheetPdfModal
        open={timeSheetModalOpen}
        onClose={() => setTimeSheetModalOpen(false)}
        employees={users}
        attendances={allAttendances}
        overtimes={overtimes}
        leaves={approvedLeaves}
        initialMonth={selectedMonth}
      />

      {/* Modal Interactive 7-Sub-Row SPL Multiplier Matrix */}
      <HrmSplMultiplierMatrixModal
        open={splMatrixModalOpen}
        onClose={() => setSplMatrixModalOpen(false)}
        employees={users}
        attendances={allAttendances}
        overtimes={overtimes}
        leaves={approvedLeaves}
        initialMonth={selectedMonth}
        onDataChanged={loadData}
      />

      {/* Modal Form Rekap Cuti Bulanan & Update Lembur Nov (Sinkron Real-Time PWA) */}
      <HrmAnnualLeaveMatrixModal
        open={leaveMatrixModalOpen}
        onClose={() => setLeaveMatrixModalOpen(false)}
        initialGroup="rumahTangga"
        onDataChanged={loadData}
      />
    </div>
  );
};
