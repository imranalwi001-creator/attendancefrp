import { useMemo, useState } from 'react';
import { UserCheck, UserX, Trophy, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DetailButton } from '@/components/ui/action-buttons';
import { PembahasanDrawer } from './PembahasanDrawer';
import type { UjianPeserta, UjianJawaban, UjianSoal } from '@/hooks/useUjian';

interface UjianNilaiTabProps {
  ujianId: string;
  status: 'terjadwal' | 'berlangsung' | 'selesai';
  peserta: UjianPeserta[];
  jawaban: UjianJawaban[];
  soal: UjianSoal[];
  mapelNama?: string;
  kelasNama?: string;
}

interface HitungNilai {
  totalBenar: number;
  totalSalah: number;
  nilaiAkhir: number;
}

export function UjianNilaiTab({ ujianId, status, peserta, jawaban, soal, mapelNama, kelasNama }: UjianNilaiTabProps) {
  const [selectedSantriId, setSelectedSantriId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Calculate statistics
  const stats = useMemo(() => {
    const hadir = peserta.filter((p) => p.status_kehadiran === 'hadir').length;
    const tidakHadir = peserta.filter((p) => p.status_kehadiran === 'tidak_hadir').length;

    // Calculate nilai for each peserta
    const nilaiList: { pesertaId: string; nilai: HitungNilai }[] = [];
    
    peserta.forEach((p) => {
      const jawabanPeserta = jawaban.filter((j) => j.peserta_id === p.id);
      const totalBenar = jawabanPeserta.filter((j) => j.is_benar === true).length;
      const totalSalah = jawabanPeserta.filter((j) => j.is_benar === false).length;
      
      // Calculate nilai akhir based on bobot
      let nilaiAkhir = 0;
      const totalBobot = soal.reduce((sum, s) => sum + (s.bobot_nilai || 0), 0);
      
      jawabanPeserta.forEach((j) => {
        if (j.is_benar) {
          const soalItem = soal.find((s) => s.id === j.soal_id);
          nilaiAkhir += soalItem?.bobot_nilai || 0;
        }
      });

      if (totalBobot > 0) {
        nilaiAkhir = (nilaiAkhir / totalBobot) * 100;
      }

      nilaiList.push({
        pesertaId: p.id,
        nilai: { totalBenar, totalSalah, nilaiAkhir },
      });
    });

    const nilaiTertinggi = Math.max(...nilaiList.map((n) => n.nilai.nilaiAkhir), 0);

    return { hadir, tidakHadir, nilaiTertinggi, nilaiList };
  }, [peserta, jawaban, soal]);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getNilaiForPeserta = (pesertaId: string): HitungNilai => {
    return stats.nilaiList.find((n) => n.pesertaId === pesertaId)?.nilai || {
      totalBenar: 0,
      totalSalah: 0,
      nilaiAkhir: 0,
    };
  };

  const handleOpenDetail = (santriId: string) => {
    setSelectedSantriId(santriId);
    setDrawerOpen(true);
  };

  // Show message if status is not selesai
  if (status !== 'selesai') {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground">Ujian Belum Selesai</h3>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Tab nilai akan muncul setelah ujian selesai dilaksanakan
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Stat Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary text-primary-foreground">
                  <UserCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-medium text-primary/70">
                    Jumlah Hadir
                  </p>
                  <p className="text-2xl font-bold text-primary">{stats.hadir}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-destructive/5 border-destructive/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive text-destructive-foreground">
                  <UserX className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-medium text-destructive/70">
                    Tidak Hadir
                  </p>
                  <p className="text-2xl font-bold text-destructive">{stats.tidakHadir}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-secondary border-secondary/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary text-primary-foreground">
                  <Trophy className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">
                    Nilai Tertinggi
                  </p>
                  <p className="text-2xl font-bold text-foreground">{stats.nilaiTertinggi.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Hasil Table */}
        {peserta.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground">Tidak ada peserta</h3>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Belum ada peserta yang terdaftar untuk ujian ini
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-12 text-[10px] uppercase tracking-wider font-medium">No</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-medium">Nama Santri</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-medium">NIS</TableHead>
                  <TableHead className="text-center text-[10px] uppercase tracking-wider font-medium">
                    Total Benar
                  </TableHead>
                  <TableHead className="text-center text-[10px] uppercase tracking-wider font-medium">
                    Total Salah
                  </TableHead>
                  <TableHead className="text-center text-[10px] uppercase tracking-wider font-medium">
                    Nilai Akhir
                  </TableHead>
                  <TableHead className="text-center text-[10px] uppercase tracking-wider font-medium">
                    Aksi
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {peserta.map((p, index) => {
                  const nilai = getNilaiForPeserta(p.id);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="text-sm text-muted-foreground">{index + 1}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={p.santri?.profile?.avatar_url || undefined} />
                            <AvatarFallback className="text-xs">
                              {getInitials(p.santri?.profile?.name || 'NA')}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium">{p.santri?.profile?.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.santri?.nis}</TableCell>
                      <TableCell className="text-center">
                        <span className="text-sm font-medium text-primary">
                          {nilai.totalBenar} ✓
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-sm font-medium text-destructive">
                          {nilai.totalSalah} ✗
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-sm font-semibold">{nilai.nilaiAkhir.toFixed(2)}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <DetailButton onClick={() => handleOpenDetail(p.santri_id)} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <PembahasanDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        ujianId={ujianId}
        santriId={selectedSantriId}
        mapelNama={mapelNama}
        kelasNama={kelasNama}
      />
    </>
  );
}

export default UjianNilaiTab;
