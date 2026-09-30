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
import { clearImportFile, loadImportFile, saveImportFile } from '@/lib/importFileCache';
import { getInvokeErrorMessage } from '@/lib/supabaseInvokeError';
import type { Kelas } from '@/types';

type UserStatus = 'aktif' | 'nonaktif' | 'cuti' | 'alumni';

type Step = 'upload' | 'preview' | 'result';
type RunMode = 'import' | 'dry-run';

interface ParsedSantriRow {
  rowNumber: number;
  nisn: string;
  nis?: string;
  name?: string;
  email?: string;
  status?: UserStatus;
  kelasId?: string;
  kelasNama?: string;
  tahunAjaran?: string;
  errors: string[];
  isValid: boolean;
}

interface ImportResultRow {
  rowNumber: number;
  nisn?: string;
  action?: 'created' | 'updated' | 'skipped';
  success: boolean;
  error?: string;
  userId?: string;
  email?: string;
  password?: string;
}

interface ImportSantriModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kelasList: Kelas[];
  onImported?: () => void;
}

const TEMPLATE_COLUMNS = [
  'nisn',
  'nis',
  'nama',
  'email',
  'status',
  'kelas_id',
  'nama_kelas',
  'tahun_ajaran',
];

const normalizeText = (v: unknown) => {
  if (v === null || v === undefined) return '';
  return String(v).trim();
};

const normalizeNisn = (v: unknown) => {
  const s = normalizeText(v);
  return s.replace(/\.0$/, '').replace(/\s+/g, '');
};

const normalizeHeaderKey = (v: string) =>
  v
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

const isValidStatus = (v: string): v is UserStatus => {
  return v === 'aktif' || v === 'nonaktif' || v === 'cuti' || v === 'alumni';
};

