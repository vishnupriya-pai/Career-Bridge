/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const appOrigin = Deno.env.get('APP_URL') ?? 'http://localhost:5173';
const cors = { 'Access-Control-Allow-Origin': appOrigin, 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-razorpay-signature, x-razorpay-event-id', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const out = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, '0')).join('');
const equal = (a: string, b: string) => { if (a.length !== b.length) return false; let result = 0; for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i); return result === 0; };
async function hmac(secret: string, value: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)));
}
const normalizePhone = (phone: string | null) => (phone ?? '').replace(/[\\s()-]/g, '');
const sendTwilio = async (profile: any, channel: 'sms' | 'whatsapp', message: string, eventKey: string, admin: any) => {
  const phone = normalizePhone(profile.phone);
  if (!/^\\+[1-9]\\d{7,14}$/.test(phone)) return;
  if (channel === 'sms' && !profile.sms_opt_in) return;
  if (channel === 'whatsapp' && !profile.whatsapp_opt_in) return;
  const sid = Deno.env.get('TWILIO_ACCOUNT_SID'), token = Deno.env.get('TWILIO_AUTH_TOKEN');
  const from = channel === 'sms' ? Deno.env.get('TWILIO_SMS_FROM') : Deno.env.get('TWILIO_WHATSAPP_FROM');
  if (!sid || !token || !from) return;
  if (channel === 'whatsapp' && !Deno.env.get('TWILIO_WHATSAPP_CONTENT_SID')) return;
  const { data: prior } = await admin.from('notification_log').select('id,status').eq('user_id', profile.id).eq('channel', channel).eq('event_key', eventKey).maybeSingle();
  if (prior && ['sent','delivered'].includes(prior.status)) return;
  const { data: log } = await admin.from('notification_log').upsert(
    { user_id: profile.id, channel, event_key: eventKey, reference_id: eventKey, provider: 'twilio', status: 'queued' },
    { onConflict: 'user_id,channel,event_key', ignoreDuplicates: true },
  ).select('id').maybeSingle();
  if (!log?.id) return;
  const form = new URLSearchParams({ To: channel === 'whatsapp' ? 'whatsapp:' + phone : phone, From: from });
  form.set('StatusCallback', Deno.env.get('SUPABASE_URL') + '/functions/v1/messaging-webhooks');
  if (channel === 'whatsapp') {
    form.set('ContentSid', Deno.env.get('TWILIO_WHATSAPP_CONTENT_SID')!);
    form.set('ContentVariables', JSON.stringify({ '1': message }));
  } else {
    form.set('Body', message);
    const entityId = Deno.env.get('TWILIO_SMS_DLT_ENTITY_ID');
    const templateId = Deno.env.get('TWILIO_SMS_DLT_TEMPLATE_ID');
    if (entityId) form.set('EntityId', entityId);
    if (templateId) form.set('DltTemplateId', templateId);
  }
  try {
    const sent = await fetch('https://api.twilio.com/2010-04-01/Accounts/' + sid + '/Messages.json', {
      method: 'POST',
      headers: { Authorization: 'Basic ' + btoa(sid + ':' + token), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
    });
    const result = await sent.json().catch(() => ({}));
    if (!sent.ok) {
      await admin.from('notification_log').update({ status: 'failed', error_code: String(result.code ?? 'provider_rejected').slice(0, 80), updated_at: new Date().toISOString() }).eq('id', log.id);
      return;
    }
    await admin.from('notification_log').update({ status: 'sent', provider_message_id: result.sid ?? null, updated_at: new Date().toISOString() }).eq('id', log.id);
  } catch {
    await admin.from('notification_log').update({ status: 'failed', error_code: 'provider_unavailable', updated_at: new Date().toISOString() }).eq('id', log.id);
  }
};
async function sendPaymentNotice(order: any, paymentId: string, admin: any, appUrl: string) {
  const { data: profile } = await admin.from('profiles').select('id,email,full_name,phone,sms_opt_in,whatsapp_opt_in').eq('id', order.user_id).maybeSingle();
  if (!profile) return;
  const subject = 'Payment received · CareerBridge';
  const message = 'Hi ' + (profile.full_name || 'there') + ', your CareerBridge payment of ₹' + (Number(order.amount_paise) / 100).toFixed(2) + ' has been confirmed. Payment reference: ' + paymentId + '.';
  const eventKey = 'payment:' + paymentId;
  const service = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  if (profile.email) {
    const { data: authUser } = await service.auth.admin.getUserById(profile.id);
    if (authUser.user?.email_confirmed_at && Deno.env.get('RESEND_API_KEY') && Deno.env.get('RESEND_FROM')) {
      const key = eventKey + ':email';
      const { data: existing } = await admin.from('notification_log').select('id,status').eq('user_id', profile.id).eq('channel', 'email').eq('event_key', key).maybeSingle();
      if (!existing) {
        const { data: log } = await admin.from('notification_log').insert({ user_id: profile.id, channel: 'email', event_key: key, reference_id: paymentId, provider: 'resend', status: 'queued' }).select('id').maybeSingle();
        if (log?.id) {
          try {
            const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: 'Bearer ' + Deno.env.get('RESEND_API_KEY'), 'Content-Type': 'application/json' }, body: JSON.stringify({ from: Deno.env.get('RESEND_FROM'), to: [profile.email], subject, text: message + (appUrl ? '\\n\\n' + appUrl : '') }) });
            const result = await response.json().catch(() => ({}));
            await admin.from('notification_log').update({ status: response.ok ? 'sent' : 'failed', provider_message_id: result.id ?? null, error_code: response.ok ? null : 'provider_rejected', updated_at: new Date().toISOString() }).eq('id', log.id);
          } catch {
            await admin.from('notification_log').update({ status: 'failed', error_code: 'provider_unavailable', updated_at: new Date().toISOString() }).eq('id', log.id);
          }
        }
      }
    }
  }
  await sendTwilio(profile, 'whatsapp', message, eventKey + ':whatsapp', admin);
  await sendTwilio(profile, 'sms', message, eventKey + ':sms', admin);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return out({ error: 'Method not allowed' }, 405);
  const raw = await req.text();
  let body: any;
  try { body = JSON.parse(raw); } catch { return out({ error: 'Invalid JSON' }, 400); }
  const url = Deno.env.get('SUPABASE_URL')!;
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(url, service);

  if (req.headers.has('x-razorpay-signature') || body.action === 'webhook') {
    const secret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET');
    if (!secret) return out({ error: 'Webhook is not configured' }, 503);
    const signature = req.headers.get('x-razorpay-signature') ?? '';
    if (!equal(await hmac(secret, raw), signature)) return out({ error: 'Invalid webhook signature' }, 401);
    let event: any;
    try { event = JSON.parse(raw); } catch { return out({ error: 'Invalid webhook body' }, 400); }
    const eventType = String(event.event ?? 'unknown');
    const eventId = req.headers.get('x-razorpay-event-id') ?? hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw)));
    const payment = event.payload?.payment?.entity;
    const orderEntity = event.payload?.order?.entity;
    const providerOrderId = payment?.order_id ?? orderEntity?.id ?? null;
    const paymentId = payment?.id ?? null;
    const digest = hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw)));
    const { error: eventError } = await admin.from('payment_events').upsert(
      { provider_event_id: eventId, event_type: eventType, provider_order_id: providerOrderId, provider_payment_id: paymentId, payload_hash: digest },
      { onConflict: 'provider_event_id', ignoreDuplicates: true },
    );
    if (eventError) return out({ error: 'Could not record payment event' }, 500);
    const { data: savedEvent } = await admin.from('payment_events').select('processed_at').eq('provider_event_id', eventId).maybeSingle();
    if (savedEvent?.processed_at) return out({ received: true, duplicate: true });

    if (['payment.captured','order.paid','payment.failed','refund.processed','payment.refunded'].includes(eventType)) {
      if (!providerOrderId) return out({ error: 'Event has no associated order' }, 400);
      const { data: order } = await admin.from('payment_orders').select('*').eq('provider_order_id', providerOrderId).maybeSingle();
      if (!order) return out({ error: 'Payment order not found' }, 404);
      const amount = Number(payment?.amount ?? orderEntity?.amount);
      const currency = String(payment?.currency ?? orderEntity?.currency ?? order.currency);
      if (Number.isFinite(amount) && amount !== Number(order.amount_paise) || currency !== order.currency) {
        await admin.from('audit_logs').insert({ action: 'payment.amount_mismatch', entity_type: 'payment_order', entity_id: order.id, details: { event_id: eventId, event_type: eventType } });
        await admin.from('payment_events').update({ processed_at: new Date().toISOString() }).eq('provider_event_id', eventId);
        return out({ received: true, review_required: true });
      }
      if (eventType === 'payment.captured' || eventType === 'order.paid') {
        const verifiedPaymentId = paymentId ?? order.provider_payment_id;
        const update = await admin.from('payment_orders').update({
          status: 'paid', provider_payment_id: verifiedPaymentId, paid_at: new Date().toISOString(), failure_reason: null,
        }).eq('id', order.id).neq('status', 'refunded');
        if (update.error) return out({ error: 'Payment state could not be updated' }, 500);
        const { data: paidOrder } = await admin.from('payment_orders').select('*').eq('id', order.id).maybeSingle();
        if (paidOrder?.status === 'paid' && verifiedPaymentId) await sendPaymentNotice(paidOrder, verifiedPaymentId, admin, Deno.env.get('APP_URL') ?? '');
      } else if (eventType === 'payment.failed') {
        if (order.status !== 'paid' && order.status !== 'refunded') {
          await admin.from('payment_orders').update({ status: 'failed', provider_payment_id: paymentId, failure_reason: String(payment?.error_description ?? payment?.error_reason ?? 'Payment failed').slice(0, 240) }).eq('id', order.id);
        }
      } else {
        await admin.from('payment_orders').update({ status: 'refunded', provider_payment_id: paymentId ?? order.provider_payment_id, refunded_at: new Date().toISOString() }).eq('id', order.id);
      }
    }
    await admin.from('payment_events').update({ processed_at: new Date().toISOString() }).eq('provider_event_id', eventId);
    return out({ received: true });
  }

  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return out({ error: 'Sign in required' }, 401);
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) return out({ error: 'Invalid session' }, 401);
  if (body.action === 'verify_checkout') {
    const orderId = String(body.razorpay_order_id ?? '');
    const paymentId = String(body.razorpay_payment_id ?? '');
    const signature = String(body.razorpay_signature ?? '');
    if (!orderId || !paymentId || !signature) return out({ error: 'Checkout verification fields are missing' }, 400);
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
    const keyId = Deno.env.get('RAZORPAY_KEY_ID');
    if (!keyId || !keySecret) return out({ error: 'Razorpay is not configured' }, 503);
    const { data: order } = await admin.from('payment_orders').select('*').eq('provider_order_id', orderId).eq('user_id', user.id).maybeSingle();
    if (!order) return out({ error: 'Order not found for this account' }, 404);
    if (!equal(await hmac(keySecret, orderId + '|' + paymentId), signature)) return out({ error: 'Payment signature is invalid' }, 401);
    const providerResponse = await fetch('https://api.razorpay.com/v1/payments/' + encodeURIComponent(paymentId), {
      headers: { Authorization: 'Basic ' + btoa(keyId + ':' + keySecret) },
    });
    if (!providerResponse.ok) return out({ error: 'Could not confirm payment status with Razorpay. The webhook will reconcile it.' }, 502);
    const providerPayment = await providerResponse.json();
    if (providerPayment.order_id !== orderId || Number(providerPayment.amount) !== Number(order.amount_paise) || providerPayment.currency !== order.currency) {
      await admin.from('audit_logs').insert({ actor_id: user.id, action: 'payment.checkout_mismatch', entity_type: 'payment_order', entity_id: order.id });
      return out({ error: 'The payment details do not match this order' }, 409);
    }
    const providerStatus = providerPayment.status === 'captured' ? 'paid' : providerPayment.status === 'authorized' ? 'authorized' : providerPayment.status === 'failed' ? 'failed' : 'pending';
    const update = await admin.from('payment_orders').update({
      status: order.status === 'refunded' ? 'refunded' : providerStatus,
      provider_payment_id: paymentId, checkout_signature_verified: true,
      paid_at: providerStatus === 'paid' ? new Date().toISOString() : order.paid_at,
      failure_reason: providerStatus === 'failed' ? String(providerPayment.error_description ?? 'Payment failed').slice(0, 240) : null,
    }).eq('id', order.id).neq('status', 'refunded');
    if (update.error) return out({ error: 'Payment could not be reconciled' }, 500);
    if (providerStatus === 'paid' && order.status !== 'paid') {
      const { data: paidOrder } = await admin.from('payment_orders').select('*').eq('id', order.id).maybeSingle();
      if (paidOrder) await sendPaymentNotice(paidOrder, paymentId, admin, Deno.env.get('APP_URL') ?? '');
    }
    return out({ verified: true, status: providerStatus });
  }
  if (body.action !== 'create_order') return out({ error: 'Unsupported action' }, 400);
  const keyId = Deno.env.get('RAZORPAY_KEY_ID'), keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
  if (!keyId || !keySecret) return out({ error: 'Razorpay is not configured' }, 503);
  const amount = Number(Deno.env.get('PLAN_PRICE_PAISE') ?? 49900);
  if (!Number.isSafeInteger(amount) || amount < 100) return out({ error: 'Invalid plan price' }, 500);
  const { count } = await admin.from('payment_orders').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());
  if ((count ?? 0) >= 5) return out({ error: 'Order limit reached. Try again later.' }, 429);
  const created = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST', headers: { Authorization: 'Basic ' + btoa(keyId + ':' + keySecret), 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, currency: 'INR', receipt: 'cb_' + crypto.randomUUID().replaceAll('-', '').slice(0, 20), notes: { user_id: user.id } }),
  });
  if (!created.ok) return out({ error: 'Payment provider could not create an order' }, 502);
  const providerOrder = await created.json();
  const { error: savedError } = await admin.from('payment_orders').insert({ user_id: user.id, provider: 'razorpay', provider_order_id: providerOrder.id, amount_paise: amount, currency: 'INR', status: 'created' });
  if (savedError) return out({ error: 'Order could not be saved' }, 500);
  return out({ order_id: providerOrder.id, amount: providerOrder.amount, currency: providerOrder.currency, key_id: keyId, name: 'CareerBridge', description: 'CareerBridge Plus' });
});

