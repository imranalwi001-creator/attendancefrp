import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { 
  ArrowLeft, Brain, Sparkles, Save, AlertTriangle, 
  CheckCircle2, XCircle, Trophy, AlertOctagon, Loader2,
  Check, Pencil, FileText, Home, ScrollText, TrendingUp,
  TrendingDown, Minus, X, Trash2, RefreshCw
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAcademicYear } from '@/contexts/AcademicYearContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

type LanguageStyle = 'formal' | 'motivasi' | 'tegas';

interface StifinData {
  id: string;
  tipe_stifin?: string | null;
  kecerdasan_dominan?: string | null;
  deskripsi?: string | null;
  kekuatan?: string[];
  kelemahan?: string[];
  gaya_belajar?: string | null;
  karir_cocok?: string[];
  pemeriksa?: string | null;
  tanggal_pemeriksaan?: string | null;
}

interface AffectiveDetail {
  indicator_id: string;
  indicator_name: string;
  category_name: string;
  score: number;
  notes: string | null;
}

interface KonselingLog {
  id: string;
  date: string;
  title: string;
  type: 'pelanggaran' | 'prestasi';
  point: number;
}

interface SavedReport {
  id: string;
  summary: string;
  language_style: string;
  updated_at: string;
}

export default function DetailPsikologiSantri() {
  const { kelasId, santriId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { activeAcademicYear, currentSemester } = useAcademicYear();

  const [reportSummary, setReportSummary] = useState('');
  const [languageStyle, setLanguageStyle] = useState<LanguageStyle>('motivasi');
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [originalSummary, setOriginalSummary] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [draftSummary, setDraftSummary] = useState('');
  const [hasDraft, setHasDraft] = useState(false);

  // Draft storage key
  const getDraftKey = () => `psikologi_summary_draft_${santriId}_${activeAcademicYear?.id}_${currentSemester}`;

  // Load draft from localStorage
  const loadDraft = () => {
    if (!santriId || !activeAcademicYear?.id) return null;
    try {
      const storedDraft = localStorage.getItem(getDraftKey());
      if (storedDraft) {
        return JSON.parse(storedDraft) as { summary: string; languageStyle: LanguageStyle };
      }
    } catch (error) {
      console.error('Error loading draft:', error);
    }
    return null;
  };

  // Save draft to localStorage
  const saveDraftToStorage = (summary: string, style: LanguageStyle) => {
    if (!santriId || !activeAcademicYear?.id) return;
    try {
      localStorage.setItem(getDraftKey(), JSON.stringify({ summary, languageStyle: style }));
      setHasDraft(true);
    } catch (error) {
      console.error('Error saving draft:', error);
    }
  };

  // Clear draft from localStorage
  const clearDraft = () => {
    if (!santriId || !activeAcademicYear?.id) return;
    try {
      localStorage.removeItem(getDraftKey());
      setHasDraft(false);
      setDraftSummary('');
    } catch (error) {
      console.error('Error clearing draft:', error);
    }
  };


  // Fetch santri profile with kelas
  const { data: santriData, isLoading: isLoadingSantri } = useQuery({
    queryKey: ['detail-psikologi-santri', santriId],
    queryFn: async () => {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .eq('id', santriId)
        .single();
      
      if (profileError) throw profileError;

      const { data: santri, error: santriError } = await supabase
        .from('santri')
        .select(`
          id,
          nis,
          kelas:kelas_id(id, nama, tingkat)
        `)
        .eq('id', santriId)
        .single();

      if (santriError) throw santriError;

      return {
        ...profile,
        nis: santri?.nis,
        kelas: santri?.kelas as { id: string; nama: string; tingkat: string } | null
      };
    },
    enabled: !!santriId,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch STIFIN & Asesmen Awal from santri_psikologi_results
  const { data: psikologiResult, isLoading: isLoadingPsikologi } = useQuery({
    queryKey: ['detail-psikologi-results', santriId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('santri_psikologi_results')
        .select('profil_psikologis, analisis, rekomendasi')
        .eq('santri_id', santriId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!santriId,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch STIFIN data from santri_stifin_results
  const { data: stifinResult, isLoading: isLoadingStifin } = useQuery({
    queryKey: ['detail-stifin-results', santriId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('santri_stifin_results')
        .select('*')
        .eq('santri_id', santriId)
        .maybeSingle();

      if (error) throw error;
      return data as StifinData | null;
    },
    enabled: !!santriId,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch existing saved report
  const { data: savedReport, isLoading: isLoadingSavedReport } = useQuery({
    queryKey: ['psikologi-report', santriId, activeAcademicYear?.id, currentSemester],
    queryFn: async () => {
      if (!activeAcademicYear?.id) return null;

      const { data, error } = await supabase
        .from('santri_psikologi_reports')
        .select('id, summary, language_style, updated_at')
        .eq('santri_id', santriId)
        .eq('academic_year_id', activeAcademicYear.id)
        .eq('semester', currentSemester || 'ganjil')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      return data as SavedReport | null;
    },
    enabled: !!santriId && !!activeAcademicYear?.id,
    staleTime: 2 * 60 * 1000,
  });

  // Load saved report into state when fetched
  useEffect(() => {
    if (savedReport) {
      setReportSummary(savedReport.summary);
      setOriginalSummary(savedReport.summary);
      setLanguageStyle(savedReport.language_style as LanguageStyle);
      setHasUnsavedChanges(false);
      // Clear any existing draft since we have saved data
      clearDraft();
    }
  }, [savedReport]);

  // Check for existing draft on mount (only if no saved report)
  useEffect(() => {
    if (!santriId || !activeAcademicYear?.id) return;
    if (isLoadingSavedReport) return; // Wait until loaded
    
    // Only load draft if no saved report exists
    if (!savedReport) {
      const draft = loadDraft();
      if (draft) {
        setDraftSummary(draft.summary);
        setLanguageStyle(draft.languageStyle);
        setHasDraft(true);
      }
    }
  }, [santriId, activeAcademicYear?.id, currentSemester, savedReport, isLoadingSavedReport]);

  // Track unsaved changes
  useEffect(() => {
    if (originalSummary || savedReport) {
      setHasUnsavedChanges(reportSummary !== originalSummary);
    } else if (reportSummary) {
      setHasUnsavedChanges(true);
    }
  }, [reportSummary, originalSummary, savedReport]);

  // Save report mutation
  const saveReportMutation = useMutation({
    mutationFn: async (summaryToSave?: string) => {
      const finalSummary = summaryToSave || reportSummary;
      if (!santriId || !activeAcademicYear?.id || !finalSummary.trim()) {
        throw new Error('Data tidak lengkap');
      }

      const { data: { user } } = await supabase.auth.getUser();

      const payload = {
        santri_id: santriId,
        academic_year_id: activeAcademicYear.id,
        semester: currentSemester || 'ganjil',
        summary: finalSummary.trim(),
        language_style: languageStyle,
        created_by: user?.id || null
      };

      if (savedReport?.id) {
        // Update existing
        const { error } = await supabase
          .from('santri_psikologi_reports')
          .update({
            summary: payload.summary,
            language_style: payload.language_style
          })
          .eq('id', savedReport.id);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('santri_psikologi_reports')
          .insert(payload);

        if (error) throw error;
      }
      
      return finalSummary;
    },
    onSuccess: (savedSummary) => {
      queryClient.invalidateQueries({ queryKey: ['psikologi-report', santriId] });
      setReportSummary(savedSummary);
      setOriginalSummary(savedSummary);
      setHasUnsavedChanges(false);
      setIsDrawerOpen(false);
      toast.success('Ringkasan berhasil disimpan');
    },
    onError: (error: any) => {
      console.error('Save error:', error);
      toast.error(error.message || 'Gagal menyimpan ringkasan');
    }
  });

  // Delete report mutation
  const deleteReportMutation = useMutation({
    mutationFn: async () => {
      if (!savedReport?.id) {
        throw new Error('Tidak ada ringkasan untuk dihapus');
      }

      const { error } = await supabase
        .from('santri_psikologi_reports')
        .delete()
        .eq('id', savedReport.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['psikologi-report', santriId] });
      setReportSummary('');
      setOriginalSummary('');
      setHasUnsavedChanges(false);
      toast.success('Ringkasan berhasil dihapus');
    },
    onError: (error: any) => {
      console.error('Delete error:', error);
      toast.error(error.message || 'Gagal menghapus ringkasan');
    }
  });

  const { data: affectiveData, isLoading: isLoadingAffective } = useQuery({
    queryKey: ['detail-affective-scores', santriId, activeAcademicYear?.id, currentSemester],
    queryFn: async () => {
      if (!activeAcademicYear?.id) return null;

      const { data: scores, error } = await supabase
        .from('affective_scores')
        .select(`
          id,
          score,
          notes,
          indicator_id,
          affective_indicators!inner(
            id,
            name,
            affective_categories!inner(id, name)
          )
        `)
        .eq('santri_id', santriId)
        .eq('academic_year_id', activeAcademicYear.id)
        .eq('semester', currentSemester || 'ganjil');

      if (error) throw error;

      if (!scores || scores.length === 0) return null;

      // Calculate average and map details
      const totalScore = scores.reduce((sum, s) => sum + s.score, 0);
      const avgScore = Math.round(totalScore / scores.length);

      const details: AffectiveDetail[] = scores.map(s => {
        const indicator = s.affective_indicators as { id: string; name: string; affective_categories: { id: string; name: string } };
        return {
          indicator_id: s.indicator_id,
          indicator_name: indicator?.name || '',
          category_name: indicator?.affective_categories?.name || '',
          score: s.score,
          notes: s.notes
        };
      });

      // Group by category
      const grouped = details.reduce((acc, d) => {
        if (!acc[d.category_name]) {
          acc[d.category_name] = [];
        }
        acc[d.category_name].push(d);
        return acc;
      }, {} as Record<string, AffectiveDetail[]>);

      return {
        totalScore: avgScore,
        details,
        grouped
      };
    },
    enabled: !!santriId && !!activeAcademicYear?.id,
    staleTime: 2 * 60 * 1000,
  });

  // Fetch Konseling Records
  const { data: konselingData, isLoading: isLoadingKonseling } = useQuery({
    queryKey: ['detail-konseling-records', santriId, activeAcademicYear?.id, currentSemester],
    queryFn: async () => {
      if (!activeAcademicYear?.id) return null;

      const { data, error } = await supabase
        .from('konseling_records')
        .select('id, tipe, kategori, poin, tanggal')
        .eq('santri_id', santriId)
        .eq('academic_year_id', activeAcademicYear.id)
        .eq('semester', currentSemester || 'ganjil')
        .order('tanggal', { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) return null;

      const logs: KonselingLog[] = data.map(r => ({
        id: r.id,
        date: r.tanggal,
        title: r.kategori,
        type: r.tipe as 'pelanggaran' | 'prestasi',
        point: r.poin
      }));

      // Calculate net points (prestasi positive, pelanggaran negative)
      const prestasiPoints = logs.filter(l => l.type === 'prestasi').reduce((sum, l) => sum + l.point, 0);
      const pelanggaranPoints = logs.filter(l => l.type === 'pelanggaran').reduce((sum, l) => sum + l.point, 0);
      const totalPoints = 100 - pelanggaranPoints + prestasiPoints; // Start from 100

      return {
        totalPoints: Math.max(0, Math.min(totalPoints, 200)), // Clamp between 0-200
        prestasiPoints,
        pelanggaranPoints,
        logs
      };
    },
    enabled: !!santriId && !!activeAcademicYear?.id,
    staleTime: 2 * 60 * 1000,
  });

  // Use STIFIN data directly from the dedicated table
  const stifinData = stifinResult;

  // Parse Asesmen Awal data
  const asesmenData = useMemo(() => {
    if (!psikologiResult?.analisis) return null;
    return {
      summary: psikologiResult.analisis,
      recommendations: psikologiResult.rekomendasi || []
    };
  }, [psikologiResult]);

  // Generate AI Summary
  const generateSummary = async () => {
    if (!santriData || !activeAcademicYear) {
      toast.error('Data santri tidak lengkap');
      return;
    }

    setIsGenerating(true);
    setIsDrawerOpen(true);
    setDraftSummary('');
    
    try {
      const payload = {
        student: {
          name: santriData.name,
          class: santriData.kelas?.nama || ''
        },
        stifin: stifinData,
        assessment: asesmenData,
        dorm: affectiveData ? {
          totalScore: affectiveData.totalScore,
          details: affectiveData.details.map(d => ({
            indicator: d.indicator_name,
            category: d.category_name,
            score: d.score
          }))
        } : null,
        counseling: konselingData ? {
          totalPoints: konselingData.totalPoints,
          prestasiPoints: konselingData.prestasiPoints,
          pelanggaranPoints: konselingData.pelanggaranPoints,
          logs: konselingData.logs.slice(0, 10) // Limit to 10 recent logs
        } : null,
        languageStyle
      };

      const { data, error } = await supabase.functions.invoke('generate-psikologi-summary', {
        body: payload
      });

      if (error) throw error;

      if (data?.summary) {
        setDraftSummary(data.summary);
        toast.success('Ringkasan berhasil di-generate');
      } else {
        throw new Error('No summary returned');
      }
    } catch (error: any) {
      console.error('Generate summary error:', error);
      toast.error(error.message || 'Gagal generate ringkasan');
      setIsDrawerOpen(false);
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle save from drawer
  const handleSaveFromDrawer = () => {
    // Pass draftSummary directly to mutation, then clear draft
    saveReportMutation.mutate(draftSummary, {
      onSuccess: () => {
        clearDraft();
      }
    });
  };

  // Handle cancel from drawer - save as draft to localStorage
  const handleCancelDrawer = () => {
    if (draftSummary.trim()) {
      saveDraftToStorage(draftSummary, languageStyle);
      toast.info('Ringkasan disimpan sebagai draft');
    }
    setIsDrawerOpen(false);
  };

  // Handle discard draft
  const handleDiscardDraft = () => {
    clearDraft();
    setIsDrawerOpen(false);
  };

  const isLoading = isLoadingSantri || isLoadingPsikologi || isLoadingAffective || isLoadingKonseling || isLoadingSavedReport;

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Skeleton className="h-32 rounded-3xl" />
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-6">
            <Skeleton className="h-48 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-48 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!santriData) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Data santri tidak ditemukan</p>
            <Button onClick={() => navigate(-1)} className="mt-4">
              Kembali
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="rounded-2xl bg-primary p-4 md:p-6 shadow-lg">
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => navigate(`/admin/penilaian/kelas/${kelasId}/psikologi`)} 
            className="rounded-xl h-10 w-10 shrink-0 border-2 border-white/20 bg-white/10 backdrop-blur-sm hover:bg-white/20 hover:border-white/30 transition-all duration-200"
          >
            <ArrowLeft className="h-4 w-4 text-white" />
          </Button>
          
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="p-2.5 rounded-xl bg-white/10 backdrop-blur-sm shrink-0">
              <Brain className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg md:text-xl font-bold text-white truncate">{santriData.name}</h2>
              <div className="flex items-center gap-2 text-sm text-white/70">
                <span className="inline-block w-2 h-2 rounded-full bg-white"></span>
                <span className="truncate">{santriData.kelas?.nama || 'Tanpa Kelas'}</span>
                {santriData.nis && (
                  <>
                    <span className="text-white/40">•</span>
                    <span>NIS: {santriData.nis}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <Button
            onClick={() => saveReportMutation.mutate(reportSummary)}
            disabled={saveReportMutation.isPending || !reportSummary.trim()}
            className="gap-2 rounded-xl border-2 border-white/20 bg-white/10 backdrop-blur-sm hover:bg-white/20 hover:border-white/30 text-white transition-all duration-200"
          >
            {saveReportMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : hasUnsavedChanges ? (
              <Save className="h-4 w-4" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">
              {savedReport ? 'Update' : 'Simpan'}
            </span>
          </Button>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="space-y-6">
        {/* Row 1: Data Baseline (STIFIN & Assessment) */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* STIFIN Card */}
          <Card className="rounded-2xl border-0 shadow-md overflow-hidden">
            <div className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-violet-500/10 via-violet-500/5 to-transparent" />
              <div className="relative px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
                    <Brain className="h-4 w-4 text-violet-600" />
                  </div>
                  <span className="font-semibold text-foreground">Profil STIFIN</span>
                </div>
                {stifinData && (
                  <Badge className="bg-violet-500 hover:bg-violet-600 text-white text-xs border-0 px-2">
                    {stifinData.tipe_stifin}
                  </Badge>
                )}
              </div>
            </div>
            <CardContent className="pt-4">
              {stifinData ? (
                <div className="space-y-3">
                  {stifinData.kecerdasan_dominan && (
                    <Badge variant="outline" className="text-sm px-3 py-1 border-violet-300 text-violet-600">
                      {stifinData.kecerdasan_dominan}
                    </Badge>
                  )}
                  {stifinData.deskripsi && (
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {stifinData.deskripsi}
                    </p>
                  )}
                  {stifinData.gaya_belajar && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase">Gaya Belajar</p>
                      <p className="text-sm text-foreground">{stifinData.gaya_belajar}</p>
                    </div>
                  )}
                  {stifinData.kekuatan && stifinData.kekuatan.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase">Kekuatan</p>
                      <div className="flex flex-wrap gap-1">
                        {stifinData.kekuatan.map((k, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {k}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="h-14 w-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
                    <Brain className="h-7 w-7 text-muted-foreground/40" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">Data STIFIN belum tersedia</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Upload hasil tes STIFIN di halaman profil santri</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Asesmen Awal Card */}
          <Card className="rounded-2xl border-0 shadow-md overflow-hidden">
            <div className="relative overflow-hidden shrink-0">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-blue-500/5 to-transparent" />
              <div className="relative px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <FileText className="h-4 w-4 text-blue-600" />
                  </div>
                  <span className="font-semibold text-foreground">Assessment Awal</span>
                </div>
              </div>
            </div>
            <CardContent className="pt-4 flex-1 min-h-0 overflow-hidden">
              {asesmenData ? (
                <ScrollArea className="h-full pr-3">
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {asesmenData.summary}
                    </p>
                    {asesmenData.recommendations && asesmenData.recommendations.length > 0 && (
                      <div className="space-y-2 pt-3 border-t">
                        <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Rekomendasi</p>
                        <ul className="space-y-2">
                          {asesmenData.recommendations.map((rec, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                              <CheckCircle2 className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                              <span>{rec}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="h-14 w-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
                    <FileText className="h-7 w-7 text-muted-foreground/40" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">Data assessment belum tersedia</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Upload hasil assessment awal di halaman profil santri</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Data Semester */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Nilai Asrama Card */}
          <Card className="rounded-2xl border-0 shadow-md overflow-hidden flex flex-col">
            <div className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent" />
              <div className="relative px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                    <Home className="h-4 w-4 text-emerald-600" />
                  </div>
                  <span className="font-semibold text-foreground">Nilai Asrama</span>
                </div>
                {affectiveData && (
                  <Badge className={`text-xs border-0 px-2 text-white ${
                    affectiveData.totalScore >= 75 ? 'bg-emerald-500 hover:bg-emerald-600' : 
                    affectiveData.totalScore >= 60 ? 'bg-amber-500 hover:bg-amber-600' : 'bg-destructive hover:bg-destructive/90'
                  }`}>
                    {affectiveData.totalScore}
                  </Badge>
                )}
              </div>
            </div>
            <CardContent className="pt-4 flex-1">
              {affectiveData ? (
                <div className="space-y-4">
                  {Object.entries(affectiveData.grouped).map(([category, items]) => {
                    const avgScore = Math.round(items.reduce((sum, i) => sum + i.score, 0) / items.length);
                    const getScoreColor = (score: number) => {
                      if (score >= 75) return 'text-emerald-600';
                      if (score >= 60) return 'text-amber-600';
                      return 'text-destructive';
                    };
                    return (
                      <div key={category} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{category}</span>
                          <span className={`text-sm font-bold ${getScoreColor(avgScore)}`}>{avgScore}</span>
                        </div>
                        <div className="relative h-2 rounded-full bg-muted overflow-hidden">
                          <div 
                            className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${
                              avgScore >= 75 ? 'bg-emerald-500' : 
                              avgScore >= 60 ? 'bg-amber-500' : 'bg-destructive'
                            }`}
                            style={{ width: `${avgScore}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="h-14 w-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
                    <Home className="h-7 w-7 text-muted-foreground/40" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">Belum ada nilai asrama</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Nilai akan muncul setelah musyrif melakukan penilaian</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Konseling Card */}
          <Card className="rounded-2xl border-0 shadow-md overflow-hidden flex flex-col">
            <div className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 via-orange-500/5 to-transparent" />
              <div className="relative px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
                    <ScrollText className="h-4 w-4 text-orange-600" />
                  </div>
                  <span className="font-semibold text-foreground">Poin Konseling</span>
                </div>
                {konselingData && (
                  <Badge className={`text-xs border-0 px-2 text-white ${
                    konselingData.totalPoints >= 80 ? 'bg-emerald-500 hover:bg-emerald-600' : 
                    konselingData.totalPoints >= 60 ? 'bg-amber-500 hover:bg-amber-600' : 'bg-destructive hover:bg-destructive/90'
                  }`}>
                    {konselingData.totalPoints}
                  </Badge>
                )}
              </div>
            </div>
            <CardContent className="pt-4 flex-1">
              {konselingData && konselingData.logs.length > 0 ? (
                <ScrollArea className="h-[240px] pr-3">
                  <div className="space-y-3">
                    {konselingData.logs.map((log) => (
                      <div 
                        key={log.id} 
                        className={`flex items-start gap-3 p-3 rounded-xl transition-colors ${
                          log.type === 'prestasi' 
                            ? 'bg-emerald-50 dark:bg-emerald-500/10' 
                            : 'bg-red-50 dark:bg-destructive/10'
                        }`}
                      >
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                          log.type === 'prestasi' 
                            ? 'bg-emerald-500/20' 
                            : 'bg-destructive/20'
                        }`}>
                          {log.type === 'prestasi' ? (
                            <TrendingUp className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-destructive" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${
                            log.type === 'prestasi' ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive'
                          }`}>
                            {log.title}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {format(new Date(log.date), 'd MMM yyyy', { locale: localeId })}
                          </p>
                        </div>
                        <Badge 
                          className={`shrink-0 text-xs font-bold ${
                            log.type === 'prestasi' 
                              ? 'bg-emerald-500 hover:bg-emerald-600 text-white' 
                              : 'bg-destructive hover:bg-destructive/90 text-white'
                          }`}
                        >
                          {log.type === 'prestasi' ? '+' : '-'}{log.point}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="h-14 w-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
                    <CheckCircle2 className="h-7 w-7 text-emerald-500/60" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">Catatan bersih</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Tidak ada pelanggaran atau prestasi tercatat</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Generator Area */}
      <Card className="rounded-2xl border-0 shadow-md overflow-hidden">
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent" />
          <div className="relative px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <span className="font-semibold text-foreground">Generator Ringkasan</span>
            </div>
            {savedReport && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  <Pencil className="h-3 w-3 mr-1" />
                  Terakhir: {format(new Date(savedReport.updated_at), 'd MMM yyyy HH:mm', { locale: localeId })}
                </Badge>
                {hasUnsavedChanges && (
                  <Badge variant="warning" className="text-xs">
                    Belum disimpan
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>
        <CardContent className="space-y-4 pt-4">
          {savedReport?.summary ? (
            /* Saved Report - Display only with edit button */
            <div className="space-y-4">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {savedReport.summary}
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                    Hapus Ringkasan
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Hapus Ringkasan?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tindakan ini akan menghapus ringkasan psikologi secara permanen dan tidak dapat dibatalkan.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Batal</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteReportMutation.mutate()}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      disabled={deleteReportMutation.isPending}
                    >
                      {deleteReportMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      Hapus
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ) : reportSummary ? (
            <>
              {/* Toolbar when content exists but not yet saved */}
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={generateSummary}
                  disabled={isGenerating}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  {isGenerating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  Generate Ulang
                </Button>

                <Select value={languageStyle} onValueChange={(v) => setLanguageStyle(v as LanguageStyle)}>
                  <SelectTrigger className="w-32 h-9">
                    <SelectValue placeholder="Gaya Bahasa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="formal">Formal</SelectItem>
                    <SelectItem value="motivasi">Motivasi</SelectItem>
                    <SelectItem value="tegas">Tegas</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex-1" />

                <Button
                  onClick={() => saveReportMutation.mutate(reportSummary)}
                  disabled={saveReportMutation.isPending || !reportSummary.trim()}
                  className="gap-2"
                >
                  {saveReportMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Simpan Ringkasan
                </Button>
              </div>

              {/* Editor */}
              <Textarea
                value={reportSummary}
                onChange={(e) => setReportSummary(e.target.value)}
                placeholder="Tulis ringkasan manual atau generate ulang..."
                className="min-h-[200px] resize-y"
              />
            </>
          ) : hasDraft && draftSummary ? (
            /* Draft State */
            <div className="space-y-4">
              {/* Draft Preview Card */}
              <div className="relative overflow-hidden rounded-2xl border border-amber-200/50 dark:border-amber-500/20 bg-gradient-to-br from-amber-50/80 via-amber-50/40 to-background dark:from-amber-500/10 dark:via-amber-500/5 dark:to-background shadow-sm">
                {/* Decorative corner accent */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-amber-200/30 to-transparent dark:from-amber-500/10 rounded-bl-[4rem]" />
                
                <div className="relative p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-lg bg-amber-500/20 flex items-center justify-center">
                      <FileText className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <Badge variant="warning" className="text-xs font-medium">
                      Draft — Belum tersimpan
                    </Badge>
                  </div>
                  
                  <p className="text-sm text-muted-foreground leading-relaxed line-clamp-5 whitespace-pre-wrap">
                    {draftSummary}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsDrawerOpen(true)}
                  className="gap-1.5 rounded-xl"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Lihat Draft
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={generateSummary}
                  disabled={isGenerating}
                  className="gap-1.5 rounded-xl"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Generate Ulang
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setReportSummary(draftSummary);
                    saveReportMutation.mutate(draftSummary, {
                      onSuccess: () => clearDraft()
                    });
                  }}
                  disabled={saveReportMutation.isPending}
                  className="gap-1.5 rounded-xl shadow-sm"
                >
                  {saveReportMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  Simpan
                </Button>
              </div>
            </div>
          ) : (
            /* Empty State */
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                <FileText className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <h3 className="font-medium text-foreground mb-1">Belum Ada Ringkasan</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm">
                Buat ringkasan perkembangan psikologi santri secara otomatis berdasarkan data yang tersedia
              </p>
              
              <Button
                onClick={generateSummary}
                disabled={isGenerating}
                className="gap-2"
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Generate Summary
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Drawer */}
      <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <SheetContent side="bottom" className="h-[85vh] flex flex-col rounded-t-3xl p-0">
          <SheetHeader className="flex-row items-center justify-between px-6 py-4 border-b shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <SheetTitle className="text-left">Hasil Generate</SheetTitle>
                <p className="text-sm text-muted-foreground">Review dan edit ringkasan sebelum menyimpan</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={handleCancelDrawer}
            >
              <X className="h-5 w-5" />
            </Button>
          </SheetHeader>
          
          <div className="flex-1 min-h-0 p-6">
            {isGenerating ? (
              <div className="flex flex-col items-center justify-center h-full gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-muted-foreground">Sedang generate ringkasan...</p>
              </div>
            ) : (
              <Textarea
                value={draftSummary}
                onChange={(e) => setDraftSummary(e.target.value)}
                placeholder="Ringkasan akan muncul di sini..."
                className="h-full resize-none text-base leading-relaxed"
              />
            )}
          </div>

          <SheetFooter className="px-6 py-4 border-t shrink-0 flex-row gap-2 flex-wrap sm:justify-between">
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={generateSummary}
                disabled={isGenerating}
                className="gap-1.5"
              >
                <Sparkles className="h-4 w-4" />
                Generate Ulang
              </Button>
              <Button
                variant="outline"
                onClick={handleDiscardDraft}
                className="text-destructive hover:text-destructive gap-1.5"
              >
                <Trash2 className="h-4 w-4" />
                Buang Draft
              </Button>
            </div>
            <div className="flex gap-2 flex-1 sm:flex-none justify-end">
              <Button
                variant="outline"
                onClick={handleCancelDrawer}
              >
                Tutup
              </Button>
              <Button
                onClick={handleSaveFromDrawer}
                disabled={!draftSummary.trim() || saveReportMutation.isPending}
                className="gap-2"
              >
                {saveReportMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Simpan ke Database
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
