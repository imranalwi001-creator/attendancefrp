import { useState, useEffect, useMemo } from 'react';
import { Search } from 'lucide-react';
import { FormDrawer } from '@/components/ui/form-drawer';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { JadwalInfoCard } from '@/components/jadwal/JadwalInfoCard';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

interface GuruPenggantiModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jadwal: any;
  selectedDate: string;
  onSuccess?: () => void;
}

export function GuruPenggantiModal({
  open,
  onOpenChange,
  jadwal,
  selectedDate,
  onSuccess
}: GuruPenggantiModalProps) {
  const { user } = useAuth();
  const [selectedGuru, setSelectedGuru] = useState<any>(null);
  const [alasan, setAlasan] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  
  // Reset state when drawer closes
  useEffect(() => {
    if (!open) {
      setSelectedGuru(null);
      setAlasan('');
    }
  }, [open]);
  
  // Fetch list of teachers from staff table (position = 'guru')
  const { data: guruList = [], isLoading: isLoadingGuru } = useQuery({
    queryKey: ['guru-pengganti-list', jadwal?.pengampu_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff')
        .select(`
          id,
          position,
          profiles!staff_id_fkey(id, name, avatar_url)
        `)
        .eq('position', 'guru');
      
      if (error) throw error;
      
      // Filter out the original teacher
      const filteredGuru = data
        ?.filter((item: any) => item.id !== jadwal?.pengampu_id && item.profiles)
        .map((item: any) => ({
          id: item.id,
          name: item.profiles.name,
          avatar_url: item.profiles.avatar_url,
          position: item.position
        })) || [];
      
      return filteredGuru;
    },
    enabled: open && !!jadwal
  });
  
  // Check if substitute already exists for this jadwal and date
  const { data: existingSubstitute } = useQuery({
    queryKey: ['existing-substitute', jadwal?.id, selectedDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('guru_pengganti')
        .select(`
          *,
          guru_pengganti_profile:guru_pengganti_id(id, profiles!staff_id_fkey(name))
        `)
        .eq('jadwal_id', jadwal.id)
        .eq('tanggal', selectedDate)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: open && !!jadwal?.id && !!selectedDate
  });

  // Display status for JadwalInfoCard
  const displayStatus = useMemo(() => {
    return {
      label: 'Belum dimulai',
      className: 'bg-muted text-muted-foreground'
    };
  }, []);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedGuru || !jadwal || !user) {
      toast.error('Pilih guru pengganti terlebih dahulu');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Insert into guru_pengganti table
      const { error: insertError } = await supabase
        .from('guru_pengganti')
        .insert({
          jadwal_id: jadwal.id,
          tanggal: selectedDate,
          guru_asli_id: jadwal.pengampu_id,
          guru_pengganti_id: selectedGuru.id,
          alasan: alasan || null,
          status: 'pending'
        })
        .select()
        .single();
      
      if (insertError) throw insertError;
      
      // Create in-app notification for the substitute teacher
      const tanggalFormatted = new Date(selectedDate).toLocaleDateString('id-ID', { 
        weekday: 'long', 
        day: 'numeric', 
        month: 'long' 
      });
      const notifTitle = 'Anda Ditunjuk sebagai Guru Pengganti';
      const notifMessage = `${jadwal.pengampu?.name || 'Guru'} meminta Anda menggantikan mengajar ${jadwal.mapel?.nama || 'Mata Pelajaran'} di kelas ${jadwal.kelas?.nama || 'Kelas'} pada ${tanggalFormatted}, jam ${jadwal.jam_mulai}-${jadwal.jam_selesai}`;
      
      try {
        await supabase
          .from('notifications')
          .insert({
            user_id: selectedGuru.id,
            title: notifTitle,
            message: notifMessage,
            is_read: false
          });
      } catch (notifError) {
        console.error('Failed to create in-app notification:', notifError);
      }
      
      // Trigger push notification to the substitute teacher
      try {
        await supabase.functions.invoke('trigger-push-notification', {
          body: {
            type: 'guru_pengganti',
            record: {
              guru_pengganti_user_id: selectedGuru.id,
              guru_pengganti_name: selectedGuru.name,
              guru_asli_name: jadwal.pengampu?.name || 'Guru',
              mapel_nama: jadwal.mapel?.nama || '-',
              kelas_nama: jadwal.kelas?.nama || '-',
              tanggal: selectedDate,
              jam_mulai: jadwal.jam_mulai,
              jam_selesai: jadwal.jam_selesai
            }
          }
        });
      } catch (pushError) {
        console.error('Failed to send push notification:', pushError);
      }
      
      toast.success(`${selectedGuru.name} telah ditunjuk sebagai guru pengganti`);
      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error assigning substitute:', error);
      if (error.code === '23505') {
        toast.error('Guru pengganti sudah ditentukan untuk jadwal ini pada tanggal yang sama');
      } else {
        toast.error('Gagal menentukan guru pengganti');
      }
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (!jadwal) return null;
  
  // If substitute already exists, show info without form
  if (existingSubstitute) {
    return (
      <FormDrawer
        open={open}
        onOpenChange={onOpenChange}
        title="Guru Pengganti"
        showFooter={false}
      >
        <div className="space-y-4">
          <JadwalInfoCard
            jadwal={jadwal}
            tanggal={selectedDate}
            displayStatus={displayStatus}
          />
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Guru pengganti sudah ditentukan untuk jadwal ini:
            </p>
            <p className="font-semibold mt-1">
              {(existingSubstitute.guru_pengganti_profile as any)?.profiles?.name || 'Guru Pengganti'}
            </p>
          </div>
        </div>
      </FormDrawer>
    );
  }
  
  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Tentukan Guru Pengganti"
      onSubmit={handleSubmit}
      submitLabel="Simpan"
      cancelLabel="Batal"
      loading={isSubmitting}
    >
      <div className="space-y-4">
        {/* Schedule Info - using JadwalInfoCard like KehadiranDetailModal */}
        <JadwalInfoCard
          jadwal={jadwal}
          tanggal={selectedDate}
          displayStatus={displayStatus}
        />
        
        {/* Guru Pengganti Selection */}
        <div className="space-y-2">
          <Label>Pilih Guru Pengganti</Label>
          <Popover open={commandOpen} onOpenChange={setCommandOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={commandOpen}
                className="w-full justify-between rounded-xl h-11"
              >
                {selectedGuru ? (
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={selectedGuru.avatar_url} />
                      <AvatarFallback className="text-xs">
                        {selectedGuru.name?.charAt(0) || 'G'}
                      </AvatarFallback>
                    </Avatar>
                    <span>{selectedGuru.name}</span>
                  </div>
                ) : (
                  <span className="text-muted-foreground">Cari guru pengganti...</span>
                )}
                <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[350px] p-0 z-[100] bg-popover" align="start">
              <Command>
                <CommandInput placeholder="Cari nama guru..." />
                <CommandList>
                  <CommandEmpty>
                    {isLoadingGuru ? 'Memuat...' : 'Tidak ada guru ditemukan'}
                  </CommandEmpty>
                  <CommandGroup>
                    {guruList.map((guru: any) => (
                      <CommandItem
                        key={guru.id}
                        value={guru.name}
                        onSelect={() => {
                          setSelectedGuru(guru);
                          setCommandOpen(false);
                        }}
                        className="cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={guru.avatar_url} />
                            <AvatarFallback>
                              {guru.name?.charAt(0) || 'G'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{guru.name}</p>
                            <p className="text-xs text-muted-foreground capitalize">
                              Guru
                            </p>
                          </div>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
        
        {/* Alasan (Optional) */}
        <div className="space-y-2">
          <Label>Alasan (Opsional)</Label>
          <Textarea
            placeholder="Contoh: Berhalangan hadir karena sakit"
            value={alasan}
            onChange={(e) => setAlasan(e.target.value)}
            className="rounded-xl resize-none"
            rows={2}
          />
        </div>
      </div>
    </FormDrawer>
  );
}
