import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ArrowLeft, Users, BookOpen, Edit, Trash2, GraduationCap, Upload } from 'lucide-react';
import KelasMembers from '@/components/admin/KelasMembers';
import KelasForm from '@/components/admin/KelasForm';
import ImportSantriModal from '@/components/admin/ImportSantriModal';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

export default function KelasDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showMembersDialog, setShowMembersDialog] = useState(false);
  const [importSantriOpen, setImportSantriOpen] = useState(false);

  // Fetch kelas data - explicit columns
  const { data: kelas, isLoading: kelasLoading, refetch: refetchKelas } = useQuery({
    queryKey: ['kelas', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kelas')
        .select('id, nama, tingkat, tahun_ajaran, status, jumlah_santri, walikelas_id')
        .eq('id', id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false
  });

  // Fetch wali kelas profile - explicit columns
  const { data: waliKelas } = useQuery({
    queryKey: ['walikelas', kelas?.walikelas_id],
    queryFn: async () => {
      if (!kelas?.walikelas_id) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email')
        .eq('id', kelas.walikelas_id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!kelas?.walikelas_id,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  // Fetch santri list - explicit columns
  const { data: santriList = [], refetch: refetchSantri } = useQuery({
    queryKey: ['santri-kelas', id],
    queryFn: async () => {
      const { data: santriData, error: santriError } = await supabase
        .from('santri')
        .select('id')
        .eq('kelas_id', id)
        .limit(100);
      
      if (santriError) throw santriError;
      
      const santriIds = santriData.map(s => s.id);
      
      if (santriIds.length === 0) return [];
      
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, email, status')
        .in('id', santriIds);
      
      if (profilesError) throw profilesError;
      
      return profilesData || [];
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  // Fetch mapel list - explicit columns
  const { data: mapelList = [] } = useQuery({
    queryKey: ['mapel-kelas', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mapel')
        .select('id, nama, kategori, status, pengampu_id')
        .eq('kelas_id', id)
        .limit(50);
      
      if (error) throw error;
      
      // Fetch pengampu profiles using RPC for efficiency
      const pengampuIds = data.filter(m => m.pengampu_id).map(m => m.pengampu_id);
      let pengampuMap: Record<string, string> = {};
      
      if (pengampuIds.length > 0) {
        const { data: profilesData } = await supabase.rpc('get_profile_names', {
          _ids: pengampuIds
        });
        
        if (profilesData) {
          pengampuMap = Object.fromEntries(profilesData.map((p: any) => [p.id, p.name]));
        }
      }
      
      return data.map(m => ({
        ...m,
        pengampu_name: pengampuMap[m.pengampu_id] || null
      })) || [];
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const handleUpdateMembers = () => {
    refetchSantri();
    refetchKelas();
  };

  const handleEditSuccess = () => {
    refetchKelas();
    refetchSantri();
    setShowEditDialog(false);
  };

  const handleDelete = async () => {
    try {
      const { data, error } = await supabase.rpc('delete_kelas_safe' as any, { _kelas_id: id });
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
        description: "Data kelas telah dihapus.",
      });
      navigate('/admin/kelas');
    } catch (error) {
      console.error('Error deleting kelas:', error);
      toast({
        title: "Error",
        description: (error as any)?.message || "Gagal menghapus kelas",
        variant: "destructive"
      });
    }
  };

  if (kelasLoading) {
    return (
      <div className="space-y-6">
        <Card className="rounded-3xl border shadow-lg">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-4">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-20 rounded-xl" />
            </div>
            <Skeleton className="h-64 rounded-xl" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!kelas) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Kelas tidak ditemukan</p>
        <Button onClick={() => navigate('/admin/kelas')} className="mt-4">
          Kembali ke Daftar Kelas
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Gradient */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-primary/80 p-8 shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-foreground/10 rounded-full blur-3xl -translate-y-32 translate-x-32" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary-foreground/5 rounded-full blur-2xl translate-y-24 -translate-x-24" />
        
        <div className="relative flex items-start gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate('/admin/kelas')} 
            className="rounded-xl bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground border-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          
          <div className="flex-1">
            <div className="flex items-start gap-4 mb-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary-foreground/20 border-4 border-primary-foreground/20 shadow-xl">
                <GraduationCap className="h-10 w-10 text-primary-foreground" />
              </div>
              
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-primary-foreground mb-3">Kelas {kelas.nama}</h1>
                <div className="flex flex-wrap items-center gap-3">
                  <Badge 
                    variant="secondary"
                    className="bg-white/20 text-primary-foreground border-0"
                  >
                    {kelas.tahun_ajaran}
                  </Badge>
                </div>
              </div>

              <div className="flex gap-3">
                <Button 
                  onClick={() => setShowEditDialog(true)}
                  className="rounded-xl bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 backdrop-blur-sm"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  <span className="font-medium">Edit</span>
                </Button>
                <Button 
                  onClick={() => setShowDeleteDialog(true)}
                  variant="ghost"
                  className="rounded-xl bg-destructive/10 hover:bg-destructive/20 text-primary-foreground border-0 hover:text-destructive transition-all duration-300 hover:scale-105"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Content */}
      <Tabs defaultValue="profil" className="w-full">
        <TabsList className="grid w-full grid-cols-3 gap-2 rounded-2xl bg-card border border-border p-2 shadow-sm h-auto">
          <TabsTrigger 
            value="profil"
            className="rounded-xl py-3 px-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg data-[state=inactive]:hover:bg-muted transition-all duration-300 font-medium"
          >
            <GraduationCap className="h-4 w-4 mr-2" />
            Profil Kelas
          </TabsTrigger>
          <TabsTrigger 
            value="santri"
            className="rounded-xl py-3 px-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg data-[state=inactive]:hover:bg-muted transition-all duration-300 font-medium"
          >
            <Users className="h-4 w-4 mr-2" />
            Daftar Santri
          </TabsTrigger>
          <TabsTrigger 
            value="mapel"
            className="rounded-xl py-3 px-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg data-[state=inactive]:hover:bg-muted transition-all duration-300 font-medium"
          >
            <BookOpen className="h-4 w-4 mr-2" />
            Mata Pelajaran
          </TabsTrigger>
        </TabsList>

        {/* Profil Kelas Tab */}
        <TabsContent value="profil" className="mt-6">
          <Card className="rounded-3xl border shadow-lg overflow-hidden">
            <CardHeader className="bg-gradient-to-br from-muted/50 via-muted/30 to-background pb-6 border-b">
              <CardTitle className="text-xl font-bold">Informasi Kelas</CardTitle>
              <CardDescription>Detail lengkap tentang kelas ini</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 p-4 rounded-2xl bg-muted/30 border border-border/50">
                  <Label className="text-sm font-medium text-muted-foreground">Nama Kelas</Label>
                  <p className="text-base font-semibold">{kelas.nama}</p>
                </div>

                <div className="space-y-2 p-4 rounded-2xl bg-muted/30 border border-border/50">
                  <Label className="text-sm font-medium text-muted-foreground">Tingkat</Label>
                  <p className="text-base font-semibold">{kelas.tingkat}</p>
                </div>

                <div className="space-y-2 p-4 rounded-2xl bg-muted/30 border border-border/50">
                  <Label className="text-sm font-medium text-muted-foreground">Wali Kelas</Label>
                  <p className="text-base font-semibold">{waliKelas?.name || '-'}</p>
                </div>

                <div className="space-y-2 p-4 rounded-2xl bg-muted/30 border border-border/50">
                  <Label className="text-sm font-medium text-muted-foreground">Tahun Ajaran</Label>
                  <p className="text-base font-semibold">{kelas.tahun_ajaran || '-'}</p>
                </div>

                <div className="space-y-2 p-4 rounded-2xl bg-muted/30 border border-border/50">
                  <Label className="text-sm font-medium text-muted-foreground">Jumlah Santri</Label>
                  <p className="text-base font-semibold">{santriList.length} santri</p>
                </div>

                <div className="space-y-2 p-4 rounded-2xl bg-muted/30 border border-border/50">
                  <Label className="text-sm font-medium text-muted-foreground">Jumlah Mata Pelajaran</Label>
                  <p className="text-base font-semibold">{mapelList.length} mapel</p>
                </div>

                <div className="space-y-2 p-4 rounded-2xl bg-muted/30 border border-border/50">
                  <Label className="text-sm font-medium text-muted-foreground">Status</Label>
                  <div>
                    <Badge variant={kelas.status === 'aktif' ? 'default' : 'secondary'}>
                      {kelas.status === 'aktif' ? 'Aktif' : 'Nonaktif'}
                    </Badge>
                  </div>
                </div>

              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Daftar Santri Tab */}
        <TabsContent value="santri" className="mt-6">
          <Card className="rounded-3xl border shadow-lg overflow-hidden">
            <CardHeader className="bg-gradient-to-br from-muted/50 via-muted/30 to-background pb-6 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-bold">Daftar Santri</CardTitle>
                  <CardDescription>Santri yang tergabung dalam kelas ini</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button 
                    onClick={() => setImportSantriOpen(true)}
                    variant="outline"
                    className="rounded-xl transition-all duration-300 hover:bg-muted"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Import Excel
                  </Button>
                  <Button 
                    onClick={() => setShowMembersDialog(true)}
                    className="rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Kelola Anggota
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-b bg-muted/30 hover:bg-muted/30">
                    <TableHead className="h-14 px-6">No</TableHead>
                    <TableHead className="h-14 px-6">Nama Santri</TableHead>
                    <TableHead className="h-14 px-6">Email</TableHead>
                    <TableHead className="h-14 px-6">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {santriList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        Belum ada santri di kelas ini
                      </TableCell>
                    </TableRow>
                  ) : (
                    santriList.map((santri, index) => (
                      <TableRow key={santri.id} className="border-b last:border-0 hover:bg-muted/50">
                        <TableCell className="px-6 py-4">{index + 1}</TableCell>
                        <TableCell className="px-6 py-4 font-medium">{santri.name}</TableCell>
                        <TableCell className="px-6 py-4 text-muted-foreground">{santri.email || '-'}</TableCell>
                        <TableCell className="px-6 py-4">
                          <Badge variant={santri.status === 'aktif' ? 'default' : 'secondary'}>
                            {santri.status === 'aktif' ? 'Aktif' : 'Nonaktif'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Mata Pelajaran Tab */}
        <TabsContent value="mapel" className="mt-6">
          <Card className="rounded-3xl border shadow-lg overflow-hidden">
            <CardHeader className="bg-gradient-to-br from-muted/50 via-muted/30 to-background pb-6 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-bold">Mata Pelajaran</CardTitle>
                  <CardDescription>Daftar mata pelajaran yang tersedia di kelas ini</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-b bg-muted/30 hover:bg-muted/30">
                    <TableHead className="h-14 px-6">No</TableHead>
                    <TableHead className="h-14 px-6">Nama Mata Pelajaran</TableHead>
                    <TableHead className="h-14 px-6">Guru Pengampu</TableHead>
                    <TableHead className="h-14 px-6">Kategori</TableHead>
                    <TableHead className="h-14 px-6">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mapelList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Belum ada mata pelajaran di kelas ini
                      </TableCell>
                    </TableRow>
                  ) : (
                    mapelList.map((mapel, index) => (
                      <TableRow key={mapel.id} className="border-b last:border-0 hover:bg-muted/50">
                        <TableCell className="px-6 py-4">{index + 1}</TableCell>
                        <TableCell className="px-6 py-4 font-medium">{mapel.nama}</TableCell>
                        <TableCell className="px-6 py-4">{mapel.pengampu_name || '-'}</TableCell>
                        <TableCell className="px-6 py-4">
                          <Badge variant="outline">{mapel.kategori || '-'}</Badge>
                        </TableCell>
                        <TableCell className="px-6 py-4">
                          <Badge variant={mapel.status === 'aktif' ? 'default' : 'secondary'}>
                            {mapel.status === 'aktif' ? 'Aktif' : 'Nonaktif'}
                          </Badge>
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

      {/* Modals */}
      <ImportSantriModal 
        open={importSantriOpen} 
        onOpenChange={setImportSantriOpen} 
        kelasList={[{ id: kelas.id, nama: kelas.nama }]} 
        onImported={handleUpdateMembers} 
      />

      <KelasForm
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        kelas={kelas}
        onSuccess={handleEditSuccess}
      />

      <KelasMembers
        open={showMembersDialog}
        onOpenChange={setShowMembersDialog}
        kelasId={id || ''}
        currentSantriIds={santriList.map(s => s.id)}
        onUpdateMembers={handleUpdateMembers}
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Kelas</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus kelas ini? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Batal</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
