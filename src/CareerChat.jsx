import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Bot, BriefcaseBusiness, LoaderCircle, MessageCircle, RotateCcw, X } from 'lucide-react';
import { supabase } from './lib/supabase';

const welcome = {
  role: 'assistant',
  content: 'Hi! I can help you explore opportunities, applications, referrals, and your CareerBridge profile.',
};
const suggestions = ['How do I apply for a role?', 'Show me fresher opportunities', 'How do referrals work?'];

export default function CareerChat({ profile, onAuth }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([welcome]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, open, sending]);

  const send = async (value = draft) => {
    const content = value.trim();
    if (!content || sending) return;
    if (!profile) return;
    if (!supabase || String(profile.id).startsWith('demo-')) {
      setMessages((current) => [...current, { role: 'user', content }, { role: 'assistant', content: 'Chat is available after this site is connected to Supabase and the Gemini function is deployed.' }]);
      setDraft('');
      return;
    }

    const next = [...messages, { role: 'user', content }];
    setMessages(next);
    setDraft('');
    setSending(true);
    try {
      const conversation = next
        .filter((message) => message !== welcome)
        .slice(-8)
        .map((message) => ({ role: message.role === 'assistant' ? 'model' : 'user', content: message.content }));
      const { data, error } = await supabase.functions.invoke('career-chat', { body: { messages: conversation } });
      if (error) {
        let message = 'I could not connect just now. Please try again in a moment.';
        try {
          const payload = await error.context?.json();
          if (payload?.error) message = payload.error;
        } catch { /* Use the friendly fallback for network errors. */ }
        throw new Error(message);
      }
      if (typeof data?.answer !== 'string' || !data.answer.trim()) throw new Error('I could not form an answer just now. Please try again.');
      setMessages((current) => [...current, { role: 'assistant', content: data.answer.trim() }]);
    } catch (error) {
      setMessages((current) => [...current, { role: 'assistant', content: error instanceof Error ? error.message : 'I could not connect just now. Please try again.' }]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const reset = () => setMessages([welcome]);

  return <div className="career-chat-root">
    {open && <section className="career-chat-panel" aria-label="CareerBridge assistant" aria-live="polite">
      <header className="career-chat-header">
        <span className="career-chat-avatar"><Bot size={19}/></span>
        <span className="career-chat-heading"><b>CareerBridge assistant</b><small><i/> Here to help with your next step</small></span>
        <button type="button" className="career-chat-icon" onClick={reset} aria-label="Start a new chat" title="Start a new chat"><RotateCcw size={16}/></button>
        <button type="button" className="career-chat-icon" onClick={() => setOpen(false)} aria-label="Close chat"><X size={19}/></button>
      </header>
      <div className="career-chat-messages" ref={listRef}>
        {!profile ? <div className="career-chat-signin">
          <span className="career-chat-avatar large"><BriefcaseBusiness size={22}/></span>
          <b>Sign in to get help</b>
          <p>The assistant can help you find roles and understand the application process.</p>
          <button type="button" className="btn btn-dark" onClick={onAuth}>Sign in to continue</button>
        </div> : <>
          {messages.map((message, index) => <div key={`${index}-${message.role}`} className={`career-chat-message ${message.role === 'user' ? 'from-user' : 'from-assistant'}`}>
            {message.role === 'assistant' && <span className="career-chat-mini-avatar"><Bot size={14}/></span>}
            <p>{message.content}</p>
          </div>)}
          {messages.length === 1 && <div className="career-chat-suggestions"><span>TRY ASKING</span>{suggestions.map((suggestion) => <button type="button" key={suggestion} onClick={() => void send(suggestion)}>{suggestion}<ArrowUp size={13}/></button>)}</div>}
          {sending && <div className="career-chat-message from-assistant"><span className="career-chat-mini-avatar"><Bot size={14}/></span><p className="career-chat-thinking"><LoaderCircle size={15}/> Finding a helpful answer…</p></div>}
        </>}
      </div>
      {profile && <form className="career-chat-composer" onSubmit={(event) => { event.preventDefault(); void send(); }}>
        <label className="sr-only" htmlFor="career-chat-input">Ask the CareerBridge assistant</label>
        <textarea id="career-chat-input" ref={inputRef} value={draft} onChange={(event) => setDraft(event.target.value.slice(0, 1000))} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder="Ask about jobs, applications…" rows={1} maxLength={1000} disabled={sending}/>
        <button type="submit" disabled={sending || !draft.trim()} aria-label="Send message"><ArrowUp size={17}/></button>
      </form>}
      <div className="career-chat-note">Only public jobs are looked up. Don’t share passwords, OTPs, or sensitive personal details.</div>
    </section>}
    <button type="button" className={`career-chat-launcher ${open ? 'is-open' : ''}`} onClick={() => setOpen((value) => !value)} aria-label={open ? 'Close CareerBridge assistant' : 'Open CareerBridge assistant'}>
      {open ? <X size={22}/> : <><MessageCircle size={21}/><span>Ask CareerBridge</span></>}
    </button>
  </div>;
}
