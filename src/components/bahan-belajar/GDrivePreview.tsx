import { useState } from 'react';
import { Loader2, AlertCircle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface GDrivePreviewProps {
  embedUrl: string;
  driveUrl: string;
  title?: string;
  className?: string;
  aspectRatio?: 'video' | 'square' | 'portrait';
}

export function GDrivePreview({ 
  embedUrl, 
  driveUrl, 
  title,
  className,
  aspectRatio = 'video'
}: GDrivePreviewProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const aspectClasses = {
    video: 'aspect-video',
    square: 'aspect-square',
    portrait: 'aspect-[3/4]',
  };

  return (
    <div className={cn(
      'relative w-full rounded-xl overflow-hidden bg-muted border',
      aspectClasses[aspectRatio],
      className
    )}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted z-10">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="text-sm">Memuat preview...</span>
          </div>
        </div>
      )}
      
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted z-10">
          <div className="flex flex-col items-center gap-3 text-muted-foreground p-4 text-center">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <div>
              <p className="font-medium text-foreground">Preview tidak tersedia</p>
              <p className="text-sm mt-1">File mungkin tidak di-share sebagai "Anyone with link"</p>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => window.open(driveUrl, '_blank')}
              className="mt-2"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Buka di Google Drive
            </Button>
          </div>
        </div>
      )}

      <iframe
        src={embedUrl}
        title={title || 'Google Drive Preview'}
        className="w-full h-full"
        allow="autoplay; fullscreen"
        onLoad={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          setError(true);
        }}
      />
    </div>
  );
}