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
)
SELECT grp, count(*) FROM official_83 GROUP BY grp ORDER BY grp;
