import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookOpen, FileText, ChevronRight, Video, Image, Link2, Type, Clock, Sparkles } from 'lucide-react';
import MateriList from '@/components/materi/MateriList';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow, differenceInDays, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

// Helper function to parse content and get types
const getContentTypes = (konten: string): { types: string[], count: number } => {
  try {
    const parsed = JSON.parse(konten);
    if (Array.isArray(parsed)) {
      const types = new Set<string>();
      parsed.forEach((item: any) => {
        const t = item?.tipe ?? item?.type;
        if (t) types.add(t);
      });
      return { types: Array.from(types), count: parsed.length };
    }
  } catch {
    // If not JSON, assume text
    return { types: ['text'], count: 1 };
  }
  return { types: [], count: 0 };
};

// Helper function to check if materi is new (within 1 day)
const isNewMateri = (createdAt: string): boolean => {
  try {
    const created = parseISO(createdAt);
    return differenceInDays(new Date(), created) <= 1;
  } catch {
    return false;
  }
};

// Helper function to format relative time
const formatRelativeTime = (dateStr: string): string => {
  try {
    const date = parseISO(dateStr);
    return formatDistanceToNow(date, { addSuffix: true, locale: idLocale });
  } catch {
    return '';
  }
};

// Content type icon component
const ContentTypeIcon = ({ type }: { type: string }) => {
  const iconProps = { className: "w-3.5 h-3.5", strokeWidth: 2 };
  switch (type) {
    case 'video':
      return <Video {...iconProps} className="w-3.5 h-3.5 text-red-500" />;
    case 'image':
      return <Image {...iconProps} className="w-3.5 h-3.5 text-blue-500" />;
    case 'link':
      return <Link2 {...iconProps} className="w-3.5 h-3.5 text-green-500" />;
    case 'text':
    default:
      return <Type {...iconProps} className="w-3.5 h-3.5 text-amber-500" />;
  }
};

interface TpStatusItem {
  tp_index: number;
  status: string;
  achieved_at: string | null;
}

interface MapelMateriTabProps {
  mapelId: string | undefined;
  user: any;
  materiList: any[];
  materiReads: Set<string>;
  setMateriReads: React.Dispatch<React.SetStateAction<Set<string>>>;
  selectedSemester: 'ganjil' | 'genap';
  mapelInfo: any;
  tpStatusList: TpStatusItem[];
  hasActiveSession: boolean;
  onRefresh: () => void;
  onCheckInfoComplete: () => boolean;
}

