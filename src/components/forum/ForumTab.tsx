import { MessageSquare } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useForumPosts } from '@/hooks/useForumPosts';
import { ForumComposer } from './ForumComposer';
import { ForumPostCard } from './ForumPostCard';

interface ForumTabProps {
  subjectId: string;
}

export function ForumTab({ subjectId }: ForumTabProps) {
  const { user } = useAuth();
  const { posts, isLoading, refetch } = useForumPosts(subjectId);

  return (
    <div className="space-y-3 sm:space-y-6">
      {/* Composer */}
      <ForumComposer subjectId={subjectId} onPostCreated={refetch} />

      {/* Posts Feed */}
      <div className="space-y-2.5 sm:space-y-4">
        {isLoading ? (
          <>
            <PostSkeleton />
            <PostSkeleton />
            <PostSkeleton />
          </>
        ) : posts.length === 0 ? (
          <EmptyState />
        ) : (
          posts.map((post) => (
            <ForumPostCard
              key={post.id}
              post={post}
              userRole={user?.role || ''}
              currentUserId={user?.id || ''}
              subjectId={subjectId}
              onPostUpdated={refetch}
            />
          ))
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-10 sm:py-16 px-3 sm:px-4">
      <div className="rounded-full bg-muted p-3 sm:p-4 mb-3 sm:mb-4">
        <MessageSquare className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground" />
      </div>
      <h3 className="text-base sm:text-lg font-semibold text-foreground mb-1.5 sm:mb-2">
        Belum Ada Diskusi
      </h3>
      <p className="text-xs sm:text-sm text-muted-foreground text-center max-w-md">
        Jadilah yang pertama bertanya atau berbagi! Mulai diskusi dengan membuat postingan di atas.
      </p>
    </div>
  );
}

function PostSkeleton() {
  return (
    <div className="rounded-lg sm:rounded-xl border p-3 sm:p-4 space-y-3 sm:space-y-4">
      <div className="flex items-center gap-2.5 sm:gap-3">
        <Skeleton className="h-9 w-9 sm:h-10 sm:w-10 rounded-full" />
        <div className="space-y-1.5 sm:space-y-2">
          <Skeleton className="h-3.5 sm:h-4 w-24 sm:w-32" />
          <Skeleton className="h-2.5 sm:h-3 w-16 sm:w-20" />
        </div>
      </div>
      <Skeleton className="h-12 sm:h-16 w-full" />
      <Skeleton className="h-7 sm:h-8 w-20 sm:w-24" />
    </div>
  );
}
