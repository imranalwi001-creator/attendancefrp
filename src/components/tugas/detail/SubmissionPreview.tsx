import { Button } from '@/components/ui/button';
import { FileText, FileImage, Download, ExternalLink, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { PengumpulanTugas } from '@/types';
import { useSignedUrl, useSignedUrls } from '@/hooks/useSignedUrls';

interface SubmissionPreviewProps {
  submission: PengumpulanTugas;
  imageZoom: number;
  activeFileUrl: string | null;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onFileSelect: (url: string) => void;
}

export function SubmissionPreview({
  submission,
  imageZoom,
  activeFileUrl,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onFileSelect
}: SubmissionPreviewProps) {
  // Text type submission
  if (submission.jawaban.tipe === 'teks') {
    return (
      <div className="flex-1 p-6 overflow-auto">
        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{submission.jawaban.value}</p>
      </div>
    );
  }

  // Link type submission
  if (submission.jawaban.tipe === 'link') {
    return <LinkPreview linkValue={submission.jawaban.value} imageZoom={imageZoom} onZoomIn={onZoomIn} onZoomOut={onZoomOut} onZoomReset={onZoomReset} />;
  }

  // File type submission
  return (
    <FilePreview
      submission={submission}
      imageZoom={imageZoom}
      activeFileUrl={activeFileUrl}
      onZoomIn={onZoomIn}
      onZoomOut={onZoomOut}
      onZoomReset={onZoomReset}
      onFileSelect={onFileSelect}
    />
  );
}

// Link Preview Sub-component
interface LinkPreviewProps {
  linkValue: string;
  imageZoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
}

function LinkPreview({ linkValue, imageZoom, onZoomIn, onZoomOut, onZoomReset }: LinkPreviewProps) {
  // Detect if link is actually an image URL
  const isImageUrl = linkValue.match(/\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i) ||
    (linkValue.includes('/storage/') && linkValue.match(/\.(jpg|jpeg|png|gif|webp)/i));

  // Detect if link is a PDF URL
  const isPdfUrl = linkValue.match(/\.pdf(\?.*)?$/i) ||
    (linkValue.includes('/storage/') && linkValue.match(/\.pdf/i));

  // Resolve signed URL when this points to a private storage object
  const signedUrl = useSignedUrl(linkValue) || linkValue;

  if (isImageUrl) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="p-3 bg-muted/30 border-b border-border/50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <FileImage className="h-4 w-4 text-primary shrink-0" />
            <p className="text-sm text-muted-foreground truncate">Gambar</p>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="shrink-0 h-8 w-8 p-0" onClick={onZoomOut} disabled={imageZoom <= 0.1}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground w-12 text-center">{Math.round(imageZoom * 100)}%</span>
            <Button variant="ghost" size="sm" className="shrink-0 h-8 w-8 p-0" onClick={onZoomIn} disabled={imageZoom >= 3}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="shrink-0 h-8 w-8 p-0" onClick={onZoomReset} disabled={imageZoom === 1}>
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="shrink-0" onClick={() => window.open(signedUrl, '_blank')}>
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4 bg-muted/10">
          <div className="min-h-full flex items-center justify-center">
            <img
              src={signedUrl}
              alt="Image Preview"
              className="object-contain rounded-lg transition-transform duration-200 origin-center"
              style={{
                width: `${imageZoom * 100}%`,
                maxWidth: '100%',
                minWidth: imageZoom > 1 ? `${imageZoom * 100}%` : 'auto'
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (isPdfUrl) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="p-3 bg-muted/30 border-b border-border/50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <FileText className="h-4 w-4 text-primary shrink-0" />
            <p className="text-sm text-muted-foreground truncate">Dokumen PDF</p>
          </div>
          <Button variant="ghost" size="sm" className="shrink-0" onClick={() => window.open(signedUrl, '_blank')}>
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 bg-white min-h-[350px]">
          <iframe
            src={`https://docs.google.com/viewer?url=${encodeURIComponent(signedUrl)}&embedded=true`}
            className="w-full h-full min-h-[350px] border-0"
            title="PDF Preview"
          />
        </div>
      </div>
    );
  }

  // Detect Canva/Google Drive links
  const isCanvaLink = linkValue.includes('canva.com/design');
  const isGoogleDriveLink = linkValue.includes('drive.google.com');

  let embedUrl = '';
  let linkLabel = 'Buka di Tab Baru';
  let canEmbed = false;

  if (isCanvaLink) {
    const canvaMatch = linkValue.match(/canva\.com\/design\/([^/]+)\/([^/?]+)/);
    if (canvaMatch) {
      embedUrl = `https://www.canva.com/design/${canvaMatch[1]}/${canvaMatch[2]}/view?embed`;
      canEmbed = true;
    }
    linkLabel = 'Buka di Canva';
  } else if (isGoogleDriveLink) {
    const fileIdMatch = linkValue.match(/\/d\/([a-zA-Z0-9_-]+)/) || linkValue.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (fileIdMatch) {
      embedUrl = `https://drive.google.com/file/d/${fileIdMatch[1]}/preview`;
      canEmbed = true;
    }
    linkLabel = 'Buka di Google Drive';
  }

  if (canEmbed && embedUrl) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="flex-1 bg-white min-h-[350px]">
          <iframe
            src={embedUrl}
            className="w-full h-full min-h-[350px] border-0"
            title="Link Preview"
            loading="lazy"
            allow="fullscreen"
            allowFullScreen
          />
        </div>
        <div className="p-3 bg-muted/30 border-t border-border/50">
          <a href={linkValue} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
            <ExternalLink className="h-4 w-4" />
            {linkLabel}
          </a>
        </div>
      </div>
    );
  }

  // Fallback for unsupported links
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-muted/10">
      <div className="text-center space-y-4 max-w-md">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
          <ExternalLink className="h-8 w-8 text-primary" />
        </div>
        <div className="space-y-2">
          <h3 className="font-semibold text-foreground">Link Pengumpulan</h3>
          <p className="text-sm text-muted-foreground break-all px-4">{linkValue}</p>
        </div>
        <Button className="mt-4" onClick={() => window.open(linkValue, '_blank')}>
          <ExternalLink className="h-4 w-4 mr-2" />
          Buka Link di Tab Baru
        </Button>
        <p className="text-xs text-muted-foreground">Preview tidak tersedia karena situs tidak mengizinkan embedding</p>
      </div>
    </div>
  );
}

