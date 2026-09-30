import * as React from "react";
import { cn } from "@/lib/utils";

interface ContentCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

interface ContentCardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

interface ContentCardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children: React.ReactNode;
}

interface ContentCardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children: React.ReactNode;
}

interface ContentCardBodyProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

interface ContentCardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const ContentCard = React.forwardRef<HTMLDivElement, ContentCardProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-xl sm:rounded-3xl border shadow-md sm:shadow-lg overflow-hidden bg-card text-card-foreground",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
);
ContentCard.displayName = "ContentCard";

const ContentCardHeader = React.forwardRef<HTMLDivElement, ContentCardHeaderProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "bg-gradient-to-br from-muted/50 via-muted/30 to-background px-4 sm:px-6 py-3 sm:py-3.5 border-b",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
);
ContentCardHeader.displayName = "ContentCardHeader";

const ContentCardTitle = React.forwardRef<HTMLHeadingElement, ContentCardTitleProps>(
  ({ className, children, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn("text-xl font-bold text-foreground", className)}
      {...props}
    >
      {children}
    </h3>
  )
);
ContentCardTitle.displayName = "ContentCardTitle";

const ContentCardDescription = React.forwardRef<HTMLParagraphElement, ContentCardDescriptionProps>(
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
ContentCardDescription.displayName = "ContentCardDescription";

const ContentCardBody = React.forwardRef<HTMLDivElement, ContentCardBodyProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("px-4 sm:px-6 py-3 sm:py-4", className)}
      {...props}
    >
      {children}
    </div>
  )
);
ContentCardBody.displayName = "ContentCardBody";

const ContentCardFooter = React.forwardRef<HTMLDivElement, ContentCardFooterProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("p-4 sm:p-6 pt-0 flex items-center", className)}
      {...props}
    >
      {children}
    </div>
  )
);
ContentCardFooter.displayName = "ContentCardFooter";

export {
  ContentCard,
  ContentCardHeader,
  ContentCardTitle,
  ContentCardDescription,
  ContentCardBody,
  ContentCardFooter,
};
