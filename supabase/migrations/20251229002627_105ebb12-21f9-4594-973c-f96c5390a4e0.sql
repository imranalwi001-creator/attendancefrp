-- Insert default pelanggaran categories
INSERT INTO public.konseling_kategori (nama, tipe, poin, deskripsi) VALUES
('Terlambat', 'pelanggaran', 5, 'Terlambat masuk kelas/sekolah'),
('Tidak Berseragam Lengkap', 'pelanggaran', 10, 'Tidak memakai seragam lengkap'),
('Tidak Mengerjakan Tugas', 'pelanggaran', 15, 'Tidak mengerjakan tugas yang diberikan'),
('Membolos', 'pelanggaran', 25, 'Tidak hadir tanpa keterangan'),
('Berkelahi', 'pelanggaran', 50, 'Terlibat perkelahian'),
('Merokok', 'pelanggaran', 75, 'Kedapatan merokok'),
('Bullying', 'pelanggaran', 50, 'Melakukan bullying terhadap teman'),
('Merusak Fasilitas', 'pelanggaran', 40, 'Merusak fasilitas sekolah'),
('Tidak Sopan', 'pelanggaran', 20, 'Berperilaku tidak sopan'),
('Membawa HP', 'pelanggaran', 30, 'Membawa HP tanpa izin');