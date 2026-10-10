import React, { useState, useEffect } from 'react';
import { hrmService } from '@/services/hrmService';
import { fieldSentinelService } from '@/services/fieldSentinelService';
import { Division, UserProfile, DivisionAssignedPost, FIELD_SENTINEL_6_POST_PRESETS } from '@/types/hrm';
import {
  Building2,
  Plus,
  Edit2,
  Trash2,
  Users,
  AlertCircle,
  MapPin,
  Crosshair,
  ExternalLink,
  CheckCircle2,
  User,
  UserPlus,
  UserMinus,
  Search,
  X,
  Shield,
  Mail,
  Phone,
  QrCode,
  Copy,
  Check,
  Timer,
  Monitor,
  Calendar,
  CalendarDays,
  Download,
  Clock,
  ShieldCheck,
  Upload,
  Database,
  Save,
  FileSpreadsheet,
  CheckCheck,
  Loader2,
  FileUp,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import {
  generateSmartRoster,
  DEFAULT_SHIFTS,
  GenerationResult,
  EmployeeScheduleTarget,
  EmployeeRoster,
} from '@/services/rosterSchedulerService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import QRCode from 'qrcode';
import { toast } from 'sonner';

export const HrmDivisionsPage: React.FC = () => {
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [divisionEmployeesMap, setDivisionEmployeesMap] = useState<Record<string, UserProfile[]>>({});

  // Add / Edit Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDiv, setEditingDiv] = useState<Division | null>(null);

  // Terminal Barcode Modal
  const [terminalModalOpen, setTerminalModalOpen] = useState(false);
  const [selectedTerminalDiv, setSelectedTerminalDiv] = useState<Division | null>(null);
  const [terminalQrData, setTerminalQrData] = useState<{ code: string; expiresAt: number; remainingSeconds: number } | null>(null);
  const [terminalQrImageUrl, setTerminalQrImageUrl] = useState<string>('');
  const [copiedToken, setCopiedToken] = useState(false);

  // Form Fields
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [leader, setLeader] = useState('');
  const [locationName, setLocationName] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState<number>(-6.225);
  const [longitude, setLongitude] = useState<number>(106.809);
  const [radiusMeters, setRadiusMeters] = useState<number>(150);
  const [allowedPosts, setAllowedPosts] = useState<DivisionAssignedPost[]>([]);
  const [officialPostsList, setOfficialPostsList] = useState<DivisionAssignedPost[]>(FIELD_SENTINEL_6_POST_PRESETS);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [detectedAccuracy, setDetectedAccuracy] = useState<number | null>(null);
  const [detectedTime, setDetectedTime] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Employee List Modal for specific division (with Add & Remove Employee features)
  const [viewEmployeesDiv, setViewEmployeesDiv] = useState<Division | null>(null);
  const [employeeModalOpen, setEmployeeModalOpen] = useState(false);
  const [isAddEmpOpen, setIsAddEmpOpen] = useState(false);
  const [selectedEmpIdToAdd, setSelectedEmpIdToAdd] = useState<string>('');
  const [searchEmpInDiv, setSearchEmpInDiv] = useState<string>('');
  const [searchEmpToAdd, setSearchEmpToAdd] = useState<string>('');
  const [isAddingEmp, setIsAddingEmp] = useState(false);

  // Smart Roster AI Modal State
  const [rosterModalOpen, setRosterModalOpen] = useState(false);
  const [rosterSelectedDivId, setRosterSelectedDivId] = useState<string>('all');
  const [rosterMonth, setRosterMonth] = useState<number>(new Date().getMonth() + 1);
  const [rosterYear, setRosterYear] = useState<number>(new Date().getFullYear());
  const [rosterQuotaPagi, setRosterQuotaPagi] = useState<number>(2);
  const [rosterQuotaSiang, setRosterQuotaSiang] = useState<number>(2);
  const [rosterQuotaMalam, setRosterQuotaMalam] = useState<number>(1);
  const [rosterMaxStreak, setRosterMaxStreak] = useState<number>(5);
  const [rosterResult, setRosterResult] = useState<GenerationResult | null>(null);

  // Persistence & Import States
  const [isSavedInDb, setIsSavedInDb] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [applySuccessMsg, setApplySuccessMsg] = useState<string | null>(null);

  // Import CSV State
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importCsvText, setImportCsvText] = useState('');
  const [importFileName, setImportFileName] = useState('');
  const [importPreviewRows, setImportPreviewRows] = useState<Array<{
    employeeId: string;
    employeeName: string;
    nip: string;
    matched: boolean;
    shifts: Record<string, string>;
    totalPagi: number;
    totalSiang: number;
    totalMalam: number;
    totalOff: number;
  }>>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importDirectSave, setImportDirectSave] = useState(true);

  const getTargetEmployees = (divId: string = rosterSelectedDivId): EmployeeScheduleTarget[] => {
    const allUsers = users.length > 0 ? users : hrmService.getUsers();
    if (divId === 'all') {
      return allUsers.map((u) => ({
        id: u.id,
        name: u.fullName,
        position: u.roleName,
        divisionId: u.divisionId,
      }));
    } else {
      const emps = divisionEmployeesMap[divId] || allUsers.filter((u) => u.divisionId === divId);
      return emps.map((u) => ({
        id: u.id,
        name: u.fullName,
        position: u.roleName,
        divisionId: u.divisionId,
      }));
    }
  };

  const handleRunRosterScheduler = (overrideDivId?: string, overrideMonth?: number) => {
    const targetDivId = overrideDivId !== undefined ? overrideDivId : rosterSelectedDivId;
    const targetMonth = overrideMonth !== undefined ? overrideMonth : rosterMonth;
    const targetEmployees = getTargetEmployees(targetDivId);

    const res = generateSmartRoster({
      month: targetMonth,
      year: rosterYear,
      employees: targetEmployees,
      requiredPerShift: {
        pagi: rosterQuotaPagi,
        siang: rosterQuotaSiang,
        malam: rosterQuotaMalam,
      },
      maxConsecutiveWorkDays: rosterMaxStreak,
    });
    setRosterResult(res);
    setIsSavedInDb(false);
  };

  const loadOrRunRoster = (divId: string = rosterSelectedDivId, month: number = rosterMonth) => {
    const saved = hrmService.getSavedRosterResult(month, rosterYear, divId);
    if (saved && saved.rosters.length > 0) {
      setRosterResult(saved);
      setIsSavedInDb(true);
    } else {
      handleRunRosterScheduler(divId, month);
    }
  };

  const handleApplyToDatabase = async () => {
    if (!rosterResult || rosterResult.rosters.length === 0) return;
    try {
      setIsApplying(true);
      const res = await hrmService.applyRosterToDatabase(rosterResult, rosterSelectedDivId);
      setIsSavedInDb(true);
      setApplySuccessMsg(res.message || 'Jadwal shift berhasil diterapkan ke database!');
      setTimeout(() => setApplySuccessMsg(null), 6000);
    } catch (err: any) {
      alert('Gagal menerapkan jadwal ke database: ' + (err.message || 'Kesalahan sistem'));
    } finally {
      setIsApplying(false);
    }
  };

  const handleToggleCellShift = (employeeId: string, dayNum: number) => {
    if (!rosterResult) return;
    const dateStr = `${rosterResult.year}-${String(rosterResult.month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    const dt = new Date(dateStr);
    const dayOfWeek = dt.getDay();

    const nextShiftMap: Record<string, string> = {
      P: 'S',
      S: 'M',
      M: 'OFF',
      OFF: 'P',
    };

    const updatedRosters = rosterResult.rosters.map((r) => {
      if (r.employeeId !== employeeId) return r;
      const currentCode = r.assignments[dateStr]?.shiftCode || 'OFF';
      const nextCode = nextShiftMap[currentCode] || 'P';

      const newAssignments = {
        ...r.assignments,
        [dateStr]: {
          date: dateStr,
          dayOfWeek,
          shiftId: `shift-${nextCode.toLowerCase()}`,
          shiftCode: nextCode,
        },
      };

      let totalWorkHours = 0;
      let totalWorkDays = 0;
      let totalNightShifts = 0;
      let totalOffDays = 0;

      Object.values(newAssignments).forEach((asg) => {
        if (asg.shiftCode === 'P') {
          totalWorkHours += 8;
          totalWorkDays += 1;
        } else if (asg.shiftCode === 'S') {
          totalWorkHours += 7;
          totalWorkDays += 1;
        } else if (asg.shiftCode === 'M') {
          totalWorkHours += 9;
          totalWorkDays += 1;
          totalNightShifts += 1;
        } else {
          totalOffDays += 1;
        }
      });

      return {
        ...r,
        assignments: newAssignments,
        totalWorkHours,
        totalWorkDays,
        totalNightShifts,
        totalOffDays,
      };
    });

    setRosterResult({
      ...rosterResult,
      rosters: updatedRosters,
    });
    setIsSavedInDb(false);
  };

  const handleExportRosterCsv = () => {
    if (!rosterResult) return;
    const days = Array.from({ length: rosterResult.daysInMonth }, (_, i) => i + 1);
    const headers = ['Nama Karyawan', ...days.map((d) => `Tgl ${d}`), 'Total Jam', 'Hari Kerja', 'Shift Malam'];
    const rows = rosterResult.rosters.map((r) => {
      const dayValues = days.map((d) => {
        const dateStr = `${rosterResult.year}-${String(rosterResult.month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        return r.assignments[dateStr]?.shiftCode || 'OFF';
      });
      return [r.employeeName, ...dayValues, r.totalWorkHours, r.totalWorkDays, r.totalNightShifts];
    });
    const csvContent = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `roster_shift_${rosterResult.month}_${rosterResult.year}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // ─── POWERFUL CSV IMPORT LOGIC ───
  const handleDownloadCsvTemplate = () => {
    const daysInMonth = new Date(rosterYear, rosterMonth, 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const targetEmployees = getTargetEmployees();
    const allUsers = users.length > 0 ? users : hrmService.getUsers();

    const headers = ['NIP', 'Nama Karyawan', 'Divisi', ...days.map((d) => `Tgl_${d}`)];
    const rows = targetEmployees.map((emp) => {
      const userObj = allUsers.find((u) => u.id === emp.id);
      const defaultShifts = days.map((_, idx) => {
        const mod = (idx + (emp.name.charCodeAt(0) % 4)) % 4;
        return mod === 0 ? 'P' : mod === 1 ? 'S' : mod === 2 ? 'M' : 'OFF';
      });
      return [
        `"${userObj?.nip || ''}"`,
        `"${emp.name.replace(/"/g, '""')}"`,
        `"${userObj?.divisionName || 'Pusat'}"`,
        ...defaultShifts,
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `template_import_roster_${rosterMonth}_${rosterYear}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Helper to parse CSV line respecting quotes
  const parseCsvLine = (line: string): string[] => {
    const result: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += c;
      }
    }
    result.push(cur.trim());
    return result;
  };

  const normalizeShiftCode = (val: string): string => {
    const raw = (val || '').toUpperCase().trim();
    if (['P', 'PAGI', 'P1', 'MORNING', '1'].includes(raw)) return 'P';
    if (['S', 'SIANG', 'S1', 'AFTERNOON', 'SORE', '2'].includes(raw)) return 'S';
    if (['M', 'MALAM', 'M1', 'NIGHT', '3'].includes(raw)) return 'M';
    if (['OFF', 'LIBUR', 'L', 'O', '0', '-', 'REST'].includes(raw)) return 'OFF';
    return 'OFF';
  };

  const handleParseImportCsv = (csvText: string) => {
    const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      setImportErrors(['File CSV kosong atau tidak memiliki baris data']);
      setImportPreviewRows([]);
      return;
    }

    const allUsers = users.length > 0 ? users : hrmService.getUsers();
    const daysInMonth = new Date(rosterYear, rosterMonth, 0).getDate();
    const headerCols = parseCsvLine(lines[0]);

    // Find indices
    let nameIdx = -1;
    let nipIdx = -1;
    const dayIndices: Record<number, number> = {};

    headerCols.forEach((col, idx) => {
      const clean = col.toLowerCase().replace(/['"_]/g, ' ').trim();
      if (clean.includes('nama') || clean === 'name' || clean === 'karyawan') {
        nameIdx = idx;
      } else if (clean === 'nip' || clean.includes('nomor induk')) {
        nipIdx = idx;
      } else {
        // Match day number
        const match = clean.match(/(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num >= 1 && num <= daysInMonth) {
            dayIndices[num] = idx;
          }
        }
      }
    });

    if (nameIdx === -1 && nipIdx === -1) {
      setImportErrors(['Kolom "Nama Karyawan" atau "NIP" tidak terdeteksi pada header CSV']);
      setImportPreviewRows([]);
      return;
    }

    const errors: string[] = [];
    const previewList: Array<{
      employeeId: string;
      employeeName: string;
      nip: string;
      matched: boolean;
      shifts: Record<string, string>;
      totalPagi: number;
      totalSiang: number;
      totalMalam: number;
      totalOff: number;
    }> = [];

    for (let i = 1; i < lines.length; i++) {
      const row = parseCsvLine(lines[i]);
      if (row.length === 0 || row.every((c) => c === '')) continue;

      const rawName = nameIdx !== -1 ? row[nameIdx] || '' : '';
      const rawNip = nipIdx !== -1 ? row[nipIdx] || '' : '';

      // Match user
      const matchedUser = allUsers.find((u) => {
        if (rawNip && u.nip && u.nip.trim() === rawNip.trim()) return true;
        if (rawName && u.fullName.toLowerCase().trim() === rawName.toLowerCase().trim()) return true;
        if (rawName && (u.fullName.toLowerCase().includes(rawName.toLowerCase()) || rawName.toLowerCase().includes(u.fullName.toLowerCase()))) return true;
        return false;
      });

      if (!matchedUser) {
        errors.push(`Baris ${i + 1}: Karyawan "${rawName || rawNip}" tidak terdaftar di database sistem`);
      }

      const shifts: Record<string, string> = {};
      let pagi = 0, siang = 0, malam = 0, off = 0;

      for (let d = 1; d <= daysInMonth; d++) {
        const colIdx = dayIndices[d];
        const val = colIdx !== undefined && colIdx < row.length ? row[colIdx] : '';
        const code = normalizeShiftCode(val);
        shifts[String(d)] = code;

        if (code === 'P') pagi++;
        else if (code === 'S') siang++;
        else if (code === 'M') malam++;
        else off++;
      }

      previewList.push({
        employeeId: matchedUser?.id || `unmatched-${i}`,
        employeeName: matchedUser?.fullName || rawName || `Baris ${i + 1}`,
        nip: matchedUser?.nip || rawNip || '-',
        matched: Boolean(matchedUser),
        shifts,
        totalPagi: pagi,
        totalSiang: siang,
        totalMalam: malam,
        totalOff: off,
      });
    }

    setImportErrors(errors);
    setImportPreviewRows(previewList);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setImportCsvText(content);
      handleParseImportCsv(content);
    };
    reader.readAsText(file);
  };

  const handleExecuteImport = async () => {
    if (importPreviewRows.length === 0) return;
    const validRows = importPreviewRows.filter((r) => r.matched);
    if (validRows.length === 0) {
      alert('Tidak ada baris karyawan yang cocok dengan database sistem untuk diimpor.');
      return;
    }

    const daysInMonth = new Date(rosterYear, rosterMonth, 0).getDate();
    const monthStr = String(rosterMonth).padStart(2, '0');

    const importedRosters: EmployeeRoster[] = validRows.map((r) => {
      const assignments: Record<string, any> = {};
      let totalWorkHours = 0;
      let totalWorkDays = 0;
      let totalNightShifts = 0;
      let totalOffDays = 0;

      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${rosterYear}-${monthStr}-${String(d).padStart(2, '0')}`;
        const dt = new Date(dateStr);
        const code = r.shifts[String(d)] || 'OFF';

        assignments[dateStr] = {
          date: dateStr,
          dayOfWeek: dt.getDay(),
          shiftId: `shift-${code.toLowerCase()}`,
          shiftCode: code,
        };

        if (code === 'P' || code === 'S' || code === 'M') {
          totalWorkHours += 8;
          totalWorkDays += 1;
          if (code === 'M') totalNightShifts += 1;
        } else {
          totalOffDays += 1;
        }
      }

      return {
        employeeId: r.employeeId,
        employeeName: r.employeeName,
        assignments,
        totalWorkHours,
        totalWorkDays,
        totalNightShifts,
        totalOffDays,
      };
    });

    const newResult: GenerationResult = {
      month: rosterMonth,
      year: rosterYear,
      daysInMonth,
      rosters: importedRosters,
      audit: {
        violations: [],
        fairnessIndex: 88,
        laborLawCompliance: true,
      },
    };

    setRosterResult(newResult);

    if (importDirectSave) {
      try {
        setIsApplying(true);
        const res = await hrmService.applyRosterToDatabase(newResult, rosterSelectedDivId);
        setIsSavedInDb(true);
        setApplySuccessMsg(`Berhasil mengimpor dan menyimpan ${res.count} jadwal shift ke database!`);
        setTimeout(() => setApplySuccessMsg(null), 6000);
      } catch (err: any) {
        alert('Jadwal berhasil dimuat ke matriks, namun gagal simpan otomatis ke database: ' + err.message);
        setIsSavedInDb(false);
      } finally {
        setIsApplying(false);
      }
    } else {
      setIsSavedInDb(false);
    }

    setImportModalOpen(false);
  };

  const loadData = () => {
    const divs = hrmService.getDivisions();
    setDivisions(divs);

    const allUsers = hrmService.getUsers();
    setUsers(allUsers);

    const map: Record<string, UserProfile[]> = {};
    divs.forEach((d) => {
      map[d.id] = allUsers.filter((u) => u.divisionId === d.id);
    });
    setDivisionEmployeesMap(map);
  };

  const loadPosts = async () => {
    try {
      const dbPosts = await fieldSentinelService.getFieldPosts();
      if (Array.isArray(dbPosts) && dbPosts.length > 0) {
        const map = new Map<string, DivisionAssignedPost>();
        FIELD_SENTINEL_6_POST_PRESETS.forEach((p) => {
          const key = `${p.latitude.toFixed(6)}_${p.longitude.toFixed(6)}`;
          map.set(key, p);
        });
        dbPosts.forEach((p) => {
          const key = `${Number(p.latitude).toFixed(6)}_${Number(p.longitude).toFixed(6)}`;
          const existing = map.get(key);
          map.set(key, {
            code: p.postCode || existing?.code || p.postName.toUpperCase(),
            name: p.postName,
            latitude: Number(p.latitude),
            longitude: Number(p.longitude),
            radiusMeters: Number(p.radiusMeters) || 50,
            description: p.description || existing?.description || p.postName,
            allowClockIn: existing ? existing.allowClockIn : true,
            allowClockOut: existing ? existing.allowClockOut : true,
            isClockOutOnly: existing ? existing.isClockOutOnly : false,
          });
        });
        setOfficialPostsList(Array.from(map.values()));
      }
    } catch (err) {
      console.warn('Gagal memuat pos lapangan dinamis:', err);
    }
  };

  useEffect(() => {
    loadData();
    loadPosts();
  }, []);

  // Update dynamic terminal barcode every second when terminal modal is open
  useEffect(() => {
    if (!terminalModalOpen || !selectedTerminalDiv) return;

    const updateQr = () => {
      const qr = hrmService.getDynamicOfficeQrCode(selectedTerminalDiv.id);
      setTerminalQrData(qr);
    };

    updateQr();
    const interval = setInterval(updateQr, 1000);
    return () => clearInterval(interval);
  }, [terminalModalOpen, selectedTerminalDiv]);

  // Generate square 2D QR Code image
  useEffect(() => {
    if (!terminalModalOpen || !terminalQrData?.code) return;
    QRCode.toDataURL(terminalQrData.code, {
      width: 320,
      margin: 1.5,
      color: {
        dark: '#020617',
        light: '#ffffff',
      },
    })
      .then((url) => setTerminalQrImageUrl(url))
      .catch((err) => console.error('Failed generating terminal QR code:', err));
  }, [terminalQrData?.code, terminalModalOpen]);

  const handleOpenTerminal = (d: Division) => {
    setSelectedTerminalDiv(d);
    setTerminalQrData(hrmService.getDynamicOfficeQrCode(d.id));
    setCopiedToken(false);
    setTerminalModalOpen(true);
  };

  const handleCopyToken = () => {
    if (terminalQrData) {
      navigator.clipboard.writeText(terminalQrData.code);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    }
  };

  const handleOpenAdd = () => {
    const defaultOffice = hrmService.getOfficeLocation();
    setEditingDiv(null);
    setCode('');
    setName('');
    setDesc('');
    setLeader('');
    setLocationName('');
    setAddress(defaultOffice?.address || '');
    setLatitude(defaultOffice?.latitude || -6.225);
    setLongitude(defaultOffice?.longitude || 106.809);
    setRadiusMeters(150);
    setAllowedPosts(officialPostsList.map((p) => ({ ...p })));
    setError(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (d: Division) => {
    setEditingDiv(d);
    setCode(d.code);
    setName(d.name);
    setDesc(d.description || '');
    setLeader(d.leaderName || '');
    setLocationName(d.locationName || `Gedung Kantor Divisi ${d.name}`);
    setAddress(d.address || '');
    setLatitude(typeof d.latitude === 'number' ? d.latitude : -6.225);
    setLongitude(typeof d.longitude === 'number' ? d.longitude : 106.809);
    setRadiusMeters(d.radiusMeters || 150);
    setAllowedPosts(
      Array.isArray(d.allowedPosts) && d.allowedPosts.length > 0
        ? d.allowedPosts
        : officialPostsList.map((p) => ({ ...p }))
    );
    setError(null);
    setModalOpen(true);
  };

  const handleGetCoordinates = () => {
    if (!navigator.geolocation) {
      toast.error('Perangkat atau browser Anda tidak mendukung fitur geolokasi GPS.');
      return;
    }
    setGettingLocation(true);

    const applyLocationSuccess = (pos: GeolocationPosition, isFallback = false) => {
      const lat = Number(pos.coords.latitude.toFixed(6));
      const lng = Number(pos.coords.longitude.toFixed(6));
      const acc = Math.round(pos.coords.accuracy || 0);
      const timeStr = new Date().toLocaleTimeString('id-ID');

      setLatitude(lat);
      setLongitude(lng);
      setDetectedAccuracy(acc);
      setDetectedTime(timeStr);
      setGettingLocation(false);

      toast.success(
        `Titik GPS Berhasil Dideteksi! Lat: ${lat}, Lng: ${lng} (Akurasi: ±${acc}m${isFallback ? ' via Jaringan' : ''})`,
        { duration: 5000 }
      );
    };

    // 1. Coba High Accuracy dengan batas waktu 8 detik & fresh reading (maximumAge: 0)
    navigator.geolocation.getCurrentPosition(
      (pos) => applyLocationSuccess(pos, false),
      (highAccErr) => {
        console.warn('[GPS Detection] Mode GPS akurasi tinggi lambat/gagal, beralih ke mode jaringan...', highAccErr);

        // 2. Fallback mode jaringan (sangat efektif di laptop / PC kantor tanpa chip satelit GPS)
        navigator.geolocation.getCurrentPosition(
          (fallbackPos) => applyLocationSuccess(fallbackPos, true),
          (finalErr) => {
            setGettingLocation(false);
            console.error('[GPS Detection] Gagal deteksi lokasi:', finalErr);
            if (finalErr.code === 1) {
              toast.error(
                'Izin lokasi ditolak di browser. Klik ikon gembok / lokasi di address bar browser dan pilih "Izinkan" untuk fawwazreskiperwira.com',
                { duration: 8000 }
              );
            } else if (finalErr.code === 3) {
              toast.error(
                'Deteksi lokasi timeout. Anda dapat menyalin koordinat titik lokasi langsung dari Google Maps.',
                { duration: 6000 }
              );
            } else {
              toast.error(
                `Gagal mengambil koordinat (${finalErr.message}). Silakan ketik titik koordinat secara manual atau buka Google Maps.`,
                { duration: 6000 }
              );
            }
          },
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 }
        );
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  };

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setError(null);
    if (!code.trim()) {
      setError('Kode divisi wajib diisi (misal: IT, HRD, FIN)');
      return;
    }
    if (!name.trim()) {
      setError('Nama divisi wajib diisi');
      return;
    }

    try {
      setSaving(true);
      const payload: Partial<Division> = {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        description: desc.trim(),
        leaderName: leader.trim(),
        locationName: locationName.trim() || `Lokasi Divisi ${name.trim()}`,
        address: address.trim(),
        latitude: Number(latitude),
        longitude: Number(longitude),
        radiusMeters: Number(radiusMeters) || 150,
        allowedPosts: allowedPosts,
      };

      if (editingDiv) {
        await hrmService.updateDivision(editingDiv.id, payload);
      } else {
        await hrmService.addDivision(payload as any);
      }
      setModalOpen(false);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan divisi ke database');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (d: Division) => {
    const emps = divisionEmployeesMap[d.id] || [];
    if (emps.length > 0) {
      alert(`Divisi "${d.name}" tidak dapat dihapus karena masih memiliki ${emps.length} karyawan terdaftar.`);
      return;
    }
    if (confirm(`Hapus divisi "${d.name}"? Data akan dihapus permanen dari database.`)) {
      try {
        await hrmService.deleteDivision(d.id);
        loadData();
      } catch (err: any) {
        alert('Gagal menghapus divisi: ' + (err.message || 'Terjadi kesalahan database'));
      }
    }
  };

  const handleViewEmployees = (d: Division) => {
    setViewEmployeesDiv(d);
    setIsAddEmpOpen(false);
    setSelectedEmpIdToAdd('');
    setSearchEmpInDiv('');
    setSearchEmpToAdd('');
    setEmployeeModalOpen(true);
  };

  const handleRemoveEmployeeFromDivision = async (emp: UserProfile) => {
    if (!viewEmployeesDiv) return;
    if (confirm(`Keluarkan karyawan "${emp.fullName}" (${emp.nip}) dari divisi "${viewEmployeesDiv.name}"? Karyawan ini tidak lagi bernaung di divisi ini.`)) {
      try {
        hrmService.updateUser(emp.id, {
          divisionId: undefined,
          divisionName: undefined,
        });
        loadData();
        toast.success(`Karyawan ${emp.fullName} berhasil dikeluarkan dari divisi ${viewEmployeesDiv.name}.`);
      } catch (err: any) {
        toast.error(err.message || 'Gagal mengeluarkan karyawan dari divisi.');
      }
    }
  };

  const handleAddEmployeeToDivision = async () => {
    if (!viewEmployeesDiv || !selectedEmpIdToAdd) {
      toast.error('Pilih karyawan yang ingin ditambahkan terlebih dahulu.');
      return;
    }
    const targetUser = users.find((u) => u.id === selectedEmpIdToAdd);
    if (!targetUser) return;

    try {
      setIsAddingEmp(true);
      await hrmService.assignUserDivision(
        targetUser.id,
        viewEmployeesDiv.id,
        `Ditugaskan ke divisi ${viewEmployeesDiv.name}`,
        'Superadmin'
      );
      loadData();
      setSelectedEmpIdToAdd('');
      setIsAddEmpOpen(false);
      setSearchEmpToAdd('');
      toast.success(`${targetUser.fullName} berhasil ditambahkan ke divisi ${viewEmployeesDiv.name}!`);
    } catch (err: any) {
      console.error('[AddEmployeeToDivision Error]', err);
      toast.error(err?.message || 'Gagal menambahkan karyawan ke divisi.');
    } finally {
      setIsAddingEmp(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" />
            Manajemen Divisi & Departemen
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Kelola struktur departemen dan penempatan unit kerja karyawan.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            onClick={() => {
              setRosterSelectedDivId('all');
              setRosterModalOpen(true);
              loadOrRunRoster('all', rosterMonth);
            }}
            className="rounded-xl gap-2 font-medium border-border hover:bg-muted text-foreground shadow-xs text-xs h-9"
          >
            <CalendarDays className="w-4 h-4 text-primary" />
            Jadwal Shift
          </Button>

          <Button
            onClick={handleOpenAdd}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-xl shadow-sm gap-2"
          >
            <Plus className="w-4 h-4" />
            Tambah Divisi
          </Button>
        </div>
      </div>

      {/* Division Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {divisions.map((d) => {
          const emps = divisionEmployeesMap[d.id] || [];
          const hasCoordinates = typeof d.latitude === 'number' && typeof d.longitude === 'number';

          return (
            <Card key={d.id} className="border-border bg-card rounded-xl shadow-sm flex flex-col justify-between hover:border-primary/30 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[11px] font-mono font-medium text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-md uppercase">
                      {d.code}
                    </span>
                    <CardTitle className="text-base font-semibold text-foreground mt-2">
                      {d.name}
                    </CardTitle>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewEmployees(d)}
                    className="flex items-center gap-1.5 text-xs text-foreground bg-muted/40 h-7 px-2.5 rounded-lg border-border hover:bg-primary/10 hover:text-primary transition-colors"
                  >
                    <Users className="w-3.5 h-3.5 text-primary" />
                    <span>{emps.length} Karyawan</span>
                  </Button>
                </div>

                <CardDescription className="text-xs text-muted-foreground mt-2 line-clamp-2">
                  {d.description || 'Tidak ada keterangan khusus.'}
                </CardDescription>
              </CardHeader>

              <CardContent className="pt-0 space-y-3">
                {/* Geofencing Location Coordinates Box */}
                <div className="p-3 bg-muted/30 border border-border rounded-xl text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-medium text-foreground">
                      <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="truncate">{d.locationName || `Lokasi Divisi ${d.name}`}</span>
                    </div>
                    {hasCoordinates && (
                      <a
                        href={`https://www.google.com/maps?q=${d.latitude},${d.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
                        title="Buka Peta"
                      >
                        Peta <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>

                  {hasCoordinates ? (
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                      <span>
                        {d.latitude?.toFixed(4)}, {d.longitude?.toFixed(4)}
                      </span>
                      <Badge variant="outline" className="text-[10px] bg-background border-border text-foreground font-sans px-1.5 py-0">
                        Radius {d.radiusMeters || 150}m
                      </Badge>
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground italic">
                      Koordinat belum diatur (menggunakan kantor pusat)
                    </p>
                  )}
                  {/* Badges for Allowed Posts */}
                  {d.allowedPosts && d.allowedPosts.length > 0 && (
                    <div className="space-y-1 pt-1.5 border-t border-border/60">
                      <span className="text-[10px] text-muted-foreground block font-medium">
                        Titik Presensi Sah ({d.allowedPosts.length} Pos):
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {d.allowedPosts.map((p) => {
                          const isClockOutOnly = Boolean(p.isClockOutOnly || (p.allowClockIn === false && p.allowClockOut === true));
                          return (
                            <Badge
                              key={p.code}
                              variant="outline"
                              className={`text-[9px] font-mono py-0 px-1.5 ${
                                isClockOutOnly
                                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
                                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                              }`}
                              title={`${p.name} (${isClockOutOnly ? 'Khusus Ceklok Pulang' : 'Ceklok Masuk & Pulang'})`}
                            >
                              {p.code} {isClockOutOnly ? '🛑 Pulang' : '🟢 In/Out'}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Employees Preview in this Division */}
                <div className="border-t border-border pt-2.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Staf Divisi ({emps.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => handleViewEmployees(d)}
                      className="text-[11px] text-primary hover:underline font-medium"
                    >
                      Lihat Semua
                    </button>
                  </div>

                  {emps.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground italic">Belum ada karyawan di divisi ini</p>
                  ) : (
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      {emps.slice(0, 4).map((emp) => (
                        <div
                          key={emp.id}
                          className="flex items-center gap-1 bg-muted/40 border border-border px-2 py-1 rounded-lg text-[11px] truncate max-w-[120px]"
                          title={`${emp.fullName} (${emp.nip})`}
                        >
                          {(emp.avatarUrl || emp.faceEnrolledPhoto) ? (
                            <img src={emp.avatarUrl || emp.faceEnrolledPhoto} alt={emp.fullName} className="w-4 h-4 rounded-full object-cover shrink-0" />
                          ) : (
                            <div className="w-4 h-4 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center text-[9px] shrink-0">
                              {emp.fullName.charAt(0)}
                            </div>
                          )}
                          <span className="truncate text-foreground font-medium">{emp.fullName.split(' ')[0]}</span>
                        </div>
                      ))}
                      {emps.length > 4 && (
                        <span className="text-[10px] text-muted-foreground font-medium bg-muted px-1.5 py-0.5 rounded-md">
                          +{emps.length - 4}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions: Terminal & Smart Roster */}
                <div className="pt-2 grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenTerminal(d)}
                    className="gap-1.5 rounded-xl border-primary/30 text-primary hover:bg-primary/10 hover:text-primary font-semibold text-xs h-8 shadow-xs"
                    title="Buka Layar Terminal Barcode Dinamis untuk Divisi ini"
                  >
                    <QrCode className="w-3.5 h-3.5 text-primary" />
                    Terminal QR
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setRosterSelectedDivId(d.id);
                      setRosterModalOpen(true);
                      const emps = divisionEmployeesMap[d.id] || [];
                      const res = generateSmartRoster({
                        month: rosterMonth,
                        year: rosterYear,
                        employees: emps.map((u) => ({ id: u.id, name: u.fullName, position: u.roleName })),
                        requiredPerShift: { pagi: rosterQuotaPagi, siang: rosterQuotaSiang, malam: rosterQuotaMalam },
                        maxConsecutiveWorkDays: rosterMaxStreak,
                      });
                      setRosterResult(res);
                    }}
                    className="gap-1.5 rounded-xl border-border text-foreground hover:bg-muted font-medium text-xs h-8 shadow-xs"
                    title="Buat Jadwal Roster Shift untuk Divisi ini"
                  >
                    <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" />
                    Jadwal Shift
                  </Button>
                </div>

                {/* Division Leader & Action Buttons */}
                <div className="flex items-center justify-between border-t border-border pt-2.5">
                  <div className="text-[11px] text-muted-foreground truncate max-w-[140px]">
                    Kepala: <span className="font-semibold text-foreground">{d.leaderName || '-'}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEdit(d)}
                      className="h-8 w-8 p-0 rounded-lg text-primary border-primary/20 hover:bg-primary/10 transition-colors"
                      title="Ubah Data & Koordinat GPS Divisi"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(d)}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                      title="Hapus Divisi"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Add / Edit Dialog with Per-Division Geofencing Coordinates */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              {editingDiv ? `Ubah Divisi & Titik GPS: ${editingDiv.name}` : 'Tambah Divisi & Titik Koordinat'}
            </DialogTitle>
            <DialogDescription>
              Tentukan identitas divisi beserta titik koordinat GPS khusus untuk absensi karyawan di divisi ini.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <Alert variant="destructive" className="py-2 text-xs">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4 my-2">
            {/* Identity Group */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="code" className="text-xs font-semibold">
                  Kode Divisi
                </Label>
                <Input
                  id="code"
                  placeholder="IT"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="text-xs uppercase font-mono rounded-xl"
                />
              </div>

              <div className="col-span-2 space-y-1">
                <Label htmlFor="name" className="text-xs font-semibold">
                  Nama Divisi
                </Label>
                <Input
                  id="name"
                  placeholder="Teknologi Informasi"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="text-xs rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="leader" className="text-xs font-semibold">
                Nama Kepala Divisi (Opsional)
              </Label>
              <Input
                id="leader"
                placeholder="misal: Rian Pratama, S.Kom"
                value={leader}
                onChange={(e) => setLeader(e.target.value)}
                className="text-xs rounded-xl"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="desc" className="text-xs font-semibold">
                Deskripsi
              </Label>
              <Textarea
                id="desc"
                placeholder="Fungsi dan tanggung jawab divisi..."
                rows={2}
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                className="text-xs rounded-xl"
              />
            </div>

            {/* GEOFENCING & COORDINATES SECTION */}
            <div className="p-4 bg-muted/40 border border-border rounded-xl space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <MapPin className="w-4 h-4 text-primary" />
                  <span>Titik Koordinat Lokasi Divisi (Geofencing)</span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleGetCoordinates}
                    disabled={gettingLocation}
                    className="h-7 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10 rounded-lg font-medium shadow-2xs"
                  >
                    <Crosshair className={`w-3.5 h-3.5 text-primary ${gettingLocation ? 'animate-spin' : ''}`} />
                    {gettingLocation ? 'Mencari Titik GPS...' : 'Deteksi GPS Saya'}
                  </Button>
                  <a
                    href={`https://www.google.com/maps?q=${latitude},${longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary px-2.5 py-1 rounded-lg border border-border bg-card hover:bg-muted transition-colors font-medium"
                    title="Buka titik koordinat saat ini di Google Maps"
                  >
                    <ExternalLink className="w-3 h-3 text-primary" />
                    <span>Buka Maps</span>
                  </a>
                </div>
              </div>

              {detectedTime && (
                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/25 rounded-xl flex items-center justify-between text-[11px] text-emerald-800 dark:text-emerald-300 animate-in fade-in duration-200">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>GPS Terdeteksi: <strong>{latitude}, {longitude}</strong> (±{detectedAccuracy}m pada {detectedTime})</span>
                  </span>
                  <span className="font-mono text-[9px] bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 px-1.5 py-0.5 rounded font-bold uppercase">
                    Aktif
                  </span>
                </div>
              )}

              {/* Opsi Cepat: Multi-Titik Pos Lapangan FRP (Dapat Memilih Lebih Dari Satu Titik) */}
              <div className="space-y-2.5 p-3.5 bg-indigo-500/5 dark:bg-indigo-950/20 border border-indigo-500/25 rounded-2xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      Pilih Pos Presensi Lapangan (Bisa Pilih Lebih dari 1 Titik):
                    </Label>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Klik kartu untuk menambah/menghapus pos presensi yang sah bagi divisi ini.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="secondary" className="text-[10px] font-semibold bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30">
                      {allowedPosts.length} dari {officialPostsList.length} Pos Terpilih
                    </Badge>
                    <button
                      type="button"
                      onClick={() => {
                        setAllowedPosts(officialPostsList.map((p) => ({ ...p })));
                        toast.success(`Semua ${officialPostsList.length} pos lapangan berhasil dipilih!`);
                      }}
                      className="px-2 py-0.5 text-[10px] font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
                    >
                      Pilih Semua
                    </button>
                    {allowedPosts.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setAllowedPosts([]);
                          toast.info('Pilihan pos dikosongkan.');
                        }}
                        className="px-2 py-0.5 text-[10px] font-semibold rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {officialPostsList.map((preset) => {
                    const isSelected = allowedPosts.some(
                      (p) => p.code === preset.code || (p.latitude === preset.latitude && p.longitude === preset.longitude)
                    );
                    const isPrimary = latitude === preset.latitude && longitude === preset.longitude;

                    return (
                      <div
                        key={preset.code}
                        onClick={() => {
                          if (isSelected) {
                            const next = allowedPosts.filter(
                              (p) => !(p.code === preset.code || (p.latitude === preset.latitude && p.longitude === preset.longitude))
                            );
                            setAllowedPosts(next);
                            if (isPrimary && next.length > 0) {
                              setLatitude(next[0].latitude);
                              setLongitude(next[0].longitude);
                              setRadiusMeters(next[0].radiusMeters || 50);
                              setLocationName(next[0].name);
                              setAddress(next[0].description || next[0].name);
                            }
                            toast.info(`Titik ${preset.name} dihapus dari pilihan divisi.`);
                          } else {
                            const next = [...allowedPosts, { ...preset }];
                            setAllowedPosts(next);
                            if (allowedPosts.length === 0 || !locationName) {
                              setLatitude(preset.latitude);
                              setLongitude(preset.longitude);
                              setRadiusMeters(preset.radiusMeters || 50);
                              setLocationName(preset.name);
                              setAddress(preset.description || preset.name);
                            }
                            toast.success(`Titik ${preset.name} ditambahkan! (${next.length} pos aktif)`);
                          }
                        }}
                        className={`p-2.5 text-left rounded-xl border text-[11px] transition-all cursor-pointer select-none flex flex-col justify-between gap-1.5 relative ${
                          isSelected
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-500/30'
                            : 'bg-card hover:bg-muted/60 border-border text-foreground hover:border-indigo-500/40'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <div className="font-bold truncate text-xs">{preset.name}</div>
                          <div className={`w-4 h-4 rounded-md flex items-center justify-center text-[10px] shrink-0 font-bold ${
                            isSelected ? 'bg-white text-indigo-600 shadow-xs' : 'border border-muted-foreground/30 text-transparent'
                          }`}>
                            ✓
                          </div>
                        </div>

                        <div className={`text-[10px] font-mono truncate ${isSelected ? 'text-indigo-100' : 'text-muted-foreground'}`}>
                          {preset.code} • {preset.radiusMeters}m
                        </div>

                        <div className="flex items-center gap-1 flex-wrap pt-0.5">
                          {isPrimary && (
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                              isSelected ? 'bg-amber-400 text-amber-950' : 'bg-amber-500/20 text-amber-600'
                            }`}>
                              ★ Titik Utama
                            </span>
                          )}
                          {preset.isClockOutOnly ? (
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                              isSelected ? 'bg-white/20 text-white' : 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                            }`}>
                              Khusus Pulang
                            </span>
                          ) : (
                            <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${
                              isSelected ? 'bg-white/15 text-indigo-50' : 'bg-muted text-muted-foreground'
                            }`}>
                              Masuk & Pulang
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Nama Lokasi / Gedung Divisi</Label>
                <Input
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  placeholder="Contoh: Gedung Rektorat Lt. 2 / Kantor Cabang Barat"
                  className="text-xs rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Alamat Kantor Divisi</Label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Jl. Thamrin No. 10..."
                  className="text-xs rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Latitude (Lintang)</Label>
                  <Input
                    type="text"
                    value={latitude}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val.includes(',')) {
                        const parts = val.split(',');
                        const lat = parseFloat(parts[0]);
                        const lng = parseFloat(parts[1]);
                        if (!isNaN(lat)) setLatitude(lat);
                        if (!isNaN(lng)) setLongitude(lng);
                      } else {
                        const num = parseFloat(val);
                        setLatitude(isNaN(num) ? 0 : num);
                      }
                    }}
                    placeholder="-4.815063"
                    className="text-xs font-mono rounded-xl"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Longitude (Bujur)</Label>
                  <Input
                    type="text"
                    value={longitude}
                    onChange={(e) => {
                      const num = parseFloat(e.target.value);
                      setLongitude(isNaN(num) ? 0 : num);
                    }}
                    placeholder="119.544556"
                    className="text-xs font-mono rounded-xl"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Radius Batas Presensi (Meter)</Label>
                <Input
                  type="number"
                  min={10}
                  max={5000}
                  value={radiusMeters}
                  onChange={(e) => setRadiusMeters(Number(e.target.value))}
                  className="text-xs rounded-xl"
                  required
                />
                <p className="text-[10px] text-muted-foreground">
                  Karyawan divisi ini wajib berada dalam radius {radiusMeters} meter dari titik koordinat ini untuk presensi.
                </p>
              </div>

              {/* Multi-Titik Titik Koordinat Presensi Divisi (Bank Titik Sah) */}
              <div className="space-y-2.5 p-3.5 bg-muted/30 border border-border rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Crosshair className="w-3.5 h-3.5 text-primary" />
                      Multi-Titik Koordinat Presensi Divisi (Bank Titik Sah):
                    </Label>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Pilih pos mana saja yang sah digunakan oleh staf divisi ini untuk ceklok masuk dan pulang.
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {allowedPosts.length} Titik Terpilih
                  </Badge>
                </div>

                <div className="space-y-2 mt-2">
                  {officialPostsList.map((preset) => {
                    const existingIdx = allowedPosts.findIndex(
                      (p) => p.code === preset.code || (p.latitude === preset.latitude && p.longitude === preset.longitude)
                    );
                    const isChecked = existingIdx !== -1;
                    const currentPost = isChecked ? allowedPosts[existingIdx] : preset;
                    const isClockOutOnly = Boolean(
                      currentPost.isClockOutOnly || (currentPost.allowClockIn === false && currentPost.allowClockOut === true)
                    );

                    return (
                      <div
                        key={preset.code}
                        className={`p-2.5 rounded-xl border transition-all text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                          isChecked ? 'bg-card border-primary/40 shadow-xs' : 'bg-muted/20 border-border/60 opacity-70'
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setAllowedPosts([...allowedPosts, { ...preset }]);
                              } else {
                                setAllowedPosts(allowedPosts.filter((_, idx) => idx !== existingIdx));
                              }
                            }}
                            className="mt-0.5 rounded accent-primary cursor-pointer w-4 h-4"
                          />
                          <div>
                            <div className="font-semibold text-foreground flex items-center gap-1.5">
                              <span>{preset.name}</span>
                              <span className="text-[10px] font-mono text-muted-foreground">({preset.code})</span>
                            </div>
                            <div className="text-[10px] font-mono text-muted-foreground">
                              {preset.latitude.toFixed(6)}, {preset.longitude.toFixed(6)} • Radius {preset.radiusMeters}m
                            </div>
                          </div>
                        </div>

                        {isChecked && (
                          <div className="flex items-center gap-2 pl-6 sm:pl-0">
                            <span className="text-[10px] text-muted-foreground">Aturan Presensi:</span>
                            <div className="flex items-center rounded-lg border border-border p-0.5 bg-background">
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = [...allowedPosts];
                                  updated[existingIdx] = {
                                    ...updated[existingIdx],
                                    allowClockIn: true,
                                    allowClockOut: true,
                                    isClockOutOnly: false,
                                  };
                                  setAllowedPosts(updated);
                                }}
                                className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-all ${
                                  !isClockOutOnly
                                    ? 'bg-emerald-600 text-white font-bold'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                              >
                                Masuk &amp; Pulang
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = [...allowedPosts];
                                  updated[existingIdx] = {
                                    ...updated[existingIdx],
                                    allowClockIn: false,
                                    allowClockOut: true,
                                    isClockOutOnly: true,
                                  };
                                  setAllowedPosts(updated);
                                }}
                                className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-all ${
                                  isClockOutOnly
                                    ? 'bg-rose-600 text-white font-bold'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                              >
                                Khusus Ceklok Pulang
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Exemption Callout for 3 Special Officers */}
                <div className="mt-3 p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-[11px] text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Pengecualian Mutlak Sistem:</span> Aturan pembatasan titik divisi &amp; pembatasan khusus pulang Pos OGS ini <strong>TIDAK BERLAKU</strong> untuk 3 Petugas Lapangan (<strong>Muh Aslam Faisal</strong>, <strong>TAKDIR</strong>, dan <strong>LA UNGA SAMSI</strong>). Ketiganya tetap bebas presensi masuk dan pulang di seluruh bank pos mereka.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setModalOpen(false)} className="rounded-xl">
              Batal
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl"
            >
              {saving ? 'Menyimpan ke Database...' : 'Simpan Divisi & Koordinat'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Division Employees Viewer Modal with Add & Remove */}
      <Dialog open={employeeModalOpen} onOpenChange={setEmployeeModalOpen}>
        <DialogContent className="max-w-xl rounded-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between pr-6">
              <DialogTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Daftar Karyawan: {viewEmployeesDiv?.name}
              </DialogTitle>
            </div>
            <DialogDescription>
              Karyawan yang saat ini terdaftar dan bernaung di divisi {viewEmployeesDiv?.name} ({viewEmployeesDiv?.code}).
            </DialogDescription>
          </DialogHeader>

          {/* Division Location Info Bar + Tombol Tambah Karyawan */}
          {viewEmployeesDiv && (
            <div className="p-3 bg-muted/30 border border-border rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="w-4 h-4 text-primary shrink-0" />
                <div>
                  <p className="font-semibold text-foreground">{viewEmployeesDiv.locationName || 'Lokasi Divisi'}</p>
                  <p className="text-[11px]">
                    {viewEmployeesDiv.latitude?.toFixed(4)}, {viewEmployeesDiv.longitude?.toFixed(4)} (Radius {viewEmployeesDiv.radiusMeters || 150}m)
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs">
                  {(divisionEmployeesMap[viewEmployeesDiv.id] || []).length} Karyawan
                </Badge>
                <Button
                  size="sm"
                  variant={isAddEmpOpen ? 'secondary' : 'default'}
                  onClick={() => setIsAddEmpOpen(!isAddEmpOpen)}
                  className="rounded-xl text-xs h-7 px-2.5 gap-1.5 shadow-xs"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  {isAddEmpOpen ? 'Tutup Form' : '+ Tambah Karyawan'}
                </Button>
              </div>
            </div>
          )}

          {/* Panel Tambah Karyawan ke Divisi */}
          {isAddEmpOpen && viewEmployeesDiv && (
            <div className="p-3.5 bg-primary/5 border border-primary/25 rounded-2xl space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <UserPlus className="w-4 h-4 text-primary" />
                  Pilih Karyawan untuk Dimasukkan ke Divisi Ini:
                </Label>
                <button
                  type="button"
                  onClick={() => setIsAddEmpOpen(false)}
                  className="text-muted-foreground hover:text-foreground p-1 rounded-md"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Input pencarian calon karyawan */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Cari nama atau NIP karyawan..."
                  value={searchEmpToAdd}
                  onChange={(e) => setSearchEmpToAdd(e.target.value)}
                  className="pl-8 text-xs h-8 rounded-xl"
                />
              </div>

              {/* List pilihan calon karyawan */}
              {(() => {
                const candidates = users
                  .filter((u) => u.divisionId !== viewEmployeesDiv.id)
                  .filter((u) => {
                    if (!searchEmpToAdd.trim()) return true;
                    const q = searchEmpToAdd.toLowerCase();
                    return (
                      (u.fullName || '').toLowerCase().includes(q) ||
                      (u.nip || '').toLowerCase().includes(q)
                    );
                  });

                if (candidates.length === 0) {
                  return (
                    <div className="text-center py-4 text-xs text-muted-foreground">
                      {searchEmpToAdd.trim()
                        ? 'Tidak ada karyawan yang cocok dengan pencarian.'
                        : 'Semua karyawan telah berada di divisi ini.'}
                    </div>
                  );
                }

                return (
                  <div className="space-y-2">
                    <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 border border-border/60 rounded-xl p-2 bg-background/60">
                      {candidates.map((cand) => {
                        const isChosen = selectedEmpIdToAdd === cand.id;
                        const currentDiv = divisions.find((d) => d.id === cand.divisionId);
                        return (
                          <div
                            key={cand.id}
                            onClick={() => setSelectedEmpIdToAdd(cand.id)}
                            className={`p-2 rounded-xl text-xs flex items-center justify-between gap-2 cursor-pointer transition-all ${
                              isChosen
                                ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                                : 'hover:bg-muted border border-transparent hover:border-border'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="truncate">{cand.fullName}</span>
                                <span className={`text-[10px] font-mono ${isChosen ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                                  ({cand.nip})
                                </span>
                              </div>
                              <div className={`text-[10px] ${isChosen ? 'text-primary-foreground/75' : 'text-muted-foreground'} truncate`}>
                                {currentDiv ? `Saat ini: Divisi ${currentDiv.name}` : 'Belum memiliki divisi'}
                              </div>
                            </div>
                            <div className="shrink-0 text-[10px] font-bold">
                              {isChosen ? '✓ Terpilih' : '+ Pilih'}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedEmpIdToAdd('');
                          setIsAddEmpOpen(false);
                        }}
                        className="h-8 text-xs rounded-xl"
                      >
                        Batal
                      </Button>
                      <Button
                        size="sm"
                        disabled={!selectedEmpIdToAdd || isAddingEmp}
                        onClick={handleAddEmployeeToDivision}
                        className="h-8 text-xs rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        {isAddingEmp ? 'Menambahkan...' : 'Tambahkan ke Divisi'}
                      </Button>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Search bar inside current division employees */}
          {viewEmployeesDiv && (divisionEmployeesMap[viewEmployeesDiv.id] || []).length > 3 && (
            <div className="relative my-1">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Cari karyawan di divisi ini (nama atau NIP)..."
                value={searchEmpInDiv}
                onChange={(e) => setSearchEmpInDiv(e.target.value)}
                className="pl-8 text-xs h-8 rounded-xl"
              />
            </div>
          )}

          {/* List Karyawan Saat Ini */}
          <div className="space-y-2.5 my-2">
            {viewEmployeesDiv && (() => {
              const divEmps = (divisionEmployeesMap[viewEmployeesDiv.id] || []).filter((emp) => {
                if (!searchEmpInDiv.trim()) return true;
                const q = searchEmpInDiv.toLowerCase();
                return (
                  (emp.fullName || '').toLowerCase().includes(q) ||
                  (emp.nip || '').toLowerCase().includes(q)
                );
              });

              if (divEmps.length === 0) {
                return (
                  <div className="py-8 text-center text-muted-foreground text-xs">
                    {searchEmpInDiv.trim()
                      ? 'Tidak ada karyawan yang cocok dengan pencarian.'
                      : 'Belum ada karyawan yang ditempatkan pada divisi ini.'}
                  </div>
                );
              }

              return divEmps.map((emp) => (
                <div
                  key={emp.id}
                  className="p-3 bg-card border border-border rounded-xl flex items-center justify-between gap-3 hover:border-primary/20 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {(emp.avatarUrl || emp.faceEnrolledPhoto) ? (
                      <img
                        src={emp.avatarUrl || emp.faceEnrolledPhoto}
                        alt={emp.fullName}
                        className="w-10 h-10 rounded-full object-cover border border-primary/20 shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-sm shrink-0">
                        {emp.fullName.charAt(0)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-foreground text-xs truncate">{emp.fullName}</p>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-muted text-foreground border-border uppercase">
                          {emp.roleName || 'karyawan'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                        <span className="font-mono">NIP: {emp.nip}</span>
                        <span>•</span>
                        <span className="truncate">{emp.email}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Badge
                      variant="outline"
                      className={
                        emp.isActive
                          ? 'bg-primary/10 text-primary border-primary/20 text-[10px]'
                          : 'bg-muted text-muted-foreground border-border text-[10px]'
                      }
                    >
                      {emp.isActive ? 'Aktif' : 'Nonaktif'}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Keluarkan karyawan dari divisi ini"
                      onClick={() => handleRemoveEmployeeFromDivision(emp)}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ));
            })()}
          </div>

          <DialogFooter>
            <Button onClick={() => setEmployeeModalOpen(false)} className="rounded-xl">
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── TERMINAL BARCODE MODAL PER-DIVISI (DYNAMIC 10-SECOND ROTATION) ─── */}
      <Dialog open={terminalModalOpen} onOpenChange={setTerminalModalOpen}>
        <DialogContent className="max-w-md rounded-2xl border border-border shadow-2xl">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2 text-base font-bold">
                <Monitor className="w-5 h-5 text-primary" />
                Terminal Barcode: {selectedTerminalDiv?.name}
              </DialogTitle>
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] animate-pulse">
                🟢 Live Dynamic Token
              </Badge>
            </div>
            <DialogDescription className="text-xs">
              Monitor terminal lobi khusus Divisi {selectedTerminalDiv?.name}. Token berputar otomatis tiap 10 detik.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Visual Barcode / QR Display Box */}
            <div className="p-6 bg-slate-900 text-white rounded-2xl flex flex-col items-center justify-center text-center shadow-inner relative overflow-hidden">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest block mb-3">
                SCAN DENGAN HP KARYAWAN
              </span>

              {/* Real 2D Square QR Code Graphic */}
              <div className="p-3 bg-white rounded-2xl shadow-lg border-4 border-emerald-500/40 inline-flex items-center justify-center transition-transform hover:scale-[1.02]">
                {terminalQrImageUrl ? (
                  <img
                    src={terminalQrImageUrl}
                    alt="QR Code Terminal Divisi"
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
                <div className="text-lg sm:text-xl font-mono font-bold tracking-widest text-emerald-400 bg-black/40 px-4 py-1.5 rounded-xl border border-emerald-500/30 select-all inline-block">
                  {terminalQrData?.code || 'MEMUAT...'}
                </div>
              </div>

              {/* Progress timer bar */}
              <div className="w-full max-w-[260px] mt-3.5 space-y-1.5">
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <Timer className="w-3 h-3 text-emerald-400" /> Rotasi Otomatis
                  </span>
                  <span className="font-mono font-bold text-white">
                    {terminalQrData?.remainingSeconds || 0} detik tersisa
                  </span>
                </div>
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-1000 ease-linear rounded-full"
                    style={{
                      width: `${(((terminalQrData?.remainingSeconds || 10) / 10) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Division Geolocation Info */}
            <div className="p-3 bg-muted/40 border border-border rounded-xl space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                <span>Titik Koordinat Divisi:</span>
                <span className="font-mono font-semibold text-foreground">
                  {selectedTerminalDiv?.latitude?.toFixed(5) || -6.225}, {selectedTerminalDiv?.longitude?.toFixed(5) || 106.809}
                </span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                <span>Radius Geofence:</span>
                <span className="font-semibold text-foreground">
                  {selectedTerminalDiv?.radiusMeters || 150} Meter
                </span>
              </div>
              <div className="pt-1 border-t border-border/60 text-[11px] text-muted-foreground truncate">
                📍 {selectedTerminalDiv?.address || 'Alamat Kantor'}
              </div>
            </div>

            <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-[11px] text-blue-900 dark:text-blue-200">
              💡 Pasang tablet/layar ini di area resepsionis divisi. Karyawan wajib melakukan selfie terlebih dahulu sebelum memindai barcode ini.
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={handleCopyToken}
              className="rounded-xl text-xs gap-1.5 h-9"
            >
              {copiedToken ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedToken ? 'Tersalin!' : 'Salin Token'}
            </Button>
            <Button
              onClick={() => setTerminalModalOpen(false)}
              className="rounded-xl text-xs h-9 font-semibold"
            >
              Tutup Terminal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── SMART ROSTER AI GENERATOR MODAL ─── */}
      <Dialog open={rosterModalOpen} onOpenChange={setRosterModalOpen}>
        <DialogContent className="max-w-6xl w-[95vw] max-h-[92vh] flex flex-col p-6 rounded-2xl border border-border shadow-2xl overflow-hidden">
          <DialogHeader className="pb-3 border-b border-border/80 shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <DialogTitle className="text-base font-bold flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-primary" />
                  Matriks Penjadwalan Shift Karyawan
                </DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  Optimasi penjadwalan shift mematuhi regulasi UU Ketenagakerjaan: minimal 11 jam istirahat antar-shift, proteksi turnaround malam-ke-pagi, dan pemerataan beban kerja.
                </DialogDescription>
              </div>

              {rosterResult && (
                <div className="flex flex-wrap items-center gap-2">
                  {isSavedInDb ? (
                    <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-xs gap-1 py-1 font-semibold shadow-xs">
                      <CheckCheck size={13} /> Tersimpan di Database
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-amber-700 dark:text-amber-300 border-amber-500/40 bg-amber-500/10 text-xs gap-1 py-1 font-medium">
                      <AlertCircle size={13} /> Draf Belum Disimpan
                    </Badge>
                  )}

                  <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20 text-xs gap-1 py-1">
                    <ShieldCheck size={13} /> {rosterResult.audit.laborLawCompliance ? '100% Patuh UU' : 'Perlu Penyesuaian'}
                  </Badge>

                  <Badge variant="outline" className="font-mono text-xs py-1">
                    Pemerataan: {rosterResult.audit.fairnessIndex}%
                  </Badge>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setImportCsvText('');
                      setImportFileName('');
                      setImportPreviewRows([]);
                      setImportErrors([]);
                      setImportModalOpen(true);
                    }}
                    className="rounded-xl text-xs gap-1.5 h-8 border-border"
                  >
                    <Upload size={13} /> Import CSV
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleExportRosterCsv}
                    className="rounded-xl text-xs gap-1.5 h-8 border-border"
                  >
                    <Download size={13} /> Export CSV
                  </Button>

                  <Button
                    size="sm"
                    disabled={isApplying || !rosterResult || rosterResult.rosters.length === 0}
                    onClick={handleApplyToDatabase}
                    className="rounded-xl text-xs gap-1.5 h-8 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                  >
                    {isApplying ? <Loader2 size={13} className="animate-spin" /> : <Database size={13} />}
                    {isApplying ? 'Menyimpan...' : 'Terapkan ke Database'}
                  </Button>
                </div>
              )}
            </div>
          </DialogHeader>

          {/* Success Banner */}
          {applySuccessMsg && (
            <div className="mx-1 mt-2.5 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between gap-3 text-xs text-emerald-900 dark:text-emerald-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-medium">{applySuccessMsg}</span>
              </div>
              <Badge className="bg-emerald-600 text-white text-[10px] shrink-0 font-medium">
                Aktif Mengunci Jam Masuk Absensi
              </Badge>
            </div>
          )}

          {/* Controls Bar */}
          <div className="py-2.5 shrink-0 grid grid-cols-2 sm:grid-cols-6 gap-2.5 bg-muted/20 p-3 rounded-xl border border-border/70 text-xs mt-2">
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-[11px] font-semibold text-muted-foreground">Pilih Divisi</Label>
              <Select
                value={rosterSelectedDivId}
                onValueChange={(v) => {
                  setRosterSelectedDivId(v);
                  loadOrRunRoster(v, rosterMonth);
                }}
              >
                <SelectTrigger className="rounded-xl text-xs h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Divisi ({users.length} Karyawan)</SelectItem>
                  {divisions.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name} ({(divisionEmployeesMap[d.id] || []).length} Staf)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-muted-foreground">Bulan</Label>
              <Select
                value={String(rosterMonth)}
                onValueChange={(v) => {
                  const m = Number(v);
                  setRosterMonth(m);
                  loadOrRunRoster(rosterSelectedDivId, m);
                }}
              >
                <SelectTrigger className="rounded-xl text-xs h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'].map(
                    (m, i) => (
                      <SelectItem key={i} value={String(i + 1)}>
                        {m}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-muted-foreground">Target / Shift</Label>
              <div className="flex gap-1">
                <Input
                  type="number"
                  title="Shift Pagi"
                  value={rosterQuotaPagi}
                  onChange={(e) => setRosterQuotaPagi(Math.max(1, Number(e.target.value)))}
                  className="rounded-xl text-xs h-8 px-1.5 text-center font-mono"
                  placeholder="P"
                />
                <Input
                  type="number"
                  title="Shift Siang"
                  value={rosterQuotaSiang}
                  onChange={(e) => setRosterQuotaSiang(Math.max(1, Number(e.target.value)))}
                  className="rounded-xl text-xs h-8 px-1.5 text-center font-mono"
                  placeholder="S"
                />
                <Input
                  type="number"
                  title="Shift Malam"
                  value={rosterQuotaMalam}
                  onChange={(e) => setRosterQuotaMalam(Math.max(0, Number(e.target.value)))}
                  className="rounded-xl text-xs h-8 px-1.5 text-center font-mono"
                  placeholder="M"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-muted-foreground">Maks. Hari Beruntun</Label>
              <Input
                type="number"
                value={rosterMaxStreak}
                onChange={(e) => setRosterMaxStreak(Math.max(2, Number(e.target.value)))}
                className="rounded-xl text-xs h-8 font-mono text-center"
              />
            </div>

            <div className="flex items-end">
              <Button
                onClick={() => handleRunRosterScheduler()}
                className="w-full rounded-xl text-xs h-8 font-semibold gap-1.5 shadow-xs"
              >
                <Calendar size={13} /> Susun Jadwal
              </Button>
            </div>
          </div>

          {/* Roster Calendar Matrix */}
          <div className="flex-1 overflow-auto border border-border/80 rounded-xl my-2">
            {!rosterResult || rosterResult.rosters.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground text-xs">
                Klik tombol <strong>Susun Jadwal</strong> atau <strong>Import CSV</strong> untuk menyusun matriks shift.
              </div>
            ) : (
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-muted/60 border-b border-border text-[11px]">
                    <th className="sticky left-0 bg-muted/95 z-20 px-3 py-2 text-left font-bold min-w-[170px] border-r border-border">
                      Karyawan
                    </th>
                    {Array.from({ length: rosterResult.daysInMonth }, (_, i) => i + 1).map((d) => (
                      <th key={d} className="px-1 py-1.5 text-center font-mono min-w-[32px] border-r border-border/40">
                        {d}
                      </th>
                    ))}
                    <th className="px-2 py-2 text-center font-bold bg-muted/80 min-w-[65px] border-r border-border/60">
                      Total Jam
                    </th>
                    <th className="px-2 py-2 text-center font-bold bg-muted/80 min-w-[60px] border-r border-border/60">
                      Hari Kerja
                    </th>
                    <th className="px-2 py-2 text-center font-bold bg-muted/80 min-w-[60px]">
                      Shift Malam
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 font-mono text-[11px]">
                  {rosterResult.rosters.map((r) => (
                    <tr key={r.employeeId} className="hover:bg-muted/20 transition-colors">
                      <td className="sticky left-0 bg-card z-10 px-3 py-2 font-sans font-semibold text-foreground border-r border-border truncate">
                        {r.employeeName}
                      </td>
                      {Array.from({ length: rosterResult.daysInMonth }, (_, i) => i + 1).map((d) => {
                        const dateStr = `${rosterResult.year}-${String(rosterResult.month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                        const asg = r.assignments[dateStr];
                        const code = asg?.shiftCode || 'OFF';

                        let badgeCls = 'bg-muted text-muted-foreground/60 hover:bg-muted/80';
                        if (code === 'P') badgeCls = 'bg-blue-500/20 text-blue-700 dark:text-blue-300 font-bold hover:bg-blue-500/30';
                        else if (code === 'S') badgeCls = 'bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold hover:bg-amber-500/30';
                        else if (code === 'M') badgeCls = 'bg-purple-500/25 text-purple-700 dark:text-purple-300 font-extrabold hover:bg-purple-500/35';

                        return (
                          <td key={d} className="p-0.5 text-center border-r border-border/30">
                            <button
                              type="button"
                              onClick={() => handleToggleCellShift(r.employeeId, d)}
                              title="Klik untuk ubah giliran (P -> S -> M -> OFF)"
                              className={`inline-block w-full py-1 rounded text-[10px] cursor-pointer transition-all active:scale-95 focus:outline-hidden ${badgeCls}`}
                            >
                              {code}
                            </button>
                          </td>
                        );
                      })}
                      <td className="px-2 py-1.5 text-center font-bold text-foreground border-r border-border/60 bg-muted/10">
                        {r.totalWorkHours} Jam
                      </td>
                      <td className="px-2 py-1.5 text-center font-bold text-foreground border-r border-border/60 bg-muted/10">
                        {r.totalWorkDays} Hari
                      </td>
                      <td className="px-2 py-1.5 text-center font-bold text-purple-600 bg-muted/10">
                        {r.totalNightShifts} Kali
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Legend & Compliance Footer */}
          <div className="pt-2 border-t border-border/70 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs shrink-0">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-muted-foreground text-[11px] font-semibold">Keterangan Shift:</span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-blue-500" /> P (Shift I: 07:30-15:30 WITA)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-amber-500" /> S (Shift II: 15:30-22:30 WITA)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-purple-600" /> M (Shift III: 22:30-07:30 WITA)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-muted-foreground/40" /> OFF (Libur)
              </span>
              <span className="text-muted-foreground text-[10px] italic">
                *Klik kotak tanggal pada tabel untuk mengganti shift secara manual.
              </span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setRosterModalOpen(false)}
              className="rounded-xl text-xs h-8"
            >
              Tutup
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── POWERFUL CSV IMPORT MODAL ─── */}
      <Dialog open={importModalOpen} onOpenChange={setImportModalOpen}>
        <DialogContent className="max-w-3xl w-[95vw] max-h-[90vh] flex flex-col p-6 rounded-2xl border border-border shadow-2xl overflow-hidden">
          <DialogHeader className="pb-3 border-b border-border/80 shrink-0">
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle className="text-base font-bold flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-primary" />
                  Import Jadwal Shift dari CSV
                </DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  Unggah file spreadsheet jadwal shift bulanan. Sistem akan memvalidasi nama staf, NIP, serta tanggal shift secara otomatis.
                </DialogDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadCsvTemplate}
                className="rounded-xl text-xs gap-1.5 h-8 border-border shrink-0"
              >
                <Download size={13} /> Unduh Format Template
              </Button>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2 flex-1 overflow-y-auto">
            {/* File Upload Box */}
            <div className="border-2 border-dashed border-border rounded-xl p-5 text-center hover:border-primary/50 transition-colors bg-muted/10">
              <FileUp className="w-8 h-8 text-primary mx-auto mb-2" />
              <p className="text-xs font-semibold text-foreground">
                {importFileName ? importFileName : 'Klik atau seret file CSV jadwal shift ke sini'}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Format yang didukung: <code>.csv</code> (P, S, M, OFF untuk setiap tanggal)
              </p>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileUpload}
                className="hidden"
                id="roster-csv-upload-input"
              />
              <label htmlFor="roster-csv-upload-input">
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="mt-3 rounded-xl text-xs h-8 cursor-pointer"
                >
                  <span>Pilih File CSV</span>
                </Button>
              </label>
            </div>

            {/* Validation & Preview Summary */}
            {importPreviewRows.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20 text-xs">
                      {importPreviewRows.filter((r) => r.matched).length} Karyawan Terverifikasi
                    </Badge>
                    {importErrors.length > 0 && (
                      <Badge variant="outline" className="text-amber-700 border-amber-500/30 bg-amber-500/10 text-xs">
                        {importErrors.length} Peringatan
                      </Badge>
                    )}
                  </div>
                  <label className="flex items-center gap-2 text-xs cursor-pointer text-muted-foreground hover:text-foreground">
                    <input
                      type="checkbox"
                      checked={importDirectSave}
                      onChange={(e) => setImportDirectSave(e.target.checked)}
                      className="rounded accent-primary"
                    />
                    <span>Langsung terapkan & simpan ke database</span>
                  </label>
                </div>

                {/* Preview Table */}
                <div className="border border-border/80 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/60 border-b border-border sticky top-0 text-[11px]">
                      <tr>
                        <th className="px-3 py-2 text-left font-bold">Karyawan</th>
                        <th className="px-2 py-2 text-center font-bold">NIP</th>
                        <th className="px-2 py-2 text-center font-bold">Pagi (P)</th>
                        <th className="px-2 py-2 text-center font-bold">Siang (S)</th>
                        <th className="px-2 py-2 text-center font-bold">Malam (M)</th>
                        <th className="px-2 py-2 text-center font-bold">Libur (OFF)</th>
                        <th className="px-2 py-2 text-center font-bold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50 text-[11px]">
                      {importPreviewRows.map((r, idx) => (
                        <tr key={idx} className="hover:bg-muted/20">
                          <td className="px-3 py-2 font-medium text-foreground">
                            {r.employeeName}
                          </td>
                          <td className="px-2 py-2 text-center font-mono text-muted-foreground">
                            {r.nip}
                          </td>
                          <td className="px-2 py-2 text-center font-mono font-semibold text-blue-600">
                            {r.totalPagi}
                          </td>
                          <td className="px-2 py-2 text-center font-mono font-semibold text-amber-600">
                            {r.totalSiang}
                          </td>
                          <td className="px-2 py-2 text-center font-mono font-semibold text-purple-600">
                            {r.totalMalam}
                          </td>
                          <td className="px-2 py-2 text-center font-mono text-muted-foreground">
                            {r.totalOff}
                          </td>
                          <td className="px-2 py-2 text-center">
                            {r.matched ? (
                              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] py-0 px-1.5 border-emerald-500/20">
                                Cocok
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-rose-600 border-rose-500/30 bg-rose-500/10 text-[10px] py-0 px-1.5">
                                Belum Terdaftar
                              </Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {importErrors.length > 0 && (
                  <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-900 dark:text-amber-200 space-y-1">
                    <p className="font-semibold flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                      Catatan Validasi Import:
                    </p>
                    <ul className="list-disc list-inside space-y-0.5 text-muted-foreground pl-1">
                      {importErrors.slice(0, 3).map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                      {importErrors.length > 3 && (
                        <li>...dan {importErrors.length - 3} catatan lainnya</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="pt-3 border-t border-border/80 gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setImportModalOpen(false)}
              className="rounded-xl text-xs h-9"
            >
              Batal
            </Button>
            <Button
              size="sm"
              disabled={importPreviewRows.length === 0 || isApplying}
              onClick={handleExecuteImport}
              className="rounded-xl text-xs h-9 font-semibold bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
            >
              {isApplying ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              {isApplying ? 'Menerapkan...' : 'Terapkan Hasil Import'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
