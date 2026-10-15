-- ─── MIGRATION 08: INVENTORY TECH MOBILE BANK POS & WFA SAH HUBS ───
-- Untuk Rusdi Aryanto, M. Reza Angga Dwi S, dan Ichtiar

DO $$
DECLARE
  v_user_ids UUID[] := ARRAY[
    'f0aaf721-203c-4b45-b610-213204bc7ffe'::UUID, -- Rusdi Aryanto
    'd1e4eaf3-fa45-474b-b7a2-32e4114d8f2b'::UUID, -- M. Reza Angga Dwi S
    '2939502e-e63c-4c63-aafb-a69abccba828'::UUID  -- Ichtiar
  ];
  v_uid UUID;
BEGIN
  FOREACH v_uid IN ARRAY v_user_ids
  LOOP
    -- 1. Matching Bontoa
    IF NOT EXISTS (SELECT 1 FROM hrm_field_assigned_posts WHERE user_id = v_uid AND post_code = 'MATCH-BONTOA') THEN
      INSERT INTO hrm_field_assigned_posts (user_id, post_code, post_name, latitude, longitude, radius_meters, description, is_active)
      VALUES (v_uid, 'MATCH-BONTOA', 'Matching Bontoa', -4.802450, 119.598640, 250, 'Pos Operasional Inventory Matching Bontoa', true);
    END IF;

    -- 2. Kantor Pusat Semen Tonasa
    IF NOT EXISTS (SELECT 1 FROM hrm_field_assigned_posts WHERE user_id = v_uid AND post_code = 'KP-TONASA') THEN
      INSERT INTO hrm_field_assigned_posts (user_id, post_code, post_name, latitude, longitude, radius_meters, description, is_active)
      VALUES (v_uid, 'KP-TONASA', 'Kantor Pusat Semen Tonasa', -4.800089, 119.608477, 250, 'Pusat Administrasi & Data Inventory', true);
    END IF;

    -- 3. Kantor FRP (Pusat FRP)
    IF NOT EXISTS (SELECT 1 FROM hrm_field_assigned_posts WHERE user_id = v_uid AND post_code = 'KANTOR FRP') THEN
      INSERT INTO hrm_field_assigned_posts (user_id, post_code, post_name, latitude, longitude, radius_meters, description, is_active)
      VALUES (v_uid, 'KANTOR FRP', 'Kantor FRP', -4.794135, 119.604382, 250, 'Kantor Operasional PT FRP', true);
    END IF;

    -- 4. Matching Maccini Baji
    IF NOT EXISTS (SELECT 1 FROM hrm_field_assigned_posts WHERE user_id = v_uid AND post_code = 'MATCH-MCBAJI') THEN
      INSERT INTO hrm_field_assigned_posts (user_id, post_code, post_name, latitude, longitude, radius_meters, description, is_active)
      VALUES (v_uid, 'MATCH-MCBAJI', 'Matching Maccini Baji', -4.809100, 119.548800, 250, 'Pos Distribusi & Inventory Maccini Baji', true);
    END IF;

    -- 5. Matching Paotere Makassar
    IF NOT EXISTS (SELECT 1 FROM hrm_field_assigned_posts WHERE user_id = v_uid AND post_code = 'MATCH-PAOTERE') THEN
      INSERT INTO hrm_field_assigned_posts (user_id, post_code, post_name, latitude, longitude, radius_meters, description, is_active)
      VALUES (v_uid, 'MATCH-PAOTERE', 'Matching Paotere', -5.118900, 119.419000, 250, 'Pelabuhan Paotere Makassar', true);
    END IF;

    -- 6. Matching Packing Plant Makassar
    IF NOT EXISTS (SELECT 1 FROM hrm_field_assigned_posts WHERE user_id = v_uid AND post_code = 'MATCH-PP-MKS') THEN
      INSERT INTO hrm_field_assigned_posts (user_id, post_code, post_name, latitude, longitude, radius_meters, description, is_active)
      VALUES (v_uid, 'MATCH-PP-MKS', 'Matching PP Makassar', -5.122800, 119.412500, 250, 'Packing Plant Semen Makassar', true);
    END IF;

    -- 7. Hub Jaringan & Stabilisasi Sinyal Cafe/Warkop (WFA Sah)
    IF NOT EXISTS (SELECT 1 FROM hrm_field_assigned_posts WHERE user_id = v_uid AND post_code = 'HUB-WFA') THEN
      INSERT INTO hrm_field_assigned_posts (user_id, post_code, post_name, latitude, longitude, radius_meters, description, is_active)
      VALUES (v_uid, 'HUB-WFA', 'Hub Sinyal & Mobile Inventory (Cafe/Warkop)', -4.798000, 119.602000, 50000, 'Akses Bebas Area Resmi (Full Remote/WFA Sah) untuk stabilisasi koneksi internet & input data', true);
    END IF;

  END LOOP;
END $$;
