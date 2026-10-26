import { supabase } from './supabase';
const seed = [
    { id: 'j1', title: 'Associate Product Designer', company: 'Linear Labs', location: 'Bengaluru, India', type: 'Full-time', experience: 'Fresher', salary: '₹6–9 LPA', description: 'Help shape thoughtful experiences for a fast-growing product team. You will work with design and engineering from discovery through delivery.', skills: ['Figma', 'Research', 'Prototyping'], posted: '2 days ago', kind: 'job', status: 'active' },
    { id: 'j2', title: 'Frontend Engineer', company: 'Northstar', location: 'Remote · India', type: 'Full-time', experience: '1–3 years', salary: '₹12–18 LPA', description: 'Build fast, accessible interfaces with React and TypeScript. Partner with product and design to ship useful features.', skills: ['React', 'TypeScript', 'CSS'], posted: '1 day ago', kind: 'job', status: 'active' },
    { id: 'j3', title: 'Graduate Software Engineer', company: 'Atlassian', location: 'Bengaluru, India', type: 'Full-time', experience: 'Fresher', salary: '₹18–24 LPA', description: 'Kickstart your engineering career on collaborative products used by teams around the world.', skills: ['Java', 'DSA', 'SQL'], posted: '3 days ago', kind: 'job', status: 'active' },
    { id: 'j4', title: 'Data Analyst', company: 'Razorpay', location: 'Bengaluru, India', type: 'Full-time', experience: '1–2 years', salary: '₹10–14 LPA', description: 'Turn product and payments data into clear insights that help merchants grow.', skills: ['SQL', 'Python', 'Tableau'], posted: '4 days ago', kind: 'job', status: 'active' },
    { id: 'r1', title: 'SDE I — Employee referral', company: 'Google', location: 'Hyderabad, India', type: 'Full-time', experience: '0–2 years', salary: '₹20–28 LPA', description: 'I can refer strong candidates for the SDE I opening. Share your resume and a short note about your projects.', skills: ['Java', 'Algorithms', 'Systems'], posted: 'Today', kind: 'referral', status: 'active' },
    { id: 'r2', title: 'UX Researcher — referral', company: 'Microsoft', location: 'Remote · India', type: 'Full-time', experience: '1–3 years', salary: '₹16–22 LPA', description: 'Looking to refer early-career researchers with strong qualitative research and storytelling skills.', skills: ['Research', 'Interviews', 'Figma'], posted: 'Yesterday', kind: 'referral', status: 'active' },
    { id: 'j5', title: 'Graduate Java Developer', company: 'DemoWorks', location: 'Bengaluru, India', type: 'Full-time', experience: 'Fresher', salary: '₹5–8 LPA', description: 'Sample demo listing — not a verified employer vacancy. Assist with Java services, write tests, and learn from senior engineers.', skills: ['Java', 'SQL', 'Git'], posted: 'Today', kind: 'job', status: 'active' },
    { id: 'j6', title: 'QA Analyst Trainee', company: 'TestNest', location: 'Pune, India', type: 'Full-time', experience: 'Fresher', salary: '₹4–6 LPA', description: 'Sample demo listing — not a verified employer vacancy. Practice functional testing, document bugs, and help improve release quality.', skills: ['Testing', 'SQL', 'Communication'], posted: 'Today', kind: 'job', status: 'active' },
    { id: 'j7', title: 'Data Analyst Trainee', company: 'Orbit Analytics', location: 'Remote · India', type: 'Full-time', experience: 'Fresher', salary: '₹5–7 LPA', description: 'Sample demo listing — not a verified employer vacancy. Build dashboards, clean datasets, and explain findings to business teams.', skills: ['Excel', 'SQL', 'Python', 'Power BI'], posted: 'Today', kind: 'job', status: 'active' },
    { id: 'j8', title: 'Associate UX Designer', company: 'PixelFoundry', location: 'Hyderabad, India', type: 'Full-time', experience: 'Fresher', salary: '₹6–9 LPA', description: 'Sample demo listing — not a verified employer vacancy. Support user research, wireframes, prototypes, and accessible product screens.', skills: ['Figma', 'Prototyping', 'Research'], posted: 'Today', kind: 'job', status: 'active' },
    { id: 'j9', title: 'Cloud Support Associate', company: 'SkyStack', location: 'Chennai, India', type: 'Full-time', experience: 'Fresher', salary: '₹5–8 LPA', description: 'Sample demo listing — not a verified employer vacancy. Help troubleshoot cloud services and learn infrastructure fundamentals.', skills: ['Linux', 'Networking', 'AWS'], posted: 'Today', kind: 'job', status: 'active' },
    { id: 'j10', title: 'Frontend Engineer', company: 'CodeHarbor', location: 'Remote · India', type: 'Full-time', experience: '2–4 years', salary: '₹14–22 LPA', description: 'Sample demo listing — not a verified employer vacancy. Build responsive React interfaces, improve performance, and work with design and API teams.', skills: ['React', 'TypeScript', 'CSS', 'Accessibility'], posted: 'Today', kind: 'job', status: 'active' },
    { id: 'j11', title: 'Backend Engineer', company: 'DataBridge Systems', location: 'Bengaluru, India', type: 'Full-time', experience: '3–5 years', salary: '₹18–28 LPA', description: 'Sample demo listing — not a verified employer vacancy. Design reliable APIs and data services using Node.js and PostgreSQL.', skills: ['Node.js', 'PostgreSQL', 'REST', 'Redis'], posted: 'Today', kind: 'job', status: 'active' },
    { id: 'j12', title: 'Product Manager', company: 'BrightPath Digital', location: 'Mumbai, India', type: 'Full-time', experience: '3–5 years', salary: '₹20–30 LPA', description: 'Sample demo listing — not a verified employer vacancy. Shape product goals, prioritize roadmaps, and coordinate delivery across teams.', skills: ['Product Strategy', 'Analytics', 'Agile'], posted: 'Today', kind: 'job', status: 'active' },
    { id: 'j13', title: 'QA Automation Engineer', company: 'QualityLoop', location: 'Pune, India', type: 'Full-time', experience: '2–4 years', salary: '₹12–19 LPA', description: 'Sample demo listing — not a verified employer vacancy. Extend UI and API automation suites and improve test reliability in CI.', skills: ['Playwright', 'API Testing', 'CI/CD'], posted: 'Today', kind: 'job', status: 'active' },
    { id: 'j14', title: 'Senior Data Analyst', company: 'InsightWorks', location: 'Hyderabad, India', type: 'Full-time', experience: '4–6 years', salary: '₹18–26 LPA', description: 'Sample demo listing — not a verified employer vacancy. Own analytical projects, improve data models, and present recommendations to leaders.', skills: ['SQL', 'Python', 'Looker', 'Statistics'], posted: 'Today', kind: 'job', status: 'active' },
    { id: 'r3', title: 'Junior Software Engineer — Referral', company: 'CloudCanvas', location: 'Bengaluru, India', type: 'Full-time', experience: 'Fresher', salary: '₹8–12 LPA', description: 'Sample demo referral — not a verified employee referral. Practice explaining your projects and attach a resume link when requesting a referral.', skills: ['JavaScript', 'React', 'Git'], posted: 'Today', kind: 'referral', status: 'active' },
    { id: 'r4', title: 'Data Scientist — Referral', company: 'Northstar AI Studio', location: 'Remote · India', type: 'Full-time', experience: '2–4 years', salary: '₹18–28 LPA', description: 'Sample demo referral — not a verified employee referral. Referral practice listing for candidates with applied machine learning experience.', skills: ['Python', 'Machine Learning', 'SQL'], posted: 'Today', kind: 'referral', status: 'active' },
    { id: 'r5', title: 'Product Designer — Referral', company: 'DesignMint', location: 'Mumbai, India', type: 'Full-time', experience: '1–3 years', salary: '₹12–20 LPA', description: 'Sample demo referral — not a verified employee referral. Share a portfolio and a short note about your design process.', skills: ['Figma', 'User Research', 'Prototyping'], posted: 'Today', kind: 'referral', status: 'active' },
    { id: 'r6', title: 'Customer Success Associate — Referral', company: 'OrbitDesk', location: 'Remote · India', type: 'Full-time', experience: 'Fresher', salary: '₹5–8 LPA', description: 'Sample demo referral — not a verified employee referral. Highlight communication, customer support, and problem-solving experience.', skills: ['Communication', 'Customer Support', 'Excel'], posted: 'Today', kind: 'referral', status: 'active' },
    { id: 'r7', title: 'DevOps Engineer — Referral', company: 'StackBloom', location: 'Chennai, India', type: 'Full-time', experience: '3–5 years', salary: '₹20–30 LPA', description: 'Sample demo referral — not a verified employee referral. Practice a referral request focused on cloud infrastructure and automation experience.', skills: ['AWS', 'Docker', 'Kubernetes', 'Terraform'], posted: 'Today', kind: 'referral', status: 'active' }
];
const read = (key, fallback) => { try {
    return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback;
}
catch {
    return fallback;
} };
const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
const presentJobs = (rows) => rows.map(j => ({ ...j, posted: j.posted ?? (j.created_at ? new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(-Math.max(0, Math.floor((Date.now() - new Date(j.created_at).getTime()) / 86400000)), 'day') : 'Recently') }));
export const getJobs = async () => { if (supabase) {
    const { data, error } = await supabase.from('jobs').select('*').eq('status', 'active').order('created_at', { ascending: false });
    if (error)
        throw error;
    return presentJobs(data);
} return read('cb_jobs', seed); };
export const getAllJobs = async () => { if (supabase) {
    const { data, error } = await supabase.from('jobs').select('*').order('created_at', { ascending: false });
    if (error)
        throw error;
    return presentJobs(data);
} return read('cb_jobs', seed); };
export const toggleSaved = async (userId, jobId) => { if (supabase) {
    const { data } = await supabase.from('saved_jobs').select('job_id').eq('user_id', userId).eq('job_id', jobId).maybeSingle();
    if (data) {
        const { error } = await supabase.from('saved_jobs').delete().eq('user_id', userId).eq('job_id', jobId);
        if (error)
            throw error;
        return false;
    }
    const { error } = await supabase.from('saved_jobs').insert({ user_id: userId, job_id: jobId });
    if (error)
        throw error;
    return true;
} const saved = read('cb_saved', []); const next = saved.includes(jobId) ? saved.filter(x => x !== jobId) : [...saved, jobId]; write('cb_saved', next); return next.includes(jobId); };
export const getSaved = async (userId) => { if (supabase) {
    const { data, error } = await supabase.from('saved_jobs').select('job_id').eq('user_id', userId);
    if (error)
        throw error;
    return data.map(x => x.job_id);
} return read('cb_saved', []); };
export const applyJob = async (userId, jobId, resume) => { if (!resume)
    throw new Error('Please attach your resume.'); const allowed = ['pdf', 'doc', 'docx']; const ext = resume.name.split('.').pop()?.toLowerCase() || ''; if (!allowed.includes(ext))
    throw new Error('Upload a PDF, DOC, or DOCX resume.'); if (resume.size > 10 * 1024 * 1024)
    throw new Error('Your resume must be 10 MB or smaller.'); if (resume.type && !['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(resume.type))
    throw new Error('Upload a PDF, DOC, or DOCX resume.'); if (supabase) {
    const { data: existing, error: lookupError } = await supabase.from('applications').select('id,resume_path').eq('user_id', userId).eq('job_id', jobId).maybeSingle();
    if (lookupError)
        throw lookupError;
    if (existing?.resume_path)
        throw new Error('Your application already has a resume attached.');
    const objectPath = userId + '/' + jobId + '/' + crypto.randomUUID() + '.' + ext;
    const contentType = resume.type || { pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }[ext];
    const { error: uploadError } = await supabase.storage.from('candidate-resumes').upload(objectPath, resume, { contentType, upsert: false });
    if (uploadError)
        throw new Error(uploadError.message.includes('Bucket not found') ? 'Resume storage is not configured yet. Please try again later.' : uploadError.message);
    const result = existing ? await supabase.from('applications').update({ resume_path: objectPath, resume_filename: resume.name }).eq('id', existing.id).is('resume_path', null).select('id').single() : await supabase.from('applications').insert({ user_id: userId, job_id: jobId, resume_path: objectPath, resume_filename: resume.name }).select('id').single();
    if (result.error) {
        await supabase.storage.from('candidate-resumes').remove([objectPath]);
        throw result.error;
    }
    return result.data.id;
} const applied = read('cb_applied', []); if (!applied.includes(jobId))
    write('cb_applied', [...applied, jobId]); const names = read('cb_resume_names', {}); write('cb_resume_names', { ...names, [jobId]: resume.name }); return crypto.randomUUID(); };
export const requestReferral = async (userId, jobId, message) => { if (supabase) {
    const { data, error } = await supabase.from('referral_requests').insert({ user_id: userId, job_id: jobId, message }).select('id').single();
    if (error)
        throw error;
    return data.id;
} const a = read('cb_requests', []); const id = crypto.randomUUID(); write('cb_requests', [{ id, user_id: userId, job_id: jobId, message, status: 'pending', created_at: new Date().toISOString() }, ...a]); return id; };
export const getProfile = async (id, email) => { if (supabase) {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
    if (error)
        throw error;
    if (data)
        return data;
    const p = { id, email, full_name: email.split('@')[0], role: 'candidate' };
    const { data: created, error: e } = await supabase.from('profiles').insert(p).select().single();
    if (e)
        throw e;
    return created;
} return read('cb_profile', null) ?? { id, email, full_name: email.split('@')[0], role: 'candidate' }; };
export const getProfiles = async () => { if (!supabase)
    return read('cb_users', []); const { data, error } = await supabase.from('profiles').select('id,email,full_name,headline,location,role,created_at').order('created_at', { ascending: false }).limit(100); if (error)
    throw error; return data; };
export const getAdminDashboardCounts = async () => {
    if (!supabase) {
        const users = read('cb_users', []);
        return {
            candidates: users.filter(user => user.role === 'candidate').length,
            coordinators: users.filter(user => user.role === 'coordinator').length,
            admins: users.filter(user => user.role === 'admin').length
        };
    }
    const countRole = async role => {
        const { count, error } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', role);
        if (error) throw error;
        return count ?? 0;
    };
    const [candidates, coordinators, admins] = await Promise.all([countRole('candidate'), countRole('coordinator'), countRole('admin')]);
    return { candidates, coordinators, admins };
};
export const saveProfile = async (p) => { if (supabase) {
    const { data: current, error: currentError } = await supabase.from('profiles').select('phone').eq('id', p.id).single();
    if (currentError)
        throw currentError;
    const fields = { full_name: p.full_name, phone: p.phone, headline: p.headline, location: p.location, experience: p.experience, skills: p.skills };
    const consent = { whatsapp_opt_in: p.whatsapp_opt_in ?? false, sms_opt_in: p.sms_opt_in ?? false };
    if (current.phone !== p.phone) {
        const { error } = await supabase.from('profiles').update({ ...fields, ...consent }).eq('id', p.id);
        if (error)
            throw error;
        // Phone-change trigger clears old consent; this second update applies
        // the user's freshly checked choices for the new number.
        const { data, error: consentError } = await supabase.from('profiles').update(consent).eq('id', p.id).select('*').single();
        if (consentError)
            throw consentError;
        return data;
    }
    const { data, error } = await supabase.from('profiles').update({ ...fields, ...consent }).eq('id', p.id).select('*').single();
    if (error)
        throw error;
    return data;
} write('cb_profile', p); return p; };
export const createJob = async (job) => { if (supabase) {
    const { error } = await supabase.from('jobs').insert(job);
    if (error)
        throw error;
    return;
} const jobs = read('cb_jobs', seed); write('cb_jobs', [{ ...job, id: crypto.randomUUID(), status: 'active', posted: 'Just now' }, ...jobs]); };
export const moderateJob = async (id, status) => { if (supabase) {
    const { error } = await supabase.from('jobs').update({ status }).eq('id', id);
    if (error)
        throw error;
    return;
} write('cb_jobs', read('cb_jobs', seed).map(j => j.id === id ? { ...j, status } : j)); };
export const getApplications = async (uid) => { if (supabase) {
    const { data, error } = await supabase.from('applications').select('*,jobs(*)').eq('user_id', uid).order('created_at', { ascending: false });
    if (error)
        throw error;
    return data;
} return read('cb_applied', []).map(job_id => ({ job_id, resume_filename: read('cb_resume_names', {})[job_id], jobs: read('cb_jobs', seed).find(j => j.id === job_id) })); };
export const getReferralRequests = async (uid, role) => { if (supabase) {
    const selection = role === 'coordinator' ? '*,jobs!inner(*),profiles(full_name,email)' : '*,jobs(*),profiles(full_name,email)';
    const q = supabase.from('referral_requests').select(selection).order('created_at', { ascending: false });
    const { data, error } = role === 'admin' ? await q : role === 'coordinator' ? await q.eq('jobs.coordinator_id', uid) : await q.eq('user_id', uid);
    if (error)
        throw error;
    return data;
} return read('cb_requests', []); };
export const changeReferralStatus = async (id, status) => { if (supabase) {
    const { error } = await supabase.from('referral_requests').update({ status }).eq('id', id);
    if (error)
        throw error;
    return;
} write('cb_requests', read('cb_requests', []).map(x => x.id === id ? { ...x, status } : x)); };
export const demoCredentials = { candidate: 'candidate@careerbridge.demo', coordinator: 'coordinator@careerbridge.demo', admin: 'admin@careerbridge.demo', password: 'Career2026!' };
export const demoLogin = (email, password, role) => { if (password !== demoCredentials.password || email !== demoCredentials[role])
    throw new Error('Use the demo email for this role and password Career2026!'); const profile = { id: `demo-${role}`, email, full_name: role === 'candidate' ? 'Aarav Mehta' : role === 'admin' ? 'CareerBridge Admin' : 'Priya Sharma', role, headline: role === 'candidate' ? 'Aspiring product designer' : 'Talent team', location: 'Bengaluru, India', experience: 'Fresher', skills: ['Figma', 'Research'] }; write('cb_profile', profile); localStorage.setItem('cb_session', JSON.stringify(profile)); return profile; };
