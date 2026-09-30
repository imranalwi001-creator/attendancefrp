import { StatCard } from '@/components/ui/stat-card';
import { BookOpen, BookMarked, AlertTriangle, Layers } from 'lucide-react';

interface Props {
  totalBuku: number;
  dipinjam: number;
  terlambat: number;
  kategori: number;
}

export function PerpustakaanStats({ totalBuku, dipinjam, terlambat, kategori }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatCard title="Total Buku" value={totalBuku} icon={BookOpen} variant="default" />
      <StatCard title="Sedang Dipinjam" value={dipinjam} icon={BookMarked} variant="warning" animationDelay={50} />
      <StatCard title="Terlambat" value={terlambat} icon={AlertTriangle} variant="destructive" animationDelay={100} />
      <StatCard title="Kategori" value={kategori} icon={Layers} variant="success" animationDelay={150} />
    </div>
  );
}
