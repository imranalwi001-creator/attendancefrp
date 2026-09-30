import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Edit } from 'lucide-react';

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

interface RekapNilaiTabProps {
  mapelNama: string;
  santriList: any[];
  sumatifData: SumatifData;
  formatifPerSiswa: FormatifPerSiswa;
  onEditNilai: () => Promise<void>;
}

export default function RekapNilaiTab({
  mapelNama,
  santriList,
  sumatifData,
  formatifPerSiswa,
  onEditNilai,
}: RekapNilaiTabProps) {
  return (
    <div className="space-y-6">
      <Card className="rounded-xl border-2 border-border/50 shadow-lg bg-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-bold">Rekap Nilai {mapelNama}</CardTitle>
              <CardDescription>Nilai rapor siswa</CardDescription>
            </div>
            <Button onClick={onEditNilai} size="sm" className="h-9 gap-2 px-3">
              <Edit className="h-4 w-4" />Edit Nilai
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="rounded-xl border-2 border-border/50 shadow-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-b-2 border-border bg-muted/30">
                  <TableHead className="w-[80px] text-center font-semibold border-r">No</TableHead>
                  <TableHead className="font-semibold border-r min-w-[300px]">Nama Santri</TableHead>
                  <TableHead className="text-center font-semibold w-[150px] border-r">Nilai Rapor</TableHead>
                  <TableHead className="font-semibold">Capaian Kompetensi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {santriList.map((santri, index) => {
                  const data = sumatifData[santri.id];
                  const formatifData = formatifPerSiswa[santri.id];
                  if (!data) return null;

                  const tpTampilRapor = formatifData?.tp_assessments?.filter((tp: any) => tp.tampil_rapor) || [];
                  const hasTampilRaporAktif = tpTampilRapor.some((tp: any) => tp.kktp === true);
                  const hasTampilRaporTidakAktif = tpTampilRapor.some((tp: any) => tp.kktp === false);

                  return (
                    <TableRow key={santri.id}>
                      <TableCell className="text-center font-medium border-r">{index + 1}</TableCell>
                      <TableCell className="font-medium border-r min-w-[300px]">{santri.name}</TableCell>
                      <TableCell className="text-center font-bold border-r text-xl">
                        {data.nilai_rapor !== null && data.nilai_rapor !== undefined ? data.nilai_rapor.toFixed(1) : '-'}
                      </TableCell>
                      <TableCell className="border-r-0">
                        {tpTampilRapor.length > 0 ? (
                          <div className="space-y-3">
                            {hasTampilRaporAktif && formatifData?.deskripsi_tertinggi && (
                              <div className="text-sm">
                                <span className="font-semibold text-primary">Capaian Tertinggi:</span>{' '}
                                <span className="text-muted-foreground">{formatifData.deskripsi_tertinggi}</span>
                              </div>
                            )}
                            {hasTampilRaporTidakAktif && formatifData?.deskripsi_terendah && (
                              <div className="text-sm">
                                <span className="font-semibold text-destructive">Perlu Bimbingan:</span>{' '}
                                <span className="text-muted-foreground">{formatifData.deskripsi_terendah}</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground italic">Belum ada data capaian</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
