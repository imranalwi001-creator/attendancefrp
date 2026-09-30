import { useState } from 'react';
import { Bell, BellOff, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { ExtractionCardHeader } from '@/components/ui/extraction-card-header';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { usePushNotification } from '@/hooks/usePushNotification';

export function PushNotificationSettings() {
  const { toast } = useToast();
  const { isSupported, isSubscribed, isLoading, permission, subscribe, unsubscribe } = usePushNotification();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubscribe = async () => {
    setErrorMessage(null);
    try {
      const success = await subscribe();
      if (success) {
        toast({ title: 'Berhasil', description: 'Push notification berhasil diaktifkan' });
      } else {
        if (permission === 'denied') {
          setErrorMessage('Izin notifikasi ditolak. Buka pengaturan browser untuk mengizinkan.');
        } else {
          setErrorMessage('Gagal mengaktifkan. Pastikan browser mendukung dan HTTPS aktif.');
        }
        toast({ title: 'Gagal', description: 'Gagal mengaktifkan push notification', variant: 'destructive' });
      }
    } catch (err) {
      console.error('Subscribe error:', err);
      setErrorMessage(String(err));
      toast({ title: 'Error', description: String(err), variant: 'destructive' });
    }
  };

  const handleUnsubscribe = async () => {
    setErrorMessage(null);
    const success = await unsubscribe();
    if (success) {
      toast({ title: 'Berhasil', description: 'Push notification dinonaktifkan' });
    } else {
      toast({ title: 'Gagal', description: 'Gagal menonaktifkan push notification', variant: 'destructive' });
    }
  };

  return (
    <Card className="overflow-hidden">
      <ExtractionCardHeader
        icon={<Bell className="h-4 w-4 text-primary" />}
        title="Push Notification"
      />
      <CardContent className="pt-4 space-y-4">
        <p className="text-sm text-muted-foreground">
          Aktifkan untuk menerima notifikasi langsung di perangkat Anda.
        </p>
        {!isSupported ? (
          <Alert variant="destructive">
            <BellOff className="h-4 w-4" />
            <AlertTitle>Tidak Didukung</AlertTitle>
            <AlertDescription>Browser Anda tidak mendukung push notification atau bukan HTTPS.</AlertDescription>
          </Alert>
        ) : (
          <>
            <div className="flex items-center justify-between p-4 rounded-2xl border border-border/50 bg-muted/30">
              <div className="space-y-1">
                <p className="font-medium">Status Push Notification</p>
                <p className="text-sm text-muted-foreground">
                  {isSubscribed ? 'Aktif' : 'Nonaktif'}
                </p>
              </div>
              <Button onClick={isSubscribed ? handleUnsubscribe : handleSubscribe} disabled={isLoading} variant={isSubscribed ? 'outline' : 'default'}>
                {isLoading ? 'Memproses...' : isSubscribed ? 'Nonaktifkan' : 'Aktifkan'}
              </Button>
            </div>
            
            {errorMessage && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}
            
            {permission === 'denied' && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Izin Ditolak</AlertTitle>
                <AlertDescription>
                  Anda telah menolak izin notifikasi. Buka pengaturan browser dan izinkan notifikasi untuk situs ini.
                </AlertDescription>
              </Alert>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
