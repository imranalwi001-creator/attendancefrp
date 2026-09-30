import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, Printer, Book, AlertCircle, Layers, Copy, Coffee, Moon, Pause, MoreHorizontal, ArrowRightLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { QuickAddModal } from '@/components/jadwal/QuickAddModal';
import { JadwalDetailModal } from '@/components/jadwal/JadwalDetailModal';
import { DuplicateToBlockModal } from '@/components/jadwal/DuplicateToBlockModal';
import { MoveToBlockModal } from '@/components/jadwal/MoveToBlockModal';
import { validateJadwal } from '@/utils/jadwalValidation';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAcademicYear } from '@/contexts/AcademicYearContext';
import { logActivity } from '@/lib/activityLogger';
import { ReportPrintTemplate, PrintButton } from '@/components/print';
import { BadgeTahunAjaran } from '@/components/kalender/BadgeTahunAjaran';
import { useLearningBlocks } from '@/hooks/useLearningBlocks';
import { BlockSelector } from '@/components/jadwal/BlockSelector';
import { ActionButtonGroup, DetailButton, DeleteButton } from '@/components/ui/action-buttons';
import { JadwalTipe } from '@/types';

const HARI_LIST = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'] as const;

// Jadwal tipe configuration for display
const JADWAL_TIPE_CONFIG: Record<JadwalTipe, { label: string; icon: React.ReactNode; bgColor: string; textColor: string }> = {
  pelajaran: { label: 'Mata Pelajaran', icon: <Book className="h-6 w-6" />, bgColor: 'bg-primary/10', textColor: 'text-primary' },
  istirahat: { label: 'Istirahat', icon: <Coffee className="h-6 w-6" />, bgColor: 'bg-amber-500/10', textColor: 'text-amber-600' },
  tidur_siang: { label: 'Tidur Siang', icon: <Moon className="h-6 w-6" />, bgColor: 'bg-blue-400/10', textColor: 'text-blue-500' },
  break: { label: 'Break', icon: <Pause className="h-6 w-6" />, bgColor: 'bg-slate-400/10', textColor: 'text-slate-500' },
  lainnya: { label: 'Lainnya', icon: <MoreHorizontal className="h-6 w-6" />, bgColor: 'bg-purple-500/10', textColor: 'text-purple-600' }
};

const resolveJadwalKategori = (jadwal: any, mapelList: Array<{ id: string; kategori?: string | null }>) => {
  const tipe = jadwal.tipe || 'pelajaran';

  if (tipe === 'pelajaran') {
    const selectedMapel = mapelList.find((mapel) => mapel.id === jadwal.mapelId || mapel.id === jadwal.mapel_id);
    return selectedMapel?.kategori === 'asrama' ? 'asrama' : 'akademik';
  }

  return 'akademik';
};

