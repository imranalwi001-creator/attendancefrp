import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Button } from '@/components/ui/button';
import { Download, Printer } from 'lucide-react';

interface BarcodeDisplayProps {
  value: string;
  title?: string;
  size?: number;
}

export function BarcodeDisplay({ value, title, size = 200 }: BarcodeDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    if (!canvasRef.current || !value) return;
    QRCode.toCanvas(canvasRef.current, value, { width: size, margin: 2 }, (err) => {
      if (!err && canvasRef.current) {
        setDataUrl(canvasRef.current.toDataURL('image/png'));
      }
    });
  }, [value, size]);

  const handleDownload = () => {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${value}.png`;
    a.click();
  };

  const handlePrint = () => {
    if (!dataUrl) return;
    const w = window.open('', '_blank', 'width=400,height=500');
    if (!w) return;
    w.document.write(`
      <html><head><title>${value}</title>
      <style>
        body{font-family:system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;padding:16px}
        .label{border:2px dashed #ccc;padding:16px;text-align:center;border-radius:12px}
        img{display:block;margin:0 auto 8px}
        h2{margin:0 0 4px;font-size:14px}
        code{font-size:12px;color:#666}
      </style></head><body>
      <div class="label">
        <img src="${dataUrl}" width="${size}" height="${size}" />
        <h2>${title || ''}</h2>
        <code>${value}</code>
      </div>
      <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),300)}</script>
      </body></html>
    `);
    w.document.close();
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="rounded-xl border bg-card p-4 flex flex-col items-center"
        style={{ width: size + 32 }}
      >
        <canvas ref={canvasRef} className="block mx-auto" />
        {title && (
          <p className="mt-2 text-center text-xs font-medium text-foreground line-clamp-2 break-words w-full">
            {title}
          </p>
        )}
        <p className="text-center text-[10px] text-muted-foreground font-mono w-full truncate">
          {value}
        </p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="rounded-xl" onClick={handleDownload}>
          <Download className="h-3.5 w-3.5 mr-1.5" /> Unduh
        </Button>
        <Button size="sm" variant="outline" className="rounded-xl" onClick={handlePrint}>
          <Printer className="h-3.5 w-3.5 mr-1.5" /> Cetak
        </Button>
      </div>
    </div>
  );
}
