import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function RaportSkeleton() {
  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-background border border-border/50 p-6">
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-1/3" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
              <Skeleton className="h-4 w-8" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
