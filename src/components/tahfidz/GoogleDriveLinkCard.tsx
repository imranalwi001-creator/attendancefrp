import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ExternalLink, Trash2, Link2, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface GoogleDriveLinkCardProps {
  url: string;
  onUrlChange: (value: string) => void;
  onDelete?: () => void;
  isEditing?: boolean;
  showInput?: boolean;
  placeholder?: string;
}

export function GoogleDriveLinkCard({
  url,
  onUrlChange,
  onDelete,
  isEditing = false,
  showInput = true,
  placeholder = "Masukkan link Google Drive atau URL audio...",
}: GoogleDriveLinkCardProps) {
  const isGDrive = url?.includes("drive.google.com") || url?.includes("docs.google.com");

  const handleCopy = () => {
    if (url) {
      navigator.clipboard.writeText(url);
      toast.success("Link berhasil disalin");
    }
  };

  if (!showInput && url) {
    return (
      <div className="overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/5">
        <div className="flex items-center gap-3 p-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Link2 className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {isGDrive ? "Google Drive" : "Link Audio"}
            </p>
            <p className="text-xs text-muted-foreground truncate">{url}</p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleCopy}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => window.open(url, "_blank")}
              className="h-8 w-8 text-primary hover:text-primary"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
            {onDelete && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onDelete}
                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (showInput) {
    return (
      <div className="space-y-2">
        <div className="flex gap-2">
          <Input
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            placeholder={placeholder}
            className="flex-1"
          />
          {url && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => window.open(url, "_blank")}
              className="shrink-0"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          )}
        </div>
        {url && isGDrive && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Link2 className="h-3 w-3" />
            Link Google Drive terdeteksi
          </p>
        )}
      </div>
    );
  }

  return null;
}
