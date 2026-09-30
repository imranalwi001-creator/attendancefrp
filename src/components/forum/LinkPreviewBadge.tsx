import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Youtube, 
  FileText, 
  ExternalLink, 
  Play,
  X,
  Presentation
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  extractYouTubeVideoId, 
  getYouTubeThumbnail,
  YouTubePlayer 
} from '@/components/ui/youtube-player';

interface LinkPreviewBadgeProps {
  url: string;
  className?: string;
}

type LinkType = 'youtube' | 'canva' | 'google-drive' | 'generic';

function detectLinkType(url: string): LinkType {
  if (/youtube\.com|youtu\.be/i.test(url)) return 'youtube';
  if (/canva\.com/i.test(url)) return 'canva';
  if (/drive\.google\.com|docs\.google\.com|sheets\.google\.com|slides\.google\.com/i.test(url)) return 'google-drive';
  return 'generic';
}

function getLinkConfig(type: LinkType) {
  switch (type) {
    case 'youtube':
      return {
        icon: Youtube,
        label: 'YouTube',
        color: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
        hoverColor: 'hover:bg-red-500/20'
      };
    case 'canva':
      return {
        icon: Presentation,
        label: 'Canva',
        color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
        hoverColor: 'hover:bg-purple-500/20'
      };
    case 'google-drive':
      return {
        icon: FileText,
        label: 'Google Drive',
        color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
        hoverColor: 'hover:bg-blue-500/20'
      };
    default:
      return {
        icon: ExternalLink,
        label: 'Link',
        color: 'bg-muted text-muted-foreground border-border',
        hoverColor: 'hover:bg-muted/80'
      };
  }
}

export function LinkPreviewBadge({ url, className }: LinkPreviewBadgeProps) {
  const [showPreview, setShowPreview] = useState(false);
  const linkType = detectLinkType(url);
  const config = getLinkConfig(linkType);
  const Icon = config.icon;

  const youtubeVideoId = linkType === 'youtube' ? extractYouTubeVideoId(url) : null;

  const handleClick = () => {
    if (linkType === 'youtube' && youtubeVideoId) {
      setShowPreview(!showPreview);
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <Badge
        variant="outline"
        className={cn(
          "cursor-pointer gap-1.5 py-1 px-2 text-xs font-medium transition-colors",
          config.color,
          config.hoverColor
        )}
        onClick={handleClick}
      >
        <Icon className="h-3 w-3" />
        <span>{config.label}</span>
        {linkType === 'youtube' && youtubeVideoId && (
          showPreview ? (
            <X className="h-3 w-3 ml-1" />
          ) : (
            <Play className="h-3 w-3 ml-1" />
          )
        )}
        {linkType !== 'youtube' && (
          <ExternalLink className="h-3 w-3 ml-1 opacity-60" />
        )}
      </Badge>

      {/* YouTube Preview */}
      {linkType === 'youtube' && youtubeVideoId && showPreview && (
        <div className="relative rounded-lg overflow-hidden animate-in fade-in-50 slide-in-from-top-2 duration-200">
          <YouTubePlayer 
            videoId={youtubeVideoId} 
            className="max-w-sm"
          />
        </div>
      )}

      {/* YouTube Thumbnail Preview (when not expanded) */}
      {linkType === 'youtube' && youtubeVideoId && !showPreview && (
        <div 
          className="relative max-w-[200px] rounded-lg overflow-hidden cursor-pointer group"
          onClick={() => setShowPreview(true)}
        >
          <img 
            src={getYouTubeThumbnail(youtubeVideoId, 'medium')}
            alt="YouTube thumbnail"
            className="w-full aspect-video object-cover"
          />
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="bg-red-600 rounded-full p-2">
              <Play className="h-4 w-4 text-white fill-white" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Utility to extract URLs from text
export function extractUrls(text: string): string[] {
  const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/gi;
  const matches = text.match(urlRegex);
  return matches || [];
}

// Component to render text with link previews
interface TextWithLinkPreviewsProps {
  content: string;
  className?: string;
}

export function TextWithLinkPreviews({ content, className }: TextWithLinkPreviewsProps) {
  const urls = extractUrls(content);
  
  // Remove URLs from the displayed text for cleaner look
  let cleanText = content;
  urls.forEach(url => {
    cleanText = cleanText.replace(url, '').trim();
  });

  return (
    <div className={cn("space-y-2", className)}>
      {/* Display clean text if there's any remaining */}
      {cleanText && (
        <p className="text-xs sm:text-sm text-foreground whitespace-pre-wrap break-words">
          {cleanText}
        </p>
      )}
      
      {/* Display link previews */}
      {urls.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {urls.map((url, index) => (
            <LinkPreviewBadge key={`${url}-${index}`} url={url} />
          ))}
        </div>
      )}
    </div>
  );
}

export default LinkPreviewBadge;
