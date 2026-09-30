import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { FormDrawer } from '@/components/ui/form-drawer';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { CalendarIcon, ChevronDown, Trash2 } from 'lucide-react';

export interface Banner {
  id: string;
  judul: string;
  deskripsi: string | null;
  gambar_url: string | null;
  status: string;
  tanggal_mulai: string;
  tanggal_berakhir: string;
  target_audience: string[];
  tautan_aksi: string | null;
  created_at: string | null;
  is_permanent?: boolean;
}

export interface BannerFormData {
  judul: string;
  deskripsi: string;
  gambar_url: string;
  status: string;
  tanggal_mulai: Date | undefined;
  tanggal_berakhir: Date | undefined;
  target_audience: string[];
  tautan_aksi: string;
  is_permanent: boolean;
}

interface BannerFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  banner: Banner | null;
  onSave: (data: BannerFormData) => void;
  loading?: boolean;
}

const AUDIENCE_OPTIONS = [
  { value: 'admin', label: 'Admin', icon: '👑' },
  { value: 'guru', label: 'Guru / Wali Kelas', icon: '👨‍🏫' },
  { value: 'santri', label: 'Santri', icon: '🎓' },
  { value: 'orangtua', label: 'Orang Tua', icon: '👪' },
];

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
];

const DISPLAY_MODE_OPTIONS = [
  { value: 'permanent', label: 'Tampil Selamanya', description: 'Banner akan tampil permanen' },
  { value: 'timed', label: 'Tampil Berwaktu', description: 'Banner tampil dalam rentang waktu tertentu' },
];

// Helper function to convert Google Drive links to direct image URLs
const convertGoogleDriveUrl = (url: string): string => {
  if (!url) return url;

  // Pattern 1: https://drive.google.com/file/d/FILE_ID/view?usp=sharing
  const filePattern = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/;
  const fileMatch = url.match(filePattern);
  if (fileMatch) {
    return `https://lh3.googleusercontent.com/d/${fileMatch[1]}`;
  }

  // Pattern 2: https://drive.google.com/open?id=FILE_ID
  const openPattern = /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/;
  const openMatch = url.match(openPattern);
  if (openMatch) {
    return `https://lh3.googleusercontent.com/d/${openMatch[1]}`;
  }

  // Pattern 3: https://drive.google.com/uc?id=FILE_ID (already direct, but convert to lh3)
  const ucPattern = /drive\.google\.com\/uc\?.*id=([a-zA-Z0-9_-]+)/;
  const ucMatch = url.match(ucPattern);
  if (ucMatch) {
    return `https://lh3.googleusercontent.com/d/${ucMatch[1]}`;
  }

  // Return original URL if not a Google Drive link
  return url;
};

const getInitialFormData = (): BannerFormData => ({
  judul: '',
  deskripsi: '',
  gambar_url: '',
  status: 'draft',
  tanggal_mulai: undefined,
  tanggal_berakhir: undefined,
  target_audience: [],
  tautan_aksi: '',
  is_permanent: false,
});

