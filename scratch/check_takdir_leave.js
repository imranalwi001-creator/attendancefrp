import { spawn } from 'child_process';

const sql = `
SELECT l.id, p.full_name, p.nip, p.phone as applicant_phone, p.annual_leave_quota, p.used_leave_days,
       l.leave_type, l.start_date, l.end_date, l.total_days, l.reason, l.status,
       l.executive_approval_token, l.created_at
FROM hrm_leave_requests l
JOIN hrm_profiles p ON l.user_id = p.id
WHERE LOWER(p.full_name) LIKE '%takdir%' OR p.nip = 'FRP.07.046'
ORDER BY l.created_at DESC
LIMIT 5;
`;

const ssh = spawn('ssh', [
  '-i', 'C:\\Users\\IMRAN ALWI\\Downloads\\frp-key.pem',
  '-o', 'StrictHostKeyChecking=no',
  'ubuntu@103.197.188.211',
  'docker exec -i hrm-database psql -U hrm_user -d hrm_db'
]);

ssh.stdin.write(sql);
ssh.stdin.end();

ssh.stdout.on('data', (d) => process.stdout.write(d));
ssh.stderr.on('data', (d) => process.stderr.write(d));
ssh.on('close', (c) => process.exit(c));

