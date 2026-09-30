import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ContentCard, ContentCardHeader, ContentCardTitle, ContentCardBody } from '@/components/ui/content-card';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Materi } from '@/types';
import { Plus, Upload, Archive, Clock, X, Save, FileText, Trash2, Lock, Search, Megaphone } from 'lucide-react';
import { DetailButton, MoreButton, ActionButtonGroup, SecondaryButton } from '@/components/ui/action-buttons';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale/id';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import MateriForm from './MateriForm';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useForumPosts } from '@/hooks/useForumPosts';
import { useAuth } from '@/contexts/AuthContext';
interface TujuanPembelajaranItem {
  text: string;
}
interface TpStatus {
  tp_index: number;
  status: 'tercapai' | 'belum_tercapai';
}
interface MateriListProps {
  materiList: Materi[];
  mapelId?: string;
  semester?: 'ganjil' | 'genap';
  onRefresh: () => void;
  onCheckInfoComplete?: () => boolean;
  // Pre-cached data for performance
  cachedTujuanPembelajaran?: TujuanPembelajaranItem[];
  cachedTpStatus?: TpStatus[];
  // Flag to indicate if a learning session is active
  isSessionActive?: boolean;
}
interface MateriExecutionStatus {
  materiId: string;
  isExecuted: boolean; // True if session ended (waktu_selesai is not null)
}
export default function MateriList({
  materiList,
  mapelId,
  semester = 'ganjil',
  onRefresh,
  onCheckInfoComplete,
  cachedTujuanPembelajaran,
  cachedTpStatus,
  isSessionActive = false
}: MateriListProps) {
  const { user } = useAuth();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedMateri, setSelectedMateri] = useState<Materi | null>(null);
  const [materiExecutionStatus, setMateriExecutionStatus] = useState<MateriExecutionStatus[]>([]);
  const [loadingExecutionStatus, setLoadingExecutionStatus] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Share to forum states
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareMateri, setShareMateri] = useState<Materi | null>(null);
  const [shareContent, setShareContent] = useState('');
  const [isSharing, setIsSharing] = useState(false);

  // Sheet states for editing/adding materi
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<'edit' | 'add'>('edit');
  const [sheetMateri, setSheetMateri] = useState<Materi | null>(null);
  const [isMateriDirty, setIsMateriDirty] = useState(false);
  const { toast } = useToast();
  
  // Forum hook for sharing materi
  const { createPost } = useForumPosts(mapelId || '');

  // Watch for dirty state changes from MateriForm
  useEffect(() => {
    if (!sheetOpen) {
      setIsMateriDirty(false);
      return;
    }
    const checkDirty = () => {
      const dirtyInput = document.querySelector('[data-materi-is-dirty]') as HTMLInputElement;
      if (dirtyInput) {
        setIsMateriDirty(dirtyInput.value === 'true');
      }
    };
    const interval = setInterval(checkDirty, 100);
    return () => clearInterval(interval);
  }, [sheetOpen]);

  // Fetch execution status for all materi
  useEffect(() => {
    const fetchExecutionStatus = async () => {
      if (!mapelId || materiList.length === 0) {
        setLoadingExecutionStatus(false);
        return;
      }
      setLoadingExecutionStatus(true);
      try {
        // First, get all jadwal IDs for this mapel
        const {
          data: jadwalData,
          error: jadwalError
        } = await supabase.from('jadwal').select('id').eq('mapel_id', mapelId);
        if (jadwalError) throw jadwalError;
        const jadwalIds = jadwalData?.map(j => j.id) || [];
        if (jadwalIds.length === 0) {
          // No jadwal found, all materi are not executed
          setMateriExecutionStatus(materiList.map(m => ({
            materiId: m.id,
            isExecuted: false
          })));
          return;
        }

        // Fetch all completed sesi_pembelajaran for this mapel's jadwal with attendance count
        const {
          data: sessions,
          error
        } = await supabase.from('sesi_pembelajaran')
          .select('id, tanggal, metadata, waktu_selesai, status, kehadiran_santri(count)')
          .in('jadwal_id', jadwalIds)
          .eq('status', 'selesai')
          .not('waktu_selesai', 'is', null)
          .order('tanggal', { ascending: true });
        if (error) throw error;

        // Sort materi by pertemuan number
        const sortedMateri = [...materiList].sort((a, b) => {
          const getPertemuanNumber = (m: Materi) => {
            const desc = (m as any).deskripsi || (m as any).bab || '';
            const match = desc.match(/pertemuan\s*(\d+)/i);
            return match ? parseInt(match[1], 10) : 9999;
          };
          return getPertemuanNumber(a) - getPertemuanNumber(b);
        });

        // Track which sessions have been matched
        const matchedSessionIds = new Set<string>();
        
        // Map each materi to its execution status
        const statusList: MateriExecutionStatus[] = sortedMateri.map((materi, index) => {
          // First: Try primary match - sesi metadata stores materi_id (preferred)
          let matchedSession = sessions?.find(s => {
            const metadata = s.metadata as any;
            return metadata?.materi_id && metadata.materi_id === materi.id;
          });
          
          if (matchedSession) {
            matchedSessionIds.add(matchedSession.id);
          } else {
            // Fallback 1: Try matching by TP overlap
            const tpIds = (materi as any).tujuan_pembelajaran_ids as number[] | null | undefined;
            matchedSession = sessions?.find(s => {
              if (matchedSessionIds.has(s.id)) return false; // Already matched
              const metadata = s.metadata as any;
              const achievedTpIds = metadata?.tujuan_tercapai_ids as number[] | null | undefined;
              if (!metadata?.materi_id && Array.isArray(tpIds) && tpIds.length > 0 && Array.isArray(achievedTpIds)) {
                return achievedTpIds.some(tp => tpIds.includes(tp));
              }
              return false;
            });
            
            if (matchedSession) {
              matchedSessionIds.add(matchedSession.id);
            }
            // No positional fallback: a materi is only "terlaksana" when an actual
            // session explicitly references it (via metadata.materi_id) or shares
            // achieved TP. Otherwise newly added materi would inherit old sessions.
          }

          // Get attendance count from matched session
          const kehadiranCount = (matchedSession?.kehadiran_santri as any)?.[0]?.count || 0;
          return {
            materiId: materi.id,
            // Must have: completed session + attendance data recorded
            isExecuted: matchedSession ? matchedSession.waktu_selesai !== null && matchedSession.status === 'selesai' && kehadiranCount > 0 : false
          };
        });
        
        setMateriExecutionStatus(statusList);
      } catch (error) {
        console.error('Error fetching execution status:', error);
      } finally {
        setLoadingExecutionStatus(false);
      }
    };
    fetchExecutionStatus();
  }, [mapelId, materiList]);

  // Check if a materi is executed (sudah terlaksana)
  const isMateriExecuted = (materiId: string): boolean => {
    const status = materiExecutionStatus.find(s => s.materiId === materiId);
    return status?.isExecuted || false;
  };
  const getStatusBadge = (status: string) => {
    const config: Record<string, {
      className: string;
      label: string;
    }> = {
      draft: {
        className: 'bg-muted/50 text-muted-foreground border-transparent',
        label: 'Draft'
      },
      aktif: {
        className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-transparent',
        label: 'Aktif'
      },
      arsip: {
        className: 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300 border-transparent',
        label: 'Arsip'
      }
    };
    const {
      className,
      label
    } = config[status] || config.draft;
    return <Badge variant="outline" className={className}>{label}</Badge>;
  };
  const getExecutionBadge = (materiId: string) => {
    // Show loading state while fetching execution status
    if (loadingExecutionStatus) {
      return <Badge variant="outline" className="bg-muted text-muted-foreground border-transparent animate-pulse">
          <Clock className="h-3 w-3 mr-1" />
          Memuat...
        </Badge>;
    }
    const executed = isMateriExecuted(materiId);
    if (executed) {
      return <Badge variant="outline" className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400 border-transparent">
          Sudah Terlaksana
        </Badge>;
    }
    return <Badge variant="outline" className="bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400 border-transparent">
        Terjadwal
      </Badge>;
  };
  const handlePublish = async (materi: Materi) => {
    try {
      const {
        error
      } = await supabase.from('materi').update({
        status: 'aktif',
        updated_at: new Date().toISOString()
      }).eq('id', materi.id);
      if (error) throw error;
      toast({
        title: "Materi dipublikasikan",
        description: `"${materi.judul}" sekarang aktif dan dapat dilihat santri.`
      });
      onRefresh(); // Refresh list
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Gagal mempublikasikan materi",
        variant: "destructive"
      });
    }
  };
  const handleArchive = async (materi: Materi) => {
    try {
      const {
        error
      } = await supabase.from('materi').update({
        status: 'arsip',
        updated_at: new Date().toISOString()
      }).eq('id', materi.id);
      if (error) throw error;
      toast({
        title: "Materi diarsipkan",
        description: `"${materi.judul}" telah dipindahkan ke arsip.`
      });
      onRefresh(); // Refresh list
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Gagal mengarsipkan materi",
        variant: "destructive"
      });
    }
  };
  const handleDelete = async () => {
    if (!selectedMateri) return;
    try {
      const {
        error
      } = await supabase.from('materi').delete().eq('id', selectedMateri.id);
      if (error) throw error;
      toast({
        title: "Materi dihapus",
        description: `"${selectedMateri.judul}" telah dihapus permanen.`,
        variant: "destructive"
      });
      setDeleteDialogOpen(false);
      setSelectedMateri(null);
      onRefresh();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Gagal menghapus materi",
        variant: "destructive"
      });
    }
  };
  const openDeleteDialog = (materi: Materi) => {
    setSelectedMateri(materi);
    setDeleteDialogOpen(true);
  };

  // Open share to forum dialog
  const openShareDialog = (materi: Materi) => {
    setShareMateri(materi);
    setShareContent(`📚 Materi baru telah tersedia!\n\nJudul: ${materi.judul}${(materi as any).deskripsi ? `\n${(materi as any).deskripsi}` : ''}\n\nSilakan pelajari materi ini.`);
    setShareDialogOpen(true);
  };

  // Handle share to forum
  const handleShareToForum = async () => {
    if (!shareMateri || !user?.id || !mapelId) return;
    
    setIsSharing(true);
    try {
      await createPost.mutateAsync({
        content: shareContent.trim(),
        post_type: 'announcement',
        materi_id: shareMateri.id,
        user_id: user.id,
      });
      
      toast({
        title: "Berhasil",
        description: `Materi "${shareMateri.judul}" telah dibagikan ke forum diskusi`,
      });
      
      setShareDialogOpen(false);
      setShareMateri(null);
      setShareContent('');
    } catch (error: any) {
      toast({
        title: "Gagal",
        description: error.message || "Gagal membagikan materi ke forum",
        variant: "destructive",
      });
    } finally {
      setIsSharing(false);
    }
  };

  // Open sheet for adding new materi
  const handleAddMateri = () => {
    // Check if mapel info is complete before allowing add
    if (onCheckInfoComplete && !onCheckInfoComplete()) {
      return;
    }
    setSheetMateri(null);
    setSheetMode('add');
    setSheetOpen(true);
  };

  // Open sheet for editing materi - fetch full data including konten
  const handleEditMateri = async (materi: Materi) => {
    setSheetMode('edit');
    setSheetOpen(true);
    
    // Fetch full materi data including konten (not fetched in list for performance)
    try {
      const { data, error } = await supabase
        .from('materi')
        .select('id, judul, deskripsi, tipe_konten, konten, status, urutan, semester, mapel_id, tujuan_pembelajaran_ids, created_at')
        .eq('id', materi.id)
        .single();
      
      if (error) throw error;
      setSheetMateri(data as Materi);
    } catch (error) {
      console.error('Error fetching materi detail:', error);
      // Fallback to partial data if fetch fails
      setSheetMateri(materi);
      toast({
        title: "Peringatan",
        description: "Gagal memuat konten lengkap, beberapa data mungkin tidak tampil",
        variant: "destructive"
      });
    }
  };
  const handleRowClick = (materi: Materi) => {
    handleEditMateri(materi);
  };
  const handleCloseSheet = () => {
    setSheetOpen(false);
    setSheetMateri(null);
    setIsMateriDirty(false);
  };
  const handleSaveMateri = async () => {
    onRefresh();
    handleCloseSheet();
  };

  // Get sheet title based on mode
  const getSheetTitle = () => {
    if (sheetMode === 'add') return 'Tambah Materi Baru';
    return 'Detail Materi';
  };

  return <>
      <ContentCard>
        {/* Session Active Warning */}
        {isSessionActive && (
          <div className="m-3 sm:m-6 mb-0 p-2.5 sm:p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-center gap-2 sm:gap-3">
            <Lock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <p className="text-xs sm:text-sm text-amber-700 dark:text-amber-300">
              Modifikasi materi tidak dapat dilakukan saat sesi pembelajaran sedang berlangsung
            </p>
          </div>
        )}

        <ContentCardBody className="p-3 sm:p-6 space-y-2 sm:space-y-3">
          {/* Search and Add Button */}
          <div className="flex flex-row gap-2 sm:gap-3 mb-3 sm:mb-4">
            <div className="relative w-[80%] sm:flex-1">
              <Search className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
              <Input
                placeholder="Cari materi..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 sm:pl-9 h-9 sm:h-10 text-sm"
              />
            </div>
            <Button 
              onClick={handleAddMateri}
              disabled={isSessionActive}
              className={cn(
                "h-9 sm:h-10 text-xs sm:text-sm px-2 sm:px-4 flex-1 sm:flex-none",
                isSessionActive ? 'opacity-50 cursor-not-allowed' : ''
              )}
            >
              {isSessionActive ? <Lock className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
              <span className="ml-1 sm:ml-1.5 hidden xs:inline">{isSessionActive ? 'Terkunci' : 'Buat Materi'}</span>
            </Button>
          </div>
          
          {materiList.length === 0 ? <div className="flex flex-col items-center justify-center py-10 sm:py-16 px-3 sm:px-4">
              <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-full bg-primary/10 flex items-center justify-center mb-3 sm:mb-4">
                <Plus className="h-7 w-7 sm:h-10 sm:w-10 text-primary" />
              </div>
              <p className="text-base sm:text-lg font-semibold mb-1.5 sm:mb-2">Belum ada materi</p>
              <p className="text-xs sm:text-sm text-muted-foreground mb-4 sm:mb-6 text-center max-w-sm">
                Mulai tambahkan materi pembelajaran dengan menekan tombol "Tambah Materi" di atas
              </p>
            </div> : [...materiList].filter(materi => {
              // Filter by search query
              if (!searchQuery.trim()) return true;
              const query = searchQuery.toLowerCase();
              const judul = materi.judul?.toLowerCase() || '';
              const deskripsi = ((materi as any).deskripsi || materi.bab || '').toLowerCase();
              return judul.includes(query) || deskripsi.includes(query);
            }).sort((a, b) => {
              // Extract pertemuan number from deskripsi (e.g., "Pertemuan 1", "Pertemuan 2", etc.)
              const getPertemuanNumber = (m: Materi) => {
                const desc = (m as any).deskripsi || m.bab || '';
                const match = desc.match(/pertemuan\s*(\d+)/i);
                return match ? parseInt(match[1], 10) : 9999;
              };
              return getPertemuanNumber(a) - getPertemuanNumber(b);
            }).map(materi => {
          const executed = isMateriExecuted(materi.id);
          return <Card key={materi.id} className={`rounded-lg sm:rounded-2xl border sm:border-2 border-border/50 hover:border-primary/20 transition-all duration-300 ${executed ? 'bg-muted/10' : 'cursor-pointer'}`} onClick={() => handleRowClick(materi)}>
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
                            {materi.judul}
                          </h3>
                          <p className="text-xs text-muted-foreground truncate">
                            {(materi as any).deskripsi || materi.bab || 'Pertemuan'}
                          </p>
                        </div>
                        <div className="flex-shrink-0" onClick={e => e.stopPropagation()}>
                          <ActionButtonGroup>
                            <DetailButton onClick={() => handleEditMateri(materi)} className="h-7 w-7" />
                            {!isSessionActive && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <MoreButton className="h-7 w-7" />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="rounded-xl w-44">
                                  {materi.status === 'aktif' && (
                                    <DropdownMenuItem onClick={() => openShareDialog(materi)} className="rounded-lg cursor-pointer text-primary text-xs">
                                      <Megaphone className="h-3.5 w-3.5 mr-2" />
                                      Bagikan ke Forum
                                    </DropdownMenuItem>
                                  )}
                                  {materi.status !== 'aktif' && <DropdownMenuItem onClick={() => handlePublish(materi)} className="rounded-lg cursor-pointer text-xs">
                                      <Upload className="h-3.5 w-3.5 mr-2" />
                                      Publikasikan
                                    </DropdownMenuItem>}
                                  {materi.status !== 'arsip' && <DropdownMenuItem onClick={() => handleArchive(materi)} className="rounded-lg cursor-pointer text-xs">
                                      <Archive className="h-3.5 w-3.5 mr-2" />
                                      Arsipkan
                                    </DropdownMenuItem>}
                                  {!executed && <DropdownMenuItem onClick={() => openDeleteDialog(materi)} className="rounded-lg cursor-pointer text-destructive focus:text-destructive text-xs">
                                      <X className="h-3.5 w-3.5 mr-2" />
                                      Hapus
                                    </DropdownMenuItem>}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </ActionButtonGroup>
                        </div>
                      </div>
                      
                      {/* Bottom row: Date + Status badges */}
                      <div className="flex items-center justify-between gap-2 pl-11">
                        <p className="text-[10px] text-muted-foreground">
                          <span className="font-medium">Tanggal Dibuat</span>
                          <br />
                          <span className="text-foreground font-semibold text-[11px]">
                            {(materi as any).created_at || materi.createdAt ? format(new Date((materi as any).created_at || materi.createdAt), 'dd MMM yyyy', {
                              locale: idLocale
                            }) : '-'}
                          </span>
                        </p>
                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                          {React.cloneElement(getStatusBadge(materi.status) as React.ReactElement, { 
                            className: cn((getStatusBadge(materi.status) as React.ReactElement).props.className, "text-[10px] px-1.5 py-0 h-5") 
                          })}
                          {React.cloneElement(getExecutionBadge(materi.id) as React.ReactElement, { 
                            className: cn((getExecutionBadge(materi.id) as React.ReactElement).props.className, "text-[10px] px-1.5 py-0 h-5") 
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Desktop Layout */}
                    <div className="hidden sm:flex items-center justify-between gap-12">
                      {/* Icon + Title Column */}
                      <div className="flex items-center gap-4 w-[500px] flex-shrink-0">
                        <div className="flex-shrink-0">
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                            <FileText className="text-primary w-[24px] h-[24px]" />
                          </div>
                        </div>
                        <div className="flex flex-col gap-1">
                          <h3 className="text-base font-bold text-foreground">
                            {materi.judul}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {(materi as any).deskripsi || materi.bab || 'Pertemuan'}
                          </p>
                        </div>
                      </div>

                      {/* Date Column */}
                      <div className="flex flex-col gap-1 min-w-[120px]">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">
                          Tanggal Dibuat
                        </p>
                        <p className="text-base font-semibold text-foreground">
                          {(materi as any).created_at || materi.createdAt ? format(new Date((materi as any).created_at || materi.createdAt), 'dd MMM yyyy', {
                      locale: idLocale
                    }) : '-'}
                        </p>
                      </div>

                      {/* Status & Execution Column */}
                      <div className="flex flex-col gap-2 min-w-[140px]">
                        <div className="flex items-center gap-2">
                          {getStatusBadge(materi.status)}
                          {getExecutionBadge(materi.id)}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex-shrink-0 ml-auto" onClick={e => e.stopPropagation()}>
                        <ActionButtonGroup>
                          <DetailButton onClick={() => handleEditMateri(materi)} />
                          {!isSessionActive && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <MoreButton />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="rounded-xl w-48">
                                {materi.status === 'aktif' && (
                                  <DropdownMenuItem onClick={() => openShareDialog(materi)} className="rounded-lg cursor-pointer text-primary">
                                    <Megaphone className="h-4 w-4 mr-2" />
                                    Bagikan ke Forum
                                  </DropdownMenuItem>
                                )}
                                {materi.status !== 'aktif' && <DropdownMenuItem onClick={() => handlePublish(materi)} className="rounded-lg cursor-pointer">
                                    <Upload className="h-4 w-4 mr-2" />
                                    Publikasikan
                                  </DropdownMenuItem>}
                                {materi.status !== 'arsip' && <DropdownMenuItem onClick={() => handleArchive(materi)} className="rounded-lg cursor-pointer">
                                    <Archive className="h-4 w-4 mr-2" />
                                    Arsipkan
                                  </DropdownMenuItem>}
                                {!executed && <DropdownMenuItem onClick={() => openDeleteDialog(materi)} className="rounded-lg cursor-pointer text-destructive focus:text-destructive">
                                    <X className="h-4 w-4 mr-2" />
                                    Hapus
                                  </DropdownMenuItem>}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
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
            <AlertDialogTitle>Hapus Materi</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus materi "{selectedMateri?.judul}"? 
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="rounded-xl bg-destructive hover:bg-destructive/90">
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Share to Forum Dialog */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-amber-500" />
              Bagikan ke Forum Diskusi
            </DialogTitle>
            <DialogDescription>
              Bagikan materi ini sebagai pengumuman di forum diskusi kelas
            </DialogDescription>
          </DialogHeader>
          
          {/* Materi Preview Card */}
          {shareMateri && (
            <div className="p-4 rounded-xl bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shrink-0">
                  <FileText className="h-6 w-6 text-primary-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-foreground truncate">
                    {shareMateri.judul}
                  </p>
                  {(shareMateri as any).deskripsi && (
                    <p className="text-sm text-muted-foreground truncate">
                      {(shareMateri as any).deskripsi}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Message Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Pesan Pengumuman</label>
            <Textarea
              value={shareContent}
              onChange={(e) => setShareContent(e.target.value)}
              placeholder="Tulis pesan pengumuman..."
              className="min-h-[120px] resize-none rounded-xl"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button 
              variant="outline" 
              onClick={() => setShareDialogOpen(false)}
              className="rounded-xl"
            >
              Batal
            </Button>
            <Button 
              onClick={handleShareToForum}
              disabled={!shareContent.trim() || isSharing}
              className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
            >
              {isSharing ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  Membagikan...
                </>
              ) : (
                <>
                  <Megaphone className="h-4 w-4 mr-2" />
                  Bagikan ke Forum
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Materi Sheet for edit/add */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="full" className="p-0 flex flex-col">
          <SheetHeader className="px-6 py-4 border-b bg-gradient-to-r from-muted/30 to-muted/10 flex-shrink-0 flex-row items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              {getSheetTitle()}
              {sheetMode === 'edit' && sheetMateri && isMateriExecuted(sheetMateri.id) && <Badge variant="outline" className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400 border-green-200 dark:border-green-800">
                  Sudah Terlaksana
                </Badge>}
              {isSessionActive && <Badge variant="outline" className="bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400 border-amber-200 dark:border-amber-800 gap-1">
                  <Lock className="h-3 w-3" />
                  Sesi Aktif
                </Badge>}
            </SheetTitle>
            <button onClick={handleCloseSheet} className="p-2 rounded-lg bg-muted/50 hover:bg-muted opacity-70 hover:opacity-100 transition-all">
              <X className="h-5 w-5" />
            </button>
          </SheetHeader>
          {isSessionActive && (
            <div className="mx-6 mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-center gap-3">
              <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Materi hanya dapat dilihat saat sesi pembelajaran sedang berlangsung. Perubahan tidak dapat disimpan.
              </p>
            </div>
          )}
          <div className="flex-1 overflow-y-auto p-6">
            {mapelId && <MateriForm materi={sheetMateri || undefined} mapelId={mapelId} semester={semester} onBack={handleCloseSheet} onSave={handleSaveMateri} renderFooter={false} cachedTujuanPembelajaran={cachedTujuanPembelajaran} cachedTpStatus={cachedTpStatus} />}
          </div>
          {/* Footer with action buttons */}
          <div className="flex-shrink-0 border-t bg-background px-6 py-4">
            <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
              <Button variant="outline" onClick={handleCloseSheet} className="rounded-xl w-full sm:w-auto">
                <X className="h-4 w-4 mr-2" />
                Tutup
              </Button>
              {isMateriDirty && !isSessionActive && <Button onClick={() => {
              const saveButton = document.querySelector('[data-materi-save-draft]') as HTMLButtonElement;
              if (saveButton) saveButton.click();
            }} className="rounded-xl w-full sm:w-auto shadow-md hover:shadow-lg transition-all bg-primary hover:bg-primary/90">
                  <Save className="h-4 w-4 mr-2" />
                  Simpan Perubahan
                </Button>}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>;
}