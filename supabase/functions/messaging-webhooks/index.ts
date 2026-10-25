import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, x-twilio-signature', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const emptyXml = () => new Response('<Response/>', { status: 200, headers: { ...cors, 'Content-Type': 'application/xml; charset=utf-8' } });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const hex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
const constantTimeEqual = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
};
const cleanPhone = (value: string) => value.replace(/^whatsapp:/i, '').replace(/[\\s()-]/g, '');
async function validTwilioSignature(requestUrl: string, form: URLSearchParams, signature: string, authToken: string) {
  if (!signature) return false;
  let signed = requestUrl;
  const params = [...form.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  for (const [key, value] of params) signed += key + value;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(authToken), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signed)));
  let binary = '';
  for (const byte of digest) binary += String.fromCharCode(byte);
  return constantTimeEqual(btoa(binary), signature);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  if (!authToken) return json({ error: 'Webhook authentication is not configured' }, 503);
  const signature = req.headers.get('X-Twilio-Signature') ?? '';
  const rawBody = await req.text();
  const form = new URLSearchParams(rawBody);
  if (!await validTwilioSignature(req.url, form, signature, authToken)) return json({ error: 'Invalid webhook signature' }, 401);

  const url = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const sid = form.get('MessageSid') ?? form.get('SmsSid') ?? '';
  const status = (form.get('MessageStatus') ?? form.get('SmsStatus') ?? '').toLowerCase();
  const from = form.get('From') ?? '';
  const text = (form.get('Body') ?? '').trim().slice(0, 1200);
  const channel = /^whatsapp:/i.test(from) ? 'whatsapp' : 'sms';
  const e164 = cleanPhone(from);
  const eventType = status || 'inbound.message';
  const eventId = sid ? sid + ':' + eventType : crypto.randomUUID();
  const digest = hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawBody)));
  const { error: insertError } = await admin.from('provider_webhook_events').upsert(
    { provider: 'twilio', provider_event_id: eventId, event_type: eventType, payload_hash: digest },
    { onConflict: 'provider,provider_event_id', ignoreDuplicates: true },
  );
  if (insertError) return json({ error: 'Could not record webhook event' }, 500);
  const { data: event } = await admin.from('provider_webhook_events').select('processed_at').eq('provider', 'twilio').eq('provider_event_id', eventId).maybeSingle();
  if (event?.processed_at) return status ? json({ received: true }) : emptyXml();

  try {
    if (status && sid) {
      const mapped = status === 'delivered' ? 'delivered' :
        status === 'undelivered' ? 'undelivered' :
        status === 'failed' ? 'failed' :
        status === 'sent' ? 'sent' : 'queued';
      await admin.from('notification_log').update({ status: mapped, error_code: form.get('ErrorCode'), updated_at: new Date().toISOString() })
        .eq('provider', 'twilio').eq('provider_message_id', sid);
      const { data: recipient } = await admin.from('campaign_recipients').select('campaign_id').eq('provider_message_id', sid).maybeSingle();
      await admin.from('campaign_recipients').update({ status: mapped, error_code: form.get('ErrorCode'), updated_at: new Date().toISOString() }).eq('provider_message_id', sid);
      if (recipient) {
        const { data: rows } = await admin.from('campaign_recipients').select('status').eq('campaign_id', recipient.campaign_id);
        const all = rows ?? [];
        const sentCount = all.filter((row) => ['sent', 'delivered'].includes(row.status)).length;
        const failedCount = all.filter((row) => ['failed', 'undelivered'].includes(row.status)).length;
        const pendingCount = all.filter((row) => row.status === 'pending').length;
        await admin.from('notification_campaigns').update({ sent_count: sentCount, failed_count: failedCount, ...(pendingCount ? {} : { status: failedCount ? (sentCount ? 'partial' : 'failed') : 'completed', completed_at: new Date().toISOString() }) }).eq('id', recipient.campaign_id);
      }
      await admin.from('provider_webhook_events').update({ processed_at: new Date().toISOString() }).eq('provider', 'twilio').eq('provider_event_id', eventId);
      return json({ received: true });
    }

    if (!sid || !/^\\+[1-9]\\d{7,14}$/.test(e164)) return emptyXml();
    const { data: profile } = await admin.from('profiles').select('id').eq('phone', e164).maybeSingle();
    const { error: inboundError } = await admin.from('inbound_messages').insert({
      provider: 'twilio', provider_message_id: sid, channel, from_e164: e164, profile_id: profile?.id ?? null, message_text: text,
    });
    if (inboundError && !String(inboundError.code).includes('23505')) return json({ error: 'Could not store inbound message' }, 500);
    const command = text.toLowerCase().trim();
    if (profile?.id && ['stop', 'stopall', 'unsubscribe', 'cancel', 'end', 'quit'].includes(command)) {
      const column = channel === 'whatsapp' ? 'whatsapp_opt_in' : 'sms_opt_in';
      await admin.from('profiles').update({ [column]: false }).eq('id', profile.id);
    }
    await admin.from('provider_webhook_events').update({ processed_at: new Date().toISOString() }).eq('provider', 'twilio').eq('provider_event_id', eventId);
    return emptyXml();
  } catch {
    return json({ error: 'Webhook processing failed' }, 500);
  }
});

