import { format, parse } from 'date-fns';

// Learning Model Types
export type LearningModel = 'normal' | 'sistem_blok';

export interface LearningBlock {
  id: string;
  academic_year_id: string;
  semester: 'ganjil' | 'genap';
  fase: number; // 1-5
  start_date: string;
  end_date: string;
  selected_dates?: string[] | null; // Individual selected dates
  created_at?: string;
  updated_at?: string;
}

export interface LearningBlockInput {
  fase: number;
  start_date: string;
  end_date: string;
  selected_dates?: string[]; // Individual selected dates
}

// Extended AcademicYear with learning model
export interface AcademicYearWithModel {
  id: string;
  name: string;
  odd_semester_start: string;
  odd_semester_end: string;
  even_semester_start: string;
  even_semester_end: string;
  odd_semester_model: LearningModel;
  even_semester_model: LearningModel;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Form data for creating/updating blocks
export interface SemesterBlockConfig {
  model: LearningModel;
  blocks: LearningBlockInput[];
}

// Validation result
export interface BlockValidationResult {
  isValid: boolean;
  errors: string[];
}

// Helper function to validate blocks
export function validateBlocks(
  blocks: LearningBlockInput[],
  semesterStart: Date,
  semesterEnd: Date
): BlockValidationResult {
  const errors: string[] = [];

  const parseLocalDate = (dateStr: string) => parse(dateStr, 'yyyy-MM-dd', new Date());

  // Check block count (3-5)
  if (blocks.length < 3) {
    errors.push('Minimal 3 blok diperlukan untuk sistem blok');
  }
  if (blocks.length > 5) {
    errors.push('Maksimal 5 blok diperbolehkan');
  }

  // Check each block
  blocks.forEach((block, index) => {
    const startDate = parseLocalDate(block.start_date);
    const endDate = parseLocalDate(block.end_date);

    // Check date range validity
    if (endDate < startDate) {
      errors.push(`Blok ${index + 1}: Tanggal selesai harus setelah tanggal mulai`);
    }

    // Check if within semester range
    if (startDate < semesterStart) {
      errors.push(`Blok ${index + 1}: Tanggal mulai di luar range semester`);
    }
    if (endDate > semesterEnd) {
      errors.push(`Blok ${index + 1}: Tanggal selesai di luar range semester`);
    }

    // Check fase validity (1-5)
    if (block.fase < 1 || block.fase > 5) {
      errors.push(`Blok ${index + 1}: Fase harus antara 1-5`);
    }
  });

  // Check for overlapping blocks
  for (let i = 0; i < blocks.length; i++) {
    for (let j = i + 1; j < blocks.length; j++) {
      const block1Start = parseLocalDate(blocks[i].start_date);
      const block1End = parseLocalDate(blocks[i].end_date);
      const block2Start = parseLocalDate(blocks[j].start_date);
      const block2End = parseLocalDate(blocks[j].end_date);

      // Check overlap
      if (block1Start <= block2End && block2Start <= block1End) {
        errors.push(`Blok ${i + 1} dan Blok ${j + 1} overlap`);
      }
    }
  }

  // Check for duplicate fase
  const fases = blocks.map(b => b.fase);
  const uniqueFases = new Set(fases);
  if (fases.length !== uniqueFases.size) {
    errors.push('Setiap blok harus memiliki fase yang berbeda');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

// Generate default blocks for sistem blok
export function generateDefaultBlocks(
  semesterStart: Date,
  semesterEnd: Date,
  count: number = 3
): LearningBlockInput[] {
  const formatLocalDate = (date: Date) => format(date, 'yyyy-MM-dd');

  const totalDays = Math.floor((semesterEnd.getTime() - semesterStart.getTime()) / (1000 * 60 * 60 * 24));
  const daysPerBlock = Math.floor(totalDays / count);
  
  const blocks: LearningBlockInput[] = [];
  let currentDate = new Date(semesterStart);

  for (let i = 0; i < count; i++) {
    const startDate = new Date(currentDate);
    const endDate = new Date(currentDate);
    
    if (i === count - 1) {
      // Last block ends at semester end
      endDate.setTime(semesterEnd.getTime());
    } else {
      endDate.setDate(endDate.getDate() + daysPerBlock - 1);
    }

    blocks.push({
      fase: i + 1,
      start_date: formatLocalDate(startDate),
      end_date: formatLocalDate(endDate),
    });

    currentDate.setDate(endDate.getDate() + 1);
  }

  return blocks;
}
