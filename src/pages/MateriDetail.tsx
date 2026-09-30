import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { YouTubePlayer, extractYouTubeVideoId } from '@/components/ui/youtube-player';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, ExternalLink, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale/id';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MateriDetailSkeleton } from '@/components/skeletons';
import { sanitizeHtml } from '@/lib/sanitize';
import { getContentImageUrl } from '@/lib/storageUtils';
import { useQuery } from '@tanstack/react-query';

export default function MateriDetail() {
  const { mapelId, materiId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isRead, setIsRead] = useState(false);

  // Use React Query for fresh data fetching
  const {
    data: materi,
    isLoading: materiLoading,
    error: materiError,
    refetch: refetchMateri,
  } = useQuery({
    queryKey: ['materi-detail', materiId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('materi')
        .select('id, judul, deskripsi, konten, tipe_konten, status, semester, urutan, tujuan_pembelajaran_ids, mapel_id, created_at')
        .eq('id', materiId!)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!materiId,
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 2,
  });

  const { data: mapel, isLoading: mapelLoading } = useQuery({
    queryKey: ['mapel-detail', mapelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mapel')
        .select(`
          id, nama, kode_mapel, kategori, status, kelas_id,
          pengampu:profiles!mapel_pengampu_id_fkey(id, name)
        `)
        .eq('id', mapelId!)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!mapelId,
    staleTime: 30000, // Mapel data is more stable
  });

  // Check localStorage for read status
  useEffect(() => {
    if (mapelId && materiId) {
      const readStatus = localStorage.getItem(`materi_read_${mapelId}_${materiId}`);
      if (readStatus === 'true') {
        setIsRead(true);
      }
    }
  }, [mapelId, materiId]);

  // Debug: bantu lacak kenapa konten kosong saat first landing
  useEffect(() => {
    if (!materiId) return;
    // eslint-disable-next-line no-console
    console.log('[MateriDetail] state', {
      materiId,
      materiLoading,
      hasMateri: !!materi,
      kontenType: typeof materi?.konten,
      kontenIsArray: Array.isArray((materi as any)?.konten),
      kontenStringLen: typeof materi?.konten === 'string' ? materi.konten.length : null,
    });
  }, [materiId, materiLoading, materi]);

  // Handle error - redirect if materi not found
  useEffect(() => {
    if (materiError) {
      toast({
        title: "Error",
        description: "Gagal memuat materi",
        variant: "destructive"
      });
    }
  }, [materiError, toast]);

  // Redirect if materi not found after loading
  useEffect(() => {
    const handleNotFound = async () => {
      if (!materiLoading && !materi && materiId) {
        toast({
          title: "Error",
          description: "Materi tidak ditemukan",
          variant: "destructive"
        });
        const userRole = (await supabase.from('user_roles').select('role').eq('user_id', (await supabase.auth.getUser()).data.user?.id).single()).data?.role;
        navigate(userRole === 'santri' ? `/app/mapel/${mapelId}` : `/admin/mapel/${mapelId}`);
      }
    };
    handleNotFound();
  }, [materiLoading, materi, materiId, mapelId, navigate, toast]);

  // Parse konten dengan fallback:
  // - JSON array: [{ tipe/type, value }]
  // - String (HTML/plain): render sebagai 1 blok text
  const { kontenArray, rawKontenCount, parseFailed } = useMemo(() => {
    const normalizeArray = (arr: any[]) => {
      const normalized = arr
        .map((item: any) => {
          if (!item || typeof item !== 'object') return item;
          const tipe = item.tipe ?? item.type;
          return { ...item, tipe };
        })
        .filter((item: any) => {
          if (typeof item === 'string') return item.trim() !== '';
          const v = item?.value;
          if (typeof v === 'string') return v.trim() !== '';
          return v !== null && v !== undefined && v !== false;
        });

      return { kontenArray: normalized, rawKontenCount: arr.length, parseFailed: false };
    };

    const konten = materi?.konten;
    if (Array.isArray(konten)) return normalizeArray(konten);
    if (typeof konten === 'string') {
      const trimmed = konten.trim();
      if (!trimmed) return { kontenArray: [], rawKontenCount: 0, parseFailed: false };
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return normalizeArray(parsed);
        return { kontenArray: [{ tipe: 'text', value: trimmed }], rawKontenCount: 1, parseFailed: false };
      } catch {
        return { kontenArray: [{ tipe: 'text', value: trimmed }], rawKontenCount: 1, parseFailed: false };
      }
    }
    return { kontenArray: [], rawKontenCount: 0, parseFailed: false };
  }, [materi?.konten]);

  // UX: jika baru masuk halaman dan konten tiba-tiba kosong, auto-refetch 1x
  const hasAutoRefetched = useRef(false);
  useEffect(() => {
    if (hasAutoRefetched.current) return;
    if (materiLoading) return;
    if ((parseFailed || rawKontenCount > 0) && kontenArray.length === 0) {
      hasAutoRefetched.current = true;
      setTimeout(() => { refetchMateri(); }, 250);
    }
  }, [kontenArray.length, materiLoading, parseFailed, rawKontenCount, refetchMateri]);

  const loading = materiLoading || mapelLoading;

  if (loading) {
    return <MateriDetailSkeleton />;
  }

  if (!materi || !mapel) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Materi tidak ditemukan</p>
        <Button onClick={() => navigate(-1)} className="mt-4 rounded-xl">Kembali</Button>
      </div>
    );
  }

  const handleMarkAsRead = () => {
    localStorage.setItem(`materi_read_${mapelId}_${materiId}`, 'true');
    setIsRead(true);
    toast({
      title: "Materi sudah dibaca",
      description: "Status telah disimpan."
    });
  };

  const handleBack = async () => {
    const userRole = (await supabase.from('user_roles').select('role').eq('user_id', (await supabase.auth.getUser()).data.user?.id).single()).data?.role;
    navigate(userRole === 'santri' ? `/app/mapel/${mapelId}` : `/admin/mapel/${mapelId}`);
  };

  const formatDateSafe = (dateStr?: string | null) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return '-';
    try {
      return format(d, 'dd MMM yyyy', { locale: idLocale });
    } catch {
      return '-';
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl md:rounded-3xl bg-gradient-to-br from-primary via-primary to-primary/80 p-4 md:p-8 shadow-xl">
        <div className="absolute top-0 right-0 w-32 md:w-64 h-32 md:h-64 bg-primary-foreground/10 rounded-full blur-2xl md:blur-3xl -translate-y-16 md:-translate-y-32 translate-x-16 md:translate-x-32 pointer-events-none" />
        
        <div className="relative z-10 flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleBack}
            className="rounded-xl bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground border-0 h-8 w-8 shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          
          <div className="flex-1 min-w-0">
            <h1 className="text-lg md:text-xl font-semibold text-primary-foreground leading-snug line-clamp-1">
              {materi.judul}
            </h1>
            <div className="flex items-center gap-2 text-sm text-primary-foreground/80 mt-1">
              <span className="font-medium">{mapel.nama}</span>
              {materi.deskripsi && (
                <>
                  <span className="text-primary-foreground/50">•</span>
                  <span>{materi.deskripsi}</span>
                </>
              )}
              <span className="text-primary-foreground/50">•</span>
              <span>{(mapel.pengampu as any)?.profiles?.name || '-'}</span>
              <span className="text-primary-foreground/50">•</span>
              <span>{formatDateSafe(materi.created_at)}</span>
            </div>
          </div>
        </div>
      </div>


      {/* Konten Materi */}
      <div className="space-y-6">
        {kontenArray.length === 0 ? (
          <Card className="rounded-2xl border border-border/50 shadow-sm">
            <CardContent className="p-6">
              <p className="font-semibold">Konten belum tampil</p>
              <p className="text-sm text-muted-foreground mt-1">
                Jika baru saja ada perubahan, tekan muat ulang untuk mengambil data terbaru.
              </p>
              <div className="mt-4">
                <Button onClick={() => refetchMateri()} className="rounded-xl">
                  Muat Ulang Konten
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          kontenArray.map((item: any, index: number) => (
            <Card key={index} className="rounded-2xl border-0 shadow-md overflow-hidden">
            {item.tipe === 'text' && (
              <CardContent className="p-8">
                <div 
                  className="prose prose-lg max-w-none dark:prose-invert" 
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(item.value) }} 
                />
              </CardContent>
            )}

            {item.tipe === 'image' && (
              <CardContent className="p-0">
                <img 
                  src={getContentImageUrl(item.value)} 
                  alt={`Gambar ${index + 1}`} 
                  className="w-full h-auto object-cover" 
                  onError={(e) => {
                    e.currentTarget.src = '/placeholder.svg';
                  }} 
                />
              </CardContent>
            )}

            {item.tipe === 'video' && (
              <CardContent className="p-6">
                {(() => {
                  const videoId = extractYouTubeVideoId(item.value);
                  if (videoId) {
                    return <YouTubePlayer videoId={videoId} title={`Video Materi ${index + 1}`} />;
                  }
                  return (
                    <div className="aspect-video rounded-xl overflow-hidden bg-muted flex items-center justify-center">
                      <p className="text-muted-foreground">Video: {item.value}</p>
                    </div>
                  );
                })()}
              </CardContent>
            )}

            {item.tipe === 'link' && (
              <CardContent className="p-6 space-y-4">
                {(() => {
                  // Detect Canva link and convert to embed format
                  const isCanvaLink = item.value.includes('canva.com/design');
                  // Detect Google Drive link and convert to embed format
                  const isGoogleDriveLink = item.value.includes('drive.google.com');
                  
                  let embedUrl = item.value;
                  let linkLabel = 'Buka di Tab Baru';
                  
                  if (isCanvaLink) {
                    // Convert Canva edit/view link to embed format
                    const canvaMatch = item.value.match(/canva\.com\/design\/([^/]+)\/([^/?]+)/);
                    if (canvaMatch) {
                      embedUrl = `https://www.canva.com/design/${canvaMatch[1]}/${canvaMatch[2]}/view?embed`;
                    }
                    linkLabel = 'Buka di Canva';
                  } else if (isGoogleDriveLink) {
                    // Convert Google Drive link to preview/embed format
                    const fileIdMatch = item.value.match(/\/d\/([a-zA-Z0-9_-]+)/) || 
                                        item.value.match(/[?&]id=([a-zA-Z0-9_-]+)/);
                    if (fileIdMatch) {
                      embedUrl = `https://drive.google.com/file/d/${fileIdMatch[1]}/preview`;
                    }
                    linkLabel = 'Buka di Google Drive';
                  }
                  
                  return (
                    <>
                      {/* Preview Iframe */}
                      <div className="aspect-[4/3] rounded-xl overflow-hidden border border-border bg-muted">
                        <iframe 
                          src={embedUrl} 
                          title={`Sumber Belajar ${index + 1}`} 
                          className="w-full h-full" 
                          loading="lazy" 
                          allow="fullscreen" 
                          allowFullScreen 
                          style={{ border: 'none' }} 
                        />
                      </div>
                      
                      {/* Link Button */}
                      <a 
                        href={item.value} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="group inline-flex items-center gap-3 p-3 w-full bg-gradient-to-r from-primary/5 to-primary/10 hover:from-primary/10 hover:to-primary/15 rounded-xl transition-all duration-300 border border-primary/20"
                      >
                        <div className="p-2 rounded-lg bg-primary/10">
                          <ExternalLink className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-primary">
                            {linkLabel}
                          </p>
                        </div>
                      </a>
                    </>
                  );
                })()}
              </CardContent>
            )}
          </Card>
        ))
        )}
      </div>

      {/* Footer - Tandai Sudah Dibaca */}
      {user?.role === 'santri' && (
        <Card className="rounded-2xl border-0 shadow-md sticky bottom-6 bg-card/95 backdrop-blur-sm">
          <CardContent className="p-6">
            {isRead ? (
              <div className="flex items-center justify-center gap-3 text-green-600">
                <CheckCircle className="h-5 w-5" />
                <span className="font-semibold">Materi sudah dibaca</span>
              </div>
            ) : (
              <Button 
                onClick={handleMarkAsRead} 
                className="w-full rounded-xl shadow-md hover:shadow-lg transition-all duration-300" 
                size="lg"
              >
                <CheckCircle className="h-5 w-5 mr-2" />
                Tandai Sudah Dibaca
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
