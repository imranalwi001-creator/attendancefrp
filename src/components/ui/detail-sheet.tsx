import * as React from 'react';
import { X } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface DetailSheetHeaderBadge {
  label: string;
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning';
  className?: string;
}

export interface DetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Icon displayed in the header */
  icon?: React.ReactNode;
  /** Background color class for icon container (e.g., 'bg-primary/10') */
  iconBgColor?: string;
  /** Text color class for icon (e.g., 'text-primary') */
  iconTextColor?: string;
  /** Main title */
  title: string;
  /** Subtitle below title */
  subtitle?: string;
  /** Badge displayed next to title */
  badge?: DetailSheetHeaderBadge;
  /** Content to render in the body */
  children: React.ReactNode;
  /** Footer actions */
  footer?: React.ReactNode;
  /** Custom class for content container */
  contentClassName?: string;
  /** Max height of the sheet (default: 85vh) */
  maxHeight?: string;
}

export function DetailSheet({
  open,
  onOpenChange,
  icon,
  iconBgColor = 'bg-primary/10',
  iconTextColor = 'text-primary',
  title,
  subtitle,
  badge,
  children,
  footer,
  contentClassName,
  maxHeight = '85vh'
}: DetailSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="bottom" 
        className={cn(
          "h-auto overflow-hidden rounded-t-2xl p-0 flex flex-col",
          `max-h-[${maxHeight}]`
        )}
        style={{ maxHeight }}
      >
        {/* Header */}
        <SheetHeader className="px-4 sm:px-6 pt-5 sm:pt-6 pb-3 sm:pb-4 border-b border-border bg-gradient-to-br from-primary/5 to-background shrink-0">
          <div className="flex items-start gap-3">
            {icon && (
              <div className={cn(
                "w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0",
                iconBgColor
              )}>
                <span className={iconTextColor}>{icon}</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <SheetTitle className="text-base sm:text-lg font-bold text-left truncate">{title}</SheetTitle>
                {badge && (
                  <Badge 
                    variant={badge.variant || 'default'}
                    className={badge.className}
                  >
                    {badge.label}
                  </Badge>
                )}
              </div>
              {subtitle && (
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 truncate text-left">{subtitle}</p>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 h-8 w-8 p-0 rounded-lg hover:bg-muted"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Tutup</span>
            </Button>
          </div>
        </SheetHeader>

        {/* Content */}
        <div className={cn("px-4 sm:px-6 py-3 sm:py-4 space-y-3 sm:space-y-4 overflow-y-auto flex-1 min-h-0", contentClassName)}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-t bg-muted/30 flex justify-end gap-2 sm:gap-3 shrink-0">
            {footer}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// Pre-built footer components for common patterns
export interface DetailSheetFooterProps {
  onClose?: () => void;
  closeLabel?: string;
  primaryAction?: {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    disabled?: boolean;
  };
  secondaryAction?: {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    disabled?: boolean;
  };
}

export function DetailSheetFooter({
  onClose,
  closeLabel = 'Tutup',
  primaryAction,
  secondaryAction
}: DetailSheetFooterProps) {
  return (
    <>
      {onClose && !primaryAction && !secondaryAction && (
        <Button
          variant="outline"
          onClick={onClose}
          className="rounded-xl w-full border-border text-muted-foreground hover:bg-muted"
        >
          <X className="h-4 w-4 mr-2" />
          {closeLabel}
        </Button>
      )}
      {(primaryAction || secondaryAction) && onClose && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="rounded-xl text-muted-foreground hover:bg-muted"
        >
          {closeLabel}
        </Button>
      )}
      {secondaryAction && (
        <Button
          variant="outline"
          size="sm"
          onClick={secondaryAction.onClick}
          disabled={secondaryAction.disabled}
          className="rounded-xl gap-2"
        >
          {secondaryAction.icon}
          {secondaryAction.label}
        </Button>
      )}
      {primaryAction && (
        <Button
          size="sm"
          onClick={primaryAction.onClick}
          disabled={primaryAction.disabled}
          className="rounded-xl gap-2"
        >
          {primaryAction.icon}
          {primaryAction.label}
        </Button>
      )}
    </>
  );
}

// Info item component for consistent info display
export interface DetailSheetInfoItemProps {
  icon?: React.ReactNode;
  label: string;
  value: React.ReactNode;
  className?: string;
}

export function DetailSheetInfoItem({ icon, label, value, className }: DetailSheetInfoItemProps) {
  return (
    <div className={cn("space-y-0.5", className)}>
      <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="text-sm sm:text-base font-semibold text-foreground normal-case">{value}</div>
    </div>
  );
}

// Info grid for layout
export interface DetailSheetInfoGridProps {
  columns?: 2 | 3 | 4;
  children: React.ReactNode;
  className?: string;
}

export function DetailSheetInfoGrid({ columns = 2, children, className }: DetailSheetInfoGridProps) {
  const gridCols = {
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4'
  };
  
  return (
    <div className={cn("grid gap-3 sm:gap-4", gridCols[columns], className)}>
      {children}
    </div>
  );
}

// Stat card for numbers/metrics
export interface DetailSheetStatCardProps {
  icon?: React.ReactNode;
  label: string;
  value: React.ReactNode;
  className?: string;
}

export function DetailSheetStatCard({ icon, label, value, className }: DetailSheetStatCardProps) {
  return (
    <div className={cn("p-3 sm:p-4 rounded-xl bg-primary/5 border border-primary/20", className)}>
      <div className="flex items-center gap-2 mb-1 sm:mb-2">
        {icon && <span className="text-primary">{icon}</span>}
        <p className="text-xs sm:text-sm text-muted-foreground">{label}</p>
      </div>
      <p className="text-xl sm:text-2xl font-bold text-primary">{value}</p>
    </div>
  );
}

// Section card for grouped info
export interface DetailSheetSectionProps {
  icon?: React.ReactNode;
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function DetailSheetSection({ icon, title, children, className }: DetailSheetSectionProps) {
  return (
    <div className={cn("p-3 sm:p-4 rounded-xl bg-card border border-border shadow-sm px-[16px] py-[16px]", className)}>
      <div className="flex items-center gap-2 mb-2 sm:mb-3">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <p className="text-xs sm:text-sm font-medium text-muted-foreground">{title}</p>
      </div>
      {children}
    </div>
  );
}