// File Preview Sub-component
interface FilePreviewProps {
  submission: PengumpulanTugas;
  imageZoom: number;
  activeFileUrl: string | null;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onFileSelect: (url: string) => void;
}

function FilePreview({ submission, imageZoom, activeFileUrl, onZoomIn, onZoomOut, onZoomReset, onFileSelect }: FilePreviewProps) {
  const urls = submission.jawaban.value.split(',').map(u => u.trim()).filter(Boolean);
  const activeUrl = (activeFileUrl && urls.includes(activeFileUrl)) ? activeFileUrl : (urls[0] || submission.jawaban.value);
  const isImage = !!activeUrl.match(/\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i);
  const isPdf = !!activeUrl.match(/\.pdf(\?.*)?$/i);
  // Resolve signed URL for the currently displayed file (private bucket support)
  const signedActiveUrl = useSignedUrl(activeUrl) || activeUrl;

  return (
    <div className="flex-1 flex flex-col">
      <div className="p-3 bg-muted/30 border-b border-border/50 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Download className="h-4 w-4 text-primary shrink-0" />
          <p className="text-sm text-muted-foreground truncate">{urls.length > 1 ? `File (${urls.length})` : activeUrl}</p>
        </div>

        {isImage && (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="shrink-0 h-8 w-8 p-0" onClick={onZoomOut} disabled={imageZoom <= 0.1}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground w-12 text-center">{Math.round(imageZoom * 100)}%</span>
            <Button variant="ghost" size="sm" className="shrink-0 h-8 w-8 p-0" onClick={onZoomIn} disabled={imageZoom >= 3}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="shrink-0 h-8 w-8 p-0" onClick={onZoomReset} disabled={imageZoom === 1}>
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        )}

        <Button variant="ghost" size="sm" className="shrink-0" onClick={() => window.open(signedActiveUrl, '_blank')}>
          <Download className="h-4 w-4" />
        </Button>
      </div>

      {urls.length > 1 && (
        <div className="p-3 border-b border-border/50 bg-muted/10">
          <div className="flex flex-wrap gap-2">
            {urls.map((url, idx) => (
              <Button
                key={`${idx}-${url}`}
                type="button"
                variant={url === activeUrl ? 'default' : 'outline'}
                size="sm"
                className="h-8"
                onClick={() => onFileSelect(url)}
              >
                {idx + 1}
              </Button>
            ))}
          </div>
        </div>
      )}

      {isImage ? (
        <div className="flex-1 overflow-auto p-4 bg-muted/10">
          <div className="min-h-full flex items-center justify-center">
            <img
              src={signedActiveUrl}
              alt="File Preview"
              className="object-contain rounded-lg transition-transform duration-200 origin-center"
              style={{
                width: `${imageZoom * 100}%`,
                maxWidth: '100%',
                minWidth: imageZoom > 1 ? `${imageZoom * 100}%` : 'auto'
              }}
            />
          </div>
        </div>
      ) : isPdf ? (
        <div className="flex-1 bg-white">
          <iframe
            src={`https://docs.google.com/viewer?url=${encodeURIComponent(signedActiveUrl)}&embedded=true`}
            className="w-full h-full min-h-[350px] border-0"
            title="PDF Preview"
          />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center space-y-3">
            <Download className="h-12 w-12 text-muted-foreground/50 mx-auto" />
            <p className="text-sm text-muted-foreground">Preview tidak tersedia untuk tipe file ini</p>
            <Button variant="outline" size="sm" onClick={() => window.open(signedActiveUrl, '_blank')}>
              <Download className="h-4 w-4 mr-2" />
              Download File
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
