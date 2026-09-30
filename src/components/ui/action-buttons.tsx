import * as React from "react";
import { Button } from "@/components/ui/button";
import { Eye, Trash2, Pencil, Play, Square, UserPlus, MoreVertical, Share2, RefreshCw, Loader2, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActionButtonProps {
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
  disabled?: boolean;
  title?: string;
}

export const DetailButton = React.forwardRef<HTMLButtonElement, ActionButtonProps>(
  ({ onClick, className, disabled, title = "Detail", ...props }, ref) => {
    const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      onClick?.(e);
    };

    return (
      <Button
        ref={ref}
        variant="action-detail"
        size="icon-sm"
        onClick={handleClick}
        disabled={disabled}
        className={cn(className)}
        title={title}
        {...props}
      >
        <Eye className="h-4 w-4" />
      </Button>
    );
  }
);
DetailButton.displayName = "DetailButton";

export const DeleteButton = React.forwardRef<HTMLButtonElement, ActionButtonProps>(
  ({ onClick, className, disabled, title = "Hapus", ...props }, ref) => {
    const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      onClick?.(e);
    };

    return (
      <Button
        ref={ref}
        variant="action-delete"
        size="icon-sm"
        onClick={handleClick}
        disabled={disabled}
        className={cn(className)}
        title={title}
        {...props}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    );
  }
);
DeleteButton.displayName = "DeleteButton";

export const EditButton = React.forwardRef<HTMLButtonElement, ActionButtonProps>(
  ({ onClick, className, disabled, title = "Edit", ...props }, ref) => {
    const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      onClick?.(e);
    };

    return (
      <Button
        ref={ref}
        variant="action-edit"
        size="icon-sm"
        onClick={handleClick}
        disabled={disabled}
        className={cn(className)}
        title={title}
        {...props}
      >
        <Eye className="h-4 w-4" />
      </Button>
    );
  }
);
EditButton.displayName = "EditButton";

export const StartButton = React.forwardRef<HTMLButtonElement, ActionButtonProps>(
  ({ onClick, className, disabled, title = "Mulai", ...props }, ref) => {
    const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      onClick?.(e);
    };

    return (
      <Button
        ref={ref}
        variant="action-start"
        size="icon-sm"
        onClick={handleClick}
        disabled={disabled}
        className={cn(className)}
        title={title}
        {...props}
      >
        <Play className="h-4 w-4" />
      </Button>
    );
  }
);
StartButton.displayName = "StartButton";

export const StopButton = React.forwardRef<HTMLButtonElement, ActionButtonProps>(
  ({ onClick, className, disabled, title = "Akhiri", ...props }, ref) => {
    const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      onClick?.(e);
    };

    return (
      <Button
        ref={ref}
        variant="action-stop"
        size="icon-sm"
        onClick={handleClick}
        disabled={disabled}
        className={cn(className)}
        title={title}
        {...props}
      >
        <Square className="h-4 w-4" />
      </Button>
    );
  }
);
StopButton.displayName = "StopButton";

export const SubstituteButton = React.forwardRef<HTMLButtonElement, ActionButtonProps>(
  ({ onClick, className, disabled, title = "Guru Pengganti", ...props }, ref) => {
    const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      onClick?.(e);
    };

    return (
      <Button
        ref={ref}
        variant="action-substitute"
        size="icon-sm"
        onClick={handleClick}
        disabled={disabled}
        className={cn(className)}
        title={title}
        {...props}
      />
    );
  }
);
SubstituteButton.displayName = "SubstituteButton";

interface SecondaryButtonProps extends ActionButtonProps {
  children?: React.ReactNode;
}

export const SecondaryButton = React.forwardRef<HTMLButtonElement, SecondaryButtonProps>(
  ({ onClick, className, disabled, title, children, ...props }, ref) => {
    const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      onClick?.(e);
    };

    return (
      <Button
        ref={ref}
        variant="btn_sec"
        size="sm"
        onClick={handleClick}
        disabled={disabled}
        className={cn("gap-2", className)}
        title={title}
        {...props}
      >
        {children}
      </Button>
    );
  }
);
SecondaryButton.displayName = "SecondaryButton";

export const MoreButton = React.forwardRef<HTMLButtonElement, ActionButtonProps>(
  ({ onClick, className, disabled, title = "Lainnya", ...props }, ref) => {
    const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      onClick?.(e);
    };

    return (
      <Button
        ref={ref}
        variant="action-more"
        size="icon-sm"
        onClick={handleClick}
        disabled={disabled}
        className={cn(className)}
        title={title}
        {...props}
      >
        <MoreVertical className="h-4 w-4" />
      </Button>
    );
  }
);
MoreButton.displayName = "MoreButton";

export const ShareButton = React.forwardRef<HTMLButtonElement, ActionButtonProps>(
  ({ onClick, className, disabled, title = "Bagikan", ...props }, ref) => {
    const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      onClick?.(e);
    };

    return (
      <Button
        ref={ref}
        variant="action-share"
        size="icon-sm"
        onClick={handleClick}
        disabled={disabled}
        className={cn(className)}
        title={title}
        {...props}
      >
        <Share2 className="h-4 w-4" />
      </Button>
    );
  }
);
ShareButton.displayName = "ShareButton";

interface RefreshButtonProps extends ActionButtonProps {
  isLoading?: boolean;
}

export const RefreshButton = React.forwardRef<HTMLButtonElement, RefreshButtonProps>(
  ({ onClick, className, disabled, title = "Refresh", isLoading, ...props }, ref) => {
    const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      onClick?.(e);
    };

    return (
      <Button
        ref={ref}
        variant="action-edit"
        size="icon-sm"
        onClick={handleClick}
        disabled={disabled || isLoading}
        className={cn(className)}
        title={title}
        {...props}
      >
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
      </Button>
    );
  }
);
RefreshButton.displayName = "RefreshButton";

export const BackButton = React.forwardRef<HTMLButtonElement, ActionButtonProps>(
  ({ onClick, className, disabled, title = "Kembali", ...props }, ref) => {
    const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      onClick?.(e);
    };

    return (
      <Button
        ref={ref}
        variant="ghost"
        size="icon-sm"
        onClick={handleClick}
        disabled={disabled}
        className={cn("rounded-lg", className)}
        title={title}
        {...props}
      >
        <ArrowLeft className="h-4 w-4" />
      </Button>
    );
  }
);
BackButton.displayName = "BackButton";

interface ActionButtonGroupProps {
  children: React.ReactNode;
  className?: string;
}

export const ActionButtonGroup = ({ children, className }: ActionButtonGroupProps) => {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {children}
    </div>
  );
};
