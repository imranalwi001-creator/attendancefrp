import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow, format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Megaphone,
  HelpCircle,
  Link2,
  MessageSquare,
  Pin,
  CheckCircle2,
  MoreHorizontal,
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Heart,
  Bookmark,
  FileText,
  ClipboardList,
  Calendar,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useForumPosts } from '@/hooks/useForumPosts';
import { ForumCommentSection } from './ForumCommentSection';
import type { ForumPost } from './types';
import { formatDurasi, getJenisUjianLabel } from '@/lib/ujianUtils';

interface ForumPostCardProps {
  post: ForumPost;
  userRole: string;
  currentUserId: string;
  subjectId: string;
  onPostUpdated: () => void;
}

const POST_TYPE_CONFIG = {
  announcement: {
    icon: Megaphone,
    label: 'Pengumuman',
    color: 'from-amber-500 to-orange-500',
    bgClass: 'bg-card',
    borderClass: 'border-0',
    badgeClass: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0',
    iconBg: 'bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400',
  },
  qna: {
    icon: HelpCircle,
    label: 'Q&A',
    color: 'from-blue-500 to-cyan-500',
    bgClass: '',
    borderClass: 'border-border',
    badgeClass: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    iconBg: 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400',
  },
  resource: {
    icon: Link2,
    label: 'Referensi',
    color: 'from-violet-500 to-purple-500',
    bgClass: '',
    borderClass: 'border-border',
    badgeClass: 'bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800',
    iconBg: 'bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-400',
  },
};

