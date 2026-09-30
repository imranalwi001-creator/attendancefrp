import { useState, useEffect } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { ChevronDown } from 'lucide-react';
import { quranSurahList } from '@/data/quranSurahList';

interface SurahAyatPickerProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

function parseSurahAyat(value: string): { surahNumber: number | null; ayat: string } {
  if (!value) return { surahNumber: null, ayat: '' };
  const surah = quranSurahList.find((s) => value.startsWith(s.name));
  if (!surah) return { surahNumber: null, ayat: '' };
  const ayatMatch = value.match(/ayat\s+(\d+)/i);
  return { surahNumber: surah.number, ayat: ayatMatch ? ayatMatch[1] : '' };
}

export function SurahAyatPicker({ value, onChange, disabled, placeholder = 'Pilih surah & ayat' }: SurahAyatPickerProps) {
  const parsed = parseSurahAyat(value);
  const [selectedSurah, setSelectedSurah] = useState<number | null>(parsed.surahNumber);
  const [selectedAyat, setSelectedAyat] = useState(parsed.ayat);
  const [open, setOpen] = useState(false);

  // Sync internal state when value prop changes (e.g., switching days)
  useEffect(() => {
    const p = parseSurahAyat(value);
    setSelectedSurah(p.surahNumber);
    setSelectedAyat(p.ayat);
  }, [value]);

  const surah = selectedSurah ? quranSurahList.find((s) => s.number === selectedSurah) : null;

  const handleSurahSelect = (surahNum: number) => {
    setSelectedSurah(surahNum);
    setSelectedAyat('');
    setOpen(false);
  };

  const handleAyatChange = (val: string) => {
    // Only allow digits
    const digits = val.replace(/\D/g, '');
    if (!surah) return;
    // Clamp to max ayat
    let num = parseInt(digits, 10);
    if (isNaN(num) || digits === '') {
      setSelectedAyat('');
      return;
    }
    if (num < 1) num = 1;
    if (num > surah.ayat) num = surah.ayat;
    const ayatStr = String(num);
    setSelectedAyat(ayatStr);
    onChange(`${surah.name} ayat ${ayatStr}`);
  };

  return (
    <div className="flex gap-2">
      {/* Surah picker */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={`flex-1 justify-between text-left font-normal h-10 bg-background ${disabled ? '!opacity-100 !text-foreground' : ''}`}
          >
            <span className={surah ? 'text-foreground font-medium' : 'text-muted-foreground'}>
              {surah ? `${surah.number}. ${surah.name}` : 'Pilih surah'}
            </span>
            {!disabled && <ChevronDown className="ml-1 h-4 w-4 shrink-0 opacity-50" />}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[220px] p-0 z-50" align="start">
          <Command>
            <CommandInput placeholder="Cari surah..." />
            <CommandList>
              <CommandEmpty>Surah tidak ditemukan</CommandEmpty>
              <CommandGroup>
                {quranSurahList.map((s) => (
                  <CommandItem
                    key={s.number}
                    value={`${s.number} ${s.name}`}
                    onSelect={() => handleSurahSelect(s.number)}
                    className="flex justify-between"
                  >
                    <span className="truncate">{s.number}. {s.name}</span>
                    <span className="text-[10px] text-muted-foreground ml-1 shrink-0">{s.ayat} ayat</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Ayat number input */}
      <Input
        type="number"
        inputMode="numeric"
        min={1}
        max={surah?.ayat ?? 1}
        value={selectedAyat}
        onChange={(e) => handleAyatChange(e.target.value)}
        disabled={disabled || !surah}
        placeholder={surah ? `1-${surah.ayat}` : 'Ayat'}
        className={`w-[90px] bg-background ${disabled ? '!opacity-100 !text-foreground font-medium' : ''}`}
      />
    </div>
  );
}
