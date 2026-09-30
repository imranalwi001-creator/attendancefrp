import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, CameraOff, Search } from "lucide-react";
import { toast } from "sonner";

export function QrScanner(props: {
  onScan: (value: string) => void;
  autoStart?: boolean;
  placeholder?: string;
  // Extract a token from decoded string (URL or plain token). Return null to ignore.
  extractToken?: (decoded: string) => string | null;
}) {
  const containerIdRef = useRef("qr-reader-" + Math.random().toString(36).slice(2, 8));
  const containerId = containerIdRef.current;
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [active, setActive] = useState(false);
  const [manual, setManual] = useState("");
  const lockRef = useRef(false);

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
    const el = document.getElementById(containerId);
    if (el) el.innerHTML = "";
    setActive(false);
  };

  const defaultExtract = (decoded: string) => {
    const trimmed = decoded.trim();
    const m = trimmed.match(/(TSK-[A-Z0-9]+)/i);
    if (m) return m[1].toUpperCase();
    try {
      const u = new URL(trimmed);
      const token = u.searchParams.get("token");
      if (token) return String(token).toUpperCase();
    } catch {}
    return trimmed ? trimmed.toUpperCase() : null;
  };

  const start = async () => {
    try {
      const scanner = new Html5Qrcode(containerId, {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
      });
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 280, height: 280 }, aspectRatio: 1 } as any,
        (decoded) => {
          if (lockRef.current) return;
          lockRef.current = true;

          const extract = props.extractToken || defaultExtract;
          const token = extract(decoded);
          if (token) props.onScan(token);

          setTimeout(() => {
            lockRef.current = false;
          }, 1200);
        },
        () => {}
      );
      setActive(true);
    } catch (e: any) {
      console.error("[QrScanner] start error:", e);
      toast.error("Tidak bisa mengakses kamera. Gunakan input manual.");
    }
  };

  useEffect(() => {
    if (props.autoStart) void start();
    return () => {
      void stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleManualSubmit = () => {
    const v = manual.trim();
    if (!v) return;
    props.onScan(v.toUpperCase());
    setManual("");
  };

  return (
    <div className="space-y-3">
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
          placeholder={props.placeholder || "Atau ketik token (TSK-XXXXXX)"}
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleManualSubmit()}
          className="rounded-xl"
        />
        <Button onClick={handleManualSubmit} variant="outline" className="rounded-xl" size="icon">
          <Search className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

