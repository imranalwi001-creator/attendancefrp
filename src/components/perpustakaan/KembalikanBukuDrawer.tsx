import { useState, useRef, useEffect } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from '@/components/ui/drawer';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, BookOpen, Camera, Upload, X, MapPin, Loader2, Image as ImageIcon, RotateCcw } from 'lucide-react';
import { Peminjaman, useReturnByStudent } from '@/hooks/usePerpustakaan';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  peminjaman: Peminjaman | null;
}

export function KembalikanBukuDrawer({ open, onOpenChange, peminjaman }: Props) {
  const { user } = useAuth();
  const returnMut = useReturnByStudent();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const startCamera = async () => {
    try {
      setCameraStarting(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);
      // wait for video element mount
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });
    } catch (e: any) {
      console.error('[KembalikanBukuDrawer] camera error:', e);
      toast.error('Tidak bisa mengakses kamera. Pilih dari galeri sebagai gantinya.');
    } finally {
      setCameraStarting(false);
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      toast.error('Kamera belum siap');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          toast.error('Gagal mengambil foto');
          return;
        }
        const f = new File([blob], `pengembalian-${Date.now()}.jpg`, { type: 'image/jpeg' });
        setFile(f);
        setPreview(URL.createObjectURL(blob));
        stopCamera();
      },
      'image/jpeg',
      0.85,
    );
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    stopCamera();
  };

  const handleFile = (f: File) => {
    if (!f.type.startsWith('image/')) {
      toast.error('File harus berupa gambar');
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      toast.error('Ukuran maksimal 5MB');
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  useEffect(() => {
    if (!open) {
      stopCamera();
    }
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSubmit = async () => {
    if (!peminjaman || !file || !user?.id) {
      toast.error('Foto bukti wajib diunggah');
      return;
    }
    try {
      setUploading(true);
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${user.id}/pengembalian-buku/${peminjaman.id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('user-documents')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: signed } = await supabase.storage
        .from('user-documents')
        .createSignedUrl(path, 60 * 60 * 24 * 365);

      await returnMut.mutateAsync({
        id: peminjaman.id,
        bukti_url: signed?.signedUrl || path,
      });
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || 'Gagal mengirim pengembalian');
    } finally {
      setUploading(false);
    }
  };

  const buku = peminjaman?.buku;

  return (
    <Drawer open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DrawerContent className="rounded-t-2xl max-h-[92vh]">
        <DrawerHeader className="border-b">
          <DrawerTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" /> Kembalikan Buku
          </DrawerTitle>
        </DrawerHeader>

        <div className="overflow-y-auto px-4 py-4 space-y-4">
          {/* Info Buku */}
          {buku && (
            <div className="rounded-2xl border-2 border-border/60 bg-card p-3 flex gap-3">
              <div className="w-16 h-20 rounded-lg overflow-hidden bg-muted shrink-0">
                {buku.cover_url ? (
                  <img src={buku.cover_url} alt={buku.judul} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <BookOpen className="h-6 w-6 text-muted-foreground/40" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="font-semibold text-sm leading-snug line-clamp-2">{buku.judul}</p>
                <p className="text-[11px] text-muted-foreground">{buku.kode_buku}</p>
                {buku.lokasi_rak && (
                  <div className="inline-flex items-center gap-1 rounded-md bg-primary/10 text-primary px-2 py-0.5 text-[11px] font-semibold">
                    <MapPin className="h-3 w-3" /> Rak: {buku.lokasi_rak}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Alert Penting */}
          <Alert variant="destructive" className="border-2">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="text-sm font-bold">Wajib Dikembalikan ke Rak yang Sesuai!</AlertTitle>
            <AlertDescription className="text-xs leading-relaxed mt-1">
              Mohon kembalikan buku ini ke{' '}
              <span className="font-semibold">
                {buku?.lokasi_rak ? `rak "${buku.lokasi_rak}"` : 'rak asalnya'}
              </span>
              . Foto bukti pengembalian harus menunjukkan buku sudah berada di rak yang benar agar dapat
              diverifikasi oleh petugas perpustakaan.
            </AlertDescription>
          </Alert>

          {/* Upload Foto */}
          <div className="space-y-2">
            <label className="text-sm font-semibold">Foto Bukti Pengembalian</label>

            {preview ? (
              <div className="relative rounded-2xl overflow-hidden border-2 border-border/60">
                <img src={preview} alt="Preview" className="w-full max-h-72 object-contain bg-muted" />
                <button
                  type="button"
                  onClick={reset}
                  className="absolute top-2 right-2 bg-background/90 hover:bg-background rounded-full p-1.5 shadow-md"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={startCamera}
                  disabled={cameraStarting}
                  className="w-full rounded-2xl border-2 border-dashed border-border hover:border-primary/60 hover:bg-primary/5 transition-colors p-6 flex flex-col items-center justify-center gap-2 text-center disabled:opacity-60"
                >
                  <div className="p-3 rounded-full bg-primary/10">
                    {cameraStarting ? (
                      <Loader2 className="h-6 w-6 text-primary animate-spin" />
                    ) : (
                      <Camera className="h-6 w-6 text-primary" />
                    )}
                  </div>
                  <p className="text-sm font-semibold">
                    {cameraStarting ? 'Membuka kamera...' : 'Buka Kamera'}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Ambil foto buku langsung di rak yang sesuai
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="w-full rounded-xl border border-border hover:bg-muted/50 transition-colors py-2.5 flex items-center justify-center gap-2 text-xs font-medium text-muted-foreground"
                >
                  <ImageIcon className="h-4 w-4" /> Atau pilih dari galeri
                </button>
              </div>
            )}

            {/* Camera capture modal */}
            <Dialog open={cameraActive} onOpenChange={(v) => { if (!v) stopCamera(); }}>
              <DialogContent
                className="p-0 max-w-2xl w-[96vw] sm:w-full overflow-hidden rounded-2xl border-0 bg-black"
                aria-describedby={undefined}
              >
                <DialogHeader className="px-4 py-3 border-b border-white/10 bg-black/80">
                  <DialogTitle className="text-white text-sm flex items-center gap-2">
                    <Camera className="h-4 w-4" /> Ambil Foto Bukti
                  </DialogTitle>
                </DialogHeader>

                <div className="relative bg-black">
                  <div className="relative w-full aspect-[3/4] sm:aspect-video max-h-[70vh] overflow-hidden">
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      autoPlay
                      className="w-full h-full object-cover"
                    />
                    {/* Framing overlay */}
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="w-[80%] h-[70%] rounded-2xl border-2 border-white/40 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
                    </div>
                  </div>

                  <div className="px-4 py-4 bg-black/90 flex items-center justify-between gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={stopCamera}
                      className="rounded-xl bg-transparent border-white/30 text-white hover:bg-white/10 hover:text-white"
                    >
                      <X className="h-4 w-4 mr-1.5" /> Batal
                    </Button>

                    <button
                      type="button"
                      onClick={capturePhoto}
                      aria-label="Ambil foto"
                      className="relative h-16 w-16 rounded-full bg-white border-4 border-white/40 active:scale-95 transition-transform shadow-lg flex items-center justify-center"
                    >
                      <span className="h-12 w-12 rounded-full bg-white border-2 border-black/20" />
                    </button>

                    <div className="w-[88px]" />
                  </div>
                </div>
              </DialogContent>
            </Dialog>


            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = '';
              }}
            />
          </div>
        </div>

        <DrawerFooter className="border-t flex-row gap-2">
          <Button
            variant="outline"
            className="flex-1 rounded-xl"
            onClick={() => onOpenChange(false)}
            disabled={uploading || returnMut.isPending}
          >
            Batal
          </Button>
          <Button
            className="flex-1 rounded-xl"
            onClick={handleSubmit}
            disabled={!file || uploading || returnMut.isPending}
          >
            {uploading || returnMut.isPending ? (
              <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Mengirim...</>
            ) : (
              <><Upload className="h-4 w-4 mr-1.5" /> Kirim Pengembalian</>
            )}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
