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
async function sendPaymentNotice(order: any, paymentId: string, admin: any, appUrl: string) {
  const { data: profile } = await admin.from('profiles').select('id,email,full_name,phone,phone_verified,sms_opt_in,whatsapp_opt_in').eq('id', order.user_id).maybeSingle();
  if (!profile) return { sent: false, error: 'The customer profile could not be found.' };
  const subject = 'Payment received · CareerBridge';
  const message = 'Hi ' + (profile.full_name || 'there') + ', your CareerBridge payment of ₹' + (Number(order.amount_paise) / 100).toFixed(2) + ' has been confirmed. Payment reference: ' + paymentId + '.';
  const eventKey = 'payment:' + paymentId + ':email';
  const service = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  if (!profile.email) return { sent: false, error: 'The customer has no email address on their profile.' };
  const { data: authUser } = await service.auth.admin.getUserById(profile.id);
  if (!authUser.user?.email_confirmed_at) return { sent: false, error: 'The customer email address is not verified.' };
  const apiKey = Deno.env.get('RESEND_API_KEY'), sender = Deno.env.get('RESEND_FROM');
  if (!apiKey || !sender) return { sent: false, error: 'Resend email delivery is not configured.' };

  const { data: existing } = await admin.from('notification_log').select('id,status').eq('user_id', profile.id).eq('channel', 'email').eq('event_key', eventKey).maybeSingle();
  if (existing?.status === 'sent' || existing?.status === 'delivered') return { sent: true, duplicate: true };
  if (existing?.status === 'queued') return { sent: false, pending: true, error: 'The confirmation email is already queued.' };
  let logId = existing?.id;
  if (logId) {
    const { error } = await admin.from('notification_log').update({ status: 'queued', error_code: null, updated_at: new Date().toISOString() }).eq('id', logId);
    if (error) return { sent: false, error: 'The confirmation email could not be queued.' };
  } else {
    const { data: log, error } = await admin.from('notification_log').insert({ user_id: profile.id, channel: 'email', event_key: eventKey, reference_id: paymentId, provider: 'resend', status: 'queued' }).select('id').maybeSingle();
    if (error || !log?.id) return { sent: false, error: 'The confirmation email could not be queued.' };
    logId = log.id;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: sender, to: [profile.email], subject, text: message + (appUrl ? '\\n\\n' + appUrl : '') }),
    });
    const result = await response.json().catch(() => ({}));
    await admin.from('notification_log').update({ status: response.ok ? 'sent' : 'failed', provider_message_id: result.id ?? null, error_code: response.ok ? null : 'provider_rejected', updated_at: new Date().toISOString() }).eq('id', logId);
    return response.ok ? { sent: true } : { sent: false, error: 'Resend rejected the confirmation email.' };
  } catch {
    await admin.from('notification_log').update({ status: 'failed', error_code: 'provider_unavailable', updated_at: new Date().toISOString() }).eq('id', logId);
    return { sent: false, error: 'Resend could not be reached to send the confirmation email.' };
  }
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
  const testKeyId = Deno.env.get('RAZORPAY_KEY_ID');
  if (Deno.env.get('RAZORPAY_MODE') !== 'test' || !testKeyId?.startsWith('rzp_test_')) {
    return out({ error: 'Payments are disabled unless Razorpay test mode is configured with an rzp_test_ API key.' }, 503);
  }

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
      const { data: order } = await admin.from('payment_orders').select('*').eq('provider', 'razorpay').eq('provider_order_id', providerOrderId).maybeSingle();
      if (!order) return out({ error: 'Payment order not found' }, 404);
      const amount = Number(payment?.amount ?? orderEntity?.amount);
      const currency = String(payment?.currency ?? orderEntity?.currency ?? order.currency);
      if (!Number.isFinite(amount) || amount !== Number(order.amount_paise) || currency !== order.currency) {
        await admin.from('audit_logs').insert({ action: 'payment.amount_mismatch', entity_type: 'payment_order', entity_id: order.id, details: { event_id: eventId, event_type: eventType } });
        await admin.from('payment_events').update({ processed_at: new Date().toISOString() }).eq('provider_event_id', eventId);
        return out({ received: true, review_required: true });
      }
      if (eventType === 'payment.captured' || eventType === 'order.paid') {
        const verifiedPaymentId = paymentId ?? order.provider_payment_id;
        const update = await admin.from('payment_orders').update({
          status: 'awaiting_admin', provider_payment_id: verifiedPaymentId, failure_reason: null,
        }).eq('id', order.id).not('status', 'in', '(paid,refunded,partially_refunded)').select('*').maybeSingle();
        if (update.error) return out({ error: 'Payment state could not be updated' }, 500);
      } else if (eventType === 'payment.failed') {
        if (!['paid','awaiting_admin','refunded','partially_refunded'].includes(order.status)) {
          const failed = await admin.from('payment_orders').update({ status: 'failed', provider_payment_id: paymentId, failure_reason: String(payment?.error_description ?? payment?.error_reason ?? 'Payment failed').slice(0, 240) }).eq('id', order.id);
          if (failed.error) return out({ error: 'Failed payment state could not be saved' }, 500);
        }
      } else {
        await admin.from('payment_orders').update({ status: 'refunded', provider_payment_id: paymentId ?? order.provider_payment_id, refunded_at: new Date().toISOString() }).eq('id', order.id);
      }
    }
    const marked = await admin.from('payment_events').update({ processed_at: new Date().toISOString() }).eq('provider_event_id', eventId);
    if (marked.error) return out({ error: 'Payment event could not be marked processed' }, 500);
    return out({ received: true });
  }

  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return out({ error: 'Sign in required' }, 401);
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) return out({ error: 'Invalid session' }, 401);
  if (body.action === 'admin_confirm_payment') {
    if (user.app_metadata?.role !== 'admin') return out({ error: 'Administrator access required' }, 403);
    const paymentOrderId = String(body.payment_order_id ?? '');
    if (!paymentOrderId) return out({ error: 'Payment order ID is required' }, 400);
    const { data: order, error: orderError } = await admin.from('payment_orders').select('*').eq('id', paymentOrderId).eq('provider', 'razorpay').maybeSingle();
    if (orderError || !order) return out({ error: 'Payment order not found' }, 404);
    if (!['awaiting_admin','paid'].includes(order.status)) return out({ error: 'Only provider-confirmed payments can be approved by an administrator.' }, 409);

    if (order.status === 'awaiting_admin') {
      const keyId = Deno.env.get('RAZORPAY_KEY_ID'), keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
      if (!keyId || !keySecret) return out({ error: 'Razorpay test credentials are not configured.' }, 503);
      const verifyUrl = order.provider_payment_id
        ? 'https://api.razorpay.com/v1/payments/' + encodeURIComponent(order.provider_payment_id)
        : 'https://api.razorpay.com/v1/orders/' + encodeURIComponent(order.provider_order_id) + '/payments';
      const providerResponse = await fetch(verifyUrl, {
        headers: { Authorization: 'Basic ' + btoa(keyId + ':' + keySecret) },
      });
      if (!providerResponse.ok) return out({ error: 'Could not verify this payment with Razorpay.' }, 502);
      const providerData = await providerResponse.json();
      const providerPayment = order.provider_payment_id ? providerData : (providerData.items ?? []).find((item: any) => item.order_id === order.provider_order_id && item.status === 'captured' && Number(item.amount) === Number(order.amount_paise) && item.currency === order.currency);
      if (!providerPayment) return out({ error: 'Razorpay has not captured a matching payment for this order yet.' }, 409);
      if (providerPayment.order_id !== order.provider_order_id || Number(providerPayment.amount) !== Number(order.amount_paise) || providerPayment.currency !== order.currency) {
        await admin.from('audit_logs').insert({ actor_id: user.id, action: 'payment.admin_confirmation_mismatch', entity_type: 'payment_order', entity_id: order.id });
        return out({ error: 'Razorpay payment details do not match this order.' }, 409);
      }
      if (providerPayment.status !== 'captured') return out({ error: 'Razorpay has not captured this payment yet. The order remains unconfirmed.' }, 409);
      const now = new Date().toISOString();
      const confirmed = await admin.from('payment_orders').update({ status: 'paid', paid_at: now, admin_confirmed_at: now, admin_confirmed_by: user.id, provider_payment_id: providerPayment.id, failure_reason: null })
        .eq('id', order.id).eq('status', 'awaiting_admin').select('*').maybeSingle();
      if (confirmed.error) return out({ error: 'The payment confirmation could not be saved.' }, 500);
      if (!confirmed.data) {
        const { data: current } = await admin.from('payment_orders').select('*').eq('id', order.id).maybeSingle();
        if (current?.status !== 'paid') return out({ error: 'The payment changed before it could be confirmed. Refresh and try again.' }, 409);
      }
      const { error: auditError } = await admin.from('audit_logs').insert({ actor_id: user.id, action: 'payment.admin_confirmed', entity_type: 'payment_order', entity_id: order.id, details: { provider_payment_id: providerPayment.id } });
      if (auditError) console.error('payment.audit_log_failed', { order_id: order.id });
    }
    const { data: confirmedOrder } = await admin.from('payment_orders').select('provider_payment_id').eq('id', order.id).maybeSingle();
    const paymentId = confirmedOrder?.provider_payment_id ?? order.provider_payment_id;
    if (!paymentId) return out({ confirmed: true, status: 'paid', emailSent: false, error: 'The payment is confirmed, but no payment reference is available to send the email.' });
    const email = await sendPaymentNotice(order, paymentId, admin, Deno.env.get('APP_URL') ?? '');
    return out({ confirmed: true, status: 'paid', emailSent: email.sent, emailPending: email.pending ?? false, error: email.sent ? undefined : email.error });
  }
  if (body.action === 'verify_checkout') {
    const orderId = String(body.razorpay_order_id ?? '');
    const paymentId = String(body.razorpay_payment_id ?? '');
    const signature = String(body.razorpay_signature ?? '');
    if (!orderId || !paymentId || !signature) return out({ error: 'Checkout verification fields are missing' }, 400);
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
    const keyId = Deno.env.get('RAZORPAY_KEY_ID');
    if (!keyId || !keySecret) return out({ error: 'Razorpay is not configured' }, 503);
    const { data: order } = await admin.from('payment_orders').select('*').eq('provider', 'razorpay').eq('provider_order_id', orderId).eq('user_id', user.id).maybeSingle();
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
    const providerStatus = providerPayment.status === 'captured' ? 'awaiting_admin' : providerPayment.status === 'authorized' ? 'authorized' : providerPayment.status === 'failed' ? 'failed' : 'pending';
    const update = await admin.from('payment_orders').update({
      status: providerStatus,
      provider_payment_id: paymentId, checkout_signature_verified: true,
      paid_at: order.paid_at,
      failure_reason: providerStatus === 'failed' ? String(providerPayment.error_description ?? 'Payment failed').slice(0, 240) : null,
    }).eq('id', order.id).neq('status', 'paid').neq('status', 'refunded').select('*').maybeSingle();
    if (update.error) return out({ error: 'Payment could not be reconciled' }, 500);
    const { data: currentOrder } = update.data ? { data: update.data } : await admin.from('payment_orders').select('status').eq('id', order.id).maybeSingle();
    return out({ verified: true, status: currentOrder?.status ?? providerStatus });
  }
  if (body.action !== 'create_order') return out({ error: 'Unsupported action' }, 400);
  const keyId = Deno.env.get('RAZORPAY_KEY_ID'), keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
  if (!keyId || !keySecret) return out({ error: 'Razorpay is not configured' }, 503);
  const amount = 49900; // Fixed demo price: INR 499.00; never client controlled.
  if (!Number.isSafeInteger(amount) || amount < 100) return out({ error: 'Invalid plan price' }, 500);
  const { count } = await admin.from('payment_orders').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());
  if ((count ?? 0) >= 5) return out({ error: 'Order limit reached. Try again later.' }, 429);
  const created = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST', headers: { Authorization: 'Basic ' + btoa(keyId + ':' + keySecret), 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, currency: 'INR', receipt: 'cb_' + crypto.randomUUID().replaceAll('-', '').slice(0, 20), notes: { product: 'CareerBridge Plus demo', mode: 'test' } }),
  });
  if (!created.ok) return out({ error: 'Payment provider could not create an order' }, 502);
  const providerOrder = await created.json();
  const { error: savedError } = await admin.from('payment_orders').insert({ user_id: user.id, provider: 'razorpay', provider_order_id: providerOrder.id, amount_paise: amount, currency: 'INR', status: 'created' });
  if (savedError) return out({ error: 'Order could not be saved' }, 500);
  return out({ order_id: providerOrder.id, amount: providerOrder.amount, currency: providerOrder.currency, key_id: keyId, name: 'CareerBridge', description: 'CareerBridge Plus demo · TEST PAYMENT ONLY', mode: 'test' });
});

