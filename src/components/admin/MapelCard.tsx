import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ListCard, ListCardColumn } from '@/components/ui/list-card';
import { MoreVertical, Trash2, Lock, Eye, BookOpen, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import MapelDetailSheet from './MapelDetailSheet';

interface MapelCardProps {
  mapel: {
    id: string;
    nama: string;
    kode_mapel?: string | null;
    status?: string | null;
    kategori?: string | null;
    kelas?: { id: string; nama: string; tingkat: string; tahun_ajaran?: string } | null;
    pengampu?: { id: string; name: string } | null;
  };
  onToggleStatus: (mapelId: string, currentStatus: string) => void;
  onDelete: (mapelId: string) => void;
}

export default function MapelCard({ mapel, onToggleStatus, onDelete }: MapelCardProps) {
  const navigate = useNavigate();
  const [showMapelDetail, setShowMapelDetail] = useState(false);

  const pengampuName = Array.isArray(mapel.pengampu)
    ? mapel.pengampu[0]?.name
    : mapel.pengampu?.name;

  const columns: ListCardColumn[] = [
    {
      value: mapel.nama,
      subValue: mapel.kode_mapel || '-',
      width: '280px',
    },
    {
      label: 'Kelas',
      value: `${mapel.kelas?.nama || '-'}${mapel.kelas?.tahun_ajaran ? ` - ${mapel.kelas.tahun_ajaran}` : ''}`,
      width: '175px',
    },
    {
      label: 'Guru Pengampu',
      value: pengampuName || '-',
      width: '200px',
    },
  ];

  const actions = (
    <>
      <Button 
        variant="action-detail" 
        size="icon-sm" 
        onClick={() => setShowMapelDetail(true)}
        title="Detail Mapel"
      >
        <Eye className="h-4 w-4" />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="action-more" 
            size="icon-sm"
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem 
            className="cursor-pointer" 
            onClick={() => navigate(`/admin/mapel/${mapel.id}`)}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Kelola Mapel
          </DropdownMenuItem>
          <DropdownMenuItem 
            className="cursor-pointer" 
            onClick={() => onToggleStatus(mapel.id, mapel.status || 'aktif')}
          >
            <Lock className="h-4 w-4 mr-2" />
            {mapel.status === 'aktif' ? 'Nonaktifkan' : 'Aktifkan'}
          </DropdownMenuItem>
          <DropdownMenuItem 
            className="cursor-pointer text-destructive focus:text-destructive" 
            onClick={() => onDelete(mapel.id)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Hapus
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Mapel Detail Sheet */}
      <MapelDetailSheet 
        open={showMapelDetail} 
        onOpenChange={setShowMapelDetail} 
        mapelId={mapel.id} 
      />
    </>
  );

  // Badge config matching MasterMapelList
  const KATEGORI_BADGE_CONFIG: Record<string, { variant: 'default' | 'secondary' | 'warning' | 'destructive', label: string }> = {
    wajib: { variant: 'default', label: 'Wajib' },
    pilihan: { variant: 'secondary', label: 'Pilihan' },
    ekstrakurikuler: { variant: 'warning', label: 'Ekskul' },
    asrama: { variant: 'destructive', label: 'Asrama' },
  };

  const badgeConfig = KATEGORI_BADGE_CONFIG[mapel.kategori || 'wajib'] || { variant: 'default' as const, label: mapel.kategori || '-' };

  return (
    <ListCard
      icon={<BookOpen className="h-5 w-5 text-primary" />}
      iconBgColor="#E7F6F8"
      columns={columns}
      badge={{
        title: 'Kategori',
        label: badgeConfig.label,
        variant: badgeConfig.variant,
      }}
      actions={actions}
      onDoubleClick={() => setShowMapelDetail(true)}
    />
  );
}
