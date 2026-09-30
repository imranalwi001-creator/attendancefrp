import { Card, CardContent } from '@/components/ui/card';
import { Calendar, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAcademicYear } from '@/contexts/AcademicYearContext';
interface AcademicYearCardProps {
  showSettingsLink?: boolean;
}
export function AcademicYearCard({
  showSettingsLink = true
}: AcademicYearCardProps) {
  const {
    activeAcademicYear,
    getCurrentSemester,
    isLoading
  } = useAcademicYear();
  const currentSemester = getCurrentSemester();
  const getSemesterLabel = () => {
    if (currentSemester === 'ganjil') return 'Ganjil';
    if (currentSemester === 'genap') return 'Genap';
    return '-';
  };
  return <Card className="border border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
      <CardContent className="flex items-center justify-between gap-3 py-3 px-4">
        <div className="flex items-center gap-3">
          <div className="bg-primary/15 p-2 rounded-lg">
            <Calendar className="h-5 w-5 text-primary" />
          </div>
          {isLoading ? <div className="h-5 w-48 bg-muted animate-pulse rounded" /> : activeAcademicYear ? <span className="text-sm font-medium text-primary">
              Tahun Ajaran <span className="font-semibold">{activeAcademicYear.name}</span>, Semester <span className="font-semibold">{getSemesterLabel()}</span>
            </span> : <span className="text-sm text-muted-foreground">Belum ada tahun ajaran aktif</span>}
        </div>
        {showSettingsLink && <Link to="/admin/settings" className="p-2 rounded-lg hover:bg-primary/10 transition-colors">
            <ArrowRight className="h-4 w-4 transition-colors text-green-600" />
          </Link>}
      </CardContent>
    </Card>;
}