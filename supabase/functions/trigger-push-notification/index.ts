import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}


// Format nominal to IDR string (e.g. "Rp 1.500.000")
function formatNominal(jumlah: number | null | undefined): string {
  if (!jumlah) return 'Rp 0';
  return 'Rp ' + jumlah.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// Format date to Indonesian format (e.g. "15 Juni 2026")
function formatTanggal(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const months = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const d = new Date(dateStr);
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

// Base64 URL encode helper
function base64UrlEncode(data: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Base64 URL decode helper
function base64UrlDecode(str: string): Uint8Array {
  const padding = '='.repeat((4 - str.length % 4) % 4);
  const base64 = (str + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return new Uint8Array([...raw].map(c => c.charCodeAt(0)));
}

// Generate random bytes
function generateRandomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

// Helper to convert Uint8Array to ArrayBuffer safely
function toArrayBuffer(arr: Uint8Array): ArrayBuffer {
  return arr.buffer.slice(arr.byteOffset, arr.byteOffset + arr.byteLength) as ArrayBuffer;
}

// Simple HKDF implementation
async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const saltBuf = salt.length > 0 ? toArrayBuffer(salt) : new ArrayBuffer(32);
  const key = await crypto.subtle.importKey('raw', saltBuf, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const prk = new Uint8Array(await crypto.subtle.sign('HMAC', key, toArrayBuffer(ikm)));
  const expandKey = await crypto.subtle.importKey('raw', toArrayBuffer(prk), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const infoWithCounter = new Uint8Array(info.length + 1);
  infoWithCounter.set(info);
  infoWithCounter[info.length] = 1;
  const okm = new Uint8Array(await crypto.subtle.sign('HMAC', expandKey, toArrayBuffer(infoWithCounter)));
  return okm.slice(0, length);
}

// Encrypt payload using aes128gcm
async function encryptPayload(payload: string, clientPublicKeyBase64: string, authSecretBase64: string): Promise<{ ciphertext: Uint8Array; salt: Uint8Array; serverPublicKey: Uint8Array }> {
  const clientPublicKeyBytes = base64UrlDecode(clientPublicKeyBase64);
  const authSecret = base64UrlDecode(authSecretBase64);
  const serverKeyPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const serverPublicKeyRaw = await crypto.subtle.exportKey('raw', serverKeyPair.publicKey);
  const serverPublicKey = new Uint8Array(serverPublicKeyRaw);
  const clientPublicKey = await crypto.subtle.importKey('raw', toArrayBuffer(clientPublicKeyBytes), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const sharedSecretBits = await crypto.subtle.deriveBits({ name: 'ECDH', public: clientPublicKey }, serverKeyPair.privateKey, 256);
  const sharedSecret = new Uint8Array(sharedSecretBits);
  const salt = generateRandomBytes(16);
  const ikmInfo = new TextEncoder().encode('WebPush: info\0');
  const ikmInfoFull = new Uint8Array(ikmInfo.length + clientPublicKeyBytes.length + serverPublicKey.length);
  ikmInfoFull.set(ikmInfo);
  ikmInfoFull.set(clientPublicKeyBytes, ikmInfo.length);
  ikmInfoFull.set(serverPublicKey, ikmInfo.length + clientPublicKeyBytes.length);
  const ikm = await hkdf(authSecret, sharedSecret, ikmInfoFull, 32);
  const cekInfo = new TextEncoder().encode('Content-Encoding: aes128gcm\0');
  const cek = await hkdf(salt, ikm, cekInfo, 16);
  const nonceInfo = new TextEncoder().encode('Content-Encoding: nonce\0');
  const nonce = await hkdf(salt, ikm, nonceInfo, 12);
  const payloadBytes = new TextEncoder().encode(payload);
  const paddedPayload = new Uint8Array(payloadBytes.length + 1);
  paddedPayload.set(payloadBytes);
  paddedPayload[payloadBytes.length] = 2;
  const key = await crypto.subtle.importKey('raw', toArrayBuffer(cek), { name: 'AES-GCM' }, false, ['encrypt']);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: toArrayBuffer(nonce) }, key, toArrayBuffer(paddedPayload));
  return { ciphertext: new Uint8Array(encrypted), salt, serverPublicKey };
}

// Build aes128gcm body
function buildAes128gcmBody(ciphertext: Uint8Array, salt: Uint8Array, serverPublicKey: Uint8Array, recordSize: number = 4096): Uint8Array {
  const headerLength = 16 + 4 + 1 + serverPublicKey.length;
  const body = new Uint8Array(headerLength + ciphertext.length);
  let offset = 0;
  body.set(salt, offset); offset += 16;
  body[offset++] = (recordSize >> 24) & 0xff;
  body[offset++] = (recordSize >> 16) & 0xff;
  body[offset++] = (recordSize >> 8) & 0xff;
  body[offset++] = recordSize & 0xff;
  body[offset++] = serverPublicKey.length;
  body.set(serverPublicKey, offset); offset += serverPublicKey.length;
  body.set(ciphertext, offset);
  return body;
}

// Create VAPID JWT
async function createVapidJwt(audience: string, subject: string, publicKey: string, privateKey: string): Promise<string> {
  const header = { typ: 'JWT', alg: 'ES256' };
  const now = Math.floor(Date.now() / 1000);
  const payload = { aud: audience, exp: now + 12 * 60 * 60, sub: subject };
  const headerB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;
  const privateKeyBytes = base64UrlDecode(privateKey);
  const publicKeyBytes = base64UrlDecode(publicKey);
  const x = base64UrlEncode(publicKeyBytes.slice(1, 33));
  const y = base64UrlEncode(publicKeyBytes.slice(33, 65));
  const d = base64UrlEncode(privateKeyBytes);
  const keyData = { kty: 'EC', crv: 'P-256', x, y, d };
  const key = await crypto.subtle.importKey('jwk', keyData, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(unsignedToken));
  return `${unsignedToken}.${base64UrlEncode(new Uint8Array(signature))}`;
}

// Send push notification
async function sendWebPush(subscription: { endpoint: string; p256dh: string; auth: string }, payload: object, vapidPublicKey: string, vapidPrivateKey: string, vapidSubject: string): Promise<Response> {
  const url = new URL(subscription.endpoint);
  const audience = `${url.protocol}//${url.host}`;
  console.log(`Sending push to ${subscription.endpoint}`);
  const vapidToken = await createVapidJwt(audience, vapidSubject, vapidPublicKey, vapidPrivateKey);
  const { ciphertext, salt, serverPublicKey } = await encryptPayload(JSON.stringify(payload), subscription.p256dh, subscription.auth);
  const body = buildAes128gcmBody(ciphertext, salt, serverPublicKey);
  return await fetch(subscription.endpoint, {
    method: 'POST',
    headers: { 'TTL': '86400', 'Content-Type': 'application/octet-stream', 'Content-Encoding': 'aes128gcm', 'Authorization': `vapid t=${vapidToken}, k=${vapidPublicKey}` },
    body: toArrayBuffer(body),
  });
}

// Send push to user and clean up invalid subscriptions
async function sendPushToUser(
  supabase: any,
  userId: string,
  title: string,
  message: string,
  url: string,
  tag: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string
): Promise<{ sent: number; total: number }> {
  const { data: subscriptions, error: subError } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', userId);

  if (subError || !subscriptions || subscriptions.length === 0) {
    console.log(`No push subscriptions found for user: ${userId}`);
    return { sent: 0, total: 0 };
  }

  const subs = subscriptions as Array<{ endpoint: string; p256dh: string; auth: string }>;
  console.log(`Found ${subs.length} subscription(s) for user ${userId}`);

  const payload = { title, message, url, tag };
  const failedEndpoints: string[] = [];
  let successCount = 0;

  for (const sub of subs) {
    try {
      const response = await sendWebPush(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        payload,
        vapidPublicKey,
        vapidPrivateKey,
        vapidSubject
      );

      if (response.ok || response.status === 201) {
        console.log(`Push sent successfully to ${sub.endpoint}`);
        successCount++;
      } else {
        const errorText = await response.text();
        console.error(`Push failed for ${sub.endpoint}:`, response.status, errorText);
        if (response.status === 410 || response.status === 404) {
          failedEndpoints.push(sub.endpoint);
        }
      }
    } catch (error) {
      console.error(`Error sending push to ${sub.endpoint}:`, error);
    }
  }

  // Clean up invalid subscriptions
  if (failedEndpoints.length > 0) {
    console.log('Cleaning up invalid subscriptions:', failedEndpoints);
    await supabase.from('push_subscriptions').delete().eq('user_id', userId).in('endpoint', failedEndpoints);
  }

  return { sent: successCount, total: subs.length };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { type, record } = await req.json();
    console.log('Received trigger-push-notification request:', { type, record });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!;
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!;
    const vapidSubject = Deno.env.get('VAPID_SUBJECT')!;

    if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
      console.log('VAPID keys not configured, skipping push notification');
      return new Response(JSON.stringify({ success: false, error: 'VAPID keys not configured' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const santriId: string = record.santri_id;
    const santriName: string = record.santri_name || 'Santri';
    let title: string;
    let message: string;
    let url = '/app/dashboard';

    // Handle different trigger types
    switch (type) {
      case 'konseling_record': {
        if (record.tipe === 'pelanggaran') {
          title = 'Catatan Pelanggaran Baru';
          message = `Catatan pelanggaran baru telah ditambahkan: ${record.kategori}`;
        } else {
          title = 'Catatan Prestasi Baru';
          message = `Catatan prestasi baru telah ditambahkan: ${record.kategori}`;
        }
        url = '/app/konseling';
        break;
      }
      case 'setoran_hafalan': {
        const kategoriMap: Record<string, string> = {
          'ziyadah': 'Ziyadah',
          'murojaah': 'Murojaah',
          'tahsin': 'Tahsin'
        };
        const kategoriLabel = kategoriMap[record.kategori as string] || record.kategori;
        title = 'Data Hafalan Baru';
        message = `Data ${kategoriLabel} telah ditambahkan: ${record.judul}`;
        url = '/app/tahfidz';
        break;
      }
      case 'tahfidz_tahsin': {
        const tipeMap: Record<string, string> = {
          'ziyadah': 'Ziyadah',
          'murojaah': 'Murojaah',
          'tahsin': 'Tahsin'
        };
        const tipeLabel = tipeMap[record.tipe as string] || record.tipe;
        title = `Data ${tipeLabel} Baru`;
        message = `Data ${tipeLabel} telah ditambahkan`;
        if (record.surah) {
          message += `: ${record.surah}`;
        } else if (record.materi_tahsin) {
          message += `: ${record.materi_tahsin}`;
        }
        url = '/app/tahfidz';
        break;
      }
      case 'new_tugas': {
        // Handle new tugas notification
        title = `Tugas Baru: ${record.judul}`;
        message = `Tugas baru dari mapel ${record.mapel_nama} telah ditambahkan`;
        url = '/app/dashboard';
        
        // For new_tugas, we need to send to ALL santri in the class
        const kelasId = record.kelas_id;
        console.log(`Processing new_tugas notification for kelas: ${kelasId}`);
        
        // Get all santri in this class
        const { data: santriList, error: santriError } = await supabase
          .from('santri')
          .select('id, profiles!inner(name, status)')
          .eq('kelas_id', kelasId)
          .eq('profiles.status', 'aktif');
        
        if (santriError) {
          console.error('Error fetching santri list:', santriError);
          return new Response(JSON.stringify({ success: false, error: 'Failed to fetch santri' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const tag = `new_tugas-${record.tugas_id}`;
        let totalSent = 0;
        let totalSubscriptions = 0;
        
        for (const santri of santriList || []) {
          const santriName = (santri.profiles as any)?.name || 'Santri';
          
          // Send push to santri
          console.log(`Sending new_tugas push to santri ${santri.id}: ${title}`);
          const santriResult = await sendPushToUser(
            supabase, santri.id, title, message, url, tag,
            vapidPublicKey, vapidPrivateKey, vapidSubject
          );
          totalSent += santriResult.sent;
          totalSubscriptions += santriResult.total;
          
          // Get and notify parents
          const { data: parentLinks } = await supabase
            .from('parent_children')
            .select('parent_id')
            .eq('child_id', santri.id);
          
          if (parentLinks && parentLinks.length > 0) {
            const parentMessage = `${santriName}: ${message}`;
            for (const link of parentLinks) {
              console.log(`Sending new_tugas push to parent ${link.parent_id}`);
              const parentResult = await sendPushToUser(
                supabase, link.parent_id, title, parentMessage, url, tag,
                vapidPublicKey, vapidPrivateKey, vapidSubject
              );
              totalSent += parentResult.sent;
              totalSubscriptions += parentResult.total;
            }
          }
        }
        
        return new Response(JSON.stringify({
          success: totalSent > 0,
          sent: totalSent,
          total: totalSubscriptions,
          message: `Sent ${totalSent} of ${totalSubscriptions} push notifications for new tugas`
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      case 'guru_pengganti': {
        // Handle guru pengganti notification
        const guruPenggantiUserId = record.guru_pengganti_user_id;
        const guruAsliName = record.guru_asli_name || 'Guru';
        const mapelNama = record.mapel_nama || 'Mata Pelajaran';
        const kelasNama = record.kelas_nama || 'Kelas';
        const tanggal = record.tanggal;
        const jamMulai = record.jam_mulai;
        const jamSelesai = record.jam_selesai;
        
        title = 'Anda Ditunjuk sebagai Guru Pengganti';
        message = `${guruAsliName} meminta Anda menggantikan mengajar ${mapelNama} di kelas ${kelasNama} pada ${new Date(tanggal).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}, jam ${jamMulai}-${jamSelesai}`;
        url = '/guru/jadwal';
        
        const gpTag = `guru_pengganti-${Date.now()}`;
        
        console.log(`Sending guru_pengganti push to ${guruPenggantiUserId}: ${title}`);
        const gpResult = await sendPushToUser(
          supabase, guruPenggantiUserId, title, message, url, gpTag,
          vapidPublicKey, vapidPrivateKey, vapidSubject
        );
        
        return new Response(JSON.stringify({
          success: gpResult.sent > 0,
          sent: gpResult.sent,
          total: gpResult.total,
          message: `Sent ${gpResult.sent} of ${gpResult.total} push notifications for guru pengganti`
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      case 'tagihan_baru': {
        const nominalBaru = formatNominal(record.jumlah);
        const jatuhTempoBaru = formatTanggal(record.jatuh_tempo);
        title = 'Tagihan Baru';
        message = `Tagihan baru: ${record.tagihan_nama} sebesar ${nominalBaru}. Jatuh tempo: ${jatuhTempoBaru}.`;
        url = '/app/tagihan';
        break;
      }
      case 'tagihan_reminder': {
        const nominalReminder = formatNominal(record.jumlah);
        const jatuhTempoReminder = formatTanggal(record.jatuh_tempo);
        title = 'Pengingat Tagihan';
        message = `Tagihan ${record.tagihan_nama} sebesar ${nominalReminder} akan jatuh tempo pada ${jatuhTempoReminder}. Segera lakukan pembayaran.`;
        url = '/app/tagihan';
        break;
      }
      case 'pembayaran_ditolak': {
        const nominalDitolak = formatNominal(record.jumlah);
        const jatuhTempoDitolak = formatTanggal(record.jatuh_tempo);
        title = 'Pembayaran Ditolak';
        message = `Pembayaran untuk ${record.tagihan_nama} (${nominalDitolak}) ditolak. Silakan upload ulang bukti pembayaran. Jatuh tempo: ${jatuhTempoDitolak}.`;
        url = '/app/tagihan';
        break;
      }
      case 'pembayaran_pending': {
        const nominalPending = formatNominal(record.jumlah);
        title = 'Pembayaran Baru Menunggu Verifikasi';
        message = `${record.santri_name} mengupload bukti pembayaran untuk ${record.tagihan_nama} (${nominalPending}). Menunggu verifikasi.`;
        url = '/admin/tagihan';

        const { data: adminRoles } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'admin');

        const ppTag = `pembayaran_pending-${Date.now()}`;
        let ppSent = 0;
        let ppTotal = 0;

        for (const admin of adminRoles || []) {
          const adminResult = await sendPushToUser(
            supabase, admin.user_id, title, message, url, ppTag,
            vapidPublicKey, vapidPrivateKey, vapidSubject
          );
          ppSent += adminResult.sent;
          ppTotal += adminResult.total;
        }

        return new Response(JSON.stringify({
          success: ppSent > 0,
          sent: ppSent,
          total: ppTotal,
          message: `Sent ${ppSent} of ${ppTotal} push notifications for pembayaran pending`
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      case 'tagihan_reminder_cron': {
        // Called by pg_cron - invoke the DB function that handles the logic
        console.log('Running tagihan_reminder_cron - calling check_tagihan_jatuh_tempo()');
        const { error: rpcError } = await supabase.rpc('check_tagihan_jatuh_tempo');
        if (rpcError) {
          console.error('Error calling check_tagihan_jatuh_tempo:', rpcError);
        }
        return new Response(JSON.stringify({
          success: !rpcError,
          message: rpcError ? rpcError.message : 'Tagihan reminder check completed'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      default:
        console.log('Unknown trigger type:', type);
        return new Response(JSON.stringify({ success: false, error: 'Unknown trigger type' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    const tag = `${type}-${Date.now()}`;
    let totalSent = 0;
    let totalSubscriptions = 0;

    // Send push to santri
    console.log(`Sending push to santri ${santriId}: ${title} - ${message}`);
    const santriResult = await sendPushToUser(
      supabase, santriId, title, message, url, tag,
      vapidPublicKey, vapidPrivateKey, vapidSubject
    );
    totalSent += santriResult.sent;
    totalSubscriptions += santriResult.total;

    // Get parents of this santri and send push to them
    const { data: parentLinks, error: parentError } = await supabase
      .from('parent_children')
      .select('parent_id')
      .eq('child_id', santriId);

    if (!parentError && parentLinks && parentLinks.length > 0) {
      const parentMessage = `${santriName}: ${message}`;
      
      for (const link of parentLinks) {
        console.log(`Sending push to parent ${link.parent_id}: ${title} - ${parentMessage}`);
        const parentResult = await sendPushToUser(
          supabase, link.parent_id, title, parentMessage, url, tag,
          vapidPublicKey, vapidPrivateKey, vapidSubject
        );
        totalSent += parentResult.sent;
        totalSubscriptions += parentResult.total;
      }
    }

    return new Response(JSON.stringify({
      success: totalSent > 0,
      sent: totalSent,
      total: totalSubscriptions,
      message: `Sent ${totalSent} of ${totalSubscriptions} push notifications`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in trigger-push-notification:', error);
    return new Response(JSON.stringify({ success: false, error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
