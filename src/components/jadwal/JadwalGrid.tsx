import { useState } from 'react';
import { Clock, Plus } from 'lucide-react';
import { Jadwal, Mapel, Kelas, User } from '@/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface JadwalGridProps {
  jadwalList: Jadwal[];
  selectedKelas: string | null;
  mapelList: Mapel[] | any[];
  guruList: User[] | any[];
  onCellClick: (hari: Jadwal['hari'], jam: string) => void;
  onJadwalClick: (jadwal: Jadwal) => void;
}

const HARI_LIST: Jadwal['hari'][] = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const JAM_LIST = [
  '07:30 - 08:15',
  '08:15 - 09:00',
  '09:00 - 09:45',
  '09:45 - 10:30',
  '10:30 - 11:15',
  '11:15 - 12:00',
  '12:00 - 12:45',
  '13:00 - 13:45',
  '13:45 - 14:30',
  '14:30 - 15:15',
  '15:15 - 16:00',
];

export function JadwalGrid({
  jadwalList,
  selectedKelas,
  mapelList,
  guruList,
  onCellClick,
  onJadwalClick,
}: JadwalGridProps) {
  const [hoveredCell, setHoveredCell] = useState<{ hari: string; jam: string } | null>(null);

  const getJadwalForCell = (hari: Jadwal['hari'], jamRange: string) => {
    return jadwalList.filter(j => {
      if (selectedKelas && j.kelasId !== selectedKelas) return false;
      if (j.hari !== hari) return false;
      
      const cellJam = jamRange.split(' - ')[0];
      return j.jamMulai === cellJam;
    });
  };

  const getMapelNama = (mapelId: string) => {
    return mapelList.find(m => m.id === mapelId)?.nama || '';
  };

  const getGuruNama = (guruId: string) => {
    return guruList.find(g => g.id === guruId)?.name || '';
  };

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <div className="min-w-[900px]">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-muted/50">
                <th className="border-b border-r p-3 text-left font-semibold w-[120px] sticky left-0 bg-muted z-20">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Waktu</span>
                  </div>
                </th>
                {HARI_LIST.map(hari => (
                  <th key={hari} className="border-b border-r last:border-r-0 p-3 text-center font-semibold text-sm">
                    <div className="min-w-[160px]">{hari}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {JAM_LIST.map((jam, idx) => (
                <tr key={jam} className={cn("hover:bg-accent/5 transition-colors", idx % 2 === 0 && "bg-muted/10")}>
                  <td className="border-b border-r p-2.5 text-xs font-medium sticky left-0 bg-background z-10">
                    <div className="text-center whitespace-nowrap text-muted-foreground">{jam}</div>
                  </td>
                  {HARI_LIST.map(hari => {
                    const jadwalInCell = getJadwalForCell(hari, jam);
                    const isHovered = hoveredCell?.hari === hari && hoveredCell?.jam === jam;

                    return (
                      <td
                        key={`${hari}-${jam}`}
                        className={cn(
                          'border-b border-r last:border-r-0 p-2 cursor-pointer transition-all relative align-top',
                          isHovered && 'bg-primary/5 ring-2 ring-primary/30 ring-inset',
                          jadwalInCell.length === 0 && 'hover:bg-accent/10'
                        )}
                        onMouseEnter={() => setHoveredCell({ hari, jam })}
                        onMouseLeave={() => setHoveredCell(null)}
                        onDoubleClick={() => onCellClick(hari, jam.split(' - ')[0])}
                      >
                        {jadwalInCell.length === 0 ? (
                          <div className="h-[70px] flex items-center justify-center">
                            <div className="opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity">
                              <div className="flex flex-col items-center gap-1 text-muted-foreground">
                                <Plus className="h-5 w-5" />
                                <span className="text-[10px]">Tambah</span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1.5 min-h-[70px]">
                            {jadwalInCell.map(jadwal => {
                              const mapel = getMapelNama(jadwal.mapelId);
                              const guru = getGuruNama(jadwal.pengampuId);

                              return (
                                <div
                                  key={jadwal.id}
                                  onClick={() => onJadwalClick(jadwal)}
                                  className="group p-2.5 rounded-lg border bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer"
                                >
                                  <div className="space-y-1">
                                    <div className="font-semibold text-sm text-primary truncate">
                                      {mapel}
                                    </div>
                                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                      <span className="truncate">👨‍🏫 {guru}</span>
                                    </div>
                                    {jadwal.ruangan && (
                                      <div className="flex items-center gap-1 pt-0.5">
                                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 h-auto font-normal">
                                          📍 {jadwal.ruangan}
                                        </Badge>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="px-4 py-3 bg-gradient-to-r from-muted/30 to-muted/50 border-t">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-primary">💡 Tip:</span>
          <span className="text-muted-foreground">Klik dua kali pada kolom kosong untuk menambah jadwal baru</span>
        </div>
      </div>
    </div>
  );
}
