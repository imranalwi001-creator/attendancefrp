import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type StatCardVariant = 'default' | 'success' | 'warning' | 'destructive';

interface StatCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon | React.ReactNode;
  animationDelay?: number;
  variant?: StatCardVariant;
}

const variantStyles: Record<StatCardVariant, string> = {
  default: 'bg-primary/10 text-primary',
  success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  destructive: 'bg-destructive/10 text-destructive',
};

export function StatCard({ title, value, icon, animationDelay = 0, variant = 'default' }: StatCardProps) {
  // Check if icon is a component (LucideIcon) or a ReactNode
  const isIconComponent = typeof icon === 'function' || (typeof icon === 'object' && icon !== null && '$$typeof' in icon && (icon as any).$$typeof !== Symbol.for('react.element'));
  
  return (
    <Card
      className="border bg-card animate-fade-in"
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={cn("p-2 rounded-lg shrink-0", variantStyles[variant])}>
            {isIconComponent ? (
              React.createElement(icon as LucideIcon, { className: "h-4 w-4" })
            ) : (
              <div className="[&>svg]:h-4 [&>svg]:w-4">{icon}</div>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground truncate">{title}</p>
            <p className="text-xl font-bold">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
