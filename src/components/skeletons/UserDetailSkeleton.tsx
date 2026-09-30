import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function UserDetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-primary/80 p-8 shadow-xl">
        <div className="flex items-start gap-4">
          <Skeleton className="h-10 w-10 rounded-xl bg-primary-foreground/20" />
          <div className="flex-1">
            <div className="flex items-start gap-4 mb-4">
              <Skeleton className="h-20 w-20 rounded-full bg-primary-foreground/20" />
              <div className="flex-1 space-y-3">
                <Skeleton className="h-8 w-64 bg-primary-foreground/20" />
                <Skeleton className="h-6 w-24 bg-primary-foreground/20" />
              </div>
              <div className="flex gap-3">
                <Skeleton className="h-10 w-24 rounded-xl bg-primary-foreground/20" />
                <Skeleton className="h-10 w-10 rounded-xl bg-primary-foreground/20" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Skeleton */}
      <Skeleton className="h-14 w-full rounded-2xl" />

      {/* Content Skeleton */}
      <Card className="rounded-3xl">
        <CardHeader className="border-b">
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="space-y-2 p-4 rounded-2xl bg-muted/30 border border-border/50">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-6 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Security Card Skeleton */}
      <Card className="rounded-2xl">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4 max-w-md">
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-10 w-full" />
            </div>
            <Skeleton className="h-10 w-32 rounded-xl" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
