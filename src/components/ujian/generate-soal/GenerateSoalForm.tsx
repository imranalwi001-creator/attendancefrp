import { useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, BookOpen, Target, WandSparkles, FileQuestion, BrainCircuit, GraduationCap, Upload, FileText, LoaderCircle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { GenerateSoalParams } from '@/hooks/useGenerateSoal';
import { toast } from 'sonner';

interface GenerateSoalFormProps {
  onGenerate: (params: GenerateSoalParams) => void;
  isLoading: boolean;
  initialValues?: Partial<GenerateSoalParams>;
  contextDescription?: string;
}

const BENTUK_ASESMEN_OPTIONS = [
  { value: 'UH', label: 'Ulangan Harian (UH)' },
  { value: 'PTS', label: 'Penilaian Tengah Semester (PTS)' },
  { value: 'PAS', label: 'Penilaian Akhir Semester (PAS)' },
  { value: 'ASAT', label: 'Asesmen Sumatif Akhir Tahun (ASAT)' },
];

const LEVEL_KOGNITIF_OPTIONS = [
  { value: 'LOTS', label: 'LOTS (Lower Order Thinking Skills)', description: 'Mengingat, memahami' },
  { value: 'MOTS', label: 'MOTS (Middle Order Thinking Skills)', description: 'Menerapkan, menganalisis' },
  { value: 'HOTS', label: 'HOTS (Higher Order Thinking Skills)', description: 'Mengevaluasi, mencipta' },
];

const KONTEKS_SOAL_OPTIONS = [
  { value: 'kehidupan_sehari', label: 'Kehidupan Sehari-hari' },
  { value: 'literasi_digital', label: 'Literasi Digital' },
  { value: 'numerasi', label: 'Numerasi' },
  { value: 'profil_pelajar', label: 'Profil Pelajar Pancasila' },
];

const QUICK_PRESETS = [
  {
    id: 'quiz-harian',
    title: 'Quiz Harian',
    description: 'Cepat, ringan, cocok untuk cek pemahaman harian.',
    config: {
      bentuk_asesmen: 'UH',
      jumlah_pg: 8,
      jumlah_tf: 2,
      jumlah_essai: 0,
      level_kognitif: ['LOTS', 'MOTS'],
      konteks_soal: ['kehidupan_sehari'],
    },
  },
  {
    id: 'hots-mix',
    title: 'Paket HOTS',
    description: 'Lebih analitis dengan fokus MOTS dan HOTS.',
    config: {
      bentuk_asesmen: 'PTS',
      jumlah_pg: 6,
      jumlah_tf: 0,
      jumlah_essai: 4,
      level_kognitif: ['MOTS', 'HOTS'],
      konteks_soal: ['literasi_digital', 'profil_pelajar'],
    },
  },
  {
    id: 'remedial',
    title: 'Remedial',
    description: 'Fokus konsep inti dan umpan balik yang jelas.',
    config: {
      bentuk_asesmen: 'UH',
      jumlah_pg: 5,
      jumlah_tf: 3,
      jumlah_essai: 2,
      level_kognitif: ['LOTS', 'MOTS'],
      konteks_soal: ['kehidupan_sehari', 'numerasi'],
    },
  },
];

const KELAS_OPTIONS = Array.from({ length: 12 }, (_, index) => ({
  value: String(index + 1),
  label: `Kelas ${index + 1}`,
}));

export function GenerateSoalForm({
  onGenerate,
  isLoading,
  initialValues,
  contextDescription,
}: GenerateSoalFormProps) {
  // MODUL 1 - Identitas Asesmen
  const [mataPelajaran, setMataPelajaran] = useState(initialValues?.mata_pelajaran || '');
  const [kelas, setKelas] = useState<string>(initialValues?.kelas ? String(initialValues.kelas) : '');
  const [materiPokok, setMateriPokok] = useState(initialValues?.materi_pokok || '');
  const [bentukAsesmen, setBentukAsesmen] = useState(initialValues?.bentuk_asesmen || 'UH');

  // MODUL 3 - Desain Soal Blueprint
  const [jumlahPG, setJumlahPG] = useState(initialValues?.jumlah_pg ?? 5);
  const [jumlahTF, setJumlahTF] = useState(initialValues?.jumlah_tf ?? 3);
  const [jumlahEssai, setJumlahEssai] = useState(initialValues?.jumlah_essai ?? 2);
  const [levelKognitif, setLevelKognitif] = useState<string[]>(initialValues?.level_kognitif ?? ['MOTS']);
  const [konteksSoal, setKonteksSoal] = useState<string[]>(initialValues?.konteks_soal ?? ['kehidupan_sehari']);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!initialValues) return;

    setMataPelajaran(initialValues.mata_pelajaran || '');
    setKelas(initialValues.kelas ? String(initialValues.kelas) : '');
    setMateriPokok(initialValues.materi_pokok || '');
    setBentukAsesmen(initialValues.bentuk_asesmen || 'UH');
    setJumlahPG(initialValues.jumlah_pg ?? 5);
    setJumlahTF(initialValues.jumlah_tf ?? 3);
    setJumlahEssai(initialValues.jumlah_essai ?? 2);
    setLevelKognitif(initialValues.level_kognitif ?? ['MOTS']);
    setKonteksSoal(initialValues.konteks_soal ?? ['kehidupan_sehari']);
    setSourceFile(null);
  }, [initialValues]);

  const totalSoal = jumlahPG + jumlahTF + jumlahEssai;
  const isValid = mataPelajaran && kelas && materiPokok && totalSoal > 0 && levelKognitif.length > 0;

  const levelSummary = useMemo(() => {
    if (levelKognitif.includes('HOTS')) return 'Fokus analitis dan pendalaman';
    if (levelKognitif.includes('MOTS')) return 'Seimbang untuk latihan dan evaluasi';
    return 'Fokus konsep dasar dan penguatan';
  }, [levelKognitif]);

  const handleLevelChange = (value: string, checked: boolean) => {
    setActivePreset(null);
    if (checked) {
      setLevelKognitif((prev) => [...prev, value]);
    } else {
      setLevelKognitif((prev) => prev.filter((v) => v !== value));
    }
  };

  const handleKonteksChange = (value: string, checked: boolean) => {
    setActivePreset(null);
    if (checked) {
      setKonteksSoal((prev) => [...prev, value]);
    } else {
      setKonteksSoal((prev) => prev.filter((v) => v !== value));
    }
  };

  const applyPreset = (presetId: string) => {
    const preset = QUICK_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;

    setActivePreset(presetId);
    setBentukAsesmen(preset.config.bentuk_asesmen);
    setJumlahPG(preset.config.jumlah_pg);
    setJumlahTF(preset.config.jumlah_tf);
    setJumlahEssai(preset.config.jumlah_essai);
    setLevelKognitif(preset.config.level_kognitif);
    setKonteksSoal(preset.config.konteks_soal);
  };

  const readFileAsBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result !== 'string') {
          reject(new Error('Gagal membaca file'));
          return;
        }
        const base64 = result.split(',')[1];
        if (!base64) {
          reject(new Error('Format file tidak didukung'));
          return;
        }
        resolve(base64);
      };
      reader.onerror = () => reject(new Error('Gagal membaca file'));
      reader.readAsDataURL(file);
    });

  const handlePickFile = async (file: File | null) => {
    if (!file) return;

    const allowedTypes = ['application/pdf', 'text/plain', 'text/markdown', 'image/png', 'image/jpeg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Gunakan file PDF, TXT, Markdown, atau gambar materi.');
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      toast.error('Ukuran file maksimal 8MB.');
      return;
    }

    setSourceFile(file);
    toast.success(`Materi ${file.name} siap dipakai saat generate soal`);
  };

  const handleSubmit = async () => {
    if (!isValid) return;

    let materiFileBase64: string | undefined;
    if (sourceFile) {
      try {
        materiFileBase64 = await readFileAsBase64(sourceFile);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Gagal membaca file materi');
        return;
      }
    }

    onGenerate({
      mata_pelajaran: mataPelajaran,
      kelas: parseInt(kelas, 10),
      materi_pokok: materiPokok,
      bentuk_asesmen: bentukAsesmen,
      jumlah_pg: jumlahPG,
      jumlah_tf: jumlahTF,
      jumlah_essai: jumlahEssai,
      level_kognitif: levelKognitif,
      konteks_soal: konteksSoal,
      sumber_label: sourceFile?.name,
      materi_file_name: sourceFile?.name,
      materi_file_type: sourceFile?.type,
      materi_file_base64: materiFileBase64,
    });
  };

  return (
    <div className="space-y-6">
      <Card className="border-primary/20 bg-[radial-gradient(circle_at_top_left,rgba(13,148,136,0.14),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.10),transparent_36%)]">
        <CardContent className="p-5 md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-background/80 px-3 py-1 text-xs font-medium text-primary">
                <WandSparkles className="h-3.5 w-3.5" />
                RuangBlajar AI Question Studio
              </div>
              <div>
                <h3 className="text-xl font-semibold text-foreground">Susun draft soal yang siap ditinjau guru</h3>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Pilih konteks mengajar, bentuk asesmen, dan komposisi soal. AI akan menyusun draft yang terarah,
                  lengkap dengan kunci, pembahasan, dan indikator.
                </p>
                {contextDescription && (
                  <p className="mt-2 text-sm font-medium text-foreground/80">{contextDescription}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="gap-1.5">
                  <GraduationCap className="h-3.5 w-3.5" />
                  Fokus guru
                </Badge>
                <Badge variant="secondary" className="gap-1.5">
                  <BrainCircuit className="h-3.5 w-3.5" />
                  Kunci dan pembahasan
                </Badge>
                <Badge variant="secondary" className="gap-1.5">
                  <FileQuestion className="h-3.5 w-3.5" />
                  Siap ke bank soal / ujian
                </Badge>
              </div>
            </div>

            <div className="grid min-w-[230px] grid-cols-3 gap-2 rounded-2xl border bg-background/90 p-3">
              <div className="rounded-xl bg-muted/50 p-3 text-center">
                <p className="text-lg font-semibold">{totalSoal}</p>
                <p className="text-[11px] text-muted-foreground">Total Draft</p>
              </div>
              <div className="rounded-xl bg-muted/50 p-3 text-center">
                <p className="text-lg font-semibold">{levelKognitif.length}</p>
                <p className="text-[11px] text-muted-foreground">Level</p>
              </div>
              <div className="rounded-xl bg-muted/50 p-3 text-center">
                <p className="text-lg font-semibold">{konteksSoal.length}</p>
                <p className="text-[11px] text-muted-foreground">Konteks</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            Preset Cepat Guru
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {QUICK_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset.id)}
              className={cn(
                'rounded-2xl border p-4 text-left transition-all hover:border-primary/40 hover:bg-primary/5',
                activePreset === preset.id && 'border-primary bg-primary/5 ring-1 ring-primary/20'
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-foreground">{preset.title}</span>
                {activePreset === preset.id && <Badge className="bg-primary">Aktif</Badge>}
              </div>
              <p className="mt-2 text-sm leading-5 text-muted-foreground">{preset.description}</p>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Upload className="h-4 w-4 text-primary" />
            Materi / PDF Sumber
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.md,.png,.jpg,.jpeg,.webp"
            className="hidden"
            onChange={(e) => handlePickFile(e.target.files?.[0] || null)}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'w-full rounded-2xl border-2 border-dashed p-6 text-left transition-colors',
              isLoading
                ? 'border-primary/30 bg-primary/5'
                : 'border-muted-foreground/25 hover:border-primary/40 hover:bg-muted/30'
            )}
          >
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-muted p-3">
                {isLoading ? (
                  <LoaderCircle className="h-5 w-5 animate-spin text-primary" />
                ) : sourceFile ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                ) : (
                  <FileText className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="space-y-1">
                <p className="font-medium text-foreground">
                  {isLoading ? 'AI sedang memproses materi...' : 'Upload materi untuk dibuatkan soal'}
                </p>
                <p className="text-sm text-muted-foreground">
                  PDF paling direkomendasikan. Bisa juga TXT, Markdown, atau gambar materi. Saat generate dimulai,
                  AI akan membaca isi file ini lalu memakainya sebagai konteks pembuatan soal.
                </p>
              </div>
            </div>
          </button>

          {sourceFile && (
            <div className="rounded-2xl border bg-muted/20 p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-emerald-600">{sourceFile.name}</Badge>
                <Badge variant="secondary">{Math.round(sourceFile.size / 1024)} KB</Badge>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Status materi</p>
                <p className="text-sm text-foreground">
                  File siap dibaca AI saat tombol generate ditekan. Hasil pembacaan akan dipakai untuk menjaga soal tetap setia pada materi guru.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* MODUL 1 - Identitas Asesmen */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4 text-primary" />
            Identitas Asesmen
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="mata-pelajaran">Mata Pelajaran *</Label>
              <Input
                id="mata-pelajaran"
                placeholder="cth: Matematika, Bahasa Indonesia"
                value={mataPelajaran}
                onChange={(e) => {
                  setActivePreset(null);
                  setMataPelajaran(e.target.value);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="kelas">Kelas *</Label>
              <Select value={kelas} onValueChange={setKelas}>
                <SelectTrigger id="kelas">
                  <SelectValue placeholder="Pilih Kelas" />
                </SelectTrigger>
                <SelectContent>
                  {KELAS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="materi-pokok">Materi Pokok *</Label>
            <Textarea
              id="materi-pokok"
              placeholder="cth: Persamaan Linear Satu Variabel, Teks Narasi, Sistem Pencernaan"
              value={materiPokok}
              onChange={(e) => {
                setActivePreset(null);
                setMateriPokok(e.target.value);
              }}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bentuk-asesmen">Bentuk Asesmen</Label>
            <Select value={bentukAsesmen} onValueChange={setBentukAsesmen}>
              <SelectTrigger id="bentuk-asesmen">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BENTUK_ASESMEN_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* MODUL 3 - Desain Soal */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4 text-primary" />
            Desain Soal (Blueprint)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Jumlah Soal */}
          <div>
            <Label className="mb-3 block">Jumlah Soal per Jenis</Label>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label htmlFor="jumlah-pg" className="text-xs text-muted-foreground">
                  Pilihan Ganda
                </Label>
                <Input
                  id="jumlah-pg"
                    type="number"
                    min={0}
                    max={50}
                    value={jumlahPG}
                    onChange={(e) => {
                      setActivePreset(null);
                      setJumlahPG(Math.max(0, parseInt(e.target.value, 10) || 0));
                    }}
                  />
                </div>
                <div className="space-y-1">
                <Label htmlFor="jumlah-tf" className="text-xs text-muted-foreground">
                  True / False
                </Label>
                <Input
                  id="jumlah-tf"
                    type="number"
                    min={0}
                    max={50}
                    value={jumlahTF}
                    onChange={(e) => {
                      setActivePreset(null);
                      setJumlahTF(Math.max(0, parseInt(e.target.value, 10) || 0));
                    }}
                  />
                </div>
                <div className="space-y-1">
                <Label htmlFor="jumlah-essai" className="text-xs text-muted-foreground">
                  Esai
                </Label>
                <Input
                  id="jumlah-essai"
                    type="number"
                    min={0}
                    max={20}
                    value={jumlahEssai}
                    onChange={(e) => {
                      setActivePreset(null);
                      setJumlahEssai(Math.max(0, parseInt(e.target.value, 10) || 0));
                    }}
                  />
                </div>
              </div>
            <p className="text-xs text-muted-foreground mt-2">Total: {totalSoal} soal</p>
          </div>

          {/* Level Kognitif */}
          <div>
            <Label className="mb-3 block">Level Kognitif *</Label>
            <div className="space-y-2">
              {LEVEL_KOGNITIF_OPTIONS.map((opt) => (
                <div key={opt.value} className="flex items-start gap-2">
                  <Checkbox
                    id={`level-${opt.value}`}
                    checked={levelKognitif.includes(opt.value)}
                    onCheckedChange={(checked) => handleLevelChange(opt.value, !!checked)}
                  />
                  <div className="grid gap-0.5 leading-none">
                    <label
                      htmlFor={`level-${opt.value}`}
                      className="text-sm font-medium cursor-pointer"
                    >
                      {opt.label}
                    </label>
                    <p className="text-xs text-muted-foreground">{opt.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Konteks Soal */}
          <div>
            <Label className="mb-3 block">Konteks Soal</Label>
            <div className="grid grid-cols-2 gap-2">
              {KONTEKS_SOAL_OPTIONS.map((opt) => (
                <div key={opt.value} className="flex items-center gap-2">
                  <Checkbox
                    id={`konteks-${opt.value}`}
                    checked={konteksSoal.includes(opt.value)}
                    onCheckedChange={(checked) => handleKonteksChange(opt.value, !!checked)}
                  />
                  <label
                    htmlFor={`konteks-${opt.value}`}
                    className="text-sm cursor-pointer"
                  >
                    {opt.label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border bg-muted/20 p-4">
            <div className="flex items-start gap-3">
              <Target className="mt-0.5 h-4 w-4 text-primary" />
              <div className="space-y-1">
                <p className="text-sm font-medium">Ringkasan rancangan</p>
                <p className="text-sm text-muted-foreground">
                  {jumlahPG} pilihan ganda, {jumlahTF} true/false, {jumlahEssai} esai. {levelSummary}.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Generate Button */}
      <Button
        onClick={handleSubmit}
        disabled={!isValid || isLoading}
        className="w-full"
        size="lg"
      >
        {isLoading ? (
          <>
            <Sparkles className="h-4 w-4 mr-2 animate-pulse" />
            Sedang Generate Soal...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4 mr-2" />
            Generate Soal dengan AI
          </>
        )}
      </Button>

      {isLoading && (
        <p className="text-xs text-center text-muted-foreground">
          AI sedang menyusun soal sesuai Kurikulum Merdeka. Proses ini membutuhkan waktu 15-30 detik...
        </p>
      )}
    </div>
  );
}
