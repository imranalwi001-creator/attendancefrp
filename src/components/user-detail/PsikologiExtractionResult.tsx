import { useState } from 'react';
 import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { 
  Brain, 
  Sparkles, 
  FileText, 
  Loader2, 
  CheckCircle2,
  AlertCircle,
  User,
  Calendar,
  Trash2,
  Save,
  FileWarning,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ActionButtonGroup, RefreshButton, DeleteButton } from '@/components/ui/action-buttons';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface ProfilPsikologis {
  skala: string;
  skor: number;
  kategori: string;
}

interface PsikologiResult {
  id: string;
  santri_id: string;
  profil_psikologis: ProfilPsikologis[];
  analisis: string | null;
  rekomendasi: string[];
  pemeriksa: string | null;
  tanggal_pemeriksaan: string | null;
  source_url: string | null;
  extracted_at: string | null;
}

interface PsikologiExtractionResultProps {
  santriId?: string;
  documentUrls?: string[];
  result: PsikologiResult | null;
  draftResult?: PsikologiResult | null;
  hasDraft?: boolean;
  isLoading: boolean;
  isSavingDraft?: boolean;
  onExtract: () => Promise<void>;
  onDraftExtract?: () => Promise<void>;
  onSaveDraft?: () => Promise<void>;
  onClearDraft?: () => void;
  onRefresh: () => void;
  onDelete?: () => void;
}

function getCategoryBadgeVariant(kategori: string): "success" | "warning" | "destructive" {
  const normalized = kategori.toLowerCase();
  if (normalized === 'tinggi') return 'success';
  if (normalized === 'sedang') return 'warning';
  return 'destructive';
}

function getCategoryColor(kategori: string): string {
  const normalized = kategori.toLowerCase();
  if (normalized === 'tinggi') return 'bg-emerald-500';
  if (normalized === 'sedang') return 'bg-amber-500';
  return 'bg-red-500';
}

