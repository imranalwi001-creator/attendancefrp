import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Camera, Image as ImageIcon, Loader2, ScanLine, X } from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const compressImage = (file: File | Blob, maxWidth = 1600, quality = 0.8): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxWidth / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas tidak didukung'));
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Gagal kompres'))),
        'image/jpeg',
        quality,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Gagal memuat gambar'));
    };
    img.src = url;
  });

export interface ExtractedKDT {
  judul: string | null;
  penulis: string | null;
  penerbit: string | null;
  tahun_terbit: number | null;
  isbn: string | null;
  deskripsi: string | null;
  kategori: string | null;
}

interface Props {
  onExtracted: (data: ExtractedKDT) => void;
  kategoriList: string[];
}

const fileToBase64 = (file: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result as string;
      const base64 = res.includes(',') ? res.split(',')[1] : res;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export function ScanKDTButton({ onExtracted, kategoriList }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [loading, setLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const openCamera = async () => {
    try {
      setPickerOpen(false);
      setCameraStarting(true);
      setCameraOpen(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });
    } catch (e: any) {
      console.error(e);
      toast.error('Tidak bisa mengakses kamera. Pilih file sebagai gantinya.');
      setCameraOpen(false);
    } finally {
      setCameraStarting(false);
    }
  };

  const closeCamera = () => {
    stopCamera();
    setCameraOpen(false);
  };

  useEffect(() => {
    if (!cameraOpen) stopCamera();
    return () => stopCamera();
  }, [cameraOpen]);

  const processBlob = async (blob: Blob) => {
    setLoading(true);
    const tId = toast.loading('Memindai halaman KDT…');
    try {
      const compressed = await compressImage(blob, 1600, 0.8);
      const base64 = await fileToBase64(compressed);

      const { data, error } = await supabase.functions.invoke('extract-buku-kdt', {
        body: { image_base64: base64, kategori_list: kategoriList },
      });

      if (error) {
        const ctx: any = (error as any).context;
        if (ctx?.status === 429) {
          toast.error('Layanan AI sibuk, coba lagi sebentar.', { id: tId });
        } else {
          toast.error('Gagal membaca halaman KDT. Coba foto yang lebih jelas.', { id: tId });
        }
        return;
      }

      const extracted = data?.data as ExtractedKDT | undefined;
      if (!extracted) {
        toast.error('Gagal membaca halaman KDT. Coba foto yang lebih jelas.', { id: tId });
        return;
      }

      if (!extracted.judul && !extracted.isbn) {
        toast.warning('Halaman KDT tidak terdeteksi dengan jelas', { id: tId });
      } else {
        toast.success('Data buku berhasil diekstrak', { id: tId });
      }

      onExtracted(extracted);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Gagal memproses gambar', { id: tId });
    } finally {
      setLoading(false);
    }
  };

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar');
      return;
    }
    setPickerOpen(false);
    await processBlob(file);
  };

  const capturePhoto = async () => {
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
      async (blob) => {
        if (!blob) {
          toast.error('Gagal mengambil foto');
          return;
        }
        closeCamera();
        await processBlob(blob);
      },
      'image/jpeg',
      0.9,
    );
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = '';
        }}
      />
      <Button
        type="button"
        variant="btn_sec"
        size="sm"
        onClick={() => setPickerOpen(true)}
        disabled={loading}
        className="gap-1.5"
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <ScanLine className="h-3.5 w-3.5" />
        )}
        {loading ? 'Memindai…' : 'Scan KDT'}
      </Button>

      {/* Picker: kamera vs galeri */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="rounded-2xl max-w-sm" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <ScanLine className="h-4 w-4 text-primary" /> Scan Halaman KDT
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={openCamera}
              className="rounded-2xl border-2 border-dashed border-border hover:border-primary/60 hover:bg-primary/5 transition-colors p-4 flex flex-col items-center justify-center gap-2 text-center"
            >
              <div className="p-3 rounded-full bg-primary/10">
                <Camera className="h-5 w-5 text-primary" />
              </div>
              <p className="text-xs font-semibold">Buka Kamera</p>
              <p className="text-[10px] text-muted-foreground leading-tight">
                Ambil foto langsung
              </p>
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-2xl border-2 border-dashed border-border hover:border-primary/60 hover:bg-primary/5 transition-colors p-4 flex flex-col items-center justify-center gap-2 text-center"
            >
              <div className="p-3 rounded-full bg-primary/10">
                <ImageIcon className="h-5 w-5 text-primary" />
              </div>
              <p className="text-xs font-semibold">Pilih File</p>
              <p className="text-[10px] text-muted-foreground leading-tight">
                Dari galeri / dokumen
              </p>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Camera modal */}
      <Dialog open={cameraOpen} onOpenChange={(v) => { if (!v) closeCamera(); }}>
        <DialogContent
          className="p-0 max-w-2xl w-[96vw] sm:w-full overflow-hidden rounded-2xl border-0 bg-black"
          aria-describedby={undefined}
        >
          <DialogHeader className="px-4 py-3 border-b border-white/10 bg-black/80">
            <DialogTitle className="text-white text-sm flex items-center gap-2">
              <Camera className="h-4 w-4" /> Ambil Foto Halaman KDT
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
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="w-[85%] h-[75%] rounded-2xl border-2 border-white/40 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
              </div>
              {cameraStarting && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                  <Loader2 className="h-8 w-8 text-white animate-spin" />
                </div>
              )}
            </div>

            <div className="px-4 py-4 bg-black/90 flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={closeCamera}
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
    </>
  );
}
