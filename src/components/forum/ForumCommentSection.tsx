import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Send, Trash2, Loader2, CornerDownRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useForumComments } from '@/hooks/useForumPosts';
import { TextWithLinkPreviews } from './LinkPreviewBadge';

interface ForumCommentSectionProps {
  postId: string;
  isExpanded: boolean;
  currentUserId: string;
}

export function ForumCommentSection({
  postId,
  isExpanded,
  currentUserId,
}: ForumCommentSectionProps) {
  const { user } = useAuth();
  const { comments, isLoading, createComment, deleteComment } = useForumComments(postId);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!newComment.trim() || !user?.id) return;

    setIsSubmitting(true);
    try {
      await createComment.mutateAsync({
        content: newComment.trim(),
        user_id: user.id,
      });
      setNewComment('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    await deleteComment.mutateAsync(commentId);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (!isExpanded) return null;

  return (
    <div className="space-y-3 sm:space-y-4 border-l sm:border-l-2 border-muted pl-2.5 sm:pl-4">
      {/* Comments List */}
      <div className="space-y-2 sm:space-y-3">
        {isLoading ? (
          <>
            <CommentSkeleton />
            <CommentSkeleton />
          </>
        ) : comments.length === 0 ? (
          <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground py-1.5 sm:py-2">
            <CornerDownRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span>Belum ada komentar. Jadilah yang pertama!</span>
          </div>
        ) : (
          comments.map((comment) => {
            const isOwner = comment.user_id === currentUserId;
            const timeAgo = formatDistanceToNow(new Date(comment.created_at), {
              addSuffix: true,
              locale: idLocale,
            });

            return (
              <div key={comment.id} className="flex gap-2 sm:gap-3 group animate-in fade-in-50 duration-200">
                <Avatar className="h-6 w-6 sm:h-8 sm:w-8 shrink-0 ring-1 ring-border">
                  <AvatarImage src={comment.user?.avatar_url} />
                  <AvatarFallback className="bg-muted text-muted-foreground text-[10px] sm:text-xs font-medium">
                    {comment.user?.name?.charAt(0)?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className={cn(
                    "inline-block rounded-xl sm:rounded-2xl px-2.5 sm:px-4 py-1.5 sm:py-2.5 max-w-full",
                    "bg-muted/60 dark:bg-muted/40"
                  )}>
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5">
                      <span className="font-medium text-xs sm:text-sm text-foreground">
                        {comment.user?.name || 'Pengguna'}
                      </span>
                      <span className="text-[10px] sm:text-xs text-muted-foreground">•</span>
                      <span className="text-[10px] sm:text-xs text-muted-foreground">{timeAgo}</span>
                    </div>
                    <TextWithLinkPreviews content={comment.content} />
                  </div>
                  {isOwner && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(comment.id)}
                      className="h-5 sm:h-6 px-1.5 sm:px-2 text-[10px] sm:text-xs text-muted-foreground hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100 transition-opacity mt-0.5 sm:mt-1"
                    >
                      <Trash2 className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
                      Hapus
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Comment Input */}
      <div className="flex gap-2 sm:gap-3 pt-1.5 sm:pt-2">
        <Avatar className="h-6 w-6 sm:h-8 sm:w-8 shrink-0 ring-1 ring-border">
          <AvatarImage src={user?.avatar_url} />
          <AvatarFallback className="bg-primary/10 text-primary text-[10px] sm:text-xs font-medium">
            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 flex gap-1.5 sm:gap-2">
          <Textarea
            placeholder="Tulis komentar..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={handleKeyDown}
            className={cn(
              "min-h-[32px] sm:min-h-[40px] max-h-[100px] sm:max-h-[120px] py-1.5 sm:py-2 resize-none text-xs sm:text-sm",
              "rounded-xl sm:rounded-2xl border-muted bg-muted/30 focus:bg-background",
              "focus-visible:ring-1 focus-visible:ring-primary/50"
            )}
            rows={1}
          />
          <Button
            size="icon"
            onClick={handleSubmit}
            disabled={!newComment.trim() || isSubmitting}
            className="h-8 w-8 sm:h-10 sm:w-10 shrink-0 rounded-full shadow-md"
          >
            {isSubmitting ? (
              <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function CommentSkeleton() {
  return (
    <div className="flex gap-2 sm:gap-3">
      <Skeleton className="h-6 w-6 sm:h-8 sm:w-8 rounded-full shrink-0" />
      <div className="flex-1 space-y-1.5 sm:space-y-2">
        <Skeleton className="h-12 sm:h-16 w-3/4 rounded-xl sm:rounded-2xl" />
      </div>
    </div>
  );
}
