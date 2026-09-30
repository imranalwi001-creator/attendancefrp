import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Upload, FileText, Check, X, Loader2, Eye, Trash2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAcademicYear } from '@/contexts/AcademicYearContext';
import { BadgeTahunAjaran } from '@/components/kalender/BadgeTahunAjaran';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
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

export default function RekapNilaiCambridge() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { activeAcademicYear, getCurrentSemester } = useAcademicYear();
  const { user } = useAuth();
  const currentSemester = getCurrentSemester();
  const [uploadingSantriId, setUploadingSantriId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<{ santriId: string; docId: string; docUrl: string } | null>(null);
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  // Fetch kelas data - using explicit columns
  const { data: kelas, isLoading: isLoadingKelas } = useQuery({
    queryKey: ['cambridge-kelas', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kelas')
        .select('id, nama, tingkat, tahun_ajaran, status, walikelas_id')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Fetch santri with their Cambridge documents
  const { data: santriList, isLoading: isLoadingSantri } = useQuery({
    queryKey: ['cambridge-santri', id, activeAcademicYear?.id, currentSemester],
    queryFn: async () => {
      // Get all santri in this class
      const { data: santriData, error: santriError } = await supabase
        .from('santri')
        .select(`
          id,
          nis,
          profiles!santri_id_fkey(name)
        `)
        .eq('kelas_id', id)
        .order('nis');

      if (santriError) throw santriError;

      // Get Cambridge documents for these santri
      const santriIds = santriData.map(s => s.id);
      // Validate array before using .in() to prevent 400 errors
      if (santriIds.length === 0) {
        return santriData.map(santri => ({
          id: santri.id,
          nis: santri.nis,
          name: (santri.profiles as any)?.name || 'Unknown',
          document: null
        }));
      }
      
      const { data: documentsData, error: docsError } = await supabase
        .from('cambridge_documents')
        .select('id, santri_id, kelas_id, academic_year_id, semester, document_url, document_name, uploaded_at, uploaded_by')
        .in('santri_id', santriIds)
        .eq('academic_year_id', activeAcademicYear?.id || '')
        .eq('semester', currentSemester || 'ganjil');

      if (docsError) throw docsError;

      // Map documents to santri
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
    enabled: !!id && !!activeAcademicYear?.id && !!currentSemester
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async ({ santriId, file }: { santriId: string; file: File }) => {
      if (!activeAcademicYear?.id || !currentSemester || !id) {
        throw new Error('Missing required data');
      }

      // Upload file to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${id}/${santriId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('cambridge-documents')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('cambridge-documents')
        .getPublicUrl(fileName);

      // Upsert document record
      const { error: dbError } = await supabase
        .from('cambridge_documents')
        .upsert({
          santri_id: santriId,
          kelas_id: id,
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
      queryClient.invalidateQueries({ queryKey: ['cambridge-santri'] });
      toast.success('Dokumen berhasil diupload');
      setUploadingSantriId(null);
    },
    onError: (error) => {
      console.error('Upload error:', error);
      toast.error('Gagal mengupload dokumen');
      setUploadingSantriId(null);
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async ({ docId, docUrl }: { docId: string; docUrl: string }) => {
      // Extract file path from URL
      const urlParts = docUrl.split('/cambridge-documents/');
      if (urlParts.length > 1) {
        const filePath = urlParts[1];
        await supabase.storage.from('cambridge-documents').remove([filePath]);
      }

      // Delete record
      const { error } = await supabase
        .from('cambridge_documents')
        .delete()
        .eq('id', docId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cambridge-santri'] });
      toast.success('Dokumen berhasil dihapus');
      setDeleteDialogOpen(false);
      setDocumentToDelete(null);
    },
    onError: (error) => {
      console.error('Delete error:', error);
      toast.error('Gagal menghapus dokumen');
    }
  });

  const handleFileChange = (santriId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadingSantriId(santriId);
      uploadMutation.mutate({ santriId, file });
    }
    // Reset input
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

  const isLoading = isLoadingKelas || isLoadingSantri;

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <Card>
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
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Data kelas tidak ditemukan</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const uploadedCount = santriList?.filter(s => s.document?.document_url).length || 0;
  const totalCount = santriList?.length || 0;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-primary/80 p-8 shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-foreground/10 rounded-full blur-3xl -translate-y-32 translate-x-32 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary-foreground/5 rounded-full blur-2xl translate-y-24 -translate-x-24 pointer-events-none" />

        <div className="relative flex items-start gap-4 z-10">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/admin/penilaian/kelas/${id}`)}
            className="rounded-xl bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground border-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <div className="flex-1">
            <h1 className="text-3xl font-bold text-primary-foreground mb-3">
              Rekap Nilai Cambridge {kelas.nama}
            </h1>
            <div className="flex flex-wrap items-center gap-3">
              <BadgeTahunAjaran className="bg-primary-foreground/20 text-primary-foreground border-0" />
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="rounded-2xl">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-primary">{totalCount}</p>
              <p className="text-sm text-muted-foreground">Total Santri</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-green-600">{uploadedCount}</p>
              <p className="text-sm text-muted-foreground">Sudah Upload</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-orange-600">{totalCount - uploadedCount}</p>
              <p className="text-sm text-muted-foreground">Belum Upload</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Santri List */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Daftar Dokumen Cambridge Santri</CardTitle>
        </CardHeader>
        <CardContent>
          {!santriList || santriList.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Tidak ada data santri di kelas ini
            </div>
          ) : (
            <div className="space-y-3">
              {santriList.map((santri) => (
                <div
                  key={santri.id}
                  className="flex items-center justify-between p-4 rounded-xl border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{santri.name}</p>
                      <p className="text-sm text-muted-foreground">NIS: {santri.nis || '-'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {santri.document?.document_url ? (
                      <>
                        <Badge variant="default" className="gap-1 bg-green-600">
                          <Check className="h-3 w-3" />
                          Sudah Upload
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() => window.open(santri.document!.document_url!, '_blank')}
                        >
                          <Eye className="h-4 w-4" />
                          Lihat
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteClick(santri.id, santri.document!.id, santri.document!.document_url!)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <Input
                          ref={(el) => { fileInputRefs.current[santri.id] = el; }}
                          type="file"
                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                          className="hidden"
                          onChange={(e) => handleFileChange(santri.id, e)}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() => handleUploadClick(santri.id)}
                          disabled={uploadingSantriId === santri.id}
                        >
                          {uploadingSantriId === santri.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4" />
                          )}
                          Ganti
                        </Button>
                      </>
                    ) : (
                      <>
                        <Badge variant="secondary" className="gap-1">
                          <X className="h-3 w-3" />
                          Belum Upload
                        </Badge>
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
                          className="gap-1"
                          onClick={() => handleUploadClick(santri.id)}
                          disabled={uploadingSantriId === santri.id}
                        >
                          {uploadingSantriId === santri.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4" />
                          )}
                          Upload
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
    </div>
  );
}
