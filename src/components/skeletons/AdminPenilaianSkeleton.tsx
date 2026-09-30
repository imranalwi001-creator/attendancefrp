import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function AdminPenilaianSkeleton() {
  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-background border border-border/50 p-6">
        <Skeleton className="h-8 w-36 mb-2" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i} className="rounded-2xl">
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-5 w-32" />
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div>
                <Skeleton className="h-3 w-16 mb-1" />
                <Skeleton className="h-5 w-36" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Skeleton className="h-3 w-20 mb-1" />
                  <Skeleton className="h-5 w-8" />
                </div>
                <div>
                  <Skeleton className="h-3 w-20 mb-1" />
                  <Skeleton className="h-5 w-8" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