function ProfilPsikologisCard({ profil }: { profil: ProfilPsikologis[] }) {
  if (!profil || profil.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Tidak ada data profil psikologis</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {profil.map((item, index) => (
        <div key={index} className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">{item.skala}</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">{item.skor}</span>
              <Badge variant={getCategoryBadgeVariant(item.kategori)} className="text-xs">
                {item.kategori}
              </Badge>
            </div>
          </div>
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className={cn("h-full transition-all", getCategoryColor(item.kategori))}
              style={{ width: `${Math.min(100, Math.max(0, item.skor))}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function AnalisisCard({ analisis }: { analisis: string | null }) {
  if (!analisis) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Tidak ada data analisis</p>
      </div>
    );
  }

  return (
    <div className="prose prose-sm max-w-none dark:prose-invert">
      <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
        {analisis}
      </p>
    </div>
  );
}

function RekomendasiCard({ rekomendasi }: { rekomendasi: string[] }) {
  if (!rekomendasi || rekomendasi.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Tidak ada rekomendasi</p>
      </div>
    );
  }

  return (
    <ol className="space-y-3">
      {rekomendasi.map((item, index) => (
        <li key={index} className="flex gap-3">
          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center">
            {index + 1}
          </span>
          <span className="text-sm text-muted-foreground leading-relaxed">{item}</span>
        </li>
      ))}
    </ol>
  );
}

function EmptyState({ 
  hasDocument, 
  isExtracting, 
  onExtract,
  useDraftMode = false
}: { 
  hasDocument: boolean; 
  isExtracting: boolean; 
  onExtract: () => void;
  useDraftMode?: boolean;
}) {
  return (
    <div className="text-center py-12 px-4">
      <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <Brain className="h-8 w-8 text-primary" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">
        Belum Ada Data Ekstraksi
      </h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
        {hasDocument 
          ? "Upload dokumen Asesmen Awal sudah tersedia. Klik tombol di bawah untuk mengekstrak data psikologi secara otomatis."
          : "Upload dokumen Asesmen Awal terlebih dahulu untuk dapat mengekstrak data psikologi."}
      </p>
      {hasDocument && (
        <div className="space-y-2">
          <Button onClick={onExtract} disabled={isExtracting} className="gap-2">
            {isExtracting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Mengekstrak...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Ekstrak Data dengan AI
              </>
            )}
          </Button>
          {useDraftMode && (
            <p className="text-xs text-muted-foreground">
              Hasil akan disimpan sebagai draft terlebih dahulu
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function DraftBanner({ 
  onSave, 
  onDiscard, 
  onRegenerate,
  isSaving,
  isRegenerating
}: { 
  onSave: () => void; 
  onDiscard: () => void;
  onRegenerate: () => void;
  isSaving: boolean;
  isRegenerating: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 mb-4">
      <div className="flex items-center gap-2">
        <FileWarning className="h-5 w-5 text-amber-600" />
        <div>
          <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Draft Tersimpan Lokal</p>
          <p className="text-xs text-amber-600/80 dark:text-amber-400/80">Data belum disimpan ke database</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onRegenerate}
          disabled={isSaving || isRegenerating}
          className="gap-1.5 text-xs"
        >
          {isRegenerating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Generate Ulang
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={isSaving || isRegenerating}
              className="gap-1.5 text-xs text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Buang Draft
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Buang Draft?</AlertDialogTitle>
              <AlertDialogDescription>
                Draft hasil ekstraksi akan dihapus. Anda perlu mengekstrak ulang jika ingin data baru.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Batal</AlertDialogCancel>
              <AlertDialogAction onClick={onDiscard} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Buang
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Button
          size="sm"
          onClick={onSave}
          disabled={isSaving || isRegenerating}
          className="gap-1.5 text-xs"
        >
          {isSaving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          Simpan ke Database
        </Button>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-2">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-2 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ResultContent({ result }: { result: PsikologiResult }) {
  return (
    <div className="space-y-5">
      {/* Profil Psikologis Section */}
      <div className="p-4 rounded-xl bg-muted/30">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
            <Brain className="h-4 w-4 text-primary" />
          </div>
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Profil Psikologis</span>
        </div>
        <ProfilPsikologisCard profil={result.profil_psikologis as ProfilPsikologis[]} />
      </div>

      {/* Analisis Section */}
      <div className="p-4 rounded-xl bg-muted/30">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
            <FileText className="h-4 w-4 text-primary" />
          </div>
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Analisis</span>
        </div>
        <AnalisisCard analisis={result.analisis} />
      </div>

      {/* Rekomendasi Section */}
      <div className="p-4 rounded-xl bg-muted/30">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
            <CheckCircle2 className="h-4 w-4 text-primary" />
          </div>
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Rekomendasi</span>
        </div>
        <RekomendasiCard rekomendasi={result.rekomendasi} />
      </div>

      {/* Metadata Footer */}
      {(result.pemeriksa || result.tanggal_pemeriksaan) && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-4 border-t">
          {result.pemeriksa && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <User className="h-3.5 w-3.5" />
              <span>{result.pemeriksa}</span>
            </div>
          )}
          {result.tanggal_pemeriksaan && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span>
                {format(new Date(result.tanggal_pemeriksaan), 'dd MMMM yyyy', { locale: idLocale })}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function PsikologiExtractionResult({
  santriId,
  documentUrls,
  result,
  draftResult,
  hasDraft = false,
  isLoading,
  isSavingDraft = false,
  onExtract,
  onDraftExtract,
  onSaveDraft,
  onClearDraft,
  onRefresh,
  onDelete,
}: PsikologiExtractionResultProps) {
  const [isExtracting, setIsExtracting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleExtract = async () => {
    if (!santriId || !documentUrls || documentUrls.length === 0) {
      toast.error('Dokumen Asesmen Awal belum diupload');
      return;
    }

    setIsExtracting(true);
    try {
      await onExtract();
    } catch (error) {
      console.error('Extraction error:', error);
      toast.error('Gagal mengekstrak data psikologi');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleDraftExtract = async () => {
    if (!onDraftExtract) return;
    
    setIsExtracting(true);
    try {
      await onDraftExtract();
    } catch (error) {
      console.error('Draft extraction error:', error);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleDelete = async () => {
    if (!result?.id) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('santri_psikologi_results')
        .delete()
        .eq('id', result.id);

      if (error) throw error;

      toast.success('Data hasil ekstraksi berhasil dihapus');
      onDelete?.();
      onRefresh();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Gagal menghapus data hasil ekstraksi');
    } finally {
      setIsDeleting(false);
    }
  };

  const hasDocument = documentUrls && documentUrls.length > 0;
  const hasResult = !!result;
  const displayResult = result || draftResult;

   return (
     <Card className="rounded-2xl border-0 shadow-md overflow-hidden">
       <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent" />
         <div className="relative px-4 py-3 flex items-center justify-between">
           <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center">
                <FileText className="h-4 w-4 text-primary" />
             </div>
             <span className="font-semibold text-foreground">Asesmen Awal</span>
           </div>
           <div className="flex items-center gap-2">
             {hasDraft && !hasResult && <Badge variant="warning" className="text-xs">Draft</Badge>}
             {hasResult && (
                <ActionButtonGroup>
                  <RefreshButton 
                    onClick={handleExtract} 
                    disabled={isExtracting || !hasDocument} 
                    isLoading={isExtracting}
                    title="Ekstrak Ulang"
                  />
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <DeleteButton disabled={isDeleting} title="Hapus Data Psikologi" />
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Hapus Data Hasil Ekstraksi?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Data hasil ekstraksi psikologi akan dihapus secara permanen. Anda dapat mengekstrak ulang data dari dokumen yang tersedia.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Hapus
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </ActionButtonGroup>
             )}
           </div>
         </div>
       </div>
       <CardContent className="pt-4">
        {isLoading ? (
          <LoadingSkeleton />
        ) : !displayResult ? (
          <EmptyState 
            hasDocument={hasDocument} 
            isExtracting={isExtracting} 
            onExtract={onDraftExtract ? handleDraftExtract : handleExtract}
            useDraftMode={!!onDraftExtract}
          />
        ) : (
          <>
            {/* Draft Banner */}
            {hasDraft && !hasResult && onSaveDraft && onClearDraft && (
              <DraftBanner 
                onSave={onSaveDraft}
                onDiscard={onClearDraft}
                onRegenerate={handleDraftExtract}
                isSaving={isSavingDraft}
                isRegenerating={isExtracting}
              />
            )}
            
            <ResultContent result={displayResult} />
          </>
        )}
       </CardContent>
     </Card>
  );
}
