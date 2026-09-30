import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';

export function RaportMenuSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <Skeleton className="h-8 w-48" />
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i} className="p-6">
            <Skeleton className="h-12 w-12 rounded-xl mb-4" />
            <Skeleton className="h-6 w-24 mb-2" />
            <Skeleton className="h-4 w-32" />
          </Card>
        ))}
      </div>
    </div>
  );
}
