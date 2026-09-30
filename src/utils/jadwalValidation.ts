import { Jadwal, JadwalTipe } from '@/types';

interface ValidationResult {
  isValid: boolean;
  message: string;
}

interface BlockValidationOptions {
  isBlockSystem?: boolean;
  validDays?: string[];
  blockLabel?: string;
}

export function validateJadwal(
  newJadwal: any,
  existingJadwal: any[],
  excludeId?: string,
  blockOptions?: BlockValidationOptions
): ValidationResult | null {
  // Filter out the current jadwal if editing
  const otherJadwal = excludeId 
    ? existingJadwal.filter(j => j.id !== excludeId) 
    : existingJadwal;

  // Normalize property names
  const getKelasId = (j: any) => j.kelas_id || j.kelasId;
  const getJamMulai = (j: any) => j.jam_mulai || j.jamMulai;
  const getJamSelesai = (j: any) => j.jam_selesai || j.jamSelesai;
  const getPengampuId = (j: any) => j.pengampu_id || j.pengampuId;
  const getMapelId = (j: any) => j.mapel_id || j.mapelId;
  const getBlockId = (j: any) => j.block_id || j.blockId;
  const getTipe = (j: any): JadwalTipe => j.tipe || 'pelajaran';

  const newJadwalTipe = getTipe(newJadwal);
  const isPelajaran = newJadwalTipe === 'pelajaran';

  // Block system validation: check if selected day is valid for the block
  if (blockOptions?.isBlockSystem && blockOptions.validDays && blockOptions.validDays.length > 0) {
    const selectedDay = newJadwal.hari;
    if (!blockOptions.validDays.includes(selectedDay)) {
      const blockName = blockOptions.blockLabel || 'blok yang dipilih';
      return {
        isValid: false,
        message: `Hari ${selectedDay} tidak tersedia dalam ${blockName}. Hari yang tersedia: ${blockOptions.validDays.join(', ')}`
      };
    }
  }

  // Check for exact duplicate (same kelas, day, time, mapel/label, block)
  // For pelajaran: check mapel_id
  // For non-pelajaran: check tipe and label
  const exactDuplicate = otherJadwal.find(j => {
    const sameKelas = getKelasId(j) === getKelasId(newJadwal);
    const sameHari = j.hari === newJadwal.hari;
    const sameJamMulai = getJamMulai(j) === getJamMulai(newJadwal);
    const sameJamSelesai = getJamSelesai(j) === getJamSelesai(newJadwal);
    const sameBlock = getBlockId(j) === getBlockId(newJadwal) || 
                      (getBlockId(j) === null && getBlockId(newJadwal) === null);
    
    // Type-specific duplicate check
    const existingTipe = getTipe(j);
    if (isPelajaran && existingTipe === 'pelajaran') {
      const sameMapel = getMapelId(j) === getMapelId(newJadwal);
      return sameKelas && sameHari && sameJamMulai && sameJamSelesai && sameMapel && sameBlock;
    } else if (!isPelajaran && existingTipe === newJadwalTipe) {
      // For non-pelajaran, check same tipe and label
      const sameLabel = (j.label || '') === (newJadwal.label || '');
      return sameKelas && sameHari && sameJamMulai && sameJamSelesai && sameLabel && sameBlock;
    }
    
    return false;
  });

  if (exactDuplicate) {
    return {
      isValid: false,
      message: 'Jadwal yang sama persis sudah ada'
    };
  }

  // Check for time conflicts for the same class on the same day
  const conflicts = otherJadwal.filter(j => {
    if (getKelasId(j) !== getKelasId(newJadwal) || j.hari !== newJadwal.hari) {
      return false;
    }

    // Check time overlap
    const newStart = getJamMulai(newJadwal) || '';
    const newEnd = getJamSelesai(newJadwal) || '';
    const existingStart = getJamMulai(j);
    const existingEnd = getJamSelesai(j);

    // Time overlap check
    return (newStart < existingEnd && newEnd > existingStart);
  });

  if (conflicts.length > 0) {
    return {
      isValid: false,
      message: 'Jadwal bentrok dengan jadwal yang sudah ada di waktu yang sama'
    };
  }

  // Check for teacher conflicts (same teacher teaching at the same time)
  // Only check for 'pelajaran' type (non-pelajaran types don't have teachers)
  if (isPelajaran) {
    const teacherConflicts = otherJadwal.filter(j => {
      // Skip non-pelajaran jadwal for teacher conflicts
      if (getTipe(j) !== 'pelajaran') return false;
      
      if (getPengampuId(j) !== getPengampuId(newJadwal) || j.hari !== newJadwal.hari) {
        return false;
      }

      const newStart = getJamMulai(newJadwal) || '';
      const newEnd = getJamSelesai(newJadwal) || '';
      const existingStart = getJamMulai(j);
      const existingEnd = getJamSelesai(j);

      return (newStart < existingEnd && newEnd > existingStart);
    });

    if (teacherConflicts.length > 0) {
      return {
        isValid: false,
        message: 'Guru sudah memiliki jadwal mengajar di waktu yang sama'
      };
    }
  }

  return null; // No validation errors
}
