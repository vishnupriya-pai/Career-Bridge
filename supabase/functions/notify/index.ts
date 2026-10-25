import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const appOrigin = Deno.env.get('APP_URL') ?? 'http://localhost:5173';
const allowedOrigins = new Set([appOrigin, 'http://localhost:5173', 'http://localhost:5174']);
const corsFor = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin && allowedOrigins.has(origin) ? origin : appOrigin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
});
const reply = (body: unknown, status = 200, origin: string | null = null) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsFor(origin), 'Content-Type': 'application/json' } });
const normalizePhone = (phone: string | null) => (phone ?? '').replace(/[\\s()-]/g, '');

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsFor(origin) });
  if (req.method !== 'POST') return reply({ error: 'Method not allowed' }, 405, origin);
  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return reply({ error: 'Sign in required' }, 401, origin);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const caller = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
  const { data: { user }, error: authError } = await caller.auth.getUser();
  if (authError || !user) return reply({ error: 'Invalid session' }, 401, origin);
  let input: { channel?: string; message?: string; subject?: string; event_key?: string };
  try { input = await req.json(); } catch { return reply({ error: 'Invalid request body' }, 400, origin); }
  const channel = input.channel;
  if (!['email','sms','whatsapp'].includes(channel ?? '')) return reply({ error: 'Unsupported channel' }, 400, origin);
  const message = (input.message ?? '').trim();
  if (message.length < 1 || message.length > 1200) return reply({ error: 'Message must be between 1 and 1200 characters' }, 400, origin);
  const eventKey = (input.event_key ?? '').trim() || 'test:' + crypto.randomUUID();
  if (eventKey.length > 180 || !/^[a-zA-Z0-9:_-]+$/.test(eventKey)) return reply({ error: 'Invalid notification reference' }, 400, origin);

  const admin = createClient(url, service);
  const { data: profile } = await admin.from('profiles').select('id,email,phone,whatsapp_opt_in,sms_opt_in').eq('id', user.id).maybeSingle();
  if (!profile) return reply({ error: 'Profile not found' }, 404, origin);
  if (channel === 'whatsapp' && !profile.whatsapp_opt_in) return reply({ error: 'Enable WhatsApp updates in your profile first' }, 403, origin);
  if (channel === 'sms' && !profile.sms_opt_in) return reply({ error: 'Enable SMS updates in your profile first' }, 403, origin);
  if (channel !== 'email' && !/^\\+[1-9]\\d{7,14}$/.test(normalizePhone(profile.phone))) return reply({ error: 'Enter a valid international phone number in your profile' }, 400, origin);

  const { data: existing } = await admin.from('notification_log').select('id,status').eq('user_id', user.id).eq('channel', channel).eq('event_key', eventKey).maybeSingle();
  if (existing && ['sent','delivered'].includes(existing.status)) return reply({ sent: true, duplicate: true }, 200, origin);
  if (existing && existing.status === 'queued') return reply({ sent: false, pending: true, duplicate: true }, 202, origin);
  const { count } = await admin.from('notification_log').select('id', { count: 'exact', head: true })
    .eq('user_id', user.id).gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());
  if ((count ?? 0) >= 15) return reply({ error: 'Notification limit reached. Try again later.' }, 429, origin);

  const provider = channel === 'email' ? 'resend' : 'twilio';
  let log: { id: string } | null = null;
  let logError: { message?: string } | null = null;
  if (existing) {
    const retry = await admin.from('notification_log').update({ provider, status: 'queued', error_code: null, updated_at: new Date().toISOString() }).eq('id', existing.id).select('id').maybeSingle();
    log = retry.data;
    logError = retry.error;
  } else {
    const created = await admin.from('notification_log').insert({ user_id: user.id, channel, event_key: eventKey, provider, status: 'queued' }).select('id').maybeSingle();
    log = created.data;
    logError = created.error;
  }
  if (logError) return reply({ error: 'Notification could not be queued' }, 500, origin);
  if (!log?.id) return reply({ sent: false, pending: true, duplicate: true }, 202, origin);

  try {
    if (channel === 'email') {
      if (!user.email_confirmed_at) throw new Error('Verify your email address first');
      const apiKey = Deno.env.get('RESEND_API_KEY'), sender = Deno.env.get('RESEND_FROM');
      if (!apiKey || !sender) throw new Error('Email delivery is not configured');
      const sent = await fetch('https://api.resend.com/emails', {
        method: 'POST', headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: sender, to: [profile.email], subject: (input.subject ?? 'A CareerBridge update').slice(0, 120), text: message }),
      });
      const result = await sent.json().catch(() => ({}));
      if (!sent.ok) {
        await admin.from('notification_log').update({ status: 'failed', error_code: 'provider_rejected', updated_at: new Date().toISOString() }).eq('id', log.id);
        return reply({ error: 'Email provider rejected the request' }, 502, origin);
      }
      await admin.from('notification_log').update({ status: 'sent', provider_message_id: result.id ?? null, updated_at: new Date().toISOString() }).eq('id', log.id);
    } else {
      const sid = Deno.env.get('TWILIO_ACCOUNT_SID'), token = Deno.env.get('TWILIO_AUTH_TOKEN');
      if (!sid || !token) throw new Error('Messaging provider is not configured');
      const from = channel === 'whatsapp' ? Deno.env.get('TWILIO_WHATSAPP_FROM') : Deno.env.get('TWILIO_SMS_FROM');
      if (!from) throw new Error('Messaging sender is not configured');
      const phone = normalizePhone(profile.phone);
      const form = new URLSearchParams({ To: channel === 'whatsapp' ? 'whatsapp:' + phone : phone, From: from });
      form.set('StatusCallback', url + '/functions/v1/messaging-webhooks');
      if (channel === 'whatsapp') {
        const contentSid = Deno.env.get('TWILIO_WHATSAPP_CONTENT_SID');
        if (!contentSid) throw new Error('An approved WhatsApp template is not configured');
        form.set('ContentSid', contentSid);
        form.set('ContentVariables', JSON.stringify({ '1': message }));
      } else {
        form.set('Body', message);
        const entityId = Deno.env.get('TWILIO_SMS_DLT_ENTITY_ID');
        const templateId = Deno.env.get('TWILIO_SMS_DLT_TEMPLATE_ID');
        if (entityId) form.set('EntityId', entityId);
        if (templateId) form.set('DltTemplateId', templateId);
      }
      const sent = await fetch('https://api.twilio.com/2010-04-01/Accounts/' + sid + '/Messages.json', {
        method: 'POST',
        headers: { Authorization: 'Basic ' + btoa(sid + ':' + token), 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form,
      });
      const result = await sent.json().catch(() => ({}));
      if (!sent.ok) {
        await admin.from('notification_log').update({ status: 'failed', error_code: String(result.code ?? 'provider_rejected').slice(0, 80), updated_at: new Date().toISOString() }).eq('id', log.id);
        return reply({ error: 'Messaging provider rejected the request' }, 502, origin);
      }
      await admin.from('notification_log').update({ status: 'sent', provider_message_id: result.sid ?? null, updated_at: new Date().toISOString() }).eq('id', log.id);
    }
    return reply({ sent: true }, 200, origin);
  } catch (error) {
    await admin.from('notification_log').update({ status: 'failed', error_code: 'configuration_or_delivery_error', updated_at: new Date().toISOString() }).eq('id', log.id);
    return reply({ error: error instanceof Error ? error.message : 'Delivery failed' }, 502, origin);
  }
});

