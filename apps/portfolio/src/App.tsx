import React, { useState, useEffect, useRef } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useGetPortfolioStats,
  getGetPortfolioStatsQueryKey,
  useRecordPortfolioVisit,
  useSubmitContact,
  useSendChatMessage,
} from '@workspace/api-client-react';
import {
  ArrowDownRight, ArrowUpRight, Bot, Braces, Check, Cpu, Database, Download,
  Github, Linkedin, Mail, MapPin, Menu, Moon, Plug, Send, ShieldCheck, Sparkles, Sun, X
} from 'lucide-react';
import { animate, motion, useReducedMotion, useSpring, useTransform, useMotionValue } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  motionDuration,
  motionEase as ease,
  revealFromLeft,
  revealScaleY,
  revealUp,
  staggerReveal,
  viewportOnce,
} from './lib/motion';
import { projectStatuses } from './data/project-statuses';
import { toDisplayedStats } from './lib/portfolio-stats';

const client = new QueryClient();
const slow = motionDuration.slow, normal = motionDuration.normal;

// ─── useTilt ─────────────────────────────────────────────────────────────────
function useTilt() {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [3, -3]), { stiffness: 300, damping: 30 });
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-3, 3]), { stiffness: 300, damping: 30 });
  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    if (window.matchMedia('(hover:none)').matches) return;
    const r = e.currentTarget.getBoundingClientRect();
    x.set((e.clientX - r.left) / r.width - 0.5);
    y.set((e.clientY - r.top) / r.height - 0.5);
  };
  const handleMouseLeave = () => { x.set(0); y.set(0); };
  return { rotateX, rotateY, handleMouseMove, handleMouseLeave };
}

// ─── Nav ─────────────────────────────────────────────────────────────────────
function Nav({ onResume, resumeButtonRef }: { onResume: () => void; resumeButtonRef: React.RefObject<HTMLButtonElement | null> }) {
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(true);
  const navRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const isLight = document.documentElement.dataset.theme === 'light';
    if (isLight !== !dark) setDark(!isLight);
  }, []);
  useEffect(() => {
    if (!open) return;
    const closeAndRestoreFocus = () => {
      setOpen(false);
      menuButtonRef.current?.focus();
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('.resume-overlay')) closeAndRestoreFocus();
    };
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (navRef.current?.contains(target) || menuButtonRef.current?.contains(target)) return;
      setOpen(false);
    };
    window.addEventListener('keydown', handleEscape);
    window.addEventListener('mousedown', handleOutsideClick);
    return () => {
      window.removeEventListener('keydown', handleEscape);
      window.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [open]);
  function toggleTheme() {
    const nd = !dark;
    document.documentElement.dataset.theme = nd ? 'dark' : 'light';
    setDark(nd);
  }
  const items = ['work', 'capabilities', 'about', 'experience', 'focus', 'contact'];
  return (
    <header>
      <a className="mark" href="#top" aria-label="Home">AS<span>.</span></a>
      <nav ref={navRef} id="primary-navigation" className={open ? 'open' : ''} aria-label="Primary">
        {items.map(x => (
          <a onClick={() => setOpen(false)} href={`#${x}`} key={x}>{x}</a>
        ))}
        <button ref={resumeButtonRef} className="nav-resume-btn" onClick={() => { setOpen(false); onResume(); }}>resume</button>
        <a onClick={() => setOpen(false)} href="mailto:akashsimhadri4@gmail.com">email</a>
      </nav>
      <div className="nav-actions">
        <button className="icon" onClick={toggleTheme} aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}>
          {dark ? <Sun /> : <Moon />}
        </button>
        <button
          ref={menuButtonRef}
          className="icon mobile"
          onClick={() => setOpen(!open)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls="primary-navigation"
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>
    </header>
  );
}

// ─── 3D character-by-character name reveal ────────────────────────────────────
function AnimatedName({ pref }: { pref: boolean }) {
  const line1 = 'Akash'.split('');
  const line2 = 'Simhadri'.split('');
  return (
    <>
      <span className="name-line">
        {line1.map((ch, i) => (
          <motion.span key={i} className="name-char"
            initial={pref ? false : { rotateX: 90, opacity: 0 }}
            animate={pref ? {} : { rotateX: 0, opacity: 1 }}
            transition={{ delay: i * 0.07, duration: 0.5, ease }}
          >{ch}</motion.span>
        ))}
      </span>
      <span className="name-line">
        {line2.map((ch, i) => (
          <motion.span key={i} className="name-char"
            initial={pref ? false : { rotateX: 90, opacity: 0 }}
            animate={pref ? {} : { rotateX: 0, opacity: 1 }}
            transition={{ delay: 0.22 + i * 0.07, duration: 0.5, ease }}
          >{ch}</motion.span>
        ))}
        <motion.span className="name-char"
          initial={pref ? false : { rotateX: 90, opacity: 0 }}
          animate={pref ? {} : { rotateX: 0, opacity: 1 }}
          transition={{ delay: 0.22 + line2.length * 0.07, duration: 0.5, ease }}
        ><span>.</span></motion.span>
      </span>
    </>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
function Hero() {
  const pref = useReducedMotion();
  const tilt = useTilt();
  return (
    <section className="hero">
      {!pref && (
        <>
          <div className="hero-orb hero-orb-1" />
          <div className="hero-orb hero-orb-2" />
          <div className="hero-orb hero-orb-3" />
        </>
      )}

      <div className="hero-copy">
        <motion.span className="kicker"
          initial={pref ? false : { opacity: 0, y: 10 }}
          animate={pref ? {} : { opacity: 1, y: 0 }}
          transition={{ duration: normal, ease }}
        ><i /> Available for software engineering opportunities</motion.span>

        <h1><AnimatedName pref={!!pref} /></h1>

        <motion.p className="lede"
          initial={pref ? false : { opacity: 0, y: 16 }}
          animate={pref ? {} : { opacity: 1, y: 0 }}
          transition={{ delay: 0.78, duration: slow, ease }}
        >Software engineer building dependable full-stack products and AI-enabled systems that turn complex workflows into clear, useful experiences.</motion.p>

        <motion.div className="links"
          initial={pref ? false : { opacity: 0, y: 12 }}
          animate={pref ? {} : { opacity: 1, y: 0 }}
          transition={{ delay: 0.92, duration: slow, ease }}
        >
          <a className="primary hero-cta" href="#work"><span>Explore selected work</span> <ArrowDownRight /></a>
          <a className="hero-cta hero-cta-secondary" href="mailto:akashsimhadri4@gmail.com"><span>Start a conversation</span> <ArrowUpRight /></a>
        </motion.div>

        <motion.div className="location"
          initial={pref ? false : { opacity: 0 }}
          animate={pref ? {} : { opacity: 1 }}
          transition={{ delay: 1.15, duration: slow, ease }}
        >
          <MapPin /> Andhra Pradesh, India <span /> Open to remote &amp; on-site
        </motion.div>
      </div>

      {/* Photo — outer scene holds glow + float, inner figure holds tilt */}
      <div className="hero-portrait-scene">
        <div className="hero-portrait-glow" />
        <motion.div
          className="hero-portrait-float"
          animate={pref ? {} : { y: [0, -12, 0] }}
          transition={{ duration: 4.5, ease: 'easeInOut', repeat: Infinity, delay: 1.2 }}
        >
          <motion.figure
            className="hero-portrait"
            style={pref ? {} : { rotateX: tilt.rotateX, rotateY: tilt.rotateY }}
            onMouseMove={tilt.handleMouseMove}
            onMouseLeave={tilt.handleMouseLeave}
            initial={pref ? false : { opacity: 0, scale: 0.9, rotateY: -12 }}
            animate={pref ? {} : { opacity: 1, scale: 1, rotateY: 0 }}
            transition={{ duration: 0.95, ease, delay: 0.25 }}
          >
            <img src="/akash-simhadri-portrait.jpeg" alt="Akash Simhadri smiling outdoors" width="1148" height="1600" fetchPriority="high" />
            <figcaption>
              <span>Akash Simhadri</span>
              <small>Software engineer · Andhra Pradesh</small>
            </figcaption>
          </motion.figure>
        </motion.div>
      </div>
    </section>
  );
}

// ─── Dispatch Console Mockup ──────────────────────────────────────────────────
const visitorStorageKey = 'portfolio_visitor_id';
const visitSessionKey = 'portfolio_visit_recorded';
const metricFormatter = new Intl.NumberFormat('en-US');

function AnimatedMetricValue({ value }: { value: number }) {
  const pref = useReducedMotion();
  // Always a real number from the very first render — never a "—"
  // placeholder, never NaN. Reduced motion shows the final number
  // immediately; otherwise it counts up.
  const [displayValue, setDisplayValue] = useState(
    pref ? metricFormatter.format(value) : '0',
  );
  // The actual on-screen number right now (kept in sync every animation
  // tick), used as the start point for the *next* animation so a value
  // change animates from wherever it currently is, not from 0.
  const currentNumber = useRef(0);
  // The value we last started animating toward, so an unchanged value
  // (e.g. activeBuilds staying 9) never restarts the animation.
  const lastTarget = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (pref) {
      currentNumber.current = value;
      lastTarget.current = value;
      setDisplayValue(metricFormatter.format(value));
      return;
    }

    if (lastTarget.current === value) return;

    // First run animates from 0; every later change animates from the
    // number currently displayed, including mid-flight interruptions.
    const from = lastTarget.current === undefined ? 0 : currentNumber.current;
    lastTarget.current = value;

    const controls = animate(from, value, {
      duration: 0.8,
      ease,
      onUpdate: (latest) => {
        currentNumber.current = latest;
        setDisplayValue(metricFormatter.format(Math.round(latest)));
      },
    });
    return () => controls.stop();
  }, [pref, value]);

  return <span className="stats-rail-value">{displayValue}</span>;
}