export function BannerForm({ open, onOpenChange, banner, onSave, loading = false }: BannerFormProps) {
  const [formData, setFormData] = useState<BannerFormData>(getInitialFormData());

  useEffect(() => {
    if (open) {
      if (banner) {
        setFormData({
          judul: banner.judul,
          deskripsi: banner.deskripsi || '',
          gambar_url: banner.gambar_url || '',
          status: banner.status,
          tanggal_mulai: banner.tanggal_mulai ? new Date(banner.tanggal_mulai) : undefined,
          tanggal_berakhir: banner.tanggal_berakhir ? new Date(banner.tanggal_berakhir) : undefined,
          target_audience: banner.target_audience || [],
          tautan_aksi: banner.tautan_aksi || '',
          is_permanent: banner.is_permanent ?? false,
        });
      } else {
        setFormData(getInitialFormData());
      }
    }
  }, [open, banner]);

  const handleSubmit = () => {
    onSave(formData);
  };

  const toggleTargetAudience = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      target_audience: prev.target_audience.includes(value)
        ? prev.target_audience.filter((t) => t !== value)
        : [...prev.target_audience, value],
    }));
  };

  const handleImageUrlChange = (url: string) => {
    const converted = convertGoogleDriveUrl(url);
    setFormData((prev) => ({ ...prev, gambar_url: converted }));
  };

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={banner ? 'Edit Banner' : 'Tambah Banner Baru'}
      onSubmit={handleSubmit}
      loading={loading}
      submitLabel={loading ? 'Menyimpan...' : 'Simpan'}
    >
      <div className="space-y-4">
        {/* Judul */}
        <div className="space-y-2">
          <Label>Judul Banner <span className="text-destructive">*</span></Label>
          <Input
            placeholder="Masukkan judul banner"
            value={formData.judul}
            onChange={(e) => setFormData({ ...formData, judul: e.target.value })}
            className="rounded-xl"
          />
        </div>

        {/* Deskripsi */}
        <div className="space-y-2">
          <Label>Deskripsi Singkat</Label>
          <Textarea
            placeholder="Masukkan deskripsi banner"
            value={formData.deskripsi}
            onChange={(e) => setFormData({ ...formData, deskripsi: e.target.value })}
            className="rounded-xl min-h-[80px]"
            rows={3}
          />
        </div>

        {/* URL Gambar dengan Preview */}
        <div className="space-y-2">
          <Label>URL Gambar Banner</Label>
          <Input
            placeholder="https://example.com/image.jpg atau link Google Drive"
            value={formData.gambar_url}
            onChange={(e) => handleImageUrlChange(e.target.value)}
            className="rounded-xl"
          />
          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md p-2 border border-border/50">
            <span>Link Google Drive akan otomatis dikonversi ke format direct link. Pastikan file sudah di-share sebagai "Anyone with the link".</span>
          </div>
          {formData.gambar_url && (
            <div className="mt-2 relative">
              <div className="rounded-lg overflow-hidden border bg-muted aspect-video">
                <img
                  src={formData.gambar_url}
                  alt="Preview"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 h-8 w-8"
                onClick={() => setFormData((prev) => ({ ...prev, gambar_url: '' }))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Target Audience dengan Popover */}
        <div className="space-y-2">
          <Label>Target Audience <span className="text-destructive">*</span></Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full justify-between text-left font-normal h-10 rounded-xl',
                  !formData.target_audience.length && 'text-muted-foreground'
                )}
              >
                {formData.target_audience.length > 0
                  ? formData.target_audience
                      .map((aud) => {
                        const opt = AUDIENCE_OPTIONS.find((o) => o.value === aud);
                        return opt ? `${opt.icon} ${opt.label}` : aud;
                      })
                      .join(', ')
                  : 'Pilih target audience'}
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-2" align="start">
              <div className="space-y-2">
                {AUDIENCE_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-center gap-2 cursor-pointer p-2 rounded-md hover:bg-muted transition-colors"
                  >
                    <Checkbox
                      checked={formData.target_audience.includes(opt.value)}
                      onCheckedChange={() => toggleTargetAudience(opt.value)}
                    />
                    <span>{opt.icon} {opt.label}</span>
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Mode Tampilan */}
        <div className="space-y-2">
          <Label>Mode Tampilan <span className="text-destructive">*</span></Label>
          <div className="grid grid-cols-2 gap-3">
            {DISPLAY_MODE_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={cn(
                  'flex flex-col p-3 rounded-xl border-2 cursor-pointer transition-all',
                  formData.is_permanent === (opt.value === 'permanent')
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                )}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      'w-4 h-4 rounded-full border-2 flex items-center justify-center',
                      formData.is_permanent === (opt.value === 'permanent')
                        ? 'border-primary'
                        : 'border-muted-foreground'
                    )}
                  >
                    {formData.is_permanent === (opt.value === 'permanent') && (
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    )}
                  </div>
                  <span className="font-medium text-sm">{opt.label}</span>
                </div>
                <span className="text-xs text-muted-foreground mt-1 ml-6">{opt.description}</span>
                <input
                  type="radio"
                  name="display_mode"
                  value={opt.value}
                  checked={formData.is_permanent === (opt.value === 'permanent')}
                  onChange={() => setFormData((prev) => ({ ...prev, is_permanent: opt.value === 'permanent' }))}
                  className="sr-only"
                />
              </label>
            ))}
          </div>
        </div>

        {/* Tanggal Mulai & Berakhir - hanya tampil jika berwaktu */}
        {!formData.is_permanent && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-muted/30 border border-border/50">
            <div className="space-y-2">
              <Label>Tanggal Mulai <span className="text-destructive">*</span></Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal rounded-xl',
                      !formData.tanggal_mulai && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.tanggal_mulai
                      ? format(formData.tanggal_mulai, 'PPP', { locale: localeId })
                      : 'Pilih tanggal'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.tanggal_mulai}
                    onSelect={(date) => setFormData((prev) => ({ ...prev, tanggal_mulai: date }))}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Tanggal Berakhir <span className="text-destructive">*</span></Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal rounded-xl',
                      !formData.tanggal_berakhir && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.tanggal_berakhir
                      ? format(formData.tanggal_berakhir, 'PPP', { locale: localeId })
                      : 'Pilih tanggal'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.tanggal_berakhir}
                    onSelect={(date) => setFormData((prev) => ({ ...prev, tanggal_berakhir: date }))}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        )}

        {/* Status */}
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
            <SelectTrigger className="rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tautan Aksi */}
        <div className="space-y-2">
          <Label>Tautan Aksi (Opsional)</Label>
          <Input
            placeholder="https://example.com/info"
            value={formData.tautan_aksi}
            onChange={(e) => setFormData({ ...formData, tautan_aksi: e.target.value })}
            className="rounded-xl"
          />
        </div>
      </div>
    </FormDrawer>
  );
}

export default BannerForm;
