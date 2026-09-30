import { Button } from '@/components/ui/button';
import { ListCard, ListCardColumn } from '@/components/ui/list-card';
import { DeleteButton } from '@/components/ui/action-buttons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { QrCode, BookPlus, BookOpen, Eye, MoreVertical } from 'lucide-react';
import { Buku } from '@/hooks/usePerpustakaan';

interface Props {
  buku: Buku;
  onEdit: () => void;
  onDelete: () => void;
  onShowBarcode: () => void;
  onLend: () => void;
  onShowDetail?: () => void;
}

export function BukuCard({ buku, onDelete, onShowBarcode, onLend, onShowDetail }: Props) {
  const columns: ListCardColumn[] = [
    { value: buku.judul, subValue: buku.kode_buku, width: '280px' },
    { label: 'Penulis', value: buku.penulis || '-', width: '160px' },
    { label: 'Lokasi', value: buku.lokasi_rak || '-', width: '120px' },
  ];

  const badgeVariant: 'success' | 'destructive' | 'secondary' =
    buku.status === 'tersedia' ? 'success' : buku.status === 'habis' ? 'destructive' : 'secondary';

  const actions = (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="action-more"
            size="icon-sm"
            onClick={(e) => e.stopPropagation()}
            title="Lainnya"
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={(e) => { e.stopPropagation(); onShowDetail?.(); }}
          >
            <Eye className="h-4 w-4 mr-2" />
            Detail
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer"
            disabled={buku.tersedia < 1}
            onClick={(e) => { e.stopPropagation(); onLend(); }}
          >
            <BookPlus className="h-4 w-4 mr-2" />
            Pinjamkan
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={(e) => { e.stopPropagation(); onShowBarcode(); }}
          >
            <QrCode className="h-4 w-4 mr-2" />
            Barcode
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DeleteButton onClick={onDelete} />
    </>
  );

  const iconNode = buku.cover_url ? (
    <img
      src={buku.cover_url}
      alt={buku.judul}
      className="h-full w-full object-cover"
    />
  ) : (
    <BookOpen />
  );

  return (
    <ListCard
      icon={iconNode}
      columns={columns}
      badge={{ label: `${buku.tersedia}/${buku.total_eksemplar}`, variant: badgeVariant, title: 'Stok' }}
      actions={actions}
      onClick={onShowDetail}
    />
  );
}
