import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import {
  ArrowLeft,
  FileText,
  Users,
  GraduationCap,
  Moon,
  BookOpen,
  Loader2,
  CalendarDays,
  ClipboardList,
  Printer,
} from 'lucide-react';
import { ReportPrintTemplate, StaffAttendancePrintReport } from '@/components/print';
import { supabase } from '@/integrations/supabase/client';

interface PrintFeature {
  id: string;
  title: string;
  description: string;
  location: string;
  trigger: string;
  icon: typeof FileText;
}

const FEATURES: PrintFeature[] = [
  {
    id: 'kehadiran-staff',
    title: 'Laporan Kehadiran Staff',
    description: 'Rekap kehadiran staff per rentang tanggal.',
    location: 'LaporanKehadiranStaffModal',
    trigger: 'Admin → Kehadiran Staff → "Laporan"',
    icon: Users,
  },
  {
    id: 'kehadiran-guru',
    title: 'Laporan Kehadiran Mengajar',
    description: 'Rekap kehadiran guru mengajar per bulan.',
    location: 'LaporanKehadiranGuruModal',
    trigger: 'Admin → Kehadiran → tab Guru → "Laporan"',
    icon: GraduationCap,
  },
  {
    id: 'kehadiran-santri',
    title: 'Laporan Kehadiran Santri',
    description: 'Rekap kehadiran santri per kelas & bulan.',
    location: 'LaporanKehadiranSantriModal',
    trigger: 'Admin → Kehadiran → tab Santri → "Laporan"',
    icon: Users,
  },
  {
    id: 'ramadhan',
    title: 'Laporan Monitoring Ramadhan',
    description: 'Rekap ibadah Ramadhan santri.',
    location: 'RamadhanPrintReport',
    trigger: 'Monitoring Ramadhan → Detail → "Print"',
    icon: Moon,
  },
  {
    id: 'raport',
    title: 'Raport Hasil Belajar',
    description: 'Cetak rapor santri lengkap dengan nilai mapel.',
    location: 'RaportPrintView',
    trigger: 'Penilaian Kelas → Buat Raport → "Print"',
    icon: BookOpen,
  },
  {
    id: 'jadwal',
    title: 'Jadwal Pelajaran Kelas',
    description: 'Cetak jadwal pelajaran per kelas / blok.',
    location: 'JadwalDetail.tsx',
    trigger: 'Admin → Jadwal → tombol "Print"',
    icon: ClipboardList,
  },
  {
    id: 'kalender',
    title: 'Kalender Pendidikan',
    description: 'Cetak kalender pendidikan per tahun ajaran.',
    location: 'KalenderPrintPreview',
    trigger: 'Admin → Kalender → tombol "Print"',
    icon: CalendarDays,
  },
];