function PortfolioStats() {
  const pref = useReducedMotion();
  const stats = useGetPortfolioStats({
    query: {
      queryKey: getGetPortfolioStatsQueryKey(),
      retry: false,
      staleTime: 60_000,
    },
  });
  const visit = useRecordPortfolioVisit({
    mutation: {
      retry: false,
      onSuccess: () => { void stats.refetch(); },
    },
  });
  const recordVisit = visit.mutate;

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(visitSessionKey)) return;

      let visitorId = window.localStorage.getItem(visitorStorageKey);
      if (!visitorId) {
        visitorId = window.crypto.randomUUID();
        window.localStorage.setItem(visitorStorageKey, visitorId);
      }

      window.sessionStorage.setItem(visitSessionKey, '1');
      recordVisit({ data: { visitorId } });
    } catch {
      // Storage-disabled browsers still receive the derived active-build metric.
    }
  }, [recordVisit]);

  const displayedStats = toDisplayedStats(stats.data);
  const metrics = [
    { label: 'Portfolio Visitors', value: displayedStats.visitors, featured: false },
    { label: 'Inquiries Received', value: displayedStats.inquiries, featured: true },
    { label: 'Active Builds', value: displayedStats.activeBuilds, featured: false },
  ];

  return (
    <motion.section
      id="portfolio-stats"
      className="stats-rail"
      aria-labelledby="portfolio-stats-title"
      variants={staggerReveal}
      initial={pref ? false : 'hidden'}
      whileInView={pref ? undefined : 'visible'}
      viewport={viewportOnce}
    >
      <h2 id="portfolio-stats-title" className="sr-only">Live portfolio statistics</h2>
      <div className="stats-rail-inner">
        {metrics.map((metric) => {
          const className = [
            'stats-rail-item',
            metric.featured && 'is-featured',
          ].filter(Boolean).join(' ');
          return (
            <motion.div
              className={className}
              key={metric.label}
              variants={revealUp}
            >
              <AnimatedMetricValue value={metric.value} />
              <span className="stats-rail-label">{metric.label}</span>
            </motion.div>
          );
        })}
      </div>
    </motion.section>
  );
}

function DispatchMockup() {
  return (
    <div className="mockup-dispatch">
      <div className="mockup-topbar">
        <span>DISPATCH CONSOLE</span>
        <span className="live-badge"><i />DEVELOPMENT BUILD · MOCK DATA</span>
      </div>
      <div className="dispatch-incidents">
        <div className="incident-row critical">
          <span className="sev">CRITICAL</span>
          <div>
            <b>Cardiac Arrest — Zone 4</b>
            <small>Unit A-42 · 4m 28s ETA</small>
          </div>
          <span className="ai-tag">AI ✓</span>
        </div>
        <div className="incident-row high">
          <span className="sev">HIGH</span>
          <div>
            <b>Multi-vehicle — Route 9</b>
            <small>Unit B-07 · Dispatching</small>
          </div>
        </div>
        <div className="incident-row med">
          <span className="sev">MED</span>
          <div>
            <b>Structural Fire — Block 12</b>
            <small>Pending assignment</small>
          </div>
        </div>
      </div>
      <div className="dispatch-status-row">
        <div>
          <span className="status-label">Ambulance</span>
          <span className="status-val green">● Unit A-42 Dispatched</span>
        </div>
        <div>
          <span className="status-label">Hospital</span>
          <span className="status-val yellow">Prep in progress</span>
        </div>
      </div>
      <div className="ai-rec">
        <span className="ai-rec-label">AI Copilot Recommendation</span>
        <p>Reroute Unit A-42 via I-95 North — accident on Main St. Saves 2.4 min.</p>
        <span className="rec-footer">Response active</span>
      </div>
    </div>
  );
}

