import * as React from "react";
import { cn } from "@/lib/utils";

interface CardListPriColumn {
  label: string;
  value: string;
}

interface CardListPriProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  columns?: CardListPriColumn[];
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
}

const CardListPri = React.forwardRef<HTMLDivElement, CardListPriProps>(
  ({ className, icon, title, subtitle, columns, badge, actions, footer, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col rounded-xl border border-border/50 bg-card p-3 shadow-sm",
          className
        )}
        {...props}
      >
        <div className="flex items-start gap-3">
          {icon && <div className="flex-shrink-0">{icon}</div>}
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{title}</p>
                {subtitle && (
                  <p className="text-xs text-muted-foreground">{subtitle}</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {badge}
                {actions}
              </div>
            </div>
            {columns && columns.length > 0 && (
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {columns.map((col, idx) => (
                  <div key={idx} className="flex items-center gap-1">
                    <span className="text-[11px] text-muted-foreground">{col.label}</span>
                    <span className="text-xs font-medium text-foreground">{col.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        {footer && <div className="mt-2 pl-11">{footer}</div>}
      </div>
    );
  }
);

CardListPri.displayName = "CardListPri";

export { CardListPri };
