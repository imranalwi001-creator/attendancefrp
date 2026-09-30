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

type UserStatus = 'aktif' | 'nonaktif' | 'cuti' | 'alumni';
type Step = 'upload' | 'preview' | 'result';
type RunMode = 'import' | 'dry-run';

interface StaffRef {
  id: string;
  employee_id: string | null;
  profiles?: { email?: string | null; name?: string | null } | null;
}

interface ParsedKelasRow {
  rowNumber: number;
  nama: string;
  tingkat: string;
  tahunAjaran: string;
  status?: UserStatus;
  walikelasId?: string;
  walikelasEmployeeId?: string;
  walikelasEmail?: string;
  walikelasResolvedId?: string;
  walikelasResolvedName?: string;
  errors: string[];
  isValid: boolean;
}

interface ImportResultRow {
  rowNumber: number;
  nama?: string;
  tingkat?: string;
  tahunAjaran?: string;
  action?: 'created' | 'updated';
  success: boolean;
  error?: string;
  kelasId?: string;
}

interface ImportKelasModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: () => void;
}

const TEMPLATE_COLUMNS = [
  'nama',
  'tingkat',
  'tahun_ajaran',
  'status',
  'walikelas_id',
  'walikelas_employee_id',
  'walikelas_email',
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

const isValidStatus = (v: string): v is UserStatus => {
  return v === 'aktif' || v === 'nonaktif' || v === 'cuti' || v === 'alumni';
};

export default function ImportKelasModal({ open, onOpenChange, onImported }: ImportKelasModalProps) {
  const { toast } = useToast();
  const cacheKey = 'import-file:kelas';
  const [step, setStep] = useState<Step>('upload');
  const [runMode, setRunMode] = useState<RunMode>('import');
  const [loading, setLoading] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [rows, setRows] = useState<ParsedKelasRow[]>([]);
  const [showOnlyErrors, setShowOnlyErrors] = useState(false);
  const [results, setResults] = useState<ImportResultRow[]>([]);
  const [summary, setSummary] = useState<{ created: number; updated: number; failed: number; total: number } | null>(null);

  const { data: staffList = [] } = useQuery({
    queryKey: ['import-kelas-staff-ref'],
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
        nama: '7A',
        tingkat: '7',
        tahun_ajaran: '2025/2026',
        status: 'aktif',
        walikelas_id: '',
        walikelas_employee_id: '19870002',
        walikelas_email: '',
      },
    ] : [];
    const ws = XLSX.utils.json_to_sheet(templateData, { header: TEMPLATE_COLUMNS });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'kelas');
    if (format === 'xlsx') {
      XLSX.writeFile(wb, variant === 'example' ? 'template-import-kelas-contoh.xlsx' : 'template-import-kelas-kosong.xlsx');
      return;
    }
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = variant === 'example' ? 'template-import-kelas-contoh.csv' : 'template-import-kelas-kosong.csv';
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

      const keyCounts = new Map<string, number>();
      normalized.forEach((r) => {
        const key = `${normalizeText(r.nama).toLowerCase()}|${normalizeText(r.tingkat).toLowerCase()}|${normalizeText(r.tahun_ajaran).toLowerCase()}`;
        if (key !== '||') keyCounts.set(key, (keyCounts.get(key) || 0) + 1);
      });

      const parsed: ParsedKelasRow[] = normalized.map((r, idx) => {
        const rowNumber = idx + 2;
        const errors: string[] = [];

        const nama = normalizeText(r.nama);
        const tingkat = normalizeText(r.tingkat);
        const tahunAjaran = normalizeText(r.tahun_ajaran);
        const statusRaw = normalizeText(r.status).toLowerCase();
        const walikelasId = normalizeText(r.walikelas_id);
        const walikelasEmployeeId = normalizeEmployeeId(r.walikelas_employee_id);
        const walikelasEmail = normalizeText(r.walikelas_email).toLowerCase();

        if (!nama || !tingkat || !tahunAjaran) errors.push('nama, tingkat, tahun_ajaran wajib diisi');
        const rowKey = `${nama.toLowerCase()}|${tingkat.toLowerCase()}|${tahunAjaran.toLowerCase()}`;
        if (nama && tingkat && tahunAjaran && (keyCounts.get(rowKey) || 0) > 1) errors.push('Kelas duplikat di file');

        const status = statusRaw && isValidStatus(statusRaw) ? (statusRaw as UserStatus) : undefined;
        if (statusRaw && !status) errors.push('status tidak valid');

        let resolvedId: string | undefined = undefined;
        let resolvedName: string | undefined = undefined;
        if (walikelasId) {
          resolvedId = walikelasId;
        } else if (walikelasEmployeeId) {
          const staff = staffByEmployeeId.get(walikelasEmployeeId.toLowerCase());
          if (!staff) errors.push(`wali kelas tidak ditemukan (employee_id=${walikelasEmployeeId})`);
          resolvedId = staff?.id;
          resolvedName = normalizeText(staff?.profiles?.name) || undefined;
        } else if (walikelasEmail) {
          const staff = staffByEmail.get(walikelasEmail.toLowerCase());
          if (!staff) errors.push(`wali kelas tidak ditemukan (email=${walikelasEmail})`);
          resolvedId = staff?.id;
          resolvedName = normalizeText(staff?.profiles?.name) || undefined;
        }

        const isValid = errors.length === 0;
        return {
          rowNumber,
          nama,
          tingkat,
          tahunAjaran,
          status,
          walikelasId: walikelasId || undefined,
          walikelasEmployeeId: walikelasEmployeeId || undefined,
          walikelasEmail: walikelasEmail || undefined,
          walikelasResolvedId: resolvedId,
          walikelasResolvedName: resolvedName,
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
        nama: r.nama,
        tingkat: r.tingkat,
        tahunAjaran: r.tahunAjaran,
        status: r.status,
        walikelasId: r.walikelasId || r.walikelasResolvedId,
        walikelasEmployeeId: r.walikelasEmployeeId,
        walikelasEmail: r.walikelasEmail,
      }));

      const { data, error } = await supabase.functions.invoke('import-kelas-bulk', {
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
        title="Import Kelas"
        description="Unggah file Excel (.xlsx) untuk membuat atau memperbarui data kelas."
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
                  Kunci update: <span className="font-semibold">nama + tingkat + tahun_ajaran</span>.
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Wali kelas: walikelas_id atau walikelas_employee_id atau walikelas_email.
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
                      nama: r.nama,
                      tingkat: r.tingkat,
                      tahun_ajaran: r.tahunAjaran,
                      walikelas: r.walikelasResolvedName || r.walikelasEmail || r.walikelasEmployeeId || '',
                      errors: r.errors.join('; '),
                    })), 'error-import-kelas')}>
                      <Download className="h-4 w-4 mr-2" />
                      Error (XLSX)
                    </Button>
                    <Button variant="outline" onClick={() => downloadErrorFile('csv', invalidRows.map(r => ({
                      rowNumber: r.rowNumber,
                      nama: r.nama,
                      tingkat: r.tingkat,
                      tahun_ajaran: r.tahunAjaran,
                      walikelas: r.walikelasResolvedName || r.walikelasEmail || r.walikelasEmployeeId || '',
                      errors: r.errors.join('; '),
                    })), 'error-import-kelas')}>
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
                      <div className="col-span-2">Kelas</div>
                      <div className="col-span-2">Tingkat</div>
                      <div className="col-span-3">Tahun Ajaran</div>
                      <div className="col-span-2">Wali Kelas</div>
                      <div className="col-span-2">Hasil</div>
                    </div>
                    {displayedRows.length === 0 ? (
                      <div className="p-6 text-sm text-muted-foreground">Tidak ada baris untuk ditampilkan</div>
                    ) : (
                      displayedRows.map((r) => (
                        <div key={r.rowNumber} className="grid grid-cols-12 gap-2 px-4 py-3 border-b items-center text-sm">
                          <div className="col-span-1 text-muted-foreground">{r.rowNumber}</div>
                          <div className="col-span-2 font-medium truncate">{r.nama}</div>
                          <div className="col-span-2 truncate">{r.tingkat}</div>
                          <div className="col-span-3 truncate">{r.tahunAjaran}</div>
                          <div className="col-span-2 truncate">{r.walikelasResolvedName || r.walikelasEmail || r.walikelasEmployeeId || (r.walikelasId ? 'ID' : '-')}</div>
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
                      ))
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
                    nama: r.nama || '',
                    tingkat: r.tingkat || '',
                    tahun_ajaran: r.tahunAjaran || '',
                    action: r.action || '',
                    error: r.error || '',
                  })), runMode === 'dry-run' ? 'hasil-validasi-kelas-error' : 'hasil-import-kelas-error')}>
                    <Download className="h-4 w-4 mr-2" />
                    Unduh Error (XLSX)
                  </Button>
                  <Button variant="outline" onClick={() => downloadErrorFile('csv', failedResults.map(r => ({
                    rowNumber: r.rowNumber,
                    nama: r.nama || '',
                    tingkat: r.tingkat || '',
                    tahun_ajaran: r.tahunAjaran || '',
                    action: r.action || '',
                    error: r.error || '',
                  })), runMode === 'dry-run' ? 'hasil-validasi-kelas-error' : 'hasil-import-kelas-error')}>
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
                    <div className="col-span-3">Kelas</div>
                    <div className="col-span-2">Action</div>
                    <div className="col-span-6">Status</div>
                  </div>
                  {(results || []).map((r) => (
                    <div key={`${r.rowNumber}-${r.kelasId || ''}`} className="grid grid-cols-12 gap-2 px-4 py-3 border-b items-center text-sm">
                      <div className="col-span-1 text-muted-foreground">{r.rowNumber}</div>
                      <div className="col-span-3 font-medium truncate">{`${r.nama || '-'} (${r.tahunAjaran || '-'})`}</div>
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
