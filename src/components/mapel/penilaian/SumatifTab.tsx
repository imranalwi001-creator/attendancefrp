import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Award, GraduationCap, User, Download, Save, RotateCcw, Lock } from 'lucide-react';

interface SumatifDataItem {
  santri_id: string;
  nama: string;
  sumatif: (number | null)[];
  non_tes: number | null;
  tes: number | null;
  na_lingkup: number;
  na_semester: number | null;
  nilai_rapor: number;
  is_finalized?: boolean;
  finalized_at?: string | null;
  finalized_by?: string | null;
  db_id?: string | null;
}

interface SumatifData {
  [santriId: string]: SumatifDataItem;
}

interface SumatifTabProps {
  mapelInfo: any;
  materiList: any[];
  santriList: any[];
  sumatifData: SumatifData;
  editedCells: Set<string>;
  isSaving: boolean;
  onSumatifChange: (santriId: string, index: number, value: string) => void;
  onNonTesChange: (santriId: string, value: string) => void;
  onTesChange: (santriId: string, value: string) => void;
  onAutoSave: () => Promise<void>;
  onExport: () => void;
  onResetClick: () => void;
  onFinalisasiClick: () => void;
  isAllFilled: boolean;
  renderTabsList: () => React.ReactNode;
}

export default function SumatifTab({
  mapelInfo,
  materiList,
  santriList,
  sumatifData,
  editedCells,
  isSaving,
  onSumatifChange,
  onNonTesChange,
  onTesChange,
  onAutoSave,
  onExport,
  onResetClick,
  onFinalisasiClick,
  isAllFilled,
  renderTabsList,
}: SumatifTabProps) {
  const hasMateri = materiList && materiList.length > 0;
  const hasSantri = santriList.length > 0;

  // Empty State - No Materi
  if (!hasMateri) {
    return (
      <Card className="border-2 rounded-2xl overflow-hidden">
        <CardContent className="p-6 space-y-6">
          {renderTabsList()}
          <div className="text-center py-16">
            <div className="inline-flex p-4 rounded-2xl bg-muted/50 mb-4">
              <GraduationCap className="h-12 w-12 text-muted-foreground/30" />
            </div>
            <p className="text-base font-medium text-muted-foreground mb-2">Belum ada Materi</p>
            <p className="text-sm text-muted-foreground/70 max-w-sm mx-auto">Silakan tambahkan Materi terlebih dahulu di tab Materi</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Empty State - No Santri
  if (!hasSantri) {
    return (
      <Card className="border-2 rounded-2xl overflow-hidden">
        <CardContent className="p-6 space-y-6">
          {renderTabsList()}
          <div className="text-center py-16">
            <div className="inline-flex p-4 rounded-2xl bg-muted/50 mb-4">
              <User className="h-12 w-12 text-muted-foreground/30" />
            </div>
            <p className="text-base font-medium text-muted-foreground mb-2">Belum ada Santri di Kelas Ini</p>
            <p className="text-sm text-muted-foreground/70 max-w-sm mx-auto">Tambahkan santri ke kelas untuk mulai melakukan asesmen sumatif</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const materiCount = materiList?.length || 0;

  return (
    <Card className="border-2 rounded-2xl overflow-hidden">
      <CardHeader className="border-b bg-gradient-to-r from-muted/30 to-muted/10 px-6 py-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {renderTabsList()}
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={onExport} className="gap-2">
              <Download className="h-4 w-4" />Ekspor
            </Button>
            <Button variant="outline" size="sm" onClick={onResetClick} className="gap-2 text-destructive hover:text-destructive">
              <RotateCcw className="h-4 w-4" />Reset
            </Button>
            <Button onClick={onAutoSave} disabled={isSaving || editedCells.size === 0} size="sm" className="gap-2">
              <Save className="h-4 w-4" />{isSaving ? 'Menyimpan...' : 'Simpan'}
            </Button>
            <Button onClick={onFinalisasiClick} disabled={!isAllFilled} size="sm" variant="default" className="gap-2 bg-green-600 hover:bg-green-700">
              <Lock className="h-4 w-4" />Finalisasi
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <TooltipProvider>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50 border-b-2">
                  <TableHead rowSpan={2} className="font-semibold sticky left-0 bg-muted/50 z-20 w-[60px] text-center border-r">No</TableHead>
                  <TableHead rowSpan={2} className="font-semibold sticky left-[60px] bg-muted/50 z-20 min-w-[180px] border-r">Nama Siswa</TableHead>
                  <TableHead colSpan={materiCount} className="text-center font-semibold bg-primary/5 border-r">Sumatif per Materi</TableHead>
                  <TableHead rowSpan={2} className="text-center font-semibold w-[100px] bg-accent/5 border-r">NA Sumatif Materi</TableHead>
                  <TableHead colSpan={2} className="text-center font-semibold bg-primary/5 border-r">Sumatif Akhir Semester</TableHead>
                  <TableHead rowSpan={2} className="text-center font-semibold w-[100px] bg-accent/5 border-r">NA Semester</TableHead>
                  <TableHead rowSpan={2} className="text-center font-semibold w-[120px] bg-primary/5">Nilai Rapor</TableHead>
                </TableRow>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  {materiList?.map((materi: any, index: number) => (
                    <TableHead key={materi.id || index} className="text-center font-medium min-w-[100px] py-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help line-clamp-2 text-xs">{materi.judul || `Materi ${index + 1}`}</span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          <p className="text-sm">{materi.judul || `Materi ${index + 1}`}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TableHead>
                  ))}
                  <TableHead className="text-center font-medium w-[80px] py-2 bg-muted/20">Non Tes</TableHead>
                  <TableHead className="text-center font-medium w-[80px] py-2 bg-muted/20 border-r">Tes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {santriList.map((santri, index) => {
                  const data = sumatifData[santri.id] || {
                    sumatif: Array(materiCount).fill(null),
                    non_tes: null,
                    tes: null,
                    na_lingkup: 0,
                    na_semester: null,
                    nilai_rapor: 0
                  };
                  return (
                    <TableRow key={santri.id} className="hover:bg-muted/20 transition-colors">
                      <TableCell className="text-center sticky left-0 bg-card z-10 font-medium border-r">{index + 1}</TableCell>
                      <TableCell className="sticky left-[60px] bg-card z-10 font-medium border-r">{santri.name}</TableCell>
                      {materiList?.map((materi: any, i: number) => (
                        <TableCell key={materi.id || i} className="p-1">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={data.sumatif[i] ?? ''}
                            onChange={(e) => onSumatifChange(santri.id, i, e.target.value)}
                            placeholder="-"
                            className={`h-9 text-center text-sm [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${editedCells.has(`${santri.id}-sumatif-${i}`) ? 'bg-accent/20 border-accent' : ''}`}
                          />
                        </TableCell>
                      ))}
                      <TableCell className="text-center bg-accent/5 border-x font-semibold">
                        {data.na_lingkup > 0 ? <Badge variant="outline" className="font-semibold">{data.na_lingkup.toFixed(1)}</Badge> : <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell className="p-1 bg-muted/10">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={data.non_tes ?? ''}
                          onChange={(e) => onNonTesChange(santri.id, e.target.value)}
                          placeholder="-"
                          className={`h-9 text-center text-sm [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${editedCells.has(`${santri.id}-nontes`) ? 'bg-accent/20 border-accent' : ''}`}
                        />
                      </TableCell>
                      <TableCell className="p-1 bg-muted/10 border-r">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={data.tes ?? ''}
                          onChange={(e) => onTesChange(santri.id, e.target.value)}
                          placeholder="-"
                          className={`h-9 text-center text-sm [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${editedCells.has(`${santri.id}-tes`) ? 'bg-accent/20 border-accent' : ''}`}
                        />
                      </TableCell>
                      <TableCell className="text-center bg-accent/5 border-r">
                        {data.na_semester !== null ? <Badge variant="outline" className="font-semibold">{data.na_semester.toFixed(1)}</Badge> : <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell className="text-center bg-primary/5">
                        {data.nilai_rapor > 0 ? <Badge className="font-bold text-base px-3 py-1">{data.nilai_rapor.toFixed(1)}</Badge> : <span className="text-muted-foreground">-</span>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
