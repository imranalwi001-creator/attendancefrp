import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ContentCard, ContentCardHeader, ContentCardTitle, ContentCardBody } from '@/components/ui/content-card';
import { Progress } from '@/components/ui/progress';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, MoreVertical, Edit, Lock, Trash2, ClipboardList, FileText, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale/id';
import { Tugas, PengumpulanTugas } from '@/types';
import { DetailButton, MoreButton, ActionButtonGroup, SecondaryButton } from '@/components/ui/action-buttons';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
interface TugasListProps {
  tugasList: Tugas[];
  pengumpulanList: PengumpulanTugas[];
  totalSantri: number;
  onAdd: () => void;
  onEdit: (tugas: Tugas) => void;
  onView: (tugas: Tugas) => void;
  onRefresh?: () => void;
}
export default function TugasList({
  tugasList,
  pengumpulanList,
  totalSantri,
  onAdd,
  onEdit,
  onView,
  onRefresh
}: TugasListProps) {
  const navigate = useNavigate();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [selectedTugas, setSelectedTugas] = useState<Tugas | null>(null);
  const [selectedTugasForClose, setSelectedTugasForClose] = useState<Tugas | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const handleNavigateToDetail = (tugas: Tugas) => {
    // Detect if we're in admin or user context based on current URL
    const isAdmin = window.location.pathname.startsWith('/admin');
    const basePath = isAdmin ? '/admin/tugas' : '/app/tugas';
    navigate(`${basePath}/${tugas.id}`);
  };
  const handleDelete = async () => {
    if (!selectedTugas) return;
    setIsDeleting(true);
    try {
      // Check if there are any submissions for this tugas
      const {
        count,
        error: countError
      } = await supabase.from('pengumpulan_tugas').select('id', {
        count: 'exact',
        head: true
      }).eq('tugas_id', selectedTugas.id);
      if (countError) throw countError;
      if (count && count > 0) {
        toast.error(`Tidak dapat menghapus tugas karena sudah ada ${count} submission`);
        setDeleteDialogOpen(false);
        setSelectedTugas(null);
        setIsDeleting(false);
        return;
      }

      // Delete tugas if no submissions
      const {
        error: deleteError
      } = await supabase.from('tugas').delete().eq('id', selectedTugas.id);
      if (deleteError) throw deleteError;
      toast.success(`Tugas "${selectedTugas.judul}" berhasil dihapus`);
      setDeleteDialogOpen(false);
      setSelectedTugas(null);

      // Refresh the list
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error('Error deleting tugas:', error);
      toast.error('Gagal menghapus tugas');
    } finally {
      setIsDeleting(false);
    }
  };
  const handleClose = (tugas: Tugas) => {
    setSelectedTugasForClose(tugas);
    setCloseDialogOpen(true);
  };
  const handleConfirmClose = async () => {
    if (!selectedTugasForClose) return;
    setIsClosing(true);
    try {
      const {
        error
      } = await supabase.from('tugas').update({
        status: 'ditutup'
      }).eq('id', selectedTugasForClose.id);
      if (error) throw error;
      toast.success(`Tugas "${selectedTugasForClose.judul}" berhasil ditutup`);
      setCloseDialogOpen(false);
      setSelectedTugasForClose(null);

      // Refresh the list
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error('Error closing tugas:', error);
      toast.error('Gagal menutup tugas');
    } finally {
      setIsClosing(false);
    }
  };
  const getSubmissionCount = (tugasId: string) => {
    return pengumpulanList.filter(p => p.tugasId === tugasId).length;
  };
  const getSubmissionProgress = (tugasId: string) => {
    const count = getSubmissionCount(tugasId);
    return totalSantri > 0 ? count / totalSantri * 100 : 0;
  };
  const getStatusBadge = (tugas: Tugas) => {
    if (tugas.status === 'draft') {
      return <Badge variant="secondary">Draft</Badge>;
    }
    // Check if deadline has passed
    const isDeadlinePassed = tugas.deadline && new Date(tugas.deadline) < new Date();
    if (tugas.status === 'ditutup' || isDeadlinePassed) {
      return <Badge variant="destructive">Ditutup</Badge>;
    }
    return <Badge variant="default">Publish</Badge>;
  };
  return <>
      <ContentCard>
        <ContentCardBody className="p-3 sm:p-6 space-y-2 sm:space-y-3">
          {/* Search and Add Button */}
          <div className="flex flex-row gap-2 sm:gap-3 mb-3 sm:mb-4">
            <div className="relative w-[80%] sm:flex-1">
              <Search className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
              <Input
                placeholder="Cari tugas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 sm:pl-9 h-9 sm:h-10 text-sm"
              />
            </div>
            <Button onClick={onAdd} className="h-9 sm:h-10 text-xs sm:text-sm px-2 sm:px-4 flex-1 sm:flex-none">
              <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="ml-1 sm:ml-1.5 hidden xs:inline">Buat Tugas</span>
            </Button>
          </div>
          
          {tugasList.length === 0 ? <div className="flex flex-col items-center justify-center py-10 sm:py-16 px-3 sm:px-4">
              <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-full bg-primary/10 flex items-center justify-center mb-3 sm:mb-4">
                <Plus className="h-7 w-7 sm:h-10 sm:w-10 text-primary" />
              </div>
              <p className="text-base sm:text-lg font-semibold mb-1.5 sm:mb-2">Belum ada tugas</p>
              <p className="text-xs sm:text-sm text-muted-foreground mb-4 sm:mb-6 text-center max-w-sm">
                Mulai tambahkan tugas untuk santri dengan menekan tombol "Tambah Tugas" di atas
              </p>
            </div> : tugasList
            .filter(tugas => tugas.judul.toLowerCase().includes(searchQuery.toLowerCase()))
            .map(tugas => {
          const isDeadlinePassed = tugas.deadline && new Date(tugas.deadline) < new Date();
          const isClosed = tugas.status === 'ditutup' || isDeadlinePassed;
          return <Card key={tugas.id} className={`rounded-lg sm:rounded-2xl border sm:border-2 border-border/50 hover:border-primary/20 transition-all duration-300 cursor-pointer ${isClosed ? 'bg-muted/10' : ''}`} onClick={() => handleNavigateToDetail(tugas)} onDoubleClick={() => handleNavigateToDetail(tugas)}>
                  <CardContent className="p-3 sm:p-6">
                    {/* Mobile Layout */}
                    <div className="flex sm:hidden flex-col gap-2.5">
                      {/* Top row: Icon + Title + Actions */}
                      <div className="flex items-start gap-2.5">
                        <div className="flex-shrink-0">
                          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                            <FileText className="text-primary w-4 h-4" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-bold text-foreground truncate">
                            {tugas.judul}
                          </h3>
                          {tugas.bab ? <Badge variant="outline" className="border-primary/40 bg-primary/5 text-primary px-2 py-0 text-[10px] w-fit mt-0.5">
                              {tugas.bab}
                            </Badge> : <p className="text-xs text-muted-foreground">-</p>}
                        </div>
                        <div className="flex-shrink-0" onClick={e => e.stopPropagation()}>
                          <ActionButtonGroup>
                            <DetailButton onClick={() => handleNavigateToDetail(tugas)} className="h-7 w-7" />
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <MoreButton className="h-7 w-7" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="rounded-xl w-44">
                                {tugas.status === 'aktif' && <DropdownMenuItem onClick={() => handleClose(tugas)} className="rounded-lg cursor-pointer text-xs">
                                    <Lock className="h-3.5 w-3.5 mr-2" />
                                    Tutup Tugas
                                  </DropdownMenuItem>}
                                <DropdownMenuItem onClick={() => {
                              setSelectedTugas(tugas);
                              setDeleteDialogOpen(true);
                            }} className="rounded-lg text-destructive focus:text-destructive cursor-pointer text-xs">
                                  <Trash2 className="h-3.5 w-3.5 mr-2" />
                                  Hapus Tugas
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </ActionButtonGroup>
                        </div>
                      </div>
                      
                      {/* Bottom row: Deadline + Status + Progress */}
                      <div className="flex items-center justify-between gap-2 pl-11">
                        <div className="flex flex-col gap-0.5">
                          <p className="text-[10px] text-muted-foreground">Deadline</p>
                          <p className="text-[11px] font-semibold text-foreground">
                            {tugas.deadline ? format(new Date(tugas.deadline), 'dd MMM yyyy', {
                              locale: idLocale
                            }) : '-'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(tugas)}
                          <div className="flex items-center gap-1 text-[10px]">
                            <span className="text-muted-foreground">{getSubmissionCount(tugas.id)}/{totalSantri}</span>
                            <span className="font-semibold text-primary">{Math.round(getSubmissionProgress(tugas.id))}%</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Desktop Layout */}
                    <div className="hidden sm:flex items-center justify-between gap-12">
                      {/* Icon + Title Column */}
                      <div className="flex items-center gap-4 w-[300px] flex-shrink-0">
                        <div className="flex-shrink-0">
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                            <FileText className="text-primary w-[24px] h-[24px]" />
                          </div>
                        </div>
                        <div className="flex flex-col gap-1">
                          <h3 className="text-base font-bold text-foreground">
                            {tugas.judul}
                          </h3>
                          {tugas.bab ? <Badge variant="outline" className="border-primary/40 bg-primary/5 text-primary px-3 py-0.5 w-fit">
                              {tugas.bab}
                            </Badge> : <p className="text-sm text-muted-foreground">-</p>}
                        </div>
                      </div>

                      {/* Deadline Column */}
                      <div className="flex flex-col gap-1 min-w-[120px]">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">
                          Deadline
                        </p>
                        <p className="text-base font-semibold text-foreground">
                          {tugas.deadline ? format(new Date(tugas.deadline), 'dd MMM yyyy HH:mm', {
                      locale: idLocale
                    }) : '-'}
                        </p>
                      </div>

                      {/* Status Column */}
                      <div className="flex flex-col gap-1 min-w-[100px]">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">
                          Status
                        </p>
                        {getStatusBadge(tugas)}
                      </div>

                      {/* Pengumpulan Column */}
                      <div className="flex flex-col gap-2 min-w-[140px]">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">
                          Pengumpulan
                        </p>
                        <div className="flex items-center justify-between w-full text-sm">
                          <span className="text-muted-foreground">
                            {getSubmissionCount(tugas.id)}/{totalSantri}
                          </span>
                          <span className="font-semibold text-primary">
                            {Math.round(getSubmissionProgress(tugas.id))}%
                          </span>
                        </div>
                        <Progress value={getSubmissionProgress(tugas.id)} className="h-2 w-full" />
                      </div>

                      {/* Actions */}
                      <div className="flex-shrink-0 ml-auto" onClick={e => e.stopPropagation()}>
                        <ActionButtonGroup>
                          <DetailButton onClick={() => handleNavigateToDetail(tugas)} />
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <MoreButton />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-xl w-48">
                              {tugas.status === 'aktif' && <DropdownMenuItem onClick={() => handleClose(tugas)} className="rounded-lg cursor-pointer">
                                  <Lock className="h-4 w-4 mr-2" />
                                  Tutup Tugas
                                </DropdownMenuItem>}
                              <DropdownMenuItem onClick={() => {
                          setSelectedTugas(tugas);
                          setDeleteDialogOpen(true);
                        }} className="rounded-lg text-destructive focus:text-destructive cursor-pointer">
                                <Trash2 className="h-4 w-4 mr-2" />
                                Hapus Tugas
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </ActionButtonGroup>
                      </div>
                    </div>
                  </CardContent>
                </Card>;
        })}
        </ContentCardBody>
      </ContentCard>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Tugas</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus tugas "{selectedTugas?.judul}"? 
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl" disabled={isDeleting}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="rounded-xl bg-destructive hover:bg-destructive/90">
              {isDeleting ? 'Menghapus...' : 'Hapus'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-destructive/10">
                <Lock className="h-5 w-5 text-destructive" />
              </div>
              Tutup Tugas?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base pt-2">
              Apakah Anda yakin ingin menutup tugas <span className="font-semibold text-foreground">"{selectedTugasForClose?.judul}"</span>?
              <div className="mt-3 p-3 bg-muted rounded-lg space-y-2">
                <p className="text-sm font-medium text-foreground">Setelah ditutup:</p>
                <ul className="text-sm space-y-1 list-disc list-inside">
                  <li>Santri tidak bisa lagi mengumpulkan tugas</li>
                  <li>Santri tidak bisa mengedit jawaban yang sudah dikumpulkan</li>
                  <li>Status tugas akan berubah menjadi "Ditutup"</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl" disabled={isClosing}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmClose} className="rounded-xl bg-destructive hover:bg-destructive/90" disabled={isClosing}>
              {isClosing ? 'Menutup...' : 'Ya, Tutup Tugas'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>;
}