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

type MapelStatus = 'aktif' | 'nonaktif';
type MapelKategori = 'wajib' | 'pilihan' | 'ekstrakurikuler' | 'asrama';
type Step = 'upload' | 'preview' | 'result';
type RunMode = 'import' | 'dry-run';

interface KelasRef {
  id: string;
  nama: string;
  tingkat: string;
  tahun_ajaran: string;
}

interface StaffRef {
  id: string;
  employee_id: string | null;
  profiles?: { email?: string | null; name?: string | null } | null;
}

interface ParsedMapelRow {
  rowNumber: number;
  kodeMapel?: string;
  nama: string;
  kategori: MapelKategori;
  status?: MapelStatus;
  kkm?: number;
  kelasId?: string;
  kelasNama?: string;
  tahunAjaran?: string;
  pengampuId?: string;
  pengampuEmployeeId?: string;
  pengampuEmail?: string;
  pengampuResolvedName?: string;
  errors: string[];
  isValid: boolean;
}

interface ImportResultRow {
  rowNumber: number;
  kodeMapel?: string;
  nama?: string;
  action?: 'created' | 'updated';
  success: boolean;
  error?: string;
  mapelId?: string;
}

interface ImportMapelModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: () => void;
}

const TEMPLATE_COLUMNS = [
  'kode_mapel',
  'nama',
  'kategori',
  'status',
  'kkm',
  'kelas_id',
  'nama_kelas',
  'tahun_ajaran',
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

const isValidKategori = (v: string): v is MapelKategori => {
  return v === 'wajib' || v === 'pilihan' || v === 'ekstrakurikuler' || v === 'asrama';
};

const isValidStatus = (v: string): v is MapelStatus => {
  return v === 'aktif' || v === 'nonaktif';
};

export default function ImportMapelModal({ open, onOpenChange, onImported }: ImportMapelModalProps) {
  const { toast } = useToast();
  const cacheKey = 'import-file:mapel';
  const [step, setStep] = useState<Step>('upload');
  const [runMode, setRunMode] = useState<RunMode>('import');
  const [loading, setLoading] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [rows, setRows] = useState<ParsedMapelRow[]>([]);
  const [showOnlyErrors, setShowOnlyErrors] = useState(false);
  const [results, setResults] = useState<ImportResultRow[]>([]);
  const [summary, setSummary] = useState<{ created: number; updated: number; failed: number; total: number } | null>(null);

  const { data: kelasList = [] } = useQuery({
    queryKey: ['import-mapel-kelas-ref'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kelas')
        .select('id, nama, tingkat, tahun_ajaran')
        .limit(2000);
      if (error) throw error;
      return (data || []) as KelasRef[];
    },
    enabled: open,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: staffList = [] } = useQuery({
    queryKey: ['import-mapel-staff-ref'],
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
        kode_mapel: 'MTK-7',
        nama: 'Matematika',
        kategori: 'wajib',
        status: 'aktif',
        kkm: 75,
        kelas_id: '',
        nama_kelas: '7A',
        tahun_ajaran: '2025/2026',
        pengampu_id: '',
        pengampu_employee_id: '19870001',
        pengampu_email: '',
      },
    ] : [];
    const ws = XLSX.utils.json_to_sheet(templateData, { header: TEMPLATE_COLUMNS });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'mapel');
    if (format === 'xlsx') {
      XLSX.writeFile(wb, variant === 'example' ? 'template-import-mapel-contoh.xlsx' : 'template-import-mapel-kosong.xlsx');
      return;
    }
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = variant === 'example' ? 'template-import-mapel-contoh.csv' : 'template-import-mapel-kosong.csv';
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

      const parsed: ParsedMapelRow[] = normalized.map((r, idx) => {
        const rowNumber = idx + 2;
        const errors: string[] = [];

        const kodeMapel = normalizeText(r.kode_mapel);
        const nama = normalizeText(r.nama);
        const kategoriRaw = normalizeText(r.kategori).toLowerCase();
        const statusRaw = normalizeText(r.status).toLowerCase();
        const kkmRaw = normalizeText(r.kkm);
        const kelasIdRaw = normalizeText(r.kelas_id);
        const kelasNama = normalizeText(r.nama_kelas);
        const tahunAjaran = normalizeText(r.tahun_ajaran);
        const pengampuIdRaw = normalizeText(r.pengampu_id);
        const pengampuEmployeeId = normalizeEmployeeId(r.pengampu_employee_id);
        const pengampuEmail = normalizeText(r.pengampu_email).toLowerCase();

        if (!nama) errors.push('nama wajib diisi');

        const kategori = isValidKategori(kategoriRaw) ? (kategoriRaw as MapelKategori) : undefined;
        if (!kategori) errors.push('kategori tidak valid');

        const status = statusRaw && isValidStatus(statusRaw) ? (statusRaw as MapelStatus) : undefined;
        if (statusRaw && !status) errors.push('status tidak valid');

        const kkm = kkmRaw ? Number(kkmRaw) : undefined;
        if (kkmRaw && (Number.isNaN(kkm) || kkm < 0)) errors.push('kkm tidak valid');

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
        } else {
          errors.push('pengampu_id atau (pengampu_employee_id/pengampu_email) wajib diisi');
        }

        const isValid = errors.length === 0;
        return {
          rowNumber,
          kodeMapel: kodeMapel || undefined,
          nama,
          kategori: kategori || 'wajib',
          status,
          kkm: typeof kkm === 'number' && !Number.isNaN(kkm) ? kkm : undefined,
          kelasId: resolvedKelasId,
          kelasNama: kelasNama || undefined,
          tahunAjaran: tahunAjaran || undefined,
          pengampuId: resolvedPengampuId,
          pengampuEmployeeId: pengampuEmployeeId || undefined,
          pengampuEmail: pengampuEmail || undefined,
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
        kodeMapel: r.kodeMapel,
        nama: r.nama,
        kategori: r.kategori,
        status: r.status,
        kkm: r.kkm,
        kelasId: r.kelasId,
        kelasNama: r.kelasNama,
        tahunAjaran: r.tahunAjaran,
        pengampuId: r.pengampuId,
        pengampuEmployeeId: r.pengampuEmployeeId,
        pengampuEmail: r.pengampuEmail,
      }));

      const { data, error } = await supabase.functions.invoke('import-mapel-bulk', {
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
        maxWidthClass="max-w-4xl"
        title="Import Mapel"
        description="Unggah file Excel (.xlsx) untuk membuat atau memperbarui mapel beserta pengampu."
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
                  Kunci update: <span className="font-semibold">(kelas + kode_mapel)</span> jika ada; jika tidak, <span className="font-semibold">(kelas + nama)</span>.
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Pengampu wajib diisi (id atau employee_id atau email).
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
                    <Button variant="outline" onClick={() => downloadErrorFile('xlsx', invalidRows.map(r => ({
                      rowNumber: r.rowNumber,
                      kode_mapel: r.kodeMapel || '',
                      nama: r.nama || '',
                      kelas_id: r.kelasId || '',
                      pengampu: r.pengampuResolvedName || r.pengampuEmail || r.pengampuEmployeeId || '',
                      errors: r.errors.join('; '),
                    })), 'error-import-mapel')}>
                      <Download className="h-4 w-4 mr-2" />
                      Error (XLSX)
                    </Button>
                    <Button variant="outline" onClick={() => downloadErrorFile('csv', invalidRows.map(r => ({
                      rowNumber: r.rowNumber,
                      kode_mapel: r.kodeMapel || '',
                      nama: r.nama || '',
                      kelas_id: r.kelasId || '',
                      pengampu: r.pengampuResolvedName || r.pengampuEmail || r.pengampuEmployeeId || '',
                      errors: r.errors.join('; '),
                    })), 'error-import-mapel')}>
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
                <ScrollArea className="h-[360px]">
                  <div className="w-full">
                    <div className="grid grid-cols-12 gap-2 px-4 py-3 border-b text-xs font-medium text-muted-foreground">
                      <div className="col-span-1">Row</div>
                      <div className="col-span-2">Kode</div>
                      <div className="col-span-3">Nama</div>
                      <div className="col-span-2">Kelas</div>
                      <div className="col-span-2">Pengampu</div>
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
                            <div className="col-span-2 font-medium truncate">{r.kodeMapel || '-'}</div>
                            <div className="col-span-3 truncate">{r.nama || '-'}</div>
                            <div className="col-span-2 truncate">{kelas ? kelas.nama : '-'}</div>
                            <div className="col-span-2 truncate">{r.pengampuResolvedName || r.pengampuEmail || r.pengampuEmployeeId || (r.pengampuId ? 'ID' : '-')}</div>
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

            <div className="flex flex-wrap gap-2">
              {failedResults.length > 0 && (
                <>
                  <Button variant="outline" onClick={() => downloadErrorFile('xlsx', failedResults.map(r => ({
                    rowNumber: r.rowNumber,
                    kode_mapel: r.kodeMapel || '',
                    nama: r.nama || '',
                    action: r.action || '',
                    error: r.error || '',
                  })), runMode === 'dry-run' ? 'hasil-validasi-mapel-error' : 'hasil-import-mapel-error')}>
                    <Download className="h-4 w-4 mr-2" />
                    Unduh Error (XLSX)
                  </Button>
                  <Button variant="outline" onClick={() => downloadErrorFile('csv', failedResults.map(r => ({
                    rowNumber: r.rowNumber,
                    kode_mapel: r.kodeMapel || '',
                    nama: r.nama || '',
                    action: r.action || '',
                    error: r.error || '',
                  })), runMode === 'dry-run' ? 'hasil-validasi-mapel-error' : 'hasil-import-mapel-error')}>
                    <Download className="h-4 w-4 mr-2" />
                    Unduh Error (CSV)
                  </Button>
                </>
              )}
            </div>

            <Card>
              <CardContent className="p-0">
                <ScrollArea className="h-[320px]">
                  <div className="grid grid-cols-12 gap-2 px-4 py-3 border-b text-xs font-medium text-muted-foreground">
                    <div className="col-span-1">Row</div>
                    <div className="col-span-3">Mapel</div>
                    <div className="col-span-2">Action</div>
                    <div className="col-span-6">Status</div>
                  </div>
                  {(results || []).map((r) => (
                    <div key={`${r.rowNumber}-${r.mapelId || ''}`} className="grid grid-cols-12 gap-2 px-4 py-3 border-b items-center text-sm">
                      <div className="col-span-1 text-muted-foreground">{r.rowNumber}</div>
                      <div className="col-span-3 font-medium truncate">{`${r.kodeMapel || ''} ${r.nama || '-'}`.trim()}</div>
                      <div className="col-span-2">{r.action || '-'}</div>
                      <div className="col-span-6">
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
