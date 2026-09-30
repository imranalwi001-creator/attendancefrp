import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Download, CheckCircle2, XCircle, AlertTriangle, Loader2, Info } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import ImportWizardFrame from '@/components/admin/ImportWizardFrame';
import ImportDropzone from '@/components/admin/ImportDropzone';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { clearImportFile, loadImportFile, saveImportFile } from '@/lib/importFileCache';
import { getInvokeErrorMessage } from '@/lib/supabaseInvokeError';

type JadwalStatus = 'aktif' | 'nonaktif';
type Semester = 'ganjil' | 'genap';
type Step = 'upload' | 'preview' | 'result';
type RunMode = 'import' | 'dry-run';

interface KelasRef {
  id: string;
  nama: string;
  tahun_ajaran: string;
}

interface MapelRef {
  id: string;
  kelas_id: string;
  kode_mapel: string | null;
  nama: string;
}

interface StaffRef {
  id: string;
  employee_id: string | null;
  profiles?: { email?: string | null; name?: string | null } | null;
}

interface ParsedJadwalRow {
  rowNumber: number;
  kelasId?: string;
  kelasNama?: string;
  tahunAjaran?: string;
  semester: Semester;
  hari: string;
  jamMulai: string;
  jamSelesai: string;
  tipe: string;
  kategori: string;
  status?: JadwalStatus;
  label?: string;
  ruangan?: string;
  blockId?: string;
  mapelId?: string;
  kodeMapel?: string;
  pengampuId?: string;
  pengampuEmployeeId?: string;
  pengampuEmail?: string;
  mapelResolvedName?: string;
  pengampuResolvedName?: string;
  errors: string[];
  isValid: boolean;
}

interface ImportResultRow {
  rowNumber: number;
  action?: 'created' | 'updated';
  success: boolean;
  error?: string;
  jadwalId?: string;
}

interface ImportJadwalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: () => void;
}

const TEMPLATE_COLUMNS = [
  'kelas_id',
  'nama_kelas',
  'tahun_ajaran',
  'semester',
  'hari',
  'jam_mulai',
  'jam_selesai',
  'tipe',
  'kategori',
  'status',
  'label',
  'ruangan',
  'block_id',
  'mapel_id',
  'kode_mapel',
  'pengampu_id',
  'pengampu_employee_id',
  'pengampu_email',
];

const normalizeText = (v: unknown) => {
  if (v === null || v === undefined) return '';
  return String(v).trim();
};

const normalizeHeaderKey = (v: string) =>
  v
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

const normalizeEmployeeId = (v: unknown) => normalizeText(v).replace(/\.0$/, '').replace(/\s+/g, '');

const isValidSemester = (v: string): v is Semester => {
  return v === 'ganjil' || v === 'genap';
};

const isValidStatus = (v: string): v is JadwalStatus => {
  return v === 'aktif' || v === 'nonaktif';
};

