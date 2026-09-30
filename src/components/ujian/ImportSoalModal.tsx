import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { Download, Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle, Loader2, ArrowLeft, Search, Database, ChevronDown, ChevronUp } from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { JenisSoal } from '@/lib/ujianUtils';
import { useBankSoalList, BankSoalItem, BankSoalFilter } from '@/hooks/useBankSoal';

interface OpsiData {
  label: string;
  teks: string;
  is_kunci: boolean;
  gambar?: string;
}

interface ImportedSoal {
  jenis_soal: JenisSoal;
  pertanyaan: string;
  gambar_pertanyaan?: string;
  pembahasan?: string;
  gambar_pembahasan?: string;
  opsi?: OpsiData[];
  kunci_jawaban?: string;
  bobot_nilai: number;
}

interface ParsedRow {
  rowNumber: number;
  data: ImportedSoal | null;
  errors: string[];
  isValid: boolean;
}

interface ImportSoalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (soalList: ImportedSoal[]) => void;
  loading?: boolean;
  currentSoalCount: number;
  ujianMapel?: string;
  ujianKelas?: string;
}

type ImportMode = 'file' | 'bank-soal';
type Step = 'select-mode' | 'upload' | 'preview' | 'bank-soal-select';

const TEMPLATE_COLUMNS = [
  'jenis_soal',
  'pertanyaan',
  'gambar_pertanyaan',
  'opsi_a',
  'gambar_opsi_a',
  'opsi_b',
  'gambar_opsi_b',
  'opsi_c',
  'gambar_opsi_c',
  'opsi_d',
  'gambar_opsi_d',
  'opsi_e',
  'gambar_opsi_e',
  'kunci_jawaban',
  'bobot',
  'pembahasan',
  'gambar_pembahasan',
];

interface GroupedBankSoal {
  key: string;
  mata_pelajaran: string;
  kelas: string;
  items: BankSoalItem[];
}

interface BankSoalSelectStepProps {
  bankSoalSearch: string;
  setBankSoalSearch: (value: string) => void;
  isBankSoalLoading: boolean;
  groupedBankSoal: GroupedBankSoal[];
  expandedGroups: Set<string>;
  toggleGroupExpansion: (key: string) => void;
  selectedBankSoal: Set<string>;
  toggleSelectAllInGroup: (items: BankSoalItem[]) => void;
  toggleBankSoalSelection: (id: string) => void;
  getJenisSoalBadge: (jenis: string) => React.ReactNode;
}

