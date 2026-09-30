// Utility functions for Ujian feature

export type JenisUjian = 'harian' | 'uts' | 'uas' | 'uas_sekolah';
export type StatusUjian = 'terjadwal' | 'berlangsung' | 'selesai';
export type JenisSoal = 'pilihan_ganda' | 'essai' | 'true_false';

export const JENIS_UJIAN_OPTIONS = [
  { value: 'harian', label: 'Ujian Harian' },
  { value: 'uts', label: 'UTS (Ujian Tengah Semester)' },
  { value: 'uas', label: 'UAS (Ujian Akhir Semester)' },
  { value: 'uas_sekolah', label: 'Ujian Akhir Sekolah' },
] as const;

export const JENIS_SOAL_OPTIONS = [
  { value: 'pilihan_ganda', label: 'Pilihan Ganda' },
  { value: 'essai', label: 'Essai' },
  { value: 'true_false', label: 'True or False' },
] as const;

export const STATUS_UJIAN_OPTIONS = [
  { value: 'terjadwal', label: 'Terjadwal' },
  { value: 'berlangsung', label: 'Berlangsung' },
  { value: 'selesai', label: 'Selesai' },
] as const;

export function getJenisUjianLabel(jenis: JenisUjian): string {
  const option = JENIS_UJIAN_OPTIONS.find(o => o.value === jenis);
  return option?.label || jenis;
}

export function getJenisUjianShortLabel(jenis: JenisUjian): string {
  switch (jenis) {
    case 'harian': return 'Harian';
    case 'uts': return 'UTS';
    case 'uas': return 'UAS';
    case 'uas_sekolah': return 'UAS';
    default: return jenis;
  }
}

export function getJenisSoalLabel(jenis: JenisSoal): string {
  const option = JENIS_SOAL_OPTIONS.find(o => o.value === jenis);
  return option?.label || jenis;
}

export function getStatusUjianLabel(status: StatusUjian): string {
  const option = STATUS_UJIAN_OPTIONS.find(o => o.value === status);
  return option?.label || status;
}

export function getJenisUjianVariant(jenis: JenisUjian): 'secondary' | 'warning' | 'default' | 'destructive' {
  switch (jenis) {
    case 'harian': return 'secondary';
    case 'uts': return 'warning';
    case 'uas': return 'default';
    case 'uas_sekolah': return 'destructive';
    default: return 'secondary';
  }
}

export function getStatusUjianVariant(status: StatusUjian): 'warning' | 'default' | 'success' {
  switch (status) {
    case 'terjadwal': return 'warning';
    case 'berlangsung': return 'default';
    case 'selesai': return 'success';
    default: return 'warning';
  }
}

export function calculateNilaiAkhir(
  totalBenar: number,
  totalSoal: number,
  bobotTotal: number = 100
): number {
  if (totalSoal === 0) return 0;
  return (totalBenar / totalSoal) * bobotTotal;
}

export const DURASI_UJIAN_OPTIONS = [
  { value: '0', label: 'Tanpa Batas Waktu' },
  { value: '20', label: '20 Menit' },
  { value: '30', label: '30 Menit' },
  { value: '45', label: '45 Menit' },
  { value: '60', label: '60 Menit (1 Jam)' },
  { value: '90', label: '90 Menit (1.5 Jam)' },
  { value: '120', label: '120 Menit (2 Jam)' },
  { value: 'custom', label: 'Custom (Input Manual)' },
] as const;

export function formatDurasi(menit: number | null | undefined): string {
  if (menit === null || menit === undefined || menit === 0) return 'Tanpa Batas Waktu';
  if (menit >= 60) {
    const jam = Math.floor(menit / 60);
    const sisaMenit = menit % 60;
    if (sisaMenit === 0) return `${jam} Jam`;
    return `${jam} Jam ${sisaMenit} Menit`;
  }
  return `${menit} Menit`;
}

export const OPSI_LABELS = ['A', 'B', 'C', 'D', 'E'] as const;
