import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAcademicYear } from '@/contexts/AcademicYearContext';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Search, GraduationCap, AlertCircle } from 'lucide-react';
import { AdminPenilaianSkeleton } from '@/components/skeletons/AdminPenilaianSkeleton';
import { ActionButtonGroup, DetailButton } from '@/components/ui/action-buttons';
import { ListCard, ListCardBadge } from '@/components/ui/list-card';

interface KelasWithStats {
  id: string;
  nama: string;
  tingkat: string;
  tahun_ajaran: string;
  jumlah_santri: number;
  total_mapel: number;
  mapel_finalized: number;
}

export default function PenilaianWalikelas() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeAcademicYear, isLoading: academicYearLoading } = useAcademicYear();
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch staff ID for current user
  const { data: staffData } = useQuery({
    queryKey: ['staff-id', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('staff')
        .select('id')
        .eq('id', user.id)
        .single();
      return data;
    },
    enabled: !!user?.id,
  });

  const {
    data: kelasList = [],
    isLoading: loading
  } = useQuery({
    queryKey: ['walikelas-penilaian-kelas', activeAcademicYear?.name, staffData?.id],
    queryFn: async () => {
      if (!staffData?.id) return [];
      
      // Fetch kelas where this user is walikelas - using explicit columns
      const { data: kelasData, error: kelasError } = await supabase
        .from('kelas')
        .select('id, nama, tingkat, tahun_ajaran, status, walikelas_id, jumlah_santri')
        .eq('status', 'aktif')
        .eq('walikelas_id', staffData.id)
        .eq('tahun_ajaran', activeAcademicYear?.name || '')
        .order('tingkat')
        .order('nama');

      if (kelasError) throw kelasError;
      if (!kelasData || kelasData.length === 0) return [];

      const kelasWithStats = await Promise.all((kelasData || []).map(async kelas => {
        const { count: santriCount } = await supabase
          .from('santri')
          .select('id', { count: 'exact', head: true })
          .eq('kelas_id', kelas.id);

        const { count: mapelCount } = await supabase
          .from('mapel')
          .select('*', { count: 'exact', head: true })
          .eq('kelas_id', kelas.id)
          .eq('status', 'aktif');

        const { data: mapelData } = await supabase
          .from('mapel')
          .select('id')
          .eq('kelas_id', kelas.id)
          .eq('status', 'aktif');

        const mapelIds = mapelData?.map(m => m.id) || [];
        let mapelFinalized = 0;
        const actualSantriCount = santriCount || 0;

        if (mapelIds.length > 0 && actualSantriCount > 0) {
          for (const mapelId of mapelIds) {
            const { count: finalizedCount } = await supabase
              .from('asesmen_sumatif')
              .select('*', { count: 'exact', head: true })
              .eq('mapel_id', mapelId)
              .eq('is_finalized', true);

            if (finalizedCount === actualSantriCount) {
              mapelFinalized++;
            }
          }
        }

        return {
          id: kelas.id,
          nama: kelas.nama,
          tingkat: kelas.tingkat,
          tahun_ajaran: kelas.tahun_ajaran,
          jumlah_santri: actualSantriCount,
          total_mapel: mapelCount || 0,
          mapel_finalized: mapelFinalized
        };
      }));

      return kelasWithStats as KelasWithStats[];
    },
    staleTime: 2 * 60 * 1000,
    enabled: !academicYearLoading && !!staffData?.id && !!activeAcademicYear?.name
  });

  // Filter kelas based on search query
  const filteredKelasList = useMemo(() => {
    return kelasList.filter(kelas => {
      const matchesSearch = searchQuery === '' || 
        kelas.nama.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });
  }, [kelasList, searchQuery]);

  const getBadgeConfig = (kelas: KelasWithStats): ListCardBadge => {
    if (kelas.total_mapel === 0) {
      return { label: 'Belum Ada Mapel', variant: 'outline' };
    }
    if (kelas.mapel_finalized === kelas.total_mapel) {
      return { label: 'Semua Finalisasi', variant: 'success' };
    }
    if (kelas.mapel_finalized > 0) {
      return { label: `${kelas.mapel_finalized}/${kelas.total_mapel} Finalisasi`, variant: 'secondary' };
    }
    return { label: 'Belum Finalisasi', variant: 'outline' };
  };

  if (loading || academicYearLoading) {
    return <AdminPenilaianSkeleton />;
  }

  return (
    <div className="space-y-6 pb-24">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-background border border-border/50 p-6">
        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-1">Penilaian</h1>
              <p className="text-muted-foreground">Kelola penilaian untuk kelas yang Anda ampu</p>
            </div>
          </div>
        </div>
      </div>

      <Card className="rounded-2xl">
        <CardContent className="p-4 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari kelas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 rounded-xl"
            />
          </div>

          {/* Warning for no active academic year */}
          {!activeAcademicYear && (
            <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4">
              <div className="flex items-center gap-3 text-yellow-600">
                <AlertCircle className="h-5 w-5" />
                <p className="text-sm font-medium">Belum ada tahun ajaran aktif.</p>
              </div>
            </div>
          )}

          {/* No classes message */}
          {filteredKelasList.length === 0 && activeAcademicYear ? (
            <div className="py-12 text-center">
              <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">
                {searchQuery 
                  ? `Tidak ada kelas yang cocok dengan "${searchQuery}"` 
                  : 'Anda tidak terdaftar sebagai wali kelas untuk tahun ajaran ini'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredKelasList.map(kelas => (
                <ListCard
                  key={kelas.id}
                  icon={<GraduationCap className="h-5 w-5 text-primary" />}
                  iconBgColor="hsl(var(--primary) / 0.1)"
                  columns={[
                    {
                      value: kelas.nama,
                      subValue: kelas.tahun_ajaran,
                    },
                    {
                      label: 'Jumlah Santri',
                      value: kelas.jumlah_santri || 0,
                      width: '120px',
                    },
                    {
                      label: 'Jumlah Mapel',
                      value: kelas.total_mapel,
                      width: '120px',
                    },
                  ]}
                  badge={getBadgeConfig(kelas)}
                  actions={
                    <ActionButtonGroup>
                      <DetailButton onClick={() => navigate(`/app/penilaian/${kelas.id}`)} />
                    </ActionButtonGroup>
                  }
                  onClick={() => navigate(`/app/penilaian/${kelas.id}`)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
