import { useState, useEffect } from 'react';
import { FormDrawer } from '@/components/ui/form-drawer';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

const EXCUSE_OPTIONS = [
  { value: 'Haid', label: 'Haid' },
  { value: 'Izin', label: 'Izin' },
  { value: 'Tidak Enak Badan', label: 'Tidak Enak Badan' },
  { value: 'Lainnya', label: 'Lainnya' },
];

interface ExcuseDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activityTitle: string;
  initialValue?: string;
  onSave: (reason: string) => void;
}

export function ExcuseDrawer({ open, onOpenChange, activityTitle, initialValue, onSave }: ExcuseDrawerProps) {
  const [selected, setSelected] = useState('');
  const [customReason, setCustomReason] = useState('');

  useEffect(() => {
    if (open) {
      if (initialValue) {
        const isPreset = EXCUSE_OPTIONS.some((o) => o.value === initialValue);
        if (isPreset) {
          setSelected(initialValue);
          setCustomReason('');
        } else {
          setSelected('Lainnya');
          setCustomReason(initialValue);
        }
      } else {
        setSelected('');
        setCustomReason('');
      }
    }
  }, [open, initialValue]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const reason = selected === 'Lainnya' ? customReason.trim() : selected;
    if (reason) {
      onSave(reason);
      onOpenChange(false);
    }
  };

  const isValid = selected === 'Lainnya' ? customReason.trim().length > 0 : selected.length > 0;

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Alasan?"
      description={activityTitle}
      onSubmit={handleSubmit}
      submitLabel="Simpan"
      loading={false}
      hideSubmit={!isValid}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Pilih Alasan</Label>
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger>
              <SelectValue placeholder="Pilih alasan..." />
            </SelectTrigger>
            <SelectContent>
              {EXCUSE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selected === 'Lainnya' && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Jelaskan alasannya</Label>
            <Textarea
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder="Masukkan alasan..."
              rows={3}
            />
          </div>
        )}
      </div>
    </FormDrawer>
  );
}
