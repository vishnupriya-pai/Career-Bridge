import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { Search, Bell, BriefcaseBusiness, Bookmark, UsersRound, LayoutDashboard, UserRound, Settings, Menu, X, MapPin, Clock3, ArrowUpRight, SlidersHorizontal, ChevronRight, GraduationCap, Building2, Sparkles, Plus, ShieldCheck, Check, Mail, LockKeyhole, CircleCheck, FileText, MessageCircle, Phone, Heart, TrendingUp, Eye, CircleUserRound } from 'lucide-react';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import * as db from './lib/data';
import { AdminPayments } from './AdminCampaigns';
import { AdminPlans } from './AdminPlans';
import SubscriptionPlans from './SubscriptionPlans';
import HomeLanding from './HomeLanding';
import CareerChat from './CareerChat';
const cx = (...v) => v.filter(Boolean).join(' ');
export default function App() {
    const [profile, setProfile] = useState(() => { try {
        return JSON.parse(localStorage.getItem('cb_session') || 'null');
    }
    catch {
        return null;
    } });
    const [jobs, setJobs] = useState([]);
    const [saved, setSaved] = useState([]);
    const [applications, setApplications] = useState([]);
    const [requests, setRequests] = useState([]);
    const [submittingJobs, setSubmittingJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState('');
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState('All roles');
    const [mobile, setMobile] = useState(false);
    const [authOpen, setAuthOpen] = useState(false);
    const [authMode, setAuthMode] = useState('login');
    const [authRole] = useState('candidate');
    const [detail, setDetail] = useState(null);
    const [applyingJob, setApplyingJob] = useState(null);
    const [resumeFile, setResumeFile] = useState(null);
    const [showJobForm, setShowJobForm] = useState(false);
    const nav = useNavigate();
    const notify = useCallback((s) => { setToast(s); setTimeout(() => setToast(''), 3200); }, []);
    const refresh = useCallback(async () => { setLoading(true); try {
        const all = profile && (profile.role === 'admin' || profile.role === 'coordinator') ? await db.getAllJobs() : await db.getJobs();
        setJobs(all);
        if (profile) {
            setSaved(await db.getSaved(profile.id));
            setApplications(await db.getApplications(profile.id));
            setRequests(await db.getReferralRequests(profile.id, profile.role));
        }
    }
    catch (e) {
        notify(e instanceof Error ? e.message : 'Could not load data.');
    }
    finally {
        setLoading(false);
    } }, [profile, notify]);
    useEffect(() => { if (!supabase)
        return; let mounted = true; let sessionVersion = 0; const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => { if (!session || event === 'SIGNED_OUT') {
        sessionVersion++;
        setProfile(null);
        localStorage.removeItem('cb_session');
        return;
    } if (event === 'PASSWORD_RECOVERY') {
        setAuthMode('reset');
        setAuthOpen(true);
    } if (event !== 'INITIAL_SESSION' && event !== 'SIGNED_IN' && event !== 'USER_UPDATED' && event !== 'PASSWORD_RECOVERY')
        return; const version = ++sessionVersion; window.setTimeout(() => { void db.getProfile(session.user.id, session.user.email || '').then(p => { if (!mounted || version !== sessionVersion)
        return; setProfile(p); localStorage.setItem('cb_session', JSON.stringify(p)); }).catch(e => { if (mounted && version === sessionVersion)
        notify(e instanceof Error ? e.message : 'Could not load your profile.'); }); }, 0); }); return () => { mounted = false; subscription.unsubscribe(); }; }, [notify]);
    useEffect(() => { void refresh(); }, [refresh]);
    const filtered = useMemo(() => jobs.filter(j => j.status === 'active' && (filter === 'All roles' || (filter === 'Referrals' ? j.kind === 'referral' : filter === 'Fresher' ? j.experience.toLowerCase().includes('fresh') : filter === 'Experienced' ? !j.experience.toLowerCase().includes('fresh') : true)) && `${j.title} ${j.company} ${j.location} ${j.skills.join(' ')}`.toLowerCase().includes(query.toLowerCase())), [jobs, filter, query]);
    const signOut = async () => { try {
        if (supabase) {
            const { error } = await supabase.auth.signOut({ scope: 'local' });
            if (error)
                throw error;
        }
        setProfile(null);
        localStorage.removeItem('cb_session');
        nav('/');
        notify('You have signed out.');
    }
    catch (e) {
        notify(e instanceof Error ? `Sign out failed: ${e.message}` : 'Sign out failed. Please try again.');
    } };
    const doSave = async (j) => { if (!profile) {
        setAuthOpen(true);
        return;
    } try {
        const added = await db.toggleSaved(profile.id, j.id);
        setSaved(s => added ? [...new Set([...s, j.id])] : s.filter(x => x !== j.id));
        notify(added ? 'Saved to your list' : 'Removed from saved jobs');
    }
    catch (e) {
        notify(e instanceof Error ? e.message : 'Unable to save job');
    } };
    const beginApply = (j) => { if (!profile) {
        setAuthOpen(true);
        return;
    } if (j.kind === 'referral') {
        void doApply(j);
        return;
    } setResumeFile(null); setApplyingJob(j); };
    const doApply = async (j, resume) => {
        if (!profile) {
            setAuthOpen(true);
            return;
        }
        const existingApplication = applications.find((item) => item.job_id === j.id);
        const alreadySubmitted = j.kind === 'referral' ? requests.some((item) => item.job_id === j.id) : Boolean(existingApplication);
        if (alreadySubmitted && (j.kind === 'referral' || existingApplication?.resume_path)) {
            notify(j.kind === 'referral' ? 'You have already requested a referral for this role.' : 'You have already applied for this role.');
            return;
        }
        if (submittingJobs.includes(j.id))
            return;
        setSubmittingJobs(current => [...current, j.id]);
        try {
            let notificationEventKey = '';
            let confirmationSubject = '';
            let confirmationMessage = '';
            if (j.kind === 'referral') {
                const message = window.prompt('Add a short note for the referrer (include a resume link if you have one):');
                if (!message)
                    return;
                const referralId = await db.requestReferral(profile.id, j.id, message);
                notificationEventKey = 'referral:' + referralId;
                setRequests(await db.getReferralRequests(profile.id, profile.role));
                confirmationSubject = `Referral request received: ${j.title}`;
                confirmationMessage = `Hi ${profile.full_name},\n\nYour referral request for ${j.title} at ${j.company} has been received. You can follow its progress in My Referrals.\n\nGood luck,\nCareerBridge`;
            }
            else {
                if (!resume)
                    throw new Error('Please attach your resume.');
                const applicationId = await db.applyJob(profile.id, j.id, resume);
                notificationEventKey = 'application:' + applicationId;
                setApplications(await db.getApplications(profile.id));
                setApplyingJob(null);
                setResumeFile(null);
                confirmationSubject = `Application received: ${j.title}`;
                confirmationMessage = `Hi ${profile.full_name},\n\nYour application for ${j.title} at ${j.company} has been received. You can track it in My Applications.\n\nGood luck,\nCareerBridge`;
            }
            const notSent = j.kind === 'referral' ? 'Request saved, but email could not be sent. Check Resend and your verified sender/recipient.' : 'Application saved, but email could not be sent. Check Resend and your verified sender/recipient.';
            if (!supabase || profile.id.startsWith('demo-')) {
                notify(j.kind === 'referral' ? 'Referral request saved. Email, WhatsApp, and SMS need connected providers.' : 'Application saved. Email, WhatsApp, and SMS need connected providers.');
                return;
            }
            let emailSent = false;
            try {
                const { error } = await supabase.functions.invoke('notify', { body: { channel: 'email', subject: confirmationSubject, message: confirmationMessage, event_key: notificationEventKey } });
                emailSent = !error;
            }
            catch {
                emailSent = false;
            }
            let whatsappSent = null;
            if (profile.whatsapp_opt_in && profile.phone) {
                try {
                    const { error } = await supabase.functions.invoke('notify', { body: { channel: 'whatsapp', subject: confirmationSubject, message: confirmationMessage, event_key: notificationEventKey } });
                    whatsappSent = !error;
                }
                catch {
                    whatsappSent = false;
                }
            }
            let smsSent = null;
            if (profile.sms_opt_in && profile.phone) {
                try {
                    const { error } = await supabase.functions.invoke('notify', { body: { channel: 'sms', subject: confirmationSubject, message: confirmationMessage, event_key: notificationEventKey } });
                    smsSent = !error;
                }
                catch {
                    smsSent = false;
                }
            }
            const item = j.kind === 'referral' ? 'Referral request' : 'Application';
            const delivered = [emailSent ? 'email' : null, whatsappSent === true ? 'WhatsApp' : null, smsSent === true ? 'SMS' : null].filter(Boolean);
            const failed = [whatsappSent === false ? 'WhatsApp' : null, smsSent === false ? 'SMS' : null].filter(Boolean);
            if (delivered.length)
                notify(item + ' saved. Confirmation sent by ' + delivered.join(', ') + '.' + (failed.length ? ' ' + failed.join(' and ') + ' delivery failed; check provider setup.' : ''));
            else
                notify(notSent + (failed.length ? ' ' + failed.join(' and ') + ' delivery failed; check provider setup.' : ''));
        }
        catch (e) {
            const code = e?.code;
            if (code === '23505') {
                if (j.kind === 'referral') {
                    try {
                        setRequests(await db.getReferralRequests(profile.id, profile.role));
                    }
                    catch { /* Keep the duplicate notice even if refresh fails. */ }
                }
                else {
                    try {
                        setApplications(await db.getApplications(profile.id));
                    }
                    catch { /* Keep the duplicate notice even if refresh fails. */ }
                }
                notify(j.kind === 'referral' ? 'You have already requested a referral for this role.' : 'You have already applied for this role.');
            }
            else {
                const message = e?.message;
                notify(message || 'Unable to submit. Please try again.');
            }
        }
        finally {
            setSubmittingJobs(current => current.filter(id => id !== j.id));
        }
    };
    const navLinks = profile?.role === 'admin' ? [['/admin', 'Overview', LayoutDashboard], ['/jobs', 'Job listings', BriefcaseBusiness], ['/referrals', 'Referrals', UsersRound], ['/profile', 'My profile', UserRound]] : profile?.role === 'coordinator' ? [['/dashboard', 'Overview', LayoutDashboard], ['/jobs', 'Explore jobs', BriefcaseBusiness], ['/referrals', 'Referral requests', UsersRound], ['/manage', 'Manage jobs', Settings], ['/profile', 'My profile', UserRound]] : [['/dashboard', 'Overview', LayoutDashboard], ['/jobs', 'Find jobs', BriefcaseBusiness], ['/referrals', 'Referrals', UsersRound], ['/saved', 'Saved jobs', Bookmark], ['/applications', 'My applications', FileText], ['/profile', 'My profile', UserRound]];
    return <div className="app-shell"><aside className={cx('sidebar', mobile && 'sidebar-open')}><div className="brand"><span className="brand-mark"><Sparkles size={19}/></span>career<span>bridge</span><button className="icon-btn close-menu" onClick={() => setMobile(false)}><X /></button></div><div className="side-label">WORKSPACE</div><nav>{navLinks.map(([to, label, Icon]) => <NavLink key={to} to={to} onClick={() => setMobile(false)} className={({ isActive }) => cx('nav-item', isActive && 'active')}><Icon size={18}/><span>{label}</span>{to === '/saved' && saved.length > 0 && <b className="count">{saved.length}</b>}</NavLink>)}</nav><div className="side-bottom"><div className="help-card"><span className="help-icon"><MessageCircle size={16}/></span><b>Need a hand?</b><p>Your next opportunity is closer than you think.</p><button onClick={() => notify('Reach us at hello@careerbridge.example')}>Get in touch <ArrowUpRight size={14}/></button></div>{profile ? <button className="user-mini" onClick={() => nav('/profile')}><span className="avatar">{profile.full_name.slice(0, 1)}</span><span className="user-mini-info"><b>{profile.full_name}</b><small>{profile.role === 'candidate' ? 'Candidate' : profile.role === 'admin' ? 'Administrator' : 'Coordinator'}</small></span><Settings size={16}/></button> : <button className="user-mini" onClick={() => setAuthOpen(true)}><span className="avatar"><UserRound size={17}/></span><span className="user-mini-info"><b>Welcome</b><small>Sign in to get started</small></span><ChevronRight size={16}/></button>}</div></aside>
 <main className="main-area"><header className="topbar"><button className="icon-btn mobile-menu" onClick={() => setMobile(true)}><Menu /></button><div className="breadcrumb">{profile ? <><span>Workspace</span><ChevronRight size={14}/><b>{locationLabel()}</b></> : <b>Career opportunities, made human.</b>}</div><div className="top-actions"><button className="icon-btn notification" onClick={() => notify(profile ? 'You’re all caught up.' : 'Sign in to view your updates.')} aria-label="Notifications"><Bell size={18}/><i /></button>{profile ? <><button className="top-avatar" onClick={() => nav('/profile')}>{profile.full_name.slice(0, 1)}</button><button className="btn btn-outline btn-sm" onClick={signOut}>Sign out</button></> : <button className="btn btn-dark btn-sm" onClick={() => setAuthOpen(true)}>Sign in</button>}</div></header>
 {isSupabaseConfigured === false && <div className="demo-banner"><Sparkles size={14}/> Demo preview · Changes stay in this browser until you connect Supabase.<button onClick={() => notify('Add your Supabase project URL and publishable key to .env, then run database migrations. See README.')}>Connect a database <ArrowUpRight size={13}/></button></div>}
 <div className="page-wrap"><Routes><Route path="/" element={<Landing jobs={jobs} loading={loading} onAuth={() => setAuthOpen(true)} onBrowse={() => nav('/jobs')}/>}/><Route path="/jobs" element={<Jobs jobs={filtered} query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} loading={loading} saved={saved} onSave={doSave} onDetail={setDetail}/>}/><Route path="/jobs/:id" element={<JobRoute jobs={jobs} onSave={doSave} onApply={beginApply} saved={saved} applications={applications} requests={requests} submittingJobs={submittingJobs}/>}/><Route path="/dashboard" element={profile?.role === 'coordinator' ? <CoordinatorDashboard profile={profile} jobs={jobs} requests={requests} onManage={() => nav('/manage')} onModerate={async (id, status) => { await db.changeReferralStatus(id, status); await refresh(); notify('Referral request updated.'); }} onAuth={() => setAuthOpen(true)}/> : <Dashboard profile={profile} jobs={jobs} saved={saved} applications={applications} onBrowse={() => nav('/jobs')} onAuth={() => setAuthOpen(true)}/>}/><Route path="/admin" element={<Admin profile={profile} jobs={jobs} requests={requests} onModerate={async (id, s) => { await db.moderateJob(id, s); await refresh(); notify('Job status updated.'); }} onRoleChange={async (id, role) => { if (!supabase)
        throw new Error('Role management is disabled in local demo mode.'); const { error } = await supabase.functions.invoke('admin-users', { body: { userId: id, role } }); if (error)
        throw error; notify('Role updated. The user must sign in again to refresh access.'); }} onSignIn={() => setAuthOpen(true)}/>}/><Route path="/referrals" element={<Referrals jobs={jobs} requests={requests} profile={profile} onApply={doApply} onModerate={async (id, s) => { await db.changeReferralStatus(id, s); await refresh(); notify('Request updated.'); }} onSignIn={() => setAuthOpen(true)}/>}/><Route path="/saved" element={<Saved jobs={jobs.filter(j => saved.includes(j.id))} onSave={doSave}/>}/><Route path="/applications" element={<Applications items={applications}/>}/><Route path="/profile" element={<ProfilePage profile={profile} onSave={async (p) => { try {
        const savedProfile = await db.saveProfile(p);
        setProfile(savedProfile ?? p);
        localStorage.setItem('cb_session', JSON.stringify(savedProfile ?? p));
        notify('Profile saved.');
        return true;
    }
    catch (e) {
        notify(e?.message || 'Unable to save profile');
        return false;
    } }} onSignIn={() => setAuthOpen(true)}/>}/><Route path="/manage" element={<Manage profile={profile} jobs={jobs} onCreate={async (j) => { await db.createJob(j); await refresh(); notify('Your listing is live.'); setShowJobForm(false); }} onToggle={() => setShowJobForm(v => !v)} showForm={showJobForm} onSignIn={() => setAuthOpen(true)}/>}/><Route path="*" element={<div className="empty-state"><h2>Page not found</h2><Link to="/">Return home</Link></div>}/></Routes></div>
 <footer className="footer"><span>© 2026 CareerBridge</span><span>Made for the next step in your career</span><div><a href="mailto:hello@careerbridge.example">Contact</a><button onClick={() => notify('Privacy policy will be configured for your deployment.')}>Privacy</button>{profile && <button onClick={signOut}>Sign out</button>}</div></footer></main><CareerChat profile={profile} onAuth={() => setAuthOpen(true)}/>{mobile && <div className="scrim" onClick={() => setMobile(false)}/>}{authOpen && <AuthModal />}{detail && <div className="detail-overlay"><div className="detail-modal"><button className="icon-btn detail-close" onClick={() => setDetail(null)}><X /></button><JobDetail job={detail} saved={saved.includes(detail.id)} onSave={() => doSave(detail)} onApply={() => beginApply(detail)} applications={applications} requests={requests} submitting={submittingJobs.includes(detail.id)}/></div></div>}{applyingJob && <div className="detail-overlay apply-overlay"><section className="panel resume-modal" role="dialog" aria-modal="true" aria-labelledby="resume-title"><button type="button" className="icon-btn resume-close" onClick={() => setApplyingJob(null)} aria-label="Close"><X /></button><span className="panel-kicker">ONE LAST STEP</span><h2 id="resume-title">Attach your resume</h2><p>Apply for <b>{applyingJob.title}</b> at {applyingJob.company}. Your resume will be shared only with the team managing this role.</p><form onSubmit={(event) => { event.preventDefault(); if (resumeFile)
        void doApply(applyingJob, resumeFile); }}><label className="resume-upload">Resume file<input type="file" required accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => setResumeFile(event.target.files?.[0] || null)}/><small>PDF, DOC, or DOCX · up to 10 MB</small></label>{resumeFile && <div className="resume-selected"><FileText size={16}/><span>{resumeFile.name}</span><button type="button" onClick={() => setResumeFile(null)}>Remove</button></div>}<div className="resume-actions"><button type="button" className="btn btn-outline" onClick={() => setApplyingJob(null)}>Cancel</button><button type="submit" className="btn btn-dark" disabled={!resumeFile || submittingJobs.includes(applyingJob.id)}>{submittingJobs.includes(applyingJob.id) ? 'Submitting…' : 'Submit application'} <ArrowUpRight size={15}/></button></div></form><small className="secure-note"><ShieldCheck size={15}/> Stored privately and visible only to you and authorized hiring staff.</small></section></div>}{toast && <div role="status" className="toast"><CircleCheck size={17}/>{toast}<button onClick={() => setToast('')}><X size={14}/></button></div>}</div>;
    function locationLabel() { const path = location.pathname.split('/')[1]; return { dashboard: 'Overview', jobs: 'Job listings', referrals: 'Referrals', saved: 'Saved jobs', applications: 'My applications', profile: 'My profile', admin: 'Admin dashboard', manage: 'Manage jobs' }[path] || 'Overview'; }
    function Landing({ jobs, loading, onAuth, onBrowse }) { return <HomeLanding jobs={jobs} loading={loading} onAuth={onAuth} onBrowse={onBrowse} onSearch={(term) => { setQuery(term); setFilter('All roles'); nav('/jobs'); }} onDetail={(job) => nav(`/jobs/${job.id}`)} onReferrals={() => { setQuery(''); setFilter('Referrals'); nav('/jobs'); }}/>; }
    function Jobs({ jobs, query, setQuery, filter, setFilter, loading, saved, onSave, onDetail }) { return <div className="content-page"><div className="page-heading"><div><div className="eyebrow">YOUR NEXT CHAPTER</div><h1>Find your <em>fit.</em></h1><p>Explore roles that match where you are — and where you’d like to go.</p></div><span className="result-pill"><BriefcaseBusiness size={14}/>{jobs.length} opportunities</span></div><div className="search-panel"><div className="search-input"><Search size={18}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Role, company, or skill" aria-label="Search jobs"/><kbd>⌘ K</kbd></div><div className="filter-select"><SlidersHorizontal size={16}/><select value={filter} onChange={e => setFilter(e.target.value)} aria-label="Filter opportunities"><option>All roles</option><option>Fresher</option><option>Experienced</option><option>Referrals</option></select></div><button className="btn btn-dark" onClick={() => { }}>Search <ArrowUpRight size={15}/></button></div><div className="chips">{['All roles', 'Fresher', 'Experienced', 'Referrals'].map(x => <button key={x} onClick={() => setFilter(x)} className={cx('chip', filter === x && 'selected')}>{x === 'Referrals' && <UsersRound size={13}/>} {x}</button>)}<span className="sort-label">Sorted by <b>Most relevant <ChevronRight size={13}/></b></span></div><div className="jobs-list">{loading ? <><div className="loading-card"/><div className="loading-card"/></> : jobs.length ? jobs.map((j) => <JobRow key={j.id} job={j} onClick={() => onDetail(j)} saved={saved.includes(j.id)} onSave={() => onSave(j)}/>) : <div className="empty-state"><span><Search /></span><h3>No opportunities found</h3><p>Try another role, skill, or filter to find a better match.</p><button className="btn btn-soft" onClick={() => { setQuery(''); setFilter('All roles'); }}>Clear filters</button></div>}</div></div>; }
    function Dashboard({ profile, jobs, saved, applications, onBrowse, onAuth }) { if (!profile)
        return <SignInPrompt onSignIn={onAuth}/>; return <div className="content-page"><div className="welcome-row"><div><div className="eyebrow">{new Date().getHours() < 12 ? 'A FRESH START TO YOUR DAY' : 'GOOD TO SEE YOU AGAIN'}</div><h1>Welcome back, <em>{profile.full_name.split(' ')[0]}.</em></h1><p>Small steps add up. Here’s what’s happening in your career journey.</p></div><span className="welcome-avatar">{profile.full_name.slice(0, 1)}</span></div><div className="stat-grid"><Stat icon={BriefcaseBusiness} label="Open opportunities" value={jobs.filter((j) => j.status === 'active').length} tone="peach"/><Stat icon={Bookmark} label="Saved for later" value={saved.length} tone="lavender"/><Stat icon={FileText} label="Applications sent" value={applications.length} tone="sage"/></div><div className="dash-columns"><section className="panel"><div className="panel-head"><div><span className="panel-kicker">PICKED FOR YOU</span><h3>Opportunities to explore</h3></div><button className="text-link" onClick={onBrowse}>See all <ArrowUpRight size={14}/></button></div>{jobs.filter((j) => j.status === 'active').slice(0, 3).map((j) => <JobRow key={j.id} job={j} onClick={() => location.href = `/jobs/${j.id}`} saved={saved.includes(j.id)} onSave={() => { }} compact/>)}<button className="btn btn-soft full-btn" onClick={onBrowse}>Explore all opportunities <ArrowUpRight size={15}/></button></section><section className="panel profile-nudge"><div className="nudge-top"><span className="nudge-icon"><Sparkles /></span><span className="nudge-pill">A LITTLE HEAD START</span></div><h3>Your profile opens doors.</h3><p>Add your skills and a little about yourself. It helps the right people find you.</p><div className="profile-progress"><span><i /></span><b>Profile starter</b><small>More detail helps you stand out</small></div><button className="btn btn-dark full-btn" onClick={() => nav('/profile')}>Complete your profile <ArrowUpRight size={15}/></button></section></div><div className="referral-banner"><span className="referral-banner-icon"><UsersRound /></span><div><b>Sometimes, it’s who you know.</b><p>Explore open referrals and ask someone to put in a good word.</p></div><button className="btn btn-dark" onClick={() => nav('/referrals')}>Browse referrals <ArrowUpRight size={15}/></button></div><SubscriptionPlans profile={profile}/></div>; }
    function CoordinatorDashboard({ profile, jobs, requests, onManage, onModerate, onAuth }) {
        const [jobStatus, setJobStatus] = useState('all');
        if (!profile) return <SignInPrompt onSignIn={onAuth}/>;
        if (profile.role !== 'coordinator') return <NoAccess />;
        const myJobs = jobs.filter(job => job.coordinator_id === profile.id);
        const counts = { active: myJobs.filter(job => job.status === 'active').length, pending: myJobs.filter(job => job.status === 'pending').length, closed: myJobs.filter(job => job.status === 'closed').length };
        const pendingRequests = requests.filter(request => request.status === 'pending');
        const reviewedRequests = requests.filter(request => request.status === 'accepted' || request.status === 'declined');
        const visibleJobs = jobStatus === 'all' ? myJobs : myJobs.filter(job => job.status === jobStatus);
        return <div className="content-page coordinator-dashboard">
            <div className="page-heading"><div><div className="eyebrow">COORDINATOR WORKSPACE</div><h1>Your hiring <em>overview.</em></h1><p>Manage your listings and respond to candidates who’ve asked for a referral.</p></div><button className="btn btn-dark" onClick={onManage}><Plus size={16}/> Post an opportunity</button></div>
            <div className="stat-grid coordinator-stat-grid"><Stat icon={BriefcaseBusiness} label="Your job listings" value={myJobs.length} tone="peach"/><Stat icon={CircleCheck} label="Active listings" value={counts.active} tone="sage"/><Stat icon={UsersRound} label="Requests to review" value={pendingRequests.length} tone="lavender"/><Stat icon={Check} label="Requests reviewed" value={reviewedRequests.length} tone="blue"/></div>
            <div className="coordinator-grid">
                <section className="panel coordinator-listings"><div className="panel-head"><div><span className="panel-kicker">YOUR OPPORTUNITIES</span><h3>Listings</h3></div><button className="text-link" onClick={onManage}>Manage listings <ArrowUpRight size={14}/></button></div>
                    <div className="coordinator-filters">{[['all','All',myJobs.length],['active','Active',counts.active],['pending','Pending',counts.pending],['closed','Closed',counts.closed]].map(([key,label,total]) => <button key={key} className={cx('chip', jobStatus === key && 'selected')} onClick={() => setJobStatus(key)}>{label} <b>{total}</b></button>)}</div>
                    {visibleJobs.length ? <div className="jobs-list">{visibleJobs.slice(0, 6).map(job => <JobRow key={job.id} job={job} onClick={() => nav(`/jobs/${job.id}`)} saved={false} onSave={() => {}} compact/>)}</div> : <Empty title={myJobs.length ? 'No listings in this status' : 'Your first listing starts here'} text={myJobs.length ? 'Choose another status to see your listings.' : 'Post an opportunity and keep its activity organized here.'} action={!myJobs.length ? 'Post an opportunity' : undefined} onAction={!myJobs.length ? onManage : undefined}/>}
                    {myJobs.length > 6 && <button className="btn btn-soft full-btn" onClick={onManage}>See all {myJobs.length} listings <ArrowUpRight size={14}/></button>}
                </section>
                <section className="panel coordinator-requests"><div className="panel-head"><div><span className="panel-kicker">CANDIDATE INTEREST</span><h3>Referral requests</h3></div><span className="chart-total">{pendingRequests.length} to review</span></div>
                    {pendingRequests.length ? pendingRequests.slice(0, 5).map(request => <div className="coordinator-request" key={request.id}><div className="request-person"><span className="company-avatar">{request.profiles?.full_name?.slice(0,1) || 'C'}</span><span className="moderate-info"><b>{request.profiles?.full_name || 'Candidate'}</b><small>{request.jobs?.title || myJobs.find(job => job.id === request.job_id)?.title || 'Your opportunity'}</small></span></div><p>{request.message || 'No message included.'}</p><div className="request-actions"><button className="btn btn-soft" onClick={() => onModerate(request.id, 'declined')}>Decline</button><button className="btn btn-dark" onClick={() => onModerate(request.id, 'accepted')}><Check size={14}/> Accept</button></div></div>) : <Empty title="No requests waiting" text="New candidate referral requests for your opportunities will appear here."/>}
                    {requests.length > 5 && <button className="text-link full-btn" onClick={() => nav('/referrals')}>View all requests <ArrowUpRight size={14}/></button>}
                </section>
            </div>
            <div className="referral-banner"><span className="referral-banner-icon"><Sparkles /></span><div><b>Keep your opportunities current.</b><p>Update a listing or add another role when your hiring needs change.</p></div><button className="btn btn-dark" onClick={onManage}>Manage listings <ArrowUpRight size={15}/></button></div>
        </div>;
    }
    function Admin({ profile, jobs, requests, onModerate, onRoleChange, onSignIn }) {
        const [people, setPeople] = useState({ candidates: 0, coordinators: 0, admins: 0 });
        const [selectedStatus, setSelectedStatus] = useState('all');
        const [selectedRole, setSelectedRole] = useState('candidates');
        const [countsError, setCountsError] = useState(false);
        useEffect(() => {
            let mounted = true;
            db.getAdminDashboardCounts().then(counts => { if (mounted) setPeople(counts); }).catch(() => { if (mounted) setCountsError(true); });
            return () => { mounted = false; };
        }, []);
        if (!profile) return <SignInPrompt onSignIn={onSignIn} role="admin"/>;
        if (profile.role !== 'admin') return <NoAccess />;
        const statusCounts = { active: jobs.filter(job => job.status === 'active').length, pending: jobs.filter(job => job.status === 'pending').length, closed: jobs.filter(job => job.status === 'closed').length };
        const pendingReferrals = requests.filter(request => request.status === 'pending').length;
        const filteredJobs = selectedStatus === 'all' ? jobs : jobs.filter(job => job.status === selectedStatus);
        const totalPeople = people.candidates + people.coordinators + people.admins;
        const roles = [{ key: 'candidates', label: 'Job seekers', value: people.candidates, color: '#2e765b' }, { key: 'coordinators', label: 'Recruiters / coordinators', value: people.coordinators, color: '#d49b54' }, { key: 'admins', label: 'Admins', value: people.admins, color: '#8a81bd' }];
        return <div className="content-page admin-dashboard">
            <div className="page-heading"><div><div className="eyebrow">CONTROL ROOM</div><h1>Admin <em>overview.</em></h1><p>Track your community and the opportunities they’re building.</p></div><span className="admin-badge"><ShieldCheck size={15}/> Administrator</span></div>
            <div className="stat-grid admin-stat-grid"><Stat icon={GraduationCap} label="Total job seekers" value={people.candidates} tone="sage"/><Stat icon={Building2} label="Recruiters / coordinators" value={people.coordinators} tone="lavender"/><Stat icon={BriefcaseBusiness} label="Total jobs posted" value={jobs.length} tone="peach"/><Stat icon={CircleCheck} label="Closed jobs" value={statusCounts.closed} tone="blue"/></div>
            {countsError && <p className="dashboard-note">Registered user totals could not be loaded. Check profile access policies and try refreshing.</p>}
            <section className="admin-attention"><div><span className="attention-icon"><Eye size={17}/></span><span><b>{statusCounts.pending + pendingReferrals} items need attention</b><small>{statusCounts.pending} job listings awaiting review · {pendingReferrals} referral requests awaiting follow-up</small></span></div><button className="btn btn-soft" onClick={() => nav('/referrals')}>Review referrals <ArrowUpRight size={14}/></button></section>
            <div className="admin-chart-grid">
                <section className="panel admin-chart-panel"><div className="panel-head"><div><span className="panel-kicker">JOB MARKETPLACE</span><h3>Listing status</h3></div><span className="chart-total">{jobs.length} total</span></div><div className="status-chart" role="group" aria-label="Filter jobs by status">{[{key:'active',label:'Active',color:'#397d60'}, {key:'pending',label:'Pending',color:'#d5a152'}, {key:'closed',label:'Closed',color:'#98a59c'}].map(item => <button key={item.key} className={cx('status-chart-item', selectedStatus === item.key && 'chosen')} onClick={() => setSelectedStatus(selectedStatus === item.key ? 'all' : item.key)} aria-pressed={selectedStatus === item.key}><span className="status-chart-label"><i style={{background:item.color}}/>{item.label}<b>{statusCounts[item.key]}</b></span><span className="status-track"><i style={{width:`${jobs.length ? Math.max(statusCounts[item.key] / jobs.length * 100, statusCounts[item.key] ? 3 : 0) : 0}%`,background:item.color}}/></span></button>)}</div><p className="chart-hint">Select a status to filter the job list below.</p></section>
                <section className="panel admin-chart-panel"><div className="panel-head"><div><span className="panel-kicker">COMMUNITY</span><h3>Registered members</h3></div><span className="chart-total">{totalPeople} total</span></div><div className="people-chart" role="group" aria-label="Registered members by role">{roles.map(item => <button key={item.key} className={cx('people-bar-item', selectedRole === item.key && 'chosen')} onClick={() => setSelectedRole(item.key)} aria-pressed={selectedRole === item.key}><span className="people-bar-value">{item.value}</span><span className="people-bar-track"><i style={{height:`${Math.max(totalPeople ? item.value / Math.max(...roles.map(role => role.value), 1) * 100 : 0, item.value ? 5 : 0)}%`,background:item.color}}/></span><span className="people-bar-label">{item.label}</span></button>)}</div><p className="chart-hint">{roles.find(item => item.key === selectedRole)?.label}: <b>{people[selectedRole]}</b>{countsError ? ' · totals unavailable' : ' registered'}</p></section>
            </div>
            <div className="panel admin-panel"><div className="panel-head"><div><span className="panel-kicker">MARKETPLACE HEALTH</span><h3>{selectedStatus === 'all' ? 'Listings and moderation' : `${selectedStatus} listings`}</h3></div><span className="live-status"><i /> System healthy</span></div>{filteredJobs.length ? filteredJobs.map((j) => <div className="moderate-row" key={j.id}><span className="company-avatar">{j.company.slice(0, 1)}</span><span className="moderate-info"><b>{j.title}</b><small>{j.company} · {j.location}</small></span><span className={cx('status-pill', `status-${j.status}`)}>{j.status}</span><div className="row-actions">{j.status !== 'active' && <button className="icon-btn approve" title="Approve" onClick={() => onModerate(j.id, 'active')}><Check size={16}/></button>}{j.status !== 'closed' && <button className="icon-btn remove" title="Close listing" onClick={() => onModerate(j.id, 'closed')}><X size={16}/></button>}</div></div>) : <p className="muted">No listings in this status.</p>}</div>
            <AdminPlans profile={profile}/><AdminPayments profile={profile}/><AdminUsers onRoleChange={onRoleChange} currentUserId={profile.id}/>
        </div>;
    }
    function AdminUsers({ onRoleChange, currentUserId }) { const [users, setUsers] = useState([]); const [loadingUsers, setLoadingUsers] = useState(true); useEffect(() => { db.getProfiles().then(setUsers).catch(e => notify(e.message)).finally(() => setLoadingUsers(false)); }, []); return <div className="panel admin-panel"><div className="panel-head"><div><span className="panel-kicker">ACCESS AND TEAM</span><h3>User role moderation</h3></div></div>{loadingUsers ? <p className="muted">Loading team…</p> : users.length ? users.map(user => <div className="moderate-row" key={user.id}><span className="company-avatar">{user.full_name?.slice(0, 1) || 'U'}</span><span className="moderate-info"><b>{user.full_name || 'New candidate'}</b><small>{user.email}</small></span><span className={`status-pill status-${user.role === 'admin' ? 'active' : 'pending'}`}>{user.role}</span><select aria-label={`Role for ${user.email}`} className="role-select" value={user.role} disabled={user.id === currentUserId} onChange={async (e) => { try {
        await onRoleChange(user.id, e.target.value);
        setUsers(old => old.map(x => x.id === user.id ? { ...x, role: e.target.value } : x));
    }
    catch (err) {
        notify(err instanceof Error ? err.message : 'Could not update role');
    } }}><option value="candidate">Candidate</option><option value="coordinator">Coordinator</option><option value="admin">Admin</option></select></div>) : <p className="muted">No users found.</p>}</div>; }
    function Referrals({ jobs, requests, profile, onModerate }) { const referrals = jobs.filter((j) => j.kind === 'referral' && j.status === 'active'); return <div className="content-page"><div className="page-heading"><div><div className="eyebrow">A LITTLE HELP GOES A LONG WAY</div><h1>Open a door. <em>Meet your people.</em></h1><p>Find people willing to make an introduction, and share what makes you a great fit.</p></div><span className="result-pill"><UsersRound size={15}/>{referrals.length} open referrals</span></div><div className="referral-intro"><span className="referral-intro-icon"><Heart size={22}/></span><div><b>A referral is a conversation, not a guarantee.</b><p>Be thoughtful, personal, and clear about why the role speaks to you. Your details are only shared when you send a request.</p></div></div><div className="jobs-list">{referrals.length ? referrals.map((j) => <JobRow key={j.id} job={j} onClick={() => setDetail(j)} saved={false} onSave={() => { }}/>) : <Empty title="No open referrals right now" text="Check back soon — new opportunities are added regularly."/>}</div>{requests.length > 0 && <section className="panel request-panel"><div className="panel-head"><div><span className="panel-kicker">YOUR CONNECTIONS</span><h3>Referral requests</h3></div></div>{requests.map((r) => <div className="moderate-row" key={r.id}><span className="company-avatar"><UsersRound size={16}/></span><span className="moderate-info"><b>{r.jobs?.title || jobs.find((j) => j.id === r.job_id)?.title || 'Referral request'}</b><small>{r.profiles?.full_name || 'Your request'} · {r.message || ''}</small></span><span className={cx('status-pill', r.status === 'accepted' ? 'status-active' : 'status-pending')}>{r.status}</span>{profile?.role === 'coordinator' && <div className="row-actions"><button className="icon-btn approve" title="Accept request" onClick={() => onModerate(r.id, 'accepted')}><Check size={16}/></button><button className="icon-btn remove" title="Decline request" onClick={() => onModerate(r.id, 'declined')}><X size={16}/></button></div>}</div>)}</section>}</div>; }
    function Saved({ jobs, onSave }) { return <div className="content-page"><div className="page-heading"><div><div className="eyebrow">KEEP THE GOOD ONES CLOSE</div><h1>Your saved <em>opportunities.</em></h1><p>A shortlist of roles you want to come back to.</p></div></div>{jobs.length ? <div className="jobs-list">{jobs.map((j) => <JobRow key={j.id} job={j} onClick={() => setDetail(j)} saved onSave={() => onSave(j)}/>)}</div> : <Empty title="Your shortlist starts here" text="Save a role that catches your eye and it’ll be here when you’re ready." action="Explore opportunities" onAction={() => nav('/jobs')}/>}</div>; }
    function Applications({ items }) { return <div className="content-page"><div className="page-heading"><div><div className="eyebrow">YOUR MOMENTUM</div><h1>Applications <em>in motion.</em></h1><p>Keep track of the steps you’ve taken so far.</p></div></div>{items.length ? <div className="panel">{items.map((a, i) => <div className="moderate-row" key={a.job_id + i}><span className="company-avatar">{(a.jobs?.company || 'J').slice(0, 1)}</span><span className="moderate-info"><b>{a.jobs?.title || 'Job application'}</b><small>{a.jobs?.company || 'Company'}</small>{a.resume_filename && <small>Resume attached: {a.resume_filename}</small>}</span><span className="status-pill status-active">Submitted</span>{!a.resume_path && a.jobs && <Link className="btn btn-soft btn-sm" to={`/jobs/${a.job_id}`}>Add resume</Link>}</div>)}</div> : <Empty title="Your next step starts with one application" text="Find a role that feels right and send your application when you’re ready." action="Find opportunities" onAction={() => nav('/jobs')}/>}</div>; }
    function WhatsAppPhoneVerification({ profile, phone }) { const [code, setCode] = useState(''); const [sent, setSent] = useState(false); const [verified, setVerified] = useState(Boolean(profile.phone_verified)); const [busy, setBusy] = useState(false); const [notice, setNotice] = useState(''); const [sandboxMode, setSandboxMode] = useState(false); useEffect(() => { setVerified(Boolean(profile.phone_verified) && profile.phone === phone); setSent(false); setCode(''); }, [profile.phone, profile.phone_verified, phone]); useEffect(() => { if (!supabase || profile.id.startsWith('demo-')) return; let active = true; void supabase.functions.invoke('whatsapp-otp', { body: { action: 'status' } }).then(({ data, error }) => { if (active && !error) setSandboxMode(data?.sandboxMode === true); }).catch(() => {}); return () => { active = false; }; }, [profile.id]); const act = async (action) => { if (!supabase || profile.id.startsWith('demo-')) { setNotice('Connect Supabase to verify a phone number.'); return; } if (!profile.phone || profile.phone !== phone) { setNotice('Save this phone number to your profile first.'); return; } setBusy(true); setNotice(''); try { const { data, error } = await supabase.functions.invoke('whatsapp-otp', { body: { action, ...(action === 'check' ? { code } : {}) } }); if (error) throw error; if (data?.error) throw new Error(data.error); if (action === 'send') { setSent(true); setNotice('Code sent to your WhatsApp.'); } else { setVerified(true); setSent(false); setNotice('Phone verified. You can now receive WhatsApp job alerts.'); } } catch (error) { let detail = error instanceof Error ? error.message : 'Could not verify this phone.'; if (error?.context instanceof Response) { const payload = await error.context.clone().json().catch(() => null); detail = payload?.error || detail; } setNotice(detail); } finally { setBusy(false); } }; return <div className="phone-verification"><div><b>WhatsApp phone verification</b><small>{verified ? 'Verified' : 'Verify your number to receive job alerts.'}</small></div>{sandboxMode ? <span className="status-pill status-pending">Trial test mode · OTP skipped</span> : verified ? <span className="status-pill status-active">Verified</span> : sent ? <><input aria-label="WhatsApp verification code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={event => setCode(event.target.value)} placeholder="6-digit code"/><button type="button" className="btn btn-outline btn-sm" disabled={busy || !code} onClick={() => void act('check')}>{busy ? 'Checking…' : 'Verify code'}</button></> : <button type="button" className="btn btn-outline btn-sm" disabled={busy || !phone} onClick={() => void act('send')}>{busy ? 'Sending…' : 'Send WhatsApp OTP'}</button>}{notice && <small role="status" className="verification-notice">{notice}</small>}</div>; }
    function ProfilePage({ profile, onSave, onSignIn }) { const [form, setForm] = useState(profile); const [messageBusy, setMessageBusy] = useState(false); const [profileSaving, setProfileSaving] = useState(false); useEffect(() => setForm(profile), [profile]); if (!profile || !form)
        return <SignInPrompt onSignIn={onSignIn}/>; const sendMessage = async (channel) => { if (profileSaving) { notify('Wait for the profile save to finish, then send your test.'); return; } if (channel === 'sms' || channel === 'whatsapp') {
        if (!form.phone) { notify('Add your phone number to Profile first.'); return; }
        if (form.phone !== profile.phone) { notify('Save your phone number before sending a test message.'); return; }
        const optedIn = channel === 'sms' ? profile.sms_opt_in : profile.whatsapp_opt_in;
        if (!optedIn) { notify(`Turn on ${channel === 'sms' ? 'SMS' : 'WhatsApp'} updates in Profile and save before testing.`); return; }
        // The OTP widget owns the most recent verification state. The profile
        // object may be stale until its next refresh, so let notify make the
        // authoritative server-side verification check and return its reason.
} if (!supabase || profile.id.startsWith('demo-')) {
        notify('Connect Supabase and configure the messaging provider to send real notifications.');
        return;
} setMessageBusy(true); try { const { data, error } = await supabase.functions.invoke('notify', { body: { channel, subject: 'A CareerBridge hello', message: 'Your CareerBridge profile is ready. Good luck with your next opportunity.' } }); if (error) { let detail = error.message || 'Notification failed.'; if (error.context instanceof Response) { const payload = await error.context.clone().json().catch(() => null); detail = payload?.error || detail; } const isFetchError = detail.includes('Failed to send a request'); notify(isFetchError ? 'Could not reach the messaging function. Check the connection and Supabase function deployment.' : detail); return; } if (data?.error) { notify(data.error); return; } if (!data?.sent) { notify(data?.pending ? 'Your message is still pending. Check the provider message log before retrying.' : 'The provider did not confirm sending the message. Check Edge Function logs.'); return; } notify(`${channel === 'whatsapp' ? 'WhatsApp' : channel.toUpperCase()} accepted the message for delivery.`); } catch (error) { notify(error instanceof Error ? error.message : 'Could not send the notification.'); } finally { setMessageBusy(false); } }; return <div className="content-page profile-page"><div className="page-heading"><div><div className="eyebrow">YOUR STORY, YOUR WAY</div><h1>Put your <em>best self</em> forward.</h1><p>A thoughtful profile helps the right opportunity find its way to you.</p></div></div><div className="panel form-panel"><div className="form-section-title"><span className="form-icon"><CircleUserRound /></span><div><b>About you</b><small>Start with the basics. You can always add more.</small></div></div><div className="form-grid"><label>Full name<input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })}/></label><label>Email address<input value={form.email} disabled/><small className="input-hint">{profile.id.startsWith('demo-') ? 'Demo account' : 'Email verified through secure sign-in'}</small></label><label>Phone number<input placeholder="+91 98765 43210" value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })}/></label><label className="whatsapp-consent wide"><input type="checkbox" checked={form.whatsapp_opt_in ?? false} onChange={e => setForm({ ...form, whatsapp_opt_in: e.target.checked })}/><span><b>WhatsApp updates (optional)</b><small>I agree to receive new job opportunity alerts and application updates from CareerBridge on WhatsApp. I can turn this off any time.</small></span></label><label className="whatsapp-consent wide"><input type="checkbox" checked={form.sms_opt_in ?? false} onChange={e => setForm({ ...form, sms_opt_in: e.target.checked })}/><span><b>SMS updates (optional)</b><small>I agree to receive application and referral updates from CareerBridge by SMS. Message and data rates may apply. I can turn this off any time.</small></span></label><label>Location<input placeholder="City, country" value={form.location || ''} onChange={e => setForm({ ...form, location: e.target.value })}/></label><label className="wide">Headline<input placeholder="e.g. Aspiring product designer · Open to work" value={form.headline || ''} onChange={e => setForm({ ...form, headline: e.target.value })}/></label><label className="wide">Skills <input placeholder="Separate skills with commas" value={(form.skills || []).join(', ')} onChange={e => setForm({ ...form, skills: e.target.value.split(',').map(x => x.trim()).filter(Boolean) })}/><small className="input-hint">Add skills that match the roles you’re interested in.</small></label></div><button className="btn btn-dark" disabled={profileSaving} onClick={async () => { setProfileSaving(true); try { await onSave(form); } finally { setProfileSaving(false); } }}>{profileSaving ? 'Saving…' : 'Save profile'} <Check size={15}/></button></div><div className="profile-extras"><WhatsAppPhoneVerification profile={profile} phone={form.phone}/><section className="panel"><div className="form-section-title"><span className="form-icon"><MessageCircle /></span><div><b>Delivery check</b><small>Send a test update to your own verified contact details.</small></div></div><div className="integration-actions"><button className="btn btn-outline" disabled={messageBusy || profileSaving} onClick={() => sendMessage('email')}><Mail size={15}/> Email</button><button className="btn btn-outline" disabled={messageBusy || profileSaving} onClick={() => sendMessage('sms')}><Phone size={15}/> SMS</button><button className="btn btn-outline" disabled={messageBusy || profileSaving} onClick={() => sendMessage('whatsapp')}><MessageCircle size={15}/> WhatsApp</button></div><small className="input-hint">Email verification is sent by Supabase Auth during sign up. WhatsApp and SMS require a saved SMS or WhatsApp opt-in, and Twilio sender setup. Save your profile before testing. WhatsApp normally requires one-time phone verification; the Twilio WhatsApp trial test mode skips it for your own delivery check. Twilio trial SMS can only reach verified recipients and uses preset content. WhatsApp uses your approved Twilio Content template.</small></section></div><div className="privacy-note"><ShieldCheck size={17}/><span><b>Your information stays yours.</b> Your contact details are never shown publicly.</span></div></div>; }
    function Manage({ profile, jobs, onCreate, onToggle, showForm, onSignIn }) { const [form, setForm] = useState({ title: '', company: '', location: '', type: 'Full-time', experience: 'Fresher', salary: '', description: '', skills: '', kind: 'job' }); const ownJobs = jobs.filter(job => job.coordinator_id === profile?.id); if (!profile)
        return <SignInPrompt onSignIn={onSignIn} role="coordinator"/>; if (profile.role === 'candidate')
        return <NoAccess />; return <div className="content-page"><div className="page-heading"><div><div className="eyebrow">COORDINATOR SPACE</div><h1>Make a good <em>match.</em></h1><p>Share the openings you’re hiring for and review interested candidates.</p></div><button className="btn btn-dark" onClick={onToggle}><Plus size={16}/> Post an opportunity</button></div>{showForm && <div className="panel form-panel"><div className="panel-head"><div><span className="panel-kicker">NEW LISTING</span><h3>Tell us about the role</h3></div><button className="icon-btn" onClick={onToggle}><X /></button></div><div className="form-grid"><label>Job title<input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Frontend Engineer"/></label><label>Company<input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })}/></label><label>Location<input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}/></label><label>Experience<select value={form.experience} onChange={e => setForm({ ...form, experience: e.target.value })}><option>Fresher</option><option>1–3 years</option><option>3–5 years</option><option>5+ years</option></select></label><label>Salary range<input value={form.salary} onChange={e => setForm({ ...form, salary: e.target.value })} placeholder="₹10–15 LPA"/></label><label>Opportunity type<select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}><option>Full-time</option><option>Part-time</option><option>Contract</option><option>Internship</option></select></label><label>Opportunity listing<select value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })}><option value="job">Job</option><option value="referral">Referral opportunity</option></select></label><label className="wide">Skills<input value={form.skills} onChange={e => setForm({ ...form, skills: e.target.value })} placeholder="React, TypeScript, CSS"/></label><label className="wide">Role description<textarea rows={4} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}/></label></div><button className="btn btn-dark" disabled={!form.title || !form.company} onClick={() => onCreate({ ...form, skills: form.skills.split(',').map((x) => x.trim()).filter(Boolean), kind: form.kind, status: 'active', coordinator_id: profile.id })}>Publish listing <ArrowUpRight size={15}/></button></div>}<div className="panel"><div className="panel-head"><div><span className="panel-kicker">YOUR MARKETPLACE</span><h3>Listings and referrals</h3></div></div>{ownJobs.length ? ownJobs.map((j) => <JobRow key={j.id} job={j} onClick={() => nav(`/jobs/${j.id}`)} saved={false} onSave={() => { }}/>) : <p className="muted">You haven’t posted any opportunities yet.</p>}</div></div>; }
    function JobRoute({ jobs, onSave, onApply, saved, applications, requests, submittingJobs }) { const { id } = useParams(); const j = jobs.find((x) => x.id === id); if (!j)
        return <Empty title="This role has moved on" text="Explore current opportunities to find something that fits." action="Browse jobs" onAction={() => nav('/jobs')}/>; return <JobDetail job={j} saved={saved.includes(j.id)} onSave={() => onSave(j)} onApply={() => onApply(j)} applications={applications} requests={requests} submitting={submittingJobs.includes(j.id)}/>; }
    function JobCard({ job, onClick }) { return <button className="job-card" onClick={onClick}><div className="job-card-top"><span className="company-avatar">{job.company.slice(0, 1)}</span><span className={cx('kind-tag', job.kind === 'referral' && 'ref-tag')}>{job.kind === 'referral' ? <UsersRound size={12}/> : <BriefcaseBusiness size={12}/>} {job.kind === 'referral' ? 'Referral' : 'Full-time'}</span></div><h3>{job.title}</h3><div className="company-line">{job.company} <span>·</span> <MapPin size={13}/>{job.location.split(',')[0]}</div><div className="job-card-foot"><span>{job.salary}</span><span>{job.posted}</span></div></button>; }
    function JobRow({ job, onClick, saved, onSave, compact }) { return <article className={cx('job-row', compact && 'compact')}><button className="company-avatar" onClick={onClick}>{job.company.slice(0, 1)}</button><div className="job-row-main" onClick={onClick} role="button" tabIndex={0}><div className="job-title-line"><h3>{job.title}</h3><span className={cx('kind-tag', job.kind === 'referral' && 'ref-tag')}>{job.kind === 'referral' ? <UsersRound size={12}/> : <BriefcaseBusiness size={12}/>} {job.kind === 'referral' ? 'Referral' : job.experience}</span></div><div className="job-meta"><span><Building2 size={14}/>{job.company}</span><span><MapPin size={14}/>{job.location}</span><span><Clock3 size={14}/>{job.posted}</span></div><div className="skill-tags">{job.skills.slice(0, 4).map((s) => <span key={s}>{s}</span>)}</div></div><div className="job-row-end"><b>{job.salary || 'Salary not listed'}</b><span>{job.type}</span><div><button className={cx('icon-btn save-btn', saved && 'saved')} title={saved ? 'Remove saved job' : 'Save job'} onClick={onSave}><Bookmark size={17} fill={saved ? 'currentColor' : 'none'}/></button><button className="btn btn-soft btn-sm" onClick={onClick}>View role <ArrowUpRight size={14}/></button></div></div></article>; }
    function JobDetail({ job, saved, onSave, onApply, applications = [], requests = [], submitting = false }) { const existingApplication = applications.find((application) => application.job_id === job.id); const alreadySubmitted = job.kind === 'referral' ? requests.some((request) => request.job_id === job.id) : Boolean(existingApplication); const missingResume = job.kind !== 'referral' && alreadySubmitted && !existingApplication?.resume_path; return <div className="detail-page"><button className="back-link" onClick={() => nav(-1)}>← Back to opportunities</button><div className="detail-grid"><article className="panel detail-main"><div className="detail-company"><span className="company-avatar large">{job.company.slice(0, 1)}</span><span><b>{job.company}</b><small>{job.kind === 'referral' ? 'Community referral' : 'Verified opportunity'}</small></span><button className={cx('icon-btn save-btn', saved && 'saved')} onClick={onSave} aria-label="Save job"><Bookmark fill={saved ? 'currentColor' : 'none'}/></button></div><div className="eyebrow">{job.kind === 'referral' ? 'A CONNECTION TO EXPLORE' : 'A ROLE TO MAKE YOUR OWN'}</div><h1>{job.title}</h1><div className="detail-meta"><span><MapPin />{job.location}</span><span><BriefcaseBusiness />{job.experience}</span><span><Clock3 />{job.posted}</span></div><div className="detail-divider"/><h3>About this opportunity</h3><p>{job.description}</p><h3>What you’ll bring</h3><div className="skill-tags detail-skills">{job.skills.map((s) => <span key={s}>{s}</span>)}</div>{job.kind === 'referral' && <div className="referral-intro detail-ref"><span className="referral-intro-icon"><Heart /></span><div><b>Make it personal.</b><p>Tell the referrer why you’re interested and what makes you a thoughtful candidate.</p></div></div>}</article><aside className="panel apply-card"><span className="panel-kicker">A STEP TOWARD SOMETHING NEW</span><h3>{job.kind === 'referral' ? 'Ask for an introduction' : 'Ready when you are.'}</h3><p>{job.kind === 'referral' ? 'Send a short note and start a conversation about this role.' : 'Take a moment to review your profile before sending in your application.'}</p><div className="salary-box"><small>COMPENSATION</small><b>{job.salary || 'Not listed'}</b></div><button className="btn btn-dark full-btn" onClick={onApply} disabled={(alreadySubmitted && !missingResume) || submitting}>{submitting ? 'Submitting…' : missingResume ? 'Add resume to application' : alreadySubmitted ? (job.kind === 'referral' ? 'Referral requested' : 'Already applied') : job.kind === 'referral' ? 'Request a referral' : 'Apply for this role'} <ArrowUpRight size={15}/></button><button className="btn btn-outline full-btn" onClick={onSave}><Bookmark size={15}/>{saved ? 'Saved' : 'Save for later'}</button><div className="secure-note"><ShieldCheck size={15}/> Your information is shared securely.</div></aside></div></div>; }
    function Stat({ icon: Icon, label, value, tone }) { return <div className="stat-card"><span className={`stat-icon ${tone}`}><Icon size={18}/></span><span className="stat-copy"><small>{label}</small><b>{value}</b></span><span className="stat-spark">✳</span></div>; }
    function Empty({ title, text, action, onAction }) { return <div className="empty-state"><span className="empty-icon"><Sparkles /></span><h3>{title}</h3><p>{text}</p>{action && <button className="btn btn-dark" onClick={onAction}>{action} <ArrowUpRight size={14}/></button>}</div>; }
    function SignInPrompt({ onSignIn, role = 'candidate' }) { return <div className="auth-prompt"><span className="prompt-icon"><LockKeyhole /></span><div className="eyebrow">A SPACE THAT’S YOURS</div><h1>Sign in to keep<br /><em>moving forward.</em></h1><p>{role === 'candidate' ? 'Your dashboard, shortlist, and applications will be waiting for you.' : 'Sign in with your authorized staff account to continue.'}</p><button className="btn btn-dark" onClick={onSignIn}>Sign in or create account <ArrowUpRight size={15}/></button><span className="secure-note"><ShieldCheck size={15}/> Your account is always yours.</span></div>; }
    function NoAccess() { return <Empty title="This space is for another role" text="Your account doesn’t have permission to view this area." action="Return to your dashboard" onAction={() => nav('/dashboard')}/>; }
    function AuthModal() {
        const [mode, setMode] = useState(authMode);
        const [role, setRole] = useState(authRole);
        const [email, setEmail] = useState('');
        const [password, setPassword] = useState('');
        const [confirmPassword, setConfirmPassword] = useState('');
        const [name, setName] = useState('');
        const [busy, setBusy] = useState(false);
        const [message, setMessage] = useState('');
        const [error, setError] = useState('');
        const changeMode = (next) => { setMode(next); setMessage(''); setError(''); if (next === 'login' || next === 'signup' || next === 'reset')
            setAuthMode(next); };
        const submit = async (e) => {
            e.preventDefault();
            setError('');
            setMessage('');
            setBusy(true);
            try {
                if (mode !== 'reset' && !email.includes('@'))
                    throw new Error('Enter a valid email address.');
                if (mode === 'forgot') {
                    if (!supabase)
                        throw new Error('Password reset requires a connected Supabase account.');
                    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
                    if (error)
                        throw error;
                    setMessage('If an account uses this email, a password reset link has been sent. Check your inbox and spam folder.');
                    return;
                }
                if (mode === 'reset') {
                    if (password.length < 8)
                        throw new Error('Choose a password with at least 8 characters.');
                    if (password !== confirmPassword)
                        throw new Error('The passwords do not match.');
                    if (!supabase)
                        throw new Error('Password reset requires a connected Supabase account.');
                    const { error } = await supabase.auth.updateUser({ password });
                    if (error)
                        throw error;
                    setPassword('');
                    setConfirmPassword('');
                    setAuthMode('login');
                    setAuthOpen(false);
                    notify('Your password has been updated.');
                    return;
                }
                if (password.length < 8)
                    throw new Error('Enter a password with at least 8 characters.');
                if (supabase) {
                    if (mode === 'signup') {
                        if (role !== 'candidate')
                            throw new Error('Staff accounts are created by your administrator. Choose candidate sign up.');
                        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name }, emailRedirectTo: window.location.origin } });
                        if (error)
                            throw error;
                        if (data.session) {
                            const p = await db.getProfile(data.user.id, email);
                            setProfile(p);
                        }
                        else {
                            setMessage('Check your inbox for a verification link. Your account is ready once you verify your email.');
                            return;
                        }
                    }
                    else {
                        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
                        if (error)
                            throw error;
                        const p = await db.getProfile(data.user.id, email);
                        if (p.role !== role) {
                            await supabase.auth.signOut({ scope: 'local' });
                            setProfile(null);
                            localStorage.removeItem('cb_session');
                            const accountRole = p.role === 'admin' ? 'administrator' : p.role;
                            throw new Error(`This email is registered as a ${accountRole} account. Select ${accountRole} or sign in with a candidate account.`);
                        }
                        setProfile(p);
                    }
                    setAuthOpen(false);
                    nav('/dashboard');
                    notify(mode === 'signup' ? 'Welcome to CareerBridge!' : 'Welcome back.');
                }
                else {
                    const p = db.demoLogin(email, password, role);
                    setProfile(p);
                    setAuthOpen(false);
                    nav(role === 'admin' ? '/admin' : role === 'coordinator' ? '/manage' : '/dashboard');
                    notify('Welcome to CareerBridge demo.');
                }
            }
            catch (e) {
                setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
            }
            finally {
                setBusy(false);
            }
        };
        const title = mode === 'signup' ? <>Create a <em>little momentum.</em></> : mode === 'forgot' ? <>Reset your <em>password.</em></> : mode === 'reset' ? <>Choose a <em>new password.</em></> : <>Welcome <em>back.</em></>;
        const subtitle = mode === 'signup' ? 'One thoughtful step can change everything.' : mode === 'forgot' ? 'We’ll email you a secure link to reset your password.' : mode === 'reset' ? 'Choose a new password for your CareerBridge account.' : 'Pick up right where you left off.';
        return <div className="modal-backdrop" onClick={() => setAuthOpen(false)}><div className="auth-modal" onClick={e => e.stopPropagation()}><button className="icon-btn modal-close" onClick={() => setAuthOpen(false)} aria-label="Close"><X /></button><span className="brand-mark"><Sparkles size={18}/></span><div className="eyebrow">{mode === 'signup' ? 'YOUR NEXT CHAPTER' : mode === 'forgot' || mode === 'reset' ? 'ACCOUNT RECOVERY' : 'GOOD TO HAVE YOU BACK'}</div><h2>{title}</h2><p className="auth-sub">{subtitle}</p>
   {(mode === 'login' || mode === 'signup') && <div className="auth-tabs"><button className={mode === 'login' ? 'on' : ''} onClick={() => changeMode('login')}>Sign in</button><button className={mode === 'signup' ? 'on' : ''} onClick={() => { changeMode('signup'); setRole('candidate'); }}>Create account</button></div>}
   {message ? <div className="success-message"><CircleCheck /><b>{mode === 'reset' ? 'Password updated' : mode === 'forgot' ? 'Check your email' : 'One last step'}</b><p>{message}</p><button className="btn btn-dark" onClick={() => changeMode('login')}>Back to sign in</button></div> : <form onSubmit={submit} className="auth-form">
    {mode === 'signup' && <label>Your name<input required value={name} onChange={e => setName(e.target.value)} placeholder="How should we call you?"/></label>}
    {mode !== 'reset' && <label>Email address<input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email"/></label>}
    {mode === 'reset' && <label>New password<input type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" autoComplete="new-password"/></label>}
    {mode === 'reset' && <label>Confirm new password<input type="password" required minLength={8} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Enter the new password again" autoComplete="new-password"/></label>}
    {(mode === 'login' || mode === 'signup') && <label>Password<input type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}/></label>}
    {mode === 'login' && <div className="auth-forgot-row"><button type="button" onClick={() => changeMode('forgot')}>Forgot password?</button></div>}
    {mode === 'login' || mode === 'signup' ? <label>I’m here as<select value={role} onChange={e => setRole(e.target.value)}>{mode === 'signup' ? <option value="candidate">Candidate</option> : <><option value="candidate">Candidate</option><option value="coordinator">Coordinator</option><option value="admin">Administrator</option></>}</select></label> : null}
    {!isSupabaseConfigured && (mode === 'login' || mode === 'signup') && <div className="demo-accounts"><b>Demo accounts</b><small>Candidate · candidate@careerbridge.demo</small><small>Coordinator · coordinator@careerbridge.demo</small><small>Admin · admin@careerbridge.demo</small><small>Password for all: Career2026!</small><button type="button" onClick={() => { setEmail(db.demoCredentials[role]); setPassword(db.demoCredentials.password); }}>Use {role} demo account <ArrowUpRight size={13}/></button></div>}
    {error && <div className="form-error">{error}</div>}
    <button className="btn btn-dark full-btn" disabled={busy}>{busy ? 'Please wait…' : mode === 'signup' ? 'Create my account' : mode === 'forgot' ? 'Send reset link' : mode === 'reset' ? 'Update password' : 'Sign in'} <ArrowUpRight size={15}/></button>
    {mode === 'signup' && <small className="auth-disclaimer">By continuing, you agree to our terms and privacy policy.</small>}
    {(mode === 'forgot' || mode === 'reset') && <button type="button" className="text-link auth-back-link" onClick={() => changeMode('login')}>Back to sign in</button>}
   </form>}<div className="auth-security"><ShieldCheck size={14}/> Secure authentication · Email verification enabled</div></div></div>;
    }
}
