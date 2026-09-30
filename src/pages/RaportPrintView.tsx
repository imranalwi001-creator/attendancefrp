import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer, BookOpen, FileText, User } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
interface MapelNilai {
  mapel_nama: string;
  kategori: string;
  nilai_rapor: number;
  capaian_kompetensi: string;
}
export default function RaportPrintView() {
  const {
    id,
    santriId
  } = useParams();
  const [kelas, setKelas] = useState<any>(null);
  const [santri, setSantri] = useState<any>(null);
  const [mapelNilaiList, setMapelNilaiList] = useState<MapelNilai[]>([]);
  const [loading, setLoading] = useState(true);
  const [catatanGuru, setCatatanGuru] = useState("");
  const [catatanOrtu, setCatatanOrtu] = useState("");
  const {
    toast
  } = useToast();
  const navigate = useNavigate();
  useEffect(() => {
    if (id && santriId) {
      fetchPrintData();
    }
  }, [id, santriId]);
  const fetchPrintData = async () => {
    setLoading(true);
    try {
      // Fetch kelas data
      const {
        data: kelasData,
        error: kelasError
      } = await supabase.from('kelas').select('id, nama, tingkat, tahun_ajaran, walikelas_id').eq('id', id).single();
      if (kelasError) throw kelasError;
      
      // Fetch wali kelas name separately
      let walikelasName = null;
      if (kelasData.walikelas_id) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', kelasData.walikelas_id)
          .single();
        walikelasName = profileData?.name;
      }
      setKelas({ ...kelasData, walikelas: { name: walikelasName } });

      // Fetch santri data
      const {
        data: santriData,
        error: santriError
      } = await supabase.from('santri').select('id, nis').eq('id', santriId).single();
      if (santriError) throw santriError;

      // Fetch profile for santri
      const {
        data: profileData
      } = await supabase.from('profiles').select('id, name').eq('id', santriId).single();
      setSantri({
        ...santriData,
        nama: profileData?.name || 'Unknown'
      });

      // Fetch all mapel for this kelas
      const {
        data: mapelData,
        error: mapelError
      } = await supabase.from('mapel').select('id, nama, kategori').eq('kelas_id', id).eq('status', 'aktif');
      if (mapelError) throw mapelError;

      // For each mapel, get finalized assessment
      const mapelWithNilai = await Promise.all((mapelData || []).map(async mapel => {
        // Get asesmen_sumatif
        const {
          data: sumatifData
        } = await supabase.from('asesmen_sumatif').select('nilai_rapor, is_finalized').eq('mapel_id', mapel.id).eq('santri_id', santriId).eq('is_finalized', true).maybeSingle();

        // Get asesmen_formatif for capaian kompetensi
        const {
          data: formatifData
        } = await supabase.from('asesmen_formatif').select('deskripsi_tertinggi, deskripsi_terendah, tp_assessments').eq('mapel_id', mapel.id).eq('santri_id', santriId).maybeSingle();
        let capaianKompetensi = '-';
        if (formatifData) {
          const tpAssessments = formatifData.tp_assessments as Array<{
            kktp: boolean;
            tampil_rapor: boolean;
          }>;
          const hasInactiveKKTP = tpAssessments?.some(tp => !tp.kktp && tp.tampil_rapor);
          const hasActiveKKTP = tpAssessments?.some(tp => tp.kktp && tp.tampil_rapor);
          if (hasInactiveKKTP && formatifData.deskripsi_terendah) {
            capaianKompetensi = formatifData.deskripsi_terendah;
          } else if (hasActiveKKTP && formatifData.deskripsi_tertinggi) {
            capaianKompetensi = formatifData.deskripsi_tertinggi;
          }
        }
        return {
          mapel_nama: mapel.nama,
          kategori: mapel.kategori || 'wajib',
          nilai_rapor: sumatifData?.nilai_rapor || 0,
          capaian_kompetensi: capaianKompetensi
        };
      }));
      setMapelNilaiList(mapelWithNilai);

      // Fetch raport notes
      const { data: raportData } = await supabase
        .from('raport')
        .select('catatan_guru, catatan_ortu')
        .eq('santri_id', santriId)
        .eq('kelas_id', id)
        .eq('tahun_ajaran', kelasData.tahun_ajaran)
        .eq('semester', '1')
        .maybeSingle();

      if (raportData) {
        setCatatanGuru(raportData.catatan_guru || '');
        setCatatanOrtu(raportData.catatan_ortu || '');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Gagal memuat data raport",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  const handlePrint = () => {
    window.print();
  };
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-96">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Memuat data raport...</p>
          </CardContent>
        </Card>
      </div>;
  }
  return <div className="min-h-screen bg-muted/20">
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 2cm 1.5cm;
          }
          
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          body * {
            visibility: hidden !important;
          }
          
          .print-preview-container,
          .print-preview-container * {
            visibility: visible !important;
          }
          
          .print-preview-container {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
          }
          
          .no-print {
            display: none !important;
            visibility: hidden !important;
          }

          .page-break {
            page-break-before: always;
          }
          
          /* Hide scrollbars */
          body {
            overflow: hidden !important;
          }
        }

        @media screen {
          .print-preview-container {
            max-width: 21cm;
            margin: 3rem auto 3rem;
            background: white;
            box-shadow: 0 0 30px rgba(0,0,0,0.15);
            padding: 2cm 1.5cm;
            min-height: 29.7cm;
          }
        }
      `}</style>
      
      {/* Action Bar - Only visible on screen */}
      <div className="no-print sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <Button variant="outline" onClick={() => navigate(`/admin/penilaian/kelas/${id}/buat-raport`)} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Kembali
            </Button>
            
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold">Preview Raport - {santri?.nama}</h2>
            </div>

            <Button onClick={handlePrint} className="gap-2">
              <Printer className="h-4 w-4" />
              Print
            </Button>
          </div>
        </div>
      </div>

      {/* Print Content */}
      <div className="print-preview-container">
        {/* Header Sekolah */}
        <div className="text-center mb-8 pb-6 border-b-2 border-border">
          <h1 className="text-2xl font-bold mb-1">SEKOLAH MENENGAH PERTAMA ISLAM TERPADU
DIGITAL ISLAMIC BOARDING SCHOOL



						
        </h1>
          <p className="text-sm text-muted-foreground mb-2">Jln. Bintang Mujur, Pangkajene Kepulauan, Sulawesi Selatan









        </p>
        </div>

        {/* Judul Laporan */}
        <div className="text-center mb-6">
          <h2 className="text-xl font-semibold">LAPORAN HASIL BELAJAR SANTRI</h2>
          <p className="text-sm text-muted-foreground">Tahun Ajaran {kelas?.tahun_ajaran || '2024/2025'}</p>
        </div>

        {/* Informasi Santri */}
        <div className="mb-6">
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Nama Santri</label>
              <p className="text-base font-semibold mt-1">{santri?.nama}</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">NISN</label>
              <p className="text-base font-semibold mt-1">{santri?.nis || '-'}</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Kelas</label>
              <p className="text-base font-semibold mt-1">{kelas?.nama}</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Wali Kelas</label>
              <p className="text-base font-semibold mt-1">{kelas?.walikelas?.name || 'Belum ditugaskan'}</p>
            </div>
          </div>
        </div>

        {/* Tabel Nilai */}
        <div className="mb-6">
          <div className="border border-border rounded-lg overflow-hidden">
            <Table className="pointer-events-none">
              <TableHeader>
                <TableRow className="border-b">
                  <TableHead className="w-[60px] text-center font-bold border-r">No</TableHead>
                  <TableHead className="w-[220px] font-bold border-r">Mata Pelajaran</TableHead>
                  <TableHead className="w-[100px] text-center font-bold border-r">Jenis</TableHead>
                  <TableHead className="w-[80px] text-center font-bold border-r">Nilai</TableHead>
                  <TableHead className="min-w-[300px] font-bold">Capaian Kompetensi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mapelNilaiList.map((mapel, index) => <TableRow key={index} className="border-b hover:bg-transparent">
                    <TableCell className="text-center font-medium border-r align-top">{index + 1}</TableCell>
                    <TableCell className="font-semibold border-r align-top">{mapel.mapel_nama}</TableCell>
                    <TableCell className="text-center border-r align-top">
                      <span className="capitalize text-xs">{mapel.kategori}</span>
                    </TableCell>
                    <TableCell className="text-center border-r align-top">
                      <span className="font-bold">{mapel.nilai_rapor.toFixed(1)}</span>
                    </TableCell>
                    <TableCell className="text-sm leading-relaxed align-top py-3">
                      <p className="whitespace-normal break-words">{mapel.capaian_kompetensi}</p>
                    </TableCell>
                  </TableRow>)}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Ketidakhadiran */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold mb-3">Ketidakhadiran</h3>
          <div className="border border-border rounded-lg overflow-hidden">
            <Table className="pointer-events-none">
              <TableHeader>
                <TableRow className="border-b">
                  <TableHead className="font-bold border-r">Keterangan</TableHead>
                  <TableHead className="w-[150px] text-center font-bold">Jumlah</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="border-b hover:bg-transparent">
                  <TableCell className="font-medium border-r">Sakit</TableCell>
                  <TableCell className="text-center">0 Hari</TableCell>
                </TableRow>
                <TableRow className="border-b hover:bg-transparent">
                  <TableCell className="font-medium border-r">Izin</TableCell>
                  <TableCell className="text-center">0 Hari</TableCell>
                </TableRow>
                <TableRow className="hover:bg-transparent">
                  <TableCell className="font-medium border-r">Tanpa Keterangan</TableCell>
                  <TableCell className="text-center">0 Hari</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Catatan */}
        <div className="mb-6 space-y-6">
          <div>
            <label className="text-sm font-semibold mb-2 block">Catatan Guru</label>
            <div className="min-h-[80px] p-3 border rounded-lg bg-muted/10">
              <p className="text-sm">{catatanGuru || 'Belum ada catatan dari guru.'}</p>
            </div>
          </div>
          <div>
            <label className="text-sm font-semibold mb-2 block">Catatan Wali/Orang Tua</label>
            <div className="min-h-[80px] p-3 border rounded-lg bg-muted/10">
              <p className="text-sm">{catatanOrtu || 'Belum ada catatan dari orang tua/wali.'}</p>
            </div>
          </div>
        </div>

        {/* Tanda Tangan */}
        <div className="mt-12">
          <div className="grid grid-cols-3 gap-6">
            <div className="text-center">
              <p className="text-sm font-semibold mb-16">Orang Tua</p>
              <div className="border-t-2 border-foreground pt-2">
                <p className="text-sm">( _______________ )</p>
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold mb-16">Wali Kelas</p>
              <div className="border-t-2 border-foreground pt-2">
                <p className="text-sm">( _______________ )</p>
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold mb-16">Kepala Sekolah</p>
              <div className="border-t-2 border-foreground pt-2">
                <p className="text-sm">( _______________ )</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t text-center text-xs text-muted-foreground">
          <p>Dicetak pada: {new Date().toLocaleDateString('id-ID', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}</p>
          
        </div>
      </div>
    </div>;
}