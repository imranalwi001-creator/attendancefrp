import { useState, useEffect } from 'react';
import { format, parse, min, max } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Plus, Trash2, AlertCircle, CalendarRange } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { 
  LearningBlockInput, 
  validateBlocks, 
  generateDefaultBlocks 
} from '@/types/learning-block';

interface LearningBlocksEditorProps {
  blocks: LearningBlockInput[];
  onChange: (blocks: LearningBlockInput[]) => void;
  semesterStart: Date;
  semesterEnd: Date;
  semesterLabel: string;
}

export default function LearningBlocksEditor({
  blocks,
  onChange,
  semesterStart,
  semesterEnd,
  semesterLabel
}: LearningBlocksEditorProps) {
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [openPopoverIndex, setOpenPopoverIndex] = useState<number | null>(null);
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);

  const parseLocalDate = (dateStr: string) => parse(dateStr, 'yyyy-MM-dd', new Date());
  const formatLocalDate = (date: Date) => format(date, 'yyyy-MM-dd');

  useEffect(() => {
    if (blocks.length > 0) {
      const result = validateBlocks(blocks, semesterStart, semesterEnd);
      setValidationErrors(result.errors);
    } else {
      setValidationErrors([]);
    }
  }, [blocks, semesterStart, semesterEnd]);

  useEffect(() => {
    if (blocks.length === 0 && semesterStart && semesterEnd) {
      const defaultBlocks = generateDefaultBlocks(semesterStart, semesterEnd, 3);
      onChange(defaultBlocks);
    }
  }, [blocks.length, semesterStart, semesterEnd, onChange]);

  // Initialize selected dates when popover opens
  useEffect(() => {
    if (openPopoverIndex !== null && blocks[openPopoverIndex]) {
      const block = blocks[openPopoverIndex];
      
      // If we have stored selected_dates, use them
      if (block.selected_dates && block.selected_dates.length > 0) {
        const dates = block.selected_dates.map(d => parseLocalDate(d));
        setSelectedDates(dates);
      } else if (block.start_date && block.end_date) {
        // Fallback: generate dates from range for backward compatibility
        const start = parseLocalDate(block.start_date);
        const end = parseLocalDate(block.end_date);
        const dates: Date[] = [];
        const current = new Date(start);
        while (current <= end) {
          dates.push(new Date(current));
          current.setDate(current.getDate() + 1);
        }
        setSelectedDates(dates);
      } else {
        setSelectedDates([]);
      }
    }
  }, [openPopoverIndex]);

  const handleAddBlock = () => {
    if (blocks.length >= 5) return;
    
    const usedFases = blocks.map(b => b.fase);
    const availableFase = [1, 2, 3, 4, 5].find(f => !usedFases.includes(f)) || blocks.length + 1;
    
    const lastBlock = blocks[blocks.length - 1];
    let newStartDate = semesterStart;
    
    if (lastBlock) {
      const lastEndDate = parseLocalDate(lastBlock.end_date);
      lastEndDate.setDate(lastEndDate.getDate() + 1);
      newStartDate = lastEndDate;
    }

    const newEndDate = new Date(newStartDate);
    newEndDate.setDate(newEndDate.getDate() + 14);

    if (newEndDate > semesterEnd) {
      newEndDate.setTime(semesterEnd.getTime());
    }

    onChange([
      ...blocks,
      {
        fase: availableFase,
        start_date: formatLocalDate(newStartDate),
        end_date: formatLocalDate(newEndDate),
      },
    ]);
  };

  const handleRemoveBlock = (index: number) => {
    if (blocks.length <= 3) return;
    const newBlocks = blocks.filter((_, i) => i !== index);
    onChange(newBlocks);
  };

  const handleBlockChange = (index: number, field: keyof LearningBlockInput, value: any) => {
    const newBlocks = [...blocks];
    newBlocks[index] = { ...newBlocks[index], [field]: value };
    onChange(newBlocks);
  };

  const handleMultipleDatesChange = (dates: Date[] | undefined) => {
    setSelectedDates(dates || []);
  };

  const handleConfirmDates = (index: number) => {
    if (selectedDates.length === 0) return;
    
    const startDate = min(selectedDates);
    const endDate = max(selectedDates);
    
    // Store all selected dates as array of strings
    const selectedDatesArray = selectedDates
      .map(d => formatLocalDate(d))
      .sort(); // Sort chronologically
    
    const newBlocks = [...blocks];
    newBlocks[index] = {
      ...newBlocks[index],
      start_date: formatLocalDate(startDate),
      end_date: formatLocalDate(endDate),
      selected_dates: selectedDatesArray // Store individual dates
    };
    
    // Update blocks first, then close popover
    onChange(newBlocks);
    
    // Use setTimeout to ensure state update is processed before closing
    setTimeout(() => {
      setOpenPopoverIndex(null);
    }, 0);
  };

  const handleClearDates = () => {
    setSelectedDates([]);
  };

  const getUsedFases = (excludeIndex: number) => {
    return blocks.filter((_, i) => i !== excludeIndex).map(b => b.fase);
  };

  const formatDateRangeLabel = (block: LearningBlockInput): string => {
    if (!block.start_date && !block.end_date) return 'Pilih tanggal';
    
    const startStr = block.start_date 
      ? format(parseLocalDate(block.start_date), 'dd MMM', { locale: idLocale })
      : '...';
    const endStr = block.end_date 
      ? format(parseLocalDate(block.end_date), 'dd MMM', { locale: idLocale })
      : '...';
    
    return `${startStr} - ${endStr}`;
  };

  const getSelectedRangeLabel = (): string => {
    if (selectedDates.length === 0) return 'Belum ada tanggal dipilih';
    if (selectedDates.length === 1) {
      return format(selectedDates[0], 'dd MMM yyyy', { locale: idLocale });
    }
    const startDate = min(selectedDates);
    const endDate = max(selectedDates);
    return `${format(startDate, 'dd MMM yyyy', { locale: idLocale })} - ${format(endDate, 'dd MMM yyyy', { locale: idLocale })} (${selectedDates.length} hari)`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Blok Pembelajaran {semesterLabel}</Label>
        <span className="text-xs text-muted-foreground">
          {blocks.length}/5 blok
        </span>
      </div>

      {validationErrors.length > 0 && (
        <Alert variant="destructive" className="py-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            <ul className="list-disc list-inside space-y-0.5">
              {validationErrors.map((error, i) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        {blocks.map((block, index) => (
          <div 
            key={index} 
            className="group flex items-center gap-3 rounded-xl border bg-card p-3 hover:border-primary/30 transition-colors"
          >
            {/* Block Number Badge */}
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <span className="text-sm font-bold text-primary">{index + 1}</span>
            </div>

            {/* Fase Selector */}
            <div className="flex-shrink-0 w-28">
              <Select
                value={block.fase.toString()}
                onValueChange={(v) => handleBlockChange(index, 'fase', parseInt(v))}
              >
                <SelectTrigger className="h-10 text-sm">
                  <SelectValue placeholder="Fase" />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((fase) => {
                    const isUsed = getUsedFases(index).includes(fase);
                    return (
                      <SelectItem 
                        key={fase} 
                        value={fase.toString()}
                        disabled={isUsed}
                      >
                        Fase {fase} {isUsed ? '✓' : ''}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Date Range Picker */}
            <div className="flex-1">
              <Popover 
                modal={true} 
                open={openPopoverIndex === index}
                onOpenChange={(open) => {
                  if (open) {
                    setOpenPopoverIndex(index);
                  } else {
                    setOpenPopoverIndex(null);
                  }
                }}
              >
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      'w-full h-10 justify-start text-left font-normal',
                      !block.start_date && !block.end_date && 'text-muted-foreground'
                    )}
                  >
                    <CalendarRange className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                    <span id="fase_date">{formatDateRangeLabel(block)}</span>
                    {block.selected_dates && block.selected_dates.length > 0 && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        {block.selected_dates.length} hari
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-[100]" align="start" sideOffset={4}>
                  <div className="p-3 border-b bg-muted/30">
                    <p className="text-sm font-medium">Pilih Tanggal Blok {index + 1}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Klik untuk memilih beberapa tanggal
                    </p>
                  </div>
                  <Calendar
                    mode="multiple"
                    selected={selectedDates}
                    onSelect={handleMultipleDatesChange}
                    disabled={(date) => date < semesterStart || date > semesterEnd}
                    initialFocus
                    numberOfMonths={1}
                    locale={idLocale}
                    className="p-3 pointer-events-auto"
                  />
                  <div className="border-t p-3 space-y-3 bg-muted/30">
                    <div className="text-sm text-center font-medium">
                      {getSelectedRangeLabel()}
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        type="button" 
                        variant="outline"
                        size="sm" 
                        className="flex-1"
                        onClick={handleClearDates}
                      >
                        Reset
                      </Button>
                      <Button 
                        type="button" 
                        size="sm" 
                        className="flex-1"
                        onClick={() => handleConfirmDates(index)}
                        disabled={selectedDates.length === 0}
                      >
                        Simpan
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Delete Button */}
            {blocks.length > 3 ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="flex-shrink-0 h-10 w-10 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                onClick={() => handleRemoveBlock(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            ) : (
              <div className="w-10" /> 
            )}
          </div>
        ))}
      </div>

      {blocks.length < 5 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          onClick={handleAddBlock}
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Tambah Blok
        </Button>
      )}

      <p className="text-xs text-muted-foreground">
        Sistem blok memerlukan minimal 3 blok dan maksimal 5 blok pembelajaran.
      </p>
    </div>
  );
}
