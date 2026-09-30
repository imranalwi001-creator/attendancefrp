import * as React from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface DashboardCardProps {
  title: string;
  icon?: LucideIcon;
  onActionClick?: () => void;
  actionIcon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  animationDelay?: number;
}

export const DashboardCard = ({
  title,
  icon: Icon,
  onActionClick,
  actionIcon: ActionIcon,
  children,
  className,
  contentClassName,
  animationDelay = 0,
}: DashboardCardProps) => {
  return (
    <div
      className={cn("animate-fade-in", className)}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <div className="border hover:border-primary/30 transition-all duration-300 shadow-sm rounded-2xl bg-card text-card-foreground h-full">
        <div className="px-6 pt-6 pb-4 border-b border-border/50 bg-gradient-to-br from-primary/10 via-primary/5 to-background rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {Icon && (
                <div className="p-2 rounded-lg bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
              )}
              <h3 className="text-lg font-semibold">{title}</h3>
            </div>
            {onActionClick && ActionIcon && (
              <button
                onClick={onActionClick}
                className="h-9 w-9 rounded-lg border border-border/40 bg-card/50 hover:bg-primary hover:text-primary-foreground hover:border-primary hover:scale-105 transition-all duration-300 flex items-center justify-center"
              >
                <ActionIcon className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        <div className={cn("p-6", contentClassName)}>{children}</div>
      </div>
    </div>
  );
};