export function ForumPostCard({
  post,
  userRole,
  currentUserId,
  subjectId,
  onPostUpdated,
}: ForumPostCardProps) {
  const navigate = useNavigate();
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { updatePost, deletePost } = useForumPosts(subjectId);

  const config = POST_TYPE_CONFIG[post.post_type];
  const PostIcon = config.icon;

  const isStaff = userRole === 'admin' || userRole === 'guru' || userRole === 'walikelas' || userRole === 'Pembina';
  const isOwner = post.user_id === currentUserId;
  const canModify = isOwner || isStaff;
  const canMarkSolved = (isOwner || isStaff) && post.post_type === 'qna';
  const canPin = isStaff && post.post_type === 'announcement';

  const handleMarkSolved = async () => {
    await updatePost.mutateAsync({
      postId: post.id,
      is_solved: !post.is_solved,
    });
    onPostUpdated();
  };

  const handlePin = async () => {
    await updatePost.mutateAsync({
      postId: post.id,
      is_pinned: !post.is_pinned,
    });
    onPostUpdated();
  };

  const handleDelete = async () => {
    await deletePost.mutateAsync(post.id);
    setShowDeleteDialog(false);
    onPostUpdated();
  };

  const timeAgo = formatDistanceToNow(new Date(post.created_at), {
    addSuffix: true,
    locale: idLocale,
  });

  return (
    <>
      <Card
        className={cn(
          "group overflow-hidden transition-all duration-300 rounded-lg sm:rounded-xl",
          "hover:shadow-lg hover:-translate-y-0.5",
          config.bgClass,
          config.borderClass,
          post.is_pinned && "ring-1 sm:ring-2 ring-primary/20 shadow-md"
        )}
      >
        {/* Top gradient bar for pinned/announcement */}
        {(post.is_pinned || post.post_type === 'announcement') && (
          <div className={cn(
            "h-0.5 sm:h-1 bg-gradient-to-r",
            config.color
          )} />
        )}

        <CardContent className="p-3 sm:p-4 md:p-5">
          {/* Header */}
          <div className="flex items-start gap-2.5 sm:gap-3 md:gap-4">
            {/* Avatar with type indicator */}
            <div className="relative">
              <Avatar className="h-9 w-9 sm:h-11 md:h-12 sm:w-11 md:w-12 ring-2 ring-background shadow-md">
                <AvatarImage src={post.user?.avatar_url} />
                <AvatarFallback className="bg-gradient-to-br from-primary to-primary/60 text-primary-foreground font-semibold text-xs sm:text-sm">
                  {post.user?.name?.charAt(0)?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              {/* Type icon badge */}
              <div className={cn(
                "absolute -bottom-0.5 -right-0.5 sm:-bottom-1 sm:-right-1 h-4 w-4 sm:h-5 sm:w-5 rounded-full flex items-center justify-center",
                "ring-[1.5px] sm:ring-2 ring-background shadow-sm",
                config.iconBg
              )}>
                <PostIcon className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 space-y-1.5 sm:space-y-2">
              {/* User info row */}
              <div className="flex items-start justify-between gap-1.5 sm:gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                    <span className="font-semibold text-foreground text-sm sm:text-base truncate">
                      {post.user?.name || 'Pengguna'}
                    </span>
                    {post.is_pinned && (
                      <Badge variant="outline" className="gap-0.5 sm:gap-1 text-[10px] sm:text-xs px-1.5 sm:px-2 py-0 h-4 sm:h-5 bg-primary/10 text-primary border-primary/20">
                        <Pin className="h-2.5 w-2.5 sm:h-3 sm:w-3 fill-current" />
                        <span className="hidden xs:inline">Disematkan</span>
                      </Badge>
                    )}
                    {post.is_solved && (
                      <Badge className="gap-0.5 sm:gap-1 text-[10px] sm:text-xs px-1.5 sm:px-2 py-0 h-4 sm:h-5 bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0 shadow-sm">
                        <CheckCircle2 className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                        <span className="hidden xs:inline">Terjawab</span>
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                    <span>{timeAgo}</span>
                    <span>•</span>
                    <Badge variant="outline" className={cn("text-[10px] sm:text-xs px-1.5 sm:px-2 py-0 h-4 sm:h-5", config.badgeClass)}>
                      {config.label}
                    </Badge>
                  </div>
                </div>

                {/* Actions Menu */}
                {canModify && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 sm:h-8 sm:w-8 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                      >
                        <MoreHorizontal className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44 sm:w-48">
                      {canMarkSolved && (
                        <DropdownMenuItem onClick={handleMarkSolved} className="gap-2 text-xs sm:text-sm">
                          <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          {post.is_solved ? 'Batalkan Terjawab' : 'Tandai Terjawab'}
                        </DropdownMenuItem>
                      )}
                      {canPin && (
                        <DropdownMenuItem onClick={handlePin} className="gap-2 text-xs sm:text-sm">
                          <Pin className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          {post.is_pinned ? 'Lepas Pin' : 'Sematkan'}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setShowDeleteDialog(true)}
                        className="gap-2 text-xs sm:text-sm text-destructive focus:text-destructive focus:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        Hapus Postingan
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>

              {/* Post Content */}
              <p className="text-foreground text-sm sm:text-base whitespace-pre-wrap leading-relaxed break-words overflow-hidden">
                {post.content}
              </p>

              {/* Attached Materi Card */}
              {post.materi && (
                <div
                  onClick={() => navigate(`/app/mapel/${post.subject_id}/materi/${post.materi!.id}`)}
                  className={cn(
                    "flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg sm:rounded-xl cursor-pointer",
                    "bg-gradient-to-r from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/5",
                    "border border-primary/20 dark:border-primary/30",
                    "hover:from-primary/10 hover:to-primary/15 hover:border-primary/40 transition-all duration-200",
                    "group"
                  )}
                >
                  <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-md sm:rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                      📚 Materi: {post.materi.judul}
                    </p>
                    {post.materi.deskripsi && (
                      <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                        {post.materi.deskripsi}
                      </p>
                    )}
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                </div>
              )}

              {/* Resource URL Card */}
              {post.post_type === 'resource' && post.resource_url && (
                <a
                  href={post.resource_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg sm:rounded-xl",
                    "bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/20",
                    "border border-violet-200/60 dark:border-violet-800/40",
                    "hover:shadow-md transition-all group/link"
                  )}
                >
                  <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-md sm:rounded-lg bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center shrink-0">
                    <ExternalLink className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-foreground truncate group-hover/link:text-primary transition-colors">
                      {post.resource_url.replace(/^https?:\/\//, '').split('/')[0]}
                    </p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                      {post.resource_url}
                    </p>
                  </div>
                </a>
              )}

              {/* Attached Ujian Card */}
              {post.ujian && (
                <div
                  onClick={() => navigate('/app/ujian', { state: { selectedUjianId: post.ujian_id } })}
                  className={cn(
                    "flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg sm:rounded-xl cursor-pointer",
                    "bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/20",
                    "border border-blue-200/60 dark:border-blue-800/40",
                    "hover:from-blue-100 hover:to-cyan-100 dark:hover:from-blue-900/40 dark:hover:to-cyan-900/30",
                    "hover:border-blue-300 dark:hover:border-blue-700 transition-all duration-200",
                    "group/ujian"
                  )}
                >
                  <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-md sm:rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shrink-0 group-hover/ujian:scale-105 transition-transform">
                    <ClipboardList className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs sm:text-sm font-semibold text-foreground group-hover/ujian:text-blue-600 dark:group-hover/ujian:text-blue-400 transition-colors">
                        📋 {getJenisUjianLabel(post.ujian.jenis as any)}
                      </p>
                      <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                        {post.ujian.status}
                      </Badge>
                    </div>
                    {post.ujian.mapel?.nama && (
                      <p className="text-[10px] sm:text-xs text-muted-foreground">
                        {post.ujian.mapel.nama}
                      </p>
                    )}
                    <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(post.ujian.tanggal_pelaksanaan), 'dd MMM yyyy', { locale: idLocale })}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDurasi(post.ujian.durasi_menit)}
                      </span>
                    </div>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground group-hover/ujian:text-blue-500 transition-colors shrink-0" />
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-0.5 sm:gap-1 pt-1 sm:pt-2 -ml-1.5 sm:-ml-2">
                <Collapsible open={isCommentsOpen} onOpenChange={setIsCommentsOpen}>
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "gap-1 sm:gap-2 text-muted-foreground hover:text-foreground rounded-full px-2 sm:px-3 h-7 sm:h-8 text-xs sm:text-sm",
                        isCommentsOpen && "bg-muted text-foreground"
                      )}
                    >
                      <MessageSquare className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      <span>{post.comments_count || 0}</span>
                      {isCommentsOpen ? (
                        <ChevronUp className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      ) : (
                        <ChevronDown className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                </Collapsible>

                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 sm:gap-2 text-muted-foreground hover:text-rose-500 rounded-full px-2 sm:px-3 h-7 sm:h-8"
                >
                  <Heart className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 sm:gap-2 text-muted-foreground hover:text-foreground rounded-full px-2 sm:px-3 h-7 sm:h-8"
                >
                  <Bookmark className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Comments Section */}
          <Collapsible open={isCommentsOpen} onOpenChange={setIsCommentsOpen}>
            <CollapsibleContent className="mt-3 sm:mt-4 ml-11 sm:ml-14 md:ml-16">
              <ForumCommentSection
                postId={post.id}
                isExpanded={isCommentsOpen}
                currentUserId={currentUserId}
              />
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Postingan?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak dapat dibatalkan. Postingan dan semua komentarnya akan dihapus secara permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
