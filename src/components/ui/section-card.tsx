import * as React from "react";
import { cn } from "@/lib/utils";

export interface SectionCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export interface SectionCardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export interface SectionCardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children: React.ReactNode;
}

export interface SectionCardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children: React.ReactNode;
}

export interface SectionCardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export interface SectionCardIconProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const SectionCard = React.forwardRef<HTMLDivElement, SectionCardProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-2xl border-0 shadow-md overflow-hidden bg-card text-card-foreground",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
);
SectionCard.displayName = "SectionCard";

const SectionCardHeader = React.forwardRef<HTMLDivElement, SectionCardHeaderProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex flex-col space-y-1.5 p-6 border-b bg-card",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
);
SectionCardHeader.displayName = "SectionCardHeader";

const SectionCardIcon = React.forwardRef<HTMLDivElement, SectionCardIconProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "p-2 rounded-xl bg-primary/10",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
);
SectionCardIcon.displayName = "SectionCardIcon";

const SectionCardTitle = React.forwardRef<HTMLHeadingElement, SectionCardTitleProps>(
  ({ className, children, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn("text-xl font-semibold leading-none tracking-tight", className)}
      {...props}
    >
      {children}
    </h3>
  )
);
SectionCardTitle.displayName = "SectionCardTitle";

const SectionCardDescription = React.forwardRef<HTMLParagraphElement, SectionCardDescriptionProps>(
  ({ className, children, ...props }, ref) => (
    <p
      ref={ref}
      className={cn("text-sm text-muted-foreground mt-1", className)}
      {...props}
    >
      {children}
    </p>
  )
);
SectionCardDescription.displayName = "SectionCardDescription";

const SectionCardContent = React.forwardRef<HTMLDivElement, SectionCardContentProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("p-6", className)}
      {...props}
    >
      {children}
    </div>
  )
);
SectionCardContent.displayName = "SectionCardContent";

export {
  SectionCard,
  SectionCardHeader,
  SectionCardIcon,
  SectionCardTitle,
  SectionCardDescription,
  SectionCardContent,
};
