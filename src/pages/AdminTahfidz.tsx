import { BookMarked } from 'lucide-react';

export default function AdminTahfidz() {
  return (
    <div className="container mx-auto py-12 flex flex-col items-center justify-center gap-4 text-center">
      <div className="p-4 rounded-2xl bg-primary/10">
        <BookMarked className="h-12 w-12 text-primary" />
      </div>
      <h1 className="text-2xl font-bold">Tahfidz</h1>
      <p className="text-muted-foreground max-w-md">
        Halaman manajemen Tahfidz sedang dalam pengembangan. Fitur ini akan segera tersedia.
      </p>
    </div>
  );
}
