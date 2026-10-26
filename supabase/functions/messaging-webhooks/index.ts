import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { advanceStatus, deliveryStatus } from './delivery-status.ts';

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
const cleanPhone = (value: string) => value.replace(/^whatsapp:/i, '').replace(/[\s()-]/g, '');
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
      const nextStatus = deliveryStatus(status);
      const [{ data: notification, error: notificationLookupError }, { data: recipient, error: recipientLookupError }] = await Promise.all([
        admin.from('notification_log').select('id,status').eq('provider', 'twilio').eq('provider_message_id', sid).maybeSingle(),
        admin.from('campaign_recipients').select('id,campaign_id,status').eq('provider_message_id', sid).maybeSingle(),
      ]);
      if (notificationLookupError || recipientLookupError) return json({ error: 'Could not find the message status record' }, 503);
      // Twilio can call the status URL before the send handler stores its SID.
      // Leave the webhook unprocessed so Twilio retries it after the send commits.
      if (!notification && !recipient) return json({ error: 'Message status record is not ready; retry this callback' }, 503);
      if (notification) {
        const mapped = advanceStatus(notification.status, nextStatus);
        const update = await admin.from('notification_log').update({ status: mapped, error_code: mapped === 'failed' || mapped === 'undelivered' ? form.get('ErrorCode') : null, updated_at: new Date().toISOString() }).eq('id', notification.id);
        if (update.error) return json({ error: 'Could not update notification delivery status' }, 503);
      }
      if (recipient) {
        const mapped = advanceStatus(recipient.status, nextStatus);
        const update = await admin.from('campaign_recipients').update({ status: mapped, error_code: mapped === 'failed' || mapped === 'undelivered' ? form.get('ErrorCode') : null, updated_at: new Date().toISOString() }).eq('id', recipient.id);
        if (update.error) return json({ error: 'Could not update campaign delivery status' }, 503);
      }
      if (recipient) {
        const { data: rows, error: rowsError } = await admin.from('campaign_recipients').select('status').eq('campaign_id', recipient.campaign_id);
        if (rowsError) return json({ error: 'Could not update campaign summary' }, 503);
        const all = rows ?? [];
        const sentCount = all.filter((row) => ['sent', 'delivered'].includes(row.status)).length;
        const failedCount = all.filter((row) => ['failed', 'undelivered'].includes(row.status)).length;
        const pendingCount = all.filter((row) => row.status === 'pending').length;
        const summary = await admin.from('notification_campaigns').update({ sent_count: sentCount, failed_count: failedCount, ...(pendingCount ? {} : { status: failedCount ? (sentCount ? 'partial' : 'failed') : 'completed', completed_at: new Date().toISOString() }) }).eq('id', recipient.campaign_id);
        if (summary.error) return json({ error: 'Could not save campaign summary' }, 503);
      }
      const processed = await admin.from('provider_webhook_events').update({ processed_at: new Date().toISOString() }).eq('provider', 'twilio').eq('provider_event_id', eventId);
      if (processed.error) return json({ error: 'Could not mark webhook processed' }, 503);
      return json({ received: true });
    }

    if (!sid || !/^\+[1-9]\d{7,14}$/.test(e164)) return emptyXml();
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

