import { ExternalLink, FileText, File as FileIcon } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { useSignedUrls } from '@/hooks/useSignedUrls';

interface SubmissionFilePreviewProps {
  fileUrl: string;
}

const isImageUrl = (url: string) => /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i.test(url);
const isPdfUrl = (url: string) => /\.pdf(\?|$)/i.test(url);
const isSupabaseStorageUrl = (url: string) =>
  url.includes('/storage/v1/object/');

const getFileName = (url: string) => {
  try {
    const path = new URL(url).pathname;
    const name = decodeURIComponent(path.split('/').pop() || '');
    return name || 'File';
  } catch {
    return 'File';
  }
};

export function SubmissionFilePreview({ fileUrl }: SubmissionFilePreviewProps) {
  const urls = fileUrl.split(',').map((u) => u.trim()).filter(Boolean);
  const signedUrls = useSignedUrls(urls);

  if (urls.length === 0) return null;

  return (
    <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
        <FileText className="h-3.5 w-3.5" />
        File / Link Jawaban {urls.length > 1 && `(${urls.length})`}
      </Label>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {urls.map((rawUrl, idx) => {
          const url = signedUrls[idx] || rawUrl;
          const isStorage = isSupabaseStorageUrl(rawUrl);
          const isImage = isImageUrl(rawUrl);
          const isPdf = isPdfUrl(rawUrl);

          // External link (non-storage URL)
          if (!isStorage) {
            return (
              <a
                key={idx}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative aspect-square rounded-lg border border-border bg-background hover:bg-accent/50 transition-colors flex flex-col items-center justify-center p-3 gap-2"
              >
                <ExternalLink className="h-6 w-6 text-primary" />
                <span className="text-[10px] text-center text-muted-foreground line-clamp-2 break-all">
                  {getFileName(rawUrl) || 'Tautan'}
                </span>
              </a>
            );
          }

          if (isImage) {
            return (
              <a
                key={idx}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative aspect-square rounded-lg overflow-hidden border border-border bg-muted/20 hover:ring-2 hover:ring-primary/40 transition-all"
              >
                <img
                  src={url}
                  alt={`Jawaban ${idx + 1}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ExternalLink className="h-3 w-3 text-white ml-auto" />
                </div>
              </a>
            );
          }

          // PDF / other file
          return (
            <a
              key={idx}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative aspect-square rounded-lg border border-border bg-background hover:bg-accent/50 transition-colors flex flex-col items-center justify-center p-3 gap-2"
            >
              {isPdf ? (
                <FileText className="h-6 w-6 text-red-500" />
              ) : (
                <FileIcon className="h-6 w-6 text-primary" />
              )}
              <span className="text-[10px] text-center text-muted-foreground line-clamp-2 break-all">
                {getFileName(rawUrl)}
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}
