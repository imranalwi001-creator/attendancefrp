import React, { useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ExportButtonProps {
  onClick: () => void | Promise<void>;
  disabled?: boolean;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary' | 'destructive' | 'link' | 'btn_sec';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  children: React.ReactNode;
  loadingText?: string;
}

export default function ExportButton({
  onClick,
  disabled = false,
  variant = 'btn_sec',
  size = 'sm',
  className = '',
  children,
  loadingText = 'Memproses...',
}: ExportButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = useCallback(async () => {
    setIsLoading(true);
    try {
      await onClick();
    } finally {
      setTimeout(() => setIsLoading(false), 500);
    }
  }, [onClick]);

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={handleClick}
      disabled={disabled || isLoading}
    >
      {isLoading ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span className="text-xs">{loadingText}</span>
        </>
      ) : (
        children
      )}
    </Button>
  );
}
