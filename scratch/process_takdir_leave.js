import crypto from 'crypto';
import { spawn } from 'child_process';

const execToken = crypto.randomBytes(16).toString('hex');
const leaveId = '6171fd9f-00c4-49b8-9cfd-f0ec30eff339';
const duplicateId = '1a604894-a42d-4903-8fa2-0d9b82e03346';

// 1. Update database: hapus duplikat dan pasang executive token di leave utama
const sql = `
DELETE FROM hrm_leave_requests WHERE id = '${duplicateId}';
UPDATE hrm_leave_requests 
SET executive_approval_token = '${execToken}',
    substitute_id = NULL,
    substitute_name = NULL,
    substitute_nip = NULL,
    status = 'pending',
    updated_at = NOW()
WHERE id = '${leaveId}'
RETURNING *;
`;

const ssh = spawn('ssh', [
  '-i', 'C:\\Users\\IMRAN ALWI\\Downloads\\frp-key.pem',
  '-o', 'StrictHostKeyChecking=no',
  'ubuntu@103.197.188.211',
  'docker exec -i hrm-database psql -U hrm_user -d hrm_db'
]);

ssh.stdin.write(sql);
ssh.stdin.end();

let out = '';
ssh.stdout.on('data', (d) => { out += d; process.stdout.write(d); });
ssh.stderr.on('data', (d) => process.stderr.write(d));
ssh.on('close', async (c) => {
  if (c !== 0) {
    console.error('Failed to update DB');
    process.exit(1);
  }
  console.log('\n[Database Updated] Token generated:', execToken);

  // 2. Kirim Pesan Resmi via WhatsApp Gateway ke Dirut, Pimpinan, Superadmin & Takdir
  const approveUrl = `https://fawwazreskiperwira.com/executive-approval?token=${execToken}&decision=approved`;
  const rejectUrl = `https://fawwazreskiperwira.com/executive-approval?token=${execToken}&decision=rejected`;

  const executiveMsg =
`👑 *PERMOHONAN KHUSUS DIREKSI (PT. FAWWAZ RESKI PERWIRA)*
*Pusat Otoritas & Komando Direksi*

Yth. *Bapak Direktur Utama / Bapak Pimpinan*,
Salah satu Petugas Lapangan Khusus mengajukan permohonan dinas resmi:

👤 *Nama Pemohon:* *TAKDIR*
🆔 *NIP:* FRP.07.046
🏢 *Jabatan:* Petugas Lapangan Khusus Pimpinan *(Bebas Pengganti)*
📝 *Jenis Permohonan:* CUTI TAHUNAN
📅 *Jadwal Pelaksanaan:* 05 Nov 2026 s/d 06 Nov 2026 (2 Hari)
💬 *Alasan/Keterangan:* "Cuti Mendadak karena urusan keluarga"

📊 *REKAPITULASI KUOTA CUTI PEMOHON:*
• Cuti yang Telah Dipakai: *1 Hari*
• Cuti yang Akan Dipakai: *2 Hari*
• Sisa Cuti Saat Ini: *11 Hari* (dari Hak Kuota 12 Hari)
• *Estimasi Sisa Pasca Disetujui:* *9 Hari*

*(Catatan Kebijakan: Hak cuti tahunan PT FRP bersifat Use-It-Or-Lose-It / tidak dapat diuangkan & tidak membebani kas perusahaan).*

Sesuai ketentuan, permohonan Petugas Khusus disahkan langsung oleh salah satu Direksi (First-Responder Rule). Mohon berikan keputusan Bapak melalui salah satu tautan 1-klik di bawah ini:

✅ *SETUJUI PERMOHONAN (1-KLIK):*
${approveUrl}

❌ *TOLAK PERMOHONAN (1-KLIK):*
${rejectUrl}

*Keputusan Bapak langsung disinkronkan ke PostgreSQL, kartu presensi, dan aplikasi Pusat Otoritas Lapangan PT FRP.*`;

  const applicantReceiptMsg =
`👑 *TANDA TERIMA PENGAJUAN PETUGAS KHUSUS (PT FRP)*

Halo *TAKDIR* (FRP.07.046),
Pengajuan *CUTI TAHUNAN* Anda (05 Nov 2026 s/d 06 Nov 2026, 2 Hari) telah diteruskan langsung ke *Direktur Utama (Bpk Alam AS)* dan *Pimpinan (Bpk Reski Faisal)* untuk persetujuan eksekutif.

🏢 Jabatan: *Petugas Lapangan Khusus Pimpinan (Bebas Pengganti)*
💬 Alasan: "Cuti Mendadak karena urusan keluarga"
📊 Saldo Cuti Saat Ini: *11 Hari* (Estimasi pasca disetujui: *9 Hari*)

Pemberitahuan instan akan otomatis dikirimkan ke nomor ini begitu salah satu Direksi memberikan keputusan.`;

  // Helper kirim via container backend di VPS menggunakan curl
  const sendWaCmd = `
docker exec hrm-backend node -e '
const { sendWhatsAppAlert } = await import("/app/src/index.js").catch(() => ({}));
// Gunakan fungsi gateway internal backend
const phones = ["082291998026", "082192755755", "081355904897"];
const msg = ${JSON.stringify(executiveMsg)};
const appMsg = ${JSON.stringify(applicantReceiptMsg)};

for (const p of phones) {
  await fetch("http://localhost:5000/api/hrm/whatsapp-send-direct", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: p, message: msg })
  }).catch(() => {});
}

await fetch("http://localhost:5000/api/hrm/whatsapp-send-direct", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ phone: "085242606150", message: appMsg })
}).catch(() => {});
'
`;

  // Jalankan curl kirim WA di VPS
  const sshWa = spawn('ssh', [
    '-i', 'C:\\Users\\IMRAN ALWI\\Downloads\\frp-key.pem',
    '-o', 'StrictHostKeyChecking=no',
    'ubuntu@103.197.188.211',
    sendWaCmd
  ]);

  sshWa.stdout.on('data', (d) => process.stdout.write(d));
  sshWa.stderr.on('data', (d) => process.stderr.write(d));
  sshWa.on('close', () => {
    console.log('\n[WhatsApp Dispatched] All messages queued & sent.');
    process.exit(0);
  });
});

