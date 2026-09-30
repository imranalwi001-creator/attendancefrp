/**
 * HR Document OCR & KTP Vision Parser Service
 * Standardized client-side vision heuristics & Indonesian e-KTP data extraction.
 */

export interface ParsedKTP {
  nik: string;
  fullName: string;
  birthPlace: string;
  birthDate: string; // YYYY-MM-DD
  gender: 'LAKI-LAKI' | 'PEREMPUAN' | '';
  address: string;
  rtRw: string;
  kelDesa: string;
  kecamatan: string;
  religion: string;
  maritalStatus: string;
  occupation: string;
  confidence: number; // 0 to 100
  validationNotes: string[];
}

// Indonesian Province Code mapping (Sample top provinces)
const PROVINCE_MAP: Record<string, string> = {
  '11': 'Aceh',
  '12': 'Sumatera Utara',
  '13': 'Sumatera Barat',
  '14': 'Riau',
  '15': 'Jambi',
  '16': 'Sumatera Selatan',
  '17': 'Bengkulu',
  '18': 'Lampung',
  '19': 'Kep. Bangka Belitung',
  '21': 'Kep. Riau',
  '31': 'DKI Jakarta',
  '32': 'Jawa Barat',
  '33': 'Jawa Tengah',
  '34': 'DI Yogyakarta',
  '35': 'Jawa Timur',
  '36': 'Banten',
  '51': 'Bali',
  '52': 'Nusa Tenggara Barat',
  '53': 'Nusa Tenggara Timur',
  '61': 'Kalimantan Barat',
  '62': 'Kalimantan Tengah',
  '63': 'Kalimantan Selatan',
  '64': 'Kalimantan Timur',
  '65': 'Kalimantan Utara',
  '71': 'Sulawesi Utara',
  '72': 'Sulawesi Tengah',
  '73': 'Sulawesi Selatan',
  '74': 'Sulawesi Tenggara',
  '75': 'Gorontalo',
  '76': 'Sulawesi Barat',
  '81': 'Maluku',
  '82': 'Maluku Utara',
  '91': 'Papua Barat',
  '94': 'Papua'
};

/**
 * Preprocess image on HTML Canvas for improved contrast and OCR clarity
 */
