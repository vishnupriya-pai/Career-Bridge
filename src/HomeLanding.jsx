import { useState } from 'react';
import { ArrowRight, ArrowUpRight, Bookmark, BriefcaseBusiness, Building2, GraduationCap, MapPin, Search, Sparkles, TrendingUp, UsersRound } from 'lucide-react';

const careerPaths = [
  { kicker: 'EARLY CAREER', title: 'Start with momentum', text: 'Find internships, graduate roles, and teams ready to help you grow.', icon: GraduationCap, tone: 'mint' },
  { kicker: 'NEXT CHAPTER', title: 'Make your next move', text: 'Explore roles that fit your experience, strengths, and direction.', icon: TrendingUp, tone: 'blue' },
  { kicker: 'REAL CONNECTIONS', title: 'Get there together', text: 'Discover employee referrals and make a thoughtful introduction.', icon: UsersRound, tone: 'sand' },
];

export default function HomeLanding({ jobs, loading, onAuth, onBrowse, onSearch, onDetail, onReferrals }) {
  const [term, setTerm] = useState('');
  const activeJobs = jobs.filter((job) => job.status === 'active');
  const featuredJobs = activeJobs.slice(0, 3);
  const spotlight = featuredJobs[0];

  const submitSearch = (event) => {
    event.preventDefault();
    onSearch(term.trim());
  };

  return <div className="landing landing-v2">
    <section className="hero hero-v2">
      <div className="hero-copy hero-copy-v2">
        <div className="eyebrow hero-eyebrow"><span className="eyebrow-dot"/>CAREERBRIDGE · OPPORTUNITIES WITH DIRECTION</div>
        <h1>Make your next<br/><em>move count.</em></h1>
        <p>Explore meaningful roles, find a path that fits, and connect with people who can help you get there.</p>
        <form className="hero-search" onSubmit={submitSearch}>
          <Search size={19} aria-hidden="true"/>
          <label className="sr-only" htmlFor="home-job-search">Search jobs, companies, or skills</label>
          <input id="home-job-search" value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Job title, company, or skill"/>
          <button className="btn btn-search" type="submit">Find opportunities <ArrowRight size={16}/></button>
        </form>
        <div className="hero-actions-v2">
          <button className="hero-text-link" onClick={onBrowse}>Browse all roles <ArrowUpRight size={15}/></button>
          <span className="hero-action-divider"/>
          <button className="hero-text-link" onClick={onAuth}>Create a free profile</button>
        </div>
      </div>

      <div className="hero-visual hero-visual-v2" aria-label="A preview of opportunities on CareerBridge">
        <div className="hero-orbit hero-orbit-a"/><div className="hero-orbit hero-orbit-b"/>
        <div className="hero-visual-glow"/>
        <div className="opportunity-preview">
          <div className="preview-topline"><span><i/> CAREERBRIDGE PICKS</span><span>01 / 03</span></div>
          {spotlight ? <button className="preview-job" onClick={() => onDetail(spotlight)}>
            <span className="preview-company-mark">{spotlight.company?.slice(0, 1) || 'C'}</span>
            <span className="preview-copy"><small>FEATURED OPPORTUNITY</small><b>{spotlight.title}</b><span>{spotlight.company}</span></span>
            <ArrowUpRight size={17}/>
          </button> : <div className="preview-empty"><BriefcaseBusiness size={20}/><span>New opportunities are on their way.</span></div>}
          <div className="preview-meta"><span><MapPin size={13}/>{spotlight?.location || 'Across India'}</span><span><Building2 size={13}/>{spotlight?.type || 'Explore roles'}</span></div>
          <div className="preview-divider"/>
          <div className="preview-footer"><span className="preview-footer-icon"><Sparkles size={15}/></span><span><b>A more personal job search</b><small>Roles, referrals, and room to grow</small></span><Bookmark size={16}/></div>
        </div>
        <div className="hero-floating-note"><span className="hero-floating-icon"><UsersRound size={16}/></span><span><b>Referrals that matter</b><small>Make a human connection</small></span></div>
        <span className="hero-star hero-star-one">✳</span><span className="hero-star hero-star-two">✦</span>
      </div>
      <div className="hero-bottom-line"><span>GOOD WORK STARTS WITH A BETTER SEARCH</span><span>{activeJobs.length} open {activeJobs.length === 1 ? 'opportunity' : 'opportunities'} to explore <ArrowRight size={14}/></span></div>
    </section>

    <section className="career-path-section" aria-labelledby="career-path-heading">
      <div className="section-head section-head-v2">
        <div><div className="eyebrow">BUILT FOR YOUR JOURNEY</div><h2 id="career-path-heading">Wherever you’re headed.</h2></div>
        <button className="text-link" onClick={onBrowse}>Explore opportunities <ArrowUpRight size={15}/></button>
      </div>
      <div className="career-path-grid">{careerPaths.map(({ kicker, title, text, icon: Icon, tone }, index) => <button className="career-path-card" key={kicker} onClick={index === 2 ? onReferrals : onBrowse}>
        <span className={'career-path-icon ' + tone}><Icon size={19}/></span>
        <span className="career-path-kicker">{kicker}</span>
        <b>{title}</b><span className="career-path-description">{text}</span>
        <span className="career-path-arrow"><ArrowUpRight size={16}/></span>
      </button>)}</div>
    </section>

    <section className="featured-section-v2" aria-labelledby="featured-heading">
      <div className="section-head section-head-v2">
        <div><div className="eyebrow">A FEW GOOD PLACES TO START</div><h2 id="featured-heading">Opportunities to explore.</h2></div>
        <button className="text-link" onClick={onBrowse}>View all roles <ArrowUpRight size={15}/></button>
      </div>
      {loading ? <div className="featured-skeleton"/> : featuredJobs.length ? <div className="featured-jobs-grid">{featuredJobs.map((job, index) => <button className="featured-job-card" key={job.id} onClick={() => onDetail(job)}>
        <span className="featured-job-top"><span className={'featured-company-mark mark-' + (index + 1)}>{job.company?.slice(0, 1) || 'C'}</span><span className="featured-kind">{job.kind === 'referral' ? 'Employee referral' : job.experience || 'Open role'}</span><ArrowUpRight size={16}/></span>
        <b className="featured-job-title">{job.title}</b><span className="featured-company">{job.company}</span>
        <span className="featured-job-meta"><span><MapPin size={13}/>{job.location}</span>{job.salary && <span>{job.salary}</span>}</span>
        <span className="featured-job-bottom"><span>{job.type || 'Full-time'}</span><span>View opportunity <ArrowRight size={14}/></span></span>
      </button>)}</div> : <div className="featured-empty"><BriefcaseBusiness/><div><b>New opportunities are coming soon.</b><span>Browse the marketplace to see all current roles.</span></div><button className="btn btn-outline" onClick={onBrowse}>Browse roles</button></div>}
    </section>

    <section className="profile-cta-v2">
      <span className="profile-cta-icon"><Sparkles size={19}/></span>
      <div><div className="eyebrow">YOUR NEXT STEP, YOUR WAY</div><h2>Let the right opportunity find you.</h2><p>Create a profile, save the roles you like, and keep your search moving.</p></div>
      <button className="btn btn-cta-v2" onClick={onAuth}>Build your free profile <ArrowRight size={16}/></button>
    </section>
  </div>;
}
