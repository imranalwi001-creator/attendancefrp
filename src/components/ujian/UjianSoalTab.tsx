import { useState, useMemo } from 'react';
import { Plus, HelpCircle, FileText, ToggleLeft, Upload, Search, CheckSquare, X, Trash2, Image as ImageIcon, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ActionButtonGroup, EditButton, DeleteButton } from '@/components/ui/action-buttons';
import { SoalFormDrawer } from './SoalFormDrawer';
import { ImportSoalModal } from './ImportSoalModal';
import { getJenisSoalLabel, type JenisSoal } from '@/lib/ujianUtils';
import { cn } from '@/lib/utils';
import type { UjianSoal } from '@/hooks/useUjian';
import { useBulkCreateSoal } from '@/hooks/useBulkCreateSoal';
import { GenerateSoalDrawer } from './bank-soal/GenerateSoalDrawer';
import type { GenerateSoalParams } from '@/hooks/useGenerateSoal';

interface ImportedSoal {
  jenis_soal: JenisSoal;
  pertanyaan: string;
  gambar_pertanyaan?: string;
  pembahasan?: string;
  gambar_pembahasan?: string;
  opsi?: { label: string; teks: string; is_kunci: boolean; gambar?: string }[];
  kunci_jawaban?: string;
  bobot_nilai: number;
}

interface UjianSoalTabProps {
  soalList: UjianSoal[];
  ujianId: string;
  onCreateSoal: (data: any) => void;
  onUpdateSoal: (data: any) => void;
  onDeleteSoal: (id: string) => void;
  onBulkDeleteSoal?: (ids: string[]) => void;
  loading?: boolean;
  disabled?: boolean;
  aiGradingEnabled?: boolean;
  onAiGradingChange?: (enabled: boolean) => void;
  aiGeneratorDefaults?: Partial<GenerateSoalParams>;
  aiGeneratorContext?: {
    title?: string;
    description?: string;
  };
}

function getJenisSoalIcon(jenis: JenisSoal) {
  switch (jenis) {
    case 'pilihan_ganda':
      return <HelpCircle className="h-3 w-3" />;
    case 'essai':
      return <FileText className="h-3 w-3" />;
    case 'true_false':
      return <ToggleLeft className="h-3 w-3" />;
    default:
      return <HelpCircle className="h-3 w-3" />;
  }
}

