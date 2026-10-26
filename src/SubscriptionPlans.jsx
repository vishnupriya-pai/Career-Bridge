import { useCallback, useEffect, useState } from 'react';
import { ArrowUpRight, Check, CircleAlert, CircleCheck, Clock3, LoaderCircle, RefreshCw, ShieldCheck, Sparkles, WalletCards } from 'lucide-react';
import { supabase } from './lib/supabase';

const formatAmount = (paise) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(paise || 0) / 100);
const functionError = async (error) => { let detail = error?.message || 'Payment request failed.'; if (error?.context instanceof Response) detail = (await error.context.clone().json().catch(() => null))?.error || detail; return new Error(detail); };
function loadRazorpay() { return new Promise((resolve, reject) => { if (window.Razorpay) return resolve(window.Razorpay); const script = document.querySelector('script[data-razorpay-checkout]') || document.createElement('script'); script.src = 'https://checkout.razorpay.com/v1/checkout.js'; script.async = true; script.dataset.razorpayCheckout = 'true'; script.onload = () => window.Razorpay ? resolve(window.Razorpay) : reject(new Error('Razorpay Checkout did not initialize.')); script.onerror = () => reject(new Error('Could not load Razorpay Checkout.')); if (!script.parentNode) document.body.appendChild(script); }); }

export default function SubscriptionPlans({ profile }) {
  const [plan, setPlan] = useState(null);
  const [lastPayment, setLastPayment] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const refresh = useCallback(async () => {
    if (!supabase || profile?.role !== 'candidate') return;
    setLoading(true);
    const { data: planData, error: planError } = await supabase.from('subscription_plans').select('*').eq('id', 'careerbridge-plus').eq('active', true).maybeSingle();
    let paymentData = null, paymentError = null;
    if (!profile.id.startsWith('demo-')) {
      const result = await supabase.from('payment_orders').select('status,amount_paise,currency,provider_payment_id,created_at').eq('user_id', profile.id).eq('provider', 'razorpay').order('created_at', { ascending: false }).limit(1).maybeSingle();
      paymentData = result.data; paymentError = result.error;
    }
    if (planError || paymentError) { setMessage((planError || paymentError).message); setMessageType('error'); }
    else { setPlan(planData); setLastPayment(paymentData); }
    setLoading(false);
  }, [profile]);
  useEffect(() => { void refresh(); }, [refresh]);
  if (!profile || profile.role !== 'candidate') return null;
  const buy = async () => {
    if (!supabase || profile.id.startsWith('demo-')) { setMessage('Sign in with your candidate account to start a test payment.'); setMessageType('error'); return; }
    setBusy(true); setMessage('Creating a secure one-time test checkout…'); setMessageType('pending');
    try {
      const { data, error } = await supabase.functions.invoke('payments', { body: { action: 'create_order', plan_id: 'careerbridge-plus' } });
      if (error) throw await functionError(error);
      if (data?.error) throw new Error(data.error);
      if (!data?.order_id || !data?.key_id || data.mode !== 'test' || !Number.isSafeInteger(Number(data.amount))) throw new Error('The payment service is not configured for this one-time test checkout.');
      const Razorpay = await loadRazorpay();
      const checkout = new Razorpay({ key: data.key_id, order_id: data.order_id, amount: data.amount, currency: data.currency, name: data.name, description: data.description, prefill: { name: profile.full_name || '', email: profile.email || '' }, theme: { color: '#29584d' }, handler: async (payment) => {
        setMessage('Verifying the payment securely…'); setMessageType('pending');
        try {
          const { data: verified, error: verifyError } = await supabase.functions.invoke('payments', { body: { action: 'verify_checkout', razorpay_order_id: payment.razorpay_order_id, razorpay_payment_id: payment.razorpay_payment_id, razorpay_signature: payment.razorpay_signature } });
          if (verifyError) throw await functionError(verifyError);
          if (verified?.error) throw new Error(verified.error);
          if (verified?.status === 'awaiting_admin') { setMessage('Razorpay captured your test payment. It is waiting for admin approval; the confirmation email follows approval.'); setMessageType('success'); }
          else if (verified?.status === 'paid') { setMessage('Your payment has been confirmed. A confirmation email will follow.'); setMessageType('success'); }
          else { setMessage(`Payment status: ${verified?.status || 'pending'}. It is not confirmed until Razorpay verifies it and an administrator approves it.`); setMessageType('pending'); }
          await refresh();
        } catch (verifyError) { setMessage(verifyError instanceof Error ? verifyError.message : 'Could not verify this payment.'); setMessageType('error'); }
      }, modal: { ondismiss: () => { setMessage('Checkout closed. No payment has been marked as paid.'); setMessageType('pending'); } } });
      checkout.on('payment.failed', failure => { setMessage(failure?.error?.description || 'Razorpay test payment failed.'); setMessageType('error'); });
      setBusy(false); checkout.open();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not start the Razorpay checkout.'); setMessageType('error'); setBusy(false); }
  };
  const activeMembership = lastPayment?.status === 'paid';
  return <section className="subscription-section" aria-labelledby="payment-option-title">
    <div className="subscription-heading"><div><span className="panel-kicker">CAREERBRIDGE MEMBERSHIP</span><h2 id="payment-option-title">One simple payment option.</h2><p>A one-time CareerBridge Plus payment. Razorpay test mode only.</p></div><button className="btn btn-outline btn-sm" disabled={loading} onClick={() => void refresh()}><RefreshCw size={13}/> Refresh</button></div>
    {message && <div className={'admin-alert ' + (messageType === 'error' ? 'error' : 'success')} role="status">{messageType === 'error' ? <CircleAlert size={15}/> : messageType === 'pending' ? <Clock3 size={15}/> : <Check size={15}/>} {message}</div>}
    {loading ? <div className="loading-inline"><LoaderCircle className="spin"/> Loading payment option…</div> : plan ? <div className="subscription-grid single-payment-grid"><article className="subscription-card featured"><div className="subscription-card-top"><span className="subscription-plan-icon"><Sparkles size={17}/></span><span className="subscription-featured-tag">ONE-TIME PAYMENT</span></div><span className="panel-kicker">CAREERBRIDGE PLUS</span><h3>{plan.name}</h3><p className="subscription-description">{plan.description}</p><div className="subscription-price">{formatAmount(plan.amount_paise)}<small> one time</small></div><ul>{(plan.features || []).map((feature, i) => <li key={i}><Check size={14}/>{feature}</li>)}</ul>{activeMembership && <div className="subscription-current"><span><CircleCheck size={17}/></span><div><b>Payment confirmed</b><small>Your CareerBridge Plus payment has been approved.</small></div></div>}<button className="btn btn-dark full-btn" disabled={busy || activeMembership} onClick={() => void buy()}>{busy ? <LoaderCircle className="spin" size={15}/> : <WalletCards size={15}/>} {busy ? 'Preparing checkout…' : activeMembership ? 'Payment confirmed' : 'Pay once'} <ArrowUpRight size={14}/></button>{lastPayment && !activeMembership && <small className="payment-latest-status">Latest payment: {lastPayment.status} · {lastPayment.currency} {(Number(lastPayment.amount_paise) / 100).toFixed(2)}</small>}</article></div> : <div className="empty-state compact-empty"><Sparkles/><h3>No payment option is available</h3><p>The administrator can enable CareerBridge Plus from the admin dashboard.</p></div>}
    <small className="subscription-safety"><ShieldCheck size={13}/> Test mode only. After Razorpay verifies capture, an administrator reviews the payment and confirms it before the customer email is sent.</small>
  </section>;
}
