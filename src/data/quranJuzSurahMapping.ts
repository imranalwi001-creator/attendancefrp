// Complete Quran Juz-Surah Mapping
// Each entry represents a Surah segment within a specific Juz
// Surahs that span multiple Juz have separate entries for each Juz

export interface JuzSurahMapping {
  juz_number: number;
  surah_number: number;
  surah_name_latin: string;
  surah_name_arabic: string;
  total_verses_in_surah: number;
  start_verse_in_juz: number;
  end_verse_in_juz: number;
}

export const QURAN_JUZ_SURAH_MAPPING: JuzSurahMapping[] = [
  // Juz 1
  { juz_number: 1, surah_number: 1, surah_name_latin: "Al-Fatihah", surah_name_arabic: "الفاتحة", total_verses_in_surah: 7, start_verse_in_juz: 1, end_verse_in_juz: 7 },
  { juz_number: 1, surah_number: 2, surah_name_latin: "Al-Baqarah", surah_name_arabic: "البقرة", total_verses_in_surah: 286, start_verse_in_juz: 1, end_verse_in_juz: 141 },

  // Juz 2
  { juz_number: 2, surah_number: 2, surah_name_latin: "Al-Baqarah", surah_name_arabic: "البقرة", total_verses_in_surah: 286, start_verse_in_juz: 142, end_verse_in_juz: 252 },

  // Juz 3
  { juz_number: 3, surah_number: 2, surah_name_latin: "Al-Baqarah", surah_name_arabic: "البقرة", total_verses_in_surah: 286, start_verse_in_juz: 253, end_verse_in_juz: 286 },
  { juz_number: 3, surah_number: 3, surah_name_latin: "Ali 'Imran", surah_name_arabic: "آل عمران", total_verses_in_surah: 200, start_verse_in_juz: 1, end_verse_in_juz: 92 },

  // Juz 4
  { juz_number: 4, surah_number: 3, surah_name_latin: "Ali 'Imran", surah_name_arabic: "آل عمران", total_verses_in_surah: 200, start_verse_in_juz: 93, end_verse_in_juz: 200 },
  { juz_number: 4, surah_number: 4, surah_name_latin: "An-Nisa'", surah_name_arabic: "النساء", total_verses_in_surah: 176, start_verse_in_juz: 1, end_verse_in_juz: 23 },

  // Juz 5
  { juz_number: 5, surah_number: 4, surah_name_latin: "An-Nisa'", surah_name_arabic: "النساء", total_verses_in_surah: 176, start_verse_in_juz: 24, end_verse_in_juz: 147 },

  // Juz 6
  { juz_number: 6, surah_number: 4, surah_name_latin: "An-Nisa'", surah_name_arabic: "النساء", total_verses_in_surah: 176, start_verse_in_juz: 148, end_verse_in_juz: 176 },
  { juz_number: 6, surah_number: 5, surah_name_latin: "Al-Ma'idah", surah_name_arabic: "المائدة", total_verses_in_surah: 120, start_verse_in_juz: 1, end_verse_in_juz: 81 },

  // Juz 7
  { juz_number: 7, surah_number: 5, surah_name_latin: "Al-Ma'idah", surah_name_arabic: "المائدة", total_verses_in_surah: 120, start_verse_in_juz: 82, end_verse_in_juz: 120 },
  { juz_number: 7, surah_number: 6, surah_name_latin: "Al-An'am", surah_name_arabic: "الأنعام", total_verses_in_surah: 165, start_verse_in_juz: 1, end_verse_in_juz: 110 },

  // Juz 8
  { juz_number: 8, surah_number: 6, surah_name_latin: "Al-An'am", surah_name_arabic: "الأنعام", total_verses_in_surah: 165, start_verse_in_juz: 111, end_verse_in_juz: 165 },
  { juz_number: 8, surah_number: 7, surah_name_latin: "Al-A'raf", surah_name_arabic: "الأعراف", total_verses_in_surah: 206, start_verse_in_juz: 1, end_verse_in_juz: 87 },

  // Juz 9
  { juz_number: 9, surah_number: 7, surah_name_latin: "Al-A'raf", surah_name_arabic: "الأعراف", total_verses_in_surah: 206, start_verse_in_juz: 88, end_verse_in_juz: 206 },
  { juz_number: 9, surah_number: 8, surah_name_latin: "Al-Anfal", surah_name_arabic: "الأنفال", total_verses_in_surah: 75, start_verse_in_juz: 1, end_verse_in_juz: 40 },

  // Juz 10
  { juz_number: 10, surah_number: 8, surah_name_latin: "Al-Anfal", surah_name_arabic: "الأنفال", total_verses_in_surah: 75, start_verse_in_juz: 41, end_verse_in_juz: 75 },
  { juz_number: 10, surah_number: 9, surah_name_latin: "At-Taubah", surah_name_arabic: "التوبة", total_verses_in_surah: 129, start_verse_in_juz: 1, end_verse_in_juz: 92 },

  // Juz 11
  { juz_number: 11, surah_number: 9, surah_name_latin: "At-Taubah", surah_name_arabic: "التوبة", total_verses_in_surah: 129, start_verse_in_juz: 93, end_verse_in_juz: 129 },
  { juz_number: 11, surah_number: 10, surah_name_latin: "Yunus", surah_name_arabic: "يونس", total_verses_in_surah: 109, start_verse_in_juz: 1, end_verse_in_juz: 109 },
  { juz_number: 11, surah_number: 11, surah_name_latin: "Hud", surah_name_arabic: "هود", total_verses_in_surah: 123, start_verse_in_juz: 1, end_verse_in_juz: 5 },

  // Juz 12
  { juz_number: 12, surah_number: 11, surah_name_latin: "Hud", surah_name_arabic: "هود", total_verses_in_surah: 123, start_verse_in_juz: 6, end_verse_in_juz: 123 },
  { juz_number: 12, surah_number: 12, surah_name_latin: "Yusuf", surah_name_arabic: "يوسف", total_verses_in_surah: 111, start_verse_in_juz: 1, end_verse_in_juz: 52 },

  // Juz 13
  { juz_number: 13, surah_number: 12, surah_name_latin: "Yusuf", surah_name_arabic: "يوسف", total_verses_in_surah: 111, start_verse_in_juz: 53, end_verse_in_juz: 111 },
  { juz_number: 13, surah_number: 13, surah_name_latin: "Ar-Ra'd", surah_name_arabic: "الرعد", total_verses_in_surah: 43, start_verse_in_juz: 1, end_verse_in_juz: 43 },
  { juz_number: 13, surah_number: 14, surah_name_latin: "Ibrahim", surah_name_arabic: "إبراهيم", total_verses_in_surah: 52, start_verse_in_juz: 1, end_verse_in_juz: 52 },

  // Juz 14
  { juz_number: 14, surah_number: 15, surah_name_latin: "Al-Hijr", surah_name_arabic: "الحجر", total_verses_in_surah: 99, start_verse_in_juz: 1, end_verse_in_juz: 99 },
  { juz_number: 14, surah_number: 16, surah_name_latin: "An-Nahl", surah_name_arabic: "النحل", total_verses_in_surah: 128, start_verse_in_juz: 1, end_verse_in_juz: 128 },

  // Juz 15
  { juz_number: 15, surah_number: 17, surah_name_latin: "Al-Isra'", surah_name_arabic: "الإسراء", total_verses_in_surah: 111, start_verse_in_juz: 1, end_verse_in_juz: 111 },
  { juz_number: 15, surah_number: 18, surah_name_latin: "Al-Kahf", surah_name_arabic: "الكهف", total_verses_in_surah: 110, start_verse_in_juz: 1, end_verse_in_juz: 74 },

  // Juz 16
  { juz_number: 16, surah_number: 18, surah_name_latin: "Al-Kahf", surah_name_arabic: "الكهف", total_verses_in_surah: 110, start_verse_in_juz: 75, end_verse_in_juz: 110 },
  { juz_number: 16, surah_number: 19, surah_name_latin: "Maryam", surah_name_arabic: "مريم", total_verses_in_surah: 98, start_verse_in_juz: 1, end_verse_in_juz: 98 },
  { juz_number: 16, surah_number: 20, surah_name_latin: "Taha", surah_name_arabic: "طه", total_verses_in_surah: 135, start_verse_in_juz: 1, end_verse_in_juz: 135 },

  // Juz 17
  { juz_number: 17, surah_number: 21, surah_name_latin: "Al-Anbiya'", surah_name_arabic: "الأنبياء", total_verses_in_surah: 112, start_verse_in_juz: 1, end_verse_in_juz: 112 },
  { juz_number: 17, surah_number: 22, surah_name_latin: "Al-Hajj", surah_name_arabic: "الحج", total_verses_in_surah: 78, start_verse_in_juz: 1, end_verse_in_juz: 78 },

  // Juz 18
  { juz_number: 18, surah_number: 23, surah_name_latin: "Al-Mu'minun", surah_name_arabic: "المؤمنون", total_verses_in_surah: 118, start_verse_in_juz: 1, end_verse_in_juz: 118 },
  { juz_number: 18, surah_number: 24, surah_name_latin: "An-Nur", surah_name_arabic: "النور", total_verses_in_surah: 64, start_verse_in_juz: 1, end_verse_in_juz: 64 },
  { juz_number: 18, surah_number: 25, surah_name_latin: "Al-Furqan", surah_name_arabic: "الفرقان", total_verses_in_surah: 77, start_verse_in_juz: 1, end_verse_in_juz: 20 },

  // Juz 19
  { juz_number: 19, surah_number: 25, surah_name_latin: "Al-Furqan", surah_name_arabic: "الفرقان", total_verses_in_surah: 77, start_verse_in_juz: 21, end_verse_in_juz: 77 },
  { juz_number: 19, surah_number: 26, surah_name_latin: "Asy-Syu'ara'", surah_name_arabic: "الشعراء", total_verses_in_surah: 227, start_verse_in_juz: 1, end_verse_in_juz: 227 },
  { juz_number: 19, surah_number: 27, surah_name_latin: "An-Naml", surah_name_arabic: "النمل", total_verses_in_surah: 93, start_verse_in_juz: 1, end_verse_in_juz: 55 },

  // Juz 20
  { juz_number: 20, surah_number: 27, surah_name_latin: "An-Naml", surah_name_arabic: "النمل", total_verses_in_surah: 93, start_verse_in_juz: 56, end_verse_in_juz: 93 },
  { juz_number: 20, surah_number: 28, surah_name_latin: "Al-Qasas", surah_name_arabic: "القصص", total_verses_in_surah: 88, start_verse_in_juz: 1, end_verse_in_juz: 88 },
  { juz_number: 20, surah_number: 29, surah_name_latin: "Al-'Ankabut", surah_name_arabic: "العنكبوت", total_verses_in_surah: 69, start_verse_in_juz: 1, end_verse_in_juz: 45 },

  // Juz 21
  { juz_number: 21, surah_number: 29, surah_name_latin: "Al-'Ankabut", surah_name_arabic: "العنكبوت", total_verses_in_surah: 69, start_verse_in_juz: 46, end_verse_in_juz: 69 },
  { juz_number: 21, surah_number: 30, surah_name_latin: "Ar-Rum", surah_name_arabic: "الروم", total_verses_in_surah: 60, start_verse_in_juz: 1, end_verse_in_juz: 60 },
  { juz_number: 21, surah_number: 31, surah_name_latin: "Luqman", surah_name_arabic: "لقمان", total_verses_in_surah: 34, start_verse_in_juz: 1, end_verse_in_juz: 34 },
  { juz_number: 21, surah_number: 32, surah_name_latin: "As-Sajdah", surah_name_arabic: "السجدة", total_verses_in_surah: 30, start_verse_in_juz: 1, end_verse_in_juz: 30 },
  { juz_number: 21, surah_number: 33, surah_name_latin: "Al-Ahzab", surah_name_arabic: "الأحزاب", total_verses_in_surah: 73, start_verse_in_juz: 1, end_verse_in_juz: 30 },

  // Juz 22
  { juz_number: 22, surah_number: 33, surah_name_latin: "Al-Ahzab", surah_name_arabic: "الأحزاب", total_verses_in_surah: 73, start_verse_in_juz: 31, end_verse_in_juz: 73 },
  { juz_number: 22, surah_number: 34, surah_name_latin: "Saba'", surah_name_arabic: "سبأ", total_verses_in_surah: 54, start_verse_in_juz: 1, end_verse_in_juz: 54 },
  { juz_number: 22, surah_number: 35, surah_name_latin: "Fatir", surah_name_arabic: "فاطر", total_verses_in_surah: 45, start_verse_in_juz: 1, end_verse_in_juz: 45 },
  { juz_number: 22, surah_number: 36, surah_name_latin: "Ya Sin", surah_name_arabic: "يس", total_verses_in_surah: 83, start_verse_in_juz: 1, end_verse_in_juz: 27 },

  // Juz 23
  { juz_number: 23, surah_number: 36, surah_name_latin: "Ya Sin", surah_name_arabic: "يس", total_verses_in_surah: 83, start_verse_in_juz: 28, end_verse_in_juz: 83 },
  { juz_number: 23, surah_number: 37, surah_name_latin: "As-Saffat", surah_name_arabic: "الصافات", total_verses_in_surah: 182, start_verse_in_juz: 1, end_verse_in_juz: 182 },
  { juz_number: 23, surah_number: 38, surah_name_latin: "Sad", surah_name_arabic: "ص", total_verses_in_surah: 88, start_verse_in_juz: 1, end_verse_in_juz: 88 },
  { juz_number: 23, surah_number: 39, surah_name_latin: "Az-Zumar", surah_name_arabic: "الزمر", total_verses_in_surah: 75, start_verse_in_juz: 1, end_verse_in_juz: 31 },

  // Juz 24
  { juz_number: 24, surah_number: 39, surah_name_latin: "Az-Zumar", surah_name_arabic: "الزمر", total_verses_in_surah: 75, start_verse_in_juz: 32, end_verse_in_juz: 75 },
  { juz_number: 24, surah_number: 40, surah_name_latin: "Ghafir", surah_name_arabic: "غافر", total_verses_in_surah: 85, start_verse_in_juz: 1, end_verse_in_juz: 85 },
  { juz_number: 24, surah_number: 41, surah_name_latin: "Fussilat", surah_name_arabic: "فصلت", total_verses_in_surah: 54, start_verse_in_juz: 1, end_verse_in_juz: 46 },

  // Juz 25
  { juz_number: 25, surah_number: 41, surah_name_latin: "Fussilat", surah_name_arabic: "فصلت", total_verses_in_surah: 54, start_verse_in_juz: 47, end_verse_in_juz: 54 },
  { juz_number: 25, surah_number: 42, surah_name_latin: "Asy-Syura", surah_name_arabic: "الشورى", total_verses_in_surah: 53, start_verse_in_juz: 1, end_verse_in_juz: 53 },
  { juz_number: 25, surah_number: 43, surah_name_latin: "Az-Zukhruf", surah_name_arabic: "الزخرف", total_verses_in_surah: 89, start_verse_in_juz: 1, end_verse_in_juz: 89 },
  { juz_number: 25, surah_number: 44, surah_name_latin: "Ad-Dukhan", surah_name_arabic: "الدخان", total_verses_in_surah: 59, start_verse_in_juz: 1, end_verse_in_juz: 59 },
  { juz_number: 25, surah_number: 45, surah_name_latin: "Al-Jasiyah", surah_name_arabic: "الجاثية", total_verses_in_surah: 37, start_verse_in_juz: 1, end_verse_in_juz: 37 },

  // Juz 26
  { juz_number: 26, surah_number: 46, surah_name_latin: "Al-Ahqaf", surah_name_arabic: "الأحقاف", total_verses_in_surah: 35, start_verse_in_juz: 1, end_verse_in_juz: 35 },
  { juz_number: 26, surah_number: 47, surah_name_latin: "Muhammad", surah_name_arabic: "محمد", total_verses_in_surah: 38, start_verse_in_juz: 1, end_verse_in_juz: 38 },
  { juz_number: 26, surah_number: 48, surah_name_latin: "Al-Fath", surah_name_arabic: "الفتح", total_verses_in_surah: 29, start_verse_in_juz: 1, end_verse_in_juz: 29 },
  { juz_number: 26, surah_number: 49, surah_name_latin: "Al-Hujurat", surah_name_arabic: "الحجرات", total_verses_in_surah: 18, start_verse_in_juz: 1, end_verse_in_juz: 18 },
  { juz_number: 26, surah_number: 50, surah_name_latin: "Qaf", surah_name_arabic: "ق", total_verses_in_surah: 45, start_verse_in_juz: 1, end_verse_in_juz: 45 },
  { juz_number: 26, surah_number: 51, surah_name_latin: "Az-Zariyat", surah_name_arabic: "الذاريات", total_verses_in_surah: 60, start_verse_in_juz: 1, end_verse_in_juz: 30 },

  // Juz 27
  { juz_number: 27, surah_number: 51, surah_name_latin: "Az-Zariyat", surah_name_arabic: "الذاريات", total_verses_in_surah: 60, start_verse_in_juz: 31, end_verse_in_juz: 60 },
  { juz_number: 27, surah_number: 52, surah_name_latin: "At-Tur", surah_name_arabic: "الطور", total_verses_in_surah: 49, start_verse_in_juz: 1, end_verse_in_juz: 49 },
  { juz_number: 27, surah_number: 53, surah_name_latin: "An-Najm", surah_name_arabic: "النجم", total_verses_in_surah: 62, start_verse_in_juz: 1, end_verse_in_juz: 62 },
  { juz_number: 27, surah_number: 54, surah_name_latin: "Al-Qamar", surah_name_arabic: "القمر", total_verses_in_surah: 55, start_verse_in_juz: 1, end_verse_in_juz: 55 },
  { juz_number: 27, surah_number: 55, surah_name_latin: "Ar-Rahman", surah_name_arabic: "الرحمن", total_verses_in_surah: 78, start_verse_in_juz: 1, end_verse_in_juz: 78 },
  { juz_number: 27, surah_number: 56, surah_name_latin: "Al-Waqi'ah", surah_name_arabic: "الواقعة", total_verses_in_surah: 96, start_verse_in_juz: 1, end_verse_in_juz: 96 },
  { juz_number: 27, surah_number: 57, surah_name_latin: "Al-Hadid", surah_name_arabic: "الحديد", total_verses_in_surah: 29, start_verse_in_juz: 1, end_verse_in_juz: 29 },

  // Juz 28
  { juz_number: 28, surah_number: 58, surah_name_latin: "Al-Mujadalah", surah_name_arabic: "المجادلة", total_verses_in_surah: 22, start_verse_in_juz: 1, end_verse_in_juz: 22 },
  { juz_number: 28, surah_number: 59, surah_name_latin: "Al-Hasyr", surah_name_arabic: "الحشر", total_verses_in_surah: 24, start_verse_in_juz: 1, end_verse_in_juz: 24 },
  { juz_number: 28, surah_number: 60, surah_name_latin: "Al-Mumtahanah", surah_name_arabic: "الممتحنة", total_verses_in_surah: 13, start_verse_in_juz: 1, end_verse_in_juz: 13 },
  { juz_number: 28, surah_number: 61, surah_name_latin: "As-Saff", surah_name_arabic: "الصف", total_verses_in_surah: 14, start_verse_in_juz: 1, end_verse_in_juz: 14 },
  { juz_number: 28, surah_number: 62, surah_name_latin: "Al-Jumu'ah", surah_name_arabic: "الجمعة", total_verses_in_surah: 11, start_verse_in_juz: 1, end_verse_in_juz: 11 },
  { juz_number: 28, surah_number: 63, surah_name_latin: "Al-Munafiqun", surah_name_arabic: "المنافقون", total_verses_in_surah: 11, start_verse_in_juz: 1, end_verse_in_juz: 11 },
  { juz_number: 28, surah_number: 64, surah_name_latin: "At-Tagabun", surah_name_arabic: "التغابن", total_verses_in_surah: 18, start_verse_in_juz: 1, end_verse_in_juz: 18 },
  { juz_number: 28, surah_number: 65, surah_name_latin: "At-Talaq", surah_name_arabic: "الطلاق", total_verses_in_surah: 12, start_verse_in_juz: 1, end_verse_in_juz: 12 },
  { juz_number: 28, surah_number: 66, surah_name_latin: "At-Tahrim", surah_name_arabic: "التحريم", total_verses_in_surah: 12, start_verse_in_juz: 1, end_verse_in_juz: 12 },

  // Juz 29
  { juz_number: 29, surah_number: 67, surah_name_latin: "Al-Mulk", surah_name_arabic: "الملك", total_verses_in_surah: 30, start_verse_in_juz: 1, end_verse_in_juz: 30 },
  { juz_number: 29, surah_number: 68, surah_name_latin: "Al-Qalam", surah_name_arabic: "القلم", total_verses_in_surah: 52, start_verse_in_juz: 1, end_verse_in_juz: 52 },
  { juz_number: 29, surah_number: 69, surah_name_latin: "Al-Haqqah", surah_name_arabic: "الحاقة", total_verses_in_surah: 52, start_verse_in_juz: 1, end_verse_in_juz: 52 },
  { juz_number: 29, surah_number: 70, surah_name_latin: "Al-Ma'arij", surah_name_arabic: "المعارج", total_verses_in_surah: 44, start_verse_in_juz: 1, end_verse_in_juz: 44 },
  { juz_number: 29, surah_number: 71, surah_name_latin: "Nuh", surah_name_arabic: "نوح", total_verses_in_surah: 28, start_verse_in_juz: 1, end_verse_in_juz: 28 },
  { juz_number: 29, surah_number: 72, surah_name_latin: "Al-Jinn", surah_name_arabic: "الجن", total_verses_in_surah: 28, start_verse_in_juz: 1, end_verse_in_juz: 28 },
  { juz_number: 29, surah_number: 73, surah_name_latin: "Al-Muzzammil", surah_name_arabic: "المزمل", total_verses_in_surah: 20, start_verse_in_juz: 1, end_verse_in_juz: 20 },
  { juz_number: 29, surah_number: 74, surah_name_latin: "Al-Muddassir", surah_name_arabic: "المدثر", total_verses_in_surah: 56, start_verse_in_juz: 1, end_verse_in_juz: 56 },
  { juz_number: 29, surah_number: 75, surah_name_latin: "Al-Qiyamah", surah_name_arabic: "القيامة", total_verses_in_surah: 40, start_verse_in_juz: 1, end_verse_in_juz: 40 },
  { juz_number: 29, surah_number: 76, surah_name_latin: "Al-Insan", surah_name_arabic: "الإنسان", total_verses_in_surah: 31, start_verse_in_juz: 1, end_verse_in_juz: 31 },
  { juz_number: 29, surah_number: 77, surah_name_latin: "Al-Mursalat", surah_name_arabic: "المرسلات", total_verses_in_surah: 50, start_verse_in_juz: 1, end_verse_in_juz: 50 },

  // Juz 30 (Juz 'Amma)
  { juz_number: 30, surah_number: 78, surah_name_latin: "An-Naba'", surah_name_arabic: "النبأ", total_verses_in_surah: 40, start_verse_in_juz: 1, end_verse_in_juz: 40 },
  { juz_number: 30, surah_number: 79, surah_name_latin: "An-Nazi'at", surah_name_arabic: "النازعات", total_verses_in_surah: 46, start_verse_in_juz: 1, end_verse_in_juz: 46 },
  { juz_number: 30, surah_number: 80, surah_name_latin: "'Abasa", surah_name_arabic: "عبس", total_verses_in_surah: 42, start_verse_in_juz: 1, end_verse_in_juz: 42 },
  { juz_number: 30, surah_number: 81, surah_name_latin: "At-Takwir", surah_name_arabic: "التكوير", total_verses_in_surah: 29, start_verse_in_juz: 1, end_verse_in_juz: 29 },
  { juz_number: 30, surah_number: 82, surah_name_latin: "Al-Infitar", surah_name_arabic: "الانفطار", total_verses_in_surah: 19, start_verse_in_juz: 1, end_verse_in_juz: 19 },
  { juz_number: 30, surah_number: 83, surah_name_latin: "Al-Mutaffifin", surah_name_arabic: "المطففين", total_verses_in_surah: 36, start_verse_in_juz: 1, end_verse_in_juz: 36 },
  { juz_number: 30, surah_number: 84, surah_name_latin: "Al-Insyiqaq", surah_name_arabic: "الانشقاق", total_verses_in_surah: 25, start_verse_in_juz: 1, end_verse_in_juz: 25 },
  { juz_number: 30, surah_number: 85, surah_name_latin: "Al-Buruj", surah_name_arabic: "البروج", total_verses_in_surah: 22, start_verse_in_juz: 1, end_verse_in_juz: 22 },
  { juz_number: 30, surah_number: 86, surah_name_latin: "At-Tariq", surah_name_arabic: "الطارق", total_verses_in_surah: 17, start_verse_in_juz: 1, end_verse_in_juz: 17 },
  { juz_number: 30, surah_number: 87, surah_name_latin: "Al-A'la", surah_name_arabic: "الأعلى", total_verses_in_surah: 19, start_verse_in_juz: 1, end_verse_in_juz: 19 },
  { juz_number: 30, surah_number: 88, surah_name_latin: "Al-Gasyiyah", surah_name_arabic: "الغاشية", total_verses_in_surah: 26, start_verse_in_juz: 1, end_verse_in_juz: 26 },
  { juz_number: 30, surah_number: 89, surah_name_latin: "Al-Fajr", surah_name_arabic: "الفجر", total_verses_in_surah: 30, start_verse_in_juz: 1, end_verse_in_juz: 30 },
  { juz_number: 30, surah_number: 90, surah_name_latin: "Al-Balad", surah_name_arabic: "البلد", total_verses_in_surah: 20, start_verse_in_juz: 1, end_verse_in_juz: 20 },
  { juz_number: 30, surah_number: 91, surah_name_latin: "Asy-Syams", surah_name_arabic: "الشمس", total_verses_in_surah: 15, start_verse_in_juz: 1, end_verse_in_juz: 15 },
  { juz_number: 30, surah_number: 92, surah_name_latin: "Al-Lail", surah_name_arabic: "الليل", total_verses_in_surah: 21, start_verse_in_juz: 1, end_verse_in_juz: 21 },
  { juz_number: 30, surah_number: 93, surah_name_latin: "Ad-Duha", surah_name_arabic: "الضحى", total_verses_in_surah: 11, start_verse_in_juz: 1, end_verse_in_juz: 11 },
  { juz_number: 30, surah_number: 94, surah_name_latin: "Asy-Syarh", surah_name_arabic: "الشرح", total_verses_in_surah: 8, start_verse_in_juz: 1, end_verse_in_juz: 8 },
  { juz_number: 30, surah_number: 95, surah_name_latin: "At-Tin", surah_name_arabic: "التين", total_verses_in_surah: 8, start_verse_in_juz: 1, end_verse_in_juz: 8 },
  { juz_number: 30, surah_number: 96, surah_name_latin: "Al-'Alaq", surah_name_arabic: "العلق", total_verses_in_surah: 19, start_verse_in_juz: 1, end_verse_in_juz: 19 },
  { juz_number: 30, surah_number: 97, surah_name_latin: "Al-Qadr", surah_name_arabic: "القدر", total_verses_in_surah: 5, start_verse_in_juz: 1, end_verse_in_juz: 5 },
  { juz_number: 30, surah_number: 98, surah_name_latin: "Al-Bayyinah", surah_name_arabic: "البينة", total_verses_in_surah: 8, start_verse_in_juz: 1, end_verse_in_juz: 8 },
  { juz_number: 30, surah_number: 99, surah_name_latin: "Az-Zalzalah", surah_name_arabic: "الزلزلة", total_verses_in_surah: 8, start_verse_in_juz: 1, end_verse_in_juz: 8 },
  { juz_number: 30, surah_number: 100, surah_name_latin: "Al-'Adiyat", surah_name_arabic: "العاديات", total_verses_in_surah: 11, start_verse_in_juz: 1, end_verse_in_juz: 11 },
  { juz_number: 30, surah_number: 101, surah_name_latin: "Al-Qari'ah", surah_name_arabic: "القارعة", total_verses_in_surah: 11, start_verse_in_juz: 1, end_verse_in_juz: 11 },
  { juz_number: 30, surah_number: 102, surah_name_latin: "At-Takasur", surah_name_arabic: "التكاثر", total_verses_in_surah: 8, start_verse_in_juz: 1, end_verse_in_juz: 8 },
  { juz_number: 30, surah_number: 103, surah_name_latin: "Al-'Asr", surah_name_arabic: "العصر", total_verses_in_surah: 3, start_verse_in_juz: 1, end_verse_in_juz: 3 },
  { juz_number: 30, surah_number: 104, surah_name_latin: "Al-Humazah", surah_name_arabic: "الهمزة", total_verses_in_surah: 9, start_verse_in_juz: 1, end_verse_in_juz: 9 },
  { juz_number: 30, surah_number: 105, surah_name_latin: "Al-Fil", surah_name_arabic: "الفيل", total_verses_in_surah: 5, start_verse_in_juz: 1, end_verse_in_juz: 5 },
  { juz_number: 30, surah_number: 106, surah_name_latin: "Quraisy", surah_name_arabic: "قريش", total_verses_in_surah: 4, start_verse_in_juz: 1, end_verse_in_juz: 4 },
  { juz_number: 30, surah_number: 107, surah_name_latin: "Al-Ma'un", surah_name_arabic: "الماعون", total_verses_in_surah: 7, start_verse_in_juz: 1, end_verse_in_juz: 7 },
  { juz_number: 30, surah_number: 108, surah_name_latin: "Al-Kausar", surah_name_arabic: "الكوثر", total_verses_in_surah: 3, start_verse_in_juz: 1, end_verse_in_juz: 3 },
  { juz_number: 30, surah_number: 109, surah_name_latin: "Al-Kafirun", surah_name_arabic: "الكافرون", total_verses_in_surah: 6, start_verse_in_juz: 1, end_verse_in_juz: 6 },
  { juz_number: 30, surah_number: 110, surah_name_latin: "An-Nasr", surah_name_arabic: "النصر", total_verses_in_surah: 3, start_verse_in_juz: 1, end_verse_in_juz: 3 },
  { juz_number: 30, surah_number: 111, surah_name_latin: "Al-Lahab", surah_name_arabic: "المسد", total_verses_in_surah: 5, start_verse_in_juz: 1, end_verse_in_juz: 5 },
  { juz_number: 30, surah_number: 112, surah_name_latin: "Al-Ikhlas", surah_name_arabic: "الإخلاص", total_verses_in_surah: 4, start_verse_in_juz: 1, end_verse_in_juz: 4 },
  { juz_number: 30, surah_number: 113, surah_name_latin: "Al-Falaq", surah_name_arabic: "الفلق", total_verses_in_surah: 5, start_verse_in_juz: 1, end_verse_in_juz: 5 },
  { juz_number: 30, surah_number: 114, surah_name_latin: "An-Nas", surah_name_arabic: "الناس", total_verses_in_surah: 6, start_verse_in_juz: 1, end_verse_in_juz: 6 },
];