export async function preprocessKtpImage(file: File | Blob): Promise<{
  processedDataUrl: string;
  width: number;
  height: number;
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }

        // Standardize dimensions (width around 1000px for good DPI)
        const scale = 1000 / img.width;
        canvas.width = 1000;
        canvas.height = Math.round(img.height * scale);

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Image processing: Convert to grayscale and enhance contrast
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;

        // Calculate average brightness
        let totalBrightness = 0;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const gray = 0.299 * r + 0.587 * g + 0.114 * b;
          totalBrightness += gray;
        }
        const avgBrightness = totalBrightness / (data.length / 4);

        // High-contrast adaptive stretch
        const contrastFactor = 1.35;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          let gray = 0.299 * r + 0.587 * g + 0.114 * b;

          // Contrast boost
          gray = (gray - avgBrightness) * contrastFactor + avgBrightness;
          gray = Math.min(255, Math.max(0, gray));

          data[i] = gray;
          data[i + 1] = gray;
          data[i + 2] = gray;
        }

        ctx.putImageData(imgData, 0, 0);
        resolve({
          processedDataUrl: canvas.toDataURL('image/jpeg', 0.92),
          width: canvas.width,
          height: canvas.height
        });
      };
      img.onerror = () => reject(new Error('Failed to load image into canvas'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Validate and parse Indonesian NIK (16 Digits)
 * Structure: PP-KK-CC-DDMMYY-NNNN
 * Female DOB has Day + 40 (e.g. Day 61 => Day 21, Female)
 */
export function parseAndValidateNik(nik: string): {
  isValid: boolean;
  birthDate?: string;
  gender?: 'LAKI-LAKI' | 'PEREMPUAN';
  province?: string;
  notes: string[];
} {
  const cleanNik = nik.replace(/\D/g, '');
  const notes: string[] = [];

  if (cleanNik.length !== 16) {
    notes.push(`NIK harus terdiri dari 16 digit (ditemukan ${cleanNik.length} digit).`);
    return { isValid: false, notes };
  }

  const provCode = cleanNik.substring(0, 2);
  const province = PROVINCE_MAP[provCode] || `Provinsi Kode ${provCode}`;

  let day = parseInt(cleanNik.substring(6, 8), 10);
  const month = parseInt(cleanNik.substring(8, 10), 10);
  let year = parseInt(cleanNik.substring(10, 12), 10);

  let gender: 'LAKI-LAKI' | 'PEREMPUAN' = 'LAKI-LAKI';
  if (day > 40) {
    gender = 'PEREMPUAN';
    day -= 40;
  }

  // Deduce full 4-digit birth year (assume <= 30 is 2000s, > 30 is 1900s)
  const currentYearTwoDigits = new Date().getFullYear() % 100;
  const fullYear = year <= currentYearTwoDigits ? 2000 + year : 1900 + year;

  // Validate date logic
  const isMonthValid = month >= 1 && month <= 12;
  const isDayValid = day >= 1 && day <= 31;

  let birthDate: string | undefined;
  if (isMonthValid && isDayValid) {
    const yStr = fullYear.toString();
    const mStr = month.toString().padStart(2, '0');
    const dStr = day.toString().padStart(2, '0');
    birthDate = `${yStr}-${mStr}-${dStr}`;
    notes.push(`NIK Terverifikasi (${province}, ${gender}, Lahir: ${dStr}/${mStr}/${yStr})`);
  } else {
    notes.push('Format tanggal dalam NIK tidak valid.');
  }

  return {
    isValid: cleanNik.length === 16 && isMonthValid && isDayValid,
    birthDate,
    gender,
    province,
    notes
  };
}

/**
 * Heuristic text extractor for e-KTP raw text (from camera, scan, or OCR string)
 */
export function extractKtpFieldsFromText(rawText: string): ParsedKTP {
  const cleanLines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const parsed: ParsedKTP = {
    nik: '',
    fullName: '',
    birthPlace: '',
    birthDate: '',
    gender: '',
    address: '',
    rtRw: '',
    kelDesa: '',
    kecamatan: '',
    religion: '',
    maritalStatus: '',
    occupation: '',
    confidence: 60,
    validationNotes: []
  };

  // 1. Search for 16-digit NIK
  const nikMatch = rawText.match(/\b([1-9]\d{15})\b/);
  if (nikMatch) {
    parsed.nik = nikMatch[1];
    const validation = parseAndValidateNik(parsed.nik);
    if (validation.isValid) {
      parsed.confidence += 25;
      if (validation.birthDate) parsed.birthDate = validation.birthDate;
      if (validation.gender) parsed.gender = validation.gender;
      parsed.validationNotes.push(...validation.notes);
    }
  }

  // 2. Line by line keyword pattern detection
  for (let i = 0; i < cleanLines.length; i++) {
    const line = cleanLines[i].toUpperCase();

    // Name extraction
    if (line.includes('NAMA') || line.startsWith('NAM')) {
      const parts = cleanLines[i].split(/[:;=-]/);
      if (parts.length > 1 && parts[1].trim().length > 2) {
        parsed.fullName = parts[1].trim().replace(/[^a-zA-Z\s,.'`]/g, '');
      } else if (i + 1 < cleanLines.length && !cleanLines[i + 1].includes(':')) {
        parsed.fullName = cleanLines[i + 1].trim().replace(/[^a-zA-Z\s,.'`]/g, '');
      }
    }

    // Tempat/Tgl Lahir
    if (line.includes('TEMPAT') || line.includes('LAHIR')) {
      const parts = cleanLines[i].split(/[:;=-]/);
      const val = parts.length > 1 ? parts[1].trim() : '';
      if (val.includes(',')) {
        const [place, datePart] = val.split(',');
        parsed.birthPlace = place.trim();
        // Extract date if not already found from NIK
        const dMatch = datePart.match(/(\d{2})[-/ ](\d{2})[-/ ](\d{4})/);
        if (dMatch && !parsed.birthDate) {
          parsed.birthDate = `${dMatch[3]}-${dMatch[2]}-${dMatch[1]}`;
        }
      }
    }

    // Gender
    if (line.includes('KELAMIN') || line.includes('JENIS')) {
      if (line.includes('LAKI') || line.includes('PRIA')) {
        parsed.gender = 'LAKI-LAKI';
      } else if (line.includes('PEREMPUAN') || line.includes('WANITA')) {
        parsed.gender = 'PEREMPUAN';
      }
    }

    // Address
    if (line.includes('ALAMAT')) {
      const parts = cleanLines[i].split(/[:;=-]/);
      if (parts.length > 1) {
        parsed.address = parts[1].trim();
      }
    }

    // RT/RW
    if (line.includes('RT') || line.includes('RW')) {
      const rtrwMatch = cleanLines[i].match(/(\d{3}\s*\/\s*\d{3})/);
      if (rtrwMatch) {
        parsed.rtRw = rtrwMatch[1].replace(/\s+/g, '');
      }
    }

    // Kel/Desa
    if (line.includes('KEL') || line.includes('DESA')) {
      const parts = cleanLines[i].split(/[:;=-]/);
      if (parts.length > 1) parsed.kelDesa = parts[1].trim();
    }

    // Kecamatan
    if (line.includes('KECAMATAN')) {
      const parts = cleanLines[i].split(/[:;=-]/);
      if (parts.length > 1) parsed.kecamatan = parts[1].trim();
    }

    // Agama
    if (line.includes('AGAMA')) {
      const parts = cleanLines[i].split(/[:;=-]/);
      if (parts.length > 1) parsed.religion = parts[1].trim();
    }

    // Status Perkawinan
    if (line.includes('STATUS') || line.includes('KAWIN')) {
      if (line.includes('BELUM KAWIN') || line.includes('BELUM MENIKAH')) {
        parsed.maritalStatus = 'Belum Kawin';
      } else if (line.includes('KAWIN') || line.includes('MENIKAH')) {
        parsed.maritalStatus = 'Kawin';
      }
    }
  }

  if (parsed.fullName) parsed.confidence = Math.min(100, parsed.confidence + 15);
  return parsed;
}
