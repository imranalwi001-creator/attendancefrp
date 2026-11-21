WITH official_83 AS (
  SELECT p.id, p.full_name, p.nip,
    CASE 
      WHEN p.id IN ('ebf10b16-ab2f-4b53-ab22-b3ffc00694db', '2ce41a19-0c65-45d3-913e-a68a02203fe2', '0a49f92e-5733-4b72-947c-7361f9490632') THEN 'KARYAWAN TETAP'
      WHEN substring(regexp_replace(p.nip, '[^0-9]', '', 'g') from 1 for 5)::int BETWEEN 7001 AND 7033 THEN 'RUMAH TANGGA'
      WHEN substring(regexp_replace(p.nip, '[^0-9]', '', 'g') from 1 for 5)::int BETWEEN 7034 AND 7080 THEN 'SHIPMENT'
      ELSE 'OTHER'
    END as grp
  FROM hrm_profiles p
  WHERE p.is_active = true
    AND (
      p.id IN ('ebf10b16-ab2f-4b53-ab22-b3ffc00694db', '2ce41a19-0c65-45d3-913e-a68a02203fe2', '0a49f92e-5733-4b72-947c-7361f9490632')
      OR substring(regexp_replace(p.nip, '[^0-9]', '', 'g') from 1 for 5)::int BETWEEN 7001 AND 7080
    )
),
target_schedule AS (
  SELECT o.id, o.full_name, o.nip, o.grp,
    COALESCE(es.shift_code, 'DAY') as raw_shift_code,
    COALESCE(es.is_off, false) as is_off,
    CASE 
      WHEN COALESCE(es.is_off, false) = true OR COALESCE(es.shift_code, '') = 'OFF' THEN 'OFF'
      WHEN es.shift_code IN ('DAY', 'D') OR es.shift_name ILIKE '%day%' THEN 'DAYSHIFT'
      WHEN es.shift_code IN ('P', '1') OR es.shift_name ILIKE '%shift I%' OR es.shift_name ILIKE '%shift 1%' THEN 'SHIFT I'
      WHEN es.shift_code IN ('S', '2') OR es.shift_name ILIKE '%shift II%' OR es.shift_name ILIKE '%shift 2%' THEN 'SHIFT II'
      WHEN es.shift_code IN ('M', '3') OR es.shift_name ILIKE '%shift III%' OR es.shift_name ILIKE '%shift 3%' THEN 'SHIFT III'
      ELSE 'DAYSHIFT'
    END as shift_group
  FROM official_83 o
  LEFT JOIN hrm_employee_schedules es ON es.user_id = o.id AND es.schedule_date = '2026-11-20'
),
att_data AS (
  SELECT a.user_id,
    bool_or(a.clock_in IS NOT NULL OR a.status IN ('present', 'late', 'hadir', 'telat')) as has_presence,
    bool_or(a.status = 'late' OR (a.late_minutes IS NOT NULL AND a.late_minutes > 0)) as is_late,
    bool_or(a.status ILIKE '%lembur%' OR a.is_emergency_overtime = true OR (a.emergency_overtime_hours IS NOT NULL AND a.emergency_overtime_hours > 0)) as has_att_overtime
  FROM hrm_attendances a
  WHERE a.attendance_date = '2026-11-20'
  GROUP BY a.user_id
),
ot_data AS (
  SELECT ov.user_id, true as has_spl_overtime
  FROM hrm_overtime_records ov
  WHERE ov.date = '2026-11-20' AND ov.status IN ('approved', 'completed', 'in_progress')
  GROUP BY ov.user_id
),
leave_data AS (
  SELECT l.user_id,
    CASE 
      WHEN l.leave_type IN ('sick', 'sakit') THEN 'SAKIT'
      WHEN l.leave_type IN ('permit', 'izin') THEN 'IZIN'
      ELSE 'CUTI'
    END as leave_category
  FROM hrm_leave_requests l
  WHERE '2026-11-20' BETWEEN l.start_date AND l.end_date AND l.status = 'approved'
),
emp_status AS (
  SELECT 
    ts.id,
    ts.full_name,
    ts.nip,
    ts.grp,
    ts.shift_group,
    CASE 
      WHEN ld.leave_category = 'CUTI' THEN 'CUTI'
      WHEN ld.leave_category IN ('IZIN', 'SAKIT') THEN 'IZIN'
      WHEN COALESCE(att.has_presence, false) = true THEN 'HADIR'
      WHEN ts.shift_group = 'OFF' THEN 'OFF'
      ELSE 'MANGKIR'
    END as final_status,
    (COALESCE(att.has_att_overtime, false) = true OR COALESCE(ot.has_spl_overtime, false) = true) as is_lembur
  FROM target_schedule ts
  LEFT JOIN att_data att ON att.user_id = ts.id
  LEFT JOIN ot_data ot ON ot.user_id = ts.id
  LEFT JOIN leave_data ld ON ld.user_id = ts.id
)
SELECT 
  shift_group,
  count(*) as total_scheduled,
  count(*) FILTER (WHERE final_status = 'OFF') as off_count,
  count(*) FILTER (WHERE final_status = 'HADIR') as hadir_count,
  count(*) FILTER (WHERE final_status = 'MANGKIR') as mangkir_count,
  count(*) FILTER (WHERE final_status = 'CUTI') as cuti_count,
  count(*) FILTER (WHERE final_status = 'IZIN') as izin_count,
  count(*) FILTER (WHERE is_lembur = true) as lembur_count
FROM emp_status
GROUP BY shift_group
ORDER BY 
  CASE shift_group
    WHEN 'DAYSHIFT' THEN 1
    WHEN 'SHIFT I' THEN 2
    WHEN 'SHIFT II' THEN 3
    WHEN 'SHIFT III' THEN 4
    WHEN 'OFF' THEN 5
    ELSE 6
  END;
