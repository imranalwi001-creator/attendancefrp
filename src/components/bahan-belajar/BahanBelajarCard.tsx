import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ActionButtonGroup } from '@/components/ui/action-buttons';
import { GDriveFileType, getFileTypeLabel, getFileTypeIcon } from '@/lib/gdriveUtils';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { getSmallThumbnailUrl } from '@/lib/storageUtils';

interface BahanBelajarCardProps {
  id: string;
  judul: string;
  deskripsi?: string | null;
  fileType: GDriveFileType;
  kelasNama?: string | null;
  mapelNama?: string | null;
  createdAt: string;
  creatorName?: string | null;
  sampulUrl?: string | null;
  onClick: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  canManage?: boolean;
}

const getFileTypeBadgeColor = (fileType: GDriveFileType): string => {
  switch (fileType) {
    case 'document':
      return 'bg-primary/10 text-primary';
    case 'spreadsheet':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
    case 'presentation':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    case 'file':
    default:
      return 'bg-muted text-muted-foreground';
  }
};

export function BahanBelajarCard({
  judul,
  deskripsi,
  fileType,
  kelasNama,
  mapelNama,
  createdAt,
  creatorName,
  sampulUrl,
  onClick,
  onEdit,
  onDelete,
  canManage = false,
}: BahanBelajarCardProps) {
  const Icon = getFileTypeIcon(fileType);
  const timeAgo = formatDistanceToNow(new Date(createdAt), { addSuffix: true, locale: id });

  return (
    <div
      onClick={onClick}
      className="flex items-center justify-between gap-4 p-4 rounded-xl border-2 border-border/50 bg-card hover:bg-muted/30 transition-all duration-300 cursor-pointer"
    >
      {/* Section 1: Thumbnail + Title */}
      <div className="flex items-center gap-3 min-w-0 flex-1 lg:flex-none lg:w-[280px]">
        {/* Thumbnail */}
        <div className="w-14 h-14 bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center">
          {sampulUrl ? (
            <img 
              src={getSmallThumbnailUrl(sampulUrl)} 
              alt={judul} 
              className="w-full h-full object-cover" 
            />
          ) : (
            <Icon className="h-6 w-6 text-primary/50" />
          )}
        </div>
        
        {/* Title & Description */}
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground truncate">{judul}</p>
          {deskripsi && (
            <p className="text-xs text-muted-foreground truncate">{deskripsi}</p>
          )}
        </div>
      </div>

      {/* Section 2: Kelas - Desktop only */}
      <div className="hidden lg:block w-[120px] shrink-0">
        <p className="text-xs text-muted-foreground mb-0.5">Kelas</p>
        <p className="text-sm font-medium text-foreground truncate">
          {kelasNama || 'Semua'}
        </p>
      </div>

      {/* Section 3: Mapel - Desktop only */}
      <div className="hidden lg:block w-[150px] shrink-0">
        <p className="text-xs text-muted-foreground mb-0.5">Mapel</p>
        <p className="text-sm font-medium text-foreground truncate">
          {mapelNama || 'Umum'}
        </p>
      </div>

      {/* Section 4: File Type Badge */}
      <div className="shrink-0">
        <Badge className={cn(
          'font-medium cursor-default hover:bg-inherit text-xs',
          getFileTypeBadgeColor(fileType)
        )}>
          {getFileTypeLabel(fileType)}
        </Badge>
      </div>

      {/* Section 5: Action buttons */}
      {canManage && (
        <ActionButtonGroup className="shrink-0">
          <Button
            variant="action-delete"
            size="icon-sm"
            onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
            title="Hapus"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button
            variant="action-detail"
            size="icon-sm"
            onClick={(e) => { e.stopPropagation(); onEdit?.(); }}
            title="Edit"
          >
            <Pencil className="h-4 w-4" />
          </Button>
        </ActionButtonGroup>
      )}
    </div>
  );
}
