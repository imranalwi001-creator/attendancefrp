import { useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Upload, FileText, Check, X, Loader2, Eye, Trash2, Users, CheckCircle, Clock, Lock, AlertCircle } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAcademicYear } from '@/contexts/AcademicYearContext';
import { BadgeTahunAjaran } from '@/components/kalender/BadgeTahunAjaran';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { StatCard } from '@/components/ui/stat-card';
import { ContentCard, ContentCardHeader, ContentCardTitle, ContentCardBody } from '@/components/ui/content-card';
import { BulkUploadZone, FileMatchingPreview, matchFileToSantri, type FileMatch } from '@/components/cambridge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface SantriWithDocument {
  id: string;
  name: string;
  nis: string | null;
  document?: {
    id: string;
    document_url: string | null;
    document_name: string | null;
    uploaded_at: string | null;
  };
}

export default function RekapNilaiCambridgeWalikelas() {
  const { kelasId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { activeAcademicYear, getCurrentSemester } = useAcademicYear();
  const { user } = useAuth();
  const currentSemester = getCurrentSemester();
  
  // Individual upload states
  const [uploadingSantriId, setUploadingSantriId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<{ santriId: string; docId: string; docUrl: string } | null>(null);
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  
  // Bulk upload states
  const [matchingPreviewOpen, setMatchingPreviewOpen] = useState(false);
  const [pendingMatches, setPendingMatches] = useState<FileMatch[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, 'pending' | 'uploading' | 'success' | 'error'>>({});
  
  // Finalization states
  const [finalizeDialogOpen, setFinalizeDialogOpen] = useState(false);
  const [cancelFinalizeDialogOpen, setCancelFinalizeDialogOpen] = useState(false);

  // Fetch kelas data
  const { data: kelas, isLoading: isLoadingKelas } = useQuery({
    queryKey: ['cambridge-kelas-walikelas', kelasId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kelas')
        .select('id, nama, tingkat, tahun_ajaran, status, walikelas_id')
        .eq('id', kelasId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!kelasId,
    staleTime: 1000 * 60 * 5,
  });

  // Fetch finalization status
  const { data: finalizationData } = useQuery({
    queryKey: ['cambridge-finalization', kelasId, activeAcademicYear?.id, currentSemester],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cambridge_finalization')
        .select('*')
        .eq('kelas_id', kelasId!)
        .eq('academic_year_id', activeAcademicYear!.id)
        .eq('semester', currentSemester!)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!kelasId && !!activeAcademicYear?.id && !!currentSemester
  });

  const isFinalized = finalizationData?.is_finalized ?? false;

  // Fetch santri with their Cambridge documents
  const { data: santriList, isLoading: isLoadingSantri } = useQuery({
    queryKey: ['cambridge-santri-walikelas', kelasId, activeAcademicYear?.id, currentSemester],
    queryFn: async () => {
      const { data: santriData, error: santriError } = await supabase
        .from('santri')
        .select(`
          id,
          nis,
          profiles!santri_id_fkey(name)
        `)
        .eq('kelas_id', kelasId)
        .order('nis');

      if (santriError) throw santriError;

      const santriIds = santriData.map(s => s.id);
      if (santriIds.length === 0) {
        return santriData.map(santri => ({
          id: santri.id,
          name: (santri.profiles as any)?.name || 'Unknown',
          nis: santri.nis,
          document: undefined
        }));
      }
      
      const { data: documentsData, error: docsError } = await supabase
        .from('cambridge_documents')
        .select('id, santri_id, kelas_id, academic_year_id, semester, document_url, document_name, uploaded_at, uploaded_by')
        .in('santri_id', santriIds)
        .eq('academic_year_id', activeAcademicYear?.id || '')
        .eq('semester', currentSemester || 'ganjil');

      if (docsError) throw docsError;

      const documentsMap = new Map(documentsData.map(doc => [doc.santri_id, doc]));

      return santriData.map(santri => ({
        id: santri.id,
        name: (santri.profiles as any)?.name || 'Unknown',
        nis: santri.nis,
        document: documentsMap.get(santri.id) ? {
          id: documentsMap.get(santri.id)!.id,
          document_url: documentsMap.get(santri.id)!.document_url,
          document_name: documentsMap.get(santri.id)!.document_name,
          uploaded_at: documentsMap.get(santri.id)!.uploaded_at
        } : undefined
      })) as SantriWithDocument[];
    },
    enabled: !!kelasId && !!activeAcademicYear?.id && !!currentSemester
  });

  // Single file upload mutation
  const uploadMutation = useMutation({
    mutationFn: async ({ santriId, file }: { santriId: string; file: File }) => {
      if (!activeAcademicYear?.id || !currentSemester || !kelasId) {
        throw new Error('Missing required data');
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${kelasId}/${santriId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('cambridge-documents')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('cambridge-documents')
        .getPublicUrl(fileName);

      const { error: dbError } = await supabase
        .from('cambridge_documents')
        .upsert({
          santri_id: santriId,
          kelas_id: kelasId,
          academic_year_id: activeAcademicYear.id,
          semester: currentSemester,
          document_url: urlData.publicUrl,
          document_name: file.name,
          uploaded_at: new Date().toISOString(),
          uploaded_by: user?.id
        }, {
          onConflict: 'santri_id,kelas_id,academic_year_id,semester'
        });

      if (dbError) throw dbError;
      return { santriId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cambridge-santri-walikelas'] });
      toast.success('Dokumen berhasil diupload');
      setUploadingSantriId(null);
    },
    onError: (error) => {
      console.error('Upload error:', error);
      toast.error('Gagal mengupload dokumen');
      setUploadingSantriId(null);
    }
  });

  // Bulk upload mutation
  const bulkUploadMutation = useMutation({
    mutationFn: async (matches: FileMatch[]) => {
      if (!activeAcademicYear?.id || !currentSemester || !kelasId) {
        throw new Error('Missing required data');
      }

      const results: { success: boolean; santriId: string; fileName: string; error?: any }[] = [];

      for (const match of matches) {
        if (!match.matchedSantri) continue;

        const fileName = match.file.name;
        setUploadProgress(prev => ({ ...prev, [fileName]: 'uploading' }));

        try {
          const fileExt = match.file.name.split('.').pop();
          const storagePath = `${kelasId}/${match.matchedSantri.id}/${Date.now()}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from('cambridge-documents')
            .upload(storagePath, match.file, { upsert: true });

          if (uploadError) throw uploadError;

          const { data: urlData } = supabase.storage
            .from('cambridge-documents')
            .getPublicUrl(storagePath);

          const { error: dbError } = await supabase
            .from('cambridge_documents')
            .upsert({
              santri_id: match.matchedSantri.id,
              kelas_id: kelasId,
              academic_year_id: activeAcademicYear.id,
              semester: currentSemester,
              document_url: urlData.publicUrl,
              document_name: match.file.name,
              uploaded_at: new Date().toISOString(),
              uploaded_by: user?.id
            }, {
              onConflict: 'santri_id,kelas_id,academic_year_id,semester'
            });

          if (dbError) throw dbError;

          setUploadProgress(prev => ({ ...prev, [fileName]: 'success' }));
          results.push({ success: true, santriId: match.matchedSantri.id, fileName });
        } catch (error) {
          setUploadProgress(prev => ({ ...prev, [fileName]: 'error' }));
          results.push({ success: false, santriId: match.matchedSantri.id, fileName, error });
        }
      }

      return results;
    },
    onSuccess: (results) => {
      const successCount = results.filter(r => r.success).length;
      const errorCount = results.filter(r => !r.success).length;
      
      queryClient.invalidateQueries({ queryKey: ['cambridge-santri-walikelas'] });
      
      if (errorCount > 0) {
        toast.warning(`${successCount} berhasil, ${errorCount} gagal diupload`);
      } else {
        toast.success(`${successCount} dokumen berhasil diupload`);
      }
      
      setMatchingPreviewOpen(false);
      setPendingMatches([]);
      setUploadProgress({});
    },
    onError: (error) => {
      console.error('Bulk upload error:', error);
      toast.error('Terjadi kesalahan saat upload');
      setUploadProgress({});
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async ({ docId, docUrl }: { docId: string; docUrl: string }) => {
      const urlParts = docUrl.split('/cambridge-documents/');
      if (urlParts.length > 1) {
        const filePath = urlParts[1];
        await supabase.storage.from('cambridge-documents').remove([filePath]);
      }

      const { error } = await supabase
        .from('cambridge_documents')
        .delete()
        .eq('id', docId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cambridge-santri-walikelas'] });
      toast.success('Dokumen berhasil dihapus');
      setDeleteDialogOpen(false);
      setDocumentToDelete(null);
    },
    onError: (error) => {
      console.error('Delete error:', error);
      toast.error('Gagal menghapus dokumen');
    }
  });

  // Finalization mutation
  const finalizeMutation = useMutation({
    mutationFn: async () => {
      if (!activeAcademicYear?.id || !currentSemester || !kelasId) {
        throw new Error('Missing required data');
      }

      const { error } = await supabase
        .from('cambridge_finalization')
        .upsert({
          kelas_id: kelasId,
          academic_year_id: activeAcademicYear.id,
          semester: currentSemester,
          is_finalized: true,
          finalized_by: user?.id,
          finalized_at: new Date().toISOString()
        }, {
          onConflict: 'academic_year_id,kelas_id,semester'
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cambridge-finalization'] });
      toast.success('Nilai Cambridge berhasil difinalisasi');
      setFinalizeDialogOpen(false);
    },
    onError: (error) => {
      console.error('Finalize error:', error);
      toast.error('Gagal memfinalisasi nilai');
    }
  });

  // Cancel finalization mutation
  const cancelFinalizeMutation = useMutation({
    mutationFn: async () => {
      if (!activeAcademicYear?.id || !currentSemester || !kelasId) {
        throw new Error('Missing required data');
      }

      const { error } = await supabase
        .from('cambridge_finalization')
        .update({
          is_finalized: false,
          finalized_by: null,
          finalized_at: null
        })
        .eq('kelas_id', kelasId)
        .eq('academic_year_id', activeAcademicYear.id)
        .eq('semester', currentSemester);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cambridge-finalization'] });
      toast.success('Finalisasi dibatalkan');
      setCancelFinalizeDialogOpen(false);
    },
    onError: (error) => {
      console.error('Cancel finalize error:', error);
      toast.error('Gagal membatalkan finalisasi');
    }
  });

  // Handlers
  const handleFileChange = (santriId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadingSantriId(santriId);
      uploadMutation.mutate({ santriId, file });
    }
    if (fileInputRefs.current[santriId]) {
      fileInputRefs.current[santriId]!.value = '';
    }
  };

  const handleUploadClick = (santriId: string) => {
    fileInputRefs.current[santriId]?.click();
  };

  const handleDeleteClick = (santriId: string, docId: string, docUrl: string) => {
    setDocumentToDelete({ santriId, docId, docUrl });
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (documentToDelete) {
      deleteMutation.mutate({ docId: documentToDelete.docId, docUrl: documentToDelete.docUrl });
    }
  };

  const handleBulkFilesDropped = (files: File[]) => {
    if (!santriList || isFinalized) return;

    const matches: FileMatch[] = files.map(file => ({
      file,
      ...matchFileToSantri(file.name, santriList)
    }));

    setPendingMatches(matches);
    setMatchingPreviewOpen(true);
  };

  const handleBulkUploadConfirm = (confirmedMatches: FileMatch[]) => {
    bulkUploadMutation.mutate(confirmedMatches);
  };

  const isLoading = isLoadingKelas || isLoadingSantri;

  if (isLoading) {
    return (
      <div className="space-y-6 pb-24">
        <Card className="rounded-2xl">
          <CardContent className="py-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
            <p className="text-muted-foreground">Memuat data...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!kelas) {
    return (
      <div className="space-y-6 pb-24">
        <Card className="rounded-2xl">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Data kelas tidak ditemukan</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const uploadedCount = santriList?.filter(s => s.document?.document_url).length || 0;
  const totalCount = santriList?.length || 0;
  const progressPercent = totalCount > 0 ? (uploadedCount / totalCount) * 100 : 0;
  const canFinalize = uploadedCount === totalCount && totalCount > 0;

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-primary/80 p-8 shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-foreground/10 rounded-full blur-3xl -translate-y-32 translate-x-32 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary-foreground/5 rounded-full blur-2xl translate-y-24 -translate-x-24 pointer-events-none" />

        <div className="relative flex items-start gap-4 z-10">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/app/penilaian/${kelasId}`)}
            className="rounded-xl bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground border-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <h1 className="text-3xl font-bold text-primary-foreground">
                Rekap Nilai Cambridge {kelas.nama}
              </h1>
              {isFinalized && (
                <Badge className="bg-primary-foreground/20 text-primary-foreground border-0 gap-1">
                  <Lock className="h-3 w-3" />
                  Finalisasi
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <BadgeTahunAjaran className="bg-primary-foreground/20 text-primary-foreground border-0" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left Column - Progress & Upload */}
        <div className="lg:col-span-1 space-y-4">
          {/* Progress Card */}
          <ContentCard>
            <ContentCardHeader>
              <ContentCardTitle>Status Upload</ContentCardTitle>
            </ContentCardHeader>
            <ContentCardBody className="space-y-4">
              {/* Progress Stats */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-3 rounded-xl bg-muted/50">
                  <p className="text-2xl font-bold text-foreground">{totalCount}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
                <div className="p-3 rounded-xl bg-green-500/10">
                  <p className="text-2xl font-bold text-green-600">{uploadedCount}</p>
                  <p className="text-xs text-muted-foreground">Uploaded</p>
                </div>
                <div className="p-3 rounded-xl bg-destructive/10">
                  <p className="text-2xl font-bold text-destructive">{totalCount - uploadedCount}</p>
                  <p className="text-xs text-muted-foreground">Missing</p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Kelengkapan</span>
                  <span className="font-medium">{Math.round(progressPercent)}%</span>
                </div>
                <Progress value={progressPercent} className="h-2" />
              </div>

              {/* Status Badge */}
              {isFinalized ? (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                  <Lock className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-600">Sudah Difinalisasi</span>
                </div>
              ) : !canFinalize ? (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <span className="text-xs text-amber-600">Lengkapi semua sertifikat untuk finalisasi</span>
                </div>
              ) : null}

              {/* Action Button */}
              <div className="pt-2">
                {isFinalized ? (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setCancelFinalizeDialogOpen(true)}
                    disabled={cancelFinalizeMutation.isPending}
                  >
                    {cancelFinalizeMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Lock className="h-4 w-4 mr-2" />
                    )}
                    Batalkan Finalisasi
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    onClick={() => setFinalizeDialogOpen(true)}
                    disabled={!canFinalize || finalizeMutation.isPending}
                  >
                    {finalizeMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <CheckCircle className="h-4 w-4 mr-2" />
                    )}
                    Finalisasi
                  </Button>
                )}
              </div>
            </ContentCardBody>
          </ContentCard>

          {/* Bulk Upload Zone */}
          {!isFinalized && (
            <ContentCard>
              <ContentCardHeader>
                <ContentCardTitle className="flex items-center gap-2">
                  <Upload className="h-4 w-4 text-primary" />
                  Upload Massal
                </ContentCardTitle>
              </ContentCardHeader>
              <ContentCardBody>
                <BulkUploadZone
                  onFilesDropped={handleBulkFilesDropped}
                  isUploading={bulkUploadMutation.isPending}
                  disabled={isFinalized}
                />
              </ContentCardBody>
            </ContentCard>
          )}
        </div>

        {/* Right Column - Santri List */}
        <div className="lg:col-span-2">
          <ContentCard>
            <ContentCardHeader className="flex flex-row items-center justify-between">
              <ContentCardTitle className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Daftar Santri
              </ContentCardTitle>
              <Badge variant="secondary" className="font-normal">
                {uploadedCount}/{totalCount} lengkap
              </Badge>
            </ContentCardHeader>
            <ContentCardBody>
              {!santriList || santriList.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p>Tidak ada data santri di kelas ini</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {santriList.map((santri) => {
                    const isUploadingThis = uploadingSantriId === santri.id;
                    const hasDocument = !!santri.document?.document_url;

                    return (
                      <div
                        key={santri.id}
                        className={cn(
                          "flex items-center justify-between gap-3 p-3 rounded-xl border transition-colors",
                          hasDocument 
                            ? "bg-green-500/5 border-green-500/20 hover:bg-green-500/10" 
                            : "bg-card border-border hover:bg-muted/50"
                        )}
                      >
                        {/* Santri Info */}
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className={cn(
                            "flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center",
                            hasDocument ? "bg-green-500/20" : "bg-muted"
                          )}>
                            {hasDocument ? (
                              <Check className="h-4 w-4 text-green-600" />
                            ) : (
                              <FileText className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm truncate">{santri.name}</p>
                            <p className="text-xs text-muted-foreground">NIS: {santri.nis || '-'}</p>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {hasDocument ? (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => window.open(santri.document!.document_url!, '_blank')}
                                title="Lihat dokumen"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {!isFinalized && (
                                <>
                                  <Input
                                    ref={(el) => { fileInputRefs.current[santri.id] = el; }}
                                    type="file"
                                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                                    className="hidden"
                                    onChange={(e) => handleFileChange(santri.id, e)}
                                  />
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => handleUploadClick(santri.id)}
                                    disabled={isUploadingThis}
                                    title="Ganti dokumen"
                                  >
                                    {isUploadingThis ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Upload className="h-4 w-4" />
                                    )}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                    onClick={() => handleDeleteClick(santri.id, santri.document!.id, santri.document!.document_url!)}
                                    disabled={isUploadingThis}
                                    title="Hapus dokumen"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </>
                          ) : (
                            <>
                              {!isFinalized && (
                                <>
                                  <Input
                                    ref={(el) => { fileInputRefs.current[santri.id] = el; }}
                                    type="file"
                                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                                    className="hidden"
                                    onChange={(e) => handleFileChange(santri.id, e)}
                                  />
                                  <Button
                                    variant="default"
                                    size="sm"
                                    className="h-8 gap-1.5"
                                    onClick={() => handleUploadClick(santri.id)}
                                    disabled={isUploadingThis}
                                  >
                                    {isUploadingThis ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Upload className="h-3.5 w-3.5" />
                                    )}
                                    Upload
                                  </Button>
                                </>
                              )}
                              {isFinalized && (
                                <Badge variant="destructive" className="text-xs">Missing</Badge>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ContentCardBody>
          </ContentCard>
        </div>
      </div>

      {/* Bulk Upload Preview Drawer */}
      <FileMatchingPreview
        matches={pendingMatches}
        santriList={santriList || []}
        onConfirm={handleBulkUploadConfirm}
        onCancel={() => {
          setMatchingPreviewOpen(false);
          setPendingMatches([]);
        }}
        open={matchingPreviewOpen}
        isUploading={bulkUploadMutation.isPending}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Dokumen?</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus dokumen ini? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Finalize Confirmation Dialog */}
      <AlertDialog open={finalizeDialogOpen} onOpenChange={setFinalizeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalisasi Nilai Cambridge?</AlertDialogTitle>
            <AlertDialogDescription>
              Setelah difinalisasi, Anda tidak dapat mengubah atau menghapus dokumen Cambridge untuk semester ini. Lanjutkan?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={() => finalizeMutation.mutate()}>
              Finalisasi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Finalize Confirmation Dialog */}
      <AlertDialog open={cancelFinalizeDialogOpen} onOpenChange={setCancelFinalizeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Batalkan Finalisasi?</AlertDialogTitle>
            <AlertDialogDescription>
              Ini akan membuka kembali akses edit untuk kategori Cambridge. Lanjutkan?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={() => cancelFinalizeMutation.mutate()}>
              Ya, Batalkan Finalisasi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
