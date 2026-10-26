import { useCallback, useEffect, useState } from 'react';
import { ArrowUpRight, CircleAlert, CircleCheck, LoaderCircle, Pencil, RefreshCw, Save, ShieldCheck, WalletCards } from 'lucide-react';
import { supabase } from './lib/supabase';

const emptyPlan = { id: 'careerbridge-plus', name: 'CareerBridge Plus', description: '', amount: '499', features: '', active: true, sort_order: '1' };
const fromPlan = (plan) => ({ id: 'careerbridge-plus', name: plan.name || 'CareerBridge Plus', description: plan.description || '', amount: String(Number(plan.amount_paise || 0) / 100), features: (plan.features || []).join('\n'), active: plan.active !== false, sort_order: String(plan.sort_order ?? 1) });

export function AdminPlans({ profile }) {
  const [form, setForm] = useState(emptyPlan);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const refresh = useCallback(async () => {
    if (!supabase || profile?.role !== 'admin') return;
    setLoading(true); setError('');
    const { data, error: queryError } = await supabase.from('subscription_plans').select('*').eq('id', 'careerbridge-plus').maybeSingle();
    if (queryError) setError(queryError.message); else if (data) setForm(fromPlan(data));
    setLoading(false);
  }, [profile]);
  useEffect(() => { void refresh(); }, [refresh]);
  if (!profile || profile.role !== 'admin') return null;
  const change = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const save = async (event) => {
    event.preventDefault(); setSaving(true); setError(''); setNotice('');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('payments', { body: { action: 'admin_save_plan', id: 'careerbridge-plus', name: form.name, description: form.description, amount: Number(form.amount), features: form.features.split('\n').map(x => x.trim()).filter(Boolean), active: form.active, sort_order: Number(form.sort_order) } });
      if (invokeError) { let detail = invokeError.message; if (invokeError.context instanceof Response) detail = (await invokeError.context.clone().json().catch(() => null))?.error || detail; throw new Error(detail); }
      if (data?.error) throw new Error(data.error);
      setNotice('CareerBridge Plus was updated. Candidates will see the new price and benefits.');
      await refresh();
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'The payment option could not be saved.'); }
    finally { setSaving(false); }
  };
  return <section className="panel admin-panel admin-plans"><div className="panel-head"><div><span className="panel-kicker">PAYMENT OPTION</span><h3>CareerBridge Plus</h3></div><button className="btn btn-outline btn-sm" disabled={loading} onClick={() => void refresh()}><RefreshCw size={13}/> Refresh</button></div>
    <p className="input-hint">There is one candidate payment option. Set its one-time price, description, and benefits here.</p>
    {error && <div className="admin-alert error"><CircleAlert size={15}/>{error}</div>}{notice && <div className="admin-alert success"><CircleCheck size={15}/>{notice}</div>}
    {loading ? <div className="loading-inline"><LoaderCircle className="spin"/> Loading payment option…</div> : <form className="admin-plan-form" onSubmit={save}><div className="form-section-title"><span className="form-icon"><WalletCards size={17}/></span><div><b>Edit CareerBridge Plus</b><small>Changes apply to future checkouts.</small></div></div>
      <div className="form-grid"><label>Plan name<input required minLength="2" maxLength="80" value={form.name} onChange={e => change('name', e.target.value)}/></label><label>One-time price (INR)<input required type="number" min="1" step="1" value={form.amount} onChange={e => change('amount', e.target.value)}/></label><label className="wide">Description<input maxLength="300" value={form.description} onChange={e => change('description', e.target.value)}/></label><label className="wide">Benefits, one per line<textarea rows="4" maxLength="1000" value={form.features} onChange={e => change('features', e.target.value)} placeholder={'Browse active jobs and request referrals\nSave jobs and manage your profile'}/></label><label>Display order<input type="number" value={form.sort_order} onChange={e => change('sort_order', e.target.value)}/></label><label className="whatsapp-consent"><input type="checkbox" checked={form.active} onChange={e => change('active', e.target.checked)}/><span><b>Available to candidates</b><small>Hide the option temporarily without deleting it.</small></span></label></div>
      <div className="admin-plan-actions"><button className="btn btn-dark" disabled={saving}>{saving ? <LoaderCircle className="spin" size={15}/> : <Save size={15}/>} {saving ? 'Saving…' : 'Save payment option'} <ArrowUpRight size={14}/></button></div>
      <small className="input-hint"><ShieldCheck size={13}/> Razorpay test mode remains enabled. Existing payments keep their original amount.</small>
    </form>}
  </section>;
}
