import { useState, useEffect } from 'react';
import { ArrowRightLeft, Layers, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { LearningBlock } from '@/hooks/useLearningBlocks';

interface MoveToBlockModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jadwal: any | null;
  jadwalLabel?: string;
  sourceBlock: LearningBlock | null;
  allBlocks: LearningBlock[];
  kelasId: string;
  formatBlockLabel: (block: LearningBlock) => string;
  isBlockActive: (block: LearningBlock) => boolean;
  onSuccess: () => void;
}

export function MoveToBlockModal({
  open,
  onOpenChange,
  jadwal,
  jadwalLabel,
  sourceBlock,
  allBlocks,
  kelasId,
  formatBlockLabel,
  isBlockActive,
  onSuccess,
}: MoveToBlockModalProps) {
  const [targetBlockId, setTargetBlockId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open) setTargetBlockId(null);
  }, [open]);

  const targetBlocks = allBlocks.filter((b) => b.id !== sourceBlock?.id);

  const handleMove = async () => {
    if (!jadwal?.id) return;
    if (!targetBlockId) {
      toast({
        title: 'Pilih Fase Tujuan',
        description: 'Silakan pilih satu fase tujuan untuk memindahkan jadwal',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      // Cek konflik di fase tujuan (hari + jam + mapel sama)
      const hari = jadwal.hari;
      const jamMulai = jadwal.jamMulai || jadwal.jam_mulai;
      const jamSelesai = jadwal.jamSelesai || jadwal.jam_selesai;
      const mapelId = jadwal.mapelId || jadwal.mapel_id;

      const { data: conflict } = await supabase
        .from('jadwal')
        .select('id')
        .eq('kelas_id', kelasId)
        .eq('block_id', targetBlockId)
        .eq('hari', hari)
        .eq('jam_mulai', jamMulai)
        .eq('jam_selesai', jamSelesai)
        .eq('mapel_id', mapelId)
        .limit(1);

      if (conflict && conflict.length > 0) {
        toast({
          title: 'Jadwal Sudah Ada',
          description: 'Jadwal serupa (hari, jam, mapel) sudah ada di fase tujuan.',
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      const { error } = await supabase
        .from('jadwal')
        .update({ block_id: targetBlockId })
        .eq('id', jadwal.id);

      if (error) throw error;

      toast({
        title: 'Pemindahan Berhasil',
        description: 'Jadwal berhasil dipindahkan ke fase tujuan.',
      });
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      console.error('Error moving jadwal:', err);
      toast({
        title: 'Gagal Memindahkan',
        description: 'Terjadi kesalahan saat memindahkan jadwal.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!jadwal) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
            Pindahkan Jadwal ke Fase Lain
          </DialogTitle>
          <DialogDescription>
            Pindahkan jadwal{' '}
            <span className="font-semibold text-foreground">
              {jadwalLabel || 'ini'}
            </span>{' '}
            dari fase asal ke fase lain.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Source Info */}
          {sourceBlock && (
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
              <div className="flex items-center gap-2 text-sm">
                <Layers className="h-4 w-4 text-primary" />
                <span className="font-medium">Sumber:</span>
                <span>{formatBlockLabel(sourceBlock)}</span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {jadwal.hari} • {jadwal.jamMulai || jadwal.jam_mulai} - {jadwal.jamSelesai || jadwal.jam_selesai}
              </div>
            </div>
          )}

          {/* Target selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Fase Tujuan</label>

            {targetBlocks.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground text-sm rounded-lg bg-muted/50">
                <AlertCircle className="h-5 w-5 mx-auto mb-2 opacity-50" />
                Tidak ada fase lain yang tersedia
              </div>
            ) : (
              <ScrollArea className="max-h-[240px]">
                <div className="space-y-2">
                  {targetBlocks.map((block) => {
                    const selected = targetBlockId === block.id;
                    return (
                      <div
                        key={block.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          selected
                            ? 'bg-primary/10 border-primary/30'
                            : 'bg-card border-border hover:bg-muted/50'
                        }`}
                        onClick={() => setTargetBlockId(block.id)}
                      >
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
                        {selected && (
                          <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Batal
          </Button>
          <Button
            onClick={handleMove}
            disabled={isLoading || !targetBlockId}
            className="gap-2"
          >
            {isLoading ? (
              <>Memindahkan...</>
            ) : (
              <>
                <ArrowRightLeft className="h-4 w-4" />
                Pindahkan
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
