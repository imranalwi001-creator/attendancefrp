import { useState } from 'react';
import { Copy, Layers, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { LearningBlock } from '@/hooks/useLearningBlocks';

interface DuplicateToBlockModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceBlock: LearningBlock | null;
  allBlocks: LearningBlock[];
  jadwalList: any[];
  kelasId: string;
  formatBlockLabel: (block: LearningBlock) => string;
  isBlockActive: (block: LearningBlock) => boolean;
  onSuccess: () => void;
}

export function DuplicateToBlockModal({
  open,
  onOpenChange,
  sourceBlock,
  allBlocks,
  jadwalList,
  kelasId,
  formatBlockLabel,
  isBlockActive,
  onSuccess
}: DuplicateToBlockModalProps) {
  const [selectedBlockIds, setSelectedBlockIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [duplicatedCount, setDuplicatedCount] = useState(0);

  // Filter out the source block from target options
  const targetBlocks = allBlocks.filter(b => b.id !== sourceBlock?.id);

  // Get jadwal for current source block (include legacy null block_id)
  const sourceJadwal = jadwalList.filter(j => 
    (j.block_id === sourceBlock?.id || !j.block_id) && j.kelas_id === kelasId
  );

  const handleBlockToggle = (blockId: string) => {
    setSelectedBlockIds(prev => 
      prev.includes(blockId) 
        ? prev.filter(id => id !== blockId)
        : [...prev, blockId]
    );
  };

  const handleSelectAll = () => {
    if (selectedBlockIds.length === targetBlocks.length) {
      setSelectedBlockIds([]);
    } else {
      setSelectedBlockIds(targetBlocks.map(b => b.id));
    }
  };

  const handleDuplicate = async () => {
    if (selectedBlockIds.length === 0) {
      toast({
        title: "Pilih Blok Tujuan",
        description: "Silakan pilih minimal satu blok tujuan untuk duplikasi",
        variant: "destructive"
      });
      return;
    }

    if (sourceJadwal.length === 0) {
      toast({
        title: "Tidak Ada Jadwal",
        description: "Tidak ada jadwal yang dapat diduplikasi dari blok ini",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    setDuplicatedCount(0);

    try {
      let totalDuplicated = 0;
      let totalSkipped = 0;

      for (const targetBlockId of selectedBlockIds) {
        const targetBlock = allBlocks.find(b => b.id === targetBlockId);
        if (!targetBlock) continue;

        // Get existing jadwal in target block AND null block to avoid duplicates
        const { data: existingJadwal } = await supabase
          .from('jadwal')
          .select('hari, jam_mulai, jam_selesai, mapel_id, pengampu_id')
          .eq('kelas_id', kelasId)
          .or(`block_id.eq.${targetBlockId},block_id.is.null`);

        const existingSet = new Set(
          (existingJadwal || []).map(j => 
            `${j.hari}-${j.jam_mulai}-${j.jam_selesai}-${j.mapel_id}`
          )
        );

        // Prepare jadwal to insert
        const jadwalToInsert = sourceJadwal
          .filter(j => {
            const key = `${j.hari}-${j.jam_mulai}-${j.jam_selesai}-${j.mapel_id}`;
            return !existingSet.has(key);
          })
          .map(j => ({
            kelas_id: kelasId,
            mapel_id: j.mapel_id,
            pengampu_id: j.pengampu_id,
            hari: j.hari,
            jam_mulai: j.jam_mulai,
            jam_selesai: j.jam_selesai,
            ruangan: j.ruangan || null,
            status: j.status || 'aktif',
            semester: j.semester,
            block_id: targetBlockId
          }));

        if (jadwalToInsert.length > 0) {
          const { error } = await supabase
            .from('jadwal')
            .insert(jadwalToInsert);

          if (error) {
            console.error('Error inserting jadwal:', error);
            continue;
          }

          totalDuplicated += jadwalToInsert.length;
        }

        totalSkipped += sourceJadwal.length - jadwalToInsert.length;
      }

      setDuplicatedCount(totalDuplicated);

      if (totalDuplicated > 0) {
        toast({
          title: "Duplikasi Berhasil",
          description: `${totalDuplicated} jadwal berhasil diduplikasi ke ${selectedBlockIds.length} blok${totalSkipped > 0 ? `. ${totalSkipped} jadwal dilewati karena sudah ada.` : ''}`
        });
        onSuccess();
        onOpenChange(false);
        setSelectedBlockIds([]);
      } else if (totalSkipped > 0) {
        toast({
          title: "Tidak Ada Jadwal Baru",
          description: "Semua jadwal sudah ada di blok tujuan",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error duplicating jadwal:', error);
      toast({
        title: "Gagal Duplikasi",
        description: "Terjadi kesalahan saat menduplikasi jadwal",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!sourceBlock) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5 text-primary" />
            Duplikasi Jadwal ke Blok Lain
          </DialogTitle>
          <DialogDescription>
            Duplikasi {sourceJadwal.length} jadwal dari <span className="font-semibold text-foreground">{formatBlockLabel(sourceBlock)}</span> ke blok lain
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Source Block Info */}
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
            <div className="flex items-center gap-2 text-sm">
              <Layers className="h-4 w-4 text-primary" />
              <span className="font-medium">Sumber:</span>
              <span>{formatBlockLabel(sourceBlock)}</span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {sourceJadwal.length} jadwal akan diduplikasi
            </div>
          </div>

          {/* Target Blocks Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Blok Tujuan</label>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={handleSelectAll}
              >
                {selectedBlockIds.length === targetBlocks.length ? 'Batalkan Semua' : 'Pilih Semua'}
              </Button>
            </div>

            {targetBlocks.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground text-sm rounded-lg bg-muted/50">
                <AlertCircle className="h-5 w-5 mx-auto mb-2 opacity-50" />
                Tidak ada blok lain yang tersedia
              </div>
            ) : (
              <ScrollArea className="max-h-[240px]">
                <div className="space-y-2">
                  {targetBlocks.map(block => (
                    <div
                      key={block.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedBlockIds.includes(block.id)
                          ? 'bg-primary/10 border-primary/30'
                          : 'bg-card border-border hover:bg-muted/50'
                      }`}
                      onClick={() => handleBlockToggle(block.id)}
                    >
                      <Checkbox
                        checked={selectedBlockIds.includes(block.id)}
                        onCheckedChange={() => handleBlockToggle(block.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {formatBlockLabel(block)}
                          </span>
                          {isBlockActive(block) && (
                            <Badge className="bg-green-500/20 text-green-600 border-green-500/30 text-xs py-0">
                              Aktif
                            </Badge>
                          )}
                        </div>
                      </div>
                      {selectedBlockIds.includes(block.id) && (
                        <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Warning */}
          {sourceJadwal.length === 0 && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Tidak ada jadwal di blok ini. Tambahkan jadwal terlebih dahulu sebelum menduplikasi.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Batal
          </Button>
          <Button
            onClick={handleDuplicate}
            disabled={isLoading || selectedBlockIds.length === 0 || sourceJadwal.length === 0}
            className="gap-2"
          >
            {isLoading ? (
              <>Menduplikasi...</>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Duplikasi ke {selectedBlockIds.length} Blok
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
