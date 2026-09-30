import { Card } from '@/components/ui/card';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { BookOpen } from 'lucide-react';
type MapelSidebarItem = {
  mapel_id: string;
  mapel_nama: string;
  is_finalized: boolean;
  finalized_count: number;
  total_santri: number;
};
interface RekapNilaiMapelSidebarProps {
  items: MapelSidebarItem[];
}

/**
 * Sidebar khusus daftar mapel untuk Rekap Nilai.
 * NOTE: Jangan pakai `overflow-hidden` di Card wrapper karena bisa meng-clip scrollbar Radix.
 */
export function RekapNilaiMapelSidebar({
  items
}: RekapNilaiMapelSidebarProps) {
  return <aside className="hidden lg:flex flex-col w-80 shrink-0 self-stretch">
      <Card className="rounded-2xl border-0 shadow-md flex flex-col h-full">
        {/* Header - matching content header gradient style */}
        <div className="relative overflow-hidden shrink-0 rounded-t-2xl">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-primary/10 to-transparent" />
          <div className="relative px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                
                <span className="font-semibold text-foreground text-sm">Mata Pelajaran</span>
              </div>
              <Badge variant="secondary" className="bg-primary/10 text-primary text-xs border-0 px-2">
                {items.length}
              </Badge>
            </div>
          </div>
        </div>

        {/* List container - flex-1 + min-h-0 + overflow-y-auto for scroll */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-2 pb-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/30">
          {/* TabsList inside scrollable container */}
          <TabsList className="flex w-full flex-col items-stretch justify-start gap-1 bg-transparent p-0 h-auto">
            {items.map((mapel, index) => <TabsTrigger key={mapel.mapel_id} value={mapel.mapel_id} className="group w-full justify-start rounded-xl py-3 px-3 text-sm font-medium text-left border border-transparent data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-primary/20 data-[state=inactive]:hover:bg-muted/80 data-[state=inactive]:hover:border-border transition-all duration-200">
                <div className="flex items-start gap-2.5 w-full min-w-0">
                  <span className="mt-0.5 flex items-center justify-center w-6 h-6 rounded-md bg-muted group-data-[state=active]:bg-primary/20 text-[11px] font-bold shrink-0 text-muted-foreground group-data-[state=active]:text-primary">
                    {index + 1}
                  </span>
                  <div className="flex flex-col items-start min-w-0 flex-1 gap-0.5">
                    <span className="w-full text-left text-[13px] leading-snug whitespace-normal break-words line-clamp-2">
                      {mapel.mapel_nama}
                    </span>
                    <div className="flex items-center gap-1">
                      {mapel.is_finalized ? <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Finalisasi
                        </span> : mapel.finalized_count > 0 ? <span className="inline-flex items-center gap-1 text-[10px] text-amber-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          {mapel.finalized_count}/{mapel.total_santri}
                        </span> : <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
                          Belum dinilai
                        </span>}
                    </div>
                  </div>
                </div>
              </TabsTrigger>)}
          </TabsList>
        </div>
      </Card>
    </aside>;
}