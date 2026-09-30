import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BANK_LIST, getBankIcon } from '@/lib/bankList';
import { Switch } from '@/components/ui/switch';
import { FormDrawer } from '@/components/ui/form-drawer';
import type { MetodePembayaran, MetodePembayaranInput } from '@/hooks/useTagihan';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: MetodePembayaranInput) => void;
  loading?: boolean;
  initial?: MetodePembayaran | null;
}

export function MetodePembayaranForm({ open, onOpenChange, onSubmit, loading, initial }: Props) {
  const [namaBank, setNamaBank] = useState('');
  const [nomorRekening, setNomorRekening] = useState('');
  const [atasNama, setAtasNama] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [petunjuk, setPetunjuk] = useState('');

  useEffect(() => {
    if (initial) {
      setNamaBank(initial.nama_bank);
      setNomorRekening(initial.nomor_rekening);
      setAtasNama(initial.atas_nama);
      setIsActive(initial.is_active);
      setPetunjuk(initial.petunjuk || '');
    } else {
      setNamaBank('');
      setNomorRekening('');
      setAtasNama('');
      setIsActive(true);
      setPetunjuk('');
    }
  }, [initial, open]);

  const handleSubmit = () => {
    if (!namaBank.trim() || !nomorRekening.trim() || !atasNama.trim()) return;
    onSubmit({ nama_bank: namaBank.trim(), nomor_rekening: nomorRekening.trim(), atas_nama: atasNama.trim(), is_active: isActive, petunjuk: petunjuk.trim() || null });
  };

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={initial ? 'Edit Metode Pembayaran' : 'Tambah Metode Pembayaran'}
      onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}
      loading={loading}
    >
      <div className="space-y-4">
        {/* Section 1: Informasi Bank */}
        <div className="rounded-2xl border border-border/50 bg-card p-4 space-y-3 shadow-[var(--shadow-sm)]">
          <div className="flex items-center gap-2.5">
            <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center">
              <span className="text-[11px] font-bold text-primary">1</span>
            </div>
            <span className="text-sm font-semibold text-foreground">Informasi Bank</span>
          </div>

          <div className="space-y-3.5">
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
                Nama Bank
              </Label>
              <Select value={namaBank} onValueChange={setNamaBank}>
                <SelectTrigger className="bg-card border-border/60 focus:border-primary/50">
                  {namaBank ? (
                    <div className="flex items-center gap-2">
                      {getBankIcon(namaBank) && <img src={getBankIcon(namaBank)} alt="" className="h-5 w-5 rounded-full object-cover" />}
                      <span>{namaBank}</span>
                    </div>
                  ) : (
                    <SelectValue placeholder="Pilih bank..." />
                  )}
                </SelectTrigger>
                <SelectContent>
                  {BANK_LIST.map((bank) => (
                    <SelectItem key={bank.value} value={bank.value}>
                      <div className="flex items-center gap-2">
                        <img src={bank.icon} alt="" className="h-5 w-5 rounded-full object-cover" />
                        <span>{bank.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-x-3 gap-y-3.5">
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
                  Nomor Rekening
                </Label>
                <Input
                  value={nomorRekening}
                  onChange={(e) => setNomorRekening(e.target.value)}
                  placeholder="1234567890"
                  className="bg-card border-border/60 focus:border-primary/50 font-mono"
                  inputMode="numeric"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
                  Atas Nama
                </Label>
                <Input
                  value={atasNama}
                  onChange={(e) => setAtasNama(e.target.value)}
                  placeholder="Nama pemilik rekening"
                  className="bg-card border-border/60 focus:border-primary/50"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
                Petunjuk Pembayaran <span className="normal-case text-muted-foreground/60">(opsional)</span>
              </Label>
              <Textarea
                value={petunjuk}
                onChange={(e) => setPetunjuk(e.target.value)}
                placeholder="Contoh: Transfer sebelum jam 15.00 WIB agar diproses hari yang sama"
                className="bg-card border-border/60 focus:border-primary/50 min-h-[80px] resize-none"
                rows={3}
              />
            </div>
          </div>
        </div>

        {/* Section 2: Pengaturan */}
        <div className="rounded-2xl border border-border/50 bg-card p-4 space-y-3 shadow-[var(--shadow-sm)]">
          <div className="flex items-center gap-2.5">
            <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center">
              <span className="text-[11px] font-bold text-primary">2</span>
            </div>
            <span className="text-sm font-semibold text-foreground">Pengaturan</span>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">Status Aktif</p>
              <p className="text-[11px] text-muted-foreground">Tampilkan sebagai opsi transfer</p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>
      </div>
    </FormDrawer>
  );
}