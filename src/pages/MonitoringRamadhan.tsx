import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { RamadhanRekapTable } from "@/components/ramadhan/RamadhanRekapTable";
import {
  useMonitoringRamadhan,
  useRamadhanConfig,
  useRamadhanActivities,
  useSendReminder,
} from "@/hooks/useMonitoringRamadhan";
import { format, addDays, startOfDay } from "date-fns";

export default function MonitoringRamadhan() {
  const navigate = useNavigate();
  const [dateOffset, setDateOffset] = useState(0);

  const { data: config } = useRamadhanConfig();
  const { data: activities = [] } = useRamadhanActivities();

  const selectedDate = useMemo(() => {
    const viewDate = addDays(startOfDay(new Date()), dateOffset);
    return format(viewDate, "yyyy-MM-dd");
  }, [dateOffset]);

  const { data: rekapData = [], isLoading: rekapLoading } = useMonitoringRamadhan(selectedDate);
  const sendReminder = useSendReminder();

  const handleSelectSantri = (id: string) => {
    navigate(`/app/monitoring-ramadhan/${id}`);
  };

  return (
    <div className="space-y-3">
      <PageHeader title="Monitoring Ramadhan" subtitle={config ? `Ramadhan ${config.tahun_hijriah}` : undefined} />

      {rekapLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : (
        <RamadhanRekapTable
          data={rekapData}
          totalActivities={activities.length}
          onSelectSantri={handleSelectSantri}
          onSendReminder={(ids) => sendReminder.mutate(ids)}
          isSending={sendReminder.isPending}
          config={config}
          selectedDate={selectedDate}
          onDayChange={(day) => {
            if (!config) return;
            const start = startOfDay(new Date(config.tanggal_mulai));
            const target = addDays(start, day - 1);
            const today = startOfDay(new Date());
            const diff = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            setDateOffset(diff);
          }}
        />
      )}
    </div>
  );
}
