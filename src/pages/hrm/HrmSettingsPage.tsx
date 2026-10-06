import React, { useState, useEffect, useRef } from 'react';
import { hrmService } from '@/services/hrmService';
import { OfficeLocation, Shift, AppSettings, OvertimeSettings, CompanyProfile, CompanyDocument, CompanyDocumentType } from '@/types/hrm';
import defaultLogo from '@/assets/logo.png';
import {
  Settings,
  MapPin,
  Clock,
  Save,
  Crosshair,
  Image as ImageIcon,
  Upload,
  RotateCcw,
  CheckCircle2,
  Coins,
  Calculator,
  CalendarDays,
  Zap,
  Plus,
  Trash2,
  Edit2,
  Moon,
  Coffee,
  Palette,
  Star,
  Building2,
  FileText,
  Globe,
  Phone,
  Mail,
  Instagram,
  Linkedin,
  Facebook,
  Eye,
  AlertTriangle,
  ShieldCheck,
  Users,
  Target,
  Briefcase,
  FileSpreadsheet,
  X,
  Download,
  Wifi,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DatePicker } from '@/components/ui/date-picker';

const COMPANY_DOC_LABELS: Record<CompanyDocumentType, string> = {
  akta_pendirian: 'Akta Pendirian',
  sk_kemenkumham: 'SK Kemenkumham',
  npwp: 'NPWP Perusahaan',
  siup: 'SIUP / Izin Usaha',
  nib: 'NIB (Nomor Induk Berusaha)',
  tdp: 'TDP',
  iso: 'Sertifikat ISO',
  sertifikasi: 'Sertifikasi Lainnya',
  perjanjian: 'Perjanjian / MOU',
  lainnya: 'Dokumen Lainnya',
};

const COMPANY_DOC_COLORS: Record<CompanyDocumentType, string> = {
  akta_pendirian: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  sk_kemenkumham: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
  npwp: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  siup: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
  nib: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
  tdp: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
  iso: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  sertifikasi: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
  perjanjian: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
  lainnya: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
};

