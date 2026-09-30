-- Insert tahun ajaran untuk menampung data kelas yang ada
INSERT INTO academic_years (name, odd_semester_start, odd_semester_end, even_semester_start, even_semester_end, odd_semester_model, even_semester_model, is_active)
VALUES 
  ('2024/2025', '2024-07-15', '2024-12-20', '2025-01-06', '2025-06-20', 'normal', 'normal', false),
  ('2025/2026', '2025-07-14', '2025-12-19', '2026-01-05', '2026-06-19', 'normal', 'normal', true)
ON CONFLICT (name) DO NOTHING;
