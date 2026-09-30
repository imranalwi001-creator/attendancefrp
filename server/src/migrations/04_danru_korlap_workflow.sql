-- 1. Ensure substitute_id is nullable
ALTER TABLE hrm_shift_swaps ALTER COLUMN substitute_id DROP NOT NULL;

-- 2. Add workflow columns to hrm_shift_swaps if not exist
ALTER TABLE hrm_shift_swaps ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'pending_danru';
ALTER TABLE hrm_shift_swaps ADD COLUMN IF NOT EXISTS danru_id UUID REFERENCES hrm_profiles(id) ON DELETE SET NULL;
ALTER TABLE hrm_shift_swaps ADD COLUMN IF NOT EXISTS danru_substitute_id UUID REFERENCES hrm_profiles(id) ON DELETE SET NULL;
ALTER TABLE hrm_shift_swaps ADD COLUMN IF NOT EXISTS danru_notes TEXT;
ALTER TABLE hrm_shift_swaps ADD COLUMN IF NOT EXISTS danru_status VARCHAR(30) DEFAULT 'pending';
ALTER TABLE hrm_shift_swaps ADD COLUMN IF NOT EXISTS danru_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE hrm_shift_swaps ADD COLUMN IF NOT EXISTS korlap_id UUID REFERENCES hrm_profiles(id) ON DELETE SET NULL;
ALTER TABLE hrm_shift_swaps ADD COLUMN IF NOT EXISTS korlap_status VARCHAR(30) DEFAULT 'pending';
ALTER TABLE hrm_shift_swaps ADD COLUMN IF NOT EXISTS korlap_notes TEXT;
ALTER TABLE hrm_shift_swaps ADD COLUMN IF NOT EXISTS korlap_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE hrm_shift_swaps ADD COLUMN IF NOT EXISTS system_recommendations JSONB DEFAULT '[]'::jsonb;

-- 3. Add Roles: kepala_regu and korlap if not exist
INSERT INTO hrm_roles (id, name, label, description)
SELECT uuid_generate_v4(), 'kepala_regu', 'Kepala Regu (Danru)', 'Supervisi regu lapangan & memberikan telaah rekomendasi dinas pengganti'
WHERE NOT EXISTS (SELECT 1 FROM hrm_roles WHERE name = 'kepala_regu');

INSERT INTO hrm_roles (id, name, label, description)
SELECT uuid_generate_v4(), 'korlap', 'Koordinator Lapangan (Korlap)', 'Penentu akhir & pemegang otoritas persetujuan serta penugasan karyawan pengganti'
WHERE NOT EXISTS (SELECT 1 FROM hrm_roles WHERE name = 'korlap');