const formatDocDate = (dateStr?: string) => {
  if (!dateStr) return '—';
  try {
    const clean = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    const d = new Date(clean);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

const isDocExpired = (dateStr?: string) => {
  if (!dateStr) return false;
  try {
    const clean = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    const d = new Date(clean);
    if (isNaN(d.getTime())) return false;
    return d < new Date();
  } catch {
    return false;
  }
};

export const HrmSettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('branding');
  const [appSettings, setAppSettings] = useState<AppSettings>(hrmService.getAppSettings());
  const [logoPreview, setLogoPreview] = useState<string | null>(appSettings.logoUrl);
  const [office, setOffice] = useState<OfficeLocation>(hrmService.getOfficeLocation());
  const [shifts, setShifts] = useState<Shift[]>(hrmService.getShifts());

  const [settingsMessage, setSettingsMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [officeMessage, setOfficeMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [shiftMessage, setShiftMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [breakMessage, setBreakMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Company Profile State
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile>(hrmService.getCompanyProfile());
  const [companyMessage, setCompanyMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Company Documents State
  const [companyDocs, setCompanyDocs] = useState<CompanyDocument[]>(hrmService.getCompanyDocuments());
  const [docModalOpen, setDocModalOpen] = useState(false);
  const [docName, setDocName] = useState('');
  const [docType, setDocType] = useState<CompanyDocumentType>('akta_pendirian');
  const [docIssuedDate, setDocIssuedDate] = useState('');
  const [docExpiryDate, setDocExpiryDate] = useState('');
  const [docNotes, setDocNotes] = useState('');
  const [docFileUrl, setDocFileUrl] = useState<string | null>(null);
  const [docFileType, setDocFileType] = useState('');
  const [docFileSizeKb, setDocFileSizeKb] = useState(0);
  const [docMessage, setDocMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const docFileRef = useRef<HTMLInputElement>(null);

  // Shift Modal State
  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [shiftCode, setShiftCode] = useState('REG');
  const [shiftName, setShiftName] = useState('');
  const [shiftStartTime, setShiftStartTime] = useState('08:00');
  const [shiftEndTime, setShiftEndTime] = useState('17:00');
  const [shiftBreakStart, setShiftBreakStart] = useState('12:00');
  const [shiftBreakEnd, setShiftBreakEnd] = useState('13:00');
  const [shiftTolerance, setShiftTolerance] = useState(15);
  const [shiftEarliestIn, setShiftEarliestIn] = useState(60);
  const [shiftIsCrossDay, setShiftIsCrossDay] = useState(false);
  const [shiftWorkingDays, setShiftWorkingDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [shiftColorTag, setShiftColorTag] = useState('#0d9488');
  const [shiftDesc, setShiftDesc] = useState('');
  const [shiftIsDefault, setShiftIsDefault] = useState(false);

  const [overtimeSettings, setOvertimeSettings] = useState<OvertimeSettings>(hrmService.getOvertimeSettings());
  const [overtimeMessage, setOvertimeMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [simHours, setSimHours] = useState<number>(3);
  const [simIsWeekend, setSimIsWeekend] = useState<boolean>(false);

  const simResult = hrmService.calculateOvertime(
    '17:00',
    `${17 + Math.floor(simHours)}:${(simHours % 1) * 60 === 30 ? '30' : '00'}`,
    simIsWeekend,
    overtimeSettings.hourlyRate
  );

  const handleSaveOvertime = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      hrmService.updateOvertimeSettings(overtimeSettings);
      setOvertimeMessage({ type: 'success', text: 'Pengaturan sistem & tarif lembur berhasil disimpan!' });
      setTimeout(() => setOvertimeMessage(null), 4000);
    } catch (err: any) {
      setOvertimeMessage({ type: 'error', text: err.message || 'Gagal menyimpan pengaturan lembur' });
    }
  };

  useEffect(() => {
    const s = hrmService.getAppSettings();
    setAppSettings(s);
    setLogoPreview(s.logoUrl);
    setOffice(hrmService.getOfficeLocation());
    setShifts(hrmService.getShifts());
    setOvertimeSettings(hrmService.getOvertimeSettings());
    setCompanyProfile(hrmService.getCompanyProfile());
    setCompanyDocs(hrmService.getCompanyDocuments());

    const handleShiftsUpdate = () => {
      setShifts(hrmService.getShifts());
    };
    window.addEventListener('hrm_shifts_updated', handleShiftsUpdate);
    return () => window.removeEventListener('hrm_shifts_updated', handleShiftsUpdate);
  }, []);

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Silakan pilih file gambar yang valid (PNG, JPG, SVG, WebP).'); return; }
    if (file.size > 2 * 1024 * 1024) { alert('Ukuran file maksimal 2 MB.'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setLogoPreview(dataUrl);
      setAppSettings((prev) => ({ ...prev, logoUrl: dataUrl }));
    };
    reader.readAsDataURL(file);
  };

  const handleResetLogo = () => {
    setLogoPreview(null);
    setAppSettings((prev) => ({ ...prev, logoUrl: null }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      hrmService.updateAppSettings(appSettings);
      setSettingsMessage({ type: 'success', text: 'Identitas dan Logo aplikasi berhasil disimpan!' });
      setTimeout(() => setSettingsMessage(null), 4000);
    } catch (err: any) {
      setSettingsMessage({ type: 'error', text: err.message || 'Gagal menyimpan pengaturan aplikasi' });
    }
  };

  const handleSaveBreakPolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updated = {
        ...appSettings,
        breakPolicyEnabled: appSettings.breakPolicyEnabled !== false,
        breakDurationMinutes: Number(appSettings.breakDurationMinutes) || 60,
        breakAllowOutside: appSettings.breakAllowOutside !== false,
      };
      hrmService.updateAppSettings(updated);
      setAppSettings(updated);

      fetch('/api/settings/break-policy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: updated.breakPolicyEnabled,
          durationMinutes: updated.breakDurationMinutes,
          allowOutside: updated.breakAllowOutside,
        }),
      }).catch(() => null);

      setBreakMessage({ type: 'success', text: 'Pengaturan Kebijakan Jam Istirahat (1 Jam) berhasil disimpan!' });
      setTimeout(() => setBreakMessage(null), 4000);
    } catch (err: any) {
      setBreakMessage({ type: 'error', text: err.message || 'Gagal menyimpan pengaturan jam istirahat' });
    }
  };

  const handleSaveCompanyProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await hrmService.updateCompanyProfile(companyProfile);
      setCompanyMessage({ type: 'success', text: 'Profil perusahaan berhasil disimpan ke database!' });
      setTimeout(() => setCompanyMessage(null), 4000);
    } catch (err: any) {
      setCompanyMessage({ type: 'error', text: err.message || 'Gagal menyimpan profil perusahaan' });
    }
  };

  const handleDocFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) { alert('Format file: PDF, JPG, PNG, DOC/DOCX'); return; }
    if (file.size > 5 * 1024 * 1024) { alert('Ukuran file maksimal 5 MB.'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      setDocFileUrl(reader.result as string);
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      setDocFileType(ext);
      setDocFileSizeKb(Math.round(file.size / 1024));
    };
    reader.readAsDataURL(file);
  };

  const handleAddDocument = () => {
    if (!docName.trim()) { alert('Nama dokumen wajib diisi.'); return; }
    if (!docFileUrl) { alert('Silakan pilih file dokumen terlebih dahulu.'); return; }
    try {
      hrmService.addCompanyDocument({
        name: docName.trim(),
        type: docType,
        fileUrl: docFileUrl,
        fileType: docFileType,
        fileSizeKb: docFileSizeKb,
        issuedDate: docIssuedDate || undefined,
        expiryDate: docExpiryDate || undefined,
        notes: docNotes.trim() || undefined,
        uploadedBy: 'Super Admin',
      });
      setCompanyDocs(hrmService.getCompanyDocuments());
      setDocModalOpen(false);
      resetDocForm();
      setDocMessage({ type: 'success', text: `Dokumen "${docName}" berhasil diunggah!` });
      setTimeout(() => setDocMessage(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Gagal mengunggah dokumen.');
    }
  };

  const resetDocForm = () => {
    setDocName(''); setDocType('akta_pendirian'); setDocIssuedDate(''); setDocExpiryDate('');
    setDocNotes(''); setDocFileUrl(null); setDocFileType(''); setDocFileSizeKb(0);
    if (docFileRef.current) docFileRef.current.value = '';
  };

  const handleDeleteDocument = (docId: string, docName: string) => {
    if (confirm(`Hapus dokumen "${docName}"?`)) {
      hrmService.deleteCompanyDocument(docId);
      setCompanyDocs(hrmService.getCompanyDocuments());
    }
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Perangkat/browser Anda tidak mendukung fitur geolokasi GPS.');
      return;
    }
    setGettingLocation(true);

    const applyOfficeLocation = (pos: GeolocationPosition, isFallback = false) => {
      const lat = Number(pos.coords.latitude.toFixed(6));
      const lng = Number(pos.coords.longitude.toFixed(6));
      const acc = Math.round(pos.coords.accuracy || 0);

      setOffice((prev) => ({
        ...prev,
        latitude: lat,
        longitude: lng,
      }));
      setGettingLocation(false);

      toast.success(
        `Titik GPS Kantor Berhasil Dideteksi! Lat: ${lat}, Lng: ${lng} (Akurasi: ±${acc}m${isFallback ? ' via Jaringan' : ''})`,
        { duration: 5000 }
      );
    };

    // 1. Coba High Accuracy (8s timeout, fresh reading)
    navigator.geolocation.getCurrentPosition(
      (pos) => applyOfficeLocation(pos, false),
      (highAccErr) => {
        console.warn('[GPS Detection Office] Beralih ke fallback jaringan...', highAccErr);
        // 2. Fallback mode jaringan
        navigator.geolocation.getCurrentPosition(
          (fallbackPos) => applyOfficeLocation(fallbackPos, true),
          (finalErr) => {
            setGettingLocation(false);
            if (finalErr.code === 1) {
              toast.error(
                'Izin lokasi ditolak di browser. Klik ikon gembok / lokasi di address bar browser dan pilih "Izinkan" untuk fawwazreskiperwira.com',
                { duration: 8000 }
              );
            } else {
              toast.error(
                `Gagal mengambil koordinat (${finalErr.message}). Silakan ketik titik koordinat secara manual dari Google Maps.`,
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

  const handleSaveOffice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await hrmService.updateOfficeLocation(office);
      setOfficeMessage({ type: 'success', text: 'Pengaturan lokasi kantor & radius berhasil disimpan ke database!' });
      setTimeout(() => setOfficeMessage(null), 4000);
    } catch (err: any) {
      setOfficeMessage({ type: 'error', text: err.message || 'Gagal menyimpan lokasi ke database' });
    }
  };

  const handleOpenAddShift = () => {
    setEditingShift(null);
    setShiftCode(`SHF${shifts.length + 1}`);
    setShiftName(''); setShiftStartTime('08:00'); setShiftEndTime('17:00');
    setShiftBreakStart('12:00'); setShiftBreakEnd('13:00'); setShiftTolerance(15);
    setShiftEarliestIn(60); setShiftIsCrossDay(false); setShiftWorkingDays([1, 2, 3, 4, 5]);
    setShiftColorTag('#0d9488'); setShiftDesc(''); setShiftIsDefault(false);
    setShiftModalOpen(true);
  };

  const handleOpenEditShift = (shift: Shift) => {
    setEditingShift(shift);
    setShiftCode(shift.code || 'REG'); setShiftName(shift.name);
    setShiftStartTime(shift.startTime); setShiftEndTime(shift.endTime);
    setShiftBreakStart(shift.breakStartTime || '12:00'); setShiftBreakEnd(shift.breakEndTime || '13:00');
    setShiftTolerance(shift.lateToleranceMinutes || 15); setShiftEarliestIn(shift.earliestClockInMinutes || 60);
    setShiftIsCrossDay(shift.isCrossDay || false); setShiftWorkingDays(shift.workingDays || [1, 2, 3, 4, 5]);
    setShiftColorTag(shift.colorTag || '#0d9488'); setShiftDesc(shift.description || '');
    setShiftIsDefault(shift.isDefault || false);
    setShiftModalOpen(true);
  };

  const handleSaveShiftModal = () => {
    if (!shiftName.trim()) { alert('Nama shift wajib diisi.'); return; }
    try {
      const payload: Omit<Shift, 'id'> = {
        code: shiftCode.trim().toUpperCase(), name: shiftName.trim(),
        startTime: shiftStartTime, endTime: shiftEndTime,
        breakStartTime: shiftBreakStart, breakEndTime: shiftBreakEnd,
        lateToleranceMinutes: Number(shiftTolerance), earliestClockInMinutes: Number(shiftEarliestIn),
        isCrossDay: shiftIsCrossDay, workingDays: shiftWorkingDays,
        colorTag: shiftColorTag, description: shiftDesc.trim(), isDefault: shiftIsDefault,
      };
      if (editingShift) {
        hrmService.updateShift(editingShift.id, payload);
      } else {
        hrmService.addShift(payload);
      }
      setShifts(hrmService.getShifts());
      setShiftModalOpen(false);
      setShiftMessage({ type: 'success', text: `Shift "${shiftName}" berhasil disimpan!` });
      setTimeout(() => setShiftMessage(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan shift.');
    }
  };

  const handleDeleteShift = (shift: Shift) => {
    if (confirm(`Hapus shift "${shift.name}"?`)) {
      try {
        hrmService.deleteShift(shift.id);
        setShifts(hrmService.getShifts());
      } catch (err: any) {
        alert(err.message || 'Gagal menghapus shift.');
      }
    }
  };

  const handleSetDefaultShift = (shiftId: string) => {
    hrmService.setDefaultShift(shiftId);
    setShifts(hrmService.getShifts());
  };

  const handleSaveShifts = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      hrmService.saveShifts(shifts);
      setShiftMessage({ type: 'success', text: 'Konfigurasi shift jam kerja berhasil diperbarui!' });
      setTimeout(() => setShiftMessage(null), 4000);
    } catch (err: any) {
      setShiftMessage({ type: 'error', text: err.message || 'Gagal menyimpan shift' });
    }
  };

  const DAY_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

  // ─── Tab Configuration ─────────────────────────────────────────────────────
  const tabs = [
    { id: 'branding', label: 'Branding', icon: Palette },
    { id: 'profil', label: 'Profil Perusahaan', icon: Building2 },
    { id: 'dokumen', label: 'Dokumen', icon: FileText },
    { id: 'lokasi', label: 'Lokasi & GPS', icon: MapPin },
    { id: 'shift', label: 'Shift Kerja', icon: Clock },
    { id: 'istirahat', label: 'Jam Istirahat', icon: Coffee },
    { id: 'lembur', label: 'Lembur', icon: Zap },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
          <Settings className="w-6 h-6 text-primary" />
          Pengaturan Sistem HRM
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Kelola profil perusahaan, dokumen resmi, branding, lokasi GPS, shift kerja, dan kebijakan lembur.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1.5 flex-wrap border-b border-border pb-0">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-t-lg border-b-2 transition-all -mb-px ${
                isActive
                  ? 'border-primary text-primary bg-primary/5'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ═══ TAB: BRANDING ══════════════════════════════════════════════════════ */}
      {activeTab === 'branding' && (
        <Card className="border-border bg-card rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-primary" />
              Logo & Branding Aplikasi
            </CardTitle>
            <CardDescription className="text-xs">
              Ganti logo perusahaan yang tampil di halaman login, sidebar, dan header aplikasi secara global.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {settingsMessage && (
              <Alert className="mb-4 py-2 text-xs border-border bg-primary/5 text-primary border-primary/20">
                <CheckCircle2 className="w-4 h-4" />
                <AlertDescription>{settingsMessage.text}</AlertDescription>
              </Alert>
            )}
            <form onSubmit={handleSaveSettings} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                <div className="flex flex-col items-center justify-center p-5 bg-muted/30 border border-border rounded-xl space-y-3">
                  <div className="w-24 h-24 rounded-2xl bg-card border border-border shadow-sm flex items-center justify-center overflow-hidden p-2">
                    <img src={logoPreview || defaultLogo} alt="Logo Preview" className="max-h-full max-w-full object-contain" />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-semibold text-foreground">{logoPreview ? 'Logo Kustom Aktif' : 'Logo Bawaan'}</p>
                    <p className="text-[11px] text-muted-foreground">Format PNG, JPG, SVG maks 2MB</p>
                  </div>
                </div>
                <div className="md:col-span-2 space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Nama Aplikasi / Perusahaan</Label>
                    <Input value={appSettings.appName} onChange={(e) => setAppSettings({ ...appSettings, appName: e.target.value })} placeholder="HRM Attendance System" className="text-xs rounded-xl" required />
                    <p className="text-[11px] text-muted-foreground">Nama ini tampil pada header navigasi dan judul halaman login.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Unggah File Logo Baru</Label>
                    <div className="flex flex-wrap items-center gap-3">
                      <input type="file" ref={fileInputRef} onChange={handleLogoFileChange} accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp" className="hidden" />
                      <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="text-xs gap-1.5 border-border rounded-xl">
                        <Upload className="w-3.5 h-3.5 text-primary" /> Pilih File Logo...
                      </Button>
                      {logoPreview && (
                        <Button type="button" variant="ghost" size="sm" onClick={handleResetLogo} className="text-xs gap-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl">
                          <RotateCcw className="w-3.5 h-3.5" /> Gunakan Logo Bawaan
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="pt-2">
                    <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium gap-2 text-xs rounded-xl">
                      <Save className="w-4 h-4" /> Simpan Logo & Identitas
                    </Button>
                  </div>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ═══ TAB: PROFIL PERUSAHAAN ══════════════════════════════════════════════ */}
      {activeTab === 'profil' && (
        <div className="space-y-5">
          {companyMessage && (
            <Alert className={`py-2 text-xs ${companyMessage.type === 'success' ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400' : 'border-destructive/20 bg-destructive/5 text-destructive'}`}>
              <CheckCircle2 className="w-4 h-4" />
              <AlertDescription>{companyMessage.text}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleSaveCompanyProfile} className="space-y-5">
            {/* Identitas Hukum */}
            <Card className="border-border bg-card rounded-xl shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  Identitas & Legalitas Perusahaan
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Nama Resmi Perusahaan <span className="text-destructive">*</span></Label>
                    <Input value={companyProfile.companyName} onChange={(e) => setCompanyProfile({ ...companyProfile, companyName: e.target.value })} placeholder="PT. NAMA PERUSAHAAN" className="text-xs rounded-xl font-semibold" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Nama Singkat / Brand</Label>
                    <Input value={companyProfile.shortName || ''} onChange={(e) => setCompanyProfile({ ...companyProfile, shortName: e.target.value })} placeholder="Nama singkat atau brand" className="text-xs rounded-xl" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Jenis Badan Usaha <span className="text-destructive">*</span></Label>
                    <Select value={companyProfile.legalType} onValueChange={(v) => setCompanyProfile({ ...companyProfile, legalType: v })}>
                      <SelectTrigger className="text-xs rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['PT', 'CV', 'Firma', 'Yayasan', 'Koperasi', 'UD', 'Perorangan'].map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Bidang Usaha / Industri</Label>
                    <Input value={companyProfile.businessSector || ''} onChange={(e) => setCompanyProfile({ ...companyProfile, businessSector: e.target.value })} placeholder="Teknologi Informasi, Manufaktur, dll" className="text-xs rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Tanggal Berdiri</Label>
                    <DatePicker value={companyProfile.foundedDate || ''} onChange={(v) => setCompanyProfile({ ...companyProfile, foundedDate: v })} placeholder="Tanggal berdiri perusahaan" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">NPWP Perusahaan</Label>
                    <Input value={companyProfile.npwp || ''} onChange={(e) => setCompanyProfile({ ...companyProfile, npwp: e.target.value })} placeholder="00.000.000.0-000.000" className="text-xs rounded-xl font-mono" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">NIB (Nomor Induk Berusaha)</Label>
                    <Input value={companyProfile.nib || ''} onChange={(e) => setCompanyProfile({ ...companyProfile, nib: e.target.value })} placeholder="1234567890123" className="text-xs rounded-xl font-mono" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Nomor Akta Pendirian</Label>
                    <Input value={companyProfile.deedNumber || ''} onChange={(e) => setCompanyProfile({ ...companyProfile, deedNumber: e.target.value })} placeholder="No. 001/Akta/2015" className="text-xs rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Nama Notaris</Label>
                    <Input value={companyProfile.deedNotary || ''} onChange={(e) => setCompanyProfile({ ...companyProfile, deedNotary: e.target.value })} placeholder="Notaris Budi Santoso, S.H." className="text-xs rounded-xl" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">No. SK Kemenkumham</Label>
                    <Input value={companyProfile.skMenkumham || ''} onChange={(e) => setCompanyProfile({ ...companyProfile, skMenkumham: e.target.value })} placeholder="AHU-0012345.AH.01.01.2015" className="text-xs rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">No. SIUP / Izin Usaha</Label>
                    <Input value={companyProfile.siupNumber || ''} onChange={(e) => setCompanyProfile({ ...companyProfile, siupNumber: e.target.value })} placeholder="SIUP-2015-001234" className="text-xs rounded-xl" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Alamat */}
            <Card className="border-border bg-card rounded-xl shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  Alamat Kantor Pusat
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Alamat Lengkap <span className="text-destructive">*</span></Label>
                  <Textarea value={companyProfile.address} onChange={(e) => setCompanyProfile({ ...companyProfile, address: e.target.value })} placeholder="Jl. Jenderal Sudirman Kav. 52-53..." className="text-xs rounded-xl resize-none" rows={2} required />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Kota</Label>
                    <Input value={companyProfile.city || ''} onChange={(e) => setCompanyProfile({ ...companyProfile, city: e.target.value })} placeholder="Jakarta Selatan" className="text-xs rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Provinsi</Label>
                    <Input value={companyProfile.province || ''} onChange={(e) => setCompanyProfile({ ...companyProfile, province: e.target.value })} placeholder="DKI Jakarta" className="text-xs rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Kode Pos</Label>
                    <Input value={companyProfile.postalCode || ''} onChange={(e) => setCompanyProfile({ ...companyProfile, postalCode: e.target.value })} placeholder="12190" className="text-xs rounded-xl font-mono" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Negara</Label>
                    <Input value={companyProfile.country || ''} onChange={(e) => setCompanyProfile({ ...companyProfile, country: e.target.value })} placeholder="Indonesia" className="text-xs rounded-xl" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Kontak & Sosmed */}
            <Card className="border-border bg-card rounded-xl shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Globe className="w-4 h-4 text-primary" />
                  Kontak & Media Sosial
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold flex items-center gap-1.5"><Phone className="w-3 h-3" /> No. Telepon</Label>
                    <Input value={companyProfile.phone || ''} onChange={(e) => setCompanyProfile({ ...companyProfile, phone: e.target.value })} placeholder="+62 21 1234 5678" className="text-xs rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold flex items-center gap-1.5"><Phone className="w-3 h-3" /> No. Fax</Label>
                    <Input value={companyProfile.fax || ''} onChange={(e) => setCompanyProfile({ ...companyProfile, fax: e.target.value })} placeholder="+62 21 1234 5679" className="text-xs rounded-xl" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold flex items-center gap-1.5"><Mail className="w-3 h-3" /> Email Perusahaan</Label>
                    <Input type="email" value={companyProfile.email || ''} onChange={(e) => setCompanyProfile({ ...companyProfile, email: e.target.value })} placeholder="info@perusahaan.co.id" className="text-xs rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold flex items-center gap-1.5"><Globe className="w-3 h-3" /> Website</Label>
                    <Input type="url" value={companyProfile.website || ''} onChange={(e) => setCompanyProfile({ ...companyProfile, website: e.target.value })} placeholder="https://perusahaan.co.id" className="text-xs rounded-xl" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold flex items-center gap-1.5"><Instagram className="w-3 h-3" /> Instagram</Label>
                    <Input value={companyProfile.instagram || ''} onChange={(e) => setCompanyProfile({ ...companyProfile, instagram: e.target.value })} placeholder="@nama_perusahaan" className="text-xs rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold flex items-center gap-1.5"><Linkedin className="w-3 h-3" /> LinkedIn</Label>
                    <Input value={companyProfile.linkedin || ''} onChange={(e) => setCompanyProfile({ ...companyProfile, linkedin: e.target.value })} placeholder="Nama-Perusahaan-ID" className="text-xs rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold flex items-center gap-1.5"><Facebook className="w-3 h-3" /> Facebook</Label>
                    <Input value={companyProfile.facebook || ''} onChange={(e) => setCompanyProfile({ ...companyProfile, facebook: e.target.value })} placeholder="NamaPerusahaan" className="text-xs rounded-xl" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Pimpinan */}
            <Card className="border-border bg-card rounded-xl shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  Struktur Pimpinan
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Nama Direktur / Pemilik</Label>
                    <Input value={companyProfile.directorName || ''} onChange={(e) => setCompanyProfile({ ...companyProfile, directorName: e.target.value })} placeholder="Nama Direktur Utama" className="text-xs rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Nama Manajer HRD</Label>
                    <Input value={companyProfile.hrManagerName || ''} onChange={(e) => setCompanyProfile({ ...companyProfile, hrManagerName: e.target.value })} placeholder="Nama Kepala HRD" className="text-xs rounded-xl" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Visi Misi */}
            <Card className="border-border bg-card rounded-xl shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" />
                  Visi & Misi Perusahaan
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Visi Perusahaan</Label>
                  <Textarea value={companyProfile.vision || ''} onChange={(e) => setCompanyProfile({ ...companyProfile, vision: e.target.value })} placeholder="Menjadi perusahaan terdepan yang..." className="text-xs rounded-xl resize-none" rows={3} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Misi Perusahaan</Label>
                  <Textarea value={companyProfile.mission || ''} onChange={(e) => setCompanyProfile({ ...companyProfile, mission: e.target.value })} placeholder="1. Memberikan layanan terbaik...&#10;2. Membangun tim profesional...&#10;3. Mendukung pertumbuhan..." className="text-xs rounded-xl resize-none" rows={5} />
                  <p className="text-[11px] text-muted-foreground">Gunakan baris baru untuk setiap poin misi.</p>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold gap-2 text-sm rounded-xl px-6">
                <Save className="w-4 h-4" /> Simpan Profil Perusahaan
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* ═══ TAB: DOKUMEN PERUSAHAAN ═════════════════════════════════════════════ */}
      {activeTab === 'dokumen' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">Dokumen Resmi Perusahaan</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Upload dan kelola berkas-berkas dokumen hukum, sertifikasi, dan legalitas perusahaan.</p>
            </div>
            <Button onClick={() => { resetDocForm(); setDocModalOpen(true); }} className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 text-xs rounded-xl">
              <Plus className="w-4 h-4" /> Tambah Dokumen
            </Button>
          </div>

          {docMessage && (
            <Alert className={`py-2 text-xs ${docMessage.type === 'success' ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400' : 'border-destructive/20 bg-destructive/5 text-destructive'}`}>
              <CheckCircle2 className="w-4 h-4" />
              <AlertDescription>{docMessage.text}</AlertDescription>
            </Alert>
          )}

          {companyDocs.length === 0 ? (
            <Card className="border-border bg-card rounded-xl shadow-sm">
              <CardContent className="py-16 text-center">
                <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8 text-muted-foreground/40" />
                </div>
                <p className="text-sm font-medium text-foreground">Belum ada dokumen diunggah</p>
                <p className="text-xs text-muted-foreground mt-1">Klik "Tambah Dokumen" untuk mulai mengelola berkas perusahaan</p>
                <Button onClick={() => { resetDocForm(); setDocModalOpen(true); }} variant="outline" className="mt-4 text-xs rounded-xl gap-2 border-primary/30 text-primary hover:bg-primary/10">
                  <Plus className="w-3.5 h-3.5" /> Upload Dokumen Pertama
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {companyDocs.map((doc) => (
                <Card key={doc.id} className="border-border bg-card rounded-xl shadow-sm hover:shadow-md transition-shadow group">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${COMPANY_DOC_COLORS[doc.type]}`}>
                        <FileText className="w-3 h-3" />
                        {COMPANY_DOC_LABELS[doc.type]}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {doc.fileUrl && (
                          <a href={doc.fileUrl} download={doc.name} className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors" title="Unduh">
                            <Download className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <button onClick={() => handleDeleteDocument(doc.id, doc.name)} className="p-1 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Hapus">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-foreground truncate mb-1">{doc.name}</p>
                    {doc.notes && <p className="text-[11px] text-muted-foreground line-clamp-2 mb-2">{doc.notes}</p>}
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-2 pt-2 border-t border-border">
                      <span className="uppercase font-mono font-medium">{doc.fileType || 'file'} {doc.fileSizeKb ? `· ${doc.fileSizeKb} KB` : ''}</span>
                      <span>{formatDocDate(doc.issuedDate)}</span>
                    </div>
                    {doc.expiryDate && (
                      <div className={`mt-2 text-[11px] flex items-center gap-1 font-medium ${isDocExpired(doc.expiryDate) ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`}>
                        <AlertTriangle className="w-3 h-3" />
                        {isDocExpired(doc.expiryDate) ? 'Kadaluarsa:' : 'Berlaku s/d:'} {formatDocDate(doc.expiryDate)}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Add Document Dialog */}
          <Dialog open={docModalOpen} onOpenChange={setDocModalOpen}>
            <DialogContent className="max-w-lg rounded-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base">
                  <FileText className="w-5 h-5 text-primary" /> Tambah Dokumen Perusahaan
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Upload berkas resmi perusahaan. Format: PDF, JPG, PNG, DOCX (maks 5 MB).
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 my-2 max-h-[60vh] overflow-y-auto pr-1">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Nama Dokumen <span className="text-destructive">*</span></Label>
                  <Input value={docName} onChange={(e) => setDocName(e.target.value)} placeholder="Contoh: Akta Pendirian No. 001" className="text-xs rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Jenis Dokumen <span className="text-destructive">*</span></Label>
                  <Select value={docType} onValueChange={(v) => setDocType(v as CompanyDocumentType)}>
                    <SelectTrigger className="text-xs rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(COMPANY_DOC_LABELS) as CompanyDocumentType[]).map((t) => (
                        <SelectItem key={t} value={t}>{COMPANY_DOC_LABELS[t]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Tanggal Terbit</Label>
                    <DatePicker value={docIssuedDate} onChange={(v) => setDocIssuedDate(v)} placeholder="Tanggal terbit" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Tanggal Kadaluarsa</Label>
                    <DatePicker value={docExpiryDate} onChange={(v) => setDocExpiryDate(v)} placeholder="Tanggal kadaluarsa" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Catatan</Label>
                  <Textarea value={docNotes} onChange={(e) => setDocNotes(e.target.value)} placeholder="Catatan tambahan tentang dokumen ini..." className="text-xs rounded-xl resize-none" rows={2} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">File Dokumen <span className="text-destructive">*</span></Label>
                  <input type="file" ref={docFileRef} onChange={handleDocFileChange} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" className="hidden" />
                  {docFileUrl ? (
                    <div className="flex items-center gap-2 p-3 bg-muted/40 border border-border rounded-xl">
                      <FileText className="w-5 h-5 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">{docName || 'File terpilih'}</p>
                        <p className="text-[11px] text-muted-foreground">{docFileType.toUpperCase()} · {docFileSizeKb} KB</p>
                      </div>
                      <Button type="button" variant="ghost" size="sm" onClick={() => { setDocFileUrl(null); if (docFileRef.current) docFileRef.current.value = ''; }} className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg">
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => docFileRef.current?.click()} className="w-full h-24 border-2 border-dashed border-border hover:border-primary/50 rounded-xl flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary transition-colors group">
                      <Upload className="w-6 h-6 group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-medium">Klik untuk pilih file...</span>
                      <span className="text-[11px]">PDF, JPG, PNG, DOCX — maks 5 MB</span>
                    </button>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setDocModalOpen(false)} className="text-xs rounded-xl">Batal</Button>
                <Button onClick={handleAddDocument} className="bg-primary text-primary-foreground text-xs rounded-xl gap-1.5">
                  <Upload className="w-3.5 h-3.5" /> Upload Dokumen
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* ═══ TAB: LOKASI & GPS ══════════════════════════════════════════════════ */}
      {activeTab === 'lokasi' && (
        <Card className="border-border bg-card rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              Titik Koordinat & Geofencing Kantor
            </CardTitle>
            <CardDescription className="text-xs">
              Karyawan hanya dapat melakukan presensi jika berada dalam batas radius meter yang ditentukan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {officeMessage && (
              <Alert className="mb-4 py-2 text-xs border-border"><AlertDescription>{officeMessage.text}</AlertDescription></Alert>
            )}
            <form onSubmit={handleSaveOffice} className="space-y-4">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Nama Lokasi Kantor</Label>
                <Input value={office.name} onChange={(e) => setOffice({ ...office, name: e.target.value })} placeholder="Gedung Pusat Graha HRM" className="text-xs rounded-xl" required />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Alamat Lengkap</Label>
                <Input value={office.address} onChange={(e) => setOffice({ ...office, address: e.target.value })} placeholder="Jl. Jenderal Sudirman..." className="text-xs rounded-xl" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Latitude (Lintang)</Label>
                  <Input type="number" step="any" value={office.latitude} onChange={(e) => setOffice({ ...office, latitude: Number(e.target.value) })} className="text-xs rounded-xl font-mono" required />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Longitude (Bujur)</Label>
                  <Input type="number" step="any" value={office.longitude} onChange={(e) => setOffice({ ...office, longitude: Number(e.target.value) })} className="text-xs rounded-xl font-mono" required />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Radius Geofencing (Meter)</Label>
                <Input type="number" min="10" max="5000" value={office.radiusMeters} onChange={(e) => setOffice({ ...office, radiusMeters: Number(e.target.value) })} className="text-xs rounded-xl" required />
                <p className="text-[11px] text-muted-foreground">Jarak maksimal karyawan dari titik koordinat kantor agar presensi valid. Rekomendasi: 100–200 meter.</p>
              </div>

              {/* Wi-Fi & BSSID Whitelist Section */}
              <div className="p-3 bg-muted/40 border border-border rounded-xl space-y-3">
                <div className="flex items-center gap-2">
                  <Wifi className="w-4 h-4 text-primary" />
                  <div>
                    <p className="text-xs font-semibold text-foreground">Validasi Jaringan Tambahan (Whitelist Wi-Fi & BSSID)</p>
                    <p className="text-[11px] text-muted-foreground">Opsi validasi sekunder guna mengantisipasi GPS drift akibat pantulan sinyal gedung beton bertingkat.</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Whitelist MAC Address / BSSID Router</Label>
                    <Input
                      value={office.bssidWhitelist || ''}
                      onChange={(e) => setOffice({ ...office, bssidWhitelist: e.target.value })}
                      placeholder="Contoh: 00:14:22:01:23:45, a4:2b:b0:c1:d2:e3"
                      className="text-xs rounded-xl font-mono"
                    />
                    <p className="text-[10px] text-muted-foreground">Daftarkan BSSID access point kantor (pisahkan koma jika banyak router).</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Nama SSID Wi-Fi Resmi</Label>
                    <Input
                      value={office.wifiSsid || ''}
                      onChange={(e) => setOffice({ ...office, wifiSsid: e.target.value })}
                      placeholder="Contoh: OFFICE_CORP_WIFI_5G"
                      className="text-xs rounded-xl"
                    />
                    <p className="text-[10px] text-muted-foreground">Nama Wi-Fi kantor yang wajib terhubung saat presensi.</p>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Button type="button" variant="outline" size="sm" onClick={handleGetCurrentLocation} disabled={gettingLocation} className="text-xs gap-1.5 border-border rounded-xl">
                  <Crosshair className="w-3.5 h-3.5 text-primary" />
                  {gettingLocation ? 'Mengambil Koordinat...' : 'Gunakan Lokasi Saat Ini'}
                </Button>
                <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium gap-2 text-xs rounded-xl">
                  <Save className="w-4 h-4" /> Simpan Konfigurasi Lokasi
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ═══ TAB: SHIFT KERJA ═══════════════════════════════════════════════════ */}
      {activeTab === 'shift' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">Konfigurasi Shift Jam Kerja</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Atur jadwal masuk, pulang, istirahat, dan hari kerja untuk setiap shift.</p>
            </div>
            <Button onClick={handleOpenAddShift} className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 text-xs rounded-xl">
              <Plus className="w-4 h-4" /> Tambah Shift
            </Button>
          </div>
          {shiftMessage && (
            <Alert className={`py-2 text-xs ${shiftMessage.type === 'success' ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400' : 'border-destructive/20 bg-destructive/5 text-destructive'}`}>
              <CheckCircle2 className="w-4 h-4" />
              <AlertDescription>{shiftMessage.text}</AlertDescription>
            </Alert>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {shifts.map((shift) => (
              <Card key={shift.id} className="border-border bg-card rounded-xl shadow-sm overflow-hidden">
                <div className="h-1.5 w-full" style={{ backgroundColor: shift.colorTag || '#0d9488' }} />
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-bold text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">
                          {shift.code && shift.code !== 'SHIF' ? shift.code : (
                            shift.name.includes('Day Shift') ? 'DAY' :
                            shift.name.includes('Shift III') ? 'SHF-III' :
                            shift.name.includes('Shift II') ? 'SHF-II' :
                            shift.name.includes('Shift I ') || shift.name.includes('Shift I(') ? 'SHF-I' :
                            (shift.code || 'SHF')
                          )}
                        </span>
                        {shift.isDefault && <Badge className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20">Default</Badge>}
                      </div>
                      <p className="font-semibold text-sm text-foreground mt-1">{shift.name}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => handleOpenEditShift(shift)} className="h-7 w-7 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg">
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteShift(shift)} className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-xs text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <span>Jam Kerja</span>
                      <span className="font-semibold text-foreground font-mono">{shift.startTime} – {shift.endTime}</span>
                    </div>
                    {shift.breakStartTime && (
                      <div className="flex items-center justify-between">
                        <span>Istirahat</span>
                        <span className="font-semibold text-foreground font-mono">{shift.breakStartTime} – {shift.breakEndTime}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span>Toleransi Terlambat</span>
                      <span className="font-semibold text-foreground">{shift.lateToleranceMinutes} menit</span>
                    </div>
                    {shift.workingDays && (
                      <div className="flex items-center justify-between">
                        <span>Hari Kerja</span>
                        <div className="flex gap-0.5">
                          {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                            <span key={d} className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${shift.workingDays!.includes(d) ? 'bg-primary/15 text-primary' : 'bg-muted/40 text-muted-foreground/30'}`}>
                              {DAY_NAMES[d][0]}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  {!shift.isDefault && (
                    <Button variant="ghost" size="sm" onClick={() => handleSetDefaultShift(shift.id)} className="mt-3 w-full h-7 text-[11px] text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg border border-border">
                      <Star className="w-3 h-3 mr-1" /> Jadikan Default
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Shift Modal */}
          <Dialog open={shiftModalOpen} onOpenChange={setShiftModalOpen}>
            <DialogContent className="max-w-2xl rounded-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  {editingShift ? `Edit Shift: ${editingShift.name}` : 'Tambah Shift Kerja Baru'}
                </DialogTitle>
                <DialogDescription className="text-xs">Atur jadwal, toleransi, dan hari kerja untuk shift ini.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 my-2 max-h-[65vh] overflow-y-auto pr-1">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Kode Shift</Label>
                    <Input value={shiftCode} onChange={(e) => setShiftCode(e.target.value.toUpperCase())} placeholder="REG" className="text-xs rounded-xl font-mono uppercase" maxLength={6} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Nama Shift <span className="text-destructive">*</span></Label>
                    <Input value={shiftName} onChange={(e) => setShiftName(e.target.value)} placeholder="Normal Day (Pagi)" className="text-xs rounded-xl" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Jam Masuk</Label>
                    <Input type="time" value={shiftStartTime} onChange={(e) => setShiftStartTime(e.target.value)} className="text-xs rounded-xl" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Jam Pulang</Label>
                    <Input type="time" value={shiftEndTime} onChange={(e) => setShiftEndTime(e.target.value)} className="text-xs rounded-xl" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Mulai Istirahat</Label>
                    <Input type="time" value={shiftBreakStart} onChange={(e) => setShiftBreakStart(e.target.value)} className="text-xs rounded-xl" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Selesai Istirahat</Label>
                    <Input type="time" value={shiftBreakEnd} onChange={(e) => setShiftBreakEnd(e.target.value)} className="text-xs rounded-xl" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Toleransi Terlambat (menit)</Label>
                    <Input type="number" min={0} value={shiftTolerance} onChange={(e) => setShiftTolerance(Number(e.target.value))} className="text-xs rounded-xl" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Paling Awal Absen Masuk (menit)</Label>
                    <Input type="number" min={0} value={shiftEarliestIn} onChange={(e) => setShiftEarliestIn(Number(e.target.value))} className="text-xs rounded-xl" />
                    <p className="text-[11px] text-muted-foreground">Berapa menit sebelum jam masuk karyawan boleh absen.</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Hari Kerja</Label>
                  <div className="flex gap-2 flex-wrap">
                    {DAY_NAMES.map((day, idx) => (
                      <button key={idx} type="button"
                        onClick={() => setShiftWorkingDays((prev) => prev.includes(idx) ? prev.filter((d) => d !== idx) : [...prev, idx].sort())}
                        className={`w-10 h-10 rounded-xl text-xs font-bold border transition-all ${shiftWorkingDays.includes(idx) ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-card text-muted-foreground border-border hover:bg-muted'}`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Warna Tag</Label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={shiftColorTag} onChange={(e) => setShiftColorTag(e.target.value)} className="w-9 h-9 rounded-xl border border-border cursor-pointer" />
                      <span className="text-xs font-mono text-muted-foreground">{shiftColorTag}</span>
                    </div>
                  </div>
                  <div className="space-y-1 flex flex-col justify-end">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={shiftIsCrossDay} onChange={(e) => setShiftIsCrossDay(e.target.checked)} className="w-4 h-4 accent-primary rounded" />
                      <span className="text-xs font-semibold">Shift Lintas Hari (Malam)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={shiftIsDefault} onChange={(e) => setShiftIsDefault(e.target.checked)} className="w-4 h-4 accent-primary rounded" />
                      <span className="text-xs font-semibold">Jadikan Shift Default</span>
                    </label>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Deskripsi Shift</Label>
                  <Textarea value={shiftDesc} onChange={(e) => setShiftDesc(e.target.value)} placeholder="Keterangan tambahan untuk shift ini..." className="text-xs rounded-xl resize-none" rows={2} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setShiftModalOpen(false)} className="text-xs rounded-xl">Batal</Button>
                <Button onClick={handleSaveShiftModal} className="bg-primary text-primary-foreground text-xs rounded-xl gap-1.5">
                  <Save className="w-3.5 h-3.5" /> {editingShift ? 'Perbarui Shift' : 'Tambah Shift'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* ═══ TAB: JAM ISTIRAHAT ══════════════════════════════════════════════ */}
      {activeTab === 'istirahat' && (
        <div className="space-y-5">
          {breakMessage && (
            <Alert className={`py-2 text-xs ${breakMessage.type === 'success' ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400' : 'border-destructive/20 bg-destructive/5 text-destructive'}`}>
              <CheckCircle2 className="w-4 h-4" />
              <AlertDescription>{breakMessage.text}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSaveBreakPolicy} className="space-y-5">
            <Card className="border-border bg-card rounded-xl shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Coffee className="w-5 h-5 text-amber-600" />
                  Kebijakan Jam Istirahat Karyawan (1 Jam Break Policy)
                </CardTitle>
                <CardDescription className="text-xs">
                  Atur hak jam istirahat untuk karyawan yang bertugas. Selama jam istirahat aktif, karyawan diizinkan meninggalkan radius pos kerja tanpa alarm pelanggaran perimeter radar.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-1">
                {/* Switch Enable */}
                <div className="flex items-center justify-between p-3.5 bg-muted/30 border border-border rounded-xl">
                  <div className="space-y-0.5 pr-4">
                    <Label className="text-xs font-bold text-foreground">
                      Aktifkan Fitur Jam Istirahat (1 Jam)
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      Karyawan yang sudah presensi masuk dapat mengaktifkan jam istirahat melalui dashboard mereka.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={appSettings.breakPolicyEnabled !== false}
                    onChange={(e) => setAppSettings({ ...appSettings, breakPolicyEnabled: e.target.checked })}
                    className="w-5 h-5 accent-primary rounded cursor-pointer shrink-0"
                  />
                </div>

                {/* Input Durasi */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">
                      Batas Durasi Istirahat (Menit)
                    </Label>
                    <div className="relative">
                      <Input
                        type="number"
                        min={15}
                        max={180}
                        value={appSettings.breakDurationMinutes || 60}
                        onChange={(e) => setAppSettings({ ...appSettings, breakDurationMinutes: parseInt(e.target.value, 10) || 60 })}
                        className="text-xs rounded-xl font-mono pr-14"
                        required
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-semibold">
                        Menit
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Standar resmi pimpinan adalah 60 menit (1 Jam).
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">
                      Izin Meninggalkan Area Pos (Geofence Bypass)
                    </Label>
                    <div className="flex items-center gap-2.5 p-2.5 bg-muted/20 border border-border rounded-xl h-9">
                      <input
                        type="checkbox"
                        checked={appSettings.breakAllowOutside !== false}
                        onChange={(e) => setAppSettings({ ...appSettings, breakAllowOutside: e.target.checked })}
                        className="w-4 h-4 accent-primary rounded cursor-pointer"
                        id="breakAllowOutsideCheck"
                      />
                      <label htmlFor="breakAllowOutsideCheck" className="text-xs text-foreground font-medium cursor-pointer">
                        Izinkan keluar area kerja (makan di luar)
                      </label>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Perimeter breach radar dan alarm WhatsApp dijeda selama masa istirahat berlangsung.
                    </p>
                  </div>
                </div>

                {/* Automatic Notice System Card */}
                <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-950 dark:text-amber-100 space-y-1.5 leading-relaxed">
                  <div className="font-bold flex items-center gap-2 text-amber-700 dark:text-amber-300">
                    <Clock className="w-4 h-4 shrink-0" />
                    Mekanisme Peringatan Otomatis Sistem
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-[11px] text-muted-foreground dark:text-amber-200/80">
                    <li>
                      <strong>Countdown Timer Live:</strong> Aplikasi karyawan menampilkan hitung mundur sisa waktu secara langsung.
                    </li>
                    <li>
                      <strong>Peringatan 10 Menit:</strong> Sistem otomatis mengirim peringatan di layar & getar ke HP karyawan 10 menit sebelum waktu habis agar bersiap kembali ke pos.
                    </li>
                    <li>
                      <strong>Peringatan Waktu Habis:</strong> Begitu 60 menit habis, alarm sistem langsung mengingatkan karyawan untuk segera kembali ke lokasi kerja dan menyelesaikan istirahat.
                    </li>
                  </ul>
                </div>
              </CardContent>
              <div className="flex justify-end p-4 border-t border-border">
                <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold gap-2 text-xs rounded-xl px-5">
                  <Save className="w-4 h-4" /> Simpan Pengaturan Jam Istirahat
                </Button>
              </div>
            </Card>
          </form>
        </div>
      )}

      {/* ═══ TAB: LEMBUR ════════════════════════════════════════════════════════ */}
      {activeTab === 'lembur' && (
        <div className="space-y-5">
          {overtimeMessage && (
            <Alert className={`py-2 text-xs ${overtimeMessage.type === 'success' ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400' : 'border-destructive/20 bg-destructive/5 text-destructive'}`}>
              <CheckCircle2 className="w-4 h-4" />
              <AlertDescription>{overtimeMessage.text}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleSaveOvertime} className="space-y-5">
            <Card className="border-border bg-card rounded-xl shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Coins className="w-4 h-4 text-primary" />
                  Tarif & Kebijakan Lembur
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Tarif Dasar Lembur per Jam (Rp)</Label>
                    <Input type="number" min={0} value={overtimeSettings.hourlyRate} onChange={(e) => setOvertimeSettings({ ...overtimeSettings, hourlyRate: Number(e.target.value) })} className="text-xs rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Pengali Hari Libur / Akhir Pekan (×)</Label>
                    <Input type="number" min={1} step={0.25} value={overtimeSettings.weekendRateMultiplier} onChange={(e) => setOvertimeSettings({ ...overtimeSettings, weekendRateMultiplier: Number(e.target.value) })} className="text-xs rounded-xl" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Durasi Minimum Lembur (Menit)</Label>
                    <Input type="number" min={1} value={overtimeSettings.minDurationMinutes} onChange={(e) => setOvertimeSettings({ ...overtimeSettings, minDurationMinutes: Number(e.target.value) })} className="text-xs rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Pembulatan Waktu (Menit)</Label>
                    <Select value={String(overtimeSettings.roundingMinutes)} onValueChange={(v) => setOvertimeSettings({ ...overtimeSettings, roundingMinutes: Number(v) })}>
                      <SelectTrigger className="text-xs rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[15, 30, 60].map((m) => <SelectItem key={m} value={String(m)}>Per {m} menit</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Batas Maksimal Lembur per Hari (Jam)</Label>
                  <Input type="number" min={1} max={12} value={overtimeSettings.maxDailyHours} onChange={(e) => setOvertimeSettings({ ...overtimeSettings, maxDailyHours: Number(e.target.value) })} className="text-xs rounded-xl w-40" />
                </div>
                <div className="flex flex-col gap-3">
                  <label className="flex items-center gap-2.5 cursor-pointer group">
                    <input type="checkbox" checked={overtimeSettings.autoDetectFromClockOut} onChange={(e) => setOvertimeSettings({ ...overtimeSettings, autoDetectFromClockOut: e.target.checked })} className="w-4 h-4 accent-primary rounded" />
                    <div>
                      <p className="text-xs font-semibold text-foreground">Deteksi Otomatis dari Presensi Pulang</p>
                      <p className="text-[11px] text-muted-foreground">Sistem akan otomatis membuat catatan lembur jika jam pulang melebihi jam kerja normal.</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-2.5 cursor-pointer group">
                    <input type="checkbox" checked={overtimeSettings.requireApproval} onChange={(e) => setOvertimeSettings({ ...overtimeSettings, requireApproval: e.target.checked })} className="w-4 h-4 accent-primary rounded" />
                    <div>
                      <p className="text-xs font-semibold text-foreground">Wajib Persetujuan Admin/HRD</p>
                      <p className="text-[11px] text-muted-foreground">Lembur harus disetujui sebelum uang lembur dapat dicairkan melalui penggajian.</p>
                    </div>
                  </label>
                </div>
              </CardContent>
            </Card>

            {/* Live Simulator */}
            <Card className="border-border bg-card rounded-xl shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-primary" />
                  Kalkulator Lembur Langsung
                </CardTitle>
                <CardDescription className="text-xs">Simulasikan perhitungan uang lembur berdasarkan pengaturan saat ini.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Durasi Lembur (Jam)</Label>
                    <Input type="number" min={0.5} max={12} step={0.5} value={simHours} onChange={(e) => setSimHours(Number(e.target.value))} className="text-xs rounded-xl" />
                  </div>
                  <div className="space-y-1.5 flex flex-col justify-end">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={simIsWeekend} onChange={(e) => setSimIsWeekend(e.target.checked)} className="w-4 h-4 accent-primary rounded" />
                      <span className="text-xs font-semibold">Hari Libur / Akhir Pekan</span>
                    </label>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-muted/40 border border-border text-center">
                    <p className="text-[11px] text-muted-foreground font-medium">Jam Lembur Diakui</p>
                    <p className="text-xl font-bold text-foreground mt-0.5">{simResult.approvedHours} <span className="text-xs font-normal text-muted-foreground">jam</span></p>
                  </div>
                  <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-center">
                    <p className="text-[11px] text-primary font-medium">Total Uang Lembur</p>
                    <p className="text-xl font-bold text-primary mt-0.5">
                      Rp {simResult.totalPay.toLocaleString('id-ID')}
                    </p>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">* Pengali {simIsWeekend ? `${overtimeSettings.weekendRateMultiplier}×` : '1×'} diterapkan. Pembulatan per {overtimeSettings.roundingMinutes} menit.</p>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold gap-2 text-sm rounded-xl px-6">
                <Save className="w-4 h-4" /> Simpan Pengaturan Lembur
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
