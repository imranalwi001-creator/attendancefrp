import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { FileText, Image as ImageIcon, Video, Link as LinkIcon, X, GripVertical, Upload } from 'lucide-react';
import { YouTubePlayer, extractYouTubeVideoId } from '@/components/ui/youtube-player';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { RichTextEditor } from '@/components/ui/rich-text-editor';

interface ContentBlockProps {
  tipe: 'text' | 'image' | 'video' | 'link';
  value: string;
  index: number;
  onChange: (value: string) => void;
  onRemove: () => void;
  onDragStart?: (index: number) => void;
  onDragOver?: (index: number) => void;
  onDragEnd?: () => void;
  readOnly?: boolean;
}

export default function ContentBlock({ 
  tipe, 
  value, 
  index, 
  onChange, 
  onRemove,
  onDragStart,
  onDragOver,
  onDragEnd,
  readOnly = false
}: ContentBlockProps) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [inputMode, setInputMode] = useState<'url' | 'file'>('url');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Tipe file tidak valid",
        description: "Hanya file PNG dan JPG yang diperbolehkan",
        variant: "destructive"
      });
      return;
    }

    const maxSize = 1 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: "Ukuran file terlalu besar",
        description: "Ukuran file maksimal 1 MB",
        variant: "destructive"
      });
      return;
    }

    try {
      setUploading(true);
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { data, error } = await supabase.storage
        .from('materi-images')
        .upload(filePath, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('materi-images')
        .getPublicUrl(filePath);

      onChange(publicUrl);
      
      toast({
        title: "Berhasil",
        description: "Gambar berhasil diunggah"
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Gagal mengunggah",
        description: "Terjadi kesalahan saat mengunggah gambar",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const getIcon = () => {
    switch (tipe) {
      case 'text': return <FileText className="h-4 w-4" />;
      case 'image': return <ImageIcon className="h-4 w-4" />;
      case 'video': return <Video className="h-4 w-4" />;
      case 'link': return <LinkIcon className="h-4 w-4" />;
    }
  };

  const getLabel = () => {
    switch (tipe) {
      case 'text': return 'Teks';
      case 'image': return 'Gambar';
      case 'video': return 'Video';
      case 'link': return 'Link';
    }
  };

  const getBadgeColor = () => {
    switch (tipe) {
      case 'text': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'image': return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'video': return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
      case 'link': return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
    }
  };

  const renderPreview = () => {
    if (!value) return null;

    switch (tipe) {
      case 'image':
        return (
          <div className="mt-4 rounded-xl overflow-hidden border">
            <img 
              src={value} 
              alt="Preview" 
              className="w-full h-48 object-cover"
              onError={(e) => {
                e.currentTarget.src = '/placeholder.svg';
              }}
            />
          </div>
        );
      case 'video':
        const videoId = extractYouTubeVideoId(value);
        if (videoId) {
          return (
            <div className="mt-4">
              <YouTubePlayer
                videoId={videoId}
                title="Preview Video"
              />
            </div>
          );
        }
        return (
          <div className="mt-4 p-4 rounded-xl bg-muted/50 border text-sm text-muted-foreground">
            Preview video: {value}
          </div>
        );
      case 'link':
        return (
          <div className="mt-4 p-4 rounded-xl bg-muted/50 border">
            <a 
              href={value} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline flex items-center gap-2"
            >
              <LinkIcon className="h-4 w-4" />
              {value}
            </a>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Card 
      className={`group relative rounded-2xl border-2 border-border/50 ${readOnly ? 'cursor-default' : 'hover:border-primary/30 hover:shadow-lg cursor-move'} transition-all duration-300`}
      draggable={!readOnly}
      onDragStart={() => !readOnly && onDragStart?.(index)}
      onDragOver={(e) => {
        if (readOnly) return;
        e.preventDefault();
        onDragOver?.(index);
      }}
      onDragEnd={() => !readOnly && onDragEnd?.()}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 bg-gradient-to-r from-muted/30 to-muted/10">
        <div className="flex items-center gap-3">
          {!readOnly && (
            <div className="p-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors cursor-grab active:cursor-grabbing">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
          <Badge variant="outline" className={`${getBadgeColor()} border px-3 py-1`}>
            <span className="mr-2">{getIcon()}</span>
            <span className="font-semibold">{getLabel()}</span>
          </Badge>
        </div>
        {!readOnly && (
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onRemove}
            className="h-9 w-9 rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>

      <CardContent className="pt-4 pb-5 space-y-4">
        {readOnly ? (
          // Read-only view
          tipe === 'text' ? (
            <div 
              className="prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: value || '<p class="text-muted-foreground">Tidak ada konten</p>' }}
            />
          ) : (
            renderPreview() || <p className="text-sm text-muted-foreground">Tidak ada konten</p>
          )
        ) : (
          // Editable view
          tipe === 'text' ? (
          <RichTextEditor
            value={value}
            onChange={onChange}
            placeholder="Tulis konten materi di sini..."
            className="border-border/50"
          />
        ) : tipe === 'image' ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button
                type="button"
                variant={inputMode === 'url' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setInputMode('url')}
                className="rounded-lg"
              >
                URL
              </Button>
              <Button
                type="button"
                variant={inputMode === 'file' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setInputMode('file')}
                className="rounded-lg"
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload File
              </Button>
            </div>
            
            {inputMode === 'url' ? (
              <Input
                type="url"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="Masukkan URL gambar..."
                className="rounded-xl border-border/50 focus:border-primary transition-colors"
              />
            ) : (
              <div className="space-y-2">
                <Input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="rounded-xl border-border/50 focus:border-primary transition-colors"
                />
                <p className="text-xs text-muted-foreground">
                  Format: PNG, JPG • Maks. ukuran: 1 MB
                </p>
                {uploading && (
                  <p className="text-sm text-primary animate-pulse">Mengunggah...</p>
                )}
              </div>
            )}
          </div>
        ) : (
          <Input
            type="url"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={`Masukkan URL ${getLabel().toLowerCase()}...`}
            className="rounded-xl border-border/50 focus:border-primary transition-colors"
          />
        )
        )}

        {!readOnly && renderPreview()}
      </CardContent>
    </Card>
  );
}
