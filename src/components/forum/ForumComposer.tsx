import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { 
  Send, 
  Megaphone, 
  HelpCircle, 
  Link2, 
  Loader2,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useForumPosts } from '@/hooks/useForumPosts';
import type { ForumPostType } from './types';

interface ForumComposerProps {
  subjectId: string;
  onPostCreated: () => void;
}

const POST_TYPE_OPTIONS = [
  { 
    value: 'qna', 
    label: 'Tanya Jawab', 
    icon: HelpCircle, 
    description: 'Ajukan pertanyaan',
    color: 'from-blue-500 to-cyan-500',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    borderColor: 'border-blue-200 dark:border-blue-800',
    textColor: 'text-blue-600 dark:text-blue-400',
  },
  { 
    value: 'resource', 
    label: 'Referensi', 
    icon: Link2, 
    description: 'Bagikan link',
    color: 'from-violet-500 to-purple-500',
    bgColor: 'bg-violet-50 dark:bg-violet-950/30',
    borderColor: 'border-violet-200 dark:border-violet-800',
    textColor: 'text-violet-600 dark:text-violet-400',
  },
  { 
    value: 'announcement', 
    label: 'Pengumuman', 
    icon: Megaphone, 
    description: 'Buat pengumuman',
    color: 'from-amber-500 to-orange-500',
    bgColor: 'bg-amber-50 dark:bg-amber-950/30',
    borderColor: 'border-amber-200 dark:border-amber-800',
    textColor: 'text-amber-600 dark:text-amber-400',
  },
];

export function ForumComposer({ subjectId, onPostCreated }: ForumComposerProps) {
  const { user } = useAuth();
  const { createPost } = useForumPosts(subjectId);
  
  const [content, setContent] = useState('');
  const [postType, setPostType] = useState<ForumPostType>('qna');
  const [resourceUrl, setResourceUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const isStaff = user?.role === 'admin' || user?.role === 'guru' || user?.role === 'walikelas' || user?.role === 'Pembina';

  const availableOptions = POST_TYPE_OPTIONS.filter(opt => {
    if (opt.value === 'announcement' && !isStaff) return false;
    return true;
  });

  const handleSubmit = async () => {
    if (!content.trim() || !user?.id) return;

    setIsSubmitting(true);
    try {
      await createPost.mutateAsync({
        content: content.trim(),
        post_type: postType,
        resource_url: postType === 'resource' ? resourceUrl.trim() : undefined,
        user_id: user.id,
      });

      setContent('');
      setResourceUrl('');
      setPostType('qna');
      setIsFocused(false);
      onPostCreated();
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentOption = POST_TYPE_OPTIONS.find(opt => opt.value === postType);

  return (
    <Card 
      className={cn(
        "overflow-hidden transition-all duration-300 border sm:border-2 rounded-lg sm:rounded-xl",
        isFocused 
          ? "shadow-lg border-primary/30 ring-2 sm:ring-4 ring-primary/5" 
          : "border-border/60 hover:border-border"
      )}
    >
      {/* Header with gradient accent */}
      <div className={cn(
        "h-0.5 sm:h-1 bg-gradient-to-r transition-all duration-300",
        currentOption?.color || 'from-primary to-primary/60'
      )} />

      <div className="p-3 sm:p-4 md:p-5">
        {/* User Avatar + Input Area */}
        <div className="flex gap-2.5 sm:gap-3 md:gap-4">
          {/* Avatar */}
          <Avatar className="h-8 w-8 sm:h-10 md:h-11 sm:w-10 md:w-11 ring-2 ring-background shadow-md shrink-0">
            <AvatarImage src={user?.avatar_url} />
            <AvatarFallback className="bg-gradient-to-br from-primary to-primary/60 text-primary-foreground font-semibold text-xs sm:text-sm">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 space-y-2 sm:space-y-3">
            {/* Post Type Pills */}
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {availableOptions.map((opt) => {
                const isSelected = postType === opt.value;
                const Icon = opt.icon;
                
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPostType(opt.value as ForumPostType)}
                    className={cn(
                      "inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all duration-200",
                      "border sm:border-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary/50",
                      isSelected 
                        ? cn(opt.bgColor, opt.borderColor, opt.textColor, "shadow-sm")
                        : "border-transparent bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    <span className="hidden xs:inline sm:inline">{opt.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Content Textarea */}
            <div className="relative">
              <Textarea
                placeholder={
                  postType === 'announcement'
                    ? '📢 Tulis pengumuman untuk kelas...'
                    : postType === 'qna'
                    ? '💬 Apa yang ingin kamu tanyakan atau diskusikan?'
                    : '🔗 Bagikan referensi atau materi yang bermanfaat...'
                }
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => !content && setIsFocused(false)}
                className={cn(
                  "min-h-[60px] sm:min-h-[80px] resize-none border-0 bg-muted/30 focus:bg-background",
                  "text-sm sm:text-base placeholder:text-muted-foreground/60 placeholder:text-xs sm:placeholder:text-sm",
                  "focus-visible:ring-0 focus-visible:ring-offset-0",
                  "transition-all duration-200 rounded-lg sm:rounded-xl"
                )}
              />
            </div>

            {/* Resource URL Input (only for resource type) */}
            {postType === 'resource' && (
              <div className="space-y-1 sm:space-y-1.5 animate-in slide-in-from-top-2 duration-200">
                <Label htmlFor="resource-url" className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1 sm:gap-1.5">
                  <Link2 className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                  Link Referensi
                </Label>
                <Input
                  id="resource-url"
                  type="url"
                  placeholder="https://example.com/resource"
                  value={resourceUrl}
                  onChange={(e) => setResourceUrl(e.target.value)}
                  className="h-8 sm:h-9 text-xs sm:text-sm bg-muted/30 border-muted focus:bg-background"
                />
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end sm:justify-between pt-0.5 sm:pt-1">
              <p className="text-xs text-muted-foreground hidden sm:block">
                <Sparkles className="h-3 w-3 inline mr-1" />
                Tekan Enter untuk baris baru
              </p>
              
              <Button
                onClick={handleSubmit}
                disabled={!content.trim() || isSubmitting}
                size="sm"
                className={cn(
                  "gap-1.5 sm:gap-2 rounded-full px-3 sm:px-5 h-8 sm:h-9 text-xs sm:text-sm shadow-md",
                  "bg-primary hover:bg-primary/90 transition-colors"
                )}
              >
                {isSubmitting ? (
                  <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                )}
                <span>Posting</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
