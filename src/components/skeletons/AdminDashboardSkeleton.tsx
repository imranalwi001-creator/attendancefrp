import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function AdminDashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-br from-primary via-primary to-primary/80 p-6">
        <Skeleton className="h-8 w-64 mb-2 bg-primary-foreground/20" />
        <Skeleton className="h-4 w-80 bg-primary-foreground/20" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-1" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
