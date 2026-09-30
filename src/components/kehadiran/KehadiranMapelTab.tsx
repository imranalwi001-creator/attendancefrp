import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ListCard, ListCardColumn, ListCardBadge } from '@/components/ui/list-card';
import { ActionButtonGroup, DetailButton } from '@/components/ui/action-buttons';
import { BookOpen, Search, ChevronLeft, ChevronRight, UserCheck, UserPlus } from 'lucide-react';

interface KehadiranMapelTabProps {
  tahunAjaran: string;
}

interface MapelStats {
  id: string;
  nama: string;
  kelasNama: string;
  kelasId: string;
  kehadiranGuruAsli: number;
  kehadiranGuruPengganti: number;
}

export default function KehadiranMapelTab({ tahunAjaran }: KehadiranMapelTabProps) {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  // Fetch mapel with attendance stats
  const { data: mapelStats = [], isLoading } = useQuery<MapelStats[]>({
    queryKey: ['kehadiran-mapel-stats', tahunAjaran],
    queryFn: async () => {
      // Fetch all active mapel filtered by tahun ajaran
      const { data: mapelData, error: mapelError } = await supabase
        .from('mapel')
        .select(`
          id,
          nama,
          kelas:kelas!mapel_kelas_id_fkey(id, nama, tahun_ajaran)
        `)
        .eq('status', 'aktif');

      if (mapelError) throw mapelError;

      // Filter by tahun ajaran
      const filteredMapel = tahunAjaran
        ? mapelData?.filter((m: any) => m.kelas?.tahun_ajaran === tahunAjaran) || []
        : mapelData || [];

      if (filteredMapel.length === 0) return [];

      const mapelIds = filteredMapel.map((m: any) => m.id);

      // Fetch jadwal aktif untuk mengetahui pengampu asli per mapel
      const { data: jadwalData, error: jadwalError } = await supabase
        .from('jadwal')
        .select('id, mapel_id, pengampu_id')
        .in('mapel_id', mapelIds)
        .eq('status', 'aktif');

      if (jadwalError) throw jadwalError;

      // Fetch sesi pembelajaran berdasarkan snapshot mapel_id
      // (tahan terhadap penghapusan jadwal — data kehadiran tetap terlacak)
      const { data: sesiData, error: sesiError } = await supabase
        .from('sesi_pembelajaran')
        .select('id, jadwal_id, mapel_id, pengampu_id, status')
        .in('mapel_id', mapelIds)
        .eq('status', 'selesai');

      if (sesiError) throw sesiError;

      // Build stats for each mapel
      const stats: MapelStats[] = filteredMapel.map((mapel: any) => {
        const mapelJadwal = jadwalData?.filter((j: any) => j.mapel_id === mapel.id) || [];
        const mapelSesi = sesiData?.filter((s: any) => s.mapel_id === mapel.id) || [];

        // Kumpulkan semua pengampu asli yang pernah/masih mengampu mapel ini
        const pengampuAsliIds = new Set(mapelJadwal.map((j: any) => j.pengampu_id).filter(Boolean));

        let guruAsli = 0;
        let guruPengganti = 0;

        mapelSesi.forEach((sesi: any) => {
          // Jika jadwal masih ada, gunakan pengampu jadwal sebagai referensi
          const jadwal = sesi.jadwal_id ? mapelJadwal.find((j: any) => j.id === sesi.jadwal_id) : null;
          const referencePengampuId = jadwal?.pengampu_id;

          if (referencePengampuId) {
            if (sesi.pengampu_id === referencePengampuId) guruAsli++;
            else guruPengganti++;
          } else {
            // Jadwal sudah dihapus: cek terhadap daftar pengampu asli historis
            if (pengampuAsliIds.has(sesi.pengampu_id)) guruAsli++;
            else guruPengganti++;
          }
        });

        return {
          id: mapel.id,
          nama: mapel.nama,
          kelasNama: mapel.kelas?.nama || '-',
          kelasId: mapel.kelas?.id || '',
          kehadiranGuruAsli: guruAsli,
          kehadiranGuruPengganti: guruPengganti,
        };
      });

      return stats;
    },
    enabled: !!tahunAjaran,
    staleTime: 5 * 60 * 1000,
  });

  // Filter by search
  const filteredMapel = useMemo(() => {
    return mapelStats
      .filter(m => {
        if (!searchTerm) return true;
        return m.nama.toLowerCase().includes(searchTerm.toLowerCase()) ||
               m.kelasNama.toLowerCase().includes(searchTerm.toLowerCase());
      })
      .sort((a, b) => a.kelasNama.localeCompare(b.kelasNama) || a.nama.localeCompare(b.nama));
  }, [mapelStats, searchTerm]);

  // Pagination
  const totalPages = Math.ceil(filteredMapel.length / PAGE_SIZE);
  const paginatedMapel = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return filteredMapel.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredMapel, currentPage, PAGE_SIZE]);

  // Reset page when search changes
  useMemo(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const handleDetailClick = (mapelId: string) => {
    navigate(`/admin/kehadiran/mapel/${mapelId}`);
  };

  return (
    <Card className="rounded-2xl">
      {/* Search Filter */}
      <CardContent className="p-3 md:p-4">
        <div className="relative">
          <Search className="absolute left-2.5 md:left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari mata pelajaran atau kelas..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-8 md:pl-10 rounded-xl text-sm md:text-base h-9 md:h-10"
          />
        </div>
      </CardContent>

      {/* Mapel List */}
      <CardContent className="p-4 pt-0">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="animate-pulse p-4 rounded-xl bg-muted/30">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="flex-1">
                    <Skeleton className="h-5 w-40 mb-2" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : paginatedMapel.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Tidak ada mata pelajaran ditemukan</p>
          </div>
        ) : (
          <div className="space-y-3">
            {paginatedMapel.map((mapel) => {
              const columns: ListCardColumn[] = [
                {
                  value: mapel.nama,
                  subValue: mapel.kelasNama,
                },
                {
                  label: 'Guru Asli',
                  value: (
                    <span className="flex items-center gap-1.5">
                      <UserCheck className="h-3.5 w-3.5 text-success" />
                      <span className="font-semibold text-success">{mapel.kehadiranGuruAsli}</span>
                    </span>
                  ),
                },
                {
                  label: 'Guru Pengganti',
                  value: (
                    <span className="flex items-center gap-1.5">
                      <UserPlus className="h-3.5 w-3.5 text-warning" />
                      <span className="font-semibold text-warning">{mapel.kehadiranGuruPengganti}</span>
                    </span>
                  ),
                },
              ];

              return (
                <ListCard
                  key={mapel.id}
                  icon={<BookOpen className="h-5 w-5 text-primary" />}
                  iconBgColor="hsl(var(--primary) / 0.1)"
                  columns={columns}
                  actions={
                    <ActionButtonGroup>
                      <DetailButton onClick={() => handleDetailClick(mapel.id)} />
                    </ActionButtonGroup>
                  }
                  onClick={() => handleDetailClick(mapel.id)}
                />
              );
            })}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t">
                <span className="text-sm text-muted-foreground">
                  Menampilkan {(currentPage - 1) * PAGE_SIZE + 1}-{Math.min(currentPage * PAGE_SIZE, filteredMapel.length)} dari {filteredMapel.length}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="rounded-lg"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium px-2">
                    {currentPage} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="rounded-lg"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
