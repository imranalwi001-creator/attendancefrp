import * as React from "react";
import { Save, X } from "lucide-react";
import { Drawer, DrawerClose, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerDescription } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FormDrawerProps {
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
  hideSubmit?: boolean;
  className?: string;
  footerClassName?: string;
  footerContent?: React.ReactNode;
}

export function FormDrawer({
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
  hideSubmit = false,
  className,
  footerClassName,
  footerContent,
}: FormDrawerProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit?.(e);
  };

  const headerBlock = (
    <DrawerHeader className="flex-shrink-0 px-5 pb-3 pt-1">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <DrawerTitle className="text-base font-bold tracking-tight">{title}</DrawerTitle>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        <DrawerClose asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </DrawerClose>
      </div>
    </DrawerHeader>
  );

  const footerBlock = showFooter && (
    <DrawerFooter
      className={cn(
        "flex-shrink-0 px-5 py-3 border-t border-border/40 bg-card",
        footerClassName
      )}
    >
      {footerContent || (
        <div className="flex justify-end gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="rounded-xl text-xs sm:text-sm h-9 px-4 border-border hover:bg-muted"
          >
            {cancelLabel}
          </Button>
          {!hideSubmit && (
            <Button
              type="submit"
              size="sm"
              disabled={loading}
              className="rounded-xl text-xs sm:text-sm h-9 px-5 shadow-sm"
            >
              <Save className="h-3.5 w-3.5 mr-1.5" />
              {loading ? "Menyimpan..." : submitLabel}
            </Button>
          )}
        </div>
      )}
    </DrawerFooter>
  );

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className={cn("max-h-[85vh] flex flex-col", className)}>
        {headerBlock}
        <DrawerDescription className="sr-only">
          {description || `${title}. Lengkapi formulir lalu simpan perubahan.`}
        </DrawerDescription>

        {onSubmit ? (
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto px-5 py-4 bg-background">
              {children}
            </div>
            {footerBlock}
          </form>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4 bg-background">
              {children}
            </div>
            {footerBlock}
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}

export default FormDrawer;
