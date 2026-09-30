-- =============================================
-- RLS POLICIES FOR ALL TABLES
-- =============================================

-- =============================================
-- KELAS TABLE
-- =============================================
ALTER TABLE public.kelas ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can view kelas
CREATE POLICY "Authenticated users can view kelas"
ON public.kelas FOR SELECT TO authenticated
USING (true);

-- Admins can manage kelas
CREATE POLICY "Admins can insert kelas"
ON public.kelas FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update kelas"
ON public.kelas FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete kelas"
ON public.kelas FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- SANTRI TABLE
-- =============================================
ALTER TABLE public.santri ENABLE ROW LEVEL SECURITY;

-- Santri can view their own data
CREATE POLICY "Santri can view own data"
ON public.santri FOR SELECT TO authenticated
USING (auth.uid() = id);

-- Staff (admin, guru, walikelas) can view all santri
CREATE POLICY "Staff can view all santri"
ON public.santri FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'guru') OR 
  public.has_role(auth.uid(), 'walikelas')
);

-- Parents can view their children
CREATE POLICY "Parents can view their children"
ON public.santri FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM parent_children pc 
    WHERE pc.parent_id = auth.uid() AND pc.child_id = santri.id
  )
);

-- Admins can manage santri
CREATE POLICY "Admins can insert santri"
ON public.santri FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update santri"
ON public.santri FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete santri"
ON public.santri FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- STAFF TABLE
-- =============================================
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

-- Staff can view their own data
CREATE POLICY "Staff can view own data"
ON public.staff FOR SELECT TO authenticated
USING (auth.uid() = id);

-- Admins can view and manage all staff
CREATE POLICY "Admins can view all staff"
ON public.staff FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert staff"
ON public.staff FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update staff"
ON public.staff FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete staff"
ON public.staff FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- ORANGTUA TABLE
-- =============================================
ALTER TABLE public.orangtua ENABLE ROW LEVEL SECURITY;

-- Orangtua can view their own data
CREATE POLICY "Orangtua can view own data"
ON public.orangtua FOR SELECT TO authenticated
USING (auth.uid() = id);

-- Admins can manage orangtua
CREATE POLICY "Admins can view all orangtua"
ON public.orangtua FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert orangtua"
ON public.orangtua FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update orangtua"
ON public.orangtua FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete orangtua"
ON public.orangtua FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- PARENT_CHILDREN TABLE
-- =============================================
ALTER TABLE public.parent_children ENABLE ROW LEVEL SECURITY;

-- Parents can view their own relations
CREATE POLICY "Parents can view own relations"
ON public.parent_children FOR SELECT TO authenticated
USING (auth.uid() = parent_id);

-- Admins can manage parent_children
CREATE POLICY "Admins can view all parent_children"
ON public.parent_children FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert parent_children"
ON public.parent_children FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update parent_children"
ON public.parent_children FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete parent_children"
ON public.parent_children FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- MAPEL TABLE
-- =============================================
ALTER TABLE public.mapel ENABLE ROW LEVEL SECURITY;

-- All authenticated can view mapel
CREATE POLICY "Authenticated can view mapel"
ON public.mapel FOR SELECT TO authenticated
USING (true);

-- Admins can manage mapel
CREATE POLICY "Admins can insert mapel"
ON public.mapel FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update mapel"
ON public.mapel FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete mapel"
ON public.mapel FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- MAPEL_INFO TABLE
-- =============================================
ALTER TABLE public.mapel_info ENABLE ROW LEVEL SECURITY;

-- All authenticated can view mapel_info
CREATE POLICY "Authenticated can view mapel_info"
ON public.mapel_info FOR SELECT TO authenticated
USING (true);

-- Admins and teachers can manage mapel_info
CREATE POLICY "Staff can insert mapel_info"
ON public.mapel_info FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'guru')
);

CREATE POLICY "Staff can update mapel_info"
ON public.mapel_info FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'guru')
);

CREATE POLICY "Admins can delete mapel_info"
ON public.mapel_info FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- JADWAL TABLE
-- =============================================
ALTER TABLE public.jadwal ENABLE ROW LEVEL SECURITY;

-- All authenticated can view jadwal
CREATE POLICY "Authenticated can view jadwal"
ON public.jadwal FOR SELECT TO authenticated
USING (true);

-- Admins can manage jadwal
CREATE POLICY "Admins can insert jadwal"
ON public.jadwal FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update jadwal"
ON public.jadwal FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete jadwal"
ON public.jadwal FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- MATERI TABLE
-- =============================================
ALTER TABLE public.materi ENABLE ROW LEVEL SECURITY;

-- All authenticated can view materi
CREATE POLICY "Authenticated can view materi"
ON public.materi FOR SELECT TO authenticated
USING (true);

