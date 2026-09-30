 import { useState, useEffect, useCallback } from 'react';
 import { Card, CardContent } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
 import { Badge } from '@/components/ui/badge';
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
   Sparkles, 
   Loader2, 
   CheckCircle2,
   AlertCircle,
   User,
   Calendar,
   Trash2,
   Save,
   FileWarning,
   Brain,
   Lightbulb,
   AlertTriangle,
   GraduationCap,
  Briefcase,
  RefreshCw
 } from 'lucide-react';
import { ActionButtonGroup, RefreshButton, DeleteButton } from '@/components/ui/action-buttons';
 import { cn } from '@/lib/utils';
 import { supabase } from '@/integrations/supabase/client';
 import { toast } from 'sonner';
 import { format } from 'date-fns';
 import { id as idLocale } from 'date-fns/locale';
 
 export interface StifinResult {
   id: string;
   santri_id: string;
   tipe_stifin: string;
   kecerdasan_dominan: string | null;
   deskripsi: string | null;
   kekuatan: string[];
   kelemahan: string[];
   gaya_belajar: string | null;
   karir_cocok: string[];
   pemeriksa: string | null;
   tanggal_pemeriksaan: string | null;
   source_url: string | null;
   extracted_at: string | null;
 }
 
 interface StifinExtractionResultProps {
   santriId?: string;
   documentUrl?: string;
 }
 
 const getDraftKey = (santriId: string) => `stifin_draft_${santriId}`;
 
 function getStifinColor(tipe: string): string {
   const t = tipe?.toLowerCase() || '';
   if (t.startsWith('in')) return 'bg-emerald-500';
   if (t.startsWith('s')) return 'bg-amber-500';
   if (t.startsWith('t')) return 'bg-sky-500';
   if (t.startsWith('i')) return 'bg-violet-500';
   if (t.startsWith('f')) return 'bg-rose-500';
   return 'bg-primary/90';
 }
 
 function ListCard({ title, icon: Icon, items }: { title: string; icon: any; items: string[] }) {
   if (!items || items.length === 0) {
     return (
      <div className="flex items-center justify-center py-6 text-muted-foreground/60">
        <p className="text-xs italic">Tidak ada data</p>
       </div>
     );
   }
 
   return (
    <ul className="space-y-2">
         {items.map((item, index) => (
          <li key={index} className="flex items-start gap-2.5 text-sm">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-medium flex items-center justify-center mt-0.5">
               {index + 1}
             </span>
            <span className="text-foreground/80 leading-relaxed">{item}</span>
           </li>
         ))}
       </ul>
   );
 }
 
 function DraftBanner({ onSave, onDiscard, onRegenerate, isSaving, isRegenerating }: { 
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
         <Button variant="outline" size="sm" onClick={onRegenerate} disabled={isSaving || isRegenerating} className="gap-1.5 text-xs">
           {isRegenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
           Generate Ulang
         </Button>
         <AlertDialog>
           <AlertDialogTrigger asChild>
             <Button variant="outline" size="sm" disabled={isSaving || isRegenerating} className="gap-1.5 text-xs text-destructive hover:text-destructive">
               <Trash2 className="h-3.5 w-3.5" />
               Buang Draft
             </Button>
           </AlertDialogTrigger>
           <AlertDialogContent>
             <AlertDialogHeader>
               <AlertDialogTitle>Buang Draft?</AlertDialogTitle>
               <AlertDialogDescription>Draft hasil ekstraksi akan dihapus.</AlertDialogDescription>
             </AlertDialogHeader>
             <AlertDialogFooter>
               <AlertDialogCancel>Batal</AlertDialogCancel>
               <AlertDialogAction onClick={onDiscard} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Buang</AlertDialogAction>
             </AlertDialogFooter>
           </AlertDialogContent>
         </AlertDialog>
         <Button size="sm" onClick={onSave} disabled={isSaving || isRegenerating} className="gap-1.5 text-xs">
           {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
           Simpan ke Database
         </Button>
       </div>
     </div>
   );
 }
 
 function ResultContent({ result }: { result: StifinResult }) {
   return (
    <div className="space-y-5">
      {/* Hero: Tipe STIFIn */}
      <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/30">
        <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center">
          <Brain className="h-7 w-7 text-primary" />
         </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="text-base font-semibold text-foreground">{result.kecerdasan_dominan || result.tipe_stifin}</h3>
            <Badge variant="secondary" className="text-xs font-medium">{result.tipe_stifin}</Badge>
          </div>
          {result.deskripsi && (
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{result.deskripsi}</p>
          )}
         </div>
       </div>
 
       {/* Gaya Belajar */}
       {result.gaya_belajar && (
        <div className="p-4 rounded-xl bg-muted/30">
          <div className="flex items-center gap-2 mb-2">
            <GraduationCap className="h-4 w-4 text-primary/70" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Gaya Belajar</span>
           </div>
          <p className="text-sm text-foreground/80 leading-relaxed">{result.gaya_belajar}</p>
         </div>
       )}
 
       {/* Kekuatan & Kelemahan */}
       <div className="grid md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl bg-muted/30">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="h-4 w-4 text-primary/70" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Kekuatan</span>
          </div>
          <ListCard title="Kekuatan" icon={Lightbulb} items={result.kekuatan} />
         </div>
        <div className="p-4 rounded-xl bg-muted/30">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-primary/70" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Kelemahan</span>
          </div>
          <ListCard title="Kelemahan" icon={AlertTriangle} items={result.kelemahan} />
         </div>
       </div>
 
       {/* Karir Cocok */}
      <div className="p-4 rounded-xl bg-muted/30">
        <div className="flex items-center gap-2 mb-3">
          <Briefcase className="h-4 w-4 text-primary/70" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Karir yang Cocok</span>
         </div>
         {result.karir_cocok && result.karir_cocok.length > 0 ? (
           <div className="flex flex-wrap gap-2">
             {result.karir_cocok.map((karir, index) => (
              <Badge key={index} variant="secondary" className="text-xs font-normal">{karir}</Badge>
             ))}
           </div>
         ) : (
          <p className="text-xs text-muted-foreground/60 italic">Tidak ada data</p>
         )}
       </div>

      {/* Metadata - Pemeriksa */}
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
 
 export function StifinExtractionResult({ santriId, documentUrl }: StifinExtractionResultProps) {
   const [result, setResult] = useState<StifinResult | null>(null);
   const [draftResult, setDraftResult] = useState<StifinResult | null>(null);
   const [hasDraft, setHasDraft] = useState(false);
   const [isLoading, setIsLoading] = useState(false);
   const [isExtracting, setIsExtracting] = useState(false);
   const [isSaving, setIsSaving] = useState(false);
   const [isDeleting, setIsDeleting] = useState(false);
 
   const loadDraft = useCallback(() => {
     if (!santriId) return null;
     try {
       const storedDraft = localStorage.getItem(getDraftKey(santriId));
       if (storedDraft) return JSON.parse(storedDraft) as StifinResult;
     } catch (error) { console.error('Error loading draft:', error); }
     return null;
   }, [santriId]);
 
   const saveDraft = useCallback((data: StifinResult) => {
     if (!santriId) return;
     try {
       localStorage.setItem(getDraftKey(santriId), JSON.stringify(data));
       setDraftResult(data);
       setHasDraft(true);
     } catch (error) { console.error('Error saving draft:', error); }
   }, [santriId]);
 
   const clearDraft = useCallback(() => {
     if (!santriId) return;
     try {
       localStorage.removeItem(getDraftKey(santriId));
       setDraftResult(null);
       setHasDraft(false);
     } catch (error) { console.error('Error clearing draft:', error); }
   }, [santriId]);
 
   const fetchResult = useCallback(async () => {
     if (!santriId) return;
     setIsLoading(true);
     try {
       const { data, error } = await supabase
         .from('santri_stifin_results')
         .select('*')
         .eq('santri_id', santriId)
         .maybeSingle();
 
       if (error) {
         console.error('Error fetching stifin result:', error);
       } else if (data) {
         setResult(data as StifinResult);
         clearDraft();
       } else {
         const draft = loadDraft();
         if (draft) {
           setDraftResult(draft);
           setHasDraft(true);
         }
       }
     } catch (err) { console.error('Error:', err); }
     finally { setIsLoading(false); }
   }, [santriId, clearDraft, loadDraft]);
 
   useEffect(() => { fetchResult(); }, [fetchResult]);
 
   const handleExtract = async (isDraft = false) => {
     if (!santriId || !documentUrl) {
       toast.error('Dokumen STIFIN belum tersedia');
       return;
     }
 
     setIsExtracting(true);
     try {
       const { data, error } = await supabase.functions.invoke('extract-stifin-data', {
         body: { santri_id: santriId, document_url: documentUrl, draft_only: isDraft },
       });
 
       if (error) throw error;
 
       if (data?.success) {
         if (isDraft) {
           saveDraft(data.data);
           toast.success('Data STIFIN berhasil diekstrak (Draft)');
         } else {
           setResult(data.data);
           clearDraft();
           toast.success('Data STIFIN berhasil diekstrak dan disimpan');
         }
       } else {
         throw new Error(data?.error || 'Extraction failed');
       }
     } catch (error) {
       console.error('Extraction error:', error);
       toast.error('Gagal mengekstrak data STIFIN');
     } finally { setIsExtracting(false); }
   };
 
   const handleSaveDraft = async () => {
     if (!draftResult || !santriId) return;
     setIsSaving(true);
     try {
       const { data, error } = await supabase
         .from('santri_stifin_results')
         .upsert({
           santri_id: santriId,
           tipe_stifin: draftResult.tipe_stifin,
           kecerdasan_dominan: draftResult.kecerdasan_dominan,
           deskripsi: draftResult.deskripsi,
           kekuatan: draftResult.kekuatan,
           kelemahan: draftResult.kelemahan,
           gaya_belajar: draftResult.gaya_belajar,
           karir_cocok: draftResult.karir_cocok,
           pemeriksa: draftResult.pemeriksa,
           tanggal_pemeriksaan: draftResult.tanggal_pemeriksaan,
           source_url: draftResult.source_url,
           extracted_at: new Date().toISOString(),
         }, { onConflict: 'santri_id' })
         .select()
         .single();
 
       if (error) throw error;
       setResult(data as StifinResult);
       clearDraft();
       toast.success('Draft STIFIN berhasil disimpan ke database');
     } catch (error) {
       console.error('Save draft error:', error);
       toast.error('Gagal menyimpan draft');
     } finally { setIsSaving(false); }
   };
 
   const handleDelete = async () => {
     if (!result?.id) return;
     setIsDeleting(true);
     try {
       const { error } = await supabase.from('santri_stifin_results').delete().eq('id', result.id);
       if (error) throw error;
       setResult(null);
       toast.success('Data STIFIN berhasil dihapus');
     } catch (error) {
       console.error('Delete error:', error);
       toast.error('Gagal menghapus data STIFIN');
     } finally { setIsDeleting(false); }
   };
 
   const hasDocument = !!documentUrl;
   const hasResult = !!result;
   const displayResult = result || draftResult;
 
   return (
     <Card className="rounded-2xl border-0 shadow-md overflow-hidden">
       <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent" />
         <div className="relative px-4 py-3 flex items-center justify-between">
           <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <Brain className="h-4 w-4 text-primary" />
             </div>
             <span className="font-semibold text-foreground">Hasil Ekstraksi STIFIN</span>
           </div>
           <div className="flex items-center gap-2">
             {hasDraft && !hasResult && <Badge variant="warning" className="text-xs">Draft</Badge>}
             {hasResult && (
                <ActionButtonGroup>
                  <RefreshButton 
                    onClick={() => handleExtract(false)} 
                    disabled={isExtracting || !hasDocument} 
                    isLoading={isExtracting}
                    title="Ekstrak Ulang"
                  />
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <DeleteButton disabled={isDeleting} title="Hapus Data STIFIN" />
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Hapus Data STIFIN?</AlertDialogTitle>
                        <AlertDialogDescription>Data hasil ekstraksi STIFIN akan dihapus permanen.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Hapus</AlertDialogAction>
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
           <div className="space-y-4">
             <Skeleton className="h-24 w-full" />
             <div className="grid md:grid-cols-2 gap-4">
               <Skeleton className="h-32 w-full" />
               <Skeleton className="h-32 w-full" />
             </div>
           </div>
         ) : displayResult ? (
           <>
             {hasDraft && !hasResult && (
               <DraftBanner 
                 onSave={handleSaveDraft} 
                 onDiscard={clearDraft} 
                 onRegenerate={() => handleExtract(true)}
                 isSaving={isSaving}
                 isRegenerating={isExtracting}
               />
             )}
             <ResultContent result={displayResult} />
           </>
         ) : (
           <div className="text-center py-12 px-4">
             <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
               <Brain className="h-8 w-8 text-primary" />
             </div>
             <h3 className="text-lg font-semibold text-foreground mb-2">Belum Ada Data Ekstraksi STIFIN</h3>
             <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
               {hasDocument 
                 ? "Dokumen STIFIN sudah tersedia. Klik tombol di bawah untuk mengekstrak data."
                 : "Upload dokumen STIFIN terlebih dahulu untuk dapat mengekstrak data."}
             </p>
             {hasDocument && (
               <Button onClick={() => handleExtract(true)} disabled={isExtracting} className="gap-2">
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
             )}
           </div>
         )}
       </CardContent>
     </Card>
   );
 }