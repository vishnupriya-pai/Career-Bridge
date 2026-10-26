import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Check, CheckCircle2, LoaderCircle, Mail, MessageCircle, RefreshCw, Send, ShieldCheck, WalletCards } from 'lucide-react';
import { supabase } from './lib/supabase';
const messageOf = (error) => error instanceof Error ? error.message : 'Something went wrong. Try again.';
const callAdmin = async (body) => {
    if (!supabase)
        throw new Error('Supabase is not connected.');
    const { data, error } = await supabase.functions.invoke('messaging-admin', { body });
    if (error)
        throw new Error(error.message);
    if (data?.error)
        throw new Error(data.error);
    return data;
};
export function AdminCampaigns({ profile }) {
    const [campaigns, setCampaigns] = useState([]);
    const [jobs, setJobs] = useState([]);
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [title, setTitle] = useState('');
    const [channel, setChannel] = useState('whatsapp');
    const [audience, setAudience] = useState('all');
    const [jobId, setJobId] = useState('');
    const [message, setMessage] = useState('');
    const [preview, setPreview] = useState(null);
    const refresh = useCallback(async () => {
        if (!profile || profile.role !== 'admin')
            return;
        setLoading(true);
        setError('');
        try {
            const [list, status, opportunities] = await Promise.all([callAdmin({ action: 'list' }), callAdmin({ action: 'config' }), supabase.from('jobs').select('id,title,company,location,salary,experience,status,kind').eq('status', 'active').eq('kind', 'job').order('created_at', { ascending: false }).limit(100)]);
            setCampaigns(list.campaigns ?? []);
            setConfig(status);
            if (opportunities.error) throw opportunities.error;
            setJobs(opportunities.data ?? []);
        }
        catch (e) {
            setError(messageOf(e));
        }
        finally {
            setLoading(false);
        }
    }, [profile]);
    useEffect(() => { void refresh(); }, [refresh]);
    const preflight = async () => {
        setBusy(true);
        setError('');
        setNotice('');
        try {
            const result = await callAdmin({ action: 'preview', channel, audience });
            setPreview(result.eligible);
            setNotice(result.capped ? 'Preview is capped at 1,000 eligible profiles.' : 'Audience preview is ready.');
        }
        catch (e) {
            setError(messageOf(e));
        }
        finally {
            setBusy(false);
        }
    };
    const create = async (event) => {
        event.preventDefault();
        setBusy(true);
        setError('');
        setNotice('');
        try {
            const result = await callAdmin({ action: 'create', title, channel, audience, message, jobId: jobId || null });
            setCampaigns((old) => [result.campaign, ...old]);
            setTitle('');
            setMessage('');
            setJobId('');
            setPreview(null);
            setNotice('Draft saved. Nothing has been sent yet.');
        }
        catch (e) {
            setError(messageOf(e));
        }
        finally {
            setBusy(false);
        }
    };
    const run = async (campaign, action) => {
        if (action === 'launch' && !window.confirm('Send this campaign to ' + campaign.total_recipients + ' opted-in recipients? This sends real messages.'))
            return;
        if (action === 'retry_failed' && !window.confirm('Retry the failed recipients for this campaign?'))
            return;
        setBusy(true);
        setError('');
        setNotice('');
        try {
            const result = await callAdmin({ action, campaignId: campaign.id });
            setCampaigns((old) => old.map((item) => item.id === campaign.id ? result.campaign : item));
            setNotice(result.remaining ? 'Sent the next batch. ' + result.remaining + ' recipients remain; continue to send the next batch.' : 'Campaign batch finished. Status: ' + result.campaign.status + '.');
        }
        catch (e) {
            setError(messageOf(e));
        }
        finally {
            setBusy(false);
        }
    };
    if (!profile || profile.role !== 'admin')
        return <div className="empty-state"><ShieldCheck /><h2>Administrator access required</h2><p>Sign in with an administrator account to manage campaigns.</p></div>;
    return <div className="content-page admin-messaging">
    <div className="page-heading"><div><div className="eyebrow">MESSAGING CONTROL</div><h1>Careful, <em>useful updates.</em></h1><p>Build an opted-in audience, review the draft, and confirm before any campaign sends.</p></div><button className="btn btn-outline btn-sm" onClick={() => void refresh()} disabled={loading}><RefreshCw size={14}/> Refresh</button></div>
    <div className="integration-health">
      <span className={config?.sms || config?.smsTest ? 'health-on' : 'health-off'}><i />SMS {config?.sms ? 'configured' : config?.smsTest ? 'trial test only' : 'needs setup'}</span>
      <span className={config?.whatsapp ? 'health-on' : 'health-off'}><i />WhatsApp {config?.whatsapp ? 'configured' : 'needs setup'}</span>
      <span className={config?.razorpay ? 'health-on' : 'health-off'}><i />Razorpay {config?.razorpay ? 'configured' : 'needs setup'} · {config?.mode ?? 'unknown'} mode</span>
    </div>
    {error && <div className="admin-alert error"><AlertCircle size={16}/>{error}</div>}
    {notice && <div className="admin-alert success"><CheckCircle2 size={16}/>{notice}</div>}
    <form className="panel campaign-form" onSubmit={create}>
      <div className="panel-head"><div><span className="panel-kicker">NEW CAMPAIGN DRAFT</span><h3>Reach candidates about a role</h3></div><MessageCircle size={18}/></div>
      <div className="form-grid">
        <label>Campaign name<input required minLength={3} maxLength={120} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Graduate engineer openings"/></label>
        <label>Job opportunity<select value={jobId} onChange={e => { const selected = jobs.find(job => job.id === e.target.value); setJobId(e.target.value); if (selected) { if (!title.trim()) setTitle('New opportunity: ' + selected.title); if (!message.trim()) setMessage(`${selected.title} at ${selected.company} · ${selected.location}${selected.salary ? ' · ' + selected.salary : ''}. View and apply on CareerBridge: ${window.location.origin}/jobs/${selected.id}`); } }}><option value="">General job opportunities</option>{jobs.map(job => <option key={job.id} value={job.id}>{job.title} · {job.company}</option>)}</select></label>
        <label>Channel<select value={channel} onChange={e => { setChannel(e.target.value); setPreview(null); }}><option value="whatsapp">WhatsApp</option><option value="sms">SMS</option></select></label>
        <label>Audience<select value={audience} onChange={e => { setAudience(e.target.value); setPreview(null); }}><option value="all">All opted-in candidates</option><option value="fresher">Freshers</option><option value="experienced">Experienced candidates</option></select></label>
        <label className="wide">Message text<textarea required maxLength={1200} rows={4} value={message} onChange={e => setMessage(e.target.value)} placeholder="Write a concise role update. WhatsApp text is sent as variable 1 in your configured approved template."/></label>
      </div>
      <div className="campaign-form-actions"><span>{message.length}/1200 characters · only candidates with saved consent and a valid phone are included</span><button type="button" className="btn btn-outline" onClick={() => void preflight()} disabled={busy}><ShieldCheck size={15}/>{busy ? 'Working…' : 'Preview audience'}</button><button className="btn btn-dark" disabled={busy || !title.trim() || !message.trim()}><Send size={15}/>{busy ? 'Saving…' : 'Save draft'}</button></div>
      {preview !== null && <div className="audience-count"><b>{preview}</b> eligible {channel === 'whatsapp' ? 'WhatsApp' : 'SMS'} recipients in this preview.</div>}
      <p className="input-hint">Creating a draft never sends messages. Launch prompts for explicit confirmation. Twilio trial accounts can only reach verified testers and use preset SMS content; trial mode disables bulk SMS campaigns. India SMS requires the relevant sender and DLT template configuration.</p>
    </form>
    <section className="panel campaign-list"><div className="panel-head"><div><span className="panel-kicker">CAMPAIGN HISTORY</span><h3>Drafts and delivery progress</h3></div></div>
      {loading ? <div className="loading-inline"><LoaderCircle className="spin"/> Loading campaigns…</div> : campaigns.length ? campaigns.map(c => <article className="campaign-row" key={c.id}><div className="campaign-summary"><span className="campaign-channel">{c.channel === 'whatsapp' ? <MessageCircle size={16}/> : <WalletCards size={16}/>}</span><div><b>{c.title}</b><small>{c.channel.toUpperCase()} · {c.audience} · {new Date(c.created_at).toLocaleString()}</small></div></div><span className={'status-pill status-' + (c.status === 'completed' ? 'active' : c.status === 'failed' ? 'closed' : 'pending')}>{c.status}</span><div className="campaign-progress">{c.sent_count}/{c.total_recipients} sent · {c.failed_count} failed</div><div className="campaign-actions">{c.status === 'draft' && <button className="btn btn-dark btn-sm" disabled={busy || !config?.[c.channel]} onClick={() => void run(c, 'launch')}>Launch</button>}{c.status === 'sending' && <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => void run(c, 'continue')}>Send next batch</button>}{c.failed_count > 0 && <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => void run(c, 'retry_failed')}>Retry failures</button>}</div></article>) : <div className="empty-state compact-empty"><MessageCircle /><h3>No campaigns yet</h3><p>Create a draft after reviewing the opt-in audience.</p></div>}
    </section>
  </div>;
}
export function AdminPayments({ profile }) {
    const [payments, setPayments] = useState([]);
    const [emailStatus, setEmailStatus] = useState({});
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [busyId, setBusyId] = useState('');
    const [loading, setLoading] = useState(false);
    const refresh = useCallback(async () => {
        if (!profile || profile.role !== 'admin' || !supabase)
            return;
        setLoading(true);
        setError('');
        const { data, error: queryError } = await supabase.from('payment_orders').select('id,user_id,provider_order_id,provider_payment_id,amount_paise,currency,status,created_at,paid_at,profile:profiles(full_name,email)').order('created_at', { ascending: false }).limit(50);
        if (queryError)
            setError(queryError.message);
        else {
            setPayments((data ?? []));
            const paymentIds = (data ?? []).map(payment => payment.provider_payment_id).filter(Boolean);
            if (paymentIds.length) {
                const { data: emails, error: emailError } = await supabase.from('notification_log').select('reference_id,status').eq('channel', 'email').in('reference_id', paymentIds);
                if (emailError) setError(emailError.message);
                else setEmailStatus(Object.fromEntries((emails ?? []).map(item => [item.reference_id, item.status])));
            } else setEmailStatus({});
        }
        setLoading(false);
    }, [profile]);
    const confirmPayment = async (payment) => {
        setBusyId(payment.id);
        setError('');
        setNotice('');
        try {
            const { data, error: invokeError } = await supabase.functions.invoke('payments', { body: { action: 'admin_confirm_payment', payment_order_id: payment.id } });
            if (invokeError) {
                let detail = invokeError.message;
                if (invokeError.context instanceof Response) {
                    const payload = await invokeError.context.clone().json().catch(() => null);
                    detail = payload?.error || detail;
                }
                throw new Error(detail || 'Could not confirm this payment.');
            }
            if (data?.error) throw new Error(data.error);
            setNotice(data?.emailSent ? 'Payment confirmed. The customer confirmation email was sent.' : data?.emailPending ? 'Payment confirmed. The email is already queued.' : 'Payment confirmed, but the email was not sent: ' + (data?.error || 'check Resend configuration.'));
            await refresh();
        } catch (confirmError) {
            setError(confirmError instanceof Error ? confirmError.message : 'Could not confirm this payment.');
        } finally {
            setBusyId('');
        }
    };
    useEffect(() => { void refresh(); }, [refresh]);
    if (!profile || profile.role !== 'admin')
        return null;
    return <section className="panel admin-panel payment-ledger"><div className="panel-head"><div><span className="panel-kicker">RAZORPAY LEDGER</span><h3>Recent payment events</h3></div><button className="btn btn-outline btn-sm" disabled={loading} onClick={() => void refresh()}><RefreshCw size={13}/>Refresh</button></div>{error && <div className="admin-alert error"><AlertCircle size={15}/>{error}</div>}{notice && <div className="admin-alert success"><CheckCircle2 size={15}/>{notice}</div>}{loading ? <div className="loading-inline"><LoaderCircle className="spin"/> Loading payments…</div> : payments.length ? payments.map(p => <div className="payment-row" key={p.id}><div><b>{p.profile?.full_name || 'Candidate'} · {p.currency} {(p.amount_paise / 100).toFixed(2)}</b><small>{p.profile?.email || 'No email'} · {p.provider_payment_id || 'Awaiting provider payment'} · {new Date(p.created_at).toLocaleString()}</small></div><span className={'status-pill status-' + (p.status === 'paid' ? 'active' : p.status === 'failed' || p.status === 'refunded' ? 'closed' : 'pending')}>{p.status === 'awaiting_admin' ? 'Awaiting admin confirmation' : p.status}</span><div className="row-actions">{p.status === 'awaiting_admin' && <button className="btn btn-dark btn-sm" disabled={busyId === p.id} onClick={() => void confirmPayment(p)}>{busyId === p.id ? <LoaderCircle className="spin" size={14}/> : <Check size={14}/>} Confirm & email</button>}{p.status === 'paid' && emailStatus[p.provider_payment_id] !== 'sent' && emailStatus[p.provider_payment_id] !== 'delivered' && <button className="btn btn-outline btn-sm" disabled={busyId === p.id} onClick={() => void confirmPayment(p)}>{busyId === p.id ? <LoaderCircle className="spin" size={14}/> : <Mail size={14}/>} {emailStatus[p.provider_payment_id] === 'failed' ? 'Retry email' : 'Send email'}</button>}{p.status === 'paid' && ['sent','delivered'].includes(emailStatus[p.provider_payment_id]) && <span className="status-pill status-active">Email sent</span>}</div></div>) : <div className="empty-state compact-empty"><WalletCards /><h3>No payments recorded</h3><p>Candidate test payments appear here after Razorpay confirms capture.</p></div>}<p className="input-hint">Only Razorpay test payments are accepted. Review the candidate and provider reference before confirming; confirmation sends the customer an email.</p></section>;
}
