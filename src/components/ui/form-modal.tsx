import * as React from "react";
import { Save } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  onSubmit?: (e: React.FormEvent) => void;
  submitLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  showFooter?: boolean;
  className?: string;
  footerClassName?: string;
  footerContent?: React.ReactNode;
}

export function FormModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  onSubmit,
  submitLabel = "Simpan",
  cancelLabel = "Batal",
  loading = false,
  showFooter = true,
  className,
  footerClassName,
  footerContent,
}: FormModalProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit?.(e);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "sm:max-w-[600px] max-h-[90vh] p-0 flex flex-col overflow-hidden",
          className
        )}
      >
        {/* Header - Fixed */}
        <div className="flex-shrink-0 border-b">
          <DialogHeader className="px-6 py-4">
            <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
          </DialogHeader>
        </div>

        {onSubmit ? (
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
            {/* Content - Scrollable */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {children}
            </div>

            {/* Footer - Fixed */}
            {showFooter && (
              <div
                className={cn(
                  "flex-shrink-0 px-6 py-4 border-t bg-muted/30",
                  footerClassName
                )}
              >
                {footerContent || (
                  <div className="flex justify-end gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onOpenChange(false)}
                      disabled={loading}
                      className="rounded-xl border-primary text-primary hover:bg-primary hover:text-primary-foreground text-xs sm:text-sm h-9 sm:h-10"
                    >
                      {cancelLabel}
                    </Button>
                    <Button
                      type="submit"
                      disabled={loading}
                      className="rounded-xl bg-primary hover:bg-primary/90 text-xs sm:text-sm h-9 sm:h-10"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {loading ? "Menyimpan..." : submitLabel}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </form>
        ) : (
          <>
            {/* Content - Scrollable */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {children}
            </div>

            {/* Footer - Fixed */}
            {showFooter && (
              <div
                className={cn(
                  "flex-shrink-0 px-6 py-4 border-t bg-muted/30",
                  footerClassName
                )}
              >
                {footerContent || (
                  <div className="flex justify-end gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onOpenChange(false)}
                      className="rounded-xl border-primary text-primary hover:bg-primary hover:text-primary-foreground text-xs sm:text-sm h-9 sm:h-10"
                    >
                      {cancelLabel}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default FormModal;
