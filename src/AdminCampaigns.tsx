import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AlertCircle, CheckCircle2, LoaderCircle, MessageCircle, RefreshCw, Send, ShieldCheck, WalletCards } from 'lucide-react';
import { supabase } from './lib/supabase';
import type { Profile } from './types';

type Campaign = {
  id: string; title: string; channel: 'sms' | 'whatsapp'; audience: string; message: string;
  status: string; total_recipients: number; sent_count: number; failed_count: number;
  created_at: string; completed_at: string | null;
};
type IntegrationStatus = { sms: boolean; whatsapp: boolean; razorpay: boolean; mode: string };
type Payment = {
  id: string; provider_order_id: string | null; provider_payment_id: string | null;
  amount_paise: number; currency: string; status: string; created_at: string; paid_at: string | null;
};
const messageOf = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Try again.';
const callAdmin = async (body: Record<string, unknown>) => {
  if (!supabase) throw new Error('Supabase is not connected.');
  const { data, error } = await supabase.functions.invoke('messaging-admin', { body });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
};

export function AdminCampaigns({ profile }: { profile: Profile | null }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [config, setConfig] = useState<IntegrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [title, setTitle] = useState('');
  const [channel, setChannel] = useState<'sms' | 'whatsapp'>('whatsapp');
  const [audience, setAudience] = useState('all');
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState<number | null>(null);
  const refresh = useCallback(async () => {
    if (!profile || profile.role !== 'admin') return;
    setLoading(true); setError('');
    try {
      const [list, status] = await Promise.all([callAdmin({ action: 'list' }), callAdmin({ action: 'config' })]);
      setCampaigns(list.campaigns ?? []); setConfig(status);
    } catch (e) { setError(messageOf(e)); } finally { setLoading(false); }
  }, [profile]);
  useEffect(() => { void refresh(); }, [refresh]);
  const preflight = async () => {
    setBusy(true); setError(''); setNotice('');
    try { const result = await callAdmin({ action: 'preview', channel, audience }); setPreview(result.eligible); setNotice(result.capped ? 'Preview is capped at 1,000 eligible profiles.' : 'Audience preview is ready.'); }
    catch (e) { setError(messageOf(e)); } finally { setBusy(false); }
  };
  const create = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const result = await callAdmin({ action: 'create', title, channel, audience, message });
      setCampaigns((old) => [result.campaign, ...old]); setTitle(''); setMessage(''); setPreview(null);
      setNotice('Draft saved. Nothing has been sent yet.');
    } catch (e) { setError(messageOf(e)); } finally { setBusy(false); }
  };
  const run = async (campaign: Campaign, action: 'launch' | 'continue' | 'retry_failed') => {
    if (action === 'launch' && !window.confirm('Send this campaign to ' + campaign.total_recipients + ' opted-in recipients? This sends real messages.')) return;
    if (action === 'retry_failed' && !window.confirm('Retry the failed recipients for this campaign?')) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await callAdmin({ action, campaignId: campaign.id });
      setCampaigns((old) => old.map((item) => item.id === campaign.id ? result.campaign : item));
      setNotice(result.remaining ? 'Sent the next batch. ' + result.remaining + ' recipients remain; continue to send the next batch.' : 'Campaign batch finished. Status: ' + result.campaign.status + '.');
    } catch (e) { setError(messageOf(e)); } finally { setBusy(false); }
  };
  if (!profile || profile.role !== 'admin') return <div className="empty-state"><ShieldCheck/><h2>Administrator access required</h2><p>Sign in with an administrator account to manage campaigns.</p></div>;
  return <div className="content-page admin-messaging">
    <div className="page-heading"><div><div className="eyebrow">MESSAGING CONTROL</div><h1>Careful, <em>useful updates.</em></h1><p>Build an opted-in audience, review the draft, and confirm before any campaign sends.</p></div><button className="btn btn-outline btn-sm" onClick={()=>void refresh()} disabled={loading}><RefreshCw size={14}/> Refresh</button></div>
    <div className="integration-health">
      <span className={config?.sms?'health-on':'health-off'}><i/>SMS {config?.sms?'configured':'needs setup'}</span>
      <span className={config?.whatsapp?'health-on':'health-off'}><i/>WhatsApp {config?.whatsapp?'configured':'needs setup'}</span>
      <span className={config?.razorpay?'health-on':'health-off'}><i/>Razorpay {config?.razorpay?'configured':'needs setup'} · {config?.mode??'unknown'} mode</span>
    </div>
    {error&&<div className="admin-alert error"><AlertCircle size={16}/>{error}</div>}
    {notice&&<div className="admin-alert success"><CheckCircle2 size={16}/>{notice}</div>}
    <form className="panel campaign-form" onSubmit={create}>
      <div className="panel-head"><div><span className="panel-kicker">NEW CAMPAIGN DRAFT</span><h3>Reach candidates about a role</h3></div><MessageCircle size={18}/></div>
      <div className="form-grid">
        <label>Campaign name<input required minLength={3} maxLength={120} value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Graduate engineer openings"/></label>
        <label>Channel<select value={channel} onChange={e=>{setChannel(e.target.value as 'sms'|'whatsapp');setPreview(null);}}><option value="whatsapp">WhatsApp</option><option value="sms">SMS</option></select></label>
        <label>Audience<select value={audience} onChange={e=>{setAudience(e.target.value);setPreview(null);}}><option value="all">All opted-in candidates</option><option value="fresher">Freshers</option><option value="experienced">Experienced candidates</option></select></label>
        <label className="wide">Message text<textarea required maxLength={1200} rows={4} value={message} onChange={e=>setMessage(e.target.value)} placeholder="Write a concise role update. WhatsApp text is sent as variable 1 in your configured approved template."/></label>
      </div>
      <div className="campaign-form-actions"><span>{message.length}/1200 characters · only candidates with saved consent and a valid phone are included</span><button type="button" className="btn btn-outline" onClick={()=>void preflight()} disabled={busy}><ShieldCheck size={15}/>{busy?'Working…':'Preview audience'}</button><button className="btn btn-dark" disabled={busy||!title.trim()||!message.trim()}><Send size={15}/>{busy?'Saving…':'Save draft'}</button></div>
      {preview!==null&&<div className="audience-count"><b>{preview}</b> eligible {channel==='whatsapp'?'WhatsApp':'SMS'} recipients in this preview.</div>}
      <p className="input-hint">Creating a draft never sends messages. Launch prompts for explicit confirmation. Twilio trial accounts can only reach joined/verified testers and approved trial content. India SMS requires the relevant sender and DLT template configuration.</p>
    </form>
    <section className="panel campaign-list"><div className="panel-head"><div><span className="panel-kicker">CAMPAIGN HISTORY</span><h3>Drafts and delivery progress</h3></div></div>
      {loading?<div className="loading-inline"><LoaderCircle className="spin"/> Loading campaigns…</div>:campaigns.length?campaigns.map(c=><article className="campaign-row" key={c.id}><div className="campaign-summary"><span className="campaign-channel">{c.channel==='whatsapp'?<MessageCircle size={16}/>:<WalletCards size={16}/>}</span><div><b>{c.title}</b><small>{c.channel.toUpperCase()} · {c.audience} · {new Date(c.created_at).toLocaleString()}</small></div></div><span className={'status-pill status-'+(c.status==='completed'?'active':c.status==='failed'?'closed':'pending')}>{c.status}</span><div className="campaign-progress">{c.sent_count}/{c.total_recipients} sent · {c.failed_count} failed</div><div className="campaign-actions">{c.status==='draft'&&<button className="btn btn-dark btn-sm" disabled={busy||!config?.[c.channel]} onClick={()=>void run(c,'launch')}>Launch</button>}{c.status==='sending'&&<button className="btn btn-outline btn-sm" disabled={busy} onClick={()=>void run(c,'continue')}>Send next batch</button>}{c.failed_count>0&&<button className="btn btn-outline btn-sm" disabled={busy} onClick={()=>void run(c,'retry_failed')}>Retry failures</button>}</div></article>):<div className="empty-state compact-empty"><MessageCircle/><h3>No campaigns yet</h3><p>Create a draft after reviewing the opt-in audience.</p></div>}
    </section>
  </div>;
}

