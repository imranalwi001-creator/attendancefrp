import { useState } from 'react';
import { Download, CheckCircle, Share, Smartphone, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { ExtractionCardHeader } from '@/components/ui/extraction-card-header';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { useToast } from '@/hooks/use-toast';

export function InstallAppSettings() {
  const { isInstalled, isIOS, install } = usePWAInstall();
  const { toast } = useToast();
  const [installing, setInstalling] = useState(false);

  const handleInstall = async () => {
    setInstalling(true);
    const result = await install();
    setInstalling(false);

    if (result === 'success') {
      toast({ title: 'Berhasil', description: 'Aplikasi berhasil diinstal!' });
    } else if (result === 'dismissed') {
      toast({ title: 'Dibatalkan', description: 'Instalasi dibatalkan oleh pengguna.' });
    } else {
      toast({
        title: 'Tidak dapat menginstal',
        description: 'Pastikan tidak dalam mode Incognito. Coba muat ulang halaman (Ctrl+Shift+R), tunggu beberapa detik, lalu klik Install.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Card className="overflow-hidden">
      <ExtractionCardHeader
        icon={<Smartphone className="h-4 w-4 text-primary" />}
        title="Install Aplikasi"
      />
      <CardContent className="pt-4 space-y-4">
        <p className="text-sm text-muted-foreground">
          Install LMS Digiss di perangkat Anda agar bisa diakses seperti aplikasi native.
        </p>

        {isInstalled ? (
          <div className="flex items-center gap-3 p-4 rounded-2xl border border-border/50 bg-primary/5">
            <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
            <div className="space-y-0.5">
              <p className="font-medium text-sm">Aplikasi Sudah Terinstal</p>
              <p className="text-xs text-muted-foreground">
                LMS Digiss sudah terpasang di perangkat Anda.
              </p>
            </div>
          </div>
        ) : isIOS ? (
          <Alert>
            <Share className="h-4 w-4" />
            <AlertTitle>Cara Install di iOS</AlertTitle>
            <AlertDescription>
              Ketuk ikon <strong>Share</strong> (kotak dengan panah ke atas) di Safari, lalu pilih <strong>"Tambahkan ke Layar Utama"</strong>.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="flex items-center justify-between p-4 rounded-2xl border border-border/50 bg-muted/30">
            <div className="space-y-1">
              <p className="font-medium">Install Aplikasi</p>
              <p className="text-sm text-muted-foreground">
                Tambahkan ke layar utama perangkat Anda.
              </p>
            </div>
            <Button onClick={handleInstall} disabled={installing}>
              {installing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              {installing ? 'Memproses...' : 'Install'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