export default function ImportSantriModal({ open, onOpenChange, kelasList, onImported }: ImportSantriModalProps) {
  const { toast } = useToast();
  const cacheKey = 'import-file:santri';
  const [step, setStep] = useState<Step>('upload');
  const [runMode, setRunMode] = useState<RunMode>('import');
  const [loading, setLoading] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [rows, setRows] = useState<ParsedSantriRow[]>([]);
  const [showOnlyErrors, setShowOnlyErrors] = useState(false);
  const [results, setResults] = useState<ImportResultRow[]>([]);
  const [summary, setSummary] = useState<{ created: number; updated: number; failed: number; total: number } | null>(null);

  const kelasById = useMemo(() => {
    const m = new Map<string, Kelas>();
    kelasList.forEach(k => m.set(k.id, k));
    return m;
  }, [kelasList]);

  const kelasByNameYear = useMemo(() => {
    const m = new Map<string, Kelas>();
    kelasList.forEach(k => {
      const key = `${(k.nama || '').trim().toLowerCase()}|${(k.tahun_ajaran || '').trim().toLowerCase()}`;
      m.set(key, k);
    });
    return m;
  }, [kelasList]);

  const validRows = useMemo(() => rows.filter(r => r.isValid), [rows]);
  const invalidRows = useMemo(() => rows.filter(r => !r.isValid), [rows]);
  const displayedRows = useMemo(() => {
    const list = showOnlyErrors ? invalidRows : rows;
    return list.slice(0, 200);
  }, [rows, invalidRows, showOnlyErrors]);

  const downloadTemplate = (format: 'xlsx' | 'csv', variant: 'empty' | 'example') => {
    const templateData = variant === 'example' ? [
      {
        nisn: '0012345678',
        nis: '12345',
        nama: 'Contoh Santri',
        email: '',
        status: 'aktif',
        kelas_id: '',
        nama_kelas: '7A',
        tahun_ajaran: '2025/2026',
      },
    ] : [];
    const ws = XLSX.utils.json_to_sheet(templateData, { header: TEMPLATE_COLUMNS });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'santri');
    if (format === 'xlsx') {
      XLSX.writeFile(wb, variant === 'example' ? 'template-import-santri-contoh.xlsx' : 'template-import-santri-kosong.xlsx');
      return;
    }
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = variant === 'example' ? 'template-import-santri-contoh.csv' : 'template-import-santri-kosong.csv';
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

      const nisnCounts = new Map<string, number>();
      normalized.forEach((r) => {
        const n = normalizeNisn(r.nisn);
        if (!n) return;
        nisnCounts.set(n, (nisnCounts.get(n) || 0) + 1);
      });

      const parsed: ParsedSantriRow[] = normalized.map((r, idx) => {
        const rowNumber = idx + 2;
        const errors: string[] = [];

        const nisn = normalizeNisn(r.nisn);
        const nis = normalizeText(r.nis);
        const name = normalizeText(r.nama);
        const email = normalizeText(r.email);
        const statusRaw = normalizeText(r.status).toLowerCase();
        const kelasId = normalizeText(r.kelas_id);
        const kelasNama = normalizeText(r.nama_kelas);
        const tahunAjaran = normalizeText(r.tahun_ajaran);

        if (!nisn) errors.push('NISN wajib diisi');
        if (nisn && !/^\d{10}$/.test(nisn)) errors.push('NISN harus 10 digit angka');
        if (nisn && (nisnCounts.get(nisn) || 0) > 1) errors.push('NISN duplikat di file');

        const status = statusRaw && isValidStatus(statusRaw) ? (statusRaw as UserStatus) : undefined;
        if (statusRaw && !status) errors.push('Status tidak valid (aktif/nonaktif/cuti/alumni)');

        let resolvedKelasId: string | undefined = undefined;
        if (kelasId) {
          if (!kelasById.has(kelasId)) errors.push('kelas_id tidak ditemukan');
          resolvedKelasId = kelasId;
        } else if (kelasNama || tahunAjaran) {
          if (!kelasNama || !tahunAjaran) {
            errors.push('Jika pakai nama_kelas maka tahun_ajaran wajib diisi (dan sebaliknya)');
          } else {
            const key = `${kelasNama.toLowerCase()}|${tahunAjaran.toLowerCase()}`;
            const k = kelasByNameYear.get(key);
            if (!k) errors.push(`Kelas tidak ditemukan: ${kelasNama} (${tahunAjaran})`);
            resolvedKelasId = k?.id;
          }
        } else if (kelasList.length === 1) {
          // Jika kelas tidak dispesifikasikan di Excel tapi modal hanya menerima 1 kelas, gunakan kelas tersebut
          resolvedKelasId = kelasList[0].id;
        }

        const isValid = errors.length === 0;
        return {
          rowNumber,
          nisn,
          nis: nis || undefined,
          name: name || undefined,
          email: email || undefined,
          status,
          kelasId: resolvedKelasId,
          kelasNama: kelasNama || undefined,
          tahunAjaran: tahunAjaran || undefined,
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

  const downloadCredentials = (rows: ImportResultRow[]) => {
    const data = rows
      .filter(r => r.success && r.action === 'created' && r.email && r.password)
      .map(r => ({
        rowNumber: r.rowNumber,
        nisn: r.nisn || '',
        email: r.email || '',
        password: r.password || '',
      }));

    const ws = XLSX.utils.json_to_sheet(data, { header: ['rowNumber', 'nisn', 'email', 'password'] });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'akun');
    XLSX.writeFile(wb, 'akun-santri-baru.xlsx');
  };

  const handleImport = async (dryRun: boolean) => {
    setLoading(true);
    try {
      const payloadRows = validRows.map(r => ({
        rowNumber: r.rowNumber,
        nisn: r.nisn,
        nis: r.nis,
        name: r.name,
        email: r.email,
        status: r.status,
        kelasId: r.kelasId,
        kelasNama: r.kelasNama,
        tahunAjaran: r.tahunAjaran,
      }));

      const { data, error } = await supabase.functions.invoke('import-santri-bulk', {
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

  const createdCount = results.filter(r => r.success && r.action === 'created').length;
  const updatedCount = results.filter(r => r.success && r.action === 'updated').length;
  const failedCount = results.filter(r => !r.success).length;
  const failedResults = results.filter(r => !r.success);

  return (
    <Dialog open={open} onOpenChange={close}>
      <ImportWizardFrame
        maxWidthClass="max-w-4xl"
        title="Import Santri"
        description="Unggah file Excel (.xlsx) untuk membuat atau memperbarui data santri berdasarkan NISN."
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
                  Sistem akan create akun jika belum ada (email opsional) dan update jika <span className="font-semibold">NISN</span> sudah ada.
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Kolom wajib: nisn, nama, (kelas_id atau nama_kelas + tahun_ajaran).
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
                      onClick={() => downloadErrorFile('xlsx', invalidRows.map(r => ({
                        rowNumber: r.rowNumber,
                        nisn: r.nisn,
                        nama: r.name || '',
                        kelas_id: r.kelasId || '',
                        errors: r.errors.join('; '),
                      })), 'error-import-santri')}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Error (XLSX)
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => downloadErrorFile('csv', invalidRows.map(r => ({
                        rowNumber: r.rowNumber,
                        nisn: r.nisn,
                        nama: r.name || '',
                        kelas_id: r.kelasId || '',
                        errors: r.errors.join('; '),
                      })), 'error-import-santri')}
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
                <ScrollArea className="h-[360px]">
                  <div className="w-full">
                    <div className="grid grid-cols-12 gap-2 px-4 py-3 border-b text-xs font-medium text-muted-foreground">
                      <div className="col-span-1">Row</div>
                      <div className="col-span-2">NISN</div>
                      <div className="col-span-3">Nama</div>
                      <div className="col-span-3">Kelas</div>
                      <div className="col-span-1">Status</div>
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
                            <div className="col-span-2 font-medium">{r.nisn || '-'}</div>
                            <div className="col-span-3 truncate">{r.name || '-'}</div>
                            <div className="col-span-3 truncate">{kelas ? `${kelas.nama} (${kelas.tahun_ajaran})` : '-'}</div>
                            <div className="col-span-1">{r.status || '-'}</div>
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
                  <p>Perbaiki baris yang error lalu upload ulang. Import hanya akan memproses baris yang valid.</p>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 'result' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default">Created: {summary?.created ?? createdCount}</Badge>
              <Badge variant="secondary">Updated: {summary?.updated ?? updatedCount}</Badge>
              <Badge variant={failedCount > 0 ? 'destructive' : 'secondary'}>Failed: {summary?.failed ?? failedCount}</Badge>
              <Badge variant="outline">Total: {summary?.total ?? results.length}</Badge>
            </div>

            <div className="flex flex-wrap gap-2">
              {createdCount > 0 && (
                <Button variant="outline" onClick={() => downloadCredentials(results)}>
                  <Download className="h-4 w-4 mr-2" />
                  Unduh Akun Baru (XLSX)
                </Button>
              )}
              {failedResults.length > 0 && (
                <>
                  <Button variant="outline" onClick={() => downloadErrorFile('xlsx', failedResults.map(r => ({
                    rowNumber: r.rowNumber,
                    nisn: r.nisn || '',
                    action: r.action || '',
                    error: r.error || '',
                  })), runMode === 'dry-run' ? 'hasil-validasi-santri-error' : 'hasil-import-santri-error')}>
                    <Download className="h-4 w-4 mr-2" />
                    Unduh Error (XLSX)
                  </Button>
                  <Button variant="outline" onClick={() => downloadErrorFile('csv', failedResults.map(r => ({
                    rowNumber: r.rowNumber,
                    nisn: r.nisn || '',
                    action: r.action || '',
                    error: r.error || '',
                  })), runMode === 'dry-run' ? 'hasil-validasi-santri-error' : 'hasil-import-santri-error')}>
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
                    <div className="col-span-2">NISN</div>
                    <div className="col-span-2">Action</div>
                    <div className="col-span-3">Email</div>
                    <div className="col-span-4">Status</div>
                  </div>
                  {(results || []).map((r) => (
                    <div key={`${r.rowNumber}-${r.nisn || ''}`} className="grid grid-cols-12 gap-2 px-4 py-3 border-b items-center text-sm">
                      <div className="col-span-1 text-muted-foreground">{r.rowNumber}</div>
                      <div className="col-span-2 font-medium">{r.nisn || '-'}</div>
                      <div className="col-span-2">{r.action || '-'}</div>
                      <div className="col-span-3 truncate">{r.email || '-'}</div>
                      <div className="col-span-4">
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