-- Teachers can manage their own materi
CREATE POLICY "Teachers can insert materi"
ON public.materi FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'guru') OR
  public.has_role(auth.uid(), 'walikelas')
);

CREATE POLICY "Teachers can update materi"
ON public.materi FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR 
  created_by = auth.uid()
);

CREATE POLICY "Admins can delete materi"
ON public.materi FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR 
  created_by = auth.uid()
);

-- =============================================
-- MATERI_READS TABLE
-- =============================================
ALTER TABLE public.materi_reads ENABLE ROW LEVEL SECURITY;

-- Santri can manage their own reads
CREATE POLICY "Santri can view own reads"
ON public.materi_reads FOR SELECT TO authenticated
USING (auth.uid() = santri_id);

CREATE POLICY "Santri can insert own reads"
ON public.materi_reads FOR INSERT TO authenticated
WITH CHECK (auth.uid() = santri_id);

-- Staff can view all reads
CREATE POLICY "Staff can view all reads"
ON public.materi_reads FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'guru') OR 
  public.has_role(auth.uid(), 'walikelas')
);

-- =============================================
-- TUGAS TABLE
-- =============================================
ALTER TABLE public.tugas ENABLE ROW LEVEL SECURITY;

-- All authenticated can view tugas
CREATE POLICY "Authenticated can view tugas"
ON public.tugas FOR SELECT TO authenticated
USING (true);

-- Teachers can manage tugas
CREATE POLICY "Teachers can insert tugas"
ON public.tugas FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'guru') OR
  public.has_role(auth.uid(), 'walikelas')
);

CREATE POLICY "Teachers can update tugas"
ON public.tugas FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR 
  created_by = auth.uid()
);

CREATE POLICY "Teachers can delete tugas"
ON public.tugas FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR 
  created_by = auth.uid()
);

-- =============================================
-- PENGUMPULAN_TUGAS TABLE
-- =============================================
ALTER TABLE public.pengumpulan_tugas ENABLE ROW LEVEL SECURITY;

-- Santri can view and manage their own submissions
CREATE POLICY "Santri can view own submissions"
ON public.pengumpulan_tugas FOR SELECT TO authenticated
USING (auth.uid() = santri_id);

CREATE POLICY "Santri can insert own submissions"
ON public.pengumpulan_tugas FOR INSERT TO authenticated
WITH CHECK (auth.uid() = santri_id);

CREATE POLICY "Santri can update own submissions"
ON public.pengumpulan_tugas FOR UPDATE TO authenticated
USING (auth.uid() = santri_id);

-- Staff can view and grade all submissions
CREATE POLICY "Staff can view all submissions"
ON public.pengumpulan_tugas FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'guru') OR 
  public.has_role(auth.uid(), 'walikelas')
);

CREATE POLICY "Staff can update submissions"
ON public.pengumpulan_tugas FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'guru') OR 
  public.has_role(auth.uid(), 'walikelas')
);

-- =============================================
-- SESI_PEMBELAJARAN TABLE
-- =============================================
ALTER TABLE public.sesi_pembelajaran ENABLE ROW LEVEL SECURITY;

-- All authenticated can view sesi
CREATE POLICY "Authenticated can view sesi"
ON public.sesi_pembelajaran FOR SELECT TO authenticated
USING (true);

-- Teachers can manage sesi
CREATE POLICY "Teachers can insert sesi"
ON public.sesi_pembelajaran FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'guru') OR
  public.has_role(auth.uid(), 'walikelas') OR
  auth.uid() = pengampu_id
);

CREATE POLICY "Teachers can update sesi"
ON public.sesi_pembelajaran FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR 
  auth.uid() = pengampu_id
);

CREATE POLICY "Admins can delete sesi"
ON public.sesi_pembelajaran FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- KEHADIRAN_SANTRI TABLE
-- =============================================
ALTER TABLE public.kehadiran_santri ENABLE ROW LEVEL SECURITY;

-- Santri can view their own attendance
CREATE POLICY "Santri can view own attendance"
ON public.kehadiran_santri FOR SELECT TO authenticated
USING (auth.uid() = santri_id);

-- Staff can view and manage all attendance
CREATE POLICY "Staff can view all attendance"
ON public.kehadiran_santri FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'guru') OR 
  public.has_role(auth.uid(), 'walikelas')
);

CREATE POLICY "Staff can insert attendance"
ON public.kehadiran_santri FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'guru') OR 
  public.has_role(auth.uid(), 'walikelas')
);

CREATE POLICY "Staff can update attendance"
ON public.kehadiran_santri FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'guru') OR 
  public.has_role(auth.uid(), 'walikelas')
);

