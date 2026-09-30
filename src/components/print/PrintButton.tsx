import React, { useState, useCallback } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Printer, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface PrintButtonProps {
  contentRef: React.RefObject<HTMLDivElement | null>;
  documentTitle?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary' | 'destructive' | 'link' | 'btn_sec' | 'action-edit' | 'action-detail';
  size?: 'default' | 'sm' | 'lg' | 'icon' | 'icon-sm';
  className?: string;
  children?: React.ReactNode;
  onBeforePrint?: () => void;
  onAfterPrint?: () => void;
}

// Wait for all images inside an element to fully load (handles lazy/async images)
async function waitForImages(element: HTMLElement | null): Promise<void> {
  if (!element) return;
  const images = Array.from(element.querySelectorAll('img'));
  await Promise.all(
    images.map((img) => {
      if (img.complete && img.naturalHeight !== 0) return Promise.resolve();
      return new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
        // Safety timeout in case image hangs
        setTimeout(() => resolve(), 3000);
      });
    })
  );
}

export default function PrintButton({
  contentRef,
  documentTitle = 'Dokumen',
  variant = 'default',
  size = 'default',
  className = '',
  children,
  onBeforePrint,
  onAfterPrint,
}: PrintButtonProps) {
  const [isPrinting, setIsPrinting] = useState(false);

  const handlePrint = useReactToPrint({
    contentRef,
    documentTitle,
    onBeforePrint: async () => {
      setIsPrinting(true);
      onBeforePrint?.();
      // Ensure logo & other images are fully loaded before opening print dialog
      await waitForImages(contentRef.current);
    },
    onAfterPrint: () => {
      setIsPrinting(false);
      onAfterPrint?.();
    },
  });

  const onClick = useCallback(() => {
    setIsPrinting(true);
    handlePrint();
  }, [handlePrint]);

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={onClick}
      disabled={isPrinting}
    >
      {isPrinting ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {children ? <span className="text-xs">Memproses...</span> : <span className="ml-2">Memproses...</span>}
        </>
      ) : (
        children || (
          <>
            <Printer className="h-4 w-4 mr-2" />
            Cetak
          </>
        )
      )}
    </Button>
  );
}
