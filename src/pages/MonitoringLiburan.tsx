import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { LiburanRekapTable } from "@/components/liburan/LiburanRekapTable";
import {
  useMonitoringLiburan,
  useLiburanConfigMonitoring,
  useLiburanActivitiesMonitoring,
  useLiburanSendReminder,
} from "@/hooks/useMonitoringLiburan";
import { format, addDays, startOfDay } from "date-fns";

export default function MonitoringLiburan() {
  const navigate = useNavigate();
  const [dateOffset, setDateOffset] = useState(0);

  const { data: config } = useLiburanConfigMonitoring();
  const { data: activities = [] } = useLiburanActivitiesMonitoring();

  const selectedDate = useMemo(() => {
    const viewDate = addDays(startOfDay(new Date()), dateOffset);
    return format(viewDate, "yyyy-MM-dd");
  }, [dateOffset]);

  const { data: rekapData = [], isLoading: rekapLoading } = useMonitoringLiburan(selectedDate);
  const sendReminder = useLiburanSendReminder();

  const handleSelectSantri = (id: string) => {
    navigate(`/app/monitoring-liburan/${id}`);
  };

  return (
    <div className="space-y-3">
      <PageHeader title="Kontroling Liburan" subtitle={config ? config.nama : undefined} />

      {rekapLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : (
        <LiburanRekapTable
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