// ─── CampusConnect Mockup ─────────────────────────────────────────────────────
function CampusMockup() {
  return (
    <div className="mockup-campus">
      <div className="campus-col">
        <div className="mockup-section-label">UPCOMING EVENTS</div>
        {[
          { t: 'AI/ML Workshop', c: 'Tech Club', badge: 'Registered', badgeColor: 'green' },
          { t: 'Cultural Fest 2025', c: 'Student Union', badge: 'Open', badgeColor: 'neutral' },
          { t: 'Resume Bootcamp', c: 'Career Cell', badge: 'Open', badgeColor: 'neutral' },
        ].map(ev => (
          <div className="campus-event-row" key={ev.t}>
            <div>
              <b>{ev.t}</b>
              <small>{ev.c}</small>
            </div>
            <span className={`ev-badge ${ev.badgeColor}`}>{ev.badge}</span>
          </div>
        ))}
      </div>
      <div className="campus-col">
        <div className="mockup-section-label">ACTIVE CAMPAIGNS</div>
        {[
          { t: 'Clean Water Initiative', cat: 'Environment', pct: 78, goal: '$12,000', supporters: 142 },
          { t: 'School Meals Programme', cat: 'Education', pct: 55, goal: '$8,500', supporters: 89 },
        ].map(c => (
          <div className="campus-campaign-row" key={c.t}>
            <div className="campaign-top">
              <b>{c.t}</b>
              <span className="pct">{c.pct}%</span>
            </div>
            <small>{c.cat}</small>
            <div className="prog-bar"><i style={{ width: `${c.pct}%` }} /></div>
            <div className="campaign-meta">
              <span>Goal: {c.goal}</span>
              <span>{c.supporters} supporters</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── SkillForge Mockup ────────────────────────────────────────────────────────
function SkillForgeMockup() {
  return (
    <div className="mockup-skillforge">
      <div className="mockup-section-label">COURSE CATALOGUE</div>
      {[
        { icon: 'F', title: 'Full-Stack with React & Node', instructor: 'J. Mehta · 42h', tags: ['React', 'Node.js'], rating: '4.8', price: '$49' },
        { icon: 'M', title: 'Machine Learning Foundations', instructor: 'A. Reddy · 38h', tags: ['Python', 'Scikit-learn'], rating: '4.6', price: '$59' },
      ].map(c => (
        <div className="sf-course-row" key={c.title}>
          <div className="sf-icon">{c.icon}</div>
          <div className="sf-info">
            <b>{c.title}</b>
            <small>{c.instructor}</small>
            <div className="sf-tags">{c.tags.map(t => <span key={t}>{t}</span>)}</div>
          </div>
          <div className="sf-meta">
            <span className="sf-rating">★ {c.rating}</span>
            <span className="sf-price">{c.price}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Disaster Relief Graph Mockup ─────────────────────────────────────────────
function DisasterGraphMockup() {
  return (
    <div className="mockup-graph">
      <div className="graph-tabs">
        <span className="graph-tab active">Ford-Fulkerson</span>
        <span className="graph-tab">Edmonds-Karp</span>
        <span className="graph-tab">Dinic's</span>
        <span className="graph-tab-right">O(VE²)</span>
      </div>
      <svg viewBox="0 0 340 160" className="graph-svg" aria-hidden="true">
        <defs>
          <marker id="arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="#d7ff64" />
          </marker>
        </defs>
        {/* edges */}
        {[
          [40,80,115,55], [40,80,115,105],
          [115,55,190,80],[115,105,190,80],
          [190,80,265,55],[190,80,265,105],
          [265,55,310,80],[265,105,310,80]
        ].map(([x1,y1,x2,y2],i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#d7ff64" strokeWidth="1.5" strokeOpacity="0.5" markerEnd="url(#arr)" />
        ))}
        {/* edge labels */}
        <text x="72" y="58" fontSize="9" fill="#d7ff64" opacity="0.7">11</text>
        <text x="72" y="102" fontSize="9" fill="#d7ff64" opacity="0.7">12</text>
        <text x="147" y="62" fontSize="9" fill="#d7ff64" opacity="0.7">10</text>
        <text x="147" y="102" fontSize="9" fill="#d7ff64" opacity="0.7">7</text>
        <text x="222" y="58" fontSize="9" fill="#d7ff64" opacity="0.7">15</text>
        <text x="222" y="102" fontSize="9" fill="#d7ff64" opacity="0.7">8</text>
        {/* nodes */}
        {[
          [40,80,'Source'],[115,55,'Node A'],[115,105,'Node B'],[190,80,'Node C'],
          [265,55,'Node D'],[265,105,'Node E'],[310,80,'Relief Camp']
        ].map(([cx,cy,label]) => (
          <g key={String(label)}>
            <circle cx={Number(cx)} cy={Number(cy)} r="14" fill="#1a1f1e" stroke="#d7ff64" strokeWidth="1.5" />
            <text x={Number(cx)} y={Number(cy)+3} textAnchor="middle" fontSize="7" fill="#d7ff64">{String(label).replace('Node ','').replace(' ','')}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

// ─── Work Section ─────────────────────────────────────────────────────────────
function Work() {
  const pref = useReducedMotion();

  const implemented = [
    'Frontend architecture and design system',
    'Operational dashboard foundation',
    'Emergency management interfaces',
    'Ambulance management interfaces',
    'Hospital management interfaces',
    'Patient management interfaces',
    'AI Copilot frontend module',
    'Role-based navigation and role-guarded routes',
    'Mock operational data layer',
    'Typed AI domain models',
  ];
  const planned = [
    'Real AI provider calls (OpenAI/Gemini)',
    'Production backend APIs',
    'WebSocket real-time communication',
    'Live ambulance GPS tracking',
    'Live hospital capacity data',
    'RAG pipeline for contextual AI',
    'Embeddings and vector database',
    'Production deployment',
  ];

  return (
    <section id="work" className="section work-section">
      <div className="section-head">
        <div>
          <span className="eyebrow">01 / SELECTED WORK</span>
          <motion.h2
            initial={pref ? false : { opacity: 0, y: 24 }}
            whileInView={pref ? {} : { opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: slow, ease }}
          >
            Systems built around practical<br />workflows and technical problems.
          </motion.h2>
        </div>
        <p>Projects developed through independent work, academic projects and internship experience.</p>
      </div>

      {/* Emergency Response AI — flagship card */}
      <motion.article
        className="project-card era-card"
        initial={pref ? false : { opacity: 0, y: 28 }}
        whileInView={pref ? {} : { opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: slow, ease }}
      >
        <div className="era-top">
          <div className="era-meta">
            <div className="era-badges">
              <span className="status-pill active">{projectStatuses.emergencyResponse}</span>
              <span className="type-pill">AI · Healthcare · Emergency Operations</span>
            </div>
            <h3>Emergency Response AI</h3>
            <p>A multi-role emergency coordination platform designed to connect dispatch operators, ambulance teams, hospitals and patient-related workflows through one operational system.</p>
            <div className="tags">
              {['React','TypeScript','Vite','Tailwind CSS','shadcn/ui','Node.js','Express','Provider-neutral AI architecture'].map(t => <span key={t}>{t}</span>)}
            </div>
            <div className="response-workflow">
              <span className="eyebrow" style={{ marginBottom: '10px', display: 'block' }}>RESPONSE WORKFLOW</span>
              <div className="workflow-steps">
                {['Emergency Request','Triage & Priority','Dispatcher Review','Ambulance Assignment'].map((s, i) => (
                  <React.Fragment key={s}>
                    <span className={i < 2 ? 'wf-active' : 'wf-pending'}>{s}</span>
                    {i < 3 && <span className="wf-arrow">→</span>}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
          <DispatchMockup />
        </div>
        <div className="era-bottom">
          <div>
            <div className="impl-label"><span className="green-dot" />IMPLEMENTED</div>
            <ul className="impl-list">
              {implemented.map(i => <li key={i}><span>›</span>{i}</li>)}
            </ul>
          </div>
          <div>
            <div className="impl-label"><span className="yellow-dot" />PLANNED — NOT CONNECTED</div>
            <ul className="impl-list planned">
              {planned.map(p => <li key={p}><span>—</span>{p}</li>)}
            </ul>
          </div>
        </div>
      </motion.article>

      {/* 2-column grid */}
      <div className="projects-grid">
        {/* CampusConnect */}
        <motion.article
          className="project-card"
          initial={pref ? false : { opacity: 0, y: 20 }}
          whileInView={pref ? {} : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ delay: 0, duration: normal, ease }}
        >
          <CampusMockup />
          <div className="pc-body">
            <div className="pc-badges">
              <span className="status-pill completed">{projectStatuses.campusConnect}</span>
              <span className="type-pill">Full Stack · Campus Platform</span>
            </div>
            <h3>CampusConnect</h3>
            <p>A campus platform designed to help students discover activities, interact with clubs, register for events and engage with campus organizations from one system.</p>
            <div className="tags">
              {['React','JavaScript','Tailwind CSS','React Router','Node.js','Express','MongoDB','Mongoose','JWT','MongoDB Atlas'].map(t => <span key={t}>{t}</span>)}
            </div>
          </div>
        </motion.article>

        {/* DonorHub */}
        <motion.article
          className="project-card"
          initial={pref ? false : { opacity: 0, y: 20 }}
          whileInView={pref ? {} : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ delay: 0.08, duration: normal, ease }}
        >
          <div className="mockup-donorhub">
            <div className="mockup-section-label">ACTIVE CAMPAIGNS</div>
            {[
              { t: 'Clean Water Initiative', cat: 'Environment · 14d left', pct: 78, goal: '$12,000', supporters: 142 },
              { t: 'School Meals Programme', cat: 'Education · 22d left', pct: 55, goal: '$8,500', supporters: 89 },
            ].map(c => (
              <div className="campus-campaign-row" key={c.t}>
                <div className="campaign-top"><b>{c.t}</b><span className="pct">{c.pct}%</span></div>
                <small>{c.cat}</small>
                <div className="prog-bar donor"><i style={{ width: `${c.pct}%` }} /></div>
                <div className="campaign-meta"><span>Goal: {c.goal}</span><span>{c.supporters} supporters</span></div>
              </div>
            ))}
          </div>
          <div className="pc-body">
            <div className="pc-badges">
              <span className="status-pill completed">{projectStatuses.donorHub}</span>
            </div>
            <h3>DonorHub</h3>
            <p>A donation and campaign-management platform whose core functionality was completed through academic and internship work, with UI/UX modernization now in progress.</p>
            <div className="tags">
              {['React','JavaScript','HTML','CSS','Node.js','Express','MongoDB','Mongoose','Chart.js'].map(t => <span key={t}>{t}</span>)}
            </div>
          </div>
        </motion.article>

        {/* SkillForge */}
        <motion.article
          className="project-card"
          initial={pref ? false : { opacity: 0, y: 20 }}
          whileInView={pref ? {} : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ delay: 0.1, duration: normal, ease }}
        >
          <SkillForgeMockup />
          <div className="pc-body">
            <div className="pc-badges">
              <span className="status-pill dev">{projectStatuses.skillForge}</span>
              <span className="type-pill">Full Stack · Learning Management System</span>
            </div>
            <h3>SkillForge</h3>
            <p>A learning-management platform designed to organize courses, instructors, learners and structured learning workflows.</p>
            <div className="tags">
              {['React','Node.js','Express','MongoDB','Mongoose'].map(t => <span key={t}>{t}</span>)}
            </div>
          </div>
        </motion.article>

        {/* Disaster Relief */}
        <motion.article
          className="project-card"
          initial={pref ? false : { opacity: 0, y: 20 }}
          whileInView={pref ? {} : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ delay: 0.16, duration: normal, ease }}
        >
          <DisasterGraphMockup />
          <div className="pc-body">
            <div className="pc-badges">
              <span className="status-pill academic">{projectStatuses.disasterRelief}</span>
              <span className="type-pill">Algorithms · Disaster Management · Optimization</span>
            </div>
            <h3>Disaster Relief Resource Optimization</h3>
            <p>A disaster-relief resource-allocation project that applies and compares network-flow algorithms to model how emergency supplies can move through constrained routes.</p>
            <div className="tags">
              {['Python','Graph algorithms','Data structures','Network-flow algorithms','Algorithm analysis'].map(t => <span key={t}>{t}</span>)}
            </div>
          </div>
        </motion.article>
      </div>

      {/* Additional Technical Work */}
      <div className="additional-work">
        <span className="eyebrow">ADDITIONAL TECHNICAL WORK</span>
        {[
          { t: 'Customer Churn Prediction', badge: 'Machine Learning Project', desc: 'A machine-learning project that studies customer data and patterns associated with churn.', tags: ['Python','Pandas','NumPy','Scikit-learn'] },
          { t: 'Employee Management System', badge: 'Academic Full-Stack Project', desc: 'An employee-information management application developed using Java web technologies and a relational database.', tags: ['Java','J2EE','Servlets','MySQL'] },
          { t: 'Machine Translation System', badge: 'Academic NLP Project', desc: 'A language-translation project for translating text and evaluating translated output where implemented.', tags: ['Python','Translation models','NLTK','Text processing'] },
        ].map(w => (
          <div className="additional-row" key={w.t}>
            <div>
              <span className="add-title">{w.t}</span>
              <span className="type-pill">{w.badge}</span>
            </div>
            <p>{w.desc}</p>
            <div className="tags">{w.tags.map(t => <span key={t}>{t}</span>)}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Process / HOW I BUILD ────────────────────────────────────────────────────
function AiEngineerPanel() {
  const tilt = useTilt();
  const pref = useReducedMotion();
  return (
    <motion.div
      className="ops"
      style={pref ? {} : { rotateX: tilt.rotateX, rotateY: tilt.rotateY }}
      onMouseMove={tilt.handleMouseMove}
      onMouseLeave={tilt.handleMouseLeave}
    >
      <div className="ops-top">
        <span><i /> Provider ready</span>
        <span>GPT-4.1-mini · ctx 8k</span>
      </div>
      <div className="ops-grid">
        <div className="incident">
          <span className="eyebrow">SYSTEM PROMPT</span>
          <p style={{ fontFamily: 'monospace', fontSize: '11px', lineHeight: 1.6, color: 'var(--accent)', marginTop: '8px' }}>
            You are a grounded assistant.<br />
            Use only the context below.<br />
            Return structured JSON.
          </p>
          <div style={{ marginTop: '10px', fontSize: '11px', color: '#6a7a3a' }}>
            <span style={{ display: 'block' }}>tokens in: 312</span>
            <span>temperature: 0.3</span>
          </div>
        </div>
        <div className="route">
          <span className="eyebrow" style={{ fontSize: '10px' }}>STRUCTURED OUTPUT</span>
          <div style={{ marginTop: '10px', fontFamily: 'monospace', fontSize: '11px', lineHeight: 1.7, color: 'var(--accent)' }}>
            <span style={{ color: '#6a7a3a' }}>{'{'}</span><br />
            &nbsp;&nbsp;answer: <span style={{ color: '#c8d87a' }}>"…"</span>,<br />
            &nbsp;&nbsp;confidence: <span style={{ color: '#c8d87a' }}>0.94</span>,<br />
            &nbsp;&nbsp;sources: <span style={{ color: '#c8d87a' }}>[ ]</span><br />
            <span style={{ color: '#6a7a3a' }}>{'}'}</span>
          </div>
        </div>
      </div>
      <div className="timeline">
        <span>Prompt sent</span><span>Context injected</span>
        <span>Response parsed</span><span>Output validated</span>
      </div>
    </motion.div>
  );
}

const processSteps = [
  ['01', 'Define the AI Problem', 'Identify what the model must know, what it should return, and exactly where AI fits — not just "add a chatbot."'],
  ['02', 'Design Context & Data Flow', 'Structure prompts and retrieval-ready context flows so the model receives grounded, task-specific input.'],
  ['03', 'Integrate the Provider', 'Wire OpenAI or Gemini through a provider-swappable backend with typed output schemas and safe fallbacks.'],
  ['04', 'Evaluate & Harden', 'Test real edge cases, enforce guardrails, and iterate on outputs so failures remain controlled and observable.'],
];

function Process() {
  const pref = useReducedMotion();
  return (
    <section id="ai-workflow" className="process">
      <div className="process-intro">
        <motion.span
          className="eyebrow"
          initial={pref ? false : { opacity: 0, x: -16 }}
          whileInView={pref ? {} : { opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: normal, ease }}
        >HOW I WORK AS AN AI ENGINEER</motion.span>
        <motion.h2
          initial={pref ? false : { opacity: 0, y: 32 }}
          whileInView={pref ? {} : { opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: slow, ease, delay: 0.1 }}
        >
          Build AI that solves<br />the problem, not just<br />runs the model.
        </motion.h2>
        <motion.div
          className="process-panel-wrap"
          initial={pref ? false : { opacity: 0, y: 24, scale: 0.97 }}
          whileInView={pref ? {} : { opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: slow, ease, delay: 0.25 }}
        >
          <AiEngineerPanel />
        </motion.div>
      </div>
      <div className="process-list-container">
        <svg className="process-line" width="2" height="100%" preserveAspectRatio="none">
          <motion.line x1="1" y1="0" x2="1" y2="100%" stroke="currentColor" strokeWidth="2"
            initial={pref ? false : { pathLength: 0 }}
            whileInView={pref ? {} : { pathLength: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.5, ease }} />
        </svg>
        <ol>
          {processSteps.map((x, i) => (
            <motion.li
              key={x[0]}
              initial={pref ? false : { opacity: 0, x: 28 }}
              whileInView={pref ? {} : { opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: normal, ease, delay: i * 0.12 + 0.2 }}
            >
              <b>{x[0]}</b><div><h3>{x[1]}</h3><p>{x[2]}</p></div>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ─── Approach — 6-step horizontal ─────────────────────────────────────────────
const approachSteps = [
  { n: '01', title: 'Understand the Problem', desc: 'Identify core pain points and requirements.', tag: 'Discovery' },
  { n: '02', title: 'Define Users & Workflows', desc: 'Map out how the system will be used in reality.', tag: 'Architecture' },
  { n: '03', title: 'Plan the Architecture', desc: 'Select the right tools and data models.', tag: 'Systems' },
  { n: '04', title: 'Design the Experience', desc: 'Create functional and clear interfaces.', tag: 'UI/UX' },
  { n: '05', title: 'Implement the System', desc: 'Build the frontend, backend, and API integrations.', tag: 'Full-Stack' },
  { n: '06', title: 'Test & Improve', desc: 'Refine based on usage edge cases.', tag: 'Iteration' },
];

function Approach() {
  const pref = useReducedMotion();
  return (
    <section id="approach" className="approach-section">
      <motion.h2
        initial={pref ? false : { opacity: 0, y: 20 }}
        whileInView={pref ? {} : { opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: slow, ease }}
      >
        How I Approach a Build
      </motion.h2>
      <motion.div
        className="approach-grid"
        variants={pref ? {} : staggerReveal}
        initial="hidden"
        whileInView="visible"
        viewport={viewportOnce}
      >
        {approachSteps.map(s => (
          <motion.article
            key={s.n}
            className="approach-card"
            variants={pref ? {} : revealUp}
          >
            <div className="approach-marker"><span className="approach-dot" /><span /></div>
            <div className="approach-num">Step {s.n}</div>
            <h3>{s.title}</h3>
            <p>{s.desc}</p>
            <span className="approach-tag">{s.tag}</span>
          </motion.article>
        ))}
      </motion.div>
    </section>
  );
}

// ─── Capabilities ─────────────────────────────────────────────────────────────
const aiCaps = [
  { icon: Cpu, title: 'Build AI-Enabled Products', desc: 'Build full-stack product workflows where the AI layer has clear application boundaries, validated output, and useful fallback behavior.' },
  { icon: Plug, title: 'Build Provider-Swappable AI Backends', desc: 'Integrate OpenAI or Gemini through a provider-neutral boundary with structured output and safe error handling.' },
  { icon: Bot, title: 'Build AI Copilot UX', desc: 'Design and implement context-aware assistant interfaces that surface AI actions within existing product workflows.' },
  { icon: Braces, title: 'Engineer Prompts That Hold', desc: 'Write system instructions, examples, and context patterns that support reliable, structured outputs.' },
  { icon: Database, title: 'Build Retrieval-Grounded AI Foundations', desc: 'Design RAG-ready context flows and application boundaries without overstating unimplemented retrieval infrastructure.' },
  { icon: ShieldCheck, title: 'Evaluate & Harden AI Output', desc: 'Test model behavior against real edge cases, enforce output schemas, and add guardrails so the system degrades gracefully.' },
];

const technicalFoundation = [
  { category: 'Languages', items: ['Python','JavaScript','TypeScript','Java','C','C++','HTML','CSS'] },
  { category: 'Frontend', items: ['React','Vite','Tailwind CSS','shadcn/ui','Component architecture','Form validation'] },
  { category: 'Backend', items: ['Node.js','Express','REST APIs','JWT','Role-based authorization','Validation'] },
  { category: 'Databases', items: ['MongoDB','Mongoose','PostgreSQL','MySQL','Database modelling'] },
  { category: 'AI & NLP', items: ['LLM architecture','Prompt engineering','NLP','Machine translation','RAG foundations'] },
  { category: 'Tools', items: ['Git','GitHub','Docker foundations','Linux foundations','Postman','VS Code'] },
];

function ArchDiagram() {
  return (
    <div className="arch-diagram">
      <div className="arch-flow">
        <div className="arch-node">User Interface</div>
        <span className="arch-arrow">→</span>
        <div className="arch-node active">Application Context</div>
        <span className="arch-arrow">→</span>
        <div className="arch-node">AI Orchestration</div>
        <span className="arch-arrow">→</span>
        <div className="arch-adapter">
          <span className="adapter-label">ADAPTER</span>
          <div className="adapter-rows">
            <span>Model</span>
            <span>Retrieval</span>
            <span>Tools</span>
          </div>
        </div>
      </div>
      <span className="arch-caption">CURRENT ARCHITECTURE APPROACH</span>
    </div>
  );
}

function Capabilities() {
  const pref = useReducedMotion();

  return (
    <section id="capabilities" className="section capabilities">
      <div className="section-head">
        <div>
          <span className="eyebrow">02 / CAPABILITIES</span>
          <motion.h2
            initial={pref ? false : { opacity: 0, y: 24 }}
            whileInView={pref ? {} : { opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: slow, ease }}
          >
            What I can build and<br />deliver as an AI engineer.
          </motion.h2>
        </div>
      </div>

      <motion.div
        className="ai-cap-grid"
        variants={pref ? {} : staggerReveal}
        initial="hidden"
        whileInView="visible"
        viewport={viewportOnce}
      >
        {aiCaps.map(c => {
          const Icon = c.icon;
          return (
            <motion.article key={c.title} className="ai-cap-card" variants={pref ? {} : revealUp}>
              <div className="ai-cap-icon"><Icon aria-hidden="true" /></div>
              <h3>{c.title}</h3>
              <p>{c.desc}</p>
            </motion.article>
          );
        })}
      </motion.div>

      <ArchDiagram />

      {/* Technical Foundation */}
      <motion.div
        className="tech-index"
        variants={pref ? {} : staggerReveal}
        initial="hidden"
        whileInView="visible"
        viewport={viewportOnce}
      >
        {technicalFoundation.map((g, i) => (
          <motion.article
            key={g.category}
            className="tech-col"
            variants={pref ? {} : revealUp}
          >
            <div className="tech-heading"><span>{String(i + 1).padStart(2, '0')}</span><h4>{g.category}</h4></div>
            <ul>{g.items.map(it => <li key={it}><span>{it}</span></li>)}</ul>
          </motion.article>
        ))}
      </motion.div>
    </section>
  );
}

// ─── Experience ───────────────────────────────────────────────────────────────
function Experience() {
  const pref = useReducedMotion();
  const exps = [
    {
      role: 'Web Development Intern',
      company: 'UBLOOD Private Limited',
      duration: 'May–July 2024',
      items: ['Contributed to campaign-management interfaces (React, Node.js, Express, MongoDB)', 'Developed donor-data views and fundraising charts', 'Integrated frontend and backend workflows'],
      status: 'Completed'
    },
    {
      role: 'Independent Project Development',
      company: 'Ongoing',
      duration: 'Ongoing',
      items: ['Designing and building AI and full-stack projects', 'Strengthening backend architecture, PostgreSQL, Docker, deployment'],
      status: 'Ongoing independent work — not formal employment'
    }
  ];
  return (
    <section id="experience" className="experience">
      <div className="section-head">
        <div>
          <span className="eyebrow">04 / EXPERIENCE</span>
          <motion.h2
            initial={pref ? false : { opacity: 0, y: 24 }}
            whileInView={pref ? {} : { opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: slow, ease }}
          >
            Where I've built and learned.
          </motion.h2>
        </div>
      </div>
      <motion.div
        className="exp-timeline"
        variants={pref ? {} : staggerReveal}
        initial="hidden"
        whileInView="visible"
        viewport={viewportOnce}
      >
        <motion.span
          className="exp-progress"
          initial={pref ? false : { scaleY: 0 }}
          whileInView={pref ? {} : { scaleY: 1 }}
          viewport={viewportOnce}
          transition={{ duration: 0.9, ease }}
        />
        {exps.map((e, i) => (
          <motion.article
            key={i}
            className="exp-item"
            variants={pref ? {} : revealFromLeft}
          >
            <motion.span className="exp-node" whileInView={pref ? {} : { scale: [0.7, 1.15, 1] }} viewport={viewportOnce} transition={{ duration: normal, ease }} />
            <div className="exp-header">
              <h3>{e.role}</h3>
              <span className="company">— {e.company}</span>
              <span className="duration">{e.duration}</span>
            </div>
            <ul className="exp-responsibilities">
              {e.items.map((r, j) => <li key={j}>{r}</li>)}
            </ul>
            <div className="exp-status"><Check /><span>{e.status}</span></div>
          </motion.article>
        ))}
      </motion.div>
    </section>
  );
}

// ─── About ────────────────────────────────────────────────────────────────────
function About() {
  const pref = useReducedMotion();
  const statement = ['I care about', 'software that stays', 'understandable as', 'it grows.'];
  return (
    <section id="about" className="about">
      <div>
        <span className="eyebrow">03 / ABOUT</span>
        <motion.h2
          className="about-statement"
          variants={pref ? {} : staggerReveal}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
        >
          {statement.map(line => <motion.span key={line} variants={pref ? {} : revealUp}>{line}</motion.span>)}
        </motion.h2>
      </div>
      <motion.div
        className="about-copy"
        variants={pref ? {} : staggerReveal}
        initial="hidden"
        whileInView="visible"
        viewport={viewportOnce}
      >
        <motion.p variants={pref ? {} : revealUp}>Based in Andhra Pradesh, I work across frontend, backend, databases, and AI integrations. I am especially interested in systems where reliable engineering can make high-stakes or everyday work feel more coordinated.</motion.p>
        <motion.p variants={pref ? {} : revealUp}>My current focus is strengthening production backend architecture, retrieval-grounded AI, and the craft of translating ambiguous requirements into maintainable software.</motion.p>
        <motion.div className="focus" variants={pref ? {} : revealUp}>
          <motion.i aria-hidden="true" variants={pref ? {} : revealScaleY} />
          <div><span>Current signal</span><b>Building, learning, documenting.</b></div>
        </motion.div>
      </motion.div>
    </section>
  );
}

// ─── Current Focus ─────────────────────────────────────────────────────────────
function CurrentFocus() {
  const pref = useReducedMotion();
  const groups = [
    { label: 'Active projects', items: ['Emergency Response AI'] },
    { label: 'Engineering focus', items: ['Backend architecture','PostgreSQL','AI-provider integration','RAG foundations','Linux','Docker','Deployment','Production testing'] },
  ];
  return (
    <section id="focus" className="focus-section">
      <div className="section-head">
        <div>
          <span className="eyebrow">05 / CURRENT FOCUS</span>
          <motion.h2
            initial={pref ? false : { opacity: 0, y: 24 }}
            whileInView={pref ? {} : { opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: slow, ease }}
          >
            Currently Building and Learning
          </motion.h2>
        </div>
      </div>
      <motion.div className="focus-groups" variants={pref ? {} : staggerReveal} initial="hidden" whileInView="visible" viewport={viewportOnce}>
        {groups.map(group => (
          <motion.div className="focus-group" key={group.label} variants={pref ? {} : revealUp}>
            <h3>{group.label}</h3>
            <div className="focus-feed">
              {group.items.map(item => <span className="focus-item" key={item}>{item}</span>)}
            </div>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}

// ─── Contact ──────────────────────────────────────────────────────────────────
const contactSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  subject: z.string().min(3),
  message: z.string().min(20)
});
type Contact = z.infer<typeof contactSchema>;

function Contact() {
  const pref = useReducedMotion();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<Contact>({ resolver: zodResolver(contactSchema) });
  const submitContact = useSubmitContact();
  return (
    <section id="contact" className="contact">
      <div>
        <span className="eyebrow">06 / CONTACT</span>
        <motion.h2
          initial={pref ? false : { opacity: 0, y: 24 }}
          whileInView={pref ? {} : { opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: slow, ease }}
        >
          Have a problem worth<br />building around?
        </motion.h2>
        <p>I'm open to software engineering roles, collaborative projects, and thoughtful conversations about full-stack and AI systems.</p>
        <div className="social">
          <a href="mailto:akashsimhadri4@gmail.com"><Mail /> Email <ArrowUpRight /></a>
          <a href="https://github.com/Simhadri-Akash" target="_blank" rel="noreferrer"><Github /> GitHub <ArrowUpRight /></a>
          <a href="https://www.linkedin.com/in/akash-simhadri/" target="_blank" rel="noreferrer"><Linkedin /> LinkedIn <ArrowUpRight /></a>
        </div>
      </div>
      <form className="contact-form" noValidate onSubmit={handleSubmit(d => submitContact.mutate({ data: d }, { onSuccess: () => reset() }))}>
        <div className="field-row">
          <label>Name<input {...register('name')} aria-invalid={!!errors.name} aria-describedby={errors.name ? 'name-error' : undefined} />{errors.name && <span className="field-error" id="name-error" role="alert">Enter at least 2 characters.</span>}</label>
          <label>Email<input {...register('email')} aria-invalid={!!errors.email} aria-describedby={errors.email ? 'email-error' : undefined} />{errors.email && <span className="field-error" id="email-error" role="alert">Enter a valid email address.</span>}</label>
        </div>
        <label>Subject<input {...register('subject')} aria-invalid={!!errors.subject} aria-describedby={errors.subject ? 'subject-error' : undefined} />{errors.subject && <span className="field-error" id="subject-error" role="alert">Enter at least 3 characters.</span>}</label>
        <label>Message<textarea rows={5} {...register('message')} aria-invalid={!!errors.message} aria-describedby={errors.message ? 'message-error' : undefined} />{errors.message && <span className="field-error" id="message-error" role="alert">Enter at least 20 characters.</span>}</label>
        <button className="primary contact-submit" type="submit" disabled={submitContact.isPending} aria-busy={submitContact.isPending}>
          {submitContact.isPending ? 'Sending…' : 'Send a message'} <Send />
        </button>
        <p className="form-status" role="status">
          {submitContact.isSuccess && 'Message received. Akash will reply soon.'}
          {submitContact.isError && 'Something went wrong. Please email directly.'}
        </p>
      </form>
    </section>
  );
}

// ─── Resume Modal ─────────────────────────────────────────────────────────────
function Resume({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? []).filter(element => !element.hasAttribute('hidden'));
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div ref={dialogRef} className="resume-overlay" role="dialog" aria-modal="true" aria-labelledby="resume-dialog-title" tabIndex={-1}>
      <div className="resume-modal">
        <div className="resume-toolbar">
          <span className="resume-toolbar-title" id="resume-dialog-title">Resume</span>
          <div className="resume-toolbar-actions">
            <a
              className="primary resume-print-btn"
              href="/resume/Akash-Simhadri-Resume.pdf"
              download="Akash-Simhadri-Resume.pdf"
            >
              <Download size={15} /> Download PDF
            </a>
            <button ref={closeButtonRef} className="icon resume-close" onClick={onClose} aria-label="Close resume"><X /></button>
          </div>
        </div>
        <div className="resume-body">
          {/* Header */}
          <div className="rv-header">
            <div>
              <h1 className="rv-name">Akash Simhadri</h1>
              <p className="rv-title">Software Engineer · Full-Stack &amp; AI Systems</p>
            </div>
            <div className="rv-contact">
              <a href="mailto:akashsimhadri4@gmail.com">akashsimhadri4@gmail.com</a>
              <a href="https://github.com/Simhadri-Akash" target="_blank" rel="noreferrer">github.com/Simhadri-Akash</a>
              <a href="https://www.linkedin.com/in/akash-simhadri/" target="_blank" rel="noreferrer">linkedin.com/in/akash-simhadri</a>
              <span>Andhra Pradesh, India</span>
            </div>
          </div>

          {/* Objective */}
          <div className="rv-section">
            <h2 className="rv-section-title">Objective</h2>
            <p>Software engineer building dependable full-stack products and AI-enabled systems. Focused on backend engineering, AI integration, and translating complex workflows into clear, maintainable software. Available for software engineering opportunities, including remote and on-site roles.</p>
          </div>

          {/* Education */}
          <div className="rv-section">
            <h2 className="rv-section-title">Education</h2>
            <div className="rv-entry">
              <div className="rv-entry-head">
                <span className="rv-entry-title">B.Tech — Computer Science &amp; Engineering</span>
                <span className="rv-entry-meta">2022–2026</span>
              </div>
              <p>Kalasalingam Academy of Research and Education · Artificial Intelligence and Machine Learning specialization</p>
            </div>
          </div>

          {/* Experience */}
          <div className="rv-section">
            <h2 className="rv-section-title">Experience</h2>
            <div className="rv-entry">
              <div className="rv-entry-head">
                <span className="rv-entry-title">Web Development Intern — UBLOOD Private Limited</span>
                <span className="rv-entry-meta">May–July 2024</span>
              </div>
              <ul className="rv-list">
                <li>Contributed to campaign-management interfaces with React, Node.js, Express, and MongoDB</li>
                <li>Developed donor-data views and fundraising analytics charts (Chart.js)</li>
                <li>Integrated frontend with backend REST API workflows</li>
                <li>Contributed to DonorHub — a donation and campaign-management platform</li>
              </ul>
            </div>
          </div>

          {/* Projects */}
          <div className="rv-section">
            <h2 className="rv-section-title">Projects</h2>
            {[
              {
                title: 'Emergency Response AI',
                status: projectStatuses.emergencyResponse,
                desc: 'AI-enabled emergency-services platform being developed around citizen, dispatch, ambulance, hospital, dashboard, role-based, and AI-assisted workflows. Current work includes frontend architecture, operational interfaces, an AI Copilot frontend module, role-based navigation, and mock data.',
                stack: 'React · TypeScript · Vite · Tailwind CSS · Node.js · Express'
              },
              {
                title: 'CampusConnect',
                status: projectStatuses.campusConnect,
                desc: 'Campus platform for students to discover activities, clubs, and events from one system. Implements event registration, club workflows, and campus organizational data.',
                stack: 'React · JavaScript · Node.js · MongoDB · JWT'
              },
              {
                title: 'DonorHub',
                status: projectStatuses.donorHub,
                desc: 'Donation and campaign-management platform with completed core functionality. Contributed to campaign-management and donor-facing functionality through academic and internship work; UI/UX modernization is in progress.',
                stack: 'React · Node.js · Express · MongoDB · Chart.js'
              },
              {
                title: 'SkillForge',
                status: projectStatuses.skillForge,
                desc: 'Learning-management platform for courses, instructors, and learners with role-aware content delivery and structured workflows.',
                stack: 'React · Node.js · Express · MongoDB'
              },
              {
                title: 'Disaster Relief Resource Optimization',
                status: 'Academic',
                desc: "Applies and compares network-flow algorithms (Ford-Fulkerson, Edmonds-Karp, Dinic's) to model emergency supply routing through constrained routes.",
                stack: 'Python · Graph algorithms · Data structures'
              },
            ].map(p => (
              <div className="rv-entry" key={p.title}>
                <div className="rv-entry-head">
                  <span className="rv-entry-title">{p.title}</span>
                  <span className="rv-entry-meta">{p.status}</span>
                </div>
                <p>{p.desc}</p>
                <p className="rv-stack">{p.stack}</p>
              </div>
            ))}
          </div>

          {/* Skills */}
          <div className="rv-section">
            <h2 className="rv-section-title">Technical Skills</h2>
            <div className="rv-skills-grid">
              {[
                { cat: 'Languages', items: 'Python · JavaScript · TypeScript · Java · C · C++ · HTML · CSS' },
                { cat: 'Frontend', items: 'React · Vite · Tailwind CSS · shadcn/ui · Framer Motion' },
                { cat: 'Backend', items: 'Node.js · Express · REST APIs · JWT · Role-based auth' },
                { cat: 'Databases', items: 'MongoDB · PostgreSQL · MySQL · Mongoose' },
                { cat: 'AI & NLP', items: 'LLM architecture · Prompt engineering · RAG foundations · NLP' },
                { cat: 'Tools', items: 'Git · GitHub · Docker foundations · Linux foundations · Postman' },
              ].map(s => (
                <div className="rv-skill-row" key={s.cat}>
                  <span className="rv-skill-cat">{s.cat}</span>
                  <span>{s.items}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Additional */}
          <div className="rv-section">
            <h2 className="rv-section-title">Additional Academic Projects</h2>
            <div className="rv-skills-grid">
              <div className="rv-skill-row"><span className="rv-skill-cat">Customer Churn Prediction</span><span>Machine learning · Python · Pandas · Scikit-learn</span></div>
              <div className="rv-skill-row"><span className="rv-skill-cat">Employee Management System</span><span>Java · J2EE · Servlets · MySQL</span></div>
              <div className="rv-skill-row"><span className="rv-skill-cat">Machine Translation System</span><span>NLP · Python · NLTK · Text processing</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Chat ─────────────────────────────────────────────────────────────────────
function Chat() {
  const pref = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const launcherRef = useRef<HTMLButtonElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const [log, setLog] = useState<{ role: string; text: string; chips?: string[] }[]>([
    { role: 'bot', text: "Ask me about Akash's projects, engineering approach, or current focus." }
  ]);
  const sendChat = useSendChatMessage();

  useEffect(() => {
    if (open) chatInputRef.current?.focus();
  }, [open]);

  function closeChat() {
    setOpen(false);
    window.requestAnimationFrame(() => launcherRef.current?.focus());
  }

  function send(q: string) {
    if (!q.trim() || sendChat.isPending) return;
    setLog(l => [...l, { role: 'user', text: q }]);
    setText('');
    sendChat.mutate({ data: { message: q } }, {
      onSuccess: (d) => setLog(l => [...l, { role: 'bot', text: d.answer, chips: d.suggestedQuestions }]),
      onError: () => setLog(l => [...l, { role: 'bot', text: 'Could not reach the assistant. Email Akash directly.' }])
    });
  }

  return (
    <>
      <motion.div
        className={`chat-launch-shell${open ? ' is-open' : ''}`}
        animate={pref ? undefined : { y: [0, -3, 0] }}
        transition={pref ? undefined : { duration: 3.6, ease: 'easeInOut', repeat: Infinity }}
      >
        <motion.button
          ref={launcherRef}
          className="chat-launch"
          type="button"
          onClick={() => setOpen(!open)}
          aria-label={open ? 'Close portfolio assistant' : 'Open portfolio assistant'}
          aria-expanded={open}
          aria-controls="portfolio-assistant"
          aria-haspopup="dialog"
          aria-describedby="chat-launch-tooltip"
          whileHover={pref ? undefined : { scale: 1.04, y: -3 }}
          whileTap={pref ? undefined : { scale: 0.97 }}
        >
          <span className="chat-launch-media" aria-hidden="true">
            <video
              className="chat-launch-video"
              src="/media/ai-assistant.webm"
              autoPlay
              loop
              muted
              playsInline
              preload="metadata"
              disablePictureInPicture
            />
          </span>
          <span className="chat-launch-tooltip" id="chat-launch-tooltip" role="tooltip">Ask Akash AI</span>
        </motion.button>
      </motion.div>
      {open && (
        <aside
          className="chat"
          id="portfolio-assistant"
          role="dialog"
          aria-modal="false"
          aria-labelledby="portfolio-assistant-title"
          onKeyDown={event => { if (event.key === 'Escape') closeChat(); }}
        >
          <div className="chat-head">
            <div>
              <Sparkles size={20} style={{ color: 'var(--accent)' }} />
              <div><span id="portfolio-assistant-title">Akash AI</span><small>Grounded portfolio guide</small></div>
            </div>
            <button onClick={closeChat} aria-label="Close chat"><X /></button>
          </div>
          <div className="messages" aria-live="polite" aria-relevant="additions" aria-busy={sendChat.isPending}>
            {log.map((x, i) => (
              <div className={`msg-wrapper ${x.role}`} key={i}>
                <p className={x.role}>{x.text}</p>
                {x.chips && x.chips.length > 0 && (
                  <div className="chat-suggestions">
                    {x.chips.map(chip => <button key={chip} onClick={() => send(chip)} type="button">{chip}</button>)}
                  </div>
                )}
              </div>
            ))}
            {sendChat.isPending && <div className="msg-wrapper bot"><p className="bot">Checking the portfolio…</p></div>}
          </div>
          <form onSubmit={e => { e.preventDefault(); send(text); }}>
            <label className="sr-only" htmlFor="chat-input">Ask a question</label>
            <input ref={chatInputRef} id="chat-input" value={text} onChange={e => setText(e.target.value)} placeholder="Ask about a project…" />
            <button aria-label="Send message" disabled={sendChat.isPending}><ArrowUpRight /></button>
          </form>
        </aside>
      )}
    </>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer>
      <div className="mark">AS<span>.</span></div>
      <p>Designed and engineered by Akash Simhadri.</p>
      <a href="#top">Back to top ↑</a>
    </footer>
  );
}

// ─── Portfolio ────────────────────────────────────────────────────────────────
function Portfolio() {
  const [resumeOpen, setResumeOpen] = useState(false);
  const resumeButtonRef = useRef<HTMLButtonElement>(null);
  // Initial-load scroll position and stale-hash normalization are handled
  // once in main.tsx, before this component mounts. A normal browser
  // refresh must always land on the hero, not on whatever section a
  // previous in-page navigation left in the URL. Clicking a nav link after
  // load still works via the browser's native anchor-hash scrolling.
  useEffect(() => {
    const content = document.getElementById('portfolio-content');
    if (!content) return;
    if (resumeOpen) {
      content.setAttribute('inert', '');
      content.setAttribute('aria-hidden', 'true');
    } else {
      content.removeAttribute('inert');
      content.removeAttribute('aria-hidden');
    }
  }, [resumeOpen]);

  function closeResume() {
    const content = document.getElementById('portfolio-content');
    content?.removeAttribute('inert');
    content?.removeAttribute('aria-hidden');
    setResumeOpen(false);
    window.setTimeout(() => resumeButtonRef.current?.focus(), 0);
  }
  return (
    <>
      <div id="portfolio-content">
        <Nav onResume={() => setResumeOpen(true)} resumeButtonRef={resumeButtonRef} />
        <main id="top">
          <Hero />
          <PortfolioStats />
          <Work />
          <Process />
          <Approach />
          <Capabilities />
          <Experience />
          <About />
          <CurrentFocus />
          <Contact />
        </main>
        <Footer />
        <Chat />
      </div>
      {resumeOpen && <Resume onClose={closeResume} />}
    </>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={client}>
      <Portfolio />
    </QueryClientProvider>
  );
}
