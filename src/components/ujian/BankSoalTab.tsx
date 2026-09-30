import { useState, useCallback, useMemo } from 'react';
import { Sparkles, FileQuestion, Plus, WandSparkles, BookOpenCheck, Layers3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useBankSoalList, useDeleteBankSoal, useBulkDeleteBankSoal, type BankSoalFilter, type BankSoalItem } from '@/hooks/useBankSoal';
import { BankSoalFilters, BankSoalGroupCard, BankSoalDetailSheet, GenerateSoalDrawer } from './bank-soal';
import { useAuth } from '@/contexts/AuthContext';

interface BuatSoalTabProps {
  selectedUjianId?: string;
  currentSoalCount?: number;
  filterByCurrentUser?: boolean; // Jika true, filter berdasarkan guru yang login
}

interface SoalGroup {
  mata_pelajaran: string;
  kelas: string;
  items: BankSoalItem[];
}

export default function BuatSoalTab({ selectedUjianId, currentSoalCount = 0, filterByCurrentUser = false }: BuatSoalTabProps) {
  const { user } = useAuth();
  const [filters, setFilters] = useState<BankSoalFilter>({});
  const [selectedSoal, setSelectedSoal] = useState<BankSoalItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteGroupIds, setDeleteGroupIds] = useState<string[] | null>(null);

  // Combine filters with createdBy filter if filterByCurrentUser is true
  const appliedFilters: BankSoalFilter = {
    ...filters,
    createdBy: filterByCurrentUser ? user?.id : undefined,
  };

  const { data: soalList, isLoading, refetch } = useBankSoalList(appliedFilters);
  const deleteMutation = useDeleteBankSoal();
  const bulkDeleteMutation = useBulkDeleteBankSoal();

  // Group soal by mata_pelajaran + kelas
  const groupedSoal = useMemo<SoalGroup[]>(() => {
    if (!soalList) return [];

    const groups: Record<string, SoalGroup> = {};

    soalList.forEach((soal) => {
      const key = `${soal.mata_pelajaran}-${soal.kelas}`;
      if (!groups[key]) {
        groups[key] = {
          mata_pelajaran: soal.mata_pelajaran,
          kelas: soal.kelas,
          items: [],
        };
      }
      groups[key].items.push(soal);
    });

    return Object.values(groups);
  }, [soalList]);

  const handleViewDetail = useCallback((soal: BankSoalItem) => {
    setSelectedSoal(soal);
    setDetailOpen(true);
  }, []);

  const handleDeleteClick = useCallback((id: string) => {
    setDeleteId(id);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (deleteId) {
      deleteMutation.mutate(deleteId);
      setDeleteId(null);
    }
  }, [deleteId, deleteMutation]);

  const handleDeleteGroupClick = useCallback((ids: string[]) => {
    setDeleteGroupIds(ids);
  }, []);

  const handleConfirmDeleteGroup = useCallback(() => {
    if (deleteGroupIds) {
      bulkDeleteMutation.mutate(deleteGroupIds);
      setDeleteGroupIds(null);
    }
  }, [deleteGroupIds, bulkDeleteMutation]);

  const handleDrawerSuccess = useCallback(() => {
    refetch();
  }, [refetch]);

  return (
    <Card className="border rounded-2xl">
      <CardHeader className="pb-4">
        <div className="mb-4 rounded-2xl border border-primary/20 bg-[radial-gradient(circle_at_top_left,rgba(13,148,136,0.14),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.10),transparent_36%)] p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-background/80 px-3 py-1 text-xs font-medium text-primary">
                <WandSparkles className="h-3.5 w-3.5" />
                RuangBlajar Question Studio
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">Generator soal AI untuk workflow guru</h3>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Susun draft soal, cek distribusi level kognitif, lalu simpan ke Bank Soal untuk dipakai ulang
                  pada quiz, ujian, remedial, atau evaluasi harian.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="gap-1.5">
                  <BookOpenCheck className="h-3.5 w-3.5" />
                  Draft siap tinjau
                </Badge>
                <Badge variant="secondary" className="gap-1.5">
                  <Layers3 className="h-3.5 w-3.5" />
                  Tersimpan per mapel dan kelas
                </Badge>
                <Badge variant="secondary" className="gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" />
                  Kunci dan pembahasan otomatis
                </Badge>
              </div>
            </div>

            <Button onClick={() => setDrawerOpen(true)} className="gap-2 self-start lg:self-center">
              <Sparkles className="h-4 w-4" />
              Buka AI Question Studio
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <BankSoalFilters filters={filters} onFilterChange={setFilters} />
          <Button onClick={() => setDrawerOpen(true)} className="gap-2 shrink-0">
            <Sparkles className="h-4 w-4" />
            Generate dengan AI
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">

        {/* List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-start gap-4 p-4 border rounded-lg">
                <Skeleton className="w-10 h-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : groupedSoal.length > 0 ? (
          <div className="space-y-4">
            {groupedSoal.map((group) => (
              <BankSoalGroupCard
                key={`${group.mata_pelajaran}-${group.kelas}`}
                mataPelajaran={group.mata_pelajaran}
                kelas={group.kelas}
                soalList={group.items}
                onViewSoal={handleViewDetail}
                onDeleteSoal={handleDeleteClick}
                onDeleteGroup={handleDeleteGroupClick}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <FileQuestion className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-medium mb-1">Belum Ada Soal</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Bank Soal masih kosong. Generate soal baru dengan AI untuk memulai.
            </p>
            <Button onClick={() => setDrawerOpen(true)} variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              Generate Soal Pertama
            </Button>
          </div>
        )}
      </CardContent>

      {/* Detail Sheet */}
      <BankSoalDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        soal={selectedSoal}
        onDelete={(id) => {
          deleteMutation.mutate(id);
          setDetailOpen(false);
        }}
      />

      {/* Generate Drawer */}
      <GenerateSoalDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onSuccess={handleDrawerSuccess}
        mode="bank-soal"
        contextTitle="AI Question Studio"
        contextDescription="Bangun paket soal guru yang rapi, seimbang, dan siap masuk ke Bank Soal."
      />

      {/* Delete Single Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Soal?</AlertDialogTitle>
            <AlertDialogDescription>
              Soal ini akan dihapus permanen dari Bank Soal dan tidak dapat dikembalikan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Group Confirmation */}
      <AlertDialog open={!!deleteGroupIds} onOpenChange={(open) => !open && setDeleteGroupIds(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Semua Soal dalam Grup?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteGroupIds?.length} soal dalam grup ini akan dihapus permanen dari Bank Soal dan tidak dapat dikembalikan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteGroup}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Hapus Semua
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
