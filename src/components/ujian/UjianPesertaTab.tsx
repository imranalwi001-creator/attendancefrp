import { useState, useEffect, useMemo } from 'react';
import { Users, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { UjianPeserta } from '@/hooks/useUjian';

interface UjianPesertaTabProps {
  ujianId: string;
  kelasId?: string;
  pesertaList: UjianPeserta[];
  selectedIds: Set<string>;
  onSelectedIdsChange: (ids: Set<string>) => void;
  disabled?: boolean;
}

interface SantriData {
  id: string;
  nis: string;
  profile: {
    id: string;
    name: string;
    avatar_url: string | null;
  };
}

export function UjianPesertaTab({
  ujianId,
  kelasId: initialKelasId,
  pesertaList,
  selectedIds,
  onSelectedIdsChange,
  disabled = false,
}: UjianPesertaTabProps) {
  const [selectedKelasId, setSelectedKelasId] = useState(initialKelasId || '');
  const [searchQuery, setSearchQuery] = useState('');

  // Initialize selected santri from existing peserta on mount
  useEffect(() => {
    if (pesertaList.length > 0 && selectedIds.size === 0) {
      const existingIds = new Set(pesertaList.map((p) => p.santri_id));
      onSelectedIdsChange(existingIds);
    }
  }, [pesertaList]);

  // Update kelas selection when initialKelasId changes
  useEffect(() => {
    if (initialKelasId && !selectedKelasId) {
      setSelectedKelasId(initialKelasId);
    }
  }, [initialKelasId]);

  // Fetch kelas list
  const { data: kelasList } = useQuery({
    queryKey: ['kelas-for-ujian-peserta'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kelas')
        .select('id, nama, tingkat')
        .eq('status', 'aktif');

      if (error) throw error;
      return data;
    },
  });

  // Fetch santri list based on selected kelas
  const { data: santriList, isLoading: santriLoading } = useQuery({
    queryKey: ['santri-for-ujian', selectedKelasId],
    queryFn: async (): Promise<SantriData[]> => {
      if (!selectedKelasId) return [];

      const { data: santriData, error } = await supabase
        .from('santri')
        .select('id, nis')
        .eq('kelas_id', selectedKelasId);

      if (error) throw error;
      if (!santriData || santriData.length === 0) return [];
      
      const ids = (santriData as { id: string; nis: string }[]).map(s => s.id);
      const { data: profiles } = await supabase.from('profiles').select('id, name, avatar_url').in('id', ids);
      
      return (santriData as { id: string; nis: string }[]).map(s => ({
        id: s.id,
        nis: s.nis,
        profile: (profiles as { id: string; name: string; avatar_url: string | null }[] | null)?.find(p => p.id === s.id) || { id: s.id, name: 'Unknown', avatar_url: null }
      }));
    },
    enabled: !!selectedKelasId,
  });

  // Filter santri based on search
  const filteredSantri = useMemo(() => {
    if (!santriList) return [];
    if (!searchQuery) return santriList;

    const query = searchQuery.toLowerCase();
    return santriList.filter(
      (s) =>
        s.profile?.name?.toLowerCase().includes(query) ||
        s.nis?.toLowerCase().includes(query)
    );
  }, [santriList, searchQuery]);

  const handleToggleSantri = (santriId: string) => {
    if (disabled) return;
    const next = new Set(selectedIds);
    if (next.has(santriId)) {
      next.delete(santriId);
    } else {
      next.add(santriId);
    }
    onSelectedIdsChange(next);
  };

  const handleToggleAll = () => {
    if (disabled) return;
    if (!filteredSantri) return;

    const allIds = filteredSantri.map((s) => s.id);
    const allSelected = allIds.every((id) => selectedIds.has(id));

    const next = new Set(selectedIds);
    if (allSelected) {
      // Deselect all
      allIds.forEach((id) => next.delete(id));
    } else {
      // Select all
      allIds.forEach((id) => next.add(id));
    }
    onSelectedIdsChange(next);
  };

  const isAllSelected =
    filteredSantri.length > 0 &&
    filteredSantri.every((s) => selectedIds.has(s.id));

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-6">
      {/* Filter Area */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground/70">
            Kelas *
          </Label>
          <Select value={selectedKelasId} onValueChange={setSelectedKelasId} disabled={disabled}>
            <SelectTrigger className="text-sm" disabled={disabled}>
              <SelectValue placeholder="Pilih kelas" />
            </SelectTrigger>
            <SelectContent>
              {kelasList?.map((kelas) => (
                <SelectItem key={kelas.id} value={kelas.id} className="text-sm">
                  {kelas.tingkat} {kelas.nama}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Search */}
        {selectedKelasId && (
          <div className="space-y-2">
            <Label className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground/70">
              Cari Santri
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari berdasarkan nama atau NIS..."
                className="pl-10 text-sm"
                disabled={disabled}
              />
            </div>
          </div>
        )}
      </div>

      {/* Santri Table */}
      {!selectedKelasId ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground">Pilih Kelas</h3>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Pilih kelas untuk menampilkan daftar santri
            </p>
          </CardContent>
        </Card>
      ) : santriLoading ? (
        <div className="text-center py-12 text-muted-foreground">Memuat data santri...</div>
      ) : filteredSantri.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground">Tidak ada santri</h3>
            <p className="text-sm text-muted-foreground/70 mt-1">
              {searchQuery ? 'Tidak ditemukan santri dengan kriteria pencarian' : 'Tidak ada santri di kelas ini'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-12">
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={handleToggleAll}
                    aria-label="Pilih semua"
                    disabled={disabled}
                  />
                </TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider font-medium">
                  Nama Santri
                </TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider font-medium">
                  NIS
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSantri.map((santri) => (
                <TableRow
                  key={santri.id}
                  className={disabled ? '' : 'cursor-pointer hover:bg-muted/30'}
                  onClick={() => !disabled && handleToggleSantri(santri.id)}
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(santri.id)}
                      onCheckedChange={() => handleToggleSantri(santri.id)}
                      onClick={(e) => e.stopPropagation()}
                      disabled={disabled}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={santri.profile?.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {getInitials(santri.profile?.name || 'NA')}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">{santri.profile?.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{santri.nis}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Summary */}
      <div className="text-sm text-muted-foreground pt-4 border-t">
        <span className="font-medium text-foreground">{selectedIds.size}</span> santri terpilih
      </div>
    </div>
  );
}

export default UjianPesertaTab;
