import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ArrowLeft, Upload, Calendar, FileText, UploadCloud, X, Link as LinkIcon, Lock, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale/id';
import { Tugas } from '@/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { sanitizeHtml } from '@/lib/sanitize';
import { parseJakartaDateTime } from '@/lib/dateUtils';
import { useSignedUrls } from '@/hooks/useSignedUrls';

interface TugasSubmitFormProps {
  tugas: Tugas;
  onBack: () => void;
  onSubmit: (jawaban: { tipe: 'file' | 'teks' | 'link'; value: string }) => void;
  existingSubmission?: any;
  isEditing?: boolean;
  inDrawer?: boolean;
  onFormChange?: (hasData: boolean) => void;
}

export default function TugasSubmitForm({ tugas, onBack, onSubmit, existingSubmission, isEditing = false, inDrawer = false, onFormChange }: TugasSubmitFormProps) {
  // Check if tugas is closed or deadline has passed
  // Support both 'deadline' and 'tanggal_deadline' fields
  const deadlineDate = tugas.tanggal_deadline || tugas.deadline;
  const parsedDeadline = parseJakartaDateTime(deadlineDate);
  const isDeadlinePassed = !!(parsedDeadline && parsedDeadline.getTime() < Date.now());
  const isTugasClosed = tugas.status === 'ditutup';
  
  // Determine initial values based on existing submission
  const getInitialTipe = (): 'teks' | 'file' | 'link' => {
    if (isEditing && existingSubmission) {
      if (existingSubmission.jawaban_teks) return 'teks';
      if (existingSubmission.file_url) {
        // Check if it's a Supabase storage URL (uploaded file) or external link
        const isStorageUrl = existingSubmission.file_url.includes('/storage/v1/object/public/');
        return isStorageUrl ? 'file' : 'link';
      }
    }
    return tugas.tipe_jawaban === 'semua' ? 'teks' : (tugas.tipe_jawaban as 'teks' | 'file' | 'link');
  };
  
  const getInitialJawaban = (): string => {
    if (isEditing && existingSubmission) {
      return existingSubmission.jawaban_teks || existingSubmission.file_url || '';
    }
    return '';
  };
  
  const getInitialFileData = (): { names: string[], urls: string[] } => {
    if (isEditing && existingSubmission && existingSubmission.file_url) {
      const tipe = getInitialTipe();
      if (tipe === 'file') {
        // Parse comma-separated URLs
        const urls = existingSubmission.file_url.split(',').map(url => url.trim()).filter(url => url);
        // Extract file names from URLs
        const names = urls.map(url => {
          const parts = url.split('/');
          const fileNameWithParams = parts[parts.length - 1];
          const fileName = fileNameWithParams.split('?')[0]; // Remove query params
          // Try to get original name or use the path name
          return decodeURIComponent(fileName.split('-').slice(1).join('-') || fileName);
        });
        return { names, urls };
      }
    }
    return { names: [], urls: [] };
  };
  
  const initialFileData = getInitialFileData();
  const [jawaban, setJawaban] = useState(getInitialJawaban());
  const [fileNames, setFileNames] = useState<string[]>(initialFileData.names);
  const [fileUrls, setFileUrls] = useState<string[]>(initialFileData.urls);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedTipe, setSelectedTipe] = useState<'teks' | 'file' | 'link'>(getInitialTipe());
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Resolve signed URLs for private storage so previews can load
  const previewUrls = useSignedUrls(fileUrls);

  // Notify parent when form has data
  useEffect(() => {
    const hasData = jawaban.trim().length > 0 || fileNames.length > 0;
    onFormChange?.(hasData);
  }, [jawaban, fileNames, onFormChange]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(file => handleFile(file));
    }
  };

  const handleFile = async (file: File) => {
    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
    if (file.size > maxSize) {
      toast.error(`${file.name}: Ukuran file maksimal 5MB`);
      return;
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf', 'video/mp4'];
    if (!allowedTypes.includes(file.type)) {
      toast.error(`${file.name}: Format file harus JPEG, PNG, PDF, atau MP4`);
      return;
    }

    // Check if file already exists
    if (fileNames.includes(file.name)) {
      toast.error(`${file.name} sudah dipilih`);
      return;
    }

    try {
      toast.loading(`Mengupload ${file.name}...`);

      // Get current user (RLS requires path to start with auth.uid())
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.dismiss();
        toast.error('Sesi login tidak ditemukan. Silakan login ulang.');
        return;
      }

      // Generate unique file name. Path must start with userId to satisfy storage RLS.
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/tugas/${tugas.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('user-documents')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) throw error;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('user-documents')
        .getPublicUrl(fileName);
      
      setFileNames(prev => [...prev, file.name]);
      setFileUrls(prev => [...prev, publicUrl]);
      setJawaban(prev => prev ? `${prev},${publicUrl}` : publicUrl);
      toast.dismiss();
      toast.success(`${file.name} berhasil diupload`);
    } catch (error) {
      console.error('Upload error:', error);
      toast.dismiss();
      toast.error(`Gagal mengupload ${file.name}`);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files) {
      Array.from(files).forEach(file => handleFile(file));
    }
  };

  const handleRemoveFile = (index: number) => {
    const removedFileName = fileNames[index];
    const newFileNames = fileNames.filter((_, i) => i !== index);
    const newFileUrls = fileUrls.filter((_, i) => i !== index);
    
    setFileNames(newFileNames);
    setFileUrls(newFileUrls);
    setJawaban(newFileUrls.join(','));
    
    if (newFileNames.length === 0 && fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    
    toast.success(`${removedFileName} berhasil dihapus`);
  };

  const handleSubmit = () => {
    if (!jawaban.trim()) {
      toast.error('Jawaban wajib diisi');
      return;
    }
    
    // Show confirmation dialog
    setShowConfirmDialog(true);
  };

  const confirmSubmit = () => {
    // Mock save to localStorage
    const pengumpulan = {
      tugasId: tugas.id,
      jawaban: {
        tipe: selectedTipe,
        value: jawaban
      },
      status: 'terkirim',
      submittedAt: new Date().toISOString()
    };
    
    const existingData = JSON.parse(localStorage.getItem('pengumpulan_tugas') || '{}');
    localStorage.setItem('pengumpulan_tugas', JSON.stringify({
      ...existingData,
      [tugas.id]: pengumpulan
    }));

    onSubmit({ tipe: selectedTipe, value: jawaban });
    toast.success('Tugas berhasil dikirim');
    setShowConfirmDialog(false);
  };

  // Content wrapper for drawer mode
  const content = (
    <div className={inDrawer ? "space-y-6 pb-6" : "p-6 space-y-6"}>
        {/* Closed Status Warning */}
        {isTugasClosed && (
          <div className="p-6 bg-destructive/10 border-2 border-destructive/20 rounded-xl text-center space-y-3">
            <div className="inline-flex p-3 rounded-full bg-destructive/20">
              <Lock className="h-8 w-8 text-destructive" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-destructive mb-2">Tugas Telah Ditutup</h3>
              <p className="text-sm text-muted-foreground">
                {isDeadlinePassed 
                  ? "Pengumpulan tugas sudah tidak dapat dilakukan karena waktu deadline telah berakhir."
                  : "Pengumpulan tugas sudah tidak dapat dilakukan karena tugas ini telah ditutup oleh pengampu."
                }
              </p>
            </div>
            <Button
              variant="outline"
              onClick={onBack}
              className="rounded-xl mt-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Kembali
            </Button>
          </div>
        )}

        {/* Tugas Info — selaras dengan detail view */}
        {!isTugasClosed && (
          <div className="space-y-4">
            {(tugas.bab || tugas.tipe_jawaban) && (
              <div className="flex flex-wrap gap-2">
                {tugas.bab && (
                  <Badge variant="outline" className="border-primary/40 bg-primary/5 text-primary">
                    {tugas.bab}
                  </Badge>
                )}
                <Badge variant="secondary">
                  Tipe Jawaban: {tugas.tipe_jawaban === 'semua' ? 'Bebas Pilih' : tugas.tipe_jawaban === 'teks' ? 'Teks' : tugas.tipe_jawaban === 'file' ? 'File' : 'Link'}
                </Badge>
              </div>
            )}

            <div>
              <Label className="text-sm font-semibold text-muted-foreground">Deskripsi</Label>
              {tugas.deskripsi ? (
                <div
                  className="text-sm mt-1 prose prose-sm max-w-none prose-headings:text-foreground prose-p:text-foreground prose-li:text-foreground prose-strong:text-foreground"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(tugas.deskripsi) }}
                />
              ) : (
                <p className="text-sm mt-1 text-muted-foreground">-</p>
              )}
            </div>
          </div>
        )}

        {/* Form Input */}
        {!isTugasClosed && <div className="space-y-4">
          {/* Deadline Info */}
          {tugas.tanggal_deadline && (
            <div className={cn(
              "flex items-center gap-3 p-4 rounded-xl border-2",
              isDeadlinePassed 
                ? "bg-destructive/5 border-destructive/20" 
                : "bg-primary/5 border-primary/20"
            )}>
              <div className={cn(
                "p-2 rounded-lg",
                isDeadlinePassed ? "bg-destructive/10" : "bg-primary/10"
              )}>
                <Calendar className={cn(
                  "h-5 w-5",
                  isDeadlinePassed ? "text-destructive" : "text-primary"
                )} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">
                  {isDeadlinePassed ? 'Deadline Terlewat' : 'Deadline Pengumpulan'}
                </p>
                <p className={cn(
                  "text-sm font-medium",
                  isDeadlinePassed ? "text-destructive" : "text-muted-foreground"
                )}>
                  {format(new Date(tugas.tanggal_deadline), 'EEEE, dd MMMM yyyy • HH:mm', { locale: idLocale })}
                </p>
              </div>
              {!isDeadlinePassed && (
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Sisa waktu</p>
                  <p className="text-sm font-bold text-primary">
                    {Math.ceil((new Date(tugas.tanggal_deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} hari
                  </p>
                </div>
              )}
            </div>
          )}
          
          <div className="p-4 rounded-2xl bg-gradient-to-br from-primary/5 via-accent/5 to-muted/20 border-2 border-primary/20 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <Label htmlFor="jawaban" className="text-base font-bold text-foreground">
                  Jawaban Anda
                </Label>
                <p className="text-xs text-muted-foreground">Pilih format jawaban yang sesuai</p>
              </div>
            </div>

          {tugas.tipe_jawaban === 'semua' ? (
            <Tabs value={selectedTipe} onValueChange={(value) => {
              setSelectedTipe(value as 'teks' | 'file' | 'link');
              setJawaban('');
              setFileNames([]);
              setFileUrls([]);
              if (fileInputRef.current) fileInputRef.current.value = '';
            }} className="w-full">
              <TabsList className="grid w-full grid-cols-3 rounded-xl bg-background/80 border border-border/50 p-1 h-auto">
                <TabsTrigger 
                  value="teks" 
                  className="rounded-lg py-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Teks
                </TabsTrigger>
                <TabsTrigger 
                  value="file" 
                  className="rounded-lg py-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  File
                </TabsTrigger>
                <TabsTrigger 
                  value="link" 
                  className="rounded-lg py-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all"
                >
                  <LinkIcon className="h-4 w-4 mr-2" />
                  Link
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="teks" className="mt-4">
                <Textarea
                  id="jawaban"
                  placeholder="Tuliskan jawaban Anda di sini..."
                  value={jawaban}
                  onChange={(e) => setJawaban(e.target.value)}
                  className="rounded-xl min-h-[200px] bg-background border-border/50 focus:border-primary"
                />
              </TabsContent>
              
              <TabsContent value="file" className="mt-4">
                <div className="space-y-3">
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={cn(
                      "relative border-2 border-dashed rounded-2xl p-8 transition-all duration-200",
                      isDragging 
                        ? "border-primary bg-primary/5 scale-[1.02]" 
                        : "border-border hover:border-primary/50 hover:bg-muted/30"
                    )}
                  >
                    <div className="flex flex-col items-center justify-center text-center space-y-4">
                      <div className={cn(
                        "p-4 rounded-full transition-colors",
                        isDragging ? "bg-primary/20" : "bg-muted"
                      )}>
                        <UploadCloud className={cn(
                          "h-10 w-10 transition-colors",
                          isDragging ? "text-primary" : "text-muted-foreground"
                        )} />
                      </div>
                      
                      <div className="space-y-2">
                        <p className="text-base font-medium">
                          {fileNames.length > 0 ? (
                            `${fileNames.length} file${fileNames.length > 1 ? 's' : ''} dipilih`
                          ) : (
                            <>Choose files or drag & drop them here.</>
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          JPEG, PNG, PDF, and MP4 formats, up to 5 MB per file.
                        </p>
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        className="rounded-xl px-6"
                      >
                        Browse File
                      </Button>
                    </div>

                    <input
                      ref={fileInputRef}
                      id="file-upload"
                      type="file"
                      accept=".jpg,.jpeg,.png,.pdf,.mp4"
                      onChange={handleFileChange}
                      className="hidden"
                      multiple
                    />
                  </div>

                  {fileNames.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">File Terpilih:</Label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {fileNames.map((name, index) => {
                          const url = previewUrls[index] || fileUrls[index];
                          const ext = (name.split('.').pop() || '').toLowerCase();
                          const isImage = ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext);
                          const isVideo = ext === 'mp4';
                          return (
                            <div key={index} className="relative group rounded-xl border border-border bg-muted/30 overflow-hidden">
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block aspect-square bg-background flex items-center justify-center overflow-hidden"
                                title="Lihat file"
                              >
                                {isImage && url ? (
                                  <img src={url} alt={name} className="w-full h-full object-cover" loading="lazy" />
                                ) : isVideo && url ? (
                                  <video src={url} className="w-full h-full object-cover" muted />
                                ) : (
                                  <div className="flex flex-col items-center justify-center text-muted-foreground p-2">
                                    <FileText className="h-10 w-10 mb-1" />
                                    <span className="text-[10px] uppercase font-bold">{ext}</span>
                                  </div>
                                )}
                              </a>
                              <div className="flex items-center justify-between gap-1 p-2 border-t border-border bg-background/80">
                                <span className="text-xs truncate flex-1" title={name}>{name}</span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRemoveFile(index)}
                                  className="h-6 w-6 rounded-full hover:bg-destructive/10 hover:text-destructive flex-shrink-0"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="link" className="mt-4">
                <Input
                  id="jawaban"
                  type="url"
                  placeholder="https://example.com/tugas-saya"
                  value={jawaban}
                  onChange={(e) => setJawaban(e.target.value)}
                  className="rounded-xl"
                />
              </TabsContent>
            </Tabs>
          ) : (
            <>
              {selectedTipe === 'teks' && (
                <Textarea
                  id="jawaban"
                  placeholder="Tuliskan jawaban Anda di sini..."
                  value={jawaban}
                  onChange={(e) => setJawaban(e.target.value)}
                  className="rounded-xl min-h-[200px]"
                />
              )}

              {selectedTipe === 'file' && (
            <div className="space-y-3">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  "relative border-2 border-dashed rounded-2xl p-8 transition-all duration-200",
                  isDragging 
                    ? "border-primary bg-primary/5 scale-[1.02]" 
                    : "border-border hover:border-primary/50 hover:bg-muted/30"
                )}
              >
                <div className="flex flex-col items-center justify-center text-center space-y-4">
                  <div className={cn(
                    "p-4 rounded-full transition-colors",
                    isDragging ? "bg-primary/20" : "bg-muted"
                  )}>
                    <UploadCloud className={cn(
                      "h-10 w-10 transition-colors",
                      isDragging ? "text-primary" : "text-muted-foreground"
                    )} />
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-base font-medium">
                      {fileNames.length > 0 ? (
                        `${fileNames.length} file${fileNames.length > 1 ? 's' : ''} dipilih`
                      ) : (
                        <>Choose files or drag & drop them here.</>
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      JPEG, PNG, PDF, and MP4 formats, up to 50 MB per file.
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-xl px-6"
                  >
                    Browse File
                  </Button>
                </div>

                <input
                  ref={fileInputRef}
                  id="file-upload"
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf,.mp4"
                  onChange={handleFileChange}
                  className="hidden"
                  multiple
                />
              </div>

              {/* Selected Files List */}
              {fileNames.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">File Terpilih:</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {fileNames.map((name, index) => {
                      const url = previewUrls[index] || fileUrls[index];
                      const ext = (name.split('.').pop() || '').toLowerCase();
                      const isImage = ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext);
                      const isVideo = ext === 'mp4';
                      return (
                        <div key={index} className="relative group rounded-xl border border-border bg-muted/30 overflow-hidden">
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block aspect-square bg-background flex items-center justify-center overflow-hidden"
                            title="Lihat file"
                          >
                            {isImage && url ? (
                              <img src={url} alt={name} className="w-full h-full object-cover" loading="lazy" />
                            ) : isVideo && url ? (
                              <video src={url} className="w-full h-full object-cover" muted />
                            ) : (
                              <div className="flex flex-col items-center justify-center text-muted-foreground p-2">
                                <FileText className="h-10 w-10 mb-1" />
                                <span className="text-[10px] uppercase font-bold">{ext}</span>
                              </div>
                            )}
                          </a>
                          <div className="flex items-center justify-between gap-1 p-2 border-t border-border bg-background/80">
                            <span className="text-xs truncate flex-1" title={name}>{name}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveFile(index)}
                              className="h-6 w-6 rounded-full hover:bg-destructive/10 hover:text-destructive flex-shrink-0"
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
               )}
            </>
          )}
          </div>
        </div>}

        {/* Confirmation Dialog */}
        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <AlertDialogContent className="animate-scale-in">
            <AlertDialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-full bg-primary/10">
                  <AlertCircle className="h-5 w-5 text-primary" />
                </div>
                <AlertDialogTitle>Konfirmasi Pengiriman Tugas</AlertDialogTitle>
              </div>
              <AlertDialogDescription className="text-base">
                {isEditing 
                  ? 'Apakah Anda yakin ingin memperbarui jawaban tugas ini? Jawaban sebelumnya akan diganti.'
                  : 'Apakah Anda yakin ingin mengirimkan jawaban tugas ini? Pastikan jawaban Anda sudah benar sebelum mengirim.'
                }
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-xl">Batal</AlertDialogCancel>
              <AlertDialogAction 
                onClick={confirmSubmit}
                className="rounded-xl"
              >
                <Upload className="h-4 w-4 mr-2" />
                {isEditing ? 'Ya, Perbarui' : 'Ya, Kirim'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Action Buttons - hidden when in drawer mode (footer handles them) */}
        {!isTugasClosed && !inDrawer && <div className="flex flex-wrap gap-3 pt-4">
          <Button
            variant="outline"
            onClick={onBack}
            className="rounded-xl"
          >
            Batal
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!jawaban.trim()}
            className="rounded-xl"
          >
            <Upload className="h-4 w-4 mr-2" />
            {isEditing ? 'Perbarui Jawaban' : 'Kirim Tugas'}
          </Button>
        </div>}

        {/* Hidden submit trigger for drawer mode */}
        {inDrawer && !isTugasClosed && (
          <button 
            type="button"
            data-tugas-submit
            onClick={handleSubmit}
            disabled={!jawaban.trim()}
            className="hidden"
          />
        )}

        {!isTugasClosed && isDeadlinePassed && (
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl">
            <p className="text-sm text-destructive font-semibold">
              ⚠️ Perhatian: Deadline sudah terlewat. Pengumpulan ini akan ditandai sebagai terlambat.
            </p>
          </div>
        )}
    </div>
  );

  // When in drawer mode, return content directly without Card wrapper
  if (inDrawer) {
    return content;
  }

  // Default: return with Card wrapper
  return (
    <Card className="rounded-2xl border-0 shadow-md overflow-hidden">
      {/* Header */}
      <CardHeader className="bg-gradient-to-r from-muted/30 to-muted/10 border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="rounded-xl hover:bg-primary/10"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <CardTitle className="flex items-center gap-2 text-lg">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileText className="h-4 w-4 text-primary" />
            </div>
            {isEditing ? 'Edit Jawaban Tugas' : 'Kumpulkan Tugas'}
          </CardTitle>
        </div>
      </CardHeader>

      <CardContent>
        {content}
      </CardContent>
    </Card>
  );
}
