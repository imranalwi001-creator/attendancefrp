import { GDriveFileType, getFileTypeLabel, getFileTypeIcon } from '@/lib/gdriveUtils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Pencil, Trash2, BookOpen, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getSmallThumbnailUrl } from '@/lib/storageUtils';

interface BahanBelajarGridCardProps {
  id: string;
  judul: string;
  deskripsi?: string | null;
  fileType: GDriveFileType;
  kelasNama?: string | null;
  mapelNama?: string | null;
  uploaderName?: string | null;
  sampulUrl?: string | null;
  onClick: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  canManage?: boolean;
}

const getFileTypeGradient = (fileType: GDriveFileType): string => {
  switch (fileType) {
    case 'document':
      return 'from-blue-500/20 via-blue-400/10 to-cyan-500/20';
    case 'spreadsheet':
      return 'from-emerald-500/20 via-green-400/10 to-teal-500/20';
    case 'presentation':
      return 'from-amber-500/20 via-orange-400/10 to-yellow-500/20';
    case 'file':
    default:
      return 'from-slate-500/20 via-gray-400/10 to-zinc-500/20';
  }
};

const getFileTypeBadgeStyle = (fileType: GDriveFileType): string => {
  switch (fileType) {
    case 'document':
      return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
    case 'spreadsheet':
      return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
    case 'presentation':
      return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
    case 'file':
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
};

export function BahanBelajarGridCard({
  judul,
  deskripsi,
  fileType,
  kelasNama,
  mapelNama,
  uploaderName,
  sampulUrl,
  onClick,
  onEdit,
  onDelete,
  canManage = false,
}: BahanBelajarGridCardProps) {
  const Icon = getFileTypeIcon(fileType);
  const initials = uploaderName?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'U';

  return (
    <div
      onClick={onClick}
      className="group relative flex flex-col rounded-2xl border-2 border-border/50 bg-card overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-xl hover:shadow-primary/5 hover:border-primary/30 hover:-translate-y-1"
    >
      {/* Cover Image / Thumbnail - Book aspect ratio 2:3 with max height */}
      <div className={cn(
        "relative aspect-[2/3] w-full max-h-56 bg-gradient-to-br overflow-hidden",
        getFileTypeGradient(fileType)
      )}>
        {sampulUrl ? (
          <img 
            src={getSmallThumbnailUrl(sampulUrl)} 
            alt={judul}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative">
              {/* Background decoration */}
              <div className="absolute -inset-8 bg-gradient-to-br from-primary/10 to-transparent rounded-full blur-2xl" />
              <Icon className="relative h-16 w-16 text-primary/40 group-hover:text-primary/60 transition-colors duration-300" />
            </div>
          </div>
        )}
        
        {/* File Type Badge - Floating */}
        <div className="absolute top-3 left-3">
          <Badge className={cn(
            "font-medium text-xs border shadow-sm backdrop-blur-sm",
            getFileTypeBadgeStyle(fileType)
          )}>
            {getFileTypeLabel(fileType)}
          </Badge>
        </div>

        {/* Manage buttons overlay */}
        {canManage && (
          <div className="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <Button
              variant="secondary"
              size="icon"
              className="h-8 w-8 rounded-lg bg-background/80 backdrop-blur-sm hover:bg-background shadow-sm"
              onClick={(e) => { e.stopPropagation(); onEdit?.(); }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="h-8 w-8 rounded-lg bg-background/80 backdrop-blur-sm hover:bg-destructive hover:text-destructive-foreground shadow-sm"
              onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {/* Gradient overlay at bottom */}
        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-card to-transparent" />
      </div>

      {/* Content */}
      <div className="flex-1 p-4 space-y-2.5">
        <h3 className="font-semibold text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors duration-300">
          {judul}
        </h3>
        
        {deskripsi && (
          <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
            {deskripsi}
          </p>
        )}

        {/* Meta info */}
        <div className="flex flex-wrap gap-2 pt-1">
          {mapelNama && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <BookOpen className="h-3.5 w-3.5" />
              <span className="truncate max-w-[100px]">{mapelNama}</span>
            </div>
          )}
          {kelasNama && (
            <Badge variant="secondary" className="text-xs font-normal">
              {kelasNama}
            </Badge>
          )}
        </div>
      </div>

      {/* Footer - Uploader */}
      <div className="px-4 pb-4 pt-0">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Avatar className="h-5 w-5">
            <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="truncate">{uploaderName || 'Unknown'}</span>
        </div>
      </div>
    </div>
  );
}
