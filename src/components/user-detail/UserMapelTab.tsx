import { Card, CardContent } from '@/components/ui/card';
import { ExtractionCardHeader } from '@/components/ui/extraction-card-header';
import { Badge } from '@/components/ui/badge';
import { ListCard } from '@/components/ui/list-card';
import { BookOpen, Users } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';

interface UserMapelTabProps {
  userId: string;
}

export function UserMapelTab({ userId }: UserMapelTabProps) {
  const { data: mapelList, isLoading } = useQuery({
    queryKey: ['staff-mapel', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mapel')
        .select(`
          id,
          nama,
          kode_mapel,
          kategori,
          status,
          kelas:kelas_id(id, nama, tingkat, tahun_ajaran)
        `)
        .eq('pengampu_id', userId)
        .order('nama', { ascending: true })
        .limit(50);

      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border-2 border-border/50 p-4">
            <Skeleton className="h-6 w-48 mb-2" />
            <Skeleton className="h-4 w-32" />
          </div>
        ))}
      </div>
    );
  }

  const getStatusBadgeVariant = (status: string | null): "success" | "secondary" => {
    return status === 'aktif' ? 'success' : 'secondary';
  };

  return (
    <Card className="rounded-3xl border shadow-lg overflow-hidden">
      <ExtractionCardHeader
        icon={<BookOpen className="h-4 w-4 text-primary" />}
        title="Mata Pelajaran yang Diampu"
      />
      <CardContent className="p-6">
        {mapelList && mapelList.length > 0 ? (
          <div className="space-y-3">
            {mapelList.map((mapel) => (
              <ListCard
                key={mapel.id}
                icon={<BookOpen className="h-5 w-5 text-primary" />}
                columns={[
                  {
                    value: mapel.nama,
                    subValue: mapel.kode_mapel || undefined,
                    width: '200px'
                  },
                  {
                    label: 'Kelas',
                    value: mapel.kelas ? `${mapel.kelas.nama} - ${mapel.kelas.tingkat}` : '-',
                    width: '150px'
                  },
                  {
                    label: 'Kategori',
                    value: mapel.kategori || '-',
                    width: '100px'
                  }
                ]}
                badge={{
                  label: mapel.status || 'aktif',
                  variant: getStatusBadgeVariant(mapel.status)
                }}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">Belum ada mata pelajaran yang diampu</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
