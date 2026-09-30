
-- =============================================
-- 1. ujian_soal: drop old permissive policies (staff-only already exists)
-- =============================================
DROP POLICY IF EXISTS "Authenticated users can insert ujian_soal" ON ujian_soal;
DROP POLICY IF EXISTS "Authenticated users can update ujian_soal" ON ujian_soal;
DROP POLICY IF EXISTS "Authenticated users can delete ujian_soal" ON ujian_soal;
DROP POLICY IF EXISTS "Authenticated users can view ujian_soal" ON ujian_soal;

-- =============================================
-- 2. ujian_soal_opsi: drop old permissive policies (staff-only already exists)
-- =============================================
DROP POLICY IF EXISTS "Authenticated users can insert ujian_soal_opsi" ON ujian_soal_opsi;
DROP POLICY IF EXISTS "Authenticated users can update ujian_soal_opsi" ON ujian_soal_opsi;
DROP POLICY IF EXISTS "Authenticated users can delete ujian_soal_opsi" ON ujian_soal_opsi;
DROP POLICY IF EXISTS "Authenticated users can view ujian_soal_opsi" ON ujian_soal_opsi;

-- =============================================
-- 3. ujian_jawaban: scope to own answers for students, full for staff
-- =============================================
DROP POLICY IF EXISTS "Authenticated users can insert ujian_jawaban" ON ujian_jawaban;
DROP POLICY IF EXISTS "Authenticated users can update ujian_jawaban" ON ujian_jawaban;
DROP POLICY IF EXISTS "Authenticated users can delete ujian_jawaban" ON ujian_jawaban;
DROP POLICY IF EXISTS "Authenticated users can view ujian_jawaban" ON ujian_jawaban;

-- Staff can manage all answers
CREATE POLICY "Staff full access ujian_jawaban"
ON ujian_jawaban FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'guru', 'walikelas', 'Pembina', 'staff'))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'guru', 'walikelas', 'Pembina', 'staff'))
);

-- Students can view their own answers
CREATE POLICY "Santri view own ujian_jawaban"
ON ujian_jawaban FOR SELECT
TO authenticated
USING (peserta_id IN (SELECT id FROM ujian_peserta WHERE santri_id = auth.uid()));

-- Students can insert/update their own answers
CREATE POLICY "Santri manage own ujian_jawaban"
ON ujian_jawaban FOR INSERT
TO authenticated
WITH CHECK (peserta_id IN (SELECT id FROM ujian_peserta WHERE santri_id = auth.uid()));

CREATE POLICY "Santri update own ujian_jawaban"
ON ujian_jawaban FOR UPDATE
TO authenticated
USING (peserta_id IN (SELECT id FROM ujian_peserta WHERE santri_id = auth.uid()));

-- =============================================
-- 4. ujian_peserta: scope appropriately
-- =============================================
DROP POLICY IF EXISTS "Authenticated users can insert ujian_peserta" ON ujian_peserta;
DROP POLICY IF EXISTS "Authenticated users can update ujian_peserta" ON ujian_peserta;
DROP POLICY IF EXISTS "Authenticated users can delete ujian_peserta" ON ujian_peserta;
DROP POLICY IF EXISTS "Authenticated users can view ujian_peserta" ON ujian_peserta;

-- Staff full access
CREATE POLICY "Staff full access ujian_peserta"
ON ujian_peserta FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'guru', 'walikelas', 'Pembina', 'staff'))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'guru', 'walikelas', 'Pembina', 'staff'))
);

-- Santri can view own participation
CREATE POLICY "Santri view own ujian_peserta"
ON ujian_peserta FOR SELECT
TO authenticated
USING (santri_id = auth.uid());

-- Santri can update own participation (e.g. waktu_mulai, waktu_selesai)
CREATE POLICY "Santri update own ujian_peserta"
ON ujian_peserta FOR UPDATE
TO authenticated
USING (santri_id = auth.uid());

-- =============================================
-- 5. santri_psikologi_results: restrict to staff roles
-- =============================================
DROP POLICY IF EXISTS "Staff can insert psychology results" ON santri_psikologi_results;
DROP POLICY IF EXISTS "Staff can update psychology results" ON santri_psikologi_results;
DROP POLICY IF EXISTS "Staff can delete psychology results" ON santri_psikologi_results;
DROP POLICY IF EXISTS "Staff can view all psychology results" ON santri_psikologi_results;

CREATE POLICY "Staff can view psychology results"
ON santri_psikologi_results FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'guru') OR
  public.has_role(auth.uid(), 'walikelas') OR
  public.has_role(auth.uid(), 'Pembina')
);

CREATE POLICY "Staff can insert psychology results"
ON santri_psikologi_results FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'guru') OR
  public.has_role(auth.uid(), 'walikelas') OR
  public.has_role(auth.uid(), 'Pembina')
);

CREATE POLICY "Staff can update psychology results"
ON santri_psikologi_results FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'guru') OR
  public.has_role(auth.uid(), 'walikelas') OR
  public.has_role(auth.uid(), 'Pembina')
);

CREATE POLICY "Staff can delete psychology results"
ON santri_psikologi_results FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'guru') OR
  public.has_role(auth.uid(), 'walikelas') OR
  public.has_role(auth.uid(), 'Pembina')
);

-- =============================================
-- 6. psikologi_finalization: drop old duplicate permissive policies
-- =============================================
DROP POLICY IF EXISTS "Admin can insert psikologi finalization" ON psikologi_finalization;
DROP POLICY IF EXISTS "Admin can update psikologi finalization" ON psikologi_finalization;
DROP POLICY IF EXISTS "Admin can view psikologi finalization" ON psikologi_finalization;

-- =============================================
-- 7. notifications: replace open INSERT with role-based
-- =============================================
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON notifications;

-- Notifications are typically created by triggers (SECURITY DEFINER), 
-- but admin should also be able to create them directly
CREATE POLICY "Admin can insert notifications"
ON notifications FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));
