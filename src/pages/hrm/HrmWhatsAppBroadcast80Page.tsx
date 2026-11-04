import React, { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '@/services/apiClient';
import {
  MessageSquare,
  Send,
  Users,
  CheckCircle2,
  AlertCircle,
  Phone,
  Edit2,
  Save,
  Search,
  Sparkles,
  Clock,
  ShieldCheck,
  Filter,
  Check,
  X,
  RefreshCw,
  Radio,
  FileText,
  Smartphone,
  ChevronRight,
  Info,
  CheckCheck,
  Loader2,
  AlertTriangle,
  Building2,
  Briefcase,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface Employee80 {
  id: string;
  nip: string;
  fullName: string;
  phone: string | null;
  divisionId: string | null;
  divisionName: string | null;
  roleName: string | null;
  jobPosition: string | null;
  operationalGroup: string | null;
  groupName: 'SHIPMENT' | 'RUMAH TANGGA' | string;
  hasPhone: boolean;
}

interface Summary80 {
  totalCount: number;
  shipmentCount: number;
  rumahTanggaCount: number;
  withPhoneCount: number;
  withoutPhoneCount: number;
}

interface GatewayStatus {
  connected: boolean;
  phone: string;
  status: string;
  hasQr?: boolean;
}

const PRESET_TEMPLATES = [
  {
    id: 'pengumuman-manajemen',
    title: '📢 Pengumuman Resmi Manajemen',
    desc: 'Instruksi umum kedisiplinan dan pengumuman operasional',
    text: `*PENGUMUMAN RESMI MANAJEMEN PT. FAWWAZ RESKI PERWIRA*\n\nKepada Yth. Rekan *{nama}* ({nip})\nPenempatan: *{divisi}* (Grup: *{grup}*)\n\nDisampaikan kepada seluruh personil bahwa per tanggal {tanggal}, diharapkan seluruh karyawan meningkatkan kedisiplinan operasional kerja, mematuhi SOP K3, serta tertib dalam pelaksanaan absensi masuk dan pulang.\n\nDemikian penyampaian ini untuk dilaksanakan dengan penuh rasa tanggung jawab.\n\n_Manajemen PT. FAWWAZ RESKI PERWIRA_`,
  },
  {
    id: 'jadwal-shift-roster',
    title: '📅 Pemberitahuan Jadwal Shift & Roster',
    desc: 'Pengingat update matriks shift bulan berjalan',
    text: `*PEMBERITAHUAN JADWAL SHIFT KERJA PT. FAWWAZ RESKI PERWIRA*\n\nHalo *{nama}* ({nip}),\n\nJadwal shift kerja bulan berjalan telah diperbarui pada sistem absensi digital PT FRP. Silakan buka aplikasi PWA Absensi Anda untuk memeriksa jadwal shift harian ({grup} - *{divisi}*).\n\nPastikan Anda hadir sesuai jam dinas yang ditentukan:\n• Pagi (Shift I): 07:30 - 15:30 WITA\n• Siang (Shift II): 15:30 - 22:30 WITA\n• Malam (Shift III): 22:30 - 07:30 WITA\n• Day Shift: 07:30 - 16:30 WITA\n\nTetap utamakan keselamatan kerja.\n\n_Koordinator Lapangan & HRD PT FRP_`,
  },
  {
    id: 'peringatan-presensi',
    title: '⏱️ Instruksi Absensi Masuk & Pulang',
    desc: 'Peringatan geofence lokasi dan jam scan presensi',
    text: `*PERINGATAN KEDISIPLINAN PRESENSI LAPANGAN*\n\nYth. *{nama}* ({nip})\nUnit Kerja: *{divisi}*\n\nDiingatkan kembali agar selalu melakukan *Clock-In* tepat waktu di radius pos penugasan resmi Anda, dan melakukan *Clock-Out* saat jam dinas berakhir.\n\nPerhatikan:\n1. Presensi wajib verifikasi biometrik wajah & GPS aktif.\n2. Keterlambatan melebihi batas toleransi akan tercatat otomatis pada sistem payroll.\n3. Jangan lupa Clock-Out saat meninggalkan area tugas.\n\nSelamat bertugas dan jaga stamina!\n\n_Superadmin Sistem HRM PT FRP_`,
  },
  {
    id: 'himbauan-k3',
    title: '⚠️ Himbauan K3 & Keselamatan Lapangan',
    desc: 'Standar keselamatan kerja & APD operasional',
    text: `*HIMBAUAN K3 & KESELAMATAN KERJA PT FRP*\n\nKepada Saudara *{nama}* ({nip})\nArea Tugas: *{divisi}*\n\nUtamakan Keselamatan dan Kesehatan Kerja (K3) selama bertugas di lapangan. Pastikan:\n✅ Menggunakan APD lengkap (Rompi, Helm Safety, Sepatu Safety)\n✅ Mematuhi rambu-rambu dan jalur operasional\n✅ Laporkan segera ke Korlap / Petugas K3 jika terdapat kondisi darurat atau anomali di area pos\n\nKeluarga menanti Anda pulang dengan selamat.\n\n_Tim K3 & HSE PT. FAWWAZ RESKI PERWIRA_`,
  },
];

export const HrmWhatsAppBroadcast80Page: React.FC = () => {
  const [employees, setEmployees] = useState<Employee80[]>([]);
  const [summary, setSummary] = useState<Summary80>({
    totalCount: 80,
    shipmentCount: 47,
    rumahTanggaCount: 33,
    withPhoneCount: 0,
    withoutPhoneCount: 80,
  });
  const [gatewayStatus, setGatewayStatus] = useState<GatewayStatus>({
    connected: false,
    phone: '087812379189',
    status: 'checking',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Form State
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<'ALL' | 'SHIPMENT' | 'RUMAH_TANGGA' | 'HAS_PHONE' | 'NO_PHONE'>('ALL');
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [messageTemplate, setMessageTemplate] = useState<string>(PRESET_TEMPLATES[0].text);
  const [delayMs, setDelayMs] = useState<number>(1200);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Inline Phone Edit State
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editPhoneValue, setEditPhoneValue] = useState<string>('');
  const [isSavingPhone, setIsSavingPhone] = useState(false);

  // Broadcast Sending State & Progress Modal
  const [isSendingModalOpen, setIsSendingModalOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState<{
    total: number;
    current: number;
    sent: number;
    skipped: number;
    failed: number;
    currentName: string;
    isFinished: boolean;
  }>({
    total: 0,
    current: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    currentName: '',
    isFinished: false,
  });
  const [sendLogs, setSendLogs] = useState<Array<{ name: string; nip: string; phone: string; status: 'sent' | 'skipped' | 'failed'; error?: string }>>([]);
  const abortControllerRef = useRef<boolean>(false);

  // Load Data from Backend
  const loadData = async () => {
    try {
      setIsRefreshing(true);
      const [empRes, gwRes] = await Promise.all([
        api.get<{ success: boolean; summary: Summary80; employees: Employee80[] }>('/whatsapp/employees-80'),
        api.get<{ success: boolean; connected: boolean; phone: string; status: string }>('/whatsapp/gateway-status').catch(() => null),
      ]);

      if (empRes && empRes.success) {
        setEmployees(empRes.employees);
        setSummary(empRes.summary);
        // By default select all employees with phone
        const initialSelected = new Set(
          empRes.employees.filter((e) => e.hasPhone).map((e) => e.id)
        );
        setSelectedUserIds(initialSelected);
      }

      if (gwRes && gwRes.success) {
        setGatewayStatus(gwRes);
      } else {
        setGatewayStatus({ connected: false, phone: '087812379189', status: 'offline' });
      }
    } catch (err: any) {
      toast.error('Gagal memuat data karyawan atau gateway WhatsApp: ' + (err.message || 'Error'));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      api.get<{ success: boolean; connected: boolean; phone: string; status: string }>('/whatsapp/gateway-status')
        .then((gwRes) => {
          if (gwRes && gwRes.success) setGatewayStatus(gwRes);
        })
        .catch(() => {});
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // Filtered Employees List
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      // Group filter
      if (selectedGroupFilter === 'SHIPMENT' && emp.groupName !== 'SHIPMENT') return false;
      if (selectedGroupFilter === 'RUMAH_TANGGA' && emp.groupName !== 'RUMAH TANGGA') return false;
      if (selectedGroupFilter === 'HAS_PHONE' && !emp.hasPhone) return false;
      if (selectedGroupFilter === 'NO_PHONE' && emp.hasPhone) return false;

      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = (emp.fullName || '').toLowerCase().includes(q);
        const matchNip = (emp.nip || '').toLowerCase().includes(q);
        const matchDiv = (emp.divisionName || '').toLowerCase().includes(q);
        const matchPhone = (emp.phone || '').includes(q);
        return matchName || matchNip || matchDiv || matchPhone;
      }
      return true;
    });
  }, [employees, selectedGroupFilter, searchQuery]);

  // Selection handlers
  const handleToggleSelectAllFiltered = () => {
    const next = new Set(selectedUserIds);
    const allFilteredSelected = filteredEmployees.every((e) => next.has(e.id));
    if (allFilteredSelected) {
      filteredEmployees.forEach((e) => next.delete(e.id));
    } else {
      filteredEmployees.forEach((e) => next.add(e.id));
    }
    setSelectedUserIds(next);
  };

  const handleToggleUser = (id: string) => {
    const next = new Set(selectedUserIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedUserIds(next);
  };

  const handleSelectGroupQuick = (group: 'ALL' | 'SHIPMENT' | 'RUMAH_TANGGA' | 'HAS_PHONE') => {
    if (group === 'ALL') {
      setSelectedUserIds(new Set(employees.map((e) => e.id)));
    } else if (group === 'SHIPMENT') {
      setSelectedUserIds(new Set(employees.filter((e) => e.groupName === 'SHIPMENT').map((e) => e.id)));
    } else if (group === 'RUMAH_TANGGA') {
      setSelectedUserIds(new Set(employees.filter((e) => e.groupName === 'RUMAH TANGGA').map((e) => e.id)));
    } else if (group === 'HAS_PHONE') {
      setSelectedUserIds(new Set(employees.filter((e) => e.hasPhone).map((e) => e.id)));
    }
  };

  // Tag Appender helper
  const handleAppendTag = (tag: string) => {
    setMessageTemplate((prev) => prev + ` ${tag} `);
  };

  // Inline Phone Save
  const handleStartEditPhone = (emp: Employee80) => {
    setEditingUserId(emp.id);
    setEditPhoneValue(emp.phone || '');
  };

  const handleCancelEditPhone = () => {
    setEditingUserId(null);
    setEditPhoneValue('');
  };

  const handleSavePhone = async (userId: string) => {
    try {
      setIsSavingPhone(true);
      const clean = editPhoneValue.trim();
      const res = await api.post<{ success: boolean; message: string; phone: string }>('/whatsapp/update-phone', {
        userId,
        phone: clean,
      });
      if (res && res.success) {
        toast.success('Nomor WhatsApp berhasil disimpan!');
        setEmployees((prev) =>
          prev.map((e) => {
            if (e.id === userId) {
              const cleanDigits = clean.replace(/[^0-9]/g, '');
              const has = cleanDigits.length >= 9;
              return { ...e, phone: clean || null, hasPhone: has };
            }
            return e;
          })
        );
        // Refresh summary
        setSummary((prev) => {
          const withCount = employees.filter((e) => e.id === userId ? clean.length >= 9 : e.hasPhone).length;
          return {
            ...prev,
            withPhoneCount: withCount,
            withoutPhoneCount: prev.totalCount - withCount,
          };
        });
        setEditingUserId(null);
      }
    } catch (err: any) {
      toast.error('Gagal menyimpan nomor WhatsApp: ' + err.message);
    } finally {
      setIsSavingPhone(false);
    }
  };

  // Preview Message Sample (Takes first selected employee or Hasri. S)
  const previewSample = useMemo(() => {
    const target = employees.find((e) => selectedUserIds.has(e.id)) || employees[0] || {
      fullName: 'Hasri. S',
      nip: 'FR07001',
      divisionName: 'Wisma Biring Ere',
      groupName: 'RUMAH TANGGA',
    };

    const now = new Date(Date.now() + 8 * 3600000);
    const monthsIndo = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    const daysIndo = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const formattedDate = `${daysIndo[now.getUTCDay()]}, ${now.getUTCDate()} ${monthsIndo[now.getUTCMonth()]} ${now.getUTCFullYear()}`;
    const formattedTime = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')} WITA`;

    return messageTemplate
      .replace(/{nama}/gi, target.fullName)
      .replace(/{name}/gi, target.fullName)
      .replace(/{nip}/gi, target.nip)
      .replace(/{divisi}/gi, target.divisionName || 'Operasional Lapangan')
      .replace(/{division}/gi, target.divisionName || 'Operasional Lapangan')
      .replace(/{grup}/gi, target.groupName)
      .replace(/{group}/gi, target.groupName)
      .replace(/{tanggal}/gi, formattedDate)
      .replace(/{date}/gi, formattedDate)
      .replace(/{waktu}/gi, formattedTime)
      .replace(/{time}/gi, formattedTime);
  }, [messageTemplate, employees, selectedUserIds]);

  // Execute Broadcast
  const handleStartBroadcast = async () => {
    const targets = employees.filter((e) => selectedUserIds.has(e.id));
    if (targets.length === 0) {
      toast.error('Pilih minimal 1 karyawan penerima pesan WhatsApp');
      return;
    }
    if (!messageTemplate.trim()) {
      toast.error('Pesan template tidak boleh kosong');
      return;
    }

    setIsSendingModalOpen(true);
    setIsSending(true);
    abortControllerRef.current = false;

    setSendProgress({
      total: targets.length,
      current: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      currentName: targets[0]?.fullName || '',
      isFinished: false,
    });
    setSendLogs([]);

    const logs: Array<{ name: string; nip: string; phone: string; status: 'sent' | 'skipped' | 'failed'; error?: string }> = [];
    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (let i = 0; i < targets.length; i++) {
      if (abortControllerRef.current) {
        toast.info('Pengiriman dihentikan oleh Superadmin.');
        break;
      }

      const emp = targets[i];
      setSendProgress((p) => ({
        ...p,
        current: i + 1,
        currentName: emp.fullName,
      }));

      // Call batch endpoint with single item for real-time progress update
      try {
        const res = await api.post<{
          success: boolean;
          summary: { sent: number; skipped: number; failed: number };
          results: Array<{ status: 'sent' | 'skipped' | 'failed'; error?: string }>;
        }>('/whatsapp/broadcast-80', {
          recipients: [
            {
              userId: emp.id,
              name: emp.fullName,
              nip: emp.nip,
              phone: emp.phone || '',
              group: emp.groupName,
              division: emp.divisionName || '',
            },
          ],
          messageTemplate,
          delayMs: 0,
        });

        const itemRes = res.results?.[0];
        if (itemRes?.status === 'sent') {
          sent++;
          logs.unshift({ name: emp.fullName, nip: emp.nip, phone: emp.phone || '-', status: 'sent' });
        } else if (itemRes?.status === 'skipped') {
          skipped++;
          logs.unshift({ name: emp.fullName, nip: emp.nip, phone: emp.phone || '-', status: 'skipped', error: itemRes.error || 'Nomor HP kosong' });
        } else {
          failed++;
          logs.unshift({ name: emp.fullName, nip: emp.nip, phone: emp.phone || '-', status: 'failed', error: itemRes?.error || 'Gagal terhubung' });
        }
      } catch (err: any) {
        failed++;
        logs.unshift({ name: emp.fullName, nip: emp.nip, phone: emp.phone || '-', status: 'failed', error: err.message });
      }

      setSendProgress((p) => ({
        ...p,
        sent,
        skipped,
        failed,
      }));
      setSendLogs([...logs]);

      // Throttle delay between messages
      if (i < targets.length - 1 && delayMs > 0) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }

    setIsSending(false);
    setSendProgress((p) => ({ ...p, isFinished: true }));
    toast.success(`Broadcast selesai! ${sent} pesan berhasil terkirim.`);
  };

  const handleStopBroadcast = () => {
    abortControllerRef.current = true;
    setIsSending(false);
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* ─── HEADER ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-3xl bg-card border border-border/70 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black shadow-xs shrink-0">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg md:text-xl font-extrabold tracking-tight text-foreground">
                Broadcast WhatsApp 80 Karyawan
              </h1>
              <Badge className="bg-emerald-600 text-white font-bold text-[10px] tracking-wide uppercase px-2 py-0.5">
                Superadmin Exclusive
              </Badge>
              {gatewayStatus.connected ? (
                <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] gap-1 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Gateway Terhubung ({gatewayStatus.phone})
                </Badge>
              ) : (
                <Badge variant="outline" className="border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] gap-1 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                  Gateway Terputus
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Kirim pengumuman, jadwal shift, dan instruksi operasional resmi serentak ke nomor WhatsApp 80 personil sah operasional lapangan &amp; wisma.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={isRefreshing}
            className="rounded-xl text-xs gap-1.5 h-9"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Segarkan Data
          </Button>
          <a
            href="http://103.197.188.211:5002/wa-qr"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs h-9 px-3 rounded-xl border border-border bg-muted/60 hover:bg-muted text-foreground font-semibold"
          >
            <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
            Tautkan WhatsApp
          </a>
        </div>
      </div>

      {/* ─── KPI METRICS SUMMARY (4 CARDS) ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <Card className="rounded-2xl border-border/70 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Total Karyawan Sah</p>
              <h3 className="text-2xl font-black text-foreground mt-0.5">{summary.totalCount}</h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                <span className="text-emerald-600 font-bold">{summary.shipmentCount}</span> Shipment • <span className="text-blue-600 font-bold">{summary.rumahTanggaCount}</span> Wisma
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/70 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Nomor WA Siap</p>
              <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                {summary.withPhoneCount} <span className="text-xs text-muted-foreground font-normal">/ {summary.totalCount}</span>
              </h3>
              <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                {Math.round((summary.withPhoneCount / (summary.totalCount || 1)) * 100)}% Kelengkapan Kontak
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/70 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Belum Ada Nomor</p>
              <h3 className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-0.5">
                {summary.withoutPhoneCount}
              </h3>
              <button
                onClick={() => setSelectedGroupFilter('NO_PHONE')}
                className="text-[10px] text-amber-600 dark:text-amber-400 font-bold hover:underline mt-0.5 block text-left"
              >
                Klik untuk isi nomor →
              </button>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/70 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Penerima Terpilih</p>
              <h3 className="text-2xl font-black text-primary mt-0.5">
                {selectedUserIds.size} <span className="text-xs text-muted-foreground font-normal">Karyawan</span>
              </h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {employees.filter((e) => selectedUserIds.has(e.id) && e.hasPhone).length} siap terkirim WhatsApp
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center shrink-0">
              <Send className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── TWO COLUMNS: EDITOR & PREVIEW ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* LEFT COLUMN: MESSAGE COMPOSER (7 COLS) */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="rounded-3xl border-border/70 shadow-xs overflow-hidden">
            <CardHeader className="p-4 md:p-5 border-b border-border/50 bg-muted/20">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-extrabold flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-600" />
                    Penyusun Pesan Broadcast
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Gunakan template siap pakai atau ketik pesan kustom dengan tag dinamis.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-[11px] font-mono">
                  {messageTemplate.length} Karakter
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-4 md:p-5 space-y-4">
              {/* Template Presets Picker */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  Pilih Template Cepat Siap Pakai:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {PRESET_TEMPLATES.map((tmpl) => (
                    <button
                      key={tmpl.id}
                      onClick={() => setMessageTemplate(tmpl.text)}
                      className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                        messageTemplate === tmpl.text
                          ? 'border-emerald-500 bg-emerald-500/10 text-foreground'
                          : 'border-border/70 hover:border-border hover:bg-muted/40 text-muted-foreground'
                      }`}
                    >
                      <span className="text-xs font-bold text-foreground block truncate">{tmpl.title}</span>
                      <span className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{tmpl.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tag Toolbar */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground flex items-center justify-between">
                  <span>Sisipkan Variabel Personal (Klik untuk Menambahkan):</span>
                  <span className="text-[10px] text-muted-foreground font-normal">Otomatis diganti sesuai data personil</span>
                </label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { tag: '{nama}', label: 'Nama Lengkap' },
                    { tag: '{nip}', label: 'NIP' },
                    { tag: '{divisi}', label: 'Penempatan/Pos' },
                    { tag: '{grup}', label: 'Grup Operasional' },
                    { tag: '{tanggal}', label: 'Tanggal Hari Ini' },
                    { tag: '{waktu}', label: 'Jam WITA' },
                  ].map((t) => (
                    <Button
                      key={t.tag}
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleAppendTag(t.tag)}
                      className="rounded-lg text-[11px] h-7 px-2 font-mono gap-1 border-dashed hover:border-emerald-500 hover:text-emerald-600"
                    >
                      <span className="font-bold text-emerald-600">+</span> {t.tag}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Message Textarea */}
              <div className="space-y-1.5">
                <Textarea
                  value={messageTemplate}
                  onChange={(e) => setMessageTemplate(e.target.value)}
                  placeholder="Ketik pesan WhatsApp Anda di sini..."
                  rows={9}
                  className="rounded-2xl font-mono text-xs leading-relaxed border-border/80 focus-visible:ring-emerald-500 resize-y"
                />
                <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
                  <span>Mendukung format WhatsApp: *tebal*, _miring_, ~coret~</span>
                  <button
                    onClick={() => setMessageTemplate('')}
                    className="hover:underline text-rose-500 font-medium"
                  >
                    Kosongkan Pesan
                  </button>
                </div>
              </div>

              {/* Dispatch Controls & Throttling */}
              <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-foreground">Jeda Anti-Spam Antar Pesan:</p>
                    <p className="text-[10px] text-muted-foreground">Mencegah pemblokiran oleh WhatsApp</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {[
                    { label: '1.2s (Standar)', value: 1200 },
                    { label: '2.0s (Aman)', value: 2000 },
                    { label: '3.0s (Tinggi)', value: 3000 },
                  ].map((opt) => (
                    <Button
                      key={opt.value}
                      type="button"
                      size="sm"
                      variant={delayMs === opt.value ? 'default' : 'outline'}
                      onClick={() => setDelayMs(opt.value)}
                      className={`text-xs h-7 px-2.5 rounded-lg ${
                        delayMs === opt.value ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''
                      }`}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Launch Broadcast Button */}
              <div className="pt-2">
                <Button
                  onClick={handleStartBroadcast}
                  disabled={selectedUserIds.size === 0 || !messageTemplate.trim() || !gatewayStatus.connected}
                  className="w-full h-11 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm gap-2 shadow-sm transition-all"
                >
                  <Send className="w-4 h-4" />
                  Kirim Broadcast WhatsApp ke {selectedUserIds.size} Karyawan Terpilih
                </Button>
                {!gatewayStatus.connected && (
                  <p className="text-center text-[11px] text-rose-500 font-medium mt-1.5">
                    ⚠️ Gateway WhatsApp belum terhubung. Silakan tautkan perangkat terlebih dahulu agar dapat mengirim pesan.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: WHATSAPP PHONE PREVIEW MOCKUP (5 COLS) */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="rounded-3xl border-border/70 shadow-xs overflow-hidden">
            <CardHeader className="p-4 md:p-5 border-b border-border/50 bg-muted/20">
              <CardTitle className="text-sm font-extrabold flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-emerald-600" />
                Pratinjau Tampilan Pesan Karyawan
              </CardTitle>
              <CardDescription className="text-xs">
                Simulasi tampilan pesan yang akan diterima di aplikasi WhatsApp karyawan.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-4 md:p-5">
              {/* WhatsApp Phone Mockup Container */}
              <div className="max-w-[340px] mx-auto rounded-[32px] border-4 border-slate-800 dark:border-slate-700 bg-[#0b141a] overflow-hidden shadow-xl">
                {/* Mockup Status Bar */}
                <div className="bg-[#1f2c34] px-4 py-2 flex items-center justify-between text-slate-300 text-[10px]">
                  <span>08:15</span>
                  <div className="flex items-center gap-1.5">
                    <span>4G</span>
                    <span>100%</span>
                  </div>
                </div>

                {/* Mockup Chat Header */}
                <div className="bg-[#1f2c34] px-3.5 py-2.5 flex items-center justify-between border-b border-slate-700/60">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                      FRP
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white leading-tight">PT. FAWWAZ RESKI PERWIRA</h4>
                      <p className="text-[10px] text-emerald-400">Official HRM System • 0878-1237-9189</p>
                    </div>
                  </div>
                </div>

                {/* Mockup Chat Body */}
                <div className="p-3.5 min-h-[300px] bg-[#0b141a] bg-opacity-95 flex flex-col justify-end space-y-2">
                  <div className="text-center">
                    <span className="text-[9px] bg-[#182229] text-slate-400 px-2 py-0.5 rounded-md uppercase font-mono tracking-wider">
                      HARI INI
                    </span>
                  </div>

                  {/* Chat Bubble */}
                  <div className="max-w-[92%] self-start bg-[#005c4b] text-white p-3 rounded-2xl rounded-tl-xs shadow-sm space-y-2 text-xs leading-relaxed font-sans">
                    <div className="whitespace-pre-wrap break-words font-sans text-[11px] text-slate-100">
                      {previewSample || 'Ketik template pesan di sebelah kiri untuk melihat simulasi pratinjau...'}
                    </div>

                    <div className="flex items-center justify-end gap-1 text-[9px] text-emerald-300 font-mono pt-1">
                      <span>08:15</span>
                      <CheckCheck className="w-3 h-3 text-cyan-300" />
                    </div>
                  </div>
                </div>

                {/* Mockup Footer */}
                <div className="bg-[#1f2c34] px-3 py-2 flex items-center gap-2">
                  <div className="flex-1 bg-[#2a3942] rounded-full h-7 px-3 text-[10px] text-slate-400 flex items-center">
                    Balas pesan resmi...
                  </div>
                  <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs">
                    🎤
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ─── 80 EMPLOYEES TARGET SELECTION TABLE ─── */}
      <Card className="rounded-3xl border-border/70 shadow-xs overflow-hidden">
        <CardHeader className="p-4 md:p-5 border-b border-border/50 bg-muted/20">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm md:text-base font-extrabold flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-600" />
                Daftar 80 Personil Sah Operasional &amp; Wisma PT FRP
              </CardTitle>
              <CardDescription className="text-xs">
                Kelola centang penerima pesan dan lakukan pembaruan nomor WhatsApp langsung pada tabel di bawah.
              </CardDescription>
            </div>

            {/* Quick Segment Buttons */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleSelectGroupQuick('ALL')}
                className="text-[11px] h-7 px-2.5 rounded-xl font-semibold"
              >
                Pilih Semua (80)
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleSelectGroupQuick('SHIPMENT')}
                className="text-[11px] h-7 px-2.5 rounded-xl text-emerald-600 font-semibold"
              >
                Grup Shipment (47)
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleSelectGroupQuick('RUMAH_TANGGA')}
                className="text-[11px] h-7 px-2.5 rounded-xl text-blue-600 font-semibold"
              >
                Grup Wisma (33)
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelectedUserIds(new Set())}
                className="text-[11px] h-7 px-2 rounded-xl text-muted-foreground"
              >
                Reset Pilihan
              </Button>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cari nama, NIP, penempatan, atau nomor HP..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-8 text-xs rounded-xl border-border/80"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 flex-wrap">
              {[
                { key: 'ALL', label: `Semua (${summary.totalCount})` },
                { key: 'SHIPMENT', label: `Shipment (${summary.shipmentCount})` },
                { key: 'RUMAH_TANGGA', label: `Wisma (${summary.rumahTanggaCount})` },
                { key: 'HAS_PHONE', label: `Nomor Siap (${summary.withPhoneCount})` },
                { key: 'NO_PHONE', label: `Belum Ada Nomor (${summary.withoutPhoneCount})` },
              ].map((tab) => (
                <Button
                  key={tab.key}
                  size="sm"
                  variant={selectedGroupFilter === tab.key ? 'default' : 'ghost'}
                  onClick={() => setSelectedGroupFilter(tab.key as any)}
                  className={`text-[11px] h-7 px-2.5 rounded-xl font-medium ${
                    selectedGroupFilter === tab.key
                      ? 'bg-primary text-primary-foreground font-bold'
                      : 'text-muted-foreground'
                  }`}
                >
                  {tab.label}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border/60 bg-muted/40 text-[11px] text-muted-foreground font-bold">
                  <th className="p-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={filteredEmployees.length > 0 && filteredEmployees.every((e) => selectedUserIds.has(e.id))}
                      onChange={handleToggleSelectAllFiltered}
                      className="rounded border-border text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                  </th>
                  <th className="p-3 w-24">NIP</th>
                  <th className="p-3">Nama Karyawan</th>
                  <th className="p-3 w-32">Grup Operasional</th>
                  <th className="p-3">Penempatan / Pos</th>
                  <th className="p-3 min-w-[200px]">Nomor WhatsApp</th>
                  <th className="p-3 w-28 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      Tidak ada karyawan yang sesuai dengan filter pencarian.
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((emp) => {
                    const isSelected = selectedUserIds.has(emp.id);
                    const isEditing = editingUserId === emp.id;

                    return (
                      <tr
                        key={emp.id}
                        className={`hover:bg-muted/30 transition-colors ${
                          isSelected ? 'bg-emerald-500/5' : ''
                        }`}
                      >
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleUser(emp.id)}
                            className="rounded border-border text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                        </td>
                        <td className="p-3 font-mono font-bold text-foreground">
                          {emp.nip}
                        </td>
                        <td className="p-3">
                          <span className="font-extrabold text-foreground block">{emp.fullName}</span>
                          <span className="text-[10px] text-muted-foreground">{emp.jobPosition || emp.roleName || 'Operasional'}</span>
                        </td>
                        <td className="p-3">
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-bold ${
                              emp.groupName === 'SHIPMENT'
                                ? 'border-emerald-500/40 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300'
                                : 'border-blue-500/40 text-blue-700 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-300'
                            }`}
                          >
                            {emp.groupName}
                          </Badge>
                        </td>
                        <td className="p-3 text-muted-foreground font-medium">
                          {emp.divisionName || 'Operasional Lapangan'}
                        </td>
                        <td className="p-3">
                          {isEditing ? (
                            <div className="flex items-center gap-1.5">
                              <Input
                                value={editPhoneValue}
                                onChange={(e) => setEditPhoneValue(e.target.value)}
                                placeholder="08xxxxxxxxxx"
                                autoFocus
                                className="h-7 text-xs font-mono rounded-lg border-emerald-500 w-36"
                              />
                              <Button
                                size="icon"
                                variant="default"
                                onClick={() => handleSavePhone(emp.id)}
                                disabled={isSavingPhone}
                                className="w-7 h-7 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                              >
                                {isSavingPhone ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={handleCancelEditPhone}
                                className="w-7 h-7 rounded-lg shrink-0 text-muted-foreground"
                              >
                                <X className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between group gap-2">
                              <span className={`font-mono text-xs ${emp.hasPhone ? 'text-foreground font-bold' : 'text-amber-500 italic'}`}>
                                {emp.phone || 'Belum diisi'}
                              </span>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleStartEditPhone(emp)}
                                className="w-6 h-6 rounded-md opacity-60 group-hover:opacity-100 hover:bg-muted text-muted-foreground"
                                title="Edit Nomor WhatsApp"
                              >
                                <Edit2 className="w-3 h-3" />
                              </Button>
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {emp.hasPhone ? (
                            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 text-[10px] font-semibold gap-1">
                              <Check className="w-2.5 h-2.5" /> Siap Kirim
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-amber-500/40 text-amber-600 bg-amber-50 dark:bg-amber-950/30 text-[10px]">
                              Nomor Kosong
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ─── LIVE BROADCAST SENDING & PROGRESS MODAL ─── */}
      <Dialog open={isSendingModalOpen} onOpenChange={(open) => !isSending && setIsSendingModalOpen(open)}>
        <DialogContent className="max-w-md rounded-3xl p-5 border-border">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-emerald-600" />
              Proses Broadcast WhatsApp 80 Karyawan
            </DialogTitle>
            <DialogDescription className="text-xs">
              {sendProgress.isFinished
                ? 'Seluruh antrean pesan WhatsApp telah selesai diproses oleh gateway.'
                : 'Sistem sedang mengirimkan pesan personal satu per satu dengan jeda aman anti-spam.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Progress Bar Container */}
            <div className="space-y-2 p-3.5 rounded-2xl bg-muted/40 border border-border">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="flex items-center gap-1.5">
                  {!sendProgress.isFinished && <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />}
                  <span>{sendProgress.isFinished ? 'Selesai 100%' : `Mengirim: ${sendProgress.currentName}`}</span>
                </span>
                <span className="font-mono text-emerald-600">
                  {sendProgress.current} / {sendProgress.total}
                </span>
              </div>

              {/* Progress Track */}
              <div className="w-full h-3 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
                  style={{
                    width: `${sendProgress.total > 0 ? (sendProgress.current / sendProgress.total) * 100 : 0}%`,
                  }}
                />
              </div>

              {/* Counters */}
              <div className="grid grid-cols-3 gap-2 pt-1 text-center font-mono">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                  <p className="text-[10px] uppercase font-bold">Terkirim</p>
                  <p className="text-base font-black">{sendProgress.sent}</p>
                </div>
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300">
                  <p className="text-[10px] uppercase font-bold">Dilewati</p>
                  <p className="text-base font-black">{sendProgress.skipped}</p>
                </div>
                <div className="p-2 rounded-xl bg-rose-500/10 text-rose-700 dark:text-rose-300">
                  <p className="text-[10px] uppercase font-bold">Gagal</p>
                  <p className="text-base font-black">{sendProgress.failed}</p>
                </div>
              </div>
            </div>

            {/* Live Streaming Log Box */}
            <div className="space-y-1">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Log Riwayat Pengiriman ({sendLogs.length})
              </p>
              <div className="h-44 overflow-y-auto rounded-2xl bg-black/90 p-3 text-[11px] font-mono text-slate-300 space-y-1.5 border border-border/80">
                {sendLogs.length === 0 ? (
                  <p className="text-slate-500 italic">Menunggu antrean dimulai...</p>
                ) : (
                  sendLogs.map((log, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-2 border-b border-slate-800/60 pb-1">
                      <span className="truncate">
                        <strong className="text-white">{log.name}</strong> ({log.nip})
                      </span>
                      <span
                        className={`font-bold shrink-0 text-[10px] px-1.5 py-0.5 rounded ${
                          log.status === 'sent'
                            ? 'bg-emerald-950 text-emerald-400'
                            : log.status === 'skipped'
                            ? 'bg-amber-950 text-amber-400'
                            : 'bg-rose-950 text-rose-400'
                        }`}
                      >
                        {log.status === 'sent' ? 'TERKIRIM' : log.status === 'skipped' ? 'NO HP KOSONG' : 'GAGAL'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="flex items-center justify-between gap-2">
            {isSending ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleStopBroadcast}
                className="rounded-xl text-xs gap-1.5"
              >
                <X className="w-3.5 h-3.5" /> Hentikan Pengiriman
              </Button>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={() => setIsSendingModalOpen(false)}
                className="w-full rounded-xl text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              >
                Tutup &amp; Selesai
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HrmWhatsAppBroadcast80Page;

