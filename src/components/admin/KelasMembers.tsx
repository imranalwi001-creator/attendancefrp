import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Search, UserPlus, UserMinus, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface KelasMembersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kelasId: string;
  currentSantriIds: string[];
  onUpdateMembers: () => void;
}

export default function KelasMembers({
  open,
  onOpenChange,
  kelasId,
  currentSantriIds,
  onUpdateMembers
}: KelasMembersProps) {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch all santri (with role santri) - optimized with explicit columns
  const { data: allSantri = [], isLoading } = useQuery({
    queryKey: ['all-santri-for-kelas'],
    queryFn: async () => {
      // Get all users with santri role
      const { data: santriRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'santri')
        .limit(500);
      
      if (rolesError) throw rolesError;
      
      const santriUserIds = santriRoles.map(r => r.user_id);
      
      if (santriUserIds.length === 0) return [];
      
      // Get profiles for these users - explicit columns only
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, email, status')
        .in('id', santriUserIds);
      
      if (profilesError) throw profilesError;
      
      // Get santri data to check current kelas
      const { data: santriData, error: santriError } = await supabase
        .from('santri')
        .select('id, kelas_id')
        .in('id', santriUserIds);
      
      if (santriError) throw santriError;
      
      // Combine data
      return profiles.map(profile => {
        const santri = santriData.find(s => s.id === profile.id);
        return {
          ...profile,
          kelas_id: santri?.kelas_id || null
        };
      });
    },
    enabled: open,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false
  });

  // Filter santri based on search
  const filteredSantri = useMemo(() => {
    return allSantri.filter(santri => 
      santri.name?.toLowerCase().includes(search.toLowerCase()) ||
      santri.email?.toLowerCase().includes(search.toLowerCase())
    );
  }, [allSantri, search]);

  // Initialize selected IDs when dialog opens
  useState(() => {
    if (open) {
      setSelectedIds(currentSantriIds);
    }
  });

  const handleToggle = (santriId: string) => {
    setSelectedIds(prev => 
      prev.includes(santriId)
        ? prev.filter(id => id !== santriId)
        : [...prev, santriId]
    );
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      // Santri to add to this kelas
      const toAdd = selectedIds.filter(id => !currentSantriIds.includes(id));
      // Santri to remove from this kelas
      const toRemove = currentSantriIds.filter(id => !selectedIds.includes(id));

      // Update santri that should be added
      for (const santriId of toAdd) {
        const { error } = await supabase
          .from('santri')
          .update({ kelas_id: kelasId })
          .eq('id', santriId);
        
        if (error) throw error;
      }

      // Update santri that should be removed
      for (const santriId of toRemove) {
        const { error } = await supabase
          .from('santri')
          .update({ kelas_id: null })
          .eq('id', santriId);
        
        if (error) throw error;
      }

      toast({
        title: "Berhasil",
        description: "Anggota kelas berhasil diperbarui",
      });
      
      onUpdateMembers();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating members:', error);
      toast({
        title: "Error",
        description: "Gagal memperbarui anggota kelas",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const addedCount = selectedIds.filter(id => !currentSantriIds.includes(id)).length;
  const removedCount = currentSantriIds.filter(id => !selectedIds.includes(id)).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Kelola Anggota Kelas</DialogTitle>
          <DialogDescription>
            Pilih santri yang akan menjadi anggota kelas ini
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari santri..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 rounded-xl"
            />
          </div>

          {/* Summary */}
          <div className="flex items-center gap-4 text-sm">
            <span className="text-muted-foreground">
              Dipilih: <span className="font-semibold text-foreground">{selectedIds.length}</span>
            </span>
            {addedCount > 0 && (
              <Badge variant="default" className="gap-1">
                <UserPlus className="h-3 w-3" />
                +{addedCount} ditambahkan
              </Badge>
            )}
            {removedCount > 0 && (
              <Badge variant="destructive" className="gap-1">
                <UserMinus className="h-3 w-3" />
                -{removedCount} dihapus
              </Badge>
            )}
          </div>

          {/* Santri List */}
          <ScrollArea className="h-[400px] rounded-xl border p-4">
            {isLoading ? (
              <div className="space-y-3 py-4">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="flex items-center gap-4 p-3 rounded-xl border">
                    <Skeleton className="h-5 w-5 rounded" />
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredSantri.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {search ? 'Tidak ada santri yang cocok' : 'Tidak ada santri tersedia'}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredSantri.map(santri => {
                  const isSelected = selectedIds.includes(santri.id);
                  const isInOtherClass = santri.kelas_id && santri.kelas_id !== kelasId;
                  
                  return (
                    <div
                      key={santri.id}
                      className={`flex items-center gap-4 p-3 rounded-xl border transition-colors cursor-pointer ${
                        isSelected 
                          ? 'bg-primary/10 border-primary/30' 
                          : 'hover:bg-muted/50 border-border'
                      }`}
                      onClick={() => handleToggle(santri.id)}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => handleToggle(santri.id)}
                      />
                      <div className="flex-1">
                        <p className="font-medium">{santri.name}</p>
                        <p className="text-sm text-muted-foreground">{santri.email || '-'}</p>
                      </div>
                      {isInOtherClass && (
                        <Badge variant="outline" className="text-xs">
                          Sudah di kelas lain
                        </Badge>
                      )}
                      {currentSantriIds.includes(santri.id) && (
                        <Badge variant="secondary" className="text-xs">
                          Anggota
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="rounded-xl"
            >
              Batal
            </Button>
            <Button 
              onClick={handleSave}
              disabled={isSubmitting}
              className="rounded-xl"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Simpan Perubahan
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