export function AdminPayments({ profile }: { profile: Profile | null }) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const refresh = useCallback(async () => {
    if (!profile || profile.role !== 'admin' || !supabase) return;
    setLoading(true); setError('');
    const { data, error: queryError } = await supabase.from('payment_orders').select('id,provider_order_id,provider_payment_id,amount_paise,currency,status,created_at,paid_at').order('created_at',{ascending:false}).limit(50);
    if (queryError) setError(queryError.message); else setPayments((data ?? []) as Payment[]);
    setLoading(false);
  }, [profile]);
  useEffect(() => { void refresh(); }, [refresh]);
  if (!profile || profile.role !== 'admin') return null;
  return <section className="panel admin-panel payment-ledger"><div className="panel-head"><div><span className="panel-kicker">RAZORPAY LEDGER</span><h3>Recent payment events</h3></div><button className="btn btn-outline btn-sm" disabled={loading} onClick={()=>void refresh()}><RefreshCw size={13}/>Refresh</button></div>{error&&<div className="admin-alert error"><AlertCircle size={15}/>{error}</div>}{loading?<div className="loading-inline"><LoaderCircle className="spin"/> Loading payments…</div>:payments.length?payments.map(p=><div className="payment-row" key={p.id}><div><b>{p.provider_order_id||'Order pending'}</b><small>{p.provider_payment_id||'Awaiting payment'} · {new Date(p.created_at).toLocaleString()}</small></div><b>{p.currency} {(p.amount_paise/100).toFixed(2)}</b><span className={'status-pill status-'+(p.status==='paid'?'active':p.status==='failed'||p.status==='refunded'?'closed':'pending')}>{p.status}</span></div>):<div className="empty-state compact-empty"><WalletCards/><h3>No payments recorded</h3><p>Verified orders will appear here after the payment ledger migration is applied.</p></div>}</section>;
}

