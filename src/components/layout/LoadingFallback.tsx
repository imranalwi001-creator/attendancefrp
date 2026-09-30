import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export const LoadingFallback = () => (
  <div className="p-6 space-y-6">
    <div className="space-y-2">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-64" />
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map(i => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-16 mb-1" />
            <Skeleton className="h-3 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
    <Card>
      <CardContent className="p-6">
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-6 w-16" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  </div>
);

export const PageSkeleton = () => (
  <div className="p-6 space-y-6">
    <Skeleton className="h-8 w-48" />
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map(i => (
        <Skeleton key={i} className="h-32 rounded-xl" />
      ))}
    </div>
    <Skeleton className="h-96 rounded-xl" />
  </div>
);

export const AuthLoadingSkeleton = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="text-center space-y-4">
      <Skeleton className="h-12 w-12 rounded-full mx-auto" />
      <Skeleton className="h-4 w-32 mx-auto" />
    </div>
  </div>
);
