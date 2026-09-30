import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm font-medium active:scale-[0.98]",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm active:scale-[0.98]",
        outline: "border border-border bg-card text-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/30 active:scale-[0.98] shadow-2xs",
        secondary: "bg-primary/10 text-primary hover:bg-primary/20 border border-primary/15 active:scale-[0.98]",
        ghost: "text-foreground hover:bg-muted hover:text-primary active:scale-[0.98]",
        link: "text-primary underline-offset-4 hover:underline",
        btn_sec: "rounded-xl border border-primary text-primary bg-background hover:bg-primary hover:text-primary-foreground",
        // Action button variants - modern, clean with smooth transitions
        "action-detail": "border-2 border-primary/30 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground hover:border-primary hover:shadow-lg hover:shadow-primary/20 active:scale-95 transition-all duration-200 rounded-xl",
        "action-edit": "border-2 border-primary/30 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground hover:border-primary hover:shadow-lg hover:shadow-primary/20 active:scale-95 transition-all duration-200 rounded-xl",
        "action-delete": "border-2 border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground hover:border-destructive hover:shadow-lg hover:shadow-destructive/20 active:scale-95 transition-all duration-200 rounded-xl",
        "action-more": "border-2 border-border bg-muted/50 text-muted-foreground hover:bg-muted hover:border-muted-foreground/30 hover:shadow-md active:scale-95 transition-all duration-200 rounded-xl",
        "action-start": "border-2 border-blue-500/30 bg-blue-500/10 text-blue-600 hover:bg-blue-500 hover:text-white hover:border-blue-500 hover:shadow-lg hover:shadow-blue-500/20 active:scale-95 transition-all duration-200 rounded-xl",
        "action-stop": "border-2 border-red-500/30 bg-red-500/10 text-red-600 hover:bg-red-500 hover:text-white hover:border-red-500 hover:shadow-lg hover:shadow-red-500/20 active:scale-95 transition-all duration-200 rounded-xl",
        "action-substitute": "border-2 border-orange-500/30 bg-orange-500/10 text-orange-600 hover:bg-orange-500 hover:text-white hover:border-orange-500 hover:shadow-lg hover:shadow-orange-500/20 active:scale-95 transition-all duration-200 rounded-xl",
        "action-share": "border-2 border-primary/30 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground hover:border-primary hover:shadow-lg hover:shadow-primary/20 active:scale-95 transition-all duration-200 rounded-xl",
        "icon-outline": "border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95 transition-all duration-200 rounded-xl",
      },
      size: {
        default: "h-9 px-4 py-2 text-xs sm:text-sm",
        sm: "h-8 rounded-xl px-3 text-xs",
        lg: "h-11 rounded-xl px-6 text-sm font-semibold",
        icon: "h-9 w-9 rounded-xl",
        "icon-sm": "h-8 w-8 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
