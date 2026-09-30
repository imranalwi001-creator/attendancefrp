import { cn } from '@/lib/utils';

interface YouTubePlayerProps {
  videoId: string;
  title?: string;
  className?: string;
  autoplay?: boolean;
}

/**
 * Extracts YouTube video ID from various URL formats
 */
export function extractYouTubeVideoId(url: string): string | null {
  if (!url) return null;

  // Handle various YouTube URL formats
  const patterns = [
    // Standard watch URLs
    /(?:youtube\.com\/watch\?v=|youtube\.com\/watch\?.*&v=)([a-zA-Z0-9_-]{11})/,
    // Short URLs
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    // Embed URLs
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    // YouTube Shorts
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    // Direct video ID (11 characters)
    /^([a-zA-Z0-9_-]{11})$/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

/**
 * Validates if a string is a valid YouTube video ID
 */
export function isValidYouTubeId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{11}$/.test(id);
}

/**
 * Generates a YouTube thumbnail URL
 */
export function getYouTubeThumbnail(videoId: string, quality: 'default' | 'medium' | 'high' | 'max' = 'high'): string {
  const qualityMap = {
    default: 'default',
    medium: 'mqdefault',
    high: 'hqdefault',
    max: 'maxresdefault'
  };
  
  return `https://img.youtube.com/vi/${videoId}/${qualityMap[quality]}.jpg`;
}

export function YouTubePlayer({ 
  videoId, 
  title = 'YouTube Video',
  className,
  autoplay = false
}: YouTubePlayerProps) {
  if (!videoId || !isValidYouTubeId(videoId)) {
    return (
      <div className={cn(
        "flex items-center justify-center aspect-video bg-muted rounded-xl border",
        className
      )}>
        <p className="text-muted-foreground text-sm">Video tidak valid</p>
      </div>
    );
  }

  const params = new URLSearchParams({
    rel: '0',           // Don't show related videos from other channels
    modestbranding: '1', // Reduce YouTube branding
    showinfo: '0',      // Hide video title and uploader
    ...(autoplay && { autoplay: '1' })
  });
  
  const embedUrl = `https://www.youtube.com/embed/${videoId}?${params.toString()}`;

  return (
    <div className={cn("aspect-video rounded-xl overflow-hidden border shadow-sm", className)}>
      <iframe
        src={embedUrl}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        className="w-full h-full"
        loading="lazy"
      />
    </div>
  );
}

export default YouTubePlayer;
