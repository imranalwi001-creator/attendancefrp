const { execSync } = require('child_process');

const sql = `SELECT a.id, a.attendance_date, a.clock_in, a.clock_out, a.status, p.full_name, r.name as role FROM hrm_attendances a JOIN hrm_profiles p ON a.user_id = p.id LEFT JOIN hrm_roles r ON p.role_id = r.id WHERE a.attendance_date = '2026-10-29';`;

const sshCmd = `ssh -i "C:\\Users\\IMRAN ALWI\\Downloads\\frp-key.pem" -o StrictHostKeyChecking=no ubuntu@103.197.188.211 "docker exec hrm-database psql -U hrm_user -d hrm_db -c \\"${sql}\\""`;

try {
  const out = execSync(sshCmd, { encoding: 'utf8' });
  console.log(out);
} catch (e) {
  console.error(e.message, e.stdout, e.stderr);
}
