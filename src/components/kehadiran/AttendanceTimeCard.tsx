import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, LogIn, LogOut, LucideIcon } from 'lucide-react';

interface AttendanceTimeCardProps {
  type: 'masuk' | 'pulang';
  time: string | null;
  hasCompleted: boolean;
  isLoading?: boolean;
  onAction: () => void;
  disabled?: boolean;
  disabledMessage?: string;
}

export function AttendanceTimeCard({
  type,
  time,
  hasCompleted,
  isLoading = false,
  onAction,
  disabled = false,
  disabledMessage,
}: AttendanceTimeCardProps) {
  const isMasuk = type === 'masuk';
  const Icon: LucideIcon = isMasuk ? LogIn : LogOut;
  const title = isMasuk ? 'Waktu Masuk' : 'Waktu Pulang';
  const timeLabel = isMasuk ? 'Jam Masuk' : 'Jam Pulang';
  const buttonLabel = isMasuk ? 'Absen Masuk' : 'Absen Pulang';
  const iconBgClass = isMasuk ? 'bg-primary/10' : 'bg-destructive/10';
  const iconClass = isMasuk ? 'text-primary' : 'text-destructive';

  const formatTime = (timeStr: string | null): string => {
    if (!timeStr) return '00:00:00';
    try {
      const date = new Date(timeStr);
      return date.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
    } catch {
      return '00:00:00';
    }
  };

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${iconBgClass}`}>
              <Icon className={`h-5 w-5 ${iconClass}`} />
            </div>
            <CardTitle className="text-lg font-semibold">{title}</CardTitle>
          </div>
          {!isLoading && (
            <Badge variant={hasCompleted ? 'success' : 'secondary'} className="px-3 py-1">
              {hasCompleted ? 'Sudah Absen' : 'Belum Absen'}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <>
            <div className="flex items-center justify-center py-4">
              <div className="text-center">
                <div className="flex items-center gap-2 justify-center text-muted-foreground mb-1">
                  <Clock className="h-4 w-4" />
                  <span className="text-sm">{timeLabel}</span>
                </div>
                <p className="text-4xl font-bold font-mono text-foreground">
                  {formatTime(time)}
                </p>
              </div>
            </div>

            <Button
              className="w-full"
              size="lg"
              variant={!isMasuk && disabled ? 'outline' : 'default'}
              onClick={onAction}
              disabled={disabled}
            >
              <Icon className="h-4 w-4 mr-2" />
              {buttonLabel}
            </Button>

            {disabledMessage && (
              <p className="text-xs text-muted-foreground text-center">
                {disabledMessage}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}