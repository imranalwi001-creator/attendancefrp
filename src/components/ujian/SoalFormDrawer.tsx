import { useState, useEffect, useMemo } from 'react';
import { ImagePlus, X, Check, AlertCircle } from 'lucide-react';
import { FormDrawer } from '@/components/ui/form-drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { JENIS_SOAL_OPTIONS, OPSI_LABELS, type JenisSoal } from '@/lib/ujianUtils';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { UjianSoal, UjianSoalOpsi } from '@/hooks/useUjian';
import { supabase } from '@/integrations/supabase/client';

interface SoalFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  soal?: UjianSoal | null;
  nomorUrut: number;
  onSubmit: (data: {
    jenis_soal: string;
    pertanyaan: string;
    gambar_pertanyaan?: string;
    pembahasan?: string;
    gambar_pembahasan?: string;
    bobot_nilai: number;
    kunci_jawaban?: string;
    opsi?: Array<{
      label: string;
      teks: string;
      gambar?: string;
      is_kunci: boolean;
    }>;
  }) => void;
  loading?: boolean;
}

interface OpsiState {
  label: string;
  teks: string;
  gambar: string;
  is_kunci: boolean;
}

export function SoalFormDrawer({
  open,
  onOpenChange,
  soal,
  nomorUrut,
  onSubmit,
  loading,
}: SoalFormDrawerProps) {
  const [jenisSoal, setJenisSoal] = useState<JenisSoal>('pilihan_ganda');
  const [pertanyaan, setPertanyaan] = useState('');
  const [gambarPertanyaan, setGambarPertanyaan] = useState('');
  const [pembahasan, setPembahasan] = useState('');
  const [gambarPembahasan, setGambarPembahasan] = useState('');
  const [bobotNilai, setBobotNilai] = useState(1);
  const [kunciJawaban, setKunciJawaban] = useState('');
  const [trueFalseKunci, setTrueFalseKunci] = useState<'benar' | 'salah' | ''>('');
  const [opsiList, setOpsiList] = useState<OpsiState[]>(
    OPSI_LABELS.map((label) => ({
      label,
      teks: '',
      gambar: '',
      is_kunci: false,
    }))
  );

  useEffect(() => {
    if (soal) {
      setJenisSoal(soal.jenis_soal);
      setPertanyaan(soal.pertanyaan);
      setGambarPertanyaan(soal.gambar_pertanyaan || '');
      setPembahasan(soal.pembahasan || '');
      setGambarPembahasan(soal.gambar_pembahasan || '');
      setBobotNilai(soal.bobot_nilai);
      setKunciJawaban(soal.kunci_jawaban || '');

      if (soal.jenis_soal === 'true_false') {
        setTrueFalseKunci((soal.kunci_jawaban as 'benar' | 'salah') || '');
      }

      if (soal.opsi && soal.opsi.length > 0) {
        const newOpsi = OPSI_LABELS.map((label) => {
          const existing = soal.opsi?.find((o) => o.label === label);
          return {
            label,
            teks: existing?.teks || '',
            gambar: existing?.gambar || '',
            is_kunci: existing?.is_kunci || false,
          };
        });
        setOpsiList(newOpsi);
      }
    } else {
      // Reset form
      setJenisSoal('pilihan_ganda');
      setPertanyaan('');
      setGambarPertanyaan('');
      setPembahasan('');
      setGambarPembahasan('');
      setBobotNilai(1);
      setKunciJawaban('');
      setTrueFalseKunci('');
      setOpsiList(
        OPSI_LABELS.map((label) => ({
          label,
          teks: '',
          gambar: '',
          is_kunci: false,
        }))
      );
    }
  }, [soal, open]);

  const handleImageUpload = async (file: File) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
    const filePath = `soal-images/${fileName}`;

    const { data, error } = await supabase.storage
      .from('materi-images')
      .upload(filePath, file);

    if (error) {
      toast.error('Gagal mengupload gambar: ' + error.message);
      throw error;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('materi-images')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const handleOpsiChange = (index: number, field: keyof OpsiState, value: string | boolean) => {
    setOpsiList((prev) =>
      prev.map((opsi, i) => {
        if (i === index) {
          return { ...opsi, [field]: value };
        }
        // If setting is_kunci to true, clear others
        if (field === 'is_kunci' && value === true) {
          return { ...opsi, is_kunci: false };
        }
        return opsi;
      })
    );
  };

  const handleSetKunci = (index: number) => {
    setOpsiList((prev) =>
      prev.map((opsi, i) => ({
        ...opsi,
        is_kunci: i === index,
      }))
    );
  };

  // Validation state
  const validation = useMemo(() => {
    const errors: string[] = [];
    
    if (!pertanyaan.trim()) {
      errors.push('Pertanyaan harus diisi');
    }
    
    if (jenisSoal === 'pilihan_ganda') {
      const filledOpsi = opsiList.filter((o) => o.teks.trim() !== '');
      if (filledOpsi.length < 2) {
        errors.push('Minimal 2 opsi jawaban harus diisi');
      }
      const hasKunci = opsiList.some((o) => o.is_kunci && o.teks.trim() !== '');
      if (!hasKunci) {
        errors.push('Pilih salah satu opsi sebagai kunci jawaban');
      }
    }
    
    if (jenisSoal === 'true_false' && !trueFalseKunci) {
      errors.push('Pilih kunci jawaban (Benar/Salah)');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
    };
  }, [pertanyaan, jenisSoal, opsiList, trueFalseKunci]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate before submit
    if (!validation.isValid) {
      validation.errors.forEach((err) => toast.error(err));
      return;
    }

    let finalKunci = kunciJawaban;
    let finalOpsi: typeof opsiList | undefined;

    if (jenisSoal === 'pilihan_ganda') {
      finalOpsi = opsiList.filter((o) => o.teks.trim() !== '');
      finalKunci = undefined;
    } else if (jenisSoal === 'true_false') {
      finalKunci = trueFalseKunci;
      finalOpsi = undefined;
    } else {
      finalOpsi = undefined;
    }

    onSubmit({
      jenis_soal: jenisSoal,
      pertanyaan,
      gambar_pertanyaan: gambarPertanyaan || undefined,
      pembahasan: pembahasan || undefined,
      gambar_pembahasan: gambarPembahasan || undefined,
      bobot_nilai: bobotNilai,
      kunci_jawaban: finalKunci || undefined,
      opsi: finalOpsi,
    });
  };

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={soal ? `Edit Soal #${nomorUrut}` : `Tambah Soal #${nomorUrut}`}
      onSubmit={handleSubmit}
      submitLabel={soal ? 'Simpan Perubahan' : 'Tambah Soal'}
      loading={loading}
    >
      <div className="space-y-6">
        {/* Section 1: Info Dasar */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-semibold text-foreground mb-4 uppercase tracking-wide">Informasi Soal</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">
                Jenis Soal <span className="text-destructive">*</span>
              </Label>
              <Select value={jenisSoal} onValueChange={(v) => setJenisSoal(v as JenisSoal)}>
                <SelectTrigger className="text-sm bg-muted/50 border-input hover:bg-muted focus:bg-background">
                  <SelectValue placeholder="Pilih jenis soal" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border shadow-lg">
                  {JENIS_SOAL_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-sm">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">
                Bobot Nilai <span className="text-destructive">*</span>
              </Label>
              <Input
                type="number"
                min={0}
                step={0.5}
                value={bobotNilai}
                onChange={(e) => setBobotNilai(parseFloat(e.target.value) || 0)}
                className="text-sm bg-muted/50 border-input hover:bg-muted focus:bg-background"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Konten Soal */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-semibold text-foreground mb-4 uppercase tracking-wide">Pertanyaan <span className="text-destructive">*</span></p>
          <div className="space-y-3">
            <div className="rounded-lg border border-input bg-muted/30 overflow-hidden">
              <RichTextEditor
                value={pertanyaan}
                onChange={setPertanyaan}
                placeholder="Tulis pertanyaan di sini..."
                className="border-0 bg-transparent"
                onImageUpload={handleImageUpload}
              />
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={gambarPertanyaan}
                onChange={(e) => setGambarPertanyaan(e.target.value)}
                placeholder="URL gambar pertanyaan (opsional)"
                className="text-sm flex-1 bg-muted/50 border-input hover:bg-muted focus:bg-background"
              />
              <Button type="button" variant="outline" size="icon" className="shrink-0 bg-muted/50 hover:bg-muted border-input">
                <ImagePlus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Section 3: Input Jawaban (Dynamic) */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-4">
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide">
              {jenisSoal === 'pilihan_ganda' && 'Opsi Jawaban'}
              {jenisSoal === 'true_false' && 'Kunci Jawaban'}
              {jenisSoal === 'essai' && 'Kunci Jawaban / Poin Penting'}
            </p>
            {jenisSoal === 'pilihan_ganda' && (
              <p className="text-xs text-muted-foreground mt-1">
                Klik huruf opsi untuk menandai sebagai kunci jawaban
              </p>
            )}
          </div>

          {jenisSoal === 'pilihan_ganda' && (
            <div className="space-y-3">
              {opsiList.map((opsi, index) => (
                <div
                  key={opsi.label}
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-xl border-2 transition-all',
                    opsi.is_kunci 
                      ? 'border-primary bg-primary/5 shadow-md shadow-primary/10' 
                      : 'border-input bg-muted/30 hover:border-muted-foreground/30'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => handleSetKunci(index)}
                    title={opsi.is_kunci ? 'Ini adalah kunci jawaban' : 'Klik untuk jadikan kunci jawaban'}
                    className={cn(
                      'mt-1 flex items-center justify-center w-9 h-9 rounded-full border-2 text-sm font-bold transition-all cursor-pointer',
                      opsi.is_kunci
                        ? 'border-primary bg-primary text-primary-foreground shadow-md'
                        : 'border-muted-foreground/40 text-muted-foreground bg-background hover:border-primary hover:bg-primary/10 hover:text-primary'
                    )}
                  >
                    {opsi.is_kunci ? <Check className="h-4 w-4" /> : opsi.label}
                  </button>

                  <div className="flex-1 space-y-2">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 rounded-lg border border-input bg-muted/10 overflow-hidden">
                        <RichTextEditor
                          value={opsi.teks}
                          onChange={(val) => handleOpsiChange(index, 'teks', val)}
                          placeholder={`Jawaban opsi ${opsi.label}...`}
                          className="border-0 bg-transparent"
                          minHeight="100px"
                          onImageUpload={handleImageUpload}
                        />
                      </div>
                      {opsi.is_kunci && (
                        <span className="mt-2 shrink-0 text-[10px] font-semibold text-primary bg-primary/15 px-2.5 py-1 rounded-full whitespace-nowrap">
                          🔑 Kunci
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {jenisSoal === 'true_false' && (
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setTrueFalseKunci('benar')}
                className={cn(
                  'flex-1 py-6 rounded-xl border-2 font-semibold text-lg transition-all',
                  trueFalseKunci === 'benar'
                    ? 'border-primary bg-primary/10 text-primary shadow-md shadow-primary/20'
                    : 'border-input bg-muted/30 text-muted-foreground hover:border-primary/50 hover:bg-muted/50'
                )}
              >
                <Check className="h-6 w-6 mx-auto mb-2" />
                BENAR
              </button>
              <button
                type="button"
                onClick={() => setTrueFalseKunci('salah')}
                className={cn(
                  'flex-1 py-6 rounded-xl border-2 font-semibold text-lg transition-all',
                  trueFalseKunci === 'salah'
                    ? 'border-destructive bg-destructive/10 text-destructive shadow-md shadow-destructive/20'
                    : 'border-input bg-muted/30 text-muted-foreground hover:border-destructive/50 hover:bg-muted/50'
                )}
              >
                <X className="h-6 w-6 mx-auto mb-2" />
                SALAH
              </button>
            </div>
          )}

          {jenisSoal === 'essai' && (
            <Textarea
              value={kunciJawaban}
              onChange={(e) => setKunciJawaban(e.target.value)}
              placeholder="Tulis poin-poin penting atau kunci jawaban untuk referensi penilaian..."
              rows={5}
              className="text-sm bg-muted/50 border-input hover:bg-muted focus:bg-background"
            />
          )}
        </div>

        {/* Section 4: Pembahasan */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-semibold text-foreground mb-4 uppercase tracking-wide">Pembahasan <span className="text-muted-foreground font-normal normal-case">(Opsional)</span></p>
          <div className="space-y-3">
            <div className="rounded-lg border border-input bg-muted/30 overflow-hidden">
              <RichTextEditor
                value={pembahasan}
                onChange={setPembahasan}
                placeholder="Tulis pembahasan untuk ditampilkan setelah ujian..."
                className="border-0 bg-transparent"
                onImageUpload={handleImageUpload}
              />
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={gambarPembahasan}
                onChange={(e) => setGambarPembahasan(e.target.value)}
                placeholder="URL gambar pembahasan (opsional)"
                className="text-sm flex-1 bg-muted/50 border-input hover:bg-muted focus:bg-background"
              />
              <Button type="button" variant="outline" size="icon" className="shrink-0 bg-muted/50 hover:bg-muted border-input">
                <ImagePlus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </FormDrawer>
  );
}

export default SoalFormDrawer;
