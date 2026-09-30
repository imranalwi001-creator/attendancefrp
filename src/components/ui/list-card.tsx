import * as React from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ActionButtonGroup } from '@/components/ui/action-buttons';

export interface ListCardColumn {
  label?: string;
  value: React.ReactNode;
  subValue?: React.ReactNode;
  width?: string;
  className?: string;
}

export interface ListCardBadge {
  label: string;
  variant?: 'default' | 'destructive' | 'secondary' | 'outline' | 'success' | 'warning' | 'pending';
  title?: string; // Optional title above the badge (defaults to nothing)
}

export interface ListCardProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  iconBgColor?: string;
  columns: ListCardColumn[];
  badge?: ListCardBadge;
  actions?: React.ReactNode;
  onDoubleClick?: () => void;
}

const ListCard = React.forwardRef<HTMLDivElement, ListCardProps>(
  ({ className, icon, iconBgColor = 'hsl(var(--primary) / 0.1)', columns, badge, actions, onClick, onDoubleClick, ...props }, ref) => {
    const isImageIcon = React.isValidElement(icon) && typeof icon.type === 'string' && icon.type === 'img';

    return (
      <div
        ref={ref}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        className={cn(
          'rounded-xl border-2 border-border/50 bg-card hover:bg-primary/5 hover:border-primary/20 transition-all duration-300 cursor-pointer',
          'p-3 lg:p-4',
          className
        )}
        {...props}
      >
        {/* Mobile Layout (< lg): Flex Column */}
        <div className="lg:hidden flex items-start gap-2">
          {/* Icon */}
          {icon && (
            <div
              className={cn(
                'shrink-0 flex items-center justify-center mt-0.5 overflow-hidden',
                isImageIcon ? 'h-10 w-10 rounded-lg bg-muted' : 'rounded-lg p-1.5'
              )}
              style={isImageIcon ? undefined : { backgroundColor: iconBgColor }}
            >
              <div className={cn(isImageIcon ? 'h-full w-full' : '[&>svg]:h-4 [&>svg]:w-4 text-primary')}>
                {icon}
              </div>
            </div>
          )}
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Name & Code */}
            {columns.length > 0 && (
              <div className="mb-1">
                <p className="text-sm font-semibold text-foreground truncate">
                  {columns[0].value}
                </p>
                {columns[0].subValue && (
                  <p className="text-xs text-muted-foreground truncate">{columns[0].subValue}</p>
                )}
              </div>
            )}
            
            {/* Mobile Info Row */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
              {columns.slice(1, 3).map((col, idx) => (
                <span key={idx} className="truncate max-w-[120px]">
                  {col.label && <span className="uppercase tracking-wider font-medium text-muted-foreground/70">{col.label}: </span>}
                  <span className="text-foreground/80 font-medium">{col.value}</span>
                </span>
              ))}
            </div>
          </div>
          
          {/* Badge & Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            {badge && (
              <Badge variant={badge.variant || 'default'} className="font-medium text-[9px] px-1.5 py-0.5">
                {badge.label}
              </Badge>
            )}
            {actions && (
              <ActionButtonGroup className="gap-0.5 [&>button]:h-7 [&>button]:w-7 [&>button_svg]:h-3.5 [&>button_svg]:w-3.5">
                {actions}
              </ActionButtonGroup>
            )}
          </div>
        </div>

        {/* Desktop Layout (lg+): Flex-based Table Row */}
        <div className="hidden lg:flex lg:items-center lg:gap-4">
          {/* Identity Group (Icon + Name + Code) */}
          <div className="flex items-center gap-3 min-w-0 flex-[2]">
            {icon && (
              <div
                className={cn(
                  'shrink-0 flex items-center justify-center overflow-hidden',
                  isImageIcon ? 'h-14 w-14 rounded-xl bg-muted' : 'rounded-xl p-2.5'
                )}
                style={isImageIcon ? undefined : { backgroundColor: iconBgColor }}
              >
                <div className={cn(isImageIcon ? 'h-full w-full' : '[&>svg]:h-5 [&>svg]:w-5 text-primary')}>
                  {icon}
                </div>
              </div>
            )}
            {columns.length > 0 && (
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground truncate">
                  {columns[0].value}
                </p>
                {columns[0].subValue && (
                  <p className="text-xs text-muted-foreground truncate">{columns[0].subValue}</p>
                )}
              </div>
            )}
          </div>

          {/* Second Column */}
          {columns[1] && (
            <div className="min-w-0 flex-1 flex flex-col justify-center">
              {columns[1].label && (
                <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground/70 mb-1">{columns[1].label}</p>
              )}
              <p className="text-sm font-medium text-foreground/80 truncate">
                {columns[1].value}
              </p>
            </div>
          )}

          {/* Third Column */}
          {columns[2] && (
            <div className="min-w-0 flex-1">
              {columns[2].label && (
                <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground/70 mb-1">{columns[2].label}</p>
              )}
              <p className="text-sm font-medium text-foreground/80 truncate">
                {columns[2].value}
              </p>
            </div>
          )}

          {/* Badge Status */}
          {badge && (
            <div className="min-w-0 flex-1">
              {badge.title && (
                <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground/70 mb-1">{badge.title}</p>
              )}
              <Badge variant={badge.variant || 'default'} className="font-medium text-xs px-2.5 py-0.5">
                {badge.label}
              </Badge>
            </div>
          )}

          {/* Actions */}
          {actions && (
            <div className="flex items-center justify-end shrink-0">
              <ActionButtonGroup className="gap-1">
                {actions}
              </ActionButtonGroup>
            </div>
          )}
        </div>
      </div>
    );
  }
);

ListCard.displayName = 'ListCard';

export { ListCard };
