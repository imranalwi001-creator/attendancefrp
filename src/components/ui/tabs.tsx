import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
const Tabs = TabsPrimitive.Root;
const tabsListVariants = cva("inline-flex items-center justify-center text-muted-foreground w-full", {
  variants: {
    variant: {
      default: "h-9 sm:h-10 rounded-md bg-muted p-0.5 sm:p-1",
      tabs: "h-10 sm:h-12 rounded-lg sm:rounded-xl bg-muted/50 p-0.5 sm:p-1 border border-border/50",
      admin: "grid gap-1 sm:gap-2 rounded-xl sm:rounded-2xl bg-card border border-border p-1.5 sm:p-2 shadow-sm h-auto",
      panel: "flex w-full rounded-xl bg-card border border-border h-14 p-0 divide-x divide-border overflow-x-auto text-foreground relative"
    }
  },
  defaultVariants: {
    variant: "default"
  }
});
const TabsList = React.forwardRef<React.ElementRef<typeof TabsPrimitive.List>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> & VariantProps<typeof tabsListVariants>>(({
  className,
  variant,
  ...props
}, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(tabsListVariants({ variant }), className)}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;
const tabsTriggerVariants = cva("inline-flex items-center justify-center whitespace-nowrap text-xs sm:text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50", {
  variants: {
    variant: {
      default: "rounded-sm px-2 sm:px-3 py-1 sm:py-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
      tabs: "rounded-md sm:rounded-lg px-2.5 sm:px-4 py-1.5 sm:py-2 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-md",
      admin: "rounded-lg sm:rounded-xl py-2 sm:py-3 px-2.5 sm:px-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg data-[state=inactive]:hover:bg-muted transition-all duration-300 font-medium",
      panel: "group relative flex-1 min-w-[140px] h-full rounded-none px-6 gap-2 text-muted-foreground text-sm font-medium transition-all duration-300 ease-out hover:text-foreground hover:bg-muted/40 [&_svg]:transition-all [&_svg]:duration-300 hover:[&_svg]:scale-110 data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:bg-gradient-to-b data-[state=active]:from-primary/[0.08] data-[state=active]:via-primary/[0.03] data-[state=active]:to-transparent data-[state=active]:[&_svg]:text-primary first:data-[state=active]:rounded-tl-[11px] last:data-[state=active]:rounded-tr-[11px] data-[state=active]:after:absolute data-[state=active]:after:-top-px data-[state=active]:after:inset-x-0 data-[state=active]:after:h-[3px] data-[state=active]:after:bg-primary data-[state=active]:after:shadow-[0_2px_8px_-1px_hsl(var(--primary)/0.5)] data-[state=active]:after:z-10 first:data-[state=active]:after:rounded-tl-xl last:data-[state=active]:after:rounded-tr-xl"
    }
  },
  defaultVariants: {
    variant: "default"
  }
});
const TabsTrigger = React.forwardRef<React.ElementRef<typeof TabsPrimitive.Trigger>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> & VariantProps<typeof tabsTriggerVariants>>(({
  className,
  variant,
  ...props
}, ref) => <TabsPrimitive.Trigger ref={ref} className={cn(tabsTriggerVariants({
  variant
}), className)} {...props} />);
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;
const TabsContent = React.forwardRef<React.ElementRef<typeof TabsPrimitive.Content>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>>(({
  className,
  ...props
}, ref) => <TabsPrimitive.Content ref={ref} className={cn("mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", className)} {...props} />);
TabsContent.displayName = TabsPrimitive.Content.displayName;
export { Tabs, TabsList, TabsTrigger, TabsContent };