import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, CheckCircle2, CircleAlert, CircleDollarSign, LoaderCircle, ShieldCheck, Sparkles, WalletCards, XCircle } from 'lucide-react';
import { supabase } from './lib/supabase';
import { DEMO_PAYMENT_PLAN, formatDemoAmount, getPaymentStatusLabel } from './lib/payment-demo';

function loadRazorpay() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve(window.Razorpay);
    const existing = document.querySelector('script[data-razorpay-checkout]');
    const script = existing || document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.dataset.razorpayCheckout = 'true';
    script.onload = () => window.Razorpay ? resolve(window.Razorpay) : reject(new Error('Razorpay Checkout did not initialize.'));
    script.onerror = () => reject(new Error('Could not load Razorpay Checkout. Check your internet connection and try again.'));
    if (!existing) document.body.appendChild(script);
  });
}

async function paymentFunctionError(error) {
  let detail = error?.message || 'Payment request failed.';
  if (error?.context instanceof Response) {
    const payload = await error.context.clone().json().catch(() => null);
    detail = payload?.error || detail;
  }
  return new Error(detail);
}

export default function PaymentDemoCard({ profile }) {
  const [busy, setBusy] = useState(false);
  const [paymentState, setPaymentState] = useState('idle');
  const [paymentMessage, setPaymentMessage] = useState('No payment has been attempted. Only Razorpay test mode is supported here. After Razorpay captures a test payment, an administrator reviews it and the customer receives an email confirmation.');
  const [orderId, setOrderId] = useState('');
  const handled = useRef(false);

  useEffect(() => {
    if (!supabase || !profile || profile.id.startsWith('demo-')) return undefined;
    let current = true;
    supabase.from('payment_orders').select('provider_order_id,status,amount_paise,currency,created_at').eq('user_id', profile.id).eq('provider', 'razorpay').order('created_at', { ascending: false }).limit(1).maybeSingle().then(({ data }) => {
      if (!current || !data) return;
      setPaymentState(data.status);
      setOrderId(data.provider_order_id || '');
      setPaymentMessage(data.status === 'paid'
        ? 'Your ₹499 test payment was confirmed by CareerBridge. The confirmation email is sent after admin review.'
        : data.status === 'awaiting_admin'
          ? 'Razorpay captured your test payment. It is waiting for administrator confirmation; the confirmation email will follow.'
          : 'Latest saved test order status: ' + data.status + '. Payment is not complete until Razorpay verifies it and an administrator confirms it.');
    }).catch(() => {});
    return () => { current = false; };
  }, [profile]);

  if (!profile || profile.role !== 'candidate') return null;

  const startPayment = async () => {
    if (!supabase || !profile || profile.id.startsWith('demo-')) {
      setPaymentState('error');
      setPaymentMessage('Sign in with your Supabase account to start a test payment. Local demo accounts cannot create payment orders.');
      return;
    }
    setBusy(true);
    setPaymentState('opening');
    setPaymentMessage('Creating a ₹499.00 INR test order…');
    setOrderId('');
    handled.current = false;
    try {
      const { data, error } = await supabase.functions.invoke('payments', { body: { action: 'create_order' } });
      if (error) throw await paymentFunctionError(error);
      if (!data?.order_id || !data?.key_id || data.mode !== 'test' || data.amount !== DEMO_PAYMENT_PLAN.amountPaise || data.currency !== DEMO_PAYMENT_PLAN.currency) {
        throw new Error(data?.error || 'The payment service is not configured for the ₹499 test plan.');
      }
      setOrderId(data.order_id);
      setPaymentMessage('Test order ' + data.order_id + ' created. Complete or cancel the test checkout to continue.');
      const Razorpay = await loadRazorpay();
      const checkout = new Razorpay({
        key: data.key_id,
        amount: data.amount,
        currency: data.currency,
        name: data.name,
        description: data.description,
        order_id: data.order_id,
        theme: { color: '#29584d' },
        modal: { ondismiss: () => {
          if (!handled.current) {
            handled.current = true;
            setPaymentState('cancelled');
            setPaymentMessage('Checkout was closed. No payment was marked as paid. You can try again.');
          }
        } },
        handler: async (payment) => {
          handled.current = true;
          setPaymentState('verifying');
          setPaymentMessage('Payment response received. Verifying its signature and status securely on the server…');
          try {
            const { data: verified, error: verifyError } = await supabase.functions.invoke('payments', { body: {
              action: 'verify_checkout',
              razorpay_order_id: payment.razorpay_order_id,
              razorpay_payment_id: payment.razorpay_payment_id,
              razorpay_signature: payment.razorpay_signature,
            } });
            if (verifyError) throw await paymentFunctionError(verifyError);
            const finalState = verified?.status || 'pending';
            setPaymentState(finalState);
            setPaymentMessage(finalState === 'awaiting_admin'
              ? 'Razorpay captured your test payment. An administrator must confirm it before your confirmation email is sent. Reference: ' + payment.razorpay_payment_id + '.'
              : finalState === 'paid'
                ? 'Your payment is confirmed by CareerBridge. A confirmation email will be sent to your verified address. Reference: ' + payment.razorpay_payment_id + '.'
                : finalState === 'failed'
                ? 'Razorpay confirmed that this test payment failed. You can try again.'
                : 'Razorpay returned “' + finalState + '”. The order remains unconfirmed until provider and administrator confirmation.');
          } catch (error) {
            setPaymentState('pending');
            setPaymentMessage((error?.message || 'Server verification is unavailable.') + ' The order remains unconfirmed until test webhook reconciliation.');
          }
        },
      });
      checkout.on('payment.failed', (failure) => {
        handled.current = true;
        setPaymentState('failed');
        setPaymentMessage(failure?.error?.description ? 'Test payment failed: ' + failure.error.description + '. No paid status is recorded.' : 'Test payment failed. No paid status is recorded. You can try again.');
      });
      setBusy(false);
      checkout.open();
    } catch (error) {
      setPaymentState('error');
      setPaymentMessage(error?.message || 'Could not start Razorpay test checkout. Check the Supabase test configuration.');
    } finally {
      setBusy(false);
    }
  };

  const StatusIcon = paymentState === 'paid' ? CheckCircle2 : ['failed', 'error'].includes(paymentState) ? XCircle : paymentState === 'cancelled' ? CircleAlert : ['opening', 'verifying'].includes(paymentState) ? LoaderCircle : ShieldCheck;
  return <section className="panel plan-card payment-demo-card" aria-labelledby="payment-demo-title">
    <div className="payment-demo-heading"><span className="plan-icon"><Sparkles /></span><span className="demo-payment-badge">DEMO — TEST PAYMENTS ONLY</span></div>
    <div className="payment-demo-content">
      <div className="panel-kicker">CAREERBRIDGE PLUS · DEMO CHECKOUT</div>
      <h3 id="payment-demo-title">More room to move.</h3>
      <p>Try the ₹499 test checkout without charging real money. Razorpay must confirm capture, then an administrator reviews the payment and sends your email confirmation.</p>
      <div className="payment-order-summary" aria-label="Payment order summary">
        <div><span><CircleDollarSign size={15}/>Order summary</span><b>{DEMO_PAYMENT_PLAN.name}</b></div>
        <div><span>One-time demo total</span><strong>{formatDemoAmount()}</strong></div>
        <small>INR · Test mode only · No real payment details</small>
      </div>
      <button className="btn btn-dark" disabled={busy} onClick={startPayment}>{busy ? <LoaderCircle className="spin" size={15}/> : <WalletCards size={15}/>} {busy ? 'Preparing test checkout…' : 'Pay Now'} <ArrowUpRight size={14}/></button>
      <div className={'payment-demo-status payment-status-' + paymentState} role="status" aria-live="polite">
        <StatusIcon size={15} className={['opening', 'verifying'].includes(paymentState) ? 'spin' : ''}/>
        <div><b>{getPaymentStatusLabel(paymentState)}</b><p>{paymentMessage}</p>{orderId && <small>Order ID: {orderId}</small>}</div>
      </div>
      <small className="payment-demo-safety"><ShieldCheck size={13}/> Test mode only. The server verifies payment details; an administrator must confirm before the payment is recorded as paid or an email is sent.</small>
    </div>
  </section>;
}
