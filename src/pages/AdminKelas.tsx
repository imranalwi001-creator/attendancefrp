import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ActionButtonGroup, DetailButton, DeleteButton } from '@/components/ui/action-buttons';
import { FileSpreadsheet, FileText, Plus, GraduationCap, Search, SlidersHorizontal, Upload } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { useState, useMemo, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import KelasForm from '@/components/admin/KelasForm';
import ImportKelasModal from '@/components/admin/ImportKelasModal';
import TahunAjaranSemesterSelect, { useTahunAjaranSemesterFilter } from '@/components/admin/TahunAjaranSemesterSelect';
import { BadgeTahunAjaran } from '@/components/kalender/BadgeTahunAjaran';
import DataExportPanel from '@/components/ui/data-export-panel';
import { Kelas } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import useSessionStorageState from '@/hooks/useSessionStorageState';
import { exportToPdf, exportToXlsx, type DataExportColumn } from '@/lib/dataExport';
import { useAuth } from '@/contexts/AuthContext';

export default function AdminKelas() {
  const [deleteKelasId, setDeleteKelasId] = useState<string | null>(null);
  const [showKelasForm, setShowKelasForm] = useState(false);
  const [editingKelas, setEditingKelas] = useState<Kelas | null>(null);
  const [importKelasOpen, setImportKelasOpen] = useSessionStorageState('adminKelasImportOpen', false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterWaliKelas, setFilterWaliKelas] = useState<string>('all');
  const [filterTahunAjaranSemester, setFilterTahunAjaranSemester] = useState<string>('');
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const { tahunAjaran } = useTahunAjaranSemesterFilter(filterTahunAjaranSemester);

  // Fetch kelas data - OPTIMIZED
  const { user } = useAuth();
  
  const { data: kelasData, isLoading: kelasLoading, refetch: refetchKelas } = useQuery({
    queryKey: ['kelas', user?.workspace_id],
    queryFn: async () => {
      let query = supabase.from('kelas')
        .select('id, nama, tingkat, tahun_ajaran, status, jumlah_santri, walikelas_id, created_at, updated_at')
        .order('nama', { ascending: true })
        .limit(100);
        
      if (user?.workspace_id) {
        query = query.eq('workspace_id', user.workspace_id);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchInterval: false
  });

  // Extract walikelas IDs from kelas data
  const walikelasIds = useMemo(() => {
    if (!kelasData) return [];
    return [...new Set(kelasData.map(k => k.walikelas_id).filter((id): id is string => !!id))];
  }, [kelasData]);

  // Fetch profiles ONLY for walikelas that exist - OPTIMIZED
  const { data: profiles } = useQuery({
    queryKey: ['profiles-walikelas', walikelasIds.sort().join(',')],
    queryFn: async () => {
      if (walikelasIds.length === 0) return [];
      const { data, error } = await supabase.from('profiles').select('id, name').in('id', walikelasIds);
      if (error) throw error;
      return data;
    },
    enabled: walikelasIds.length > 0,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchInterval: false
  });

  // Fetch santri count per kelas - OPTIMIZED (only kelas_id needed)
  const { data: santriData } = useQuery({
    queryKey: ['santri-count'],
    queryFn: async () => {
      const { data, error } = await supabase.from('santri').select('kelas_id');
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchInterval: false
  });

  const handleDeleteKelas = async () => {
    if (deleteKelasId) {
      try {
        const { data, error } = await supabase.rpc('delete_kelas_safe' as any, { _kelas_id: deleteKelasId });
        if (error) throw error;
        if (data && data.success === false) {
          const blockers = data.blockers || {};
          const details = Object.entries(blockers)
            .map(([k, v]) => `${k}: ${v}`)
            .join(', ');
          toast({
            title: "Tidak bisa menghapus kelas",
            description: details ? `Kelas masih dipakai oleh data lain (${details}).` : "Kelas masih dipakai oleh data lain.",
            variant: "destructive"
          });
          return;
        }
        toast({
          title: "Kelas Dihapus",
          description: "Data kelas berhasil dihapus dari sistem"
        });
        refetchKelas();
        setDeleteKelasId(null);
      } catch (error) {
        console.error('Error deleting kelas:', error);
        toast({
          title: "Error",
          description: (error as any)?.message || "Gagal menghapus kelas",
          variant: "destructive"
        });
      }
    }
  };

  const handleEditKelas = (kelas: any) => {
    setEditingKelas({
      id: kelas.id,
      nama: kelas.nama,
      tingkat: kelas.tingkat,
      tahun_ajaran: kelas.tahun_ajaran,
      walikelas_id: kelas.walikelas_id,
      kapasitas: kelas.kapasitas,
      jumlah_santri: kelas.jumlah_santri,
      status: kelas.status,
      created_at: kelas.created_at,
      updated_at: kelas.updated_at
    });
    setShowKelasForm(true);
  };

  const handleCloseForm = () => {
    setShowKelasForm(false);
    setEditingKelas(null);
    refetchKelas();
  };

  // Get unique wali kelas for filter
  const waliKelasOptions = useMemo(() => {
    if (!profiles || !kelasData) return [];
    const waliKelasIds = [...new Set(kelasData.map(k => k.walikelas_id).filter(Boolean))];
    return profiles.filter(p => waliKelasIds.includes(p.id));
  }, [profiles, kelasData]);

  // Filter kelas data
  const filteredKelas = useMemo(() => {
    if (!kelasData) return [];
    return kelasData.filter(kelas => {
      const matchesSearch = kelas.nama.toLowerCase().includes(searchQuery.toLowerCase()) || kelas.tahun_ajaran.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesWaliKelas = filterWaliKelas === 'all' || kelas.walikelas_id === filterWaliKelas;
      const matchesTahunAjaran = !tahunAjaran || kelas.tahun_ajaran === tahunAjaran;
      return matchesSearch && matchesWaliKelas && matchesTahunAjaran;
    });
  }, [kelasData, searchQuery, filterWaliKelas, tahunAjaran]);

  const exportRows = useMemo(() => filteredKelas.map((kelas, index) => {
    const waliKelas = profiles?.find(u => u.id === kelas.walikelas_id);
    const jumlahSantri = santriData?.filter(s => s.kelas_id === kelas.id).length || 0;
    return {
      no: index + 1,
      nama: kelas.nama,
      tingkat: kelas.tingkat,
      tahunAjaran: kelas.tahun_ajaran,
      waliKelas: waliKelas?.name || '-',
      jumlahSantri,
      status: kelas.status || '-',
    };
  }), [filteredKelas, profiles, santriData]);

  const exportColumns: DataExportColumn<(typeof exportRows)[number]>[] = [
    { header: 'No', accessor: 'no', width: 6 },
    { header: 'Nama Kelas', accessor: 'nama', width: 24 },
    { header: 'Tingkat', accessor: 'tingkat', width: 12 },
    { header: 'Tahun Ajaran', accessor: 'tahunAjaran', width: 18 },
    { header: 'Wali Kelas', accessor: 'waliKelas', width: 28 },
    { header: 'Jumlah Santri', accessor: 'jumlahSantri', width: 14 },
    { header: 'Status', accessor: 'status', width: 12 },
  ];

  const handleExportKelas = async (format: 'xlsx' | 'pdf') => {
    const options = {
      title: 'Data Kelas',
      subtitle: `Filter: ${tahunAjaran || 'Semua tahun ajaran'}${filterWaliKelas !== 'all' ? ' | Wali kelas terpilih' : ''}`,
      filename: `data-kelas-${tahunAjaran || 'semua'}`,
      sheetName: 'Data Kelas',
      columns: exportColumns,
      rows: exportRows,
      summary: [
        ['Total Kelas', exportRows.length],
        ['Total Santri', exportRows.reduce((sum, row) => sum + row.jumlahSantri, 0)],
      ] as Array<[string, string | number]>,
    };
    if (format === 'xlsx') await exportToXlsx(options);
    else await exportToPdf(options);
    toast({ title: 'Export berhasil', description: `Data kelas berhasil diexport ke ${format.toUpperCase()}` });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-background border border-border/50 p-6">
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-1">Kelola Kelas</h1>
              <BadgeTahunAjaran />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="rounded-xl h-10"
              disabled={exportRows.length === 0}
              onClick={() => handleExportKelas('pdf')}
            >
              <FileText className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
            <Button
              variant="outline"
              className="rounded-xl h-10"
              disabled={exportRows.length === 0}
              onClick={() => handleExportKelas('xlsx')}
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              XLSX
            </Button>
            <Button variant="outline" className="rounded-xl h-10" onClick={() => setImportKelasOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
            <Button className="rounded-xl h-10" onClick={() => setShowKelasForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Tambah Kelas
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <Card id="tabel-kelas" className="rounded-2xl border border-border/50 shadow-sm">
        <CardContent className="p-6 space-y-6">
          {/* Search & Filter */}
          <DataExportPanel
            title="Export Data Kelas"
            description="Laporan kelas, wali kelas, status, dan jumlah santri"
            count={exportRows.length}
            disabled={exportRows.length === 0}
            onExportXlsx={() => handleExportKelas('xlsx')}
            onExportPdf={() => handleExportKelas('pdf')}
          />

          {/* Search & Filter */}
          <div className="flex flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10 rounded-xl" placeholder="Cari nama kelas" />
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="rounded-xl gap-2 shrink-0">
                  <SlidersHorizontal className="h-4 w-4" />
                  <span className="hidden sm:inline">Filter</span>
                  {((filterTahunAjaranSemester ? 1 : 0) + (filterWaliKelas !== 'all' ? 1 : 0)) > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center">
                      {(filterTahunAjaranSemester ? 1 : 0) + (filterWaliKelas !== 'all' ? 1 : 0)}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-4" align="end">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Tahun Ajaran & Semester</Label>
                    <TahunAjaranSemesterSelect
                      value={filterTahunAjaranSemester}
                      onValueChange={setFilterTahunAjaranSemester}
                      placeholder="Tahun Ajaran & Semester"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Wali Kelas</Label>
                    <Select value={filterWaliKelas} onValueChange={setFilterWaliKelas}>
                      <SelectTrigger className="w-full rounded-xl">
                        <SelectValue placeholder="Filter Wali Kelas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua Wali Kelas</SelectItem>
                        {waliKelasOptions.map(wali => (
                          <SelectItem key={wali.id} value={wali.id}>{wali.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {((filterTahunAjaranSemester) || filterWaliKelas !== 'all') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setFilterTahunAjaranSemester('');
                        setFilterWaliKelas('all');
                      }}
                    >
                      Reset Filter
                    </Button>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Card List */}
          {filteredKelas.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              {searchQuery || filterWaliKelas !== 'all' || tahunAjaran ? 'Tidak ada kelas yang sesuai dengan filter' : 'Tidak ada data kelas ditemukan'}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredKelas.map(kelas => {
                const waliKelas = profiles?.find(u => u.id === kelas.walikelas_id);
                const jumlahSantri = santriData?.filter(s => s.kelas_id === kelas.id).length || 0;
                return (
                  <Card key={kelas.id} className="rounded-xl border border-border/50 shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-300 cursor-pointer group" onClick={() => navigate(`/admin/kelas/${kelas.id}`)}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 w-[200px] shrink-0">
                          <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 group-hover:bg-primary/20 transition-colors shrink-0">
                            <GraduationCap className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">{kelas.nama}</p>
                            <p className="text-xs text-muted-foreground">{kelas.tahun_ajaran}</p>
                          </div>
                        </div>
                        <div className="w-[250px] shrink-0">
                          <p className="text-xs text-muted-foreground">Wali Kelas</p>
                          <p className="font-medium text-foreground text-sm truncate">{waliKelas?.name || '-'}</p>
                        </div>
                        <div className="w-[120px] shrink-0">
                          <p className="text-xs text-muted-foreground">Jumlah Santri</p>
                          <p className="font-medium text-foreground">{jumlahSantri}</p>
                        </div>
                        <ActionButtonGroup>
                          <DeleteButton onClick={() => setDeleteKelasId(kelas.id)} />
                          <DetailButton onClick={() => navigate(`/admin/kelas/${kelas.id}`)} />
                        </ActionButtonGroup>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Kelas Form Dialog */}
      <KelasForm open={showKelasForm} onOpenChange={handleCloseForm} kelas={editingKelas} onSuccess={handleCloseForm} />
      <ImportKelasModal open={importKelasOpen} onOpenChange={setImportKelasOpen} onImported={refetchKelas} />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteKelasId} onOpenChange={() => setDeleteKelasId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Kelas?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak dapat dibatalkan. Data kelas akan dihapus secara permanen dari sistem.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteKelas} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
