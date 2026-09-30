import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Plus, Calendar } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RenderedEvent } from '@/hooks/useKalenderEvents';

interface DateDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date | null;
  events: RenderedEvent[];
  onAddEvent: () => void;
  onEventClick?: (event: RenderedEvent) => void;
}

export function DateDetailModal({
  open,
  onOpenChange,
  date,
  events,
  onAddEvent,
  onEventClick,
}: DateDetailModalProps) {
  if (!date) return null;

  const formattedDate = format(date, 'EEEE, d MMMM yyyy', { locale: localeId });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] p-0 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 border-b">
          <DialogHeader className="px-6 pt-6 pb-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              <DialogTitle className="text-lg font-semibold">
                {formattedDate}
              </DialogTitle>
            </div>
          </DialogHeader>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {events.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Tidak ada agenda pada tanggal ini</p>
            </div>
          ) : (
            <div className="space-y-3">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="p-4 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => onEventClick?.(event)}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-3 h-3 rounded-full mt-1.5 shrink-0"
                      style={{ backgroundColor: event.warna }}
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-foreground">{event.judul}</h4>
                      <div className="mt-2">
                        <Badge
                          variant="outline"
                          className="text-xs"
                          style={{
                            borderColor: event.warna,
                            color: event.warna,
                          }}
                        >
                          {event.kategoriNama}
                        </Badge>
                      </div>
                      {event.deskripsi && (
                        <p className="text-sm text-muted-foreground mt-2">
                          {event.deskripsi}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-4 border-t bg-muted/30">
          <div className="flex justify-between gap-3">
            <Button
              type="button"
              onClick={onAddEvent}
              className="rounded-xl bg-primary hover:bg-primary/90 text-xs sm:text-sm h-9 sm:h-10"
            >
              <Plus className="h-4 w-4 mr-2" />
              Tambah Agenda
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl border-border text-muted-foreground hover:bg-muted text-xs sm:text-sm h-9 sm:h-10"
            >
              Tutup
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
