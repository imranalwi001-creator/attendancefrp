import { useState, useEffect, useMemo } from 'react';
import { Search, Plus, Trash2, CheckCircle2, CalendarIcon } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FormDrawer } from '@/components/ui/form-drawer';
import { useKelasList, useSantriByKelas, type TagihanInput } from '@/hooks/useTagihan';
import { useAcademicYear } from '@/contexts/AcademicYearContext';

interface LineItem {
  nama: string;
  jumlah: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: TagihanInput) => void;
  loading?: boolean;
}

export function TagihanForm({ open, onOpenChange, onSubmit, loading }: Props) {
  const [kelasId, setKelasId] = useState<string>('');
  const [namaTagihan, setNamaTagihan] = useState('');
  const [semester, setSemester] = useState('');
  const [jumlah, setJumlah] = useState('');

  const formatThousand = (val: string) => {
    const num = val.replace(/\D/g, '');
    return num ? Number(num).toLocaleString('id-ID') : '';
  };
  const parseThousand = (val: string) => val.replace(/\./g, '');
  const [jatuhTempo, setJatuhTempo] = useState('');
  const [catatan, setCatatan] = useState('');
  const [isSplit, setIsSplit] = useState(false);
  const [lineItems, setLineItems] = useState<LineItem[]>([{ nama: '', jumlah: '' }]);
  const [bulkAll, setBulkAll] = useState(true);
  const [selectedSantri, setSelectedSantri] = useState<string[]>([]);
  const { activeAcademicYear } = useAcademicYear();
  const { data: kelasList } = useKelasList(activeAcademicYear?.name);
  const { data: santriByKelas } = useSantriByKelas(kelasId || null);

  const semesterOptions = useMemo(() => {
    if (!activeAcademicYear) return [];
    return [
      { value: `Ganjil ${activeAcademicYear.name}`, label: `Ganjil ${activeAcademicYear.name}` },
      { value: `Genap ${activeAcademicYear.name}`, label: `Genap ${activeAcademicYear.name}` },
    ];
  }, [activeAcademicYear]);

  const totalLineItems = useMemo(() => {
    return lineItems.reduce((sum, item) => sum + (Number(item.jumlah) || 0), 0);
  }, [lineItems]);

  useEffect(() => {
    if (open) {
      setKelasId('');
      setNamaTagihan('');
      setSemester('');
      setJumlah('');
      setJatuhTempo('');
      setCatatan('');
      setIsSplit(false);
      setLineItems([{ nama: '', jumlah: '' }]);
      setBulkAll(true);
      setSelectedSantri([]);
    }
  }, [open]);

  useEffect(() => {
    if (santriByKelas && santriByKelas.length > 0 && bulkAll) {
      setSelectedSantri(santriByKelas.map((s) => s.id));
    }
  }, [santriByKelas, bulkAll]);

  useEffect(() => {
    setBulkAll(true);
  }, [kelasId]);

  const toggleSantri = (id: string) => {
    setSelectedSantri((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
    setBulkAll(false);
  };

  const addLineItem = () => setLineItems((prev) => [...prev, { nama: '', jumlah: '' }]);
  const removeLineItem = (idx: number) => setLineItems((prev) => prev.filter((_, i) => i !== idx));
  const updateLineItem = (idx: number, field: keyof LineItem, value: string) => {
    setLineItems((prev) => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const handleSubmit = () => {
    const validationErrors: string[] = [];

    if (!kelasId) validationErrors.push('Kelas belum dipilih');
    if (selectedSantri.length === 0) validationErrors.push('Belum ada santri yang dipilih');
    if (!namaTagihan.trim()) validationErrors.push('Nama tagihan harus diisi');
    if (!semester) validationErrors.push('Semester belum dipilih');
    if (!jatuhTempo) validationErrors.push('Batas bayar belum ditentukan');

    if (isSplit) {
      const validItems = lineItems.filter((item) => item.nama.trim() && Number(item.jumlah) > 0);
      if (validItems.length === 0) validationErrors.push('Minimal satu item rincian harus diisi lengkap');
    } else {
      if (!jumlah || Number(jumlah) <= 0) validationErrors.push('Jumlah tagihan harus diisi');
    }

    if (validationErrors.length > 0) {
      toast.error('Form belum lengkap', {
        description: validationErrors.join(', '),
      });
      return;
    }

    const validItems = isSplit
      ? lineItems.filter((item) => item.nama.trim() && Number(item.jumlah) > 0).map((item) => ({ nama: item.nama.trim(), jumlah: Number(item.jumlah) }))
      : undefined;

    const finalJumlah = isSplit ? totalLineItems : Number(jumlah);

    const input: TagihanInput = {
      kelas_id: kelasId,
      nama_tagihan: namaTagihan.trim(),
      semester,
      jumlah: finalJumlah,
      jatuh_tempo: jatuhTempo,
      is_split: isSplit,
      catatan_admin: catatan.trim() || undefined,
      items: validItems,
      santri_ids: selectedSantri,
    };
    onSubmit(input);
  };

  function formatRupiah(n: number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Buat Tagihan Baru"
      onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}
      submitLabel={`Buat Tagihan (${selectedSantri.length} santri)`}
      loading={loading}
    >
      <div className="space-y-4">
        {/* Section 1: Pilih Kelas */}
        <FormSection step={1} title="Pilih Kelas">
          <Select value={kelasId} onValueChange={setKelasId}>
            <SelectTrigger className="bg-card border-border/60 focus:border-primary/50">
              <SelectValue placeholder="Pilih kelas..." />
            </SelectTrigger>
            <SelectContent>
              {(kelasList || []).map((k) => (
                <SelectItem key={k.id} value={k.id}>{k.nama} — {k.tahun_ajaran}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormSection>

        {/* Section 2: Pilih Santri */}
        {kelasId && (
          <FormSection step={2} title="Pilih Santri" trailing={
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">Pilih Semua</span>
              <Switch
                checked={bulkAll}
                onCheckedChange={(checked) => {
                  setBulkAll(checked);
                  if (checked && santriByKelas) setSelectedSantri(santriByKelas.map((s) => s.id));
                }}
              />
            </div>
          }>
            <ScrollArea className="max-h-44 rounded-xl border border-border/60 bg-card">
              <div className="p-1 space-y-px">
                {(santriByKelas || []).map((s) => {
                  const isSelected = selectedSantri.includes(s.id);
                  return (
                    <label
                      key={s.id}
                      className={`flex items-center gap-2.5 cursor-pointer py-2 px-3 rounded-lg transition-all duration-150 ${
                        isSelected
                          ? 'bg-primary/5 border border-primary/15'
                          : 'border border-transparent hover:bg-muted/40'
                      }`}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSantri(s.id)}
                        className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                      />
                      <span className={`text-sm flex-1 truncate ${isSelected ? 'font-medium text-foreground' : 'text-foreground/80'}`}>
                        {s.name}
                      </span>
                    </label>
                  );
                })}
                {(santriByKelas || []).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">Tidak ada santri</p>
                )}
              </div>
            </ScrollArea>

            {selectedSantri.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-primary">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span className="font-medium">{selectedSantri.length}</span>
                <span className="text-muted-foreground">santri dipilih</span>
              </div>
            )}
          </FormSection>
        )}

        {/* Section 3: Detail Tagihan */}
        <FormSection step={kelasId ? 3 : 2} title="Detail Tagihan">
          <div className="grid grid-cols-2 gap-x-3 gap-y-3.5">
            <FieldGroup label="Nama Tagihan">
              <Input value={namaTagihan} onChange={(e) => setNamaTagihan(e.target.value)} placeholder="SPP Maret 2026" className="bg-card border-border/60 focus:border-primary/50" required />
            </FieldGroup>
            <FieldGroup label="Semester">
              <Select value={semester} onValueChange={setSemester}>
                <SelectTrigger className="bg-card border-border/60 focus:border-primary/50">
                  <SelectValue placeholder="Pilih semester..." />
                </SelectTrigger>
                <SelectContent>
                  {semesterOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldGroup>
            <div className="col-span-2">
              <FieldGroup label="Batas Bayar">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal bg-card border-border/60",
                        !jatuhTempo && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {jatuhTempo ? format(new Date(jatuhTempo), "dd MMMM yyyy") : "Pilih tanggal..."}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={jatuhTempo ? new Date(jatuhTempo) : undefined}
                      onSelect={(date) => setJatuhTempo(date ? format(date, "yyyy-MM-dd") : '')}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </FieldGroup>
            </div>
          </div>

          {/* Split toggle */}
          <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">Pecah menjadi item-item?</p>
              <p className="text-[11px] text-muted-foreground">Rincian tagihan per komponen</p>
            </div>
            <Switch checked={isSplit} onCheckedChange={setIsSplit} />
          </div>

          {!isSplit ? (
          <FieldGroup label="Jumlah Tagihan (Rp)">
              <Input value={formatThousand(jumlah)} onChange={(e) => setJumlah(parseThousand(e.target.value))} placeholder="500.000" className="bg-card border-border/60 focus:border-primary/50 font-mono" required inputMode="numeric" />
            </FieldGroup>
          ) : (
            <div className="space-y-2">
              {lineItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    value={item.nama}
                    onChange={(e) => updateLineItem(idx, 'nama', e.target.value)}
                    placeholder="Nama item"
                    className="bg-card border-border/60 focus:border-primary/50 flex-1"
                  />
                  <Input
                    value={formatThousand(item.jumlah)}
                    onChange={(e) => updateLineItem(idx, 'jumlah', parseThousand(e.target.value))}
                    placeholder="Jumlah"
                    className="bg-card border-border/60 focus:border-primary/50 font-mono w-32"
                    inputMode="numeric"
                  />
                  {lineItems.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => removeLineItem(idx)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" className="rounded-xl w-full" onClick={addLineItem}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Tambah Item
              </Button>
              {totalLineItems > 0 && (
                <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 px-3 py-2">
                  <span className="text-sm font-medium">Total</span>
                  <span className="font-mono font-bold text-primary">{formatRupiah(totalLineItems)}</span>
                </div>
              )}
            </div>
          )}

          <FieldGroup label="Catatan (opsional)">
            <Input value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="Info tambahan untuk orangtua" className="bg-card border-border/60 focus:border-primary/50" />
          </FieldGroup>
        </FormSection>
      </div>
    </FormDrawer>
  );
}

/* ---------- Sub-components ---------- */

function FormSection({ step, title, trailing, children }: {
  step: number;
  title: string;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/50 bg-card p-4 space-y-3 shadow-[var(--shadow-sm)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center">
            <span className="text-[11px] font-bold text-primary">{step}</span>
          </div>
          <span className="text-sm font-semibold text-foreground">{title}</span>
        </div>
        {trailing}
      </div>
      {children}
    </div>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
        {label}
      </Label>
      {children}
    </div>
  );
}