function getJenisSoalColor(jenis: JenisSoal) {
  switch (jenis) {
    case 'pilihan_ganda':
      return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'essai':
      return 'bg-purple-100 text-purple-700 border-purple-200';
    case 'true_false':
      return 'bg-amber-100 text-amber-700 border-amber-200';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

function stripHtml(html: string): string {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

export function UjianSoalTab({
  soalList,
  ujianId,
  onCreateSoal,
  onUpdateSoal,
  onDeleteSoal,
  onBulkDeleteSoal,
  loading,
  disabled = false,
  aiGradingEnabled = true,
  onAiGradingChange,
  aiGeneratorDefaults,
  aiGeneratorContext,
}: UjianSoalTabProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [generateDrawerOpen, setGenerateDrawerOpen] = useState(false);
  const [editingSoal, setEditingSoal] = useState<UjianSoal | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);

  const bulkCreateSoal = useBulkCreateSoal();

  const nextNomorUrut = soalList.length + 1;

  const filteredSoalList = useMemo(() => {
    if (!searchQuery.trim()) return soalList;
    const query = searchQuery.toLowerCase();
    return soalList.filter((soal) => {
      const pertanyaanText = stripHtml(soal.pertanyaan).toLowerCase();
      const nomorMatch = soal.nomor_urut.toString().includes(query);
      return pertanyaanText.includes(query) || nomorMatch;
    });
  }, [soalList, searchQuery]);

  const isAllSelected = filteredSoalList.length > 0 && filteredSoalList.every((s) => selectedIds.has(s.id));

  const handleToggleSelectionMode = () => {
    if (selectionMode) {
      // Exit selection mode - clear selections
      setSelectedIds(new Set());
    }
    setSelectionMode(!selectionMode);
  };

  const handleSelectAll = () => {
    if (isAllSelected) {
      // Deselect all
      const newSelected = new Set(selectedIds);
      filteredSoalList.forEach((s) => newSelected.delete(s.id));
      setSelectedIds(newSelected);
    } else {
      // Select all
      const newSelected = new Set(selectedIds);
      filteredSoalList.forEach((s) => newSelected.add(s.id));
      setSelectedIds(newSelected);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkDelete = () => {
    if (onBulkDeleteSoal) {
      onBulkDeleteSoal(Array.from(selectedIds));
    } else {
      // Fallback: delete one by one
      selectedIds.forEach((id) => onDeleteSoal(id));
    }
    setSelectedIds(new Set());
    setBulkDeleteDialogOpen(false);
    setSelectionMode(false);
  };

  const handleImport = (importedSoalList: ImportedSoal[]) => {
    bulkCreateSoal.mutate({
      ujianId,
      soalList: importedSoalList,
      startingNomorUrut: nextNomorUrut,
    });
  };

  const handleAddClick = () => {
    setEditingSoal(null);
    setDrawerOpen(true);
  };

  const handleEditClick = (soal: UjianSoal) => {
    setEditingSoal(soal);
    setDrawerOpen(true);
  };

  const handleSubmit = (data: any) => {
    if (editingSoal) {
      onUpdateSoal({
        id: editingSoal.id,
        ujian_id: ujianId,
        ...data,
      });
    } else {
      onCreateSoal({
        ujian_id: ujianId,
        nomor_urut: nextNomorUrut,
        ...data,
      });
    }
    setDrawerOpen(false);
  };

  const getKunciPreview = (soal: UjianSoal): string => {
    if (soal.jenis_soal === 'pilihan_ganda' && soal.opsi) {
      const kunci = soal.opsi.find((o) => o.is_kunci);
      return kunci ? `Kunci: ${kunci.label}` : 'Belum ada kunci';
    }
    if (soal.jenis_soal === 'true_false') {
      return soal.kunci_jawaban ? `Kunci: ${soal.kunci_jawaban.toUpperCase()}` : 'Belum ada kunci';
    }
    if (soal.jenis_soal === 'essai') {
      return soal.kunci_jawaban ? 'Poin penting tersedia' : 'Belum ada poin';
    }
    return '-';
  };

  // Check if there are essay questions
  const hasEssayQuestions = soalList.some(s => s.jenis_soal === 'essai');

  return (
    <div className="space-y-4">
      {/* AI Grading Toggle - Only show if there are essay questions */}
      {hasEssayQuestions && onAiGradingChange && (
        <div className="flex items-center justify-between gap-4 p-4 rounded-lg bg-muted/50 border">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-md bg-primary/10 text-primary mt-0.5">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="space-y-0.5">
              <Label htmlFor="ai-grading" className="text-sm font-medium cursor-pointer">
                AI Auto-Grading untuk Soal Esai
              </Label>
              <p className="text-xs text-muted-foreground">
                Jawaban esai akan dinilai otomatis oleh AI berdasarkan kunci jawaban saat santri submit ujian
              </p>
            </div>
          </div>
          <Switch
            id="ai-grading"
            checked={aiGradingEnabled}
            onCheckedChange={onAiGradingChange}
            disabled={disabled}
          />
        </div>
      )}

      {/* Header Actions */}
      <div className="flex flex-col gap-4 rounded-2xl border border-primary/15 bg-[radial-gradient(circle_at_top_left,rgba(13,148,136,0.12),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.08),transparent_34%)] p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-background/85 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            AI Question Studio
          </div>
          <p className="text-sm font-medium text-foreground">Susun draft soal dengan AI lalu masukkan langsung ke ujian ini.</p>
          <p className="text-xs text-muted-foreground">
            Cocok untuk quiz harian, paket HOTS, remedial, dan penyusunan soal yang lebih cepat.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={() => setGenerateDrawerOpen(true)} className="gap-2">
            <Sparkles className="h-4 w-4" />
            Generate Soal AI
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari soal..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        {!disabled && (
          <div className="flex items-center gap-2">
            {filteredSoalList.length > 0 && (
              <Button 
                variant="outline"
                onClick={handleToggleSelectionMode}
                className={selectionMode 
                  ? "border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  : "border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                }
              >
                {selectionMode ? (
                  <>
                    <X className="h-4 w-4 mr-2" />
                    Batal
                  </>
                ) : (
                  <>
                    <CheckSquare className="h-4 w-4 mr-2" />
                    Pilih
                  </>
                )}
              </Button>
            )}
            <Button 
              variant="outline" 
              onClick={() => setImportModalOpen(true)}
              className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
            >
              <Upload className="h-4 w-4 mr-2" />
              Import Soal
            </Button>
            <Button variant="secondary" onClick={handleAddClick}>
              <Plus className="h-4 w-4 mr-2" />
              Tambah Soal
            </Button>
          </div>
        )}
      </div>

      {/* Selection Actions Bar - Only show when in selection mode */}
      {selectionMode && filteredSoalList.length > 0 && (
        <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-lg px-4 py-3">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
              className="h-8"
            >
              {isAllSelected ? 'Batal Pilih Semua' : 'Pilih Semua'}
            </Button>
            <span className="text-sm text-muted-foreground">
              {selectedIds.size > 0 ? (
                <span className="font-medium text-foreground">{selectedIds.size} soal dipilih</span>
              ) : (
                'Klik checkbox untuk memilih soal'
              )}
            </span>
          </div>
          
          {selectedIds.size > 0 && (
            <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Hapus ({selectedIds.size})
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Hapus {selectedIds.size} Soal?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {selectedIds.size} soal yang dipilih akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Batal</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleBulkDelete}
                    className="bg-destructive hover:bg-destructive/90"
                  >
                    Hapus Semua
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      )}

      {/* Soal List */}
      {soalList.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <HelpCircle className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground">Belum ada soal</h3>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Klik tombol "Tambah Soal" untuk menambahkan soal pertama
            </p>
          </CardContent>
        </Card>
      ) : filteredSoalList.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Search className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground">Tidak ditemukan</h3>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Tidak ada soal yang cocok dengan "{searchQuery}"
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredSoalList.map((soal) => (
            <Card 
              key={soal.id} 
              className={cn(
                "overflow-hidden transition-all cursor-pointer",
                selectedIds.has(soal.id) && "ring-2 ring-primary bg-primary/5"
              )}
              onClick={selectionMode ? () => handleSelectOne(soal.id, !selectedIds.has(soal.id)) : undefined}
            >
              <CardContent className="p-0">
                <div className="grid grid-cols-12 gap-4 p-4 items-center">
                  {/* Checkbox + Nomor */}
                  <div className="col-span-1 flex items-center gap-2">
                    {selectionMode && (
                      <Checkbox
                        checked={selectedIds.has(soal.id)}
                        onCheckedChange={(checked) => handleSelectOne(soal.id, checked as boolean)}
                        aria-label={`Pilih soal ${soal.nomor_urut}`}
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm">
                      {soal.nomor_urut}
                    </div>
                  </div>

                  {/* Preview Soal */}
                  <div className={cn("col-span-4 flex items-start gap-3", selectionMode && "col-span-5")}>
                    {soal.gambar_pertanyaan && (
                      <div className="shrink-0 w-12 h-12 rounded-md border bg-muted overflow-hidden">
                        <img 
                          src={soal.gambar_pertanyaan} 
                          alt="Gambar soal" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium line-clamp-2">
                        {stripHtml(soal.pertanyaan).slice(0, 100)}
                        {stripHtml(soal.pertanyaan).length > 100 ? '...' : ''}
                      </p>
                      {(soal.gambar_pembahasan || soal.opsi?.some(o => o.gambar)) && (
                        <div className="flex items-center gap-1 mt-1">
                          <ImageIcon className="h-3 w-3 text-muted-foreground" />
                          <span className="text-[10px] text-muted-foreground">
                            {[
                              soal.opsi?.some(o => o.gambar) && 'Opsi',
                              soal.gambar_pembahasan && 'Pembahasan'
                            ].filter(Boolean).join(', ')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Badge Jenis */}
                  <div className="col-span-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[10px] font-medium border gap-1',
                        getJenisSoalColor(soal.jenis_soal)
                      )}
                    >
                      {getJenisSoalIcon(soal.jenis_soal)}
                      {getJenisSoalLabel(soal.jenis_soal)}
                    </Badge>
                  </div>

                  {/* Kunci Jawaban */}
                  <div className="col-span-2">
                    <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground/70 mb-0.5">
                      KUNCI
                    </p>
                    <p className="text-xs text-muted-foreground">{getKunciPreview(soal)}</p>
                  </div>

                  {/* Bobot */}
                  <div className="col-span-1">
                    <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground/70 mb-0.5">
                      BOBOT
                    </p>
                    <p className="text-sm font-semibold">{soal.bobot_nilai}</p>
                  </div>

                  {/* Aksi - Hide in selection mode */}
                  {!selectionMode && !disabled && (
                    <div className="col-span-2 flex justify-end">
                      <ActionButtonGroup>
                        <EditButton onClick={() => handleEditClick(soal)} />
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <DeleteButton />
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Hapus Soal?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Soal nomor {soal.nomor_urut} akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Batal</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => onDeleteSoal(soal.id)}
                                className="bg-destructive hover:bg-destructive/90"
                              >
                                Hapus
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </ActionButtonGroup>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Drawer Form */}
      <SoalFormDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        soal={editingSoal}
        nomorUrut={editingSoal?.nomor_urut || nextNomorUrut}
        onSubmit={handleSubmit}
        loading={loading}
      />

      {/* Import Modal */}
      <ImportSoalModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        onImport={handleImport}
        loading={bulkCreateSoal.isPending}
        currentSoalCount={soalList.length}
      />

      <GenerateSoalDrawer
        open={generateDrawerOpen}
        onOpenChange={setGenerateDrawerOpen}
        mode="ujian"
        selectedUjianId={ujianId}
        startingNomorUrut={nextNomorUrut}
        initialValues={aiGeneratorDefaults}
        contextTitle={aiGeneratorContext?.title || 'AI Generator Soal Ujian'}
        contextDescription={aiGeneratorContext?.description || 'Buat draft soal yang langsung tersusun ke ujian aktif ini.'}
      />
    </div>
  );
}

export default UjianSoalTab;
