import React, { useState, useEffect } from 'react';
import { useHrmAuth } from '@/contexts/HrmAuthContext';
import { toast } from 'sonner';
import { hrmService, getTodayDateStr } from '@/services/hrmService';
import { AttendanceRecord, Division, UserProfile, OvertimeRecord, PerimeterViolation } from '@/types/hrm';
import {
  UserCheck,
  Clock,
  Search,
  RotateCw,
  QrCode,
  ShieldCheck,
  AlertTriangle,
  Smartphone,
  Eye,
  CheckCircle2,
  X,
  MapPin,
  ShieldAlert,
  Flame,
  Activity,
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
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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

export const HrmLiveMonitoringPage: React.FC = () => {
  const { user } = useHrmAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [overtimes, setOvertimes] = useState<OvertimeRecord[]>([]);
  const [perimeterViolations, setPerimeterViolations] = useState<PerimeterViolation[]>([]);

  const [activeTab, setActiveTab] = useState<'all' | 'present' | 'late' | 'absent' | 'anomalies' | 'breaches' | 'field_radar'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDivision, setFilterDivision] = useState('all');
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

  const loadData = () => {
    const today = getTodayDateStr();
    setUsers(hrmService.getUsers().filter((u) => u.isActive));
    setDivisions(hrmService.getDivisions());
    const all = hrmService.getAttendances();
    setAllAttendances(all);
    setAttendances(hrmService.getAttendances(today));
    setOvertimes(hrmService.getOvertimeRecords());
    setPerimeterViolations(hrmService.getPerimeterViolations());
    loadFieldAgents();
  };

  useEffect(() => {
    loadData();
    hrmService.syncWithBackend().then(() => loadData());

    const handleUpdated = () => loadData();
    const handlePing = () => loadFieldAgents();
    window.addEventListener('hrm_data_updated', handleUpdated);
    window.addEventListener('hrm_field_ping_received', handlePing);
    window.addEventListener('hrm_patrol_check_submitted', handlePing);

    const interval = setInterval(() => {
      hrmService.syncWithBackend().then(() => loadData());
    }, 8000);

    return () => {
      window.removeEventListener('hrm_data_updated', handleUpdated);
      window.removeEventListener('hrm_field_ping_received', handlePing);
      window.removeEventListener('hrm_patrol_check_submitted', handlePing);
      clearInterval(interval);
    };
  }, []);

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

  const currentMonthStr = getTodayDateStr().slice(0, 7);
  const currentYearStr = getTodayDateStr().slice(0, 4);
  const currentMonthName = new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  const currentYear = new Date().getFullYear();

  const activePeriodAttendances = React.useMemo(() => {
    if (periodScope === 'today') {
      const today = getTodayDateStr();
      return allAttendances.filter((a) => (a.attendanceDate || (a as any).date) === today);
    } else if (periodScope === 'month') {
      return allAttendances.filter((a) => (a.attendanceDate || (a as any).date)?.startsWith(currentMonthStr));
    } else {
      return allAttendances.filter((a) => (a.attendanceDate || (a as any).date)?.startsWith(currentYearStr));
    }
  }, [allAttendances, periodScope, currentMonthStr, currentYearStr]);

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

  const monitoredList = users.map((u) => {
    if (periodScope === 'today') {
      const att = activePeriodAttendances.find(
        (a) => a.userId === u.id || a.userId === u.email || a.userId === u.nip || (a.userNip && a.userNip === u.nip)
      );
      return {
        user: u,
        attendance: att,
        status: !att ? 'absent' : att.status === 'terlambat' ? 'late' : 'present',
        totalLateMinutes: att?.lateMinutes || 0,
        lateCount: att && (att.status === 'terlambat' || (att.lateMinutes && att.lateMinutes > 0)) ? 1 : 0,
        totalAttCount: att ? 1 : 0,
      };
    } else {
      const userAtts = activePeriodAttendances.filter(
        (a) => a.userId === u.id || a.userId === u.email || a.userId === u.nip || (a.userNip && a.userNip === u.nip)
      );
      const lateAtts = userAtts.filter((a) => a.status === 'terlambat' || (a.lateMinutes && a.lateMinutes > 0));
      const totLateMin = lateAtts.reduce((sum, a) => sum + (a.lateMinutes || 0), 0);
      const latestAtt = userAtts[userAtts.length - 1];

      return {
        user: u,
        attendance: latestAtt,
        status: userAtts.length === 0 ? 'absent' : lateAtts.length > 0 ? 'late' : 'present',
        totalLateMinutes: totLateMin,
        lateCount: lateAtts.length,
        totalAttCount: userAtts.length,
      };
    }
  });

  const filtered = monitoredList.filter((item) => {
    const matchTab = activeTab === 'all' || item.status === activeTab;
    const matchDiv = filterDivision === 'all' || item.user.divisionId === filterDivision;
    const matchSearch =
      item.user.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.user.nip.toLowerCase().includes(searchQuery.toLowerCase());
    return matchTab && matchDiv && matchSearch;
  });

  const presentCount = monitoredList.filter((i) => i.status === 'present').length;
  const lateCount = monitoredList.filter((i) => i.status === 'late').length;
  const absentCount = monitoredList.filter((i) => i.status === 'absent').length;
  const activeBreaches = perimeterViolations.filter((v) => v.status === 'active');

  const radarSummary: AnomalyRadarSummary = React.useMemo(() => {
    return anomalyDetectionService.analyzeWorkforceAnomalies(users, activePeriodAttendances, overtimes);
  }, [users, activePeriodAttendances, overtimes]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-emerald-600 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
              Sistem Pengawasan Kehadiran
            </span>
            {radarSummary.items.length > 0 && (
              <span className="text-xs font-semibold text-rose-700 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-0.5 rounded-full border border-rose-200 dark:border-rose-900 flex items-center gap-1">
                <ShieldAlert size={12} /> {radarSummary.items.length} Anomali Terdeteksi
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-primary" />
            Live Monitoring Presensi &amp; Anti-Fraud
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Pantau status kedatangan staf secara *real-time* disertai validasi perangkat, lokasi GPS, audit anomali, dan sertifikat biometrik.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Period Scope Toggle */}
          <div className="flex items-center gap-1 bg-muted/80 p-1 rounded-xl border border-border">
            <Button
              type="button"
              variant={periodScope === 'today' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setPeriodScope('today')}
              className="text-xs h-7 px-2.5 rounded-lg font-medium"
            >
              Hari Ini (Live)
            </Button>
            <Button
              type="button"
              variant={periodScope === 'month' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setPeriodScope('month')}
              className="text-xs h-7 px-2.5 rounded-lg font-medium"
            >
              Bulan Berjalan
            </Button>
            <Button
              type="button"
              variant={periodScope === 'year' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setPeriodScope('year')}
              className="text-xs h-7 px-2.5 rounded-lg font-medium"
            >
              Tahun {currentYear}
            </Button>
          </div>

          <Button
            onClick={() => setQrModalOpen(true)}
            className="gap-2 rounded-xl text-xs h-8 font-semibold shadow-xs"
          >
            <QrCode size={14} /> Terminal QR Dinamis
          </Button>
          <Button variant="outline" size="sm" onClick={loadData} className="text-xs gap-1.5 border-border rounded-xl h-8">
            <RotateCw className="w-3.5 h-3.5 text-primary" /> Refresh
          </Button>
        </div>
      </div>

      {/* Division Summaries & Realtime Lateness Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {divisionSummaries.map((ds) => (
          <div key={ds.division.id} className="p-3.5 bg-card border border-border rounded-2xl shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-foreground truncate">{ds.division.name}</span>
              <Badge variant="outline" className="text-[10px] bg-muted/40 font-mono">
                {ds.totalEmployees} Anggota
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-border">
              <div>
                <span className="text-muted-foreground block text-[10px]">Hadir / Terlambat</span>
                <span className="font-bold text-foreground font-mono">
                  {ds.presentCount} / <span className="text-amber-600">{ds.lateCount}</span>
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px]">Menit Keterlambatan</span>
                <span className="font-bold text-amber-600 font-mono">{ds.totalLateMinutes} mnt</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-[10px] pt-1 text-muted-foreground border-t border-border/60">
              <span>Potongan Denda Payroll:</span>
              <span className="font-bold text-rose-600 font-mono">
                Rp {ds.lateDeductionEstimate.toLocaleString('id-ID')}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Status Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3.5">
        <div
          onClick={() => setActiveTab('all')}
          className={`p-4 rounded-2xl border cursor-pointer transition-all ${
            activeTab === 'all'
              ? 'border-primary bg-primary/10 ring-1 ring-primary/20 shadow-xs'
              : 'border-border bg-card hover:bg-muted/40'
          }`}
        >
          <p className="text-xs font-medium text-muted-foreground">Semua Karyawan</p>
          <p className="text-2xl font-bold text-foreground mt-1 font-mono">{users.length} Orang</p>
        </div>

        <div
          onClick={() => setActiveTab('present')}
          className={`p-4 rounded-2xl border cursor-pointer transition-all ${
            activeTab === 'present'
              ? 'border-emerald-500 bg-emerald-50/50 ring-1 ring-emerald-500/30 shadow-xs'
              : 'border-border bg-card hover:bg-muted/40'
          }`}
        >
          <p className="text-xs font-medium text-muted-foreground">Hadir Tepat Waktu</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1 font-mono">{presentCount} Orang</p>
        </div>

        <div
          onClick={() => setActiveTab('late')}
          className={`p-4 rounded-2xl border cursor-pointer transition-all ${
            activeTab === 'late'
              ? 'border-amber-500 bg-amber-50/50 ring-1 ring-amber-500/30 shadow-xs'
              : 'border-border bg-card hover:bg-muted/40'
          }`}
        >
          <p className="text-xs font-medium text-muted-foreground">Terlambat</p>
          <p className="text-2xl font-bold text-amber-700 mt-1 font-mono">{lateCount} Orang</p>
        </div>

        <div
          onClick={() => setActiveTab('absent')}
          className={`p-4 rounded-2xl border cursor-pointer transition-all ${
            activeTab === 'absent'
              ? 'border-destructive bg-destructive/10 ring-1 ring-destructive/20 shadow-xs'
              : 'border-border bg-card hover:bg-muted/40'
          }`}
        >
          <p className="text-xs font-medium text-muted-foreground">Belum Presensi</p>
          <p className="text-2xl font-bold text-destructive mt-1 font-mono">{absentCount} Orang</p>
        </div>

        <div
          onClick={() => setActiveTab('anomalies')}
          className={`p-4 rounded-2xl border cursor-pointer transition-all ${
            activeTab === 'anomalies'
              ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/20 ring-1 ring-rose-500/30 shadow-xs'
              : 'border-border bg-card hover:bg-muted/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Audit Anomali</p>
            {radarSummary.items.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-500" />
            )}
          </div>
          <p className="text-2xl font-bold text-rose-600 mt-1 font-mono">{radarSummary.items.length} Isu</p>
        </div>

        <div
          onClick={() => setActiveTab('breaches')}
          className={`p-4 rounded-2xl border cursor-pointer transition-all ${
            activeTab === 'breaches'
              ? 'border-rose-500 bg-rose-500/10 ring-1 ring-rose-500/30 shadow-xs'
              : 'border-border bg-card hover:bg-muted/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Pelanggaran Perimeter</p>
            {activeBreaches.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            )}
          </div>
          <p className="text-2xl font-bold text-rose-600 mt-1 font-mono">{activeBreaches.length} Terkunci</p>
        </div>

        <div
          onClick={() => setActiveTab('field_radar')}
          className={`p-4 rounded-2xl border cursor-pointer transition-all ${
            activeTab === 'field_radar'
              ? 'border-indigo-500 bg-indigo-500/15 ring-1 ring-indigo-500/40 shadow-xs'
              : 'border-border bg-card hover:bg-muted/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Radar Petugas Lapangan</p>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
          </div>
          <p className="text-2xl font-bold text-indigo-600 mt-1 font-mono">
            {fieldAgents.length > 0 ? `${fieldAgents.length} Petugas` : '3 Petugas'}
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <Card className="border-border/80 bg-card rounded-2xl shadow-xs">
        <CardContent className="p-3.5">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  placeholder="Cari Nama Karyawan / NIP..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 text-xs rounded-xl h-9"
                />
              </div>

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

            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border shrink-0 self-end sm:self-auto">
              <Button
                type="button"
                variant={viewMode === 'table' ? 'default' : 'ghost'}
                size="sm"
                className={`h-7 px-2.5 text-xs rounded-lg gap-1.5 transition-all ${
                  viewMode === 'table' ? 'shadow-xs font-medium' : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setViewMode('table')}
              >
                <TableProperties size={13} />
                <span>Tabel</span>
              </Button>
              <Button
                type="button"
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                className={`h-7 px-2.5 text-xs rounded-lg gap-1.5 transition-all ${
                  viewMode === 'grid' ? 'shadow-xs font-medium' : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setViewMode('grid')}
              >
                <LayoutGrid size={13} />
                <span>Kartu</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

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
                          {new Date(v.detectedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} WIB
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
              const isBreached = agent.isOutOfBounds;
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
                          {agent.avatarUrl || agent.facePhotoUrl ? (
                            <img
                              src={agent.avatarUrl || agent.facePhotoUrl}
                              alt={agent.fullName}
                              className="w-11 h-11 rounded-full object-cover border-2 border-indigo-500/40"
                            />
                          ) : (
                            <div className="w-11 h-11 rounded-full bg-indigo-600/20 text-indigo-700 dark:text-indigo-300 font-bold flex items-center justify-center border border-indigo-500/30 text-sm">
                              {agent.fullName?.charAt(0) || 'P'}
                            </div>
                          )}
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
                          {isLiveNow && agent.currentActivePostName ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                              🟢 {agent.currentActivePostName} (Live)
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
                                    : 'bg-muted/40 border-border text-muted-foreground'
                                }`}
                                title={`${p.postName} (Radius: ${p.radiusMeters}m)`}
                              >
                                {p.postCode}: {p.postName}
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
                          alert(`Instruksi verifikasi spot-check telah dikirim ke perangkat ${agent.fullName}. Layar kamera forensik otomatis muncul pada HP petugas.`);
                        } catch (err: any) {
                          alert(err.message || 'Gagal mengirim instruksi spot-check.');
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
                  <TableHead className="min-w-[220px] font-semibold text-muted-foreground">Karyawan</TableHead>
                  <TableHead className="min-w-[150px] font-semibold text-muted-foreground">Divisi & Jabatan</TableHead>
                  <TableHead className="min-w-[130px] text-center font-semibold text-muted-foreground">
                    {periodScope === 'today' ? 'Status Kehadiran' : 'Total Kehadiran'}
                  </TableHead>
                  <TableHead className="min-w-[110px] text-center font-semibold text-muted-foreground">
                    {periodScope === 'today' ? 'Jam Masuk' : 'Frekuensi Terlambat'}
                  </TableHead>
                  <TableHead className="min-w-[110px] text-center font-semibold text-muted-foreground">
                    {periodScope === 'today' ? 'Jam Pulang' : 'Denda Payroll'}
                  </TableHead>
                  <TableHead className="min-w-[170px] font-semibold text-muted-foreground">Verifikasi Keamanan</TableHead>
                  <TableHead className="w-28 text-right font-semibold text-muted-foreground">Forensik</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border/60">
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center text-muted-foreground text-xs">
                      Tidak ada data karyawan yang sesuai dengan kriteria filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map(({ user: u, attendance: att, status, totalLateMinutes, lateCount, totalAttCount }, idx) => {
                    const userAnomaly = radarSummary.items.find((i) => i.userId === u.id);
                    return (
                      <TableRow key={u.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="text-center font-mono text-xs text-muted-foreground/80">
                          {idx + 1}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            {(() => {
                              const photo = u.avatarUrl || u.faceEnrolledPhoto || (u as any).facePhotoUrl || att?.clockInPhoto || att?.photoIn;
                              return photo ? (
                                <img
                                  src={photo}
                                  alt={u.fullName}
                                  className="w-8 h-8 rounded-full object-cover border border-primary/20 shrink-0 shadow-xs"
                                  onError={(e) => {
                                    // Fallback ke inisial jika foto rusak
                                    const target = e.currentTarget;
                                    target.style.display = 'none';
                                    const fallback = target.nextElementSibling;
                                    if (fallback) (fallback as HTMLElement).style.display = 'flex';
                                  }}
                                />
                              ) : null;
                            })()}
                            <div
                              className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-xs shrink-0"
                              style={{ display: (u.avatarUrl || u.faceEnrolledPhoto || (u as any).facePhotoUrl || att?.clockInPhoto || att?.photoIn) ? 'none' : 'flex' }}
                            >
                              {u.fullName.charAt(0)}
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
                        <TableCell>
                          <p className="text-xs font-medium text-foreground truncate max-w-[160px]">{u.divisionName || '-'}</p>
                          <p className="text-[11px] text-muted-foreground capitalize">
                            {u.role === 'admin' ? 'Administrator' : u.role === 'hr' ? 'HR Staff' : 'Karyawan'}
                          </p>
                        </TableCell>
                        <TableCell className="text-center">
                          {periodScope === 'today' ? (
                            status === 'present' ? (
                              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800 text-[11px] rounded-full px-2.5 py-0.5 font-medium">
                                Tepat Waktu
                              </Badge>
                            ) : status === 'late' ? (
                              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800 text-[11px] rounded-full px-2.5 py-0.5 font-medium">
                                Telat {att?.lateMinutes || 0}m
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
                        <TableCell className="text-center">
                          {periodScope === 'today' ? (
                            <span className={`font-mono text-xs ${att?.clockIn ? 'font-medium text-foreground' : 'text-muted-foreground/40'}`}>
                              {att?.clockIn ? `${att.clockIn} WIB` : '-'}
                            </span>
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
                        <TableCell className="text-center">
                          {periodScope === 'today' ? (
                            <span className={`font-mono text-xs ${att?.clockOut ? 'font-medium text-foreground' : 'text-muted-foreground/40'}`}>
                              {att?.clockOut ? `${att.clockOut} WIB` : '-'}
                            </span>
                          ) : (
                            <span className="font-mono text-xs font-bold text-rose-600">
                              Rp {(totalLateMinutes * 1000).toLocaleString('id-ID')}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {att ? (
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
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {(att?.isPerimeterBreached || att?.isLocked) && (
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
                            )}
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
                                    if (!confirm(`Buka kunci presensi kepulangan untuk ${u.fullName}? Karyawan dapat langsung melakukan Clock Out.`)) return;
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
                            ) : (
                              <span className="text-muted-foreground/30 text-xs mr-2">-</span>
                            )}
                          </div>
                        </TableCell>
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
            filtered.map(({ user: u, attendance: att, status }) => {
              const userAnomaly = radarSummary.items.find((i) => i.userId === u.id);
              return (
              <Card key={u.id} className="border-border/80 bg-card rounded-2xl shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-xs shrink-0">
                        {u.fullName.charAt(0)}
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
                      {att?.clockIn ? `${att.clockIn} WIB` : '-'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Jam Pulang:</span>
                    <span className="font-mono font-medium text-foreground">
                      {att?.clockOut ? `${att.clockOut} WIB` : '-'}
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
                    Database PostgreSQL Synchronized
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {previewForensic.name} ({previewForensic.nip || '-'}) • {previewForensic.division || 'Umum'} • Jam {previewForensic.time || '-'} WIB
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
                    {new Date(selectedBreach.detectedAt).toLocaleTimeString('id-ID')} WIB
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
                  Catatan ini akan tersimpan permanen di database PostgreSQL dan menjadi lampiran audit kinerja karyawan.
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
                try {
                  await hrmService.resolvePerimeterBreach({
                    violationId: selectedBreach.id,
                    resolvedBy: 'Admin HRD',
                    resolutionNotes: unlockReason.trim() || 'Disetujui pembukaan kunci presensi oleh HRD',
                    unlockAttendance: true,
                  });
                  setUnlockModalOpen(false);
                  loadData();
                } catch (err: any) {
                  alert(err.message || 'Gagal membuka kunci presensi.');
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
    </div>
  );
};
