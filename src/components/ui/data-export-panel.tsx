import { FileSpreadsheet, FileText, Sparkles } from 'lucide-react';
import ExportButton from '@/components/ui/export-button';
import { cn } from '@/lib/utils';

interface DataExportPanelProps {
  title?: string;
  description?: string;
  count?: number;
  disabled?: boolean;
  className?: string;
  onExportXlsx: () => void | Promise<void>;
  onExportPdf: () => void | Promise<void>;
}

export function DataExportPanel({
  title = 'Export Data',
  description = 'Unduh data sesuai filter aktif',
  count,
  disabled,
  className,
  onExportXlsx,
  onExportPdf,
}: DataExportPanelProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-2xl border border-slate-200/70 bg-[linear-gradient(135deg,rgba(15,23,42,0.04),rgba(255,255,255,0.88),rgba(20,184,166,0.08))] p-3 shadow-sm backdrop-blur dark:border-white/10 dark:bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(15,23,42,0.72),rgba(20,184,166,0.08))] sm:flex-row sm:items-center sm:justify-between',
        className
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white shadow-sm dark:bg-white dark:text-slate-950">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{title}</p>
            {typeof count === 'number' && (
              <span className="rounded-full border border-border/70 bg-background/70 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {count} baris
              </span>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
        <ExportButton
          className="h-9 justify-center gap-1.5 rounded-xl border-slate-300/80 bg-white/80 px-3 hover:bg-white dark:bg-white/10 dark:hover:bg-white/15"
          variant="outline"
          onClick={onExportXlsx}
          disabled={disabled}
        >
          <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
          <span className="text-xs font-medium">XLSX</span>
        </ExportButton>
        <ExportButton
          className="h-9 justify-center gap-1.5 rounded-xl bg-slate-950 px-3 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-white/90"
          variant="default"
          onClick={onExportPdf}
          disabled={disabled}
        >
          <FileText className="h-3.5 w-3.5" />
          <span className="text-xs font-medium">PDF</span>
        </ExportButton>
      </div>
    </div>
  );
}

export default DataExportPanel;