CREATE POLICY "Admins can delete attendance"
ON public.kehadiran_santri FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Parents can view their children's attendance
CREATE POLICY "Parents can view children attendance"
ON public.kehadiran_santri FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM parent_children pc 
    WHERE pc.parent_id = auth.uid() AND pc.child_id = kehadiran_santri.santri_id
  )
);

-- =============================================
-- ASESMEN_FORMATIF TABLE
-- =============================================
ALTER TABLE public.asesmen_formatif ENABLE ROW LEVEL SECURITY;

-- Santri can view their own assessments
CREATE POLICY "Santri can view own formatif"
ON public.asesmen_formatif FOR SELECT TO authenticated
USING (auth.uid() = santri_id);

-- Staff can view and manage all assessments
CREATE POLICY "Staff can view all formatif"
ON public.asesmen_formatif FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'guru') OR 
  public.has_role(auth.uid(), 'walikelas')
);

CREATE POLICY "Staff can insert formatif"
ON public.asesmen_formatif FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'guru') OR 
  public.has_role(auth.uid(), 'walikelas')
);

CREATE POLICY "Staff can update formatif"
ON public.asesmen_formatif FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'guru') OR 
  public.has_role(auth.uid(), 'walikelas')
);

CREATE POLICY "Admins can delete formatif"
ON public.asesmen_formatif FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Parents can view their children's assessments
CREATE POLICY "Parents can view children formatif"
ON public.asesmen_formatif FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM parent_children pc 
    WHERE pc.parent_id = auth.uid() AND pc.child_id = asesmen_formatif.santri_id
  )
);

-- =============================================
-- ASESMEN_SUMATIF TABLE
-- =============================================
ALTER TABLE public.asesmen_sumatif ENABLE ROW LEVEL SECURITY;

-- Santri can view their own assessments
CREATE POLICY "Santri can view own sumatif"
ON public.asesmen_sumatif FOR SELECT TO authenticated
USING (auth.uid() = santri_id);

-- Staff can view and manage all assessments
CREATE POLICY "Staff can view all sumatif"
ON public.asesmen_sumatif FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'guru') OR 
  public.has_role(auth.uid(), 'walikelas')
);

CREATE POLICY "Staff can insert sumatif"
ON public.asesmen_sumatif FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'guru') OR 
  public.has_role(auth.uid(), 'walikelas')
);

CREATE POLICY "Staff can update sumatif"
ON public.asesmen_sumatif FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'guru') OR 
  public.has_role(auth.uid(), 'walikelas')
);

CREATE POLICY "Admins can delete sumatif"
ON public.asesmen_sumatif FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Parents can view their children's assessments
CREATE POLICY "Parents can view children sumatif"
ON public.asesmen_sumatif FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM parent_children pc 
    WHERE pc.parent_id = auth.uid() AND pc.child_id = asesmen_sumatif.santri_id
  )
);

-- =============================================
-- RAPORT TABLE
-- =============================================
ALTER TABLE public.raport ENABLE ROW LEVEL SECURITY;

-- Santri can view their own raport
CREATE POLICY "Santri can view own raport"
ON public.raport FOR SELECT TO authenticated
USING (auth.uid() = santri_id);

-- Staff can view and manage all raports
CREATE POLICY "Staff can view all raport"
ON public.raport FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'guru') OR 
  public.has_role(auth.uid(), 'walikelas')
);

CREATE POLICY "Staff can insert raport"
ON public.raport FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'walikelas')
);

CREATE POLICY "Staff can update raport"
ON public.raport FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'walikelas')
);

CREATE POLICY "Admins can delete raport"
ON public.raport FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Parents can view their children's raport
CREATE POLICY "Parents can view children raport"
ON public.raport FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM parent_children pc 
    WHERE pc.parent_id = auth.uid() AND pc.child_id = raport.santri_id
  )
);

-- =============================================
-- TEACHER_MAPEL TABLE
-- =============================================
ALTER TABLE public.teacher_mapel ENABLE ROW LEVEL SECURITY;

-- All authenticated can view teacher_mapel
CREATE POLICY "Authenticated can view teacher_mapel"
ON public.teacher_mapel FOR SELECT TO authenticated
USING (true);

-- Admins can manage teacher_mapel
CREATE POLICY "Admins can insert teacher_mapel"
ON public.teacher_mapel FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update teacher_mapel"
ON public.teacher_mapel FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete teacher_mapel"
ON public.teacher_mapel FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- BANNERS TABLE
-- =============================================
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

-- All authenticated can view active banners
CREATE POLICY "Authenticated can view banners"
ON public.banners FOR SELECT TO authenticated
USING (true);

-- Admins can manage banners
CREATE POLICY "Admins can insert banners"
ON public.banners FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update banners"
ON public.banners FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete banners"
ON public.banners FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));