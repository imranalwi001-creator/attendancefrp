import { useState } from 'react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Share2, ClipboardList, Calendar, Clock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useForumPosts } from '@/hooks/useForumPosts';
import { formatDurasi, getJenisUjianLabel } from '@/lib/ujianUtils';
import { useToast } from '@/hooks/use-toast';

interface UjianData {
  id: string;
  jenis: string;
  tanggal_pelaksanaan: string;
  durasi_menit: number | null;
  status: string;
  mapel?: {
    id: string;
    nama: string;
    kelas?: {
      nama: string;
      tingkat: string;
    };
  };
}

interface ShareToForumModalProps {
  ujian: UjianData | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ShareToForumModal({ ujian, isOpen, onClose }: ShareToForumModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedMapelId, setSelectedMapelId] = useState<string>('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch mapel list that the teacher is assigned to (pengampu)
  const { data: mapelList = [] } = useQuery({
    queryKey: ['mapel-for-share', user?.id],
    queryFn: async () => {
      // First get the staff id for current user
      const { data: staffData } = await supabase
        .from('staff')
        .select('id')
        .eq('id', user?.id)
        .single();

      const { data, error } = await supabase
        .from('mapel')
        .select(`
          id,
          nama,
          kelas:kelas_id (
            id,
            nama,
            tingkat
          )
        `)
        .eq('pengampu_id', staffData?.id || user?.id)
        .order('nama');

      if (error) throw error;
      return data;
    },
    enabled: isOpen && !!user?.id,
  });

  // Use forum posts hook with the selected mapel
  const { createPost } = useForumPosts(selectedMapelId);

  const handleShare = async () => {
    if (!ujian || !selectedMapelId || !user?.id) return;

    setIsSubmitting(true);
    try {
      const content = message.trim() || `📋 Informasi Ujian: ${getJenisUjianLabel(ujian.jenis as any)} - ${ujian.mapel?.nama}`;

      await createPost.mutateAsync({
        content,
        post_type: 'announcement',
        user_id: user.id,
        ujian_id: ujian.id,
      });

      toast({
        title: 'Berhasil',
        description: 'Ujian berhasil dibagikan ke forum mata pelajaran',
      });

      handleClose();
    } catch (error: any) {
      toast({
        title: 'Gagal',
        description: error.message || 'Gagal membagikan ujian ke forum',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedMapelId('');
    setMessage('');
    onClose();
  };

  if (!ujian) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-primary" />
            Bagikan ke Forum
          </DialogTitle>
          <DialogDescription>
            Bagikan informasi ujian ke forum mata pelajaran
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Mapel Selection */}
          <div className="space-y-2">
            <Label htmlFor="mapel-select">Pilih Mata Pelajaran Tujuan</Label>
            <Select value={selectedMapelId} onValueChange={setSelectedMapelId}>
              <SelectTrigger id="mapel-select" className="w-full">
                <SelectValue placeholder="Pilih mata pelajaran..." />
              </SelectTrigger>
              <SelectContent>
                {mapelList.map((mapel: any) => (
                  <SelectItem key={mapel.id} value={mapel.id}>
                    {mapel.nama} - {mapel.kelas?.tingkat} {mapel.kelas?.nama}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Ujian Preview Card */}
          <div className="space-y-2">
            <Label>Preview Ujian</Label>
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-3">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shrink-0">
                    <ClipboardList className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">
                        {getJenisUjianLabel(ujian.jenis as any)}
                      </p>
                      <Badge variant="secondary" className="text-xs">
                        {ujian.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {ujian.mapel?.nama}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(ujian.tanggal_pelaksanaan), 'dd MMM yyyy', { locale: localeId })}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDurasi(ujian.durasi_menit)}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label htmlFor="message">Pesan (opsional)</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tambahkan pesan untuk santri..."
              rows={3}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Batal
          </Button>
          <Button
            onClick={handleShare}
            disabled={!selectedMapelId || isSubmitting}
            className="gap-2"
          >
            <Share2 className="h-4 w-4" />
            {isSubmitting ? 'Membagikan...' : 'Bagikan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
