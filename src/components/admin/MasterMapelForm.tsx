import { useEffect, useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import FormDrawer from '@/components/ui/form-drawer';

export interface MasterMapel {
  id: string;
  nama: string;
  kategori: 'wajib' | 'pilihan' | 'ekstrakurikuler' | 'asrama';
  deskripsi: string | null;
  created_at: string;
  updated_at: string;
}

interface MasterMapelFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Omit<MasterMapel, 'id' | 'created_at' | 'updated_at'>) => void;
  initialData?: MasterMapel | null;
  loading?: boolean;
}

const KATEGORI_OPTIONS = [
  { value: 'wajib', label: 'Wajib' },
  { value: 'pilihan', label: 'Pilihan' },
  { value: 'ekstrakurikuler', label: 'Ekstrakurikuler' },
  { value: 'asrama', label: 'Asrama' },
] as const;

export default function MasterMapelForm({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  loading = false,
}: MasterMapelFormProps) {
  const { toast } = useToast();
  const [nama, setNama] = useState('');
  const [kategori, setKategori] = useState<MasterMapel['kategori']>('wajib');
  const [deskripsi, setDeskripsi] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (initialData) {
      setNama(initialData.nama);
      setKategori(initialData.kategori);
      setDeskripsi(initialData.deskripsi || '');
    } else {
      setNama('');
      setKategori('wajib');
      setDeskripsi('');
    }
  }, [initialData, open]);

  const handleGenerateWithAI = async () => {
    if (!nama.trim()) {
      toast({
        title: 'Error',
        description: 'Masukkan nama mata pelajaran terlebih dahulu',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-mapel', {
        body: { nama: nama.trim(), kategori },
      });

      if (error) {
        console.error('Error generating deskripsi:', error);
        let msg = error.message || 'Gagal generate dengan AI';
        const ctx = (error as any)?.context;
        if (ctx) {
          const raw = await ctx.text();
          try {
            const parsed = JSON.parse(raw);
            msg = parsed?.error || parsed?.message || msg;
          } catch {
            msg = raw || msg;
          }
        }
        throw new Error(msg);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      if (data?.deskripsi) {
        setDeskripsi(data.deskripsi);
      }

      toast({
        title: 'Berhasil',
        description: 'Deskripsi berhasil di-generate dengan AI',
      });
    } catch (error) {
      console.error('Error generating with AI:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Gagal generate dengan AI',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmit = () => {
    if (!nama.trim()) return;

    onSubmit({
      nama: nama.trim(),
      kategori,
      deskripsi: deskripsi.trim() || null,
    });
  };

  const isValid = nama.trim().length > 0;

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={initialData ? 'Edit Mata Pelajaran' : 'Tambah Mata Pelajaran'}
      onSubmit={handleSubmit}
      submitLabel={initialData ? 'Simpan Perubahan' : 'Tambah'}
      loading={loading}
      showFooter={true}
      footerContent={
        <div className="flex gap-2 w-full">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
          >
            Batal
          </Button>
          <Button
            type="submit"
            className="flex-1"
            disabled={!isValid || loading}
            onClick={handleSubmit}
          >
            {loading ? 'Menyimpan...' : initialData ? 'Simpan' : 'Tambah'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Nama */}
        <div className="space-y-2">
          <Label htmlFor="nama">Nama Mata Pelajaran *</Label>
          <Input
            id="nama"
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            placeholder="Contoh: Fiqih, Nahwu Shorof, Tahfidz"
            disabled={loading || isGenerating}
          />
        </div>

        {/* Kategori */}
        <div className="space-y-2">
          <Label htmlFor="kategori">Kategori *</Label>
          <Select
            value={kategori}
            onValueChange={(value) => setKategori(value as MasterMapel['kategori'])}
            disabled={loading || isGenerating}
          >
            <SelectTrigger id="kategori">
              <SelectValue placeholder="Pilih kategori" />
            </SelectTrigger>
            <SelectContent>
              {KATEGORI_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Deskripsi with AI Button */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="deskripsi">Deskripsi</Label>
            {!initialData && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={handleGenerateWithAI}
                disabled={isGenerating || loading || !nama.trim()}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3 w-3" />
                    Generate dengan AI
                  </>
                )}
              </Button>
            )}
          </div>
          <Textarea
            id="deskripsi"
            value={deskripsi}
            onChange={(e) => setDeskripsi(e.target.value)}
            placeholder="Deskripsi singkat mata pelajaran (opsional)"
            rows={3}
            disabled={loading || isGenerating}
          />
        </div>
      </div>
    </FormDrawer>
  );
}
