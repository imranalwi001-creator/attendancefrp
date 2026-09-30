import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Camera, CameraOff, Search } from 'lucide-react';
import { toast } from 'sonner';

interface BarcodeScannerProps {
  onScan: (value: string) => void;
  autoStart?: boolean;
}

export function BarcodeScanner({ onScan, autoStart = false }: BarcodeScannerProps) {
  const containerIdRef = useRef('qr-reader-' + Math.random().toString(36).slice(2, 8));
  const containerId = containerIdRef.current;
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [active, setActive] = useState(false);
  const [manual, setManual] = useState('');

  const stop = async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (scanner) {
      try {
        if (scanner.isScanning) await scanner.stop();
      } catch {}
      try {
        scanner.clear();
      } catch {}
    }
    // Bersihkan node yang disuntikkan library agar React tidak konflik saat unmount
    const el = document.getElementById(containerId);
    if (el) el.innerHTML = '';
    setActive(false);
  };

  const lockRef = useRef(false);

  const extractKode = (raw: string): string => {
    const trimmed = raw.trim();
    // Jika QR berisi URL, ambil bagian terakhir setelah '/' atau '='
    const match = trimmed.match(/(LIB-[A-Z0-9]+)/i);
    if (match) return match[1].toUpperCase();
    return trimmed.toUpperCase();
  };

  const start = async () => {
    try {
      const scanner = new Html5Qrcode(containerId, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
        ],
        verbose: false,
      });
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 280, height: 280 },
          aspectRatio: 1,
          videoConstraints: { facingMode: 'environment' },
        } as any,
        (decoded) => {
          if (lockRef.current) return;
          lockRef.current = true;
          const kode = extractKode(decoded);
          console.log('[BarcodeScanner] decoded:', decoded, '→ kode:', kode);
          onScan(kode);
          // Buka kembali lock setelah delay agar bisa scan lagi jika tetap dibuka
          setTimeout(() => {
            lockRef.current = false;
          }, 1500);
        },
        () => {}
      );
      setActive(true);
    } catch (e: any) {
      console.error('[BarcodeScanner] start error:', e);
      toast.error('Tidak bisa mengakses kamera. Gunakan input manual.');
    }
  };

  useEffect(() => {
    if (autoStart) start();
    return () => {
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleManualSubmit = () => {
    if (manual.trim()) {
      onScan(manual.trim().toUpperCase());
      setManual('');
    }
  };

  return (
    <div className="space-y-3">
      {/* Wrapper React-owned, anak diisi/dikosongkan oleh library secara manual */}
      <div className="w-full rounded-xl overflow-hidden bg-muted aspect-square relative [&_video]:!w-full [&_video]:!h-full [&_video]:!object-cover">
        <div id={containerId} className="w-full h-full" />
        {!active && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <Camera className="h-12 w-12 text-muted-foreground/40" />
          </div>
        )}
      </div>

      <div className="flex justify-center gap-2">
        {!active ? (
          <Button onClick={start} className="rounded-xl" size="sm">
            <Camera className="h-4 w-4 mr-2" /> Mulai Scan
          </Button>
        ) : (
          <Button onClick={stop} variant="outline" className="rounded-xl" size="sm">
            <CameraOff className="h-4 w-4 mr-2" /> Stop
          </Button>
        )}
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Atau ketik kode buku (LIB-XXXXXX)"
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
          className="rounded-xl"
        />
        <Button onClick={handleManualSubmit} variant="outline" className="rounded-xl" size="icon">
          <Search className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
