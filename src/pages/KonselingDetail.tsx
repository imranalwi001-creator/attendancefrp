import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Trophy, AlertTriangle, User, Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/dashboard';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAcademicYear } from '@/contexts/AcademicYearContext';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { toast } from 'sonner';
import { FormDrawer } from '@/components/ui/form-drawer';
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
import { logActivity } from '@/lib/activityLogger';

interface KonselingKategori {
  id: string;
  nama: string;
  tipe: 'prestasi' | 'pelanggaran';
  poin: number;
  deskripsi: string | null;
  status: string;
}

interface KonselingRecord {
  id: string;
  santri_id: string;
  tipe: string;
  kategori: string;
  kategori_id: string | null;
  poin: number;
  deskripsi: string | null;
  tanggal: string;
  academic_year_id: string | null;
  semester: string;
  recorded_by: string | null;
}

export default function KonselingDetail() {
  const { id: santriId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { activeAcademicYear, getCurrentSemester } = useAcademicYear();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  // Prestasi drawer state
  const [isPrestasiDrawerOpen, setIsPrestasiDrawerOpen] = useState(false);
  const [editingPrestasi, setEditingPrestasi] = useState<KonselingRecord | null>(null);
  const [prestasiForm, setPrestasiForm] = useState({
    kategori_id: '',
    poin: 0,
    deskripsi: ''
  });

  // Pelanggaran drawer state
  const [isPelanggaranDrawerOpen, setIsPelanggaranDrawerOpen] = useState(false);
  const [editingPelanggaran, setEditingPelanggaran] = useState<KonselingRecord | null>(null);
  const [pelanggaranForm, setPelanggaranForm] = useState({
    kategori_id: '',
    poin: 0,
    deskripsi: ''
  });

  const [showConfirmSave, setShowConfirmSave] = useState(false);
  const [pendingFormType, setPendingFormType] = useState<'prestasi' | 'pelanggaran' | null>(null);

  // Fetch santri profile
  const { data: santriProfile, isLoading: profileLoading } = useQuery({
    queryKey: ['konseling-santri-profile', santriId],
    queryFn: async () => {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, name, email, avatar_url, status')
        .eq('id', santriId)
        .maybeSingle();
      
      if (profileError) throw profileError;

      const { data: santriData, error: santriError } = await supabase
        .from('santri')
        .select(`
          kelas_id,
          kelas:kelas_id(id, nama, tingkat)
        `)
        .eq('id', santriId)
        .maybeSingle();

      if (santriError) throw santriError;

      return {
        ...profile,
        kelas: santriData?.kelas
      };
    },
    enabled: !!santriId,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  // Fetch konseling records
  const { data: konselingRecords = [], isLoading: recordsLoading } = useQuery({
    queryKey: ['konseling-records', santriId, activeAcademicYear?.id, getCurrentSemester()],
    queryFn: async () => {
      let query = supabase
        .from('konseling_records')
        .select('id, santri_id, tipe, kategori, kategori_id, poin, deskripsi, tanggal, academic_year_id, semester, recorded_by')
        .eq('santri_id', santriId)
        .order('tanggal', { ascending: false })
        .limit(100);

      if (activeAcademicYear?.id) {
        query = query.eq('academic_year_id', activeAcademicYear.id);
      }

      const semester = getCurrentSemester();
      if (semester) {
        query = query.eq('semester', semester);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!santriId,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  // Fetch konseling kategori (prestasi)
  const { data: prestasiKategori = [] } = useQuery({
    queryKey: ['konseling-kategori-prestasi'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('konseling_kategori')
        .select('id, nama, tipe, poin, deskripsi, status')
        .eq('tipe', 'prestasi')
        .eq('status', 'aktif')
        .order('nama');
      if (error) throw error;
      return data as KonselingKategori[];
    },
    staleTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
  });

  // Fetch konseling kategori (pelanggaran)
  const { data: pelanggaranKategori = [] } = useQuery({
    queryKey: ['konseling-kategori-pelanggaran'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('konseling_kategori')
        .select('id, nama, tipe, poin, deskripsi, status')
        .eq('tipe', 'pelanggaran')
        .eq('status', 'aktif')
        .order('nama');
      if (error) throw error;
      return data as KonselingKategori[];
    },
    staleTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('konseling_records')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['konseling-records'] });
      
      logActivity({
        action: 'counseling_delete',
        category: 'counseling',
        description: `Menghapus data konseling santri ${santriProfile?.name || ''}`,
        metadata: { santriId, recordId: deleteId }
      });
      
      toast.success('Data berhasil dihapus');
      setDeleteId(null);
    },
    onError: () => {
      toast.error('Gagal menghapus data');
    }
  });

  // Save prestasi mutation
  const savePrestasiMutation = useMutation({
    mutationFn: async (data: { kategori_id: string; poin: number; deskripsi: string; id?: string }) => {
      const selectedKategori = prestasiKategori.find(k => k.id === data.kategori_id);
      
      if (!santriId) {
        throw new Error('Santri ID tidak ditemukan');
      }
      
      const payload = {
        santri_id: santriId,
        tipe: 'prestasi' as const,
        kategori: selectedKategori?.nama || '',
        kategori_id: data.kategori_id,
        poin: data.poin,
        deskripsi: data.deskripsi || null,
        tanggal: new Date().toISOString().split('T')[0],
        academic_year_id: activeAcademicYear?.id || null,
        semester: getCurrentSemester() || 'ganjil'
      };

      if (data.id) {
        const { error } = await supabase
          .from('konseling_records')
          .update(payload)
          .eq('id', data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('konseling_records')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['konseling-records'] });
      
      const selectedKategori = prestasiKategori.find(k => k.id === prestasiForm.kategori_id);
      logActivity({
        action: editingPrestasi ? 'counseling_edit' : 'counseling_achievement_add',
        category: 'counseling',
        description: editingPrestasi 
          ? `Mengedit data prestasi santri ${santriProfile?.name || ''}` 
          : `Menambahkan prestasi "${selectedKategori?.nama || ''}" untuk santri ${santriProfile?.name || ''}`,
        metadata: { santriId, kategori: selectedKategori?.nama, poin: prestasiForm.poin }
      });
      
      toast.success(editingPrestasi ? 'Data prestasi berhasil diperbarui' : 'Data prestasi berhasil ditambahkan');
      handleClosePrestasiDrawer();
    },
    onError: (error: any) => {
      console.error('Error saving prestasi:', error);
      toast.error(`Gagal menyimpan data prestasi: ${error.message || 'Unknown error'}`);
    }
  });

  // Save pelanggaran mutation
  const savePelanggaranMutation = useMutation({
    mutationFn: async (data: { kategori_id: string; poin: number; deskripsi: string; id?: string }) => {
      const selectedKategori = pelanggaranKategori.find(k => k.id === data.kategori_id);
      
      if (!santriId) {
        throw new Error('Santri ID tidak ditemukan');
      }
      
      const payload = {
        santri_id: santriId,
        tipe: 'pelanggaran' as const,
        kategori: selectedKategori?.nama || '',
        kategori_id: data.kategori_id,
        poin: data.poin,
        deskripsi: data.deskripsi || null,
        tanggal: new Date().toISOString().split('T')[0],
        academic_year_id: activeAcademicYear?.id || null,
        semester: getCurrentSemester() || 'ganjil'
      };

      if (data.id) {
        const { error } = await supabase
          .from('konseling_records')
          .update(payload)
          .eq('id', data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('konseling_records')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['konseling-records'] });
      
      const selectedKategori = pelanggaranKategori.find(k => k.id === pelanggaranForm.kategori_id);
      logActivity({
        action: editingPelanggaran ? 'counseling_edit' : 'counseling_violation_add',
        category: 'counseling',
        description: editingPelanggaran 
          ? `Mengedit data pelanggaran santri ${santriProfile?.name || ''}` 
          : `Menambahkan pelanggaran "${selectedKategori?.nama || ''}" untuk santri ${santriProfile?.name || ''}`,
        metadata: { santriId, kategori: selectedKategori?.nama, poin: pelanggaranForm.poin }
      });
      
      toast.success(editingPelanggaran ? 'Data pelanggaran berhasil diperbarui' : 'Data pelanggaran berhasil ditambahkan');
      handleClosePelanggaranDrawer();
    },
    onError: (error: any) => {
      console.error('Error saving pelanggaran:', error);
      toast.error(`Gagal menyimpan data pelanggaran: ${error.message || 'Unknown error'}`);
    }
  });

  // Handle prestasi kategori change - auto fill poin
  const handlePrestasiKategoriChange = (kategoriId: string) => {
    const selectedKategori = prestasiKategori.find(k => k.id === kategoriId);
    setPrestasiForm(prev => ({
      ...prev,
      kategori_id: kategoriId,
      poin: selectedKategori?.poin || 0
    }));
  };

  // Handle pelanggaran kategori change - auto fill poin
  const handlePelanggaranKategoriChange = (kategoriId: string) => {
    const selectedKategori = pelanggaranKategori.find(k => k.id === kategoriId);
    setPelanggaranForm(prev => ({
      ...prev,
      kategori_id: kategoriId,
      poin: selectedKategori?.poin || 0
    }));
  };

  // Open prestasi drawer for add/edit
  const handleOpenPrestasiDrawer = (record?: KonselingRecord) => {
    if (record) {
      setEditingPrestasi(record);
      setPrestasiForm({
        kategori_id: record.kategori_id || '',
        poin: record.poin,
        deskripsi: record.deskripsi || ''
      });
    } else {
      setEditingPrestasi(null);
      setPrestasiForm({
        kategori_id: '',
        poin: 0,
        deskripsi: ''
      });
    }
    setIsPrestasiDrawerOpen(true);
  };

  const handleClosePrestasiDrawer = () => {
    setIsPrestasiDrawerOpen(false);
    setEditingPrestasi(null);
    setPrestasiForm({
      kategori_id: '',
      poin: 0,
      deskripsi: ''
    });
  };

  // Open pelanggaran drawer for add/edit
  const handleOpenPelanggaranDrawer = (record?: KonselingRecord) => {
    if (record) {
      setEditingPelanggaran(record);
      setPelanggaranForm({
        kategori_id: record.kategori_id || '',
        poin: record.poin,
        deskripsi: record.deskripsi || ''
      });
    } else {
      setEditingPelanggaran(null);
      setPelanggaranForm({
        kategori_id: '',
        poin: 0,
        deskripsi: ''
      });
    }
    setIsPelanggaranDrawerOpen(true);
  };

  const handleClosePelanggaranDrawer = () => {
    setIsPelanggaranDrawerOpen(false);
    setEditingPelanggaran(null);
    setPelanggaranForm({
      kategori_id: '',
      poin: 0,
      deskripsi: ''
    });
  };

  // Handle form submit - show confirmation first
  const handlePrestasiFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prestasiForm.kategori_id) {
      toast.error('Pilih jenis prestasi terlebih dahulu');
      return;
    }
    setPendingFormType('prestasi');
    setShowConfirmSave(true);
  };

  const handlePelanggaranFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pelanggaranForm.kategori_id) {
      toast.error('Pilih jenis pelanggaran terlebih dahulu');
      return;
    }
    setPendingFormType('pelanggaran');
    setShowConfirmSave(true);
  };

  // Confirm save
  const handleConfirmSave = () => {
    if (pendingFormType === 'prestasi') {
      savePrestasiMutation.mutate({
        ...prestasiForm,
        id: editingPrestasi?.id
      });
    } else if (pendingFormType === 'pelanggaran') {
      savePelanggaranMutation.mutate({
        ...pelanggaranForm,
        id: editingPelanggaran?.id
      });
    }
    setShowConfirmSave(false);
    setPendingFormType(null);
  };

  // Calculate totals
  const stats = useMemo(() => {
    const prestasiRecords = konselingRecords.filter(r => r.tipe === 'prestasi');
    const pelanggaranRecords = konselingRecords.filter(r => r.tipe === 'pelanggaran');
    
    const totalPrestasi = prestasiRecords.reduce((sum, r) => sum + (r.poin || 0), 0);
    const totalPelanggaran = pelanggaranRecords.reduce((sum, r) => sum + (r.poin || 0), 0);

    return {
      prestasiRecords,
      pelanggaranRecords,
      totalPrestasi,
      totalPelanggaran
    };
  }, [konselingRecords]);

  const isLoading = profileLoading || recordsLoading;

  if (isLoading) {
    return (
      <div className="space-y-6 p-4 pb-24">
        <Card className="rounded-3xl border shadow-lg">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-4">
              <Skeleton className="h-16 w-16 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
            </div>
            <Skeleton className="h-48 rounded-xl" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!santriProfile) {
    return (
      <div className="space-y-6 p-4 pb-24">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Data santri tidak ditemukan</p>
          <Button onClick={() => navigate('/admin/konseling')} className="mt-4">
            Kembali ke Daftar Konseling
          </Button>
        </div>
      </div>
    );
  }

  const kelas = santriProfile.kelas as { id: string; nama: string; tingkat: string } | null;

  return (
    <div className="space-y-6 p-4 pb-24">
      {/* Header with Gradient */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-primary/80 p-8 shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-foreground/10 rounded-full blur-3xl -translate-y-32 translate-x-32" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary-foreground/5 rounded-full blur-2xl translate-y-24 -translate-x-24" />
        
        <div className="relative flex items-start gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate('/admin/konseling')} 
            className="rounded-xl bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground border-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          
          <div className="flex-1">
            <div className="flex items-start gap-4 mb-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary-foreground/20 border-4 border-primary-foreground/20 shadow-xl">
                <User className="h-10 w-10 text-primary-foreground" />
              </div>
              
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-primary-foreground mb-3">{santriProfile.name}</h1>
                <div className="flex flex-wrap items-center gap-3">
                  <Badge 
                    variant="secondary"
                    className="bg-white/20 text-primary-foreground border-0"
                  >
                    {kelas?.nama || 'Belum ada kelas'}
                  </Badge>
                  <Badge 
                    variant="secondary"
                    className="bg-white/20 text-primary-foreground border-0"
                  >
                    {activeAcademicYear?.name || '-'}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard
          icon={Trophy}
          label="Total Poin Prestasi"
          value={stats.totalPrestasi}
          animationDelay={0}
        />
        <StatCard
          icon={AlertTriangle}
          label="Total Poin Pelanggaran"
          value={stats.totalPelanggaran}
          animationDelay={100}
        />
      </div>

      {/* Tabs Content */}
      <Tabs defaultValue="pelanggaran" className="w-full">
        <TabsList variant="admin" className="grid-cols-2">
          <TabsTrigger value="pelanggaran" variant="admin">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Pelanggaran ({stats.pelanggaranRecords.length})
          </TabsTrigger>
          <TabsTrigger value="prestasi" variant="admin">
            <Trophy className="h-4 w-4 mr-2" />
            Prestasi ({stats.prestasiRecords.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab Pelanggaran */}
        <TabsContent value="pelanggaran" className="mt-6">
          <Card className="rounded-3xl border shadow-lg overflow-hidden">
            <CardHeader className="bg-gradient-to-br from-muted/50 via-muted/30 to-background pb-6 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-bold">Daftar Pelanggaran</CardTitle>
                  <CardDescription>Catatan pelanggaran santri pada periode ini</CardDescription>
                </div>
                <Button className="rounded-xl" onClick={() => handleOpenPelanggaranDrawer()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Tambah Pelanggaran
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-b bg-muted/30 hover:bg-muted/30">
                    <TableHead className="h-14 px-6">Tanggal</TableHead>
                    <TableHead className="h-14 px-6">Jenis Pelanggaran</TableHead>
                    <TableHead className="h-14 px-6 text-center">Poin</TableHead>
                    <TableHead className="h-14 px-6">Keterangan</TableHead>
                    <TableHead className="h-14 px-6 text-center">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.pelanggaranRecords.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Belum ada data pelanggaran
                      </TableCell>
                    </TableRow>
                  ) : (
                    stats.pelanggaranRecords.map((record) => (
                      <TableRow key={record.id} className="border-b last:border-0 hover:bg-muted/50">
                        <TableCell className="px-6 py-4">
                          {format(new Date(record.tanggal), 'dd MMM yyyy', { locale: localeId })}
                        </TableCell>
                        <TableCell className="px-6 py-4">
                          <Badge variant="outline">{record.kategori}</Badge>
                        </TableCell>
                        <TableCell className="px-6 py-4 text-center">
                          <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                            -{record.poin}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-6 py-4 text-muted-foreground">
                          {record.deskripsi || '-'}
                        </TableCell>
                        <TableCell className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 rounded-lg"
                              onClick={() => handleOpenPelanggaranDrawer(record as KonselingRecord)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 rounded-lg text-destructive hover:text-destructive"
                              onClick={() => setDeleteId(record.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Prestasi */}
        <TabsContent value="prestasi" className="mt-6">
          <Card className="rounded-3xl border shadow-lg overflow-hidden">
            <CardHeader className="bg-gradient-to-br from-muted/50 via-muted/30 to-background pb-6 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-bold">Daftar Prestasi</CardTitle>
                  <CardDescription>Catatan prestasi santri pada periode ini</CardDescription>
                </div>
                <Button className="rounded-xl" onClick={() => handleOpenPrestasiDrawer()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Tambah Prestasi
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-b bg-muted/30 hover:bg-muted/30">
                    <TableHead className="h-14 px-6">Tanggal</TableHead>
                    <TableHead className="h-14 px-6">Jenis Prestasi</TableHead>
                    <TableHead className="h-14 px-6 text-center">Poin</TableHead>
                    <TableHead className="h-14 px-6">Keterangan</TableHead>
                    <TableHead className="h-14 px-6 text-center">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.prestasiRecords.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Belum ada data prestasi
                      </TableCell>
                    </TableRow>
                  ) : (
                    stats.prestasiRecords.map((record) => (
                      <TableRow key={record.id} className="border-b last:border-0 hover:bg-muted/50">
                        <TableCell className="px-6 py-4">
                          {format(new Date(record.tanggal), 'dd MMM yyyy', { locale: localeId })}
                        </TableCell>
                        <TableCell className="px-6 py-4">
                          <Badge variant="outline">{record.kategori}</Badge>
                        </TableCell>
                        <TableCell className="px-6 py-4 text-center">
                          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            +{record.poin}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-6 py-4 text-muted-foreground">
                          {record.deskripsi || '-'}
                        </TableCell>
                        <TableCell className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 rounded-lg"
                              onClick={() => handleOpenPrestasiDrawer(record as KonselingRecord)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 rounded-lg text-destructive hover:text-destructive"
                              onClick={() => setDeleteId(record.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Data</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus data ini? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Save Confirmation Dialog */}
      <AlertDialog open={showConfirmSave} onOpenChange={setShowConfirmSave}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Simpan Data</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menyimpan data {pendingFormType === 'prestasi' ? 'prestasi' : 'pelanggaran'} ini?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingFormType(null)}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSave}>
              {(savePrestasiMutation.isPending || savePelanggaranMutation.isPending) ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Ya, Simpan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Prestasi Drawer Form */}
      <FormDrawer
        open={isPrestasiDrawerOpen}
        onOpenChange={setIsPrestasiDrawerOpen}
        title={editingPrestasi ? 'Ubah Prestasi' : 'Tambah Prestasi'}
        onSubmit={handlePrestasiFormSubmit}
        loading={savePrestasiMutation.isPending}
      >
        <div className="space-y-6">
          {/* Jenis Prestasi */}
          <div className="space-y-2">
            <Label htmlFor="kategori_id">Jenis Prestasi <span className="text-destructive">*</span></Label>
            <Select
              value={prestasiForm.kategori_id}
              onValueChange={handlePrestasiKategoriChange}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Pilih jenis prestasi" />
              </SelectTrigger>
              <SelectContent>
                {prestasiKategori.map((kategori) => (
                  <SelectItem key={kategori.id} value={kategori.id}>
                    {kategori.nama} ({kategori.poin} poin)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Poin (Read-only) */}
          <div className="space-y-2">
            <Label htmlFor="poin">Poin</Label>
            <Input
              id="poin"
              type="number"
              value={prestasiForm.poin}
              readOnly
              className="rounded-xl bg-muted"
            />
            <p className="text-xs text-muted-foreground">Poin terisi otomatis berdasarkan jenis prestasi</p>
          </div>

          {/* Keterangan */}
          <div className="space-y-2">
            <Label htmlFor="deskripsi">Keterangan (opsional)</Label>
            <Textarea
              id="deskripsi"
              placeholder="Tambahkan keterangan..."
              value={prestasiForm.deskripsi}
              onChange={(e) => setPrestasiForm(prev => ({ ...prev, deskripsi: e.target.value }))}
              className="rounded-xl min-h-[100px]"
            />
          </div>
        </div>
      </FormDrawer>

      {/* Pelanggaran Drawer Form */}
      <FormDrawer
        open={isPelanggaranDrawerOpen}
        onOpenChange={setIsPelanggaranDrawerOpen}
        title={editingPelanggaran ? 'Ubah Pelanggaran' : 'Tambah Pelanggaran'}
        onSubmit={handlePelanggaranFormSubmit}
        loading={savePelanggaranMutation.isPending}
      >
        <div className="space-y-6">
          {/* Jenis Pelanggaran */}
          <div className="space-y-2">
            <Label htmlFor="kategori_pelanggaran">Jenis Pelanggaran <span className="text-destructive">*</span></Label>
            <Select
              value={pelanggaranForm.kategori_id}
              onValueChange={handlePelanggaranKategoriChange}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Pilih jenis pelanggaran" />
              </SelectTrigger>
              <SelectContent>
                {pelanggaranKategori.map((kategori) => (
                  <SelectItem key={kategori.id} value={kategori.id}>
                    {kategori.nama} ({kategori.poin} poin)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Poin (Read-only) */}
          <div className="space-y-2">
            <Label htmlFor="poin_pelanggaran">Poin</Label>
            <Input
              id="poin_pelanggaran"
              type="number"
              value={pelanggaranForm.poin}
              readOnly
              className="rounded-xl bg-muted"
            />
            <p className="text-xs text-muted-foreground">Poin terisi otomatis berdasarkan jenis pelanggaran</p>
          </div>

          {/* Keterangan */}
          <div className="space-y-2">
            <Label htmlFor="deskripsi_pelanggaran">Keterangan (opsional)</Label>
            <Textarea
              id="deskripsi_pelanggaran"
              placeholder="Tambahkan keterangan..."
              value={pelanggaranForm.deskripsi}
              onChange={(e) => setPelanggaranForm(prev => ({ ...prev, deskripsi: e.target.value }))}
              className="rounded-xl min-h-[100px]"
            />
          </div>
        </div>
      </FormDrawer>
    </div>
  );
}