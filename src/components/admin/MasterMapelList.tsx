import { useState, useMemo } from 'react';
import { BookOpen, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DetailButton, DeleteButton, ActionButtonGroup } from '@/components/ui/action-buttons';
import type { MasterMapel } from './MasterMapelForm';

interface MasterMapelListProps {
  items: MasterMapel[];
  isLoading: boolean;
  onEdit: (item: MasterMapel) => void;
  onDelete: (item: MasterMapel) => void;
}

const KATEGORI_BADGE_VARIANTS: Record<MasterMapel['kategori'], { variant: 'default' | 'secondary' | 'outline' | 'destructive' | 'warning', label: string }> = {
  wajib: { variant: 'default', label: 'Wajib' },
  pilihan: { variant: 'secondary', label: 'Pilihan' },
  ekstrakurikuler: { variant: 'warning', label: 'Ekstrakurikuler' },
  asrama: { variant: 'destructive', label: 'Asrama' },
};

const KATEGORI_OPTIONS = [
  { value: 'all', label: 'Semua Kategori' },
  { value: 'wajib', label: 'Wajib' },
  { value: 'pilihan', label: 'Pilihan' },
  { value: 'ekstrakurikuler', label: 'Ekstrakurikuler' },
  { value: 'asrama', label: 'Asrama' },
];

export default function MasterMapelList({
  items,
  isLoading,
  onEdit,
  onDelete,
}: MasterMapelListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKategori, setSelectedKategori] = useState('all');

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch = !searchQuery.trim() || 
        item.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.deskripsi?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesKategori = selectedKategori === 'all' || item.kategori === selectedKategori;
      
      return matchesSearch && matchesKategori;
    });
  }, [items, searchQuery, selectedKategori]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center justify-between p-4 rounded-xl border-2 border-border/50 bg-card">
            <div className="flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <Skeleton className="h-9 w-9 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <BookOpen className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-1">
          Belum ada data mata pelajaran
        </h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Tambahkan mata pelajaran master untuk digunakan sebagai referensi saat membuat mata pelajaran kelas.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari mata pelajaran..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={selectedKategori} onValueChange={setSelectedKategori}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Pilih kategori" />
          </SelectTrigger>
          <SelectContent>
            {KATEGORI_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {filteredItems.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-border/50 bg-card p-6 text-center">
          <p className="text-muted-foreground">
            {searchQuery || selectedKategori !== 'all' 
              ? 'Tidak ada hasil yang sesuai dengan filter' 
              : 'Belum ada data mata pelajaran'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => {
            const badgeConfig = KATEGORI_BADGE_VARIANTS[item.kategori];
            return (
              <div
                key={item.id}
                className="flex items-center justify-between gap-4 p-4 rounded-xl border-2 border-border/50 bg-card hover:bg-muted/30 transition-all duration-200"
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div
                    className="rounded-lg p-2 shrink-0"
                    style={{ backgroundColor: '#E7F6F8' }}
                  >
                    <BookOpen className="h-5 w-5" style={{ color: '#2EAABF' }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-foreground truncate">{item.nama}</h3>
                    <p className="text-sm text-muted-foreground hidden md:block truncate">
                      {item.deskripsi || 'Tidak ada deskripsi'}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 text-left w-32 hidden sm:block">
                  <Badge variant={badgeConfig.variant}>
                    {badgeConfig.label}
                  </Badge>
                </div>

                <ActionButtonGroup>
                  <DetailButton onClick={() => onEdit(item)} />
                  <DeleteButton onClick={() => onDelete(item)} />
                </ActionButtonGroup>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