export default function MapelMateriTab({
  mapelId,
  user,
  materiList,
  materiReads,
  setMateriReads,
  selectedSemester,
  mapelInfo,
  tpStatusList,
  hasActiveSession,
  onRefresh,
  onCheckInfoComplete
}: MapelMateriTabProps) {
  const navigate = useNavigate();

  // Handle materi click for santri - mark as read and navigate
  const handleMateriClick = (materi: any) => {
    const isRead = materiReads.has(materi.id);
    
    // Navigate immediately - don't wait for async operations
    navigate(user?.role === 'santri' 
      ? `/app/mapel/${mapelId}/materi/${materi.id}` 
      : `/admin/mapel/${mapelId}/materi/${materi.id}`
    );
    
    // Mark as read in background if santri and not yet read
    if (user?.role === 'santri' && !isRead && user?.id) {
      setMateriReads(prev => new Set([...prev, materi.id]));
      supabase.from('materi_reads').insert({
        materi_id: materi.id,
        santri_id: user.id
      }).then(({ error }) => {
        if (error) console.error('Error marking materi as read:', error);
      });
    }
  };

  // For guru/walikelas/admin - use MateriList component
  if (user?.role === 'guru' || user?.role === 'walikelas' || user?.role === 'admin') {
    return (
      <div className="space-y-4 mt-6">
        <MateriList 
          materiList={materiList} 
          mapelId={mapelId} 
          semester={selectedSemester} 
          onRefresh={onRefresh} 
          onCheckInfoComplete={onCheckInfoComplete} 
          cachedTujuanPembelajaran={mapelInfo?.tujuan_pembelajaran?.map((item: any) => ({ 
            text: typeof item === 'string' ? item : item?.text || '' 
          }))} 
          cachedTpStatus={tpStatusList?.map(tp => ({ 
            tp_index: tp.tp_index, 
            status: tp.status as 'tercapai' | 'belum_tercapai' 
          }))} 
          isSessionActive={hasActiveSession} 
        />
      </div>
    );
  }

  // For santri - card list view matching guru's MateriList style
  return (
    <div className="space-y-3 mt-6">
      {materiList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <BookOpen className="h-10 w-10 text-primary" />
          </div>
          <p className="text-lg font-semibold mb-2">Belum ada materi</p>
          <p className="text-sm text-muted-foreground text-center max-w-sm">
            Belum ada materi yang tersedia untuk mata pelajaran ini
          </p>
        </div>
      ) : (
        [...materiList]
          .sort((a, b) => {
            // Extract pertemuan number from deskripsi
            const getPertemuanNumber = (m: any) => {
              const desc = m.deskripsi || '';
              const match = desc.match(/pertemuan\s*(\d+)/i);
              return match ? parseInt(match[1], 10) : 9999;
            };
            return getPertemuanNumber(a) - getPertemuanNumber(b);
          })
          .map((materi) => {
            const isRead = materiReads.has(materi.id);
            const { types: contentTypes, count: itemCount } = getContentTypes(materi.konten);
            const isNew = isNewMateri(materi.created_at);
            const relativeTime = formatRelativeTime(materi.updated_at || materi.created_at);
            
            return (
              <Card 
                key={materi.id} 
                className="rounded-2xl border-2 border-border/50 hover:border-primary/20 transition-all duration-300 cursor-pointer bg-card shadow-sm"
                onClick={() => handleMateriClick(materi)}
              >
                <CardContent className="p-4 md:p-5">
                  {/* Main Row */}
                  <div className="flex items-center gap-4">
                    {/* Icon */}
                    <div className="flex-shrink-0">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isRead ? 'bg-muted' : 'bg-primary/10'}`}>
                        <FileText className={`w-6 h-6 ${isRead ? 'text-muted-foreground' : 'text-primary'}`} />
                      </div>
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-foreground truncate">
                          {materi.judul}
                        </h3>
                        {isNew && (
                          <Badge className="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 text-[10px] px-1.5 py-0 h-4 font-medium shrink-0 border-transparent">
                            <Sparkles className="w-2.5 h-2.5 mr-0.5" />
                            Baru
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {materi.deskripsi || 'Pertemuan'}
                      </p>
                    </div>
                    
                    {/* Status Badge */}
                    <div className="flex-shrink-0 hidden sm:block">
                      <Badge 
                        variant="outline" 
                        className={isRead 
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-transparent' 
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-transparent'
                        }
                      >
                        {isRead ? "Sudah Dibaca" : "Belum Dibaca"}
                      </Badge>
                    </div>
                    
                    {/* Arrow */}
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <ChevronRight className="w-4 h-4 text-primary" />
                      </div>
                    </div>
                  </div>
                  
                  {/* Info Row */}
                  <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-3 text-xs text-muted-foreground">
                    {/* Item Count */}
                    {itemCount > 0 && (
                      <span>{itemCount} item</span>
                    )}
                    
                    {/* Relative Time */}
                    {relativeTime && (
                      <>
                        <span className="text-muted-foreground/50">•</span>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{relativeTime}</span>
                        </div>
                      </>
                    )}
                    
                    {/* Mobile read status */}
                    <div className="sm:hidden ml-auto">
                      <Badge 
                        variant="outline" 
                        className={`text-[10px] px-1.5 py-0 h-4 ${isRead 
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-transparent' 
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-transparent'
                        }`}
                      >
                        {isRead ? "Dibaca" : "Belum"}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
      )}
    </div>
  );
}
