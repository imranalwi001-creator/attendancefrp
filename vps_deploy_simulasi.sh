#!/bin/bash
set -e
echo '=== 1. Deploying Frontend to hrm-frontend ==='
docker exec hrm-frontend rm -rf /usr/share/nginx/html/*
mkdir -p /tmp/dist_simulasi_unpacked
tar -xzf /home/ubuntu/dist_simulasi.tar.gz -C /tmp/dist_simulasi_unpacked/
docker cp /tmp/dist_simulasi_unpacked/. hrm-frontend:/usr/share/nginx/html/
rm -rf /tmp/dist_simulasi_unpacked
docker exec hrm-frontend nginx -s reload

echo '=== 2. Applying Database Migrations to hrm-database ==='
docker exec hrm-database psql -U hrm_user -d hrm_db -c "ALTER TABLE hrm_attendances ADD COLUMN IF NOT EXISTS is_simulation BOOLEAN DEFAULT false;"

docker exec hrm-database psql -U hrm_user -d hrm_db -c "INSERT INTO hrm_shifts (name, start_time, end_time, break_start_time, break_end_time, break_duration_minutes, late_tolerance_minutes, is_default) VALUES ('Shift Simulasi & Bebas Jadwal (24 Jam)', '00:00:00', '23:59:59', '12:00:00', '13:00:00', 60, 1440, false) ON CONFLICT (name) DO UPDATE SET start_time = '00:00:00', end_time = '23:59:59', late_tolerance_minutes = 1440;"

docker exec hrm-database psql -U hrm_user -d hrm_db -c "INSERT INTO hrm_divisions (code, name, description, location_name, address, latitude, longitude, radius_meters) VALUES ('DIV-SIM', 'Divisi Uji Coba & Simulasi Sosialisasi', 'Divisi khusus sesi presentasi dan simulasi presensi wajah & lokasi karyawan tanpa batasan jadwal', 'Venue Acara / Ruang Sosialisasi', 'Lokasi Acara Presentasi PT FRP', -4.78236486, 119.57192181, 300) ON CONFLICT (code) DO NOTHING;"

echo '=== 3. Updating Backend Code and Restarting Container ==='
docker cp /home/ubuntu/index.js hrm-backend:/app/src/index.js
docker cp /home/ubuntu/db.js hrm-backend:/app/src/db.js
docker restart hrm-backend
sleep 3

echo '=== 4. Health Check & Simulation Endpoint Status ==='
curl -s http://localhost:5000/api/simulation/status
echo ''
echo '=== SUCCESSFUL DEPLOYMENT ==='
