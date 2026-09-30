import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { CalendarIcon, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormDrawer } from '@/components/ui/form-drawer';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { logActivity } from '@/lib/activityLogger';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { AcademicYear, LearningModel } from '@/contexts/AcademicYearContext';
import type { LearningBlockInput } from '@/types/learning-block';
import { validateBlocks, generateDefaultBlocks } from '@/types/learning-block';
import LearningBlocksEditor from './LearningBlocksEditor';

interface ExtendedAcademicYear extends AcademicYear {
  odd_semester_model?: LearningModel;
  even_semester_model?: LearningModel;
}

interface AcademicYearFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Omit<ExtendedAcademicYear, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  initialData?: ExtendedAcademicYear | null;
  loading?: boolean;
  hasActiveYear?: boolean;
}

export default function AcademicYearForm({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  loading = false,
  hasActiveYear = false,
}: AcademicYearFormProps) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear - 3 + i);

  const [startYear, setStartYear] = useState<number>(currentYear);
  const [oddStart, setOddStart] = useState<Date | undefined>();
  const [oddEnd, setOddEnd] = useState<Date | undefined>();
  const [evenStart, setEvenStart] = useState<Date | undefined>();
  const [evenEnd, setEvenEnd] = useState<Date | undefined>();
  const [isActive, setIsActive] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Learning model states
  const [oddSemesterModel, setOddSemesterModel] = useState<LearningModel>('normal');
  const [evenSemesterModel, setEvenSemesterModel] = useState<LearningModel>('normal');
  const [oddBlocks, setOddBlocks] = useState<LearningBlockInput[]>([]);
  const [evenBlocks, setEvenBlocks] = useState<LearningBlockInput[]>([]);
  const [existingOddBlocks, setExistingOddBlocks] = useState<any[]>([]);
  const [existingEvenBlocks, setExistingEvenBlocks] = useState<any[]>([]);

  const academicYearName = `${startYear}/${startYear + 1}`;

  // Fetch existing blocks when editing
  useEffect(() => {
    if (initialData?.id && open) {
      fetchExistingBlocks(initialData.id);
    }
  }, [initialData?.id, open]);

  const fetchExistingBlocks = async (academicYearId: string) => {
    try {
      const { data, error } = await supabase
        .from('learning_blocks')
        .select('*')
        .eq('academic_year_id', academicYearId)
        .order('fase', { ascending: true });

      if (error) throw error;

      const oddBlocksData = data?.filter(b => b.semester === 'ganjil') || [];
      const evenBlocksData = data?.filter(b => b.semester === 'genap') || [];

      setExistingOddBlocks(oddBlocksData);
      setExistingEvenBlocks(evenBlocksData);

      if (oddBlocksData.length > 0) {
        setOddBlocks(oddBlocksData.map(b => ({
          fase: b.fase,
          start_date: b.start_date,
          end_date: b.end_date,
          selected_dates: b.selected_dates || undefined
        })));
      }

      if (evenBlocksData.length > 0) {
        setEvenBlocks(evenBlocksData.map(b => ({
          fase: b.fase,
          start_date: b.start_date,
          end_date: b.end_date,
          selected_dates: b.selected_dates || undefined
        })));
      }
    } catch (error) {
      console.error('Error fetching learning blocks:', error);
    }
  };

  useEffect(() => {
    if (initialData) {
      const yearMatch = initialData.name.match(/^(\d{4})/);
      if (yearMatch) setStartYear(parseInt(yearMatch[1]));
      setOddStart(new Date(initialData.odd_semester_start));
      setOddEnd(new Date(initialData.odd_semester_end));
      setEvenStart(new Date(initialData.even_semester_start));
      setEvenEnd(new Date(initialData.even_semester_end));
      setIsActive(initialData.is_active);
      setOddSemesterModel(initialData.odd_semester_model || 'normal');
      setEvenSemesterModel(initialData.even_semester_model || 'normal');
    } else {
      // Set default dates for new academic year
      setOddStart(new Date(startYear, 6, 15)); // July 15
      setOddEnd(new Date(startYear, 11, 20)); // December 20
      setEvenStart(new Date(startYear + 1, 0, 5)); // January 5
      setEvenEnd(new Date(startYear + 1, 5, 20)); // June 20
      setIsActive(!hasActiveYear);
      setOddSemesterModel('normal');
      setEvenSemesterModel('normal');
      setOddBlocks([]);
      setEvenBlocks([]);
    }
  }, [initialData, open, startYear, hasActiveYear]);

  // Reset blocks when switching to normal model
  useEffect(() => {
    if (oddSemesterModel === 'normal') {
      setOddBlocks([]);
    } else if (oddBlocks.length === 0 && oddStart && oddEnd) {
      setOddBlocks(generateDefaultBlocks(oddStart, oddEnd, 3));
    }
  }, [oddSemesterModel, oddStart, oddEnd]);

  useEffect(() => {
    if (evenSemesterModel === 'normal') {
      setEvenBlocks([]);
    } else if (evenBlocks.length === 0 && evenStart && evenEnd) {
      setEvenBlocks(generateDefaultBlocks(evenStart, evenEnd, 3));
    }
  }, [evenSemesterModel, evenStart, evenEnd]);

  const handleSubmit = () => {
    if (!oddStart || !oddEnd || !evenStart || !evenEnd) return;

    // Validate blocks if sistem blok
    if (oddSemesterModel === 'sistem_blok') {
      const result = validateBlocks(oddBlocks, oddStart, oddEnd);
      if (!result.isValid) {
        toast.error('Validasi blok semester ganjil gagal', {
          description: result.errors[0]
        });
        return;
      }
    }

    if (evenSemesterModel === 'sistem_blok') {
      const result = validateBlocks(evenBlocks, evenStart, evenEnd);
      if (!result.isValid) {
        toast.error('Validasi blok semester genap gagal', {
          description: result.errors[0]
        });
        return;
      }
    }

    // If trying to activate and there's already an active year (not editing self)
    if (isActive && hasActiveYear && (!initialData || !initialData.is_active)) {
      setShowConfirmDialog(true);
      return;
    }

    submitData();
  };

  const submitData = async () => {
    if (!oddStart || !oddEnd || !evenStart || !evenEnd) return;

    const isEditing = !!initialData;
    const wasActive = initialData?.is_active || false;

    try {
      await onSubmit({
        name: academicYearName,
        odd_semester_start: format(oddStart, 'yyyy-MM-dd'),
        odd_semester_end: format(oddEnd, 'yyyy-MM-dd'),
        even_semester_start: format(evenStart, 'yyyy-MM-dd'),
        even_semester_end: format(evenEnd, 'yyyy-MM-dd'),
        is_active: isActive,
        odd_semester_model: oddSemesterModel,
        even_semester_model: evenSemesterModel,
      });

      // Save blocks after academic year is saved
      // This will be handled by parent component after getting the academic year ID
    } catch (error) {
      console.error('Error submitting:', error);
      return;
    }

    // Log activity
    if (isEditing) {
      if (!wasActive && isActive) {
        logActivity({
          action: 'academic_year_activate',
          category: 'academic_year',
          description: `Mengaktifkan tahun ajaran ${academicYearName}`,
          metadata: { name: academicYearName }
        });
      } else if (wasActive && !isActive) {
        logActivity({
          action: 'academic_year_deactivate',
          category: 'academic_year',
          description: `Menonaktifkan tahun ajaran ${academicYearName}`,
          metadata: { name: academicYearName }
        });
      } else {
        logActivity({
          action: 'academic_year_edit',
          category: 'academic_year',
          description: `Mengedit tahun ajaran ${academicYearName}`,
          metadata: { name: academicYearName }
        });
      }
    } else {
      logActivity({
        action: 'academic_year_add',
        category: 'academic_year',
        description: `Menambahkan tahun ajaran ${academicYearName}`,
        metadata: { name: academicYearName, isActive }
      });
    }
  };

  // Function to save blocks (to be called by parent after academic year is saved)
  const saveBlocks = async (academicYearId: string) => {
    try {
      // Delete existing blocks
      await supabase
        .from('learning_blocks')
        .delete()
        .eq('academic_year_id', academicYearId);

      // Insert new blocks for odd semester
      if (oddSemesterModel === 'sistem_blok' && oddBlocks.length > 0) {
        const oddBlocksData = oddBlocks.map(block => ({
          academic_year_id: academicYearId,
          semester: 'ganjil' as const,
          fase: block.fase,
          start_date: block.start_date,
          end_date: block.end_date,
          selected_dates: block.selected_dates || null
        }));

        const { error: oddError } = await supabase
          .from('learning_blocks')
          .insert(oddBlocksData);

        if (oddError) throw oddError;
      }

      // Insert new blocks for even semester
      if (evenSemesterModel === 'sistem_blok' && evenBlocks.length > 0) {
        const evenBlocksData = evenBlocks.map(block => ({
          academic_year_id: academicYearId,
          semester: 'genap' as const,
          fase: block.fase,
          start_date: block.start_date,
          end_date: block.end_date,
          selected_dates: block.selected_dates || null
        }));

        const { error: evenError } = await supabase
          .from('learning_blocks')
          .insert(evenBlocksData);

        if (evenError) throw evenError;
      }
    } catch (error) {
      console.error('Error saving blocks:', error);
      toast.error('Gagal menyimpan blok pembelajaran');
    }
  };

  // Expose saveBlocks function through a ref or callback
  useEffect(() => {
    if ((window as any).__academicYearFormSaveBlocks !== undefined) {
      (window as any).__academicYearFormSaveBlocks = saveBlocks;
    }
  }, [oddBlocks, evenBlocks, oddSemesterModel, evenSemesterModel]);

  // Attach to window for parent access
  (window as any).__academicYearFormSaveBlocks = saveBlocks;
  (window as any).__academicYearFormBlocks = {
    oddBlocks,
    evenBlocks,
    oddSemesterModel,
    evenSemesterModel
  };

  const isFormValid = oddStart && oddEnd && evenStart && evenEnd;

  return (
    <>
      <FormDrawer
        open={open}
        onOpenChange={onOpenChange}
        title={initialData ? 'Edit Tahun Ajaran' : 'Tambah Tahun Ajaran'}
        onSubmit={handleSubmit}
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
              disabled={!isFormValid || loading}
            >
              {loading ? 'Menyimpan...' : initialData ? 'Simpan' : 'Tambah'}
            </Button>
          </div>
        }
      >
        <div className="space-y-6">
          {/* Start Year Selection */}
          <div className="space-y-2">
            <Label>Tahun Mulai</Label>
            <Select
              value={startYear.toString()}
              onValueChange={(v) => setStartYear(parseInt(v))}
              disabled={!!initialData}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Nama Tahun Ajaran: <span className="font-medium text-foreground">{academicYearName}</span>
            </p>
          </div>

          {/* Semester Ganjil */}
          <div className="space-y-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Semester Ganjil</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-xs">
                    <p className="text-xs">
                      <strong>Normal:</strong> Jadwal berlaku sepanjang semester<br/>
                      <strong>Sistem Blok:</strong> Semester dibagi menjadi beberapa fase/blok dengan jadwal berbeda
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Tanggal Mulai</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !oddStart && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {oddStart ? format(oddStart, 'dd MMM yyyy', { locale: idLocale }) : 'Pilih tanggal'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={oddStart}
                      onSelect={setOddStart}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Tanggal Selesai</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !oddEnd && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {oddEnd ? format(oddEnd, 'dd MMM yyyy', { locale: idLocale }) : 'Pilih tanggal'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={oddEnd}
                      onSelect={setOddEnd}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Learning Model Selection */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Model Pembelajaran</Label>
              <Select
                value={oddSemesterModel}
                onValueChange={(v) => setOddSemesterModel(v as LearningModel)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="sistem_blok">Sistem Blok</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Block Editor (only shown for sistem_blok) */}
            {oddSemesterModel === 'sistem_blok' && oddStart && oddEnd && (
              <LearningBlocksEditor
                blocks={oddBlocks}
                onChange={setOddBlocks}
                semesterStart={oddStart}
                semesterEnd={oddEnd}
                semesterLabel="Ganjil"
              />
            )}
          </div>

          {/* Semester Genap */}
          <div className="space-y-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Semester Genap</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-xs">
                    <p className="text-xs">
                      <strong>Normal:</strong> Jadwal berlaku sepanjang semester<br/>
                      <strong>Sistem Blok:</strong> Semester dibagi menjadi beberapa fase/blok dengan jadwal berbeda
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Tanggal Mulai</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !evenStart && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {evenStart ? format(evenStart, 'dd MMM yyyy', { locale: idLocale }) : 'Pilih tanggal'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={evenStart}
                      onSelect={setEvenStart}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Tanggal Selesai</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !evenEnd && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {evenEnd ? format(evenEnd, 'dd MMM yyyy', { locale: idLocale }) : 'Pilih tanggal'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={evenEnd}
                      onSelect={setEvenEnd}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Learning Model Selection */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Model Pembelajaran</Label>
              <Select
                value={evenSemesterModel}
                onValueChange={(v) => setEvenSemesterModel(v as LearningModel)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="sistem_blok">Sistem Blok</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Block Editor (only shown for sistem_blok) */}
            {evenSemesterModel === 'sistem_blok' && evenStart && evenEnd && (
              <LearningBlocksEditor
                blocks={evenBlocks}
                onChange={setEvenBlocks}
                semesterStart={evenStart}
                semesterEnd={evenEnd}
                semesterLabel="Genap"
              />
            )}
          </div>

          {/* Active Toggle */}
          <div id="aktif-card" className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label className="text-base">Aktifkan Tahun Ajaran Ini</Label>
              <p className="text-sm text-muted-foreground">
                Data akademik akan ditampilkan berdasarkan tahun ajaran aktif
              </p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>
      </FormDrawer>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aktifkan Tahun Ajaran Baru?</AlertDialogTitle>
            <AlertDialogDescription>
              Mengaktifkan tahun ajaran baru akan menonaktifkan tahun ajaran sebelumnya. 
              Data akademik yang ditampilkan akan berubah sesuai tahun ajaran yang aktif.
              <br /><br />
              Lanjutkan mengaktifkan <strong>{academicYearName}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={submitData}>Ya, Aktifkan</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