function BankSoalSelectStep({
  bankSoalSearch,
  setBankSoalSearch,
  isBankSoalLoading,
  groupedBankSoal,
  expandedGroups,
  toggleGroupExpansion,
  selectedBankSoal,
  toggleSelectAllInGroup,
  toggleBankSoalSelection,
  getJenisSoalBadge,
}: BankSoalSelectStepProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;

    const handleWheel = (e: WheelEvent) => {
      e.stopPropagation();
      scrollElement.scrollTop += e.deltaY;
    };

    scrollElement.addEventListener('wheel', handleWheel, { passive: false });
    return () => scrollElement.removeEventListener('wheel', handleWheel);
  }, []);

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Search Only */}
      <div className="pb-3 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari soal..."
            value={bankSoalSearch}
            onChange={(e) => setBankSoalSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Bank Soal List with custom scroll handling */}
      <div
        ref={scrollRef}
        className="flex-1 mt-2 overflow-y-auto overscroll-contain touch-pan-y pr-2"
      >
        {isBankSoalLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : groupedBankSoal.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Database className="h-10 w-10 mb-2 opacity-50" />
            <p className="text-sm">Tidak ada soal ditemukan</p>
          </div>
        ) : (
          <div className="space-y-3">
            {groupedBankSoal.map((group) => {
              const isExpanded = expandedGroups.has(group.key);
              const allSelected = group.items.every((item) => selectedBankSoal.has(item.id));
              const someSelected = group.items.some((item) => selectedBankSoal.has(item.id));

              return (
                <Collapsible
                  key={group.key}
                  open={isExpanded}
                  onOpenChange={() => toggleGroupExpansion(group.key)}
                >
                  <div className="border rounded-lg overflow-hidden">
                    <div className="flex items-center gap-3 p-3 bg-muted/30">
                      <Checkbox
                        checked={allSelected}
                        className={someSelected && !allSelected ? 'data-[state=checked]:bg-primary/50' : ''}
                        onCheckedChange={() => toggleSelectAllInGroup(group.items)}
                      />
                      <CollapsibleTrigger asChild>
                        <button className="flex-1 flex items-center justify-between text-left">
                          <div>
                            <p className="font-medium text-sm">{group.mata_pelajaran}</p>
                            <p className="text-xs text-muted-foreground">Kelas {group.kelas}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {group.items.length} soal
                            </Badge>
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </button>
                      </CollapsibleTrigger>
                    </div>
                    <CollapsibleContent>
                      <div className="divide-y">
                        {group.items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-start gap-3 p-3 hover:bg-muted/20 cursor-pointer"
                            onClick={() => toggleBankSoalSelection(item.id)}
                          >
                            <Checkbox
                              checked={selectedBankSoal.has(item.id)}
                              onCheckedChange={() => toggleBankSoalSelection(item.id)}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                {getJenisSoalBadge(item.jenis_soal)}
                                <span className="text-xs text-muted-foreground">
                                  Bobot: {item.bobot}
                                </span>
                              </div>
                              <p className="text-sm line-clamp-2">
                                {stripHtml(item.pertanyaan)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function normalizeJenisSoal(value: string): JenisSoal | null {
  const normalized = value?.toString().toLowerCase().trim();
  if (['pg', 'pilihan_ganda', 'pilihan ganda'].includes(normalized)) return 'pilihan_ganda';
  if (['essai', 'essay', 'uraian'].includes(normalized)) return 'essai';
  if (['tf', 'true_false', 'benar_salah', 'benar salah'].includes(normalized)) return 'true_false';
  return null;
}

function parseRow(row: Record<string, any>, rowNumber: number): ParsedRow {
  const errors: string[] = [];

  const jenisSoal = normalizeJenisSoal(row.jenis_soal);
  if (!jenisSoal) {
    errors.push(`Jenis soal tidak valid: "${row.jenis_soal}"`);
  }

  const pertanyaan = row.pertanyaan?.toString().trim();
  if (!pertanyaan) {
    errors.push('Pertanyaan kosong');
  }

  const bobot = parseInt(row.bobot, 10);
  if (isNaN(bobot) || bobot <= 0) {
    errors.push(`Bobot tidak valid: "${row.bobot}"`);
  }

  let opsi: OpsiData[] | undefined;
  let kunciJawaban: string | undefined;

  const gambarPertanyaan = row.gambar_pertanyaan?.toString().trim() || undefined;
  const pembahasan = row.pembahasan?.toString().trim() || undefined;
  const gambarPembahasan = row.gambar_pembahasan?.toString().trim() || undefined;

  if (jenisSoal === 'pilihan_ganda') {
    const opsiLabels = ['A', 'B', 'C', 'D', 'E'];
    const opsiKeys = ['opsi_a', 'opsi_b', 'opsi_c', 'opsi_d', 'opsi_e'];
    const gambarOpsiKeys = ['gambar_opsi_a', 'gambar_opsi_b', 'gambar_opsi_c', 'gambar_opsi_d', 'gambar_opsi_e'];
    const kunci = row.kunci_jawaban?.toString().toUpperCase().trim();

    opsi = opsiKeys
      .map((key, idx) => ({
        label: opsiLabels[idx],
        teks: row[key]?.toString().trim() || '',
        is_kunci: opsiLabels[idx] === kunci,
        gambar: row[gambarOpsiKeys[idx]]?.toString().trim() || undefined,
      }))
      .filter((o) => o.teks);

    if (opsi.length < 2) {
      errors.push('Pilihan ganda harus memiliki minimal 2 opsi');
    }

    if (!kunci || !opsiLabels.includes(kunci)) {
      errors.push(`Kunci jawaban tidak valid: "${row.kunci_jawaban}"`);
    } else if (!opsi.find((o) => o.is_kunci)) {
      errors.push(`Kunci jawaban "${kunci}" tidak memiliki teks opsi`);
    }
  } else if (jenisSoal === 'true_false') {
    const kunci = row.kunci_jawaban?.toString().toLowerCase().trim();
    if (!['true', 'false', 'benar', 'salah'].includes(kunci)) {
      errors.push(`Kunci jawaban True/False tidak valid: "${row.kunci_jawaban}"`);
    } else {
      kunciJawaban = ['true', 'benar'].includes(kunci) ? 'true' : 'false';
    }
  } else if (jenisSoal === 'essai') {
    kunciJawaban = row.kunci_jawaban?.toString().trim() || '';
  }

  if (errors.length > 0) {
    return { rowNumber, data: null, errors, isValid: false };
  }

  return {
    rowNumber,
    data: {
      jenis_soal: jenisSoal!,
      pertanyaan: pertanyaan!,
      gambar_pertanyaan: gambarPertanyaan,
      pembahasan,
      gambar_pembahasan: gambarPembahasan,
      opsi,
      kunci_jawaban: kunciJawaban,
      bobot_nilai: bobot,
    },
    errors: [],
    isValid: true,
  };
}

function generateTemplate(): void {
  const wb = XLSX.utils.book_new();
  
  const data = [
    {
      jenis_soal: 'PG',
      pertanyaan: 'Apa ibu kota Indonesia?',
      gambar_pertanyaan: '',
      opsi_a: 'Jakarta',
      gambar_opsi_a: '',
      opsi_b: 'Bandung',
      gambar_opsi_b: '',
      opsi_c: 'Surabaya',
      gambar_opsi_c: '',
      opsi_d: 'Medan',
      gambar_opsi_d: '',
      opsi_e: '',
      gambar_opsi_e: '',
      kunci_jawaban: 'A',
      bobot: 10,
      pembahasan: 'Jakarta adalah ibu kota negara Indonesia sejak kemerdekaan.',
      gambar_pembahasan: '',
    },
    {
      jenis_soal: 'TF',
      pertanyaan: 'Matahari terbit dari arah timur',
      gambar_pertanyaan: '',
      opsi_a: '',
      gambar_opsi_a: '',
      opsi_b: '',
      gambar_opsi_b: '',
      opsi_c: '',
      gambar_opsi_c: '',
      opsi_d: '',
      gambar_opsi_d: '',
      opsi_e: '',
      gambar_opsi_e: '',
      kunci_jawaban: 'True',
      bobot: 5,
      pembahasan: 'Rotasi bumi dari barat ke timur menyebabkan matahari tampak terbit dari timur.',
      gambar_pembahasan: '',
    },
    {
      jenis_soal: 'ESSAI',
      pertanyaan: 'Jelaskan proses fotosintesis',
      gambar_pertanyaan: 'https://example.com/gambar-soal.jpg',
      opsi_a: '',
      gambar_opsi_a: '',
      opsi_b: '',
      gambar_opsi_b: '',
      opsi_c: '',
      gambar_opsi_c: '',
      opsi_d: '',
      gambar_opsi_d: '',
      opsi_e: '',
      gambar_opsi_e: '',
      kunci_jawaban: 'Poin: Cahaya, Klorofil, CO2, H2O',
      bobot: 20,
      pembahasan: 'Fotosintesis adalah proses pembuatan makanan oleh tumbuhan menggunakan cahaya matahari.',
      gambar_pembahasan: 'https://example.com/gambar-pembahasan.jpg',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(data, { header: TEMPLATE_COLUMNS });
  
  ws['!cols'] = [
    { wch: 15 }, { wch: 50 }, { wch: 35 }, { wch: 25 }, { wch: 35 },
    { wch: 25 }, { wch: 35 }, { wch: 25 }, { wch: 35 }, { wch: 25 },
    { wch: 35 }, { wch: 25 }, { wch: 35 }, { wch: 15 }, { wch: 10 },
    { wch: 60 }, { wch: 35 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Template Soal');
  XLSX.writeFile(wb, 'template_import_soal.xlsx');
}

function transformBankSoalToImported(item: BankSoalItem): ImportedSoal {
  let opsi: OpsiData[] | undefined;
  let kunciJawaban: string | undefined;

  if (item.jenis_soal === 'pilihan_ganda') {
    opsi = [];
    const labels = ['A', 'B', 'C', 'D', 'E'] as const;
    labels.forEach((label) => {
      const key = `opsi_${label.toLowerCase()}` as keyof BankSoalItem;
      const teks = item[key] as string | null;
      if (teks) {
        opsi!.push({
          label,
          teks,
          is_kunci: item.kunci_jawaban === label,
        });
      }
    });
  } else if (item.jenis_soal === 'true_false') {
    // Convert 'true'/'false' to 'benar'/'salah' for form compatibility
    const rawKunci = item.kunci_jawaban?.toLowerCase();
    if (rawKunci === 'true' || rawKunci === 'benar') {
      kunciJawaban = 'benar';
    } else if (rawKunci === 'false' || rawKunci === 'salah') {
      kunciJawaban = 'salah';
    } else {
      kunciJawaban = item.kunci_jawaban;
    }
  } else {
    kunciJawaban = item.kunci_jawaban;
  }

  return {
    jenis_soal: item.jenis_soal as JenisSoal,
    pertanyaan: item.pertanyaan,
    pembahasan: item.pembahasan || undefined,
    opsi,
    kunci_jawaban: kunciJawaban,
    bobot_nilai: item.bobot,
  };
}

function stripHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || '';
}

export function ImportSoalModal({
  open,
  onOpenChange,
  onImport,
  loading,
  currentSoalCount,
  ujianMapel,
  ujianKelas,
}: ImportSoalModalProps) {
  const [step, setStep] = useState<Step>('select-mode');
  const [importMode, setImportMode] = useState<ImportMode | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [showErrors, setShowErrors] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Bank Soal states
  const [bankSoalFilters, setBankSoalFilters] = useState<BankSoalFilter>({
    mata_pelajaran: ujianMapel || undefined,
    kelas: ujianKelas || undefined,
  });
  const [bankSoalSearch, setBankSoalSearch] = useState('');
  const [selectedBankSoal, setSelectedBankSoal] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const { data: bankSoalList, isLoading: isBankSoalLoading } = useBankSoalList(
    step === 'bank-soal-select' ? bankSoalFilters : {}
  );

  const filteredBankSoal = useMemo(() => {
    if (!bankSoalList) return [];
    if (!bankSoalSearch) return bankSoalList;
    const search = bankSoalSearch.toLowerCase();
    return bankSoalList.filter((item) =>
      stripHtml(item.pertanyaan).toLowerCase().includes(search)
    );
  }, [bankSoalList, bankSoalSearch]);

  const groupedBankSoal = useMemo(() => {
    const groups: Record<string, BankSoalItem[]> = {};
    filteredBankSoal.forEach((item) => {
      const key = `${item.mata_pelajaran}-${item.kelas}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return Object.entries(groups).map(([key, items]) => ({
      key,
      mata_pelajaran: items[0].mata_pelajaran,
      kelas: items[0].kelas,
      items,
    }));
  }, [filteredBankSoal]);

  const validRows = parsedRows.filter((r) => r.isValid);
  const errorRows = parsedRows.filter((r) => !r.isValid);

  const handleReset = useCallback(() => {
    setStep('select-mode');
    setImportMode(null);
    setFile(null);
    setParsedRows([]);
    setShowErrors(false);
    setIsParsing(false);
    setSelectedBankSoal(new Set());
    setBankSoalSearch('');
    setBankSoalFilters({
      mata_pelajaran: ujianMapel || undefined,
      kelas: ujianKelas || undefined,
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [ujianMapel, ujianKelas]);

  const handleClose = useCallback(() => {
    handleReset();
    onOpenChange(false);
  }, [handleReset, onOpenChange]);

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    setFile(selectedFile);
    setIsParsing(true);

    try {
      const buffer = await selectedFile.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(ws);

      const parsed = jsonData.map((row, idx) => parseRow(row, idx + 2));
      setParsedRows(parsed);
      setStep('preview');
    } catch (error) {
      console.error('Error parsing file:', error);
      setParsedRows([]);
    } finally {
      setIsParsing(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) handleFileSelect(droppedFile);
    },
    [handleFileSelect]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) handleFileSelect(selectedFile);
    },
    [handleFileSelect]
  );

  const handleImport = useCallback(() => {
    if (importMode === 'file') {
      const validData = validRows.map((r) => r.data!);
      onImport(validData);
    } else if (importMode === 'bank-soal') {
      const selectedItems = filteredBankSoal.filter((item) => selectedBankSoal.has(item.id));
      const importedData = selectedItems.map(transformBankSoalToImported);
      onImport(importedData);
    }
    handleClose();
  }, [importMode, validRows, filteredBankSoal, selectedBankSoal, onImport, handleClose]);

  const handleSelectMode = (mode: ImportMode) => {
    setImportMode(mode);
    setStep(mode === 'file' ? 'upload' : 'bank-soal-select');
  };

  const handleBack = () => {
    if (step === 'preview' || step === 'bank-soal-select') {
      handleReset();
    } else if (step === 'upload') {
      setStep('select-mode');
      setImportMode(null);
    }
  };

  const toggleBankSoalSelection = (id: string) => {
    setSelectedBankSoal((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleGroupExpansion = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleSelectAllInGroup = (items: BankSoalItem[]) => {
    const allSelected = items.every((item) => selectedBankSoal.has(item.id));
    setSelectedBankSoal((prev) => {
      const next = new Set(prev);
      items.forEach((item) => {
        if (allSelected) {
          next.delete(item.id);
        } else {
          next.add(item.id);
        }
      });
      return next;
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getJenisSoalBadge = (jenis: string) => {
    switch (jenis) {
      case 'pilihan_ganda':
        return <Badge variant="secondary" className="text-xs">PG</Badge>;
      case 'true_false':
        return <Badge variant="outline" className="text-xs">B/S</Badge>;
      case 'essai':
        return <Badge className="text-xs bg-amber-100 text-amber-800 border-amber-200">Essai</Badge>;
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step !== 'select-mode' && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            {step === 'select-mode' && 'Import Soal Massal'}
            {step === 'upload' && 'Upload File'}
            {step === 'preview' && 'Preview Import'}
            {step === 'bank-soal-select' && 'Pilih dari Bank Soal'}
          </DialogTitle>
          {step === 'select-mode' && (
            <DialogDescription>
              Pilih sumber import untuk menambahkan soal ke ujian
            </DialogDescription>
          )}
        </DialogHeader>

        {/* Step: Select Mode */}
        {step === 'select-mode' && (
          <div className="py-6">
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleSelectMode('file')}
                className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-dashed hover:border-primary hover:bg-primary/5 transition-colors"
              >
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <FileSpreadsheet className="h-6 w-6 text-primary" />
                </div>
                <div className="text-center">
                  <p className="font-medium">Upload File</p>
                  <p className="text-xs text-muted-foreground">Excel atau CSV</p>
                </div>
              </button>

              <button
                onClick={() => handleSelectMode('bank-soal')}
                className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-dashed hover:border-primary hover:bg-primary/5 transition-colors"
              >
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Database className="h-6 w-6 text-primary" />
                </div>
                <div className="text-center">
                  <p className="font-medium">Bank Soal</p>
                  <p className="text-xs text-muted-foreground">Dari database</p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Step: Upload File */}
        {step === 'upload' && (
          <div className="flex-1 overflow-y-auto space-y-4 py-4">
            <Card className="bg-muted/30">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <FileSpreadsheet className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-sm">Download Template</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Gunakan template standar kami untuk menghindari error
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={generateTemplate}>
                    <Download className="h-4 w-4 mr-2" />
                    Template
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div
              className={cn(
                'border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer',
                'hover:border-primary/50 hover:bg-primary/5',
                isParsing && 'pointer-events-none opacity-60'
              )}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleInputChange}
              />
              {isParsing ? (
                <>
                  <Loader2 className="h-12 w-12 mx-auto text-primary animate-spin" />
                  <p className="mt-4 font-medium">Memproses file...</p>
                </>
              ) : (
                <>
                  <Upload className="h-12 w-12 mx-auto text-muted-foreground/50" />
                  <p className="mt-4 font-medium">Klik atau Drag file Excel ke sini</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Maksimal 500 soal per upload
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Step: Preview File Import */}
        {step === 'preview' && file && (
          <div className="flex-1 overflow-hidden flex flex-col space-y-4 py-4">
            {/* File Info */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setStep('upload'); setFile(null); setParsedRows([]); }}>
                Ganti File
              </Button>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-3">
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold">{parsedRows.length}</p>
                  <p className="text-xs text-muted-foreground">Total Ditemukan</p>
                </CardContent>
              </Card>
              <Card className="border-emerald-200 bg-emerald-50/50">
                <CardContent className="p-4 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    <p className="text-2xl font-bold text-emerald-700">{validRows.length}</p>
                  </div>
                  <p className="text-xs text-emerald-600">Soal Valid</p>
                </CardContent>
              </Card>
              <Card className={cn(errorRows.length > 0 && 'border-destructive/50 bg-destructive/5')}>
                <CardContent className="p-4 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <XCircle className={cn('h-5 w-5', errorRows.length > 0 ? 'text-destructive' : 'text-muted-foreground')} />
                    <p className={cn('text-2xl font-bold', errorRows.length > 0 ? 'text-destructive' : 'text-muted-foreground')}>
                      {errorRows.length}
                    </p>
                  </div>
                  <p className={cn('text-xs', errorRows.length > 0 ? 'text-destructive' : 'text-muted-foreground')}>
                    Error
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Error Details */}
            {errorRows.length > 0 && (
              <div className="space-y-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowErrors(!showErrors)}
                  className="text-destructive hover:text-destructive"
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  {showErrors ? 'Sembunyikan' : 'Lihat'} Detail Error ({errorRows.length})
                </Button>

                {showErrors && (
                  <ScrollArea className="h-40 rounded-lg border border-destructive/30 bg-destructive/5">
                    <div className="p-3 space-y-2">
                      {errorRows.map((row) => (
                        <div key={row.rowNumber} className="text-sm">
                          <Badge variant="destructive" className="text-[10px]">
                            Baris {row.rowNumber}
                          </Badge>
                          <ul className="mt-1 ml-4 list-disc text-xs text-destructive">
                            {row.errors.map((err, idx) => (
                              <li key={idx}>{err}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            )}

            {/* Import Info */}
            {validRows.length > 0 && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <p className="text-xs">
                  {validRows.length} soal akan ditambahkan dengan nomor urut mulai dari {currentSoalCount + 1}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Step: Bank Soal Select */}
        {step === 'bank-soal-select' && (
          <BankSoalSelectStep
            bankSoalSearch={bankSoalSearch}
            setBankSoalSearch={setBankSoalSearch}
            isBankSoalLoading={isBankSoalLoading}
            groupedBankSoal={groupedBankSoal}
            expandedGroups={expandedGroups}
            toggleGroupExpansion={toggleGroupExpansion}
            selectedBankSoal={selectedBankSoal}
            toggleSelectAllInGroup={toggleSelectAllInGroup}
            toggleBankSoalSelection={toggleBankSoalSelection}
            getJenisSoalBadge={getJenisSoalBadge}
          />
        )}

        {/* Footer Actions */}
        <div className="flex justify-between items-center gap-3 pt-4 border-t">
          {step === 'bank-soal-select' ? (
            <p className="text-sm text-muted-foreground">
              {selectedBankSoal.size} soal terpilih
            </p>
          ) : (
            <div />
          )}
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleClose}>
              Batal
            </Button>
            {step === 'preview' && (
              <Button
                onClick={handleImport}
                disabled={validRows.length === 0 || loading}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Memproses...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Import {validRows.length} Soal
                  </>
                )}
              </Button>
            )}
            {step === 'bank-soal-select' && (
              <Button
                onClick={handleImport}
                disabled={selectedBankSoal.size === 0 || loading}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Memproses...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Import {selectedBankSoal.size} Soal
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ImportSoalModal;
