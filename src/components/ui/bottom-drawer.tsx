import * as React from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BottomDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  showCloseButton?: boolean;
  closeLabel?: string;
  onClose?: () => void;
  className?: string;
  contentClassName?: string;
  headerClassName?: string;
  footerClassName?: string;
  maxHeight?: string;
}

export function BottomDrawer({
  open,
  onOpenChange,
  title,
  icon,
  children,
  footer,
  showCloseButton = true,
  closeLabel = "Tutup",
  onClose,
  className,
  contentClassName,
  headerClassName,
  footerClassName,
  maxHeight = "85vh",
}: BottomDrawerProps) {
  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      onOpenChange(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent 
        className={cn(
          "flex flex-col",
          className
        )}
        style={{ maxHeight }}
      >
        {/* Header */}
        {(title || icon) && (
          <DrawerHeader className={cn("flex-shrink-0 border-b px-6 py-4", headerClassName)}>
            <DrawerTitle className="text-xl font-bold text-foreground flex items-center gap-3">
              {icon && (
                <div className="p-2 rounded-xl bg-primary/10">
                  {icon}
                </div>
              )}
              {title}
            </DrawerTitle>
          </DrawerHeader>
        )}

        {/* Content */}
        <div className={cn("flex-1 overflow-y-auto px-6 py-4", contentClassName)}>
          {children}
        </div>

        {/* Footer */}
        {(footer || showCloseButton) && (
          <DrawerFooter className={cn("flex-shrink-0 border-t bg-muted/30 px-6 py-4", footerClassName)}>
            {footer ? (
              footer
            ) : (
              <div className="flex justify-end">
                <Button 
                  variant="outline" 
                  onClick={handleClose}
                  className="rounded-xl border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                >
                  {closeLabel}
                </Button>
              </div>
            )}
          </DrawerFooter>
        )}
      </DrawerContent>
    </Drawer>
  );
}

// Pre-built footer with close + action buttons
export interface BottomDrawerFooterProps {
  onClose: () => void;
  closeLabel?: string;
  primaryAction?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
    loading?: boolean;
    disabled?: boolean;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
}

export function BottomDrawerFooter({
  onClose,
  closeLabel = "Tutup",
  primaryAction,
  secondaryAction,
}: BottomDrawerFooterProps) {
  return (
    <div className="flex justify-end gap-3">
      {secondaryAction && (
        <Button 
          variant="ghost" 
          onClick={secondaryAction.onClick}
          className="rounded-xl"
        >
          {secondaryAction.icon}
          {secondaryAction.label}
        </Button>
      )}
      <Button 
        variant="outline" 
        onClick={onClose}
        className="rounded-xl border-primary text-primary hover:bg-primary hover:text-primary-foreground"
      >
        {closeLabel}
      </Button>
      {primaryAction && (
        <Button 
          onClick={primaryAction.onClick}
          className="rounded-xl"
          disabled={primaryAction.disabled || primaryAction.loading}
        >
          {primaryAction.icon}
          {primaryAction.label}
        </Button>
      )}
    </div>
  );
}

export default BottomDrawer;