export default function ImportJadwalModal({ open, onOpenChange, onImported }: ImportJadwalModalProps) {
  const { toast } = useToast();
  const cacheKey = 'import-file:jadwal';
  const [step, setStep] = useState<Step>('upload');
  const [runMode, setRunMode] = useState<RunMode>('import');
  const [loading, setLoading] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [rows, setRows] = useState<ParsedJadwalRow[]>([]);
  const [showOnlyErrors, setShowOnlyErrors] = useState(false);
  const [results, setResults] = useState<ImportResultRow[]>([]);
  const [summary, setSummary] = useState<{ created: number; updated: number; failed: number; total: number } | null>(null);

  const { data: kelasList = [] } = useQuery({
    queryKey: ['import-jadwal-kelas-ref'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kelas')
        .select('id, nama, tahun_ajaran')
        .limit(2000);
      if (error) throw error;
      return (data || []) as KelasRef[];
    },
    enabled: open,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: mapelList = [] } = useQuery({
    queryKey: ['import-jadwal-mapel-ref'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mapel')
        .select('id, kelas_id, kode_mapel, nama')
        .limit(5000);
      if (error) throw error;
      return (data || []) as MapelRef[];
    },
    enabled: open,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: staffList = [] } = useQuery({
    queryKey: ['import-jadwal-staff-ref'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff')
        .select('id, employee_id, profiles(email, name)')
        .limit(5000);
      if (error) throw error;
      return (data || []) as StaffRef[];
    },
    enabled: open,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const kelasById = useMemo(() => {
    const m = new Map<string, KelasRef>();
    kelasList.forEach(k => m.set(k.id, k));
    return m;
  }, [kelasList]);

  const kelasByNameYear = useMemo(() => {
    const m = new Map<string, KelasRef>();
    kelasList.forEach(k => {
      const key = `${(k.nama || '').trim().toLowerCase()}|${(k.tahun_ajaran || '').trim().toLowerCase()}`;
      m.set(key, k);
    });
    return m;
  }, [kelasList]);

  const mapelById = useMemo(() => {
    const m = new Map<string, MapelRef>();
    mapelList.forEach(mp => m.set(mp.id, mp));
    return m;
  }, [mapelList]);

  const mapelByKode = useMemo(() => {
    const m = new Map<string, MapelRef>();
    mapelList.forEach(mp => {
      const kode = normalizeText(mp.kode_mapel).toLowerCase();
      if (!kode) return;
      m.set(`${mp.kelas_id}|${kode}`, mp);
    });
    return m;
  }, [mapelList]);

  const staffByEmployeeId = useMemo(() => {
    const m = new Map<string, StaffRef>();
    staffList.forEach(s => {
      const key = normalizeEmployeeId(s.employee_id).toLowerCase();
      if (key) m.set(key, s);
    });
    return m;
  }, [staffList]);

  const staffByEmail = useMemo(() => {
    const m = new Map<string, StaffRef>();
    staffList.forEach(s => {
      const key = normalizeText(s?.profiles?.email).toLowerCase();
      if (key) m.set(key, s);
    });
    return m;
  }, [staffList]);

  const validRows = useMemo(() => rows.filter(r => r.isValid), [rows]);
  const invalidRows = useMemo(() => rows.filter(r => !r.isValid), [rows]);
  const displayedRows = useMemo(() => {
    const list = showOnlyErrors ? invalidRows : rows;
    return list.slice(0, 200);
  }, [rows, invalidRows, showOnlyErrors]);

  const downloadTemplate = (format: 'xlsx' | 'csv', variant: 'empty' | 'example') => {
    const templateData = variant === 'example' ? [
      {
        kelas_id: '',
        nama_kelas: '7A',
        tahun_ajaran: '2025/2026',
        semester: 'ganjil',
        hari: 'Senin',
        jam_mulai: '07:00',
        jam_selesai: '08:30',
        tipe: 'pelajaran',
        kategori: 'akademik',
        status: 'aktif',
        label: '',
        ruangan: 'R1',
        block_id: '',
        mapel_id: '',
        kode_mapel: 'MTK-7',
        pengampu_id: '',
        pengampu_employee_id: '19870001',
        pengampu_email: '',
      },
    ] : [];
    const ws = XLSX.utils.json_to_sheet(templateData, { header: TEMPLATE_COLUMNS });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'jadwal');
    if (format === 'xlsx') {
      XLSX.writeFile(wb, variant === 'example' ? 'template-import-jadwal-contoh.xlsx' : 'template-import-jadwal-kosong.xlsx');
      return;
    }
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = variant === 'example' ? 'template-import-jadwal-contoh.csv' : 'template-import-jadwal-kosong.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadErrorFile = (format: 'xlsx' | 'csv', items: Array<Record<string, any>>, filenameBase: string) => {
    const ws = XLSX.utils.json_to_sheet(items);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'errors');
    if (format === 'xlsx') {
      XLSX.writeFile(wb, `${filenameBase}.xlsx`);
      return;
    }
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filenameBase}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const parseFile = async (file: File) => {
    setLoading(true);
    try {
      const buf = await file.arrayBuffer();
      const workbook = XLSX.read(buf, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '', raw: false });

      const normalized = rawRows.map((r) => {
        const out: Record<string, any> = {};
        Object.keys(r || {}).forEach((k) => {
          out[normalizeHeaderKey(k)] = r[k];
        });
        return out;
      });

      const parsed: ParsedJadwalRow[] = normalized.map((r, idx) => {
        const rowNumber = idx + 2;
        const errors: string[] = [];

        const kelasIdRaw = normalizeText(r.kelas_id);
        const kelasNama = normalizeText(r.nama_kelas);
        const tahunAjaran = normalizeText(r.tahun_ajaran);
        const semesterRaw = normalizeText(r.semester).toLowerCase();
        const hari = normalizeText(r.hari);
        const jamMulai = normalizeText(r.jam_mulai);
        const jamSelesai = normalizeText(r.jam_selesai);
        const tipe = normalizeText(r.tipe);
        const kategori = normalizeText(r.kategori);
        const statusRaw = normalizeText(r.status).toLowerCase();
        const label = normalizeText(r.label);
        const ruangan = normalizeText(r.ruangan);
        const blockId = normalizeText(r.block_id);
        const mapelIdRaw = normalizeText(r.mapel_id);
        const kodeMapel = normalizeText(r.kode_mapel);
        const pengampuIdRaw = normalizeText(r.pengampu_id);
        const pengampuEmployeeId = normalizeEmployeeId(r.pengampu_employee_id);
        const pengampuEmail = normalizeText(r.pengampu_email).toLowerCase();

        const semester = isValidSemester(semesterRaw) ? (semesterRaw as Semester) : undefined;
        if (!semester) errors.push('semester tidak valid (ganjil/genap)');
        if (!hari || !jamMulai || !jamSelesai || !tipe || !kategori) errors.push('hari, jam_mulai, jam_selesai, tipe, kategori wajib diisi');

        const status = statusRaw && isValidStatus(statusRaw) ? (statusRaw as JadwalStatus) : undefined;
        if (statusRaw && !status) errors.push('status tidak valid');

        let resolvedKelasId: string | undefined = undefined;
        if (kelasIdRaw) {
          if (!kelasById.has(kelasIdRaw)) errors.push('kelas_id tidak ditemukan');
          resolvedKelasId = kelasIdRaw;
        } else if (kelasNama && tahunAjaran) {
          const key = `${kelasNama.toLowerCase()}|${tahunAjaran.toLowerCase()}`;
          const k = kelasByNameYear.get(key);
          if (!k) errors.push(`kelas tidak ditemukan: ${kelasNama} (${tahunAjaran})`);
          resolvedKelasId = k?.id;
        } else {
          errors.push('kelas_id atau (nama_kelas+tahun_ajaran) wajib diisi');
        }

        let resolvedMapelId: string | undefined = undefined;
        let resolvedMapelName: string | undefined = undefined;
        if (mapelIdRaw) {
          const mp = mapelById.get(mapelIdRaw);
          if (!mp) errors.push('mapel_id tidak ditemukan');
          resolvedMapelId = mapelIdRaw;
          resolvedMapelName = mp?.nama;
        } else if (kodeMapel && resolvedKelasId) {
          const mp = mapelByKode.get(`${resolvedKelasId}|${kodeMapel.toLowerCase()}`);
          if (!mp) errors.push(`mapel tidak ditemukan (kode_mapel=${kodeMapel})`);
          resolvedMapelId = mp?.id;
          resolvedMapelName = mp?.nama;
        }

        let resolvedPengampuId: string | undefined = undefined;
        let resolvedPengampuName: string | undefined = undefined;
        if (pengampuIdRaw) {
          resolvedPengampuId = pengampuIdRaw;
        } else if (pengampuEmployeeId) {
          const s = staffByEmployeeId.get(pengampuEmployeeId.toLowerCase());
          if (!s) errors.push(`pengampu tidak ditemukan (employee_id=${pengampuEmployeeId})`);
          resolvedPengampuId = s?.id;
          resolvedPengampuName = normalizeText(s?.profiles?.name) || undefined;
        } else if (pengampuEmail) {
          const s = staffByEmail.get(pengampuEmail.toLowerCase());
          if (!s) errors.push(`pengampu tidak ditemukan (email=${pengampuEmail})`);
          resolvedPengampuId = s?.id;
          resolvedPengampuName = normalizeText(s?.profiles?.name) || undefined;
        }

        const isValid = errors.length === 0;
        return {
          rowNumber,
          kelasId: resolvedKelasId,
          kelasNama: kelasNama || undefined,
          tahunAjaran: tahunAjaran || undefined,
          semester: (semester as Semester) || 'ganjil',
          hari,
          jamMulai,
          jamSelesai,
          tipe,
          kategori,
          status,
          label: label || undefined,
          ruangan: ruangan || undefined,
          blockId: blockId || undefined,
          mapelId: resolvedMapelId,
          kodeMapel: kodeMapel || undefined,
          pengampuId: resolvedPengampuId,
          pengampuEmployeeId: pengampuEmployeeId || undefined,
          pengampuEmail: pengampuEmail || undefined,
          mapelResolvedName: resolvedMapelName,
          pengampuResolvedName: resolvedPengampuName,
          errors,
          isValid,
        };
      });

      setRows(parsed);
      setStep('preview');
    } catch (e: any) {
      toast({ title: 'Gagal membaca file', description: e?.message || 'File tidak valid', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    if (step !== 'upload') return;
    if (selectedFileName || rows.length > 0) return;
    let cancelled = false;
    loadImportFile(cacheKey)
      .then((file) => {
        if (cancelled) return;
        if (!file) return;
        setSelectedFileName(file.name);
        parseFile(file);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open]);

  const resetState = () => {
    clearImportFile(cacheKey).catch(() => {});
    setStep('upload');
    setRunMode('import');
    setSelectedFileName('');
    setRows([]);
    setShowOnlyErrors(false);
    setResults([]);
    setSummary(null);
  };

  const handleImport = async (dryRun: boolean) => {
    setLoading(true);
    try {
      const payloadRows = validRows.map(r => ({
        rowNumber: r.rowNumber,
        kelasId: r.kelasId,
        kelasNama: r.kelasNama,
        tahunAjaran: r.tahunAjaran,
        semester: r.semester,
        hari: r.hari,
        jamMulai: r.jamMulai,
        jamSelesai: r.jamSelesai,
        tipe: r.tipe,
        kategori: r.kategori,
        status: r.status,
        label: r.label,
        ruangan: r.ruangan,
        blockId: r.blockId,
        mapelId: r.mapelId,
        kodeMapel: r.kodeMapel,
        pengampuId: r.pengampuId,
        pengampuEmployeeId: r.pengampuEmployeeId,
        pengampuEmail: r.pengampuEmail,
      }));

      const { data, error } = await supabase.functions.invoke('import-jadwal-bulk', {
        body: { rows: payloadRows, dryRun },
      });

      if (error) {
        throw new Error(await getInvokeErrorMessage(error));
      }

      setResults((data?.results || []) as ImportResultRow[]);
      setSummary(data?.summary || null);
      setStep('result');
      setRunMode(dryRun ? 'dry-run' : 'import');

      toast({
        title: dryRun ? 'Validasi selesai' : 'Import selesai',
        description: `Created: ${data?.summary?.created || 0}, Updated: ${data?.summary?.updated || 0}, Failed: ${data?.summary?.failed || 0}`,
      });

      if (!dryRun) onImported?.();
    } catch (e: any) {
      toast({ title: 'Gagal import', description: e?.message || 'Terjadi kesalahan', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const close = (v: boolean) => {
    if (!v) resetState();
    onOpenChange(v);
  };

  const failedCount = results.filter(r => !r.success).length;
  const failedResults = results.filter(r => !r.success);

  return (
    <Dialog open={open} onOpenChange={close}>
      <ImportWizardFrame
        maxWidthClass="max-w-5xl"
        title="Import Jadwal"
        description="Unggah file Excel (.xlsx) untuk membuat atau memperbarui jadwal pelajaran secara massal."
        step={step}
        footerLeft={
          step === 'preview' ? (
            <Button variant="outline" onClick={resetState} disabled={loading}>
              Kembali
            </Button>
          ) : step === 'result' ? (
            <Button variant="outline" onClick={resetState} disabled={loading}>
              Impor Lagi
            </Button>
          ) : (
            <Button variant="outline" onClick={() => close(false)} disabled={loading}>
              Batal
            </Button>
          )
        }
        footerRight={
          step === 'preview' ? (
            <>
              <Button variant="outline" onClick={() => handleImport(true)} disabled={loading || validRows.length === 0}>
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Validasi
              </Button>
              <Button onClick={() => handleImport(false)} disabled={loading || validRows.length === 0}>
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Proses Impor
              </Button>
            </>
          ) : step === 'result' && runMode === 'dry-run' ? (
            <>
              <Button variant="outline" onClick={() => close(false)} disabled={loading}>
                Tutup
              </Button>
              <Button onClick={() => handleImport(false)} disabled={loading || validRows.length === 0}>
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Proses Impor
              </Button>
            </>
          ) : step === 'result' ? (
            <Button onClick={() => close(false)} disabled={loading}>
              Tutup
            </Button>
          ) : null
        }
      >

        {step === 'upload' && (
          <div className="space-y-4">
            <ImportDropzone
              disabled={loading}
              accept=".xlsx,.xls"
              supportText="Support format .xlsx"
              maxSizeMB={5}
              selectedFileName={selectedFileName}
              onRejected={(reason) => toast({ title: 'File ditolak', description: reason, variant: 'destructive' })}
              onFileSelected={(file) => {
                saveImportFile(cacheKey, file).catch(() => {});
                setSelectedFileName(file.name);
                parseFile(file);
              }}
            />

            <div className="rounded-lg border border-border/60 bg-muted/20 px-4 py-3 flex gap-3">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Info className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <div className="text-sm text-foreground">
                  Kunci update: <span className="font-semibold">kelas + semester + hari + jam_mulai + jam_selesai + tipe + block_id</span>.
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Mapel bisa pakai mapel_id atau kode_mapel (dengan kelas).
                </div>
              </div>
            </div>

            <div>
              <Button variant="link" className="px-0" onClick={() => downloadTemplate('xlsx', 'example')}>
                <Download className="h-4 w-4 mr-2" />
                Download Template XLSX
              </Button>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm text-muted-foreground">
                Reviewing <span className="font-medium text-foreground">{rows.length}</span> records found in <span className="font-medium text-foreground">{selectedFileName || 'file.xlsx'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={invalidRows.length === 0 ? 'default' : 'secondary'}>
                  Valid: {validRows.length}
                </Badge>
                <Badge variant={invalidRows.length > 0 ? 'destructive' : 'secondary'}>
                  Error: {invalidRows.length}
                </Badge>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {invalidRows.length > 0 && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() =>
                        downloadErrorFile(
                          'xlsx',
                          invalidRows.map(r => ({
                            rowNumber: r.rowNumber,
                            kelas_id: r.kelasId || '',
                            nama_kelas: r.kelasNama || '',
                            tahun_ajaran: r.tahunAjaran || '',
                            semester: r.semester,
                            hari: r.hari,
                            jam_mulai: r.jamMulai,
                            jam_selesai: r.jamSelesai,
                            tipe: r.tipe,
                            kategori: r.kategori,
                            mapel: r.mapelResolvedName || r.kodeMapel || r.mapelId || '',
                            pengampu: r.pengampuResolvedName || r.pengampuEmail || r.pengampuEmployeeId || r.pengampuId || '',
                            errors: r.errors.join('; '),
                          })),
                          'error-import-jadwal',
                        )
                      }
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Error (XLSX)
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() =>
                        downloadErrorFile(
                          'csv',
                          invalidRows.map(r => ({
                            rowNumber: r.rowNumber,
                            kelas_id: r.kelasId || '',
                            nama_kelas: r.kelasNama || '',
                            tahun_ajaran: r.tahunAjaran || '',
                            semester: r.semester,
                            hari: r.hari,
                            jam_mulai: r.jamMulai,
                            jam_selesai: r.jamSelesai,
                            tipe: r.tipe,
                            kategori: r.kategori,
                            mapel: r.mapelResolvedName || r.kodeMapel || r.mapelId || '',
                            pengampu: r.pengampuResolvedName || r.pengampuEmail || r.pengampuEmployeeId || r.pengampuId || '',
                            errors: r.errors.join('; '),
                          })),
                          'error-import-jadwal',
                        )
                      }
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Error (CSV)
                    </Button>
                  </>
                )}
                <Button variant="outline" onClick={() => setShowOnlyErrors(v => !v)}>
                  {showOnlyErrors ? 'Tampilkan Semua' : 'Tampilkan Error'}
                </Button>
              </div>
            </div>

            <Card>
              <CardContent className="p-0">
                <ScrollArea className="h-[420px]">
                  <div className="w-full">
                    <div className="grid grid-cols-12 gap-2 px-4 py-3 border-b text-xs font-medium text-muted-foreground">
                      <div className="col-span-1">Row</div>
                      <div className="col-span-2">Kelas</div>
                      <div className="col-span-1">Sem</div>
                      <div className="col-span-2">Hari</div>
                      <div className="col-span-2">Jam</div>
                      <div className="col-span-2">Mapel</div>
                      <div className="col-span-2">Hasil</div>
                    </div>
                    {displayedRows.length === 0 ? (
                      <div className="p-6 text-sm text-muted-foreground">Tidak ada baris untuk ditampilkan</div>
                    ) : (
                      displayedRows.map((r) => {
                        const kelas = r.kelasId ? kelasById.get(r.kelasId) : undefined;
                        return (
                          <div key={r.rowNumber} className="grid grid-cols-12 gap-2 px-4 py-3 border-b items-center text-sm">
                            <div className="col-span-1 text-muted-foreground">{r.rowNumber}</div>
                            <div className="col-span-2 truncate">{kelas ? kelas.nama : '-'}</div>
                            <div className="col-span-1 truncate">{r.semester}</div>
                            <div className="col-span-2 truncate">{r.hari}</div>
                            <div className="col-span-2 truncate">{`${r.jamMulai}-${r.jamSelesai}`}</div>
                            <div className="col-span-2 truncate">{r.mapelResolvedName || r.kodeMapel || (r.mapelId ? 'ID' : '-')}</div>
                            <div className="col-span-2">
                              {r.isValid ? (
                                <div className="flex items-center gap-2 text-primary">
                                  <CheckCircle2 className="h-4 w-4" />
                                  <span>Valid</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 text-destructive">
                                  <XCircle className="h-4 w-4" />
                                  <span className="truncate" title={r.errors.join(' • ')}>
                                    {r.errors[0] || 'Invalid'}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {invalidRows.length > 0 && (
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <AlertTriangle className="h-4 w-4 mt-0.5" />
                <div>
                  <p>Perbaiki baris yang error lalu upload ulang. Import hanya memproses baris yang valid.</p>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 'result' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default">Created: {summary?.created ?? 0}</Badge>
              <Badge variant="secondary">Updated: {summary?.updated ?? 0}</Badge>
              <Badge variant={failedCount > 0 ? 'destructive' : 'secondary'}>Failed: {summary?.failed ?? failedCount}</Badge>
              <Badge variant="outline">Total: {summary?.total ?? results.length}</Badge>
            </div>

            {failedResults.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() =>
                    downloadErrorFile(
                      'xlsx',
                      failedResults.map(r => ({
                        rowNumber: r.rowNumber,
                        action: r.action || '',
                        error: r.error || '',
                      })),
                      runMode === 'dry-run' ? 'hasil-validasi-jadwal-error' : 'hasil-import-jadwal-error',
                    )
                  }
                >
                  <Download className="h-4 w-4 mr-2" />
                  Unduh Error (XLSX)
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    downloadErrorFile(
                      'csv',
                      failedResults.map(r => ({
                        rowNumber: r.rowNumber,
                        action: r.action || '',
                        error: r.error || '',
                      })),
                      runMode === 'dry-run' ? 'hasil-validasi-jadwal-error' : 'hasil-import-jadwal-error',
                    )
                  }
                >
                  <Download className="h-4 w-4 mr-2" />
                  Unduh Error (CSV)
                </Button>
              </div>
            )}

            <Card>
              <CardContent className="p-0">
                <ScrollArea className="h-[320px]">
                  <div className="grid grid-cols-12 gap-2 px-4 py-3 border-b text-xs font-medium text-muted-foreground">
                    <div className="col-span-1">Row</div>
                    <div className="col-span-2">Action</div>
                    <div className="col-span-9">Status</div>
                  </div>
                  {(results || []).map((r) => (
                    <div key={`${r.rowNumber}-${r.jadwalId || ''}`} className="grid grid-cols-12 gap-2 px-4 py-3 border-b items-center text-sm">
                      <div className="col-span-1 text-muted-foreground">{r.rowNumber}</div>
                      <div className="col-span-2">{r.action || '-'}</div>
                      <div className="col-span-9">
                        {r.success ? (
                          <div className="flex items-center gap-2 text-primary">
                            <CheckCircle2 className="h-4 w-4" />
                            <span>Success</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-destructive">
                            <XCircle className="h-4 w-4" />
                            <span className="truncate" title={r.error || 'Failed'}>
                              {r.error || 'Failed'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        )}
      </ImportWizardFrame>
    </Dialog>
  );
}
