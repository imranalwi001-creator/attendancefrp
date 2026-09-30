import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
const badgeVariants = cva("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2", {
  variants: {
    variant: {
      default: "border-transparent bg-primary/10 text-primary hover:bg-primary/20",
      secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
      destructive: "border-transparent bg-destructive/10 text-destructive hover:bg-destructive/20",
      outline: "border-muted-foreground/20 text-muted-foreground bg-transparent",
      success: "border-transparent bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      warning: "border-transparent bg-amber-500/10 text-amber-600 dark:text-amber-400",
      pending: "border-transparent bg-muted/60 text-muted-foreground hover:bg-muted/80",
      "ta-badge": "border-primary/20 bg-primary/10 text-primary text-xs px-1.5 py-0 font-medium",
      // Role variants
      "role-admin": "border-transparent bg-destructive/10 text-destructive",
      "role-guru": "border-transparent bg-primary/10 text-primary",
      "role-walikelas": "border-transparent bg-secondary text-secondary-foreground",
      "role-santri": "border-transparent bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      "role-orangtua": "border-transparent bg-amber-500/10 text-amber-600 dark:text-amber-400",
      "role-pembina": "border-transparent bg-blue-500/10 text-blue-600 dark:text-blue-400",
      "role-staff": "border-transparent bg-violet-500/10 text-violet-600 dark:text-violet-400",
      "role-guru_ekskul": "border-transparent bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400"
    }
  },
  defaultVariants: {
    variant: "default"
  }
});
export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}
const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(({
  className,
  variant,
  ...props
}, ref) => {
  return (
    <div ref={ref} className={cn(badgeVariants({ variant }), className)} {...props} />
  );
});
Badge.displayName = "Badge";
export { Badge, badgeVariants };