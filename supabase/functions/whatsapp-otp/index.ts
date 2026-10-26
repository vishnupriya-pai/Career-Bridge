import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const appOrigin = Deno.env.get('APP_URL') ?? 'http://localhost:5173';
const allowedOrigins = new Set([appOrigin, 'http://localhost:5173', 'http://localhost:5174']);
const corsFor = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin && allowedOrigins.has(origin) ? origin : appOrigin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin',
});
const reply = (body: unknown, status = 200, origin: string | null = null) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsFor(origin), 'Content-Type': 'application/json' } });
const normalizePhone = (phone: string | null) => (phone ?? '').replace(/[\s()-]/g, '');

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsFor(origin) });
  if (req.method !== 'POST') return reply({ error: 'Method not allowed' }, 405, origin);
  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return reply({ error: 'Sign in required' }, 401, origin);
  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const sid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const token = Deno.env.get('TWILIO_AUTH_TOKEN');
  const verifySid = Deno.env.get('TWILIO_VERIFY_SERVICE_SID');
  const caller = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
  const { data: { user }, error: authError } = await caller.auth.getUser();
  if (authError || !user) return reply({ error: 'Invalid session' }, 401, origin);
  let input: { action?: string; code?: string };
  try { input = await req.json(); } catch { return reply({ error: 'Invalid request body' }, 400, origin); }
  const sandboxMode = (Deno.env.get('TWILIO_WHATSAPP_SANDBOX_MODE') ?? '').trim().toLowerCase() === 'true';
  if (input.action === 'status') return reply({ sandboxMode }, 200, origin);
  if (!['send', 'check'].includes(input.action ?? '')) return reply({ error: 'Choose send or check' }, 400, origin);
  if (!sid || !token || !verifySid) return reply({ error: 'WhatsApp OTP verification is not configured' }, 503, origin);
  const admin = createClient(url, service);
  const { data: profile } = await admin.from('profiles').select('phone,phone_verified').eq('id', user.id).maybeSingle();
  if (!profile) return reply({ error: 'Profile not found' }, 404, origin);
  const phone = normalizePhone(profile.phone);
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) return reply({ error: 'Save a valid international phone number first' }, 400, origin);
  if (profile.phone_verified) return reply({ verified: true }, 200, origin);
  const form = new URLSearchParams({ To: phone });
  const endpoint = input.action === 'send' ? 'Verifications' : 'VerificationCheck';
  if (input.action === 'send') form.set('Channel', 'whatsapp');
  else {
    const code = (input.code ?? '').trim();
    if (!/^\d{4,10}$/.test(code)) return reply({ error: 'Enter the numeric verification code' }, 400, origin);
    form.set('Code', code);
  }
  try {
    const result = await fetch(`https://verify.twilio.com/v2/Services/${verifySid}/${endpoint}`, {
      method: 'POST', headers: { Authorization: 'Basic ' + btoa(`${sid}:${token}`), 'Content-Type': 'application/x-www-form-urlencoded' }, body: form,
    });
    const payload = await result.json().catch(() => ({}));
    if (!result.ok) {
      const code = String(payload.code ?? 'provider_rejected').slice(0, 80);
      const message = String(payload.message ?? '').slice(0, 240);
      return reply({ error: message ? `Twilio WhatsApp verification failed (${code}): ${message}` : `Twilio WhatsApp verification failed (${code})` }, 502, origin);
    }
    if (input.action === 'send') return reply({ sent: true }, 200, origin);
    if (payload.status !== 'approved') return reply({ error: 'That code is incorrect or expired' }, 400, origin);
    const { error } = await admin.from('profiles').update({ phone_verified: true }).eq('id', user.id).eq('phone', profile.phone);
    if (error) return reply({ error: 'Code was verified, but the profile could not be updated. Try again.' }, 500, origin);
    return reply({ verified: true }, 200, origin);
  } catch {
    return reply({ error: 'WhatsApp verification service is unavailable' }, 502, origin);
  }
});
