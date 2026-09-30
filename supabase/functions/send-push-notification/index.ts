import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const { user_id, title, message, url, tag } = await req.json();
    console.log('Received push request:', { user_id, title, message, url });
    if (!user_id || !title || !message) return new Response(JSON.stringify({ success: false, error: 'Missing required fields' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!;
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!;
    const vapidSubject = Deno.env.get('VAPID_SUBJECT')!;
    if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) return new Response(JSON.stringify({ success: false, error: 'VAPID keys not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: subscriptions, error: subError } = await supabase.from('push_subscriptions').select('*').eq('user_id', user_id);
    if (subError) return new Response(JSON.stringify({ success: false, error: 'Failed to fetch subscriptions' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (!subscriptions || subscriptions.length === 0) return new Response(JSON.stringify({ success: false, message: 'No push subscriptions found for user' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    console.log(`Found ${subscriptions.length} subscription(s) for user ${user_id}`);
    const payload = { title, message, url: url || '/', tag: tag || `notification-${Date.now()}` };
    const results = [];
    const failedEndpoints: string[] = [];
    for (const sub of subscriptions) {
      try {
        const response = await sendWebPush({ endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth }, payload, vapidPublicKey, vapidPrivateKey, vapidSubject);
        if (response.ok || response.status === 201) { console.log(`Push sent successfully to ${sub.endpoint}`); results.push({ endpoint: sub.endpoint, success: true }); }
        else { const errorText = await response.text(); console.error(`Push failed for ${sub.endpoint}:`, response.status, errorText); results.push({ endpoint: sub.endpoint, success: false, status: response.status, error: errorText }); if (response.status === 410 || response.status === 404) failedEndpoints.push(sub.endpoint); }
      } catch (error) { console.error(`Error sending push to ${sub.endpoint}:`, error); results.push({ endpoint: sub.endpoint, success: false, error: String(error) }); }
    }
    if (failedEndpoints.length > 0) { console.log('Cleaning up invalid subscriptions:', failedEndpoints); await supabase.from('push_subscriptions').delete().eq('user_id', user_id).in('endpoint', failedEndpoints); }
    const successCount = results.filter(r => r.success).length;
    return new Response(JSON.stringify({ success: successCount > 0, sent: successCount, total: subscriptions.length, results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) { console.error('Error in send-push-notification:', error); return new Response(JSON.stringify({ success: false, error: String(error) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }
});