// Helper functions
export function getSurahsInJuz(juzNumber: number): JuzSurahMapping[] {
  return QURAN_JUZ_SURAH_MAPPING.filter(item => item.juz_number === juzNumber);
}

export function getJuzForSurah(surahNumber: number): number[] {
  return [...new Set(
    QURAN_JUZ_SURAH_MAPPING
      .filter(item => item.surah_number === surahNumber)
      .map(item => item.juz_number)
  )];
}

export function getVerseRangeInJuz(juzNumber: number, surahNumber: number): { start: number; end: number } | null {
  const mapping = QURAN_JUZ_SURAH_MAPPING.find(
    item => item.juz_number === juzNumber && item.surah_number === surahNumber
  );
  if (!mapping) return null;
  return {
    start: mapping.start_verse_in_juz,
    end: mapping.end_verse_in_juz
  };
}

/**
 * Get total verses for a surah by its number
 */
export function getTotalAyatBySurahNumber(surahNumber: number): number | null {
  const mapping = QURAN_JUZ_SURAH_MAPPING.find(item => item.surah_number === surahNumber);
  return mapping?.total_verses_in_surah || null;
}

/**
 * Get surah name by its number
 */
export function getSurahNameByNumber(surahNumber: number): string | null {
  const mapping = QURAN_JUZ_SURAH_MAPPING.find(item => item.surah_number === surahNumber);
  return mapping?.surah_name_latin || null;
}

/**
 * Get all unique surahs from the mapping
 */
export function getAllSurahs(): { number: number; name: string; totalVerses: number }[] {
  const surahMap = new Map<number, { number: number; name: string; totalVerses: number }>();
  
  QURAN_JUZ_SURAH_MAPPING.forEach(item => {
    if (!surahMap.has(item.surah_number)) {
      surahMap.set(item.surah_number, {
        number: item.surah_number,
        name: item.surah_name_latin,
        totalVerses: item.total_verses_in_surah,
      });
    }
  });
  
  return Array.from(surahMap.values()).sort((a, b) => a.number - b.number);
}
