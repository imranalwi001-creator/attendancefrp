const pimpinan = '082192755755';
const superadmin = '081355904897';
const time = new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WITA';

const msgPimpinan = `📢 *UJI COBA SISTEM RADAR LAPANGAN PT. FAWWAZ RESKI PERWIRA*

Kepada Yth. *Pimpinan (Bpk Reski Faisal)*,

✅ Sistem WhatsApp Gateway Mandiri telah *AKTIF & TERHUBUNG* dari nomor resmi sistem *087812379189*.

📡 *Status Radar Pengawasan 3 Petugas Lapangan:*
1. Muh Aslam Faisal (NIP: FRP 07065)
2. LA UNGA SAMSI, S.K.M (NIP: FR.07.066)
3. TAKDIR (NIP: FRP.07.046)

⏰ Waktu Pengujian: ${time}

Notifikasi kedatangan pos, perpindahan titik tugas, izin darurat, dan alarm perimeter breach akan otomatis masuk ke nomor ini secara real-time.`;

const msgSuperadmin = `📢 *UJI COBA SISTEM RADAR LAPANGAN PT. FAWWAZ RESKI PERWIRA*

Kepada Yth. *Superadmin HRM*,

✅ Sistem WhatsApp Gateway Mandiri telah *AKTIF & TERHUBUNG* dari nomor resmi sistem *087812379189*.

⏰ Waktu Pengujian: ${time}

Sistem siap memantau pergerakan 3 petugas lapangan dan seluruh presensi biometrik karyawan.`;

async function main() {
  console.log('Sending to Pimpinan Bpk Reski Faisal (082192755755)...');
  const res1 = await fetch('http://127.0.0.1:5002/send-message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ number: pimpinan, message: msgPimpinan })
  });
  console.log('PIMPINAN RESULT:', await res1.text());

  console.log('Sending to Superadmin (081355904897)...');
  const res2 = await fetch('http://127.0.0.1:5002/send-message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ number: superadmin, message: msgSuperadmin })
  });
  console.log('SUPERADMIN RESULT:', await res2.text());
}

main().catch(console.error);
