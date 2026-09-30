import * as React from "react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface SantriListCardColumn {
  label: string;
  value: React.ReactNode;
  colSpan?: number;
}

interface SantriListCardProps {
  avatar?: string;
  name: string;
  subtitle: string;
  columns?: SantriListCardColumn[];
  mobileDetail?: React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  onClick?: () => void;
  className?: string;
  animationDelay?: string;
}

function SantriListCard({
  avatar,
  name,
  subtitle,
  columns,
  mobileDetail,
  badge,
  actions,
  onClick,
  className,
  animationDelay,
}: SantriListCardProps) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);

  return (
    <div
      className={cn(
        "p-3 lg:px-4 lg:py-3 rounded-xl border border-border/50 hover:border-primary/20 hover:bg-muted/30 transition-all duration-300 animate-fade-in",
        onClick && "cursor-pointer",
        className
      )}
      style={animationDelay ? { animationDelay } : undefined}
      onClick={onClick}
    >
      {/* Mobile Layout (< lg) */}
      <div className="lg:hidden">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 flex-shrink-0">
            <AvatarImage src={avatar} />
            <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-foreground truncate">{name}</h3>
            <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
          </div>
          {badge}
        </div>
        {mobileDetail && (
          <div className="mt-2 pl-[52px]">{mobileDetail}</div>
        )}
      </div>

      {/* Desktop Layout (lg+) - 12 Column Grid */}
      <div className="hidden lg:grid lg:grid-cols-12 lg:gap-4 lg:items-center">
        {/* Identity Group */}
        <div className="col-span-4 flex items-center gap-3 min-w-0">
          <Avatar className="h-10 w-10 flex-shrink-0">
            <AvatarImage src={avatar} />
            <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground truncate" title={name}>
              {name}
            </h3>
            <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
          </div>
        </div>

        {/* Dynamic Columns */}
        {columns?.map((col, index) => (
          <div key={index} className={cn("min-w-0", col.colSpan ? `col-span-${col.colSpan}` : "col-span-3")}>
            <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground mb-1">
              {col.label}
            </p>
            <div className="text-sm font-semibold text-foreground truncate">
              {col.value}
            </div>
          </div>
        ))}

        {/* Badge & Actions */}
        {(badge || actions) && (
          <div className="col-span-2 flex items-center justify-end gap-4">
            {badge}
            {actions && (
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                {actions}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export { SantriListCard };
export type { SantriListCardProps, SantriListCardColumn };
