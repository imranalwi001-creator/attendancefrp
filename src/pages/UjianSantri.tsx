import { useState, useEffect } from 'react'; // v2
import { useNavigate, useLocation } from 'react-router-dom';
import { FileQuestion, Search } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import PageHeader from '@/components/layout/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import { ExamCard, ExamInstructionsDialog, UjianHasilSheet } from '@/components/ujian-santri';
import { useUjianForSantri, useStartExam, type UjianForSantri } from '@/hooks/useUjianSantri';

export default function UjianSantri() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useState('');
  const [selectedUjian, setSelectedUjian] = useState<UjianForSantri | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [showResultSheet, setShowResultSheet] = useState(false);
  const [resultUjianId, setResultUjianId] = useState<string | null>(null);

  // Handle navigation state for showing result sheet
  useEffect(() => {
    const state = location.state as { showResultUjianId?: string } | null;
    if (state?.showResultUjianId) {
      setResultUjianId(state.showResultUjianId);
      setShowResultSheet(true);
      // Clear the state to prevent reopening on navigation
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate]);

  const { data: ujianList, isLoading } = useUjianForSantri(user?.id);
  const startExam = useStartExam();

  const filteredUjian = (ujianList || []).filter(u =>
    u.mapel?.nama.toLowerCase().includes(search.toLowerCase()) ||
    u.mapel?.kelas?.nama.toLowerCase().includes(search.toLowerCase())
  );

  const handleStartClick = (ujian: UjianForSantri) => {
    setSelectedUjian(ujian);
    setShowInstructions(true);
  };

  const handleStartExam = async () => {
    if (!selectedUjian?.peserta_id) return;
    
    try {
      await startExam.mutateAsync({ pesertaId: selectedUjian.peserta_id });
      setShowInstructions(false);
      navigate(`/app/ujian/${selectedUjian.id}/kerjakan`);
    } catch (error) {
      console.error('Failed to start exam:', error);
    }
  };

  const handleViewResult = (ujian: UjianForSantri) => {
    setResultUjianId(ujian.id);
    setShowResultSheet(true);
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader title="Ujian" />

      {/* Container */}
      <Card className="rounded-2xl border shadow-sm">
        <CardContent className="p-4 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari ujian..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 rounded-xl"
            />
          </div>

          {/* Loading */}
          {isLoading && (
            <>
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </>
          )}

          {/* Empty State */}
          {!isLoading && filteredUjian.length === 0 && (
            <div className="py-12">
              <div className="flex flex-col items-center justify-center text-center">
                <FileQuestion className="h-16 w-16 text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-semibold text-muted-foreground">Belum Ada Ujian</h3>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  {search ? 'Tidak ditemukan ujian yang sesuai' : 'Belum ada ujian yang tersedia untuk kamu'}
                </p>
              </div>
            </div>
          )}

          {/* Exam List */}
          {!isLoading && filteredUjian.length > 0 && (
            <>
              {filteredUjian.map((ujian) => (
                <ExamCard
                  key={ujian.id}
                  ujian={ujian}
                  onStart={() => handleStartClick(ujian)}
                  onViewResult={() => handleViewResult(ujian)}
                />
              ))}
            </>
          )}
        </CardContent>
      </Card>

      {/* Instructions Dialog */}
      {selectedUjian && (
        <ExamInstructionsDialog
          open={showInstructions}
          onOpenChange={setShowInstructions}
          ujian={selectedUjian}
          onStart={handleStartExam}
          loading={startExam.isPending}
        />
      )}

      {/* Result Sheet */}
      <UjianHasilSheet
        open={showResultSheet}
        onOpenChange={setShowResultSheet}
        ujianId={resultUjianId}
      />
    </div>
  );
}
