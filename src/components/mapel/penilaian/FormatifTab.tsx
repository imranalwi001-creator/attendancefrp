import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Award, ClipboardList, User, CheckCircle2, AlertCircle, Save, MoreVertical } from 'lucide-react';

interface FormatifPerSiswa {
  [santriId: string]: {
    santri_id: string;
    nama: string;
    tp_assessments: Array<{
      tp_index: number;
      kktp: boolean;
      tampil_rapor: boolean;
    }>;
    deskripsi_tertinggi: string;
    deskripsi_terendah: string;
    db_id?: string;
  };
}

interface FormatifTabProps {
  mapelInfo: any;
  santriList: any[];
  formatifPerSiswa: FormatifPerSiswa;
  setFormatifPerSiswa: React.Dispatch<React.SetStateAction<FormatifPerSiswa>>;
  isSaving: boolean;
  onToggleKKTP: (santriId: string, tpIndex: number, checked: boolean) => Promise<void>;
  onToggleTampilRapor: (santriId: string, tpIndex: number, checked: boolean | 'indeterminate') => Promise<void>;
  onBulkToggleKKTP: (santriId: string, value: boolean) => Promise<void>;
  onBulkToggleTampil: (santriId: string, value: boolean) => Promise<void>;
  onSaveAll: () => Promise<void>;
  renderTabsList: () => React.ReactNode;
}

export default function FormatifTab({
  mapelInfo,
  santriList,
  formatifPerSiswa,
  setFormatifPerSiswa,
  isSaving,
  onToggleKKTP,
  onToggleTampilRapor,
  onBulkToggleKKTP,
  onBulkToggleTampil,
  onSaveAll,
  renderTabsList,
}: FormatifTabProps) {
  const hasTujuan = mapelInfo?.tujuan_pembelajaran && mapelInfo.tujuan_pembelajaran.length > 0;
  const hasSantri = santriList.length > 0;

  // Empty State - No Capaian Pembelajaran
  if (!hasTujuan) {
    return (
      <Card className="border-2 rounded-2xl overflow-hidden">
        <CardContent className="p-6 space-y-6">
          {renderTabsList()}
          <div className="text-center py-16">
            <div className="inline-flex p-4 rounded-2xl bg-muted/50 mb-4">
              <Award className="h-12 w-12 text-muted-foreground/30" />
            </div>
            <p className="text-base font-medium text-muted-foreground mb-2">Belum ada Tujuan Pembelajaran</p>
            <p className="text-sm text-muted-foreground/70 max-w-sm mx-auto">Silakan tambahkan Tujuan Pembelajaran terlebih dahulu di tab Informasi</p>
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
            <p className="text-sm text-muted-foreground/70 max-w-sm mx-auto">Tambahkan santri ke kelas untuk mulai melakukan asesmen formatif</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 rounded-2xl overflow-hidden">
      <CardContent className="p-6 space-y-6">
        {renderTabsList()}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <ClipboardList className="h-5 w-5 text-primary" />
            </div>
            <CardTitle className="text-lg">Tabel Asesmen Formatif Per Siswa</CardTitle>
          </div>
          <Button onClick={onSaveAll} disabled={isSaving} size="sm" className="gap-2">
            <Save className="h-4 w-4" />
            {isSaving ? 'Menyimpan...' : 'Simpan Data'}
          </Button>
        </div>
        
        <TooltipProvider>
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="font-semibold sticky left-0 bg-muted/50 z-20 w-[60px]">No</TableHead>
                  <TableHead className="font-semibold sticky left-[60px] bg-muted/50 z-20 min-w-[180px]">Nama Siswa</TableHead>
                  {mapelInfo?.tujuan_pembelajaran?.map((tp: any, index: number) => (
                    <TableHead key={index} className="text-center font-semibold w-[100px]">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex flex-col gap-1">
                            <span>TP {index + 1}</span>
                            <span className="text-[10px] font-normal text-muted-foreground">(KKTP / Rapor)</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          <p className="text-sm">{tp?.text || `TP ${index + 1}`}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TableHead>
                  ))}
                  <TableHead className="font-semibold min-w-[250px]">Deskripsi Tertinggi</TableHead>
                  <TableHead className="font-semibold min-w-[250px]">Deskripsi Terendah</TableHead>
                  <TableHead className="font-semibold w-[80px] text-center">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {santriList.map((santri, index) => {
                  const data = formatifPerSiswa[santri.id];
                  return (
                    <TableRow key={santri.id} className="hover:bg-muted/30">
                      <TableCell className="sticky left-0 bg-card z-10 font-medium">{index + 1}</TableCell>
                      <TableCell className="sticky left-[60px] bg-card z-10 font-medium">{santri.name}</TableCell>
                      {mapelInfo?.tujuan_pembelajaran?.map((_: any, tpIndex: number) => {
                        const assessment = data?.tp_assessments?.find((a: any) => a.tp_index === tpIndex);
                        const kktp = assessment?.kktp ?? true;
                        const tampilRapor = assessment?.tampil_rapor ?? false;
                        return (
                          <TableCell key={tpIndex} className="text-center">
                            <div className="flex items-center justify-center gap-2">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div>
                                    <Switch 
                                      checked={kktp} 
                                      onCheckedChange={(checked) => onToggleKKTP(santri.id, tpIndex, checked)} 
                                      className="data-[state=checked]:bg-green-500" 
                                    />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent><p>KKTP</p></TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div>
                                    <Checkbox 
                                      checked={tampilRapor} 
                                      onCheckedChange={(checked) => onToggleTampilRapor(santri.id, tpIndex, checked)} 
                                    />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent><p>Tampil di Rapor</p></TooltipContent>
                              </Tooltip>
                            </div>
                          </TableCell>
                        );
                      })}
                      <TableCell>
                        <Textarea 
                          value={data?.deskripsi_tertinggi || ''} 
                          onChange={(e) => {
                            setFormatifPerSiswa(prev => ({
                              ...prev,
                              [santri.id]: { ...prev[santri.id], deskripsi_tertinggi: e.target.value }
                            }));
                          }} 
                          className="min-h-[80px] text-sm resize-none" 
                          placeholder="Deskripsi capaian tertinggi..." 
                        />
                      </TableCell>
                      <TableCell>
                        <Textarea 
                          value={data?.deskripsi_terendah || ''} 
                          onChange={(e) => {
                            setFormatifPerSiswa(prev => ({
                              ...prev,
                              [santri.id]: { ...prev[santri.id], deskripsi_terendah: e.target.value }
                            }));
                          }} 
                          className="min-h-[80px] text-sm resize-none" 
                          placeholder="Deskripsi perlu bimbingan..." 
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Aksi Cepat</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => onBulkToggleKKTP(santri.id, true)}>
                              <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />Semua KKTP ✓
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onBulkToggleKKTP(santri.id, false)}>
                              <AlertCircle className="h-4 w-4 mr-2 text-red-500" />Semua KKTP ✗
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => onBulkToggleTampil(santri.id, true)}>Semua Tampil Rapor ✓</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onBulkToggleTampil(santri.id, false)}>Semua Tampil Rapor ✗</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
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