export default function JadwalDetail() {
  const { kelasId } = useParams<{ kelasId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { activeAcademicYear, getCurrentSemester, isDateOutsideSemesters } = useAcademicYear();
  const [activeDay, setActiveDay] = useState<string>('Senin');
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [editingJadwal, setEditingJadwal] = useState<any>(null);
  const [quickAddDefaults, setQuickAddDefaults] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showAllSchedulesModal, setShowAllSchedulesModal] = useState(false);
  const [selectedSemester, setSelectedSemester] = useState<'ganjil' | 'genap'>('ganjil');
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  // Detail modal states
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedJadwalForDetail, setSelectedJadwalForDetail] = useState<any>(null);
  const [isDuplicateToBlockModalOpen, setIsDuplicateToBlockModalOpen] = useState(false);
  const [isMoveToBlockModalOpen, setIsMoveToBlockModalOpen] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  
  // Auto-detect semester on mount or get from URL params
  useEffect(() => {
    const semesterParam = searchParams.get('semester');
    if (semesterParam === 'ganjil' || semesterParam === 'genap') {
      setSelectedSemester(semesterParam);
    } else {
      const detectedSemester = getCurrentSemester();
      if (detectedSemester) {
        setSelectedSemester(detectedSemester);
      }
    }
    
    // Get blockId from URL params
    const blockIdParam = searchParams.get('blockId');
    if (blockIdParam) {
      setSelectedBlockId(blockIdParam);
    }
  }, [getCurrentSemester, searchParams]);

  // Learning blocks integration
  const { 
    learningBlocks, 
    activeBlock, 
    isBlockSystem, 
    formatBlockLabel, 
    isBlockActive,
    getBlockById,
    getBlockValidDays,
    getBlockDatesForDay
  } = useLearningBlocks({ semester: selectedSemester });

  // Auto-select first block when block system is enabled and no block selected
  useEffect(() => {
    if (isBlockSystem && learningBlocks.length > 0 && !selectedBlockId) {
      // Default to first block (Blok 1)
      setSelectedBlockId(learningBlocks[0].id);
    }
  }, [isBlockSystem, learningBlocks, selectedBlockId]);

  // Get current kelas info - will be filled after kelasList is fetched
  const selectedKelas = kelasId === 'all' ? null : kelasId;

  // Combined fetch for all reference data (guru, kelas, mapel) - OPTIMIZED single query
  const { data: referenceData } = useQuery({
    queryKey: ['jadwal-reference-data', activeAcademicYear?.name, selectedKelas],
    queryFn: async () => {
      // Parallel fetch all reference data with explicit columns
      const [rolesResult, kelasResult, mapelResult] = await Promise.all([
        supabase.from('user_roles').select('user_id, role').in('role', ['guru', 'walikelas', 'Pembina', 'guru_ekskul', 'staff']),
        supabase.from('kelas')
          .select('id, nama, tingkat, tahun_ajaran, status, walikelas_id')
          .eq('status', 'aktif')
          .eq('tahun_ajaran', activeAcademicYear?.name || '')
          .limit(50),
        selectedKelas 
          ? supabase.from('mapel')
              .select('id, nama, kode_mapel, kategori, status, kelas_id, pengampu_id, deskripsi')
              .eq('status', 'aktif')
              .eq('kelas_id', selectedKelas)
              .limit(100)
          : supabase.from('mapel')
              .select('id, nama, kode_mapel, kategori, status, kelas_id, pengampu_id, deskripsi')
              .eq('status', 'aktif')
              .limit(200)
      ]);

      if (rolesResult.error) throw rolesResult.error;
      if (kelasResult.error) throw kelasResult.error;
      if (mapelResult.error) throw mapelResult.error;

      // Fetch profile names for guru
      const userIds = rolesResult.data.map(r => r.user_id);
      const { data: profiles } = await supabase.from('profiles').select('id, name').in('id', userIds);

      const guruList = rolesResult.data.map(item => ({
        id: item.user_id,
        name: profiles?.find(p => p.id === item.user_id)?.name || 'Unknown',
        role: item.role
      }));

      const mapelList = (mapelResult.data || [])
        .map(m => ({
          id: m.id,
          nama: m.nama,
          kelasId: m.kelas_id,
          kelas_id: m.kelas_id,
          pengampu_id: m.pengampu_id,
          pengampuId: m.pengampu_id,
          deskripsi: m.deskripsi,
          kode: m.kode_mapel,
          kategori: m.kategori,
          status: m.status
        }))
        .sort((a, b) => a.nama.localeCompare(b.nama, 'id'));

      return {
        guruList,
        kelasList: kelasResult.data || [],
        mapelList
      };
    },
    staleTime: 10 * 60 * 1000, // 10 minutes cache
    gcTime: 30 * 60 * 1000, // 30 minutes garbage collection
    refetchOnWindowFocus: false,
    refetchInterval: false,
    enabled: !!activeAcademicYear?.name
  });

  const guruList = referenceData?.guruList || [];
  const kelasList = referenceData?.kelasList || [];
  const mapelList = referenceData?.mapelList || [];
  const currentKelas = kelasId === 'all' ? null : kelasList.find((k: any) => k.id === kelasId);

  // Fetch jadwal list with embedded data - OPTIMIZED single query
  // Filter by block_id when block system is active, but also show jadwal without block_id
  const { data: jadwalList = [], refetch: refetchJadwal } = useQuery({
    queryKey: ['jadwal-list', selectedKelas, selectedSemester, isBlockSystem ? selectedBlockId : null],
    queryFn: async () => {
      // Use embedded select with explicit columns to reduce round trips
      let query = supabase
        .from('jadwal')
        .select(`
          id, hari, jam_mulai, jam_selesai, kelas_id, mapel_id, pengampu_id, 
          semester, status, block_id, kategori, tipe, ruangan, label,
          mapel:mapel_id(id, nama),
          pengampu:staff!jadwal_pengampu_id_fkey(id, profiles!staff_id_fkey(name))
        `)
        .eq('semester', selectedSemester)
        .limit(200);
      
      if (selectedKelas) {
        query = query.eq('kelas_id', selectedKelas);
      }
      
      // When block system is active, show jadwal with matching block_id OR null block_id (legacy data)
      if (isBlockSystem && selectedBlockId) {
        query = query.or(`block_id.eq.${selectedBlockId},block_id.is.null`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      return (data || [])
        .map((j: any) => ({
          id: j.id,
          tipe: j.tipe || 'pelajaran',
          label: j.label || null,
          hari: j.hari,
          jamMulai: j.jam_mulai,
          jam_mulai: j.jam_mulai,
          jamSelesai: j.jam_selesai,
          jam_selesai: j.jam_selesai,
          kelasId: j.kelas_id,
          kelas_id: j.kelas_id,
          mapelId: j.mapel_id,
          mapel_id: j.mapel_id,
          pengampuId: j.pengampu_id,
          pengampu_id: j.pengampu_id,
          ruangan: j.ruangan || '',
          status: j.status as 'aktif' | 'nonaktif',
          semester: j.semester,
          blockId: j.block_id,
          block_id: j.block_id,
          mapelNama: j.mapel?.nama || null,
          pengampuNama: j.pengampu?.profiles?.name || null
        }))
        .sort((a: any, b: any) => a.jam_mulai.localeCompare(b.jam_mulai));
    },
    staleTime: 30 * 1000, // 30 seconds cache
    gcTime: 5 * 60 * 1000
  });

  // Fetch ALL jadwal for conflict checking - lazy load only when modal opens
  // For block system, include jadwal with matching block_id OR without block_id (legacy)
  const { data: allJadwalList = [] } = useQuery({
    queryKey: ['all-jadwal-list', selectedSemester, isBlockSystem ? selectedBlockId : null],
    queryFn: async () => {
      let query = supabase
        .from('jadwal')
        .select(`
          id, hari, jam_mulai, jam_selesai, kelas_id, mapel_id, pengampu_id, block_id, tipe, label,
          mapel:mapel_id(nama)
        `)
        .eq('semester', selectedSemester);
      
      // When block system is active, show jadwal with matching block_id OR null block_id (legacy)
      if (isBlockSystem && selectedBlockId) {
        query = query.or(`block_id.eq.${selectedBlockId},block_id.is.null`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      return (data || []).map((j: any) => ({
        id: j.id,
        tipe: j.tipe || 'pelajaran',
        label: j.label || null,
        hari: j.hari,
        jam_mulai: j.jam_mulai,
        jam_selesai: j.jam_selesai,
        kelas_id: j.kelas_id,
        mapel_id: j.mapel_id,
        pengampu_id: j.pengampu_id,
        block_id: j.block_id,
        mapelNama: j.mapel?.nama || null
      }));
    },
    staleTime: 60 * 1000, // 1 minute cache
    gcTime: 5 * 60 * 1000
  });

  // Get mapel name by id
  const getMapelName = (mapelId: string, jadwalMapelNama?: string | null) => {
    if (jadwalMapelNama) return jadwalMapelNama;
    return mapelList.find(m => m.id === mapelId)?.nama || '-';
  };

  // Get guru name by id
  const getGuruName = (guruId: string, jadwalPengampuNama?: string | null) => {
    if (jadwalPengampuNama) return jadwalPengampuNama;
    return guruList.find(g => g.id === guruId)?.name || '-';
  };

  // Create jadwal mutation
  const createJadwalMutation = useMutation({
    mutationFn: async (jadwal: any) => {
      const insertData: any = {
        kelas_id: jadwal.kelasId,
        kategori: resolveJadwalKategori(jadwal, mapelList),
        tipe: jadwal.tipe || 'pelajaran',
        label: jadwal.label || null,
        mapel_id: jadwal.tipe === 'pelajaran' ? jadwal.mapelId : null,
        pengampu_id: jadwal.tipe === 'pelajaran' ? jadwal.pengampuId : null,
        hari: jadwal.hari,
        jam_mulai: jadwal.jamMulai,
        jam_selesai: jadwal.jamSelesai,
        ruangan: jadwal.ruangan || null,
        status: jadwal.status,
        semester: selectedSemester
      };
      
      // Add block_id if block system is active
      if (isBlockSystem && selectedBlockId) {
        insertData.block_id = selectedBlockId;
      }
      
      const { data, error } = await supabase.from('jadwal').insert(insertData).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['jadwal-list'] });
      queryClient.invalidateQueries({ queryKey: ['jadwal-overview-data'] });
      queryClient.invalidateQueries({ queryKey: ['all-jadwal-list'] });
      
      logActivity({
        action: 'jadwal_add',
        category: 'academic',
        description: `Menambahkan jadwal ${data?.tipe || 'pelajaran'} baru`,
        metadata: { jadwalId: data?.id, hari: data?.hari, kelasId: data?.kelas_id, blockId: data?.block_id, tipe: data?.tipe }
      });
      
      refetchJadwal();
    }
  });

  // Update jadwal mutation
  const updateJadwalMutation = useMutation({
    mutationFn: async ({ id, ...jadwal }: any) => {
      const updateData: any = {
        kelas_id: jadwal.kelasId,
        kategori: resolveJadwalKategori(jadwal, mapelList),
        tipe: jadwal.tipe || 'pelajaran',
        label: jadwal.label || null,
        mapel_id: jadwal.tipe === 'pelajaran' ? jadwal.mapelId : null,
        pengampu_id: jadwal.tipe === 'pelajaran' ? jadwal.pengampuId : null,
        hari: jadwal.hari,
        jam_mulai: jadwal.jamMulai,
        jam_selesai: jadwal.jamSelesai,
        ruangan: jadwal.ruangan || null,
        status: jadwal.status
      };

      // PROTEKSI: JANGAN paksa block_id saat update.
      // Sebelumnya kode memaksa block_id = selectedBlockId, sehingga jadwal legacy
      // (block_id null) atau jadwal dari block lain bisa "dipindah" tanpa sengaja.
      // Sekarang block_id hanya boleh di-set lewat fitur "Pindahkan ke Fase Lain".
      // (Tambahan: trigger DB juga mencegah block_id di-NULL-kan setelah pernah diset.)

      const { data, error } = await supabase.from('jadwal').update(updateData).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['jadwal-list'] });
      queryClient.invalidateQueries({ queryKey: ['jadwal-overview-data'] });
      queryClient.invalidateQueries({ queryKey: ['all-jadwal-list'] });
      
      logActivity({
        action: 'jadwal_edit',
        category: 'academic',
        description: `Mengedit jadwal ${data?.tipe || 'pelajaran'}`,
        metadata: { jadwalId: data?.id, hari: data?.hari, blockId: data?.block_id, tipe: data?.tipe }
      });
      
      refetchJadwal();
    }
  });

  // Delete jadwal mutation
  const deleteJadwalMutation = useMutation({
    mutationFn: async (id: string) => {
      // PROTEKSI: Saat sistem blok aktif, pastikan jadwal yang dihapus benar-benar
      // milik blok yang sedang dilihat (atau jadwal legacy tanpa block_id).
      // Mencegah penghapusan jadwal di blok lain karena state yang kadaluarsa.
      if (isBlockSystem && selectedBlockId) {
        const { data: existing, error: fetchErr } = await supabase
          .from('jadwal')
          .select('block_id')
          .eq('id', id)
          .maybeSingle();
        if (fetchErr) throw fetchErr;
        if (existing && existing.block_id && existing.block_id !== selectedBlockId) {
          throw new Error('Jadwal ini berada di fase lain. Silakan pindah ke fase tersebut untuk menghapusnya.');
        }
      }
      const { error } = await supabase.from('jadwal').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['jadwal-list'] });
      queryClient.invalidateQueries({ queryKey: ['jadwal-overview-data'] });
      queryClient.invalidateQueries({ queryKey: ['all-jadwal-list'] });
      
      logActivity({
        action: 'jadwal_delete',
        category: 'academic',
        description: `Menghapus jadwal mata pelajaran`,
        metadata: { jadwalId: id }
      });
      
      refetchJadwal();
    }
  });

  const handleAddJadwal = (hari?: string) => {
    if (!selectedKelas || selectedKelas === 'all') {
      toast({
        title: "Pilih Kelas Terlebih Dahulu",
        description: "Silakan pilih kelas spesifik untuk menambah jadwal",
        variant: "destructive"
      });
      return;
    }
    
    // For block system, require block selection
    if (isBlockSystem && !selectedBlockId) {
      toast({
        title: "Pilih Blok Terlebih Dahulu",
        description: "Silakan pilih blok pembelajaran sebelum menambah jadwal",
        variant: "destructive"
      });
      return;
    }
    
    const selectedHari = hari || activeDay;
    setQuickAddDefaults({
      hari: selectedHari,
      kelasId: selectedKelas,
      kelas_id: selectedKelas,
      status: 'aktif'
    });
    setEditingJadwal(null);
    setIsQuickAddOpen(true);
  };

  const handleViewDetail = (jadwal: any) => {
    setSelectedJadwalForDetail(jadwal);
    setIsDetailModalOpen(true);
  };

  const handleEditJadwal = (jadwal: any) => {
    setEditingJadwal(jadwal);
    setQuickAddDefaults(null);
    setIsQuickAddOpen(true);
  };

  const handleDeleteClick = (jadwalId: string) => {
    setDeleteConfirm(jadwalId);
  };

  // Get valid days and block label for validation
  const currentBlock = selectedBlockId ? getBlockById(selectedBlockId) : null;
  const validDays = currentBlock ? getBlockValidDays(currentBlock) : [];
  const blockLabel = currentBlock ? formatBlockLabel(currentBlock) : '';

  const handleQuickAddSubmit = async (data: any) => {
    if (!data.kelasId) {
      toast({
        title: "Validasi Gagal",
        description: "Kelas harus dipilih",
        variant: "destructive"
      });
      return;
    }
    
    // Prepare block validation options
    const blockValidationOptions = isBlockSystem && selectedBlockId ? {
      isBlockSystem: true,
      validDays,
      blockLabel
    } : undefined;
    
    try {
      if (editingJadwal) {
        const validation = validateJadwal(data, allJadwalList, editingJadwal.id, blockValidationOptions);
        if (validation) {
          toast({
            title: "Validasi Gagal",
            description: validation.message,
            variant: "destructive"
          });
          return;
        }
        await updateJadwalMutation.mutateAsync({ id: editingJadwal.id, ...data });
        toast({
          title: "Jadwal diperbarui",
          description: "Jadwal pelajaran berhasil diperbarui"
        });
      } else {
        const validation = validateJadwal(data, allJadwalList, undefined, blockValidationOptions);
        if (validation) {
          toast({
            title: "Validasi Gagal",
            description: validation.message,
            variant: "destructive"
          });
          return;
        }
        await createJadwalMutation.mutateAsync(data);
        toast({
          title: "Jadwal ditambahkan",
          description: "Jadwal berhasil ditambahkan"
        });
      }
      setIsQuickAddOpen(false);
      setEditingJadwal(null);
      setQuickAddDefaults(null);
    } catch (error) {
      console.error('Error saving jadwal:', error);
      const description = error instanceof Error
        ? error.message
        : 'Terjadi kesalahan saat menyimpan jadwal';
      toast({
        title: "Gagal menyimpan",
        description,
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (id: string) => {
    await deleteJadwalMutation.mutateAsync(id);
    setDeleteConfirm(null);
    toast({
      title: "Jadwal dihapus",
      description: "Jadwal pelajaran berhasil dihapus",
      variant: "destructive"
    });
  };

  // Handle duplicate jadwal to other days
  const handleDuplicateJadwal = async (jadwal: any, targetDays: string[]) => {
    // Prepare block validation options
    const blockValidationOptions = isBlockSystem && selectedBlockId ? {
      isBlockSystem: true,
      validDays,
      blockLabel
    } : undefined;
    
    try {
      let successCount = 0;
      for (const day of targetDays) {
        const duplicateData = {
          kelasId: jadwal.kelasId || jadwal.kelas_id,
          tipe: jadwal.tipe || 'pelajaran',
          label: jadwal.label || '',
          mapelId: jadwal.mapelId || jadwal.mapel_id,
          pengampuId: jadwal.pengampuId || jadwal.pengampu_id,
          hari: day,
          jamMulai: jadwal.jamMulai || jadwal.jam_mulai,
          jamSelesai: jadwal.jamSelesai || jadwal.jam_selesai,
          ruangan: jadwal.ruangan || '',
          status: jadwal.status || 'aktif'
        };

        // Validate before creating (including block validation)
        const validation = validateJadwal(duplicateData, allJadwalList, undefined, blockValidationOptions);
        if (validation) {
          toast({
            title: `Gagal duplikasi ke ${day}`,
            description: validation.message,
            variant: "destructive"
          });
          continue;
        }

        await createJadwalMutation.mutateAsync(duplicateData);
        successCount++;
      }
      
      if (successCount > 0) {
        toast({
          title: "Jadwal diduplikasi",
          description: `Jadwal berhasil diduplikasi ke ${successCount} hari`
        });
      }
      
      setIsDetailModalOpen(false);
    } catch (error) {
      console.error('Error duplicating jadwal:', error);
      toast({
        title: "Gagal menduplikasi",
        description: "Terjadi kesalahan saat menduplikasi jadwal",
        variant: "destructive"
      });
    }
  };

  // Get selected block info for display
  const selectedBlock = getBlockById(selectedBlockId);
  
  // Always show all days so legacy jadwal (without block_id) on any day remains visible
  const displayDays = HARI_LIST as unknown as string[];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="container mx-auto px-4 py-6">
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-primary/80 p-8 shadow-xl">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary-foreground/10 rounded-full blur-3xl -translate-y-32 translate-x-32" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary-foreground/5 rounded-full blur-2xl translate-y-24 -translate-x-24" />
            
            <div className="relative flex items-start gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/admin/jadwal')} className="rounded-xl bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground border-0">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              
              <div className="flex-1">
                <div className="flex items-center justify-between gap-4 mb-2">
                  <h1 className="text-3xl font-bold text-primary-foreground">
                    {currentKelas ? `Jadwal Pelajaran Kelas ${currentKelas.nama}` : 'Semua Jadwal Pelajaran'}
                  </h1>
                  <div className="flex items-center gap-2">
                    {isBlockSystem && selectedBlockId && jadwalList.length > 0 && learningBlocks.length > 1 && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setIsDuplicateToBlockModalOpen(true)} 
                        className="rounded-xl text-primary-foreground text-sm h-10 gap-2 px-4 whitespace-nowrap bg-white/[0.16] border"
                      >
                        <Copy className="h-4 w-4" />
                        Duplikasi ke Blok Lain
                      </Button>
                    )}
                    {jadwalList.length > 0 && currentKelas && (
                      <Button variant="ghost" size="sm" onClick={() => setShowAllSchedulesModal(true)} className="rounded-xl text-primary-foreground text-sm h-10 gap-2 px-4 whitespace-nowrap bg-white/[0.16] border">
                        <Printer className="h-4 w-4" />
                        Print Jadwal    
                      </Button>
                    )}
                  </div>
                </div>
                
                <div className="mt-4 flex items-center gap-2 flex-wrap">
                  <BadgeTahunAjaran className="bg-white/20 text-primary-foreground" />
                </div>
              </div>
            </div>
            
          </div>
          
          {/* Block Selector - Show when block system is active */}
          {isBlockSystem && (
            <div className="w-full space-y-3">
              <BlockSelector
                blocks={learningBlocks}
                selectedBlockId={selectedBlockId}
                onBlockChange={setSelectedBlockId}
                activeBlockId={activeBlock?.id || null}
                formatBlockLabel={formatBlockLabel}
                isBlockActive={isBlockActive}
                showAllOption={false}
              />
              {!selectedBlockId && (
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">Pilih blok untuk melihat atau menambah jadwal</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 container mx-auto px-4 pb-6 space-y-6">
        {displayDays.map(hari => {
          const hariJadwal = jadwalList.filter(jadwal => jadwal.kelasId === selectedKelas && jadwal.hari === hari);
          return (
            <Card key={hari} className="rounded-xl border-2 border-border/50 shadow-lg bg-card overflow-hidden">
              <CardHeader className="border-b border-border/50 py-[16px]">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl font-bold text-foreground">{hari}</CardTitle>
                  <Button variant="outline" size="sm" onClick={() => {
                    setActiveDay(hari);
                    handleAddJadwal(hari);
                  }} className="rounded-xl border-primary text-primary hover:bg-primary hover:text-primary-foreground text-xs sm:text-sm h-9 sm:h-10 gap-2 px-4">
                    <Plus className="h-4 w-4" />
                    Tambah Jadwal
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-3">
                {hariJadwal.length > 0 ? hariJadwal.map(jadwal => {
                  const jadwalTipe = (jadwal.tipe || 'pelajaran') as JadwalTipe;
                  const tipeConfig = JADWAL_TIPE_CONFIG[jadwalTipe];
                  const isPelajaran = jadwalTipe === 'pelajaran';
                  
                  return (
                    <Card key={jadwal.id} className="rounded-2xl border-2 border-border/50 hover:border-primary/20 transition-all duration-300">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between gap-8">
                          <div className="flex items-center gap-4 min-w-[280px]">
                            <div className="flex-shrink-0">
                              <div className={`w-12 h-12 rounded-full ${tipeConfig.bgColor} flex items-center justify-center`}>
                                <span className={tipeConfig.textColor}>{tipeConfig.icon}</span>
                              </div>
                            </div>
                            <div className="flex flex-col gap-1">
                              <h3 className="text-base font-bold text-foreground">
                                {isPelajaran 
                                  ? getMapelName(jadwal.mapelId, jadwal.mapelNama)
                                  : jadwal.label || tipeConfig.label
                                }
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                {currentKelas?.nama || 'Kelas'}
                              </p>
                            </div>
                          </div>

                          {isPelajaran && (
                            <div className="flex flex-col gap-1 min-w-[200px]">
                              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                                Nama Guru Pengampu
                              </p>
                              <p className="text-base font-semibold text-foreground">
                                {getGuruName(jadwal.pengampuId, jadwal.pengampuNama)}
                              </p>
                            </div>
                          )}

                          <div className="flex flex-col gap-1 min-w-[180px]">
                            <p className="text-xs text-muted-foreground uppercase tracking-wide">
                              {isPelajaran ? 'Jam Mata Pelajaran' : 'Waktu'}
                            </p>
                            <p className="text-base font-semibold text-foreground">
                              {jadwal.jamMulai} - {jadwal.jamSelesai}
                            </p>
                          </div>

                          <ActionButtonGroup className="flex-shrink-0 ml-auto">
                            <DetailButton onClick={() => handleViewDetail(jadwal)} />
                            <DeleteButton onClick={() => handleDeleteClick(jadwal.id)} />
                          </ActionButtonGroup>
                        </div>
                      </CardContent>
                    </Card>
                  );
                }) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Belum ada jadwal untuk hari {hari}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Add Modal */}
      <QuickAddModal 
        open={isQuickAddOpen} 
        onOpenChange={setIsQuickAddOpen} 
        editingJadwal={editingJadwal} 
        defaultValues={quickAddDefaults} 
        kelasList={kelasList} 
        mapelList={mapelList} 
        guruList={guruList} 
        allJadwalList={allJadwalList} 
        onSubmit={handleQuickAddSubmit}
        isBlockSystem={isBlockSystem}
        selectedBlockLabel={selectedBlock ? formatBlockLabel(selectedBlock) : undefined}
        validDays={selectedBlock ? getBlockValidDays(selectedBlock) : undefined}
        blockDatesForDay={selectedBlock && quickAddDefaults?.hari 
          ? getBlockDatesForDay(selectedBlock, quickAddDefaults.hari) 
          : undefined}
      />

      {/* Detail Modal */}
      <JadwalDetailModal
        open={isDetailModalOpen}
        onOpenChange={setIsDetailModalOpen}
        jadwal={selectedJadwalForDetail}
        mapelNama={selectedJadwalForDetail ? getMapelName(selectedJadwalForDetail.mapelId, selectedJadwalForDetail.mapelNama) : ''}
        guruNama={selectedJadwalForDetail ? getGuruName(selectedJadwalForDetail.pengampuId, selectedJadwalForDetail.pengampuNama) : ''}
        kelasNama={currentKelas?.nama || ''}
        onEdit={() => handleEditJadwal(selectedJadwalForDetail)}
        onDuplicate={(targetDays) => selectedJadwalForDetail && handleDuplicateJadwal(selectedJadwalForDetail, targetDays)}
        onMoveToBlock={
          isBlockSystem && selectedJadwalForDetail?.block_id && learningBlocks.length > 1
            ? () => setIsMoveToBlockModalOpen(true)
            : undefined
        }
        isBlockSystem={isBlockSystem}
        blockLabel={selectedBlock ? formatBlockLabel(selectedBlock) : undefined}
        blockDates={selectedBlock && selectedJadwalForDetail ? getBlockDatesForDay(selectedBlock, selectedJadwalForDetail.hari) : undefined}
        validDays={selectedBlock ? getBlockValidDays(selectedBlock) : undefined}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Jadwal?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak dapat dibatalkan. Jadwal akan dihapus secara permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteConfirm && handleDelete(deleteConfirm)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Print Schedule Modal */}
      <Dialog open={showAllSchedulesModal} onOpenChange={setShowAllSchedulesModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto p-0">
          <div className="print-preview-wrapper">
            <div className="no-print flex justify-between items-center p-4 bg-background border-b sticky top-0 z-10">
              <h3 className="text-lg font-semibold">Preview Cetak Jadwal</h3>
              <PrintButton
                contentRef={printRef}
                documentTitle={`Jadwal_Kelas_${currentKelas?.nama || 'All'}${selectedBlock ? `_Blok${selectedBlock.fase}` : ''}`}
                variant="default"
                size="sm"
                className="gap-2"
              >
                <Printer className="h-4 w-4" />
                Cetak Jadwal
              </PrintButton>
            </div>
            
            <ReportPrintTemplate
              ref={printRef}
              title="JADWAL PELAJARAN"
              tahunAjaran={activeAcademicYear?.name}
              semester={selectedSemester}
              signer={{
                name: "Kepala Sekolah",
                jabatan: "Kepala Sekolah"
              }}
            >
              {/* Class Info */}
              {currentKelas && (
                <div className="mb-4">
                  <table className="text-sm">
                    <tbody>
                      <tr>
                        <td className="pr-4 py-1 text-muted-foreground">Kelas</td>
                        <td className="pr-2">:</td>
                        <td className="font-semibold">{currentKelas.nama}</td>
                      </tr>
                      <tr>
                        <td className="pr-4 py-1 text-muted-foreground">Tingkat</td>
                        <td className="pr-2">:</td>
                        <td className="font-semibold">{currentKelas.tingkat}</td>
                      </tr>
                      {selectedBlock && (
                        <tr>
                          <td className="pr-4 py-1 text-muted-foreground">Blok</td>
                          <td className="pr-2">:</td>
                          <td className="font-semibold">{formatBlockLabel(selectedBlock)}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Schedule Tables by Day */}
              {HARI_LIST.map(hari => {
                const hariJadwal = jadwalList
                  .filter(j => j.hari === hari)
                  .sort((a, b) => a.jamMulai.localeCompare(b.jamMulai));
                
                if (hariJadwal.length === 0) return null;
                
                return (
                  <div key={hari} className="mb-6 avoid-break">
                    <h3 className="text-base font-bold mb-2 text-foreground">{hari}</h3>
                    <table className="print-table">
                      <thead>
                        <tr>
                          <th className="w-12">No</th>
                          <th className="w-32">Jam</th>
                          <th>Mata Pelajaran</th>
                          <th>Guru Pengampu</th>
                          <th className="w-24">Ruangan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {hariJadwal.map((jadwal, idx) => {
                          const jadwalTipe = (jadwal.tipe || 'pelajaran') as JadwalTipe;
                          const isPelajaran = jadwalTipe === 'pelajaran';
                          const tipeConfig = JADWAL_TIPE_CONFIG[jadwalTipe];
                          
                          if (!isPelajaran) {
                            // Non-pelajaran: render merged row with label
                            return (
                              <tr key={jadwal.id} className="bg-amber-100 dark:bg-amber-900/30 border-b border-border">
                                <td className="text-center">{idx + 1}</td>
                                <td>{jadwal.jamMulai} - {jadwal.jamSelesai}</td>
                                <td colSpan={3} className="text-center font-medium italic">
                                  {jadwal.label || tipeConfig.label}
                                </td>
                              </tr>
                            );
                          }
                          
                          // Pelajaran: render normal row
                          return (
                            <tr key={jadwal.id}>
                              <td className="text-center">{idx + 1}</td>
                              <td>{jadwal.jamMulai} - {jadwal.jamSelesai}</td>
                              <td>{getMapelName(jadwal.mapelId, jadwal.mapelNama)}</td>
                              <td>{getGuruName(jadwal.pengampuId, jadwal.pengampuNama)}</td>
                              <td>{jadwal.ruangan || '-'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </ReportPrintTemplate>
          </div>
        </DialogContent>
      </Dialog>

      {/* Duplicate to Block Modal */}
      <DuplicateToBlockModal
        open={isDuplicateToBlockModalOpen}
        onOpenChange={setIsDuplicateToBlockModalOpen}
        sourceBlock={selectedBlock}
        allBlocks={learningBlocks}
        jadwalList={jadwalList}
        kelasId={selectedKelas || ''}
        formatBlockLabel={formatBlockLabel}
        isBlockActive={isBlockActive}
        onSuccess={() => {
          refetchJadwal();
          queryClient.invalidateQueries({ queryKey: ['jadwal-list'] });
          queryClient.invalidateQueries({ queryKey: ['all-jadwal-list'] });
        }}
      />

      {/* Move to Block Modal (single jadwal) */}
      <MoveToBlockModal
        open={isMoveToBlockModalOpen}
        onOpenChange={setIsMoveToBlockModalOpen}
        jadwal={selectedJadwalForDetail}
        jadwalLabel={
          selectedJadwalForDetail
            ? getMapelName(selectedJadwalForDetail.mapelId, selectedJadwalForDetail.mapelNama) ||
              selectedJadwalForDetail.label ||
              'Jadwal'
            : undefined
        }
        sourceBlock={selectedBlock}
        allBlocks={learningBlocks}
        kelasId={selectedKelas || ''}
        formatBlockLabel={formatBlockLabel}
        isBlockActive={isBlockActive}
        onSuccess={() => {
          refetchJadwal();
          queryClient.invalidateQueries({ queryKey: ['jadwal-list'] });
          queryClient.invalidateQueries({ queryKey: ['all-jadwal-list'] });
        }}
      />
    </div>
  );
}
