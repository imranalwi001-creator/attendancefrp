-- Fix incorrect is_benar values for objective questions
-- Updates answers where the student's answer matches the correct option (is_kunci = true)

UPDATE ujian_jawaban uj
SET is_benar = true,
    nilai = us.bobot_nilai
FROM ujian_soal us
JOIN ujian_soal_opsi o ON o.soal_id = us.id AND o.is_kunci = true
WHERE uj.soal_id = us.id
  AND UPPER(uj.jawaban) = UPPER(o.label)
  AND uj.is_benar = false;

-- Also fix answers marked as true but don't match correct option
UPDATE ujian_jawaban uj
SET is_benar = false,
    nilai = 0
FROM ujian_soal us
JOIN ujian_soal_opsi o ON o.soal_id = us.id AND o.is_kunci = true
WHERE uj.soal_id = us.id
  AND (uj.jawaban IS NULL OR UPPER(uj.jawaban) != UPPER(o.label))
  AND uj.is_benar = true;