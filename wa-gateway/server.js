import express from 'express';
import { default as makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 5002;
const SESSION_DIR = process.env.SESSION_DIR || './session';

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

let sock = null;
let qrCodeDataUrl = null;
let connectionStatus = 'initializing'; // 'initializing', 'qr_ready', 'connected', 'disconnected'
let connectedPhone = null;

async function startWhatsAppBot() {
  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1015901307] }));

  sock = makeWASocket({
    version,
    logger: pino({ level: 'warn' }),
    printQRInTerminal: true,
    auth: state,
    browser: ['PT FRP HRM Sentinel', 'Chrome', '1.0.0'],
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 60000,
    keepAliveIntervalMs: 10000,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      connectionStatus = 'qr_ready';
      try {
        qrCodeDataUrl = await QRCode.toDataURL(qr, { scale: 8, margin: 2 });
        console.log('[WA-Gateway] New QR Code generated! Open /wa-qr to scan.');
      } catch (err) {
        console.error('[WA-Gateway] QR Code Generation Error:', err);
      }
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log(`[WA-Gateway] Connection closed (Status: ${statusCode}). Reconnect: ${shouldReconnect}`);
      connectionStatus = 'disconnected';
      connectedPhone = null;
      qrCodeDataUrl = null;

      if (statusCode === DisconnectReason.loggedOut) {
        console.warn('[WA-Gateway] Logged out from WhatsApp. Purging session folder...');
        try {
          fs.rmSync(SESSION_DIR, { recursive: true, force: true });
        } catch (_) {}
      }

      // Auto reconnect after short delay
      setTimeout(startWhatsAppBot, 3000);
    } else if (connection === 'open') {
      connectionStatus = 'connected';
      qrCodeDataUrl = null;
      connectedPhone = sock?.user?.id?.split(':')[0] || 'Unknown';
      console.log(`[WA-Gateway] WhatsApp CONNECTED! Phone: ${connectedPhone}`);
    }
  });
}

// ─── API ENDPOINTS ─────────────────────────────────────────────────────────────

// Status API
app.get('/status', (req, res) => {
  res.json({
    status: connectionStatus,
    phone: connectedPhone,
    hasQr: Boolean(qrCodeDataUrl),
    timestamp: new Date().toISOString(),
  });
});

// Send Message Handler
async function handleSendMessage(req, res) {
  const target = req.body.number || req.body.phone || req.body.target;
  const message = req.body.message || req.body.text;

  if (!target || !message) {
    return res.status(400).json({ success: false, error: 'Target number dan message wajib diisi' });
  }

  if (connectionStatus !== 'connected' || !sock) {
    return res.status(503).json({
      success: false,
      error: `WhatsApp Gateway belum terhubung (Status: ${connectionStatus}). Silakan scan QR di /wa-qr terlebih dahulu.`,
    });
  }

  try {
    let cleanPhone = String(target).replace(/\D/g, '');
    if (cleanPhone.startsWith('0')) cleanPhone = '62' + cleanPhone.slice(1);
    if (!cleanPhone.startsWith('62')) cleanPhone = '62' + cleanPhone;

    const jid = `${cleanPhone}@s.whatsapp.net`;
    const sent = await sock.sendMessage(jid, { text: String(message) });

    console.log(`[WA Sent] To: ${cleanPhone} | ID: ${sent?.key?.id}`);
    res.json({
      success: true,
      messageId: sent?.key?.id,
      target: cleanPhone,
    });
  } catch (err) {
    console.error('[WA Send Error]:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}

app.post('/send-message', handleSendMessage);
app.post('/api/send-message', handleSendMessage);
app.post('/v1/send-message', handleSendMessage);

// QR Page & Scanner Dashboard
function renderQrHtml() {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WhatsApp Gateway PT FRP - Tautkan Perangkat</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background: #0f172a; color: #f8fafc; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 1rem; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 24px; padding: 2rem; max-width: 440px; width: 100%; text-align: center; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-bottom: 1rem; }
    .badge-connected { background: #065f46; color: #34d399; border: 1px solid #059669; }
    .badge-scan { background: #78350f; color: #fbbf24; border: 1px solid #d97706; }
    .badge-wait { background: #1e3a8a; color: #60a5fa; border: 1px solid #2563eb; }
    h1 { font-size: 1.25rem; font-weight: 800; margin-bottom: 0.5rem; color: #ffffff; }
    p { font-size: 0.85rem; color: #94a3b8; line-height: 1.5; margin-bottom: 1.25rem; }
    .qr-container { background: #ffffff; padding: 1rem; border-radius: 16px; display: inline-block; margin: 1rem auto; box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
    .qr-container img { width: 240px; height: 240px; display: block; }
    .steps { text-align: left; background: #0f172a; border-radius: 14px; padding: 1rem; margin-top: 1.25rem; font-size: 0.78rem; color: #cbd5e1; }
    .steps ol { padding-left: 1.25rem; }
    .steps li { margin-bottom: 0.4rem; }
    .btn { display: inline-block; width: 100%; padding: 0.75rem; background: #059669; color: white; border: none; border-radius: 12px; font-weight: 700; font-size: 0.85rem; cursor: pointer; text-decoration: none; margin-top: 1rem; }
    .btn:hover { background: #047857; }
  </style>
  <script>
    setInterval(async () => {
      try {
        const res = await fetch('/status');
        const data = await res.json();
        if (data.status === 'connected') {
          document.getElementById('status-badge').className = 'badge badge-connected';
          document.getElementById('status-badge').innerText = 'TERHUBUNG: ' + data.phone;
          document.getElementById('content-area').innerHTML = '<div style="padding: 2rem 0;"><div style="font-size: 3rem;">✅</div><h2 style="font-size: 1.1rem; color: #34d399; margin-top: 0.5rem;">WhatsApp Gateway Aktif</h2><p style="font-size: 0.85rem; color: #94a3b8; margin-top: 0.5rem;">Nomor ' + data.phone + ' siap mengirim notifikasi otomatis ke Pimpinan & Superadmin.</p></div>';
        } else if (data.status === 'qr_ready') {
          // auto refresh image if still in qr mode
        }
      } catch (e) {}
    }, 4000);
  </script>
</head>
<body>
  <div class="card">
    <div id="status-badge" class="badge ${connectionStatus === 'connected' ? 'badge-connected' : (qrCodeDataUrl ? 'badge-scan' : 'badge-wait')}">
      ${connectionStatus === 'connected' ? `TERHUBUNG: ${connectedPhone}` : (qrCodeDataUrl ? 'SCAN QR CODE SEKARANG' : 'MEMPERSIAPKAN KONEKSI...')}
    </div>
    <h1>WhatsApp Gateway Mandiri</h1>
    <p>PT. FAWWAZ RESKI PERWIRA • Sistem Notifikasi Lapangan 100% Gratis</p>

    <div id="content-area">
      ${connectionStatus === 'connected' ? `
        <div style="padding: 2rem 0;">
          <div style="font-size: 3rem;">✅</div>
          <h2 style="font-size: 1.1rem; color: #34d399; margin-top: 0.5rem;">WhatsApp Gateway Aktif</h2>
          <p style="font-size: 0.85rem; color: #94a3b8; margin-top: 0.5rem;">Nomor <strong>${connectedPhone}</strong> telah terhubung dan siap mengirimkan radar peringatan 24 jam nonstop.</p>
        </div>
      ` : qrCodeDataUrl ? `
        <div class="qr-container">
          <img src="${qrCodeDataUrl}" alt="Scan QR Code WhatsApp" />
        </div>
        <div class="steps">
          <ol>
            <li>Buka WhatsApp di ponsel <strong>087812379189</strong>.</li>
            <li>Ketuk <strong>Menu (Titik 3)</strong> atau <strong>Setelan</strong>.</li>
            <li>Pilih <strong>Perangkat Tertaut (Linked Devices)</strong>.</li>
            <li>Ketuk <strong>Tautkan Perangkat</strong> dan scan QR di atas.</li>
          </ol>
        </div>
      ` : `
        <div style="padding: 3rem 0; color: #94a3b8;">
          <p>Sedang membuat QR Code baru... Harap tunggu beberapa detik.</p>
        </div>
      `}
    </div>

    <button onclick="window.location.reload()" class="btn">Segarkan Halaman (Refresh)</button>
  </div>
</body>
</html>`;
}

app.get('/qr', (req, res) => res.send(renderQrHtml()));
app.get('/wa-qr', (req, res) => res.send(renderQrHtml()));
app.get('/', (req, res) => res.send(renderQrHtml()));

// Start Bot
startWhatsAppBot().catch(err => console.error('[WA-Gateway Boot Error]:', err));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[WA-Gateway] Microservice running on http://0.0.0.0:${PORT}`);
});