function useSampleData() {
  return useQuery({
    queryKey: ['print-preview-sample'],
    queryFn: async () => {
      const [santriRes, staffRes, kelasRes, mapelRes] = await Promise.all([
        supabase
          .from('santri')
          .select('id, nis, kelas_id, kelas:kelas_id(nama, tahun_ajaran)')
          .not('kelas_id', 'is', null)
          .limit(1)
          .maybeSingle(),
        supabase.from('staff').select('id, position, employee_id').limit(5),
        supabase.from('kelas').select('id, nama, tahun_ajaran, walikelas_id').limit(1).maybeSingle(),
        supabase.from('mapel').select('nama, kategori').eq('status', 'aktif').limit(8),
      ]);

      const santriProfile = santriRes.data
        ? await supabase.from('profiles').select('name').eq('id', santriRes.data.id).maybeSingle()
        : null;

      const staffIds = (staffRes.data || []).map((s) => s.id);
      const staffProfiles = staffIds.length
        ? await supabase.from('profiles').select('id, name').in('id', staffIds)
        : null;

      const walikelasName = kelasRes.data?.walikelas_id
        ? (await supabase.from('profiles').select('name').eq('id', kelasRes.data.walikelas_id).maybeSingle()).data?.name
        : null;

      return {
        santri: santriRes.data
          ? {
              nama: santriProfile?.data?.name || 'Santri Sample',
              nis: santriRes.data.nis || '-',
              kelas: (santriRes.data.kelas as any)?.nama || '-',
              tahunAjaran: (santriRes.data.kelas as any)?.tahun_ajaran || '2025/2026',
            }
          : null,
        kelas: kelasRes.data
          ? {
              nama: kelasRes.data.nama,
              tahunAjaran: kelasRes.data.tahun_ajaran,
              walikelas: walikelasName || 'Belum ditugaskan',
            }
          : null,
        staffList: (staffRes.data || []).map((s) => ({
          id: s.id,
          nama: staffProfiles?.data?.find((p) => p.id === s.id)?.name || 'Staff',
          position: s.position || '-',
          employee_id: (s as any).employee_id || '-',
        })),
        mapel: (mapelRes.data || []).slice(0, 6).map((m) => m.nama),
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}

export default function PrintTemplatePreview() {
  const navigate = useNavigate();
  const { data, isLoading } = useSampleData();
  const [openItems, setOpenItems] = useState<string[]>(FEATURES.map((f) => f.id));

  const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

  const expandAll = () => setOpenItems(FEATURES.map((f) => f.id));
  const collapseAll = () => setOpenItems([]);

  return (
    <div className="min-h-screen bg-muted/30">
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 0; }
          html, body { width: 210mm !important; min-height: 297mm !important; background: white !important; }
          body { margin: 0 !important; padding: 0 !important; }
          body * { visibility: hidden !important; }
          .print-area.is-printing, .print-area.is-printing * { visibility: visible !important; }
          .print-area.is-printing {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 210mm !important;
            min-height: 297mm !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            background: white !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="no-print sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-4">
          <Button variant="outline" onClick={() => navigate(-1)} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Kembali
          </Button>
          <div className="flex flex-col items-center text-center">
            <h2 className="text-base font-semibold">Print Template Preview</h2>
            <code className="text-[11px] font-mono text-muted-foreground">
              {FEATURES.length} dokumen — sample data real dari database
            </code>
      </div>

      <div className="no-print container mx-auto px-4 pt-3">
        <div className="flex items-start gap-2 rounded-md border border-amber-300/60 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
          <Printer className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <p>
            <strong>Tips:</strong> Pada dialog print browser, atur <strong>Margins → None</strong> dan
            <strong> Scale → 100</strong> agar margin & ukuran sesuai dengan preview di halaman ini.
          </p>
        </div>
      </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={collapseAll}>Tutup</Button>
            <Button size="sm" variant="outline" onClick={expandAll}>Buka Semua</Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Memuat sample data…
          </div>
        ) : (
          <Accordion
            type="multiple"
            value={openItems}
            onValueChange={setOpenItems}
            className="space-y-3"
          >
            {FEATURES.map((f) => (
              <PreviewItem key={f.id} feature={f} data={data} today={today} />
            ))}
          </Accordion>
        )}
      </div>
    </div>
  );
}

/* ---------------- Item with own print ref ---------------- */

function PreviewItem({
  feature: f,
  data,
  today,
}: {
  feature: PrintFeature;
  data: SampleData;
  today: string;
}) {
  const Icon = f.icon;
  const printRef = useRef<HTMLDivElement>(null);

  const onPrintClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const el = printRef.current;
      if (!el) return;
      // Mark only this element as the one to print, then trigger native print.
      document.querySelectorAll('.print-area.is-printing').forEach((n) =>
        n.classList.remove('is-printing')
      );
      el.classList.add('is-printing');
      const cleanup = () => {
        el.classList.remove('is-printing');
        window.removeEventListener('afterprint', cleanup);
      };
      window.addEventListener('afterprint', cleanup);
      // Defer to ensure class is applied before print dialog opens
      setTimeout(() => window.print(), 50);
    },
    []
  );

  return (
    <AccordionItem value={f.id} className="border rounded-lg bg-background overflow-hidden">
      <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/40">
        <div className="flex items-center gap-3 flex-1 text-left">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">{f.title}</span>
              <Badge variant="secondary" className="font-mono text-[10px]">
                {f.location}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {f.description} · <span className="text-foreground/60">{f.trigger}</span>
            </p>
          </div>
          <Button
            asChild
            size="sm"
            variant="outline"
            className="gap-1.5 mr-2 h-8"
            onClick={onPrintClick}
          >
            <span>
              <Printer className="h-3.5 w-3.5" />
              Print
            </span>
          </Button>
        </div>
      </AccordionTrigger>
      <AccordionContent className="bg-muted/30 px-2 py-6 sm:px-6">
        <div className="flex justify-center">
          <div ref={printRef} className="print-area shadow-[0_0_30px_rgba(0,0,0,0.15)]">
            {renderPreview(f.id, data, today)}
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

/* ---------------- Preview renderers ---------------- */

type SampleData = ReturnType<typeof useSampleData>['data'];

function renderPreview(id: string, data: SampleData, today: string) {
  switch (id) {
    case 'kehadiran-staff':
      return <KehadiranStaffPreview data={data} today={today} />;
    case 'kehadiran-guru':
      return <KehadiranGuruPreview data={data} today={today} />;
    case 'kehadiran-santri':
      return <KehadiranSantriPreview data={data} today={today} />;
    case 'ramadhan':
      return <RamadhanPreview data={data} today={today} />;
    case 'raport':
      return <RaportPreview data={data} today={today} />;
    case 'jadwal':
      return <JadwalPreview data={data} today={today} />;
    case 'kalender':
      return <KalenderPreview data={data} today={today} />;
    default:
      return null;
  }
}

function KehadiranStaffPreview({ data, today }: { data: SampleData; today: string }) {
  const staff = data?.staffList || [];
  const now = new Date();
  const semester = now.getMonth() < 6 ? 'genap' : 'ganjil';
  const periodeLabel = `1–30 ${today.split(' ').slice(1).join(' ')}`;
  const workDays = 22;

  return (
    <StaffAttendancePrintReport
      periodeLabel={periodeLabel}
      workDays={workDays}
      semester={semester}
      signer={{ name: 'Kepala Sekolah', jabatan: 'Kepala Sekolah' }}
      rows={staff.map((s) => ({
        id: s.id,
        employeeId: s.employee_id,
        nama: s.nama,
        hadir: 20,
        sakit: 1,
        izin: 1,
        cuti: 0,
        tidakHadir: 0,
        persen: 91,
      }))}
    />
  );
}

function KehadiranGuruPreview({ data, today }: { data: SampleData; today: string }) {
  const staff = data?.staffList || [];
  return (
    <ReportPrintTemplate
      title="LAPORAN KEHADIRAN MENGAJAR"
      tahunAjaran={data?.kelas?.tahunAjaran}
      semester="ganjil"
      signer={{ name: 'Kepala Sekolah', jabatan: 'Kepala Sekolah' }}
    >
      <p className="text-sm mb-3 text-muted-foreground">Bulan: {today.split(' ').slice(1).join(' ')}</p>
      <table className="print-table w-full">
        <thead>
          <tr>
            <th className="w-12 text-center">No</th>
            <th>Nama Guru</th>
            <th className="w-28 text-center">Total Sesi</th>
            <th className="w-28 text-center">Mengajar</th>
            <th className="w-28 text-center">% Hadir</th>
          </tr>
        </thead>
        <tbody>
          {staff.map((s, i) => (
            <tr key={s.id}>
              <td className="text-center">{i + 1}</td>
              <td>{s.nama}</td>
              <td className="text-center">24</td>
              <td className="text-center">22</td>
              <td className="text-center font-semibold">91.7%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </ReportPrintTemplate>
  );
}

function KehadiranSantriPreview({ data, today }: { data: SampleData; today: string }) {
  const santri = data?.santri;
  return (
    <ReportPrintTemplate
      title="LAPORAN KEHADIRAN SANTRI"
      tahunAjaran={data?.kelas?.tahunAjaran}
      semester="ganjil"
      studentData={santri ? { nama: santri.nama, nis: santri.nis, kelas: santri.kelas } : undefined}
      signer={{ name: data?.kelas?.walikelas || '-', jabatan: 'Wali Kelas' }}
    >
      <p className="text-sm mb-3 text-muted-foreground">Bulan: {today.split(' ').slice(1).join(' ')}</p>
      <table className="print-table w-full max-w-md">
        <thead>
          <tr>
            <th>Status Kehadiran</th>
            <th className="w-28 text-center">Jumlah</th>
            <th className="w-24 text-center">%</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Hadir</td><td className="text-center font-semibold">20</td><td className="text-center">90.9%</td></tr>
          <tr><td>Sakit</td><td className="text-center">1</td><td className="text-center">4.5%</td></tr>
          <tr><td>Izin</td><td className="text-center">1</td><td className="text-center">4.5%</td></tr>
          <tr><td>Alpha</td><td className="text-center">0</td><td className="text-center">0%</td></tr>
        </tbody>
      </table>
    </ReportPrintTemplate>
  );
}

function RamadhanPreview({ data, today }: { data: SampleData; today: string }) {
  const santri = data?.santri;
  return (
    <ReportPrintTemplate
      title="LAPORAN MONITORING RAMADHAN 1446 H"
      studentData={santri ? { nama: santri.nama, kelas: santri.kelas } : undefined}
      signer={{ name: data?.kelas?.walikelas || '-', jabatan: 'Wali Kelas' }}
    >
      <p className="text-sm mb-3 text-muted-foreground">Periode: 1 - 30 Ramadhan ({today})</p>
      <table className="print-table w-full">
        <thead>
          <tr>
            <th className="w-16 text-center">Hari</th>
            <th className="w-24 text-center">Puasa</th>
            <th className="w-28 text-center">Sholat 5W</th>
            <th>Tilawah</th>
            <th>Catatan</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 5 }).map((_, i) => (
            <tr key={i}>
              <td className="text-center">{i + 1}</td>
              <td className="text-center">✓</td>
              <td className="text-center">5/5</td>
              <td>1 Juz</td>
              <td className="text-xs text-muted-foreground">—</td>
            </tr>
          ))}
        </tbody>
      </table>
    </ReportPrintTemplate>
  );
}

function RaportPreview({ data, today }: { data: SampleData; today: string }) {
  const santri = data?.santri;
  const mapel = data?.mapel || [];
  return (
    <ReportPrintTemplate
      title="LAPORAN HASIL BELAJAR SANTRI"
      tahunAjaran={data?.kelas?.tahunAjaran}
      semester="ganjil"
      studentData={santri ? { nama: santri.nama, nis: santri.nis, kelas: santri.kelas } : undefined}
      signer={{ name: data?.kelas?.walikelas || '-', jabatan: 'Wali Kelas' }}
      printDate={new Date()}
    >
      <h3 className="font-semibold text-base mb-3">A. Nilai Akademik</h3>
      <table className="print-table w-full mb-6">
        <thead>
          <tr>
            <th className="w-12 text-center">No</th>
            <th>Mata Pelajaran</th>
            <th className="w-20 text-center">Nilai</th>
            <th className="w-28 text-center">Predikat</th>
          </tr>
        </thead>
        <tbody>
          {mapel.map((nama, i) => {
            const nilai = 80 + ((i * 7) % 18);
            return (
              <tr key={i}>
                <td className="text-center">{i + 1}</td>
                <td>{nama}</td>
                <td className="text-center font-semibold">{nilai}</td>
                <td className="text-center">{nilai >= 90 ? 'Sangat Baik' : 'Baik'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <h3 className="font-semibold text-base mb-2">B. Catatan Wali Kelas</h3>
      <p className="text-sm leading-relaxed text-foreground/90 mb-4">
        Ananda menunjukkan perkembangan akademik yang baik. Tetap pertahankan semangat belajar dan akhlak mulia.
      </p>
    </ReportPrintTemplate>
  );
}

function JadwalPreview({ data, today: _today }: { data: SampleData; today: string }) {
  const mapel = data?.mapel || [];
  const hari = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
  const jamSlots = ['07.30 - 08.30', '08.30 - 09.30', '09.45 - 10.45', '10.45 - 11.45'];
  return (
    <ReportPrintTemplate
      title="JADWAL PELAJARAN"
      tahunAjaran={data?.kelas?.tahunAjaran}
      semester="ganjil"
      signer={{ name: data?.kelas?.walikelas || '-', jabatan: 'Wali Kelas' }}
    >
      <p className="text-sm mb-3 text-muted-foreground">
        Kelas: <span className="font-semibold text-foreground">{data?.kelas?.nama}</span>
      </p>
      <table className="print-table w-full">
        <thead>
          <tr>
            <th className="w-32">Jam</th>
            {hari.map((h) => (
              <th key={h} className="text-center">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {jamSlots.map((jam, i) => (
            <tr key={jam}>
              <td className="font-medium">{jam}</td>
              {hari.map((h, j) => (
                <td key={h} className="text-center text-xs">
                  {mapel[(i + j) % Math.max(mapel.length, 1)] || '-'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </ReportPrintTemplate>
  );
}

function KalenderPreview({ data, today }: { data: SampleData; today: string }) {
  const events = [
    { tanggal: '15 Jul 2025', kategori: 'Awal Tahun', judul: 'Hari Pertama Sekolah' },
    { tanggal: '17 Agu 2025', kategori: 'Nasional', judul: 'HUT Kemerdekaan RI' },
    { tanggal: '5 Okt 2025', kategori: 'Ujian', judul: 'PTS Semester Ganjil' },
    { tanggal: '15 Des 2025', kategori: 'Ujian', judul: 'PAS Semester Ganjil' },
    { tanggal: '22 Des 2025', kategori: 'Pembagian', judul: 'Pembagian Rapor' },
    { tanggal: '23 Des 2025', kategori: 'Libur', judul: 'Libur Semester Ganjil' },
  ];
  return (
    <ReportPrintTemplate
      title={`KALENDER PENDIDIKAN ${new Date().getFullYear()}`}
      tahunAjaran={data?.kelas?.tahunAjaran}
      semester="ganjil"
      signer={{ name: 'Kepala Sekolah', jabatan: 'Kepala Sekolah' }}
    >
      <p className="text-sm mb-3 text-muted-foreground">Dicetak: {today}</p>
      <table className="print-table w-full">
        <thead>
          <tr>
            <th className="w-12 text-center">No</th>
            <th className="w-40">Tanggal</th>
            <th className="w-32">Kategori</th>
            <th>Kegiatan</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e, i) => (
            <tr key={i}>
              <td className="text-center">{i + 1}</td>
              <td>{e.tanggal}</td>
              <td>{e.kategori}</td>
              <td>{e.judul}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </ReportPrintTemplate>
  );
}
