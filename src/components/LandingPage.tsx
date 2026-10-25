import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowRight, Shield, Zap, Bot, Lock, TrendingUp, CheckCircle2,
  ExternalLink, Activity, Cpu, RefreshCw
} from 'lucide-react';

interface LandingPageProps { onLaunch: () => void; }

// ── Parallax scroll hook ──────────────────────────────────────────────────────
function useParallax(strength = 0.35) {
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    const onScroll = () => setOffset(window.scrollY * strength);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [strength]);
  return offset;
}

// ── Scroll-reveal hook ───────────────────────────────────────────────────────
function useInView(threshold = 0.18): [React.RefObject<HTMLDivElement>, boolean] {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); io.disconnect(); } }, { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, visible];
}

// ── Animated counter ─────────────────────────────────────────────────────────
function useCounter(target: number, run: boolean, decimals = 2, duration = 1400) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!run) return;
    const start = performance.now();
    const frame = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      setVal(parseFloat((p * target).toFixed(decimals)));
      if (p < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }, [run, target, decimals, duration]);
  return val;
}

// ── SVG wave bars ────────────────────────────────────────────────────────────
function WaveBars({ color = '#06b6d4', count = 28 }: { color?: string; count?: number }) {
  const [heights, setHeights] = useState<number[]>(() => Array.from({ length: count }, () => 20 + Math.random() * 60));
  useEffect(() => {
    const id = setInterval(() => {
      setHeights(prev => prev.map(h => Math.max(8, Math.min(88, h + (Math.random() - 0.5) * 28))));
    }, 120);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="flex items-end gap-[3px]" style={{ height: 56 }}>
      {heights.map((h, i) => (
        <div key={i} style={{
          width: 4, height: `${h}%`, background: color,
          borderRadius: 2, opacity: 0.7 + (h / 100) * 0.3,
          transition: 'height 0.12s ease-out',
        }} />
      ))}
    </div>
  );
}

// ── Live stream ticker ────────────────────────────────────────────────────────
const STREAM_EVENTS = [
  { label: 'executeStrategy', value: '+12.40 USDC', color: '#10b981' },
  { label: 'CCTP depositForBurn', value: '500.00 USDC → Base', color: '#06b6d4' },
  { label: 'Guardrail check', value: 'PASS  8,340/10,000', color: '#3b82f6' },
  { label: 'Yield harvested', value: '+4.22 USDC', color: '#10b981' },
  { label: 'spentToday reset', value: '00:00 UTC', color: '#8b5cf6' },
  { label: 'balanceOf vault', value: '125,440.00 USDC', color: '#f59e0b' },
  { label: 'updateDailyLimit', value: '10,000 USDC', color: '#ec4899' },
  { label: 'Arc block #1,984,201', value: '0.42 s finality', color: '#06b6d4' },
];

function LiveStream() {
  const [rows, setRows] = useState(STREAM_EVENTS.slice(0, 5));
  const [throughput, setThroughput] = useState(4.01);
  useEffect(() => {
    const id = setInterval(() => {
      const next = STREAM_EVENTS[Math.floor(Math.random() * STREAM_EVENTS.length)];
      setRows(prev => [next, ...prev.slice(0, 6)]);
      setThroughput(+(3.5 + Math.random() * 1.8).toFixed(2));
    }, 2200);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-900/80 backdrop-blur-md overflow-hidden shadow-2xl"
      style={{ boxShadow: '0 0 60px rgba(6,182,212,0.12), 0 24px 48px rgba(0,0,0,0.4)' }}>
      {/* Header bar */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-700/50 bg-slate-800/60">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-mono font-semibold text-slate-200 tracking-wider uppercase">Arc L1 · Live Stream</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 text-[10px] font-mono bg-cyan-500/15 text-cyan-400 rounded border border-cyan-500/30">Mainnet Connected</span>
          <span className="px-2 py-0.5 text-[10px] font-mono bg-emerald-500/15 text-emerald-400 rounded border border-emerald-500/30">Guardrail: Enforced</span>
        </div>
      </div>

      {/* Throughput row */}
      <div className="px-5 py-4 border-b border-slate-700/30 flex items-end justify-between gap-4">
        <div>
          <div className="text-[11px] font-mono text-slate-500 uppercase tracking-wider mb-1">USDC Throughput</div>
          <div className="text-3xl font-bold font-mono tabular-nums" style={{ color: '#06b6d4' }}>
            {throughput.toFixed(2)}<span className="text-base font-normal text-slate-400 ml-1">USDC/s</span>
          </div>
        </div>
        <WaveBars />
      </div>

      {/* Event log */}
      <div className="px-5 py-3 space-y-0 font-mono text-[11px]">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-3 py-1.5 border-b border-slate-800/60 last:border-0"
            style={{ opacity: i === 0 ? 1 : 1 - i * 0.12, transition: 'opacity 0.4s' }}>
            <span className="shrink-0 w-[6px] h-[6px] rounded-full" style={{ background: r.color }} />
            <span className="text-slate-400 shrink-0 w-[170px] truncate">{r.label}</span>
            <span className="font-semibold" style={{ color: r.color }}>{r.value}</span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-5 py-2.5 bg-slate-800/40 flex items-center gap-2 text-[10px] font-mono text-slate-500">
        <RefreshCw className="w-3 h-3 text-slate-600 animate-spin" style={{ animationDuration: '3s' }} />
        <span>Simulated mainnet activity · Real contract at 0x02793c...94a0</span>
      </div>
    </div>
  );
}

// ── Scroll steps ──────────────────────────────────────────────────────────────
const STEPS = [
  {
    num: '01', title: 'Vault Setup',
    desc: 'Deploy AgentTreasuryVault to Arc Mainnet. Set USDC daily spend limits and register your AI agent address in one transaction.',
    icon: <Cpu className="w-5 h-5" />, color: '#06b6d4',
  },
  {
    num: '02', title: 'AI Yield Routing',
    desc: 'The AI agent calls executeStrategy() to move USDC into whitelisted DeFi protocols — automatically optimising APY every 5 minutes.',
    icon: <TrendingUp className="w-5 h-5" />, color: '#10b981',
  },
  {
    num: '03', title: 'Guardrails Active',
    desc: 'On-chain daily limits, protocol allowlists, and a code-existence guard prevent any single strategy from draining the vault.',
    icon: <Shield className="w-5 h-5" />, color: '#3b82f6',
  },
  {
    num: '04', title: 'Non-Custodial Security',
    desc: 'Only the vault owner can emergencyWithdrawAll(). No third party ever holds your keys. Full on-chain verifiability at all times.',
    icon: <Lock className="w-5 h-5" />, color: '#8b5cf6',
  },
];

// ── Feature cards ─────────────────────────────────────────────────────────────
const FEATURES = [
  { icon: <Bot className="w-6 h-6" />, title: 'Agentic AI Treasury', desc: 'AI agent autonomously allocates USDC yield across whitelisted DeFi protocols with no human intervention required.', color: '#06b6d4' },
  { icon: <Shield className="w-6 h-6" />, title: 'Unbreakable Guardrails', desc: 'Daily spend limits, protocol allowlists, and code-existence checks enforced at the smart contract layer — not the app layer.', color: '#10b981' },
  { icon: <Zap className="w-6 h-6" />, title: 'Sub-Second Finality', desc: 'Arc L1 delivers ~420ms block times and USDC-native gas so strategies execute in real time without ETH friction.', color: '#f59e0b' },
  { icon: <TrendingUp className="w-6 h-6" />, title: 'Live APY Optimisation', desc: 'Weighted APY calculated across all active strategies and rebalanced automatically whenever a better yield opportunity is detected.', color: '#ec4899' },
  { icon: <Lock className="w-6 h-6" />, title: 'Non-Custodial by Design', desc: 'emergencyWithdrawAll() is owner-only and always callable. Your vault, your keys, your USDC — forever.', color: '#8b5cf6' },
  { icon: <Activity className="w-6 h-6" />, title: 'Circle CCTP Bridging', desc: 'Move USDC cross-chain to Ethereum, Base, Arbitrum, and OP Mainnet via Circle CCTP v2 burn-and-mint with ~8s confirmation.', color: '#3b82f6' },
];

// ── Reveal wrapper ────────────────────────────────────────────────────────────
function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const [ref, visible] = useInView();
  return (
    <div ref={ref} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(32px)',
      transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
    }}>
      {children}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function LandingPage({ onLaunch }: LandingPageProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [heroRef, heroVisible] = useInView(0.1);
  const parallaxY = useParallax(0.3);
  const tvlCount  = useCounter(125440, heroVisible, 0, 1600);
  const apyCount  = useCounter(7.42,   heroVisible, 2, 1400);
  const txCount   = useCounter(98412,  heroVisible, 0, 1800);

  // Auto-advance steps
  useEffect(() => {
    const id = setInterval(() => setActiveStep(s => (s + 1) % STEPS.length), 3800);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen font-sans antialiased selection:bg-sky-100"
      style={{ background: '#F9FAFB', color: '#111827' }}>

      {/* ── Navbar ── */}
      <header className="sticky top-0 z-50 border-b"
        style={{ background: 'rgba(249,250,251,0.92)', backdropFilter: 'blur(20px)', borderColor: 'rgba(17,24,39,0.07)' }}>
        <div className="max-w-7xl mx-auto px-6 h-16 grid grid-cols-3 items-center">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0 flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#06b6d4,#3b82f6,#8b5cf6)', boxShadow: '0 0 16px rgba(6,182,212,0.4)' }}>
              <img src="https://raw.githubusercontent.com/DAOmindbreaker/arcgentic/main/public/logo.png"
                alt="ArcGentic" width={36} height={36} className="w-full h-full object-contain"
                onError={e => { e.currentTarget.style.display='none'; }} />
            </div>
            <span className="font-bold text-base tracking-tight" style={{ color: '#111827' }}>ArcGentic</span>
            <span className="hidden sm:inline px-2 py-0.5 text-[10px] font-mono bg-emerald-500/15 text-emerald-400 rounded-full border border-emerald-500/25">
              Arc Mainnet
            </span>
          </div>
          <nav className="hidden md:flex items-center justify-center gap-1">
            {['Features','How It Works','Security'].map(l => (
              <a key={l} href={`#${l.toLowerCase().replace(/ /g,'-')}`}
                className="px-4 py-2 text-sm font-medium rounded-full transition-all"
                style={{ color: '#6B7280' }}
                onMouseEnter={e => { e.currentTarget.style.color='#111827'; e.currentTarget.style.background='rgba(17,24,39,0.05)'; }}
                onMouseLeave={e => { e.currentTarget.style.color='#6B7280'; e.currentTarget.style.background='transparent'; }}>
                {l}
              </a>
            ))}
          </nav>
          <div className="flex items-center justify-end">
            <button onClick={onLaunch}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{ background: 'linear-gradient(135deg,#06b6d4,#3b82f6)', color: '#fff', boxShadow: '0 0 20px rgba(6,182,212,0.3)' }}
              onMouseEnter={e => { e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 0 28px rgba(6,182,212,0.5)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow='0 0 20px rgba(6,182,212,0.3)'; }}>
              Launch App <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative pt-24 pb-20 px-6 text-center overflow-hidden" style={{ minHeight: '92vh' }}>
        {/* Parallax sci-fi background image */}
        <div className="absolute inset-0 pointer-events-none will-change-transform"
          style={{ transform: `translateY(${parallaxY}px)`, transition: 'transform 0.05s linear' }}>
          <img
            src="https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=1800&q=80"
            alt=""
            aria-hidden="true"
            className="w-full h-full object-cover object-center opacity-[0.42]"
            style={{ filter: 'saturate(1.4) brightness(0.9)' }}
          />
        </div>
        {/* Dual-layer overlay: radial vignette + grid */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse 90% 70% at 50% 50%, rgba(249,250,251,0.0) 0%, rgba(249,250,251,0.45) 55%, rgba(249,250,251,0.92) 100%)',
        }} />
        <div className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: 'linear-gradient(rgba(17,24,39,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(17,24,39,0.05) 1px,transparent 1px)', backgroundSize: '48px 48px' }} />
        {/* Cyan ambient top glow */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse 70% 40% at 50% 0%, rgba(6,182,212,0.10) 0%, transparent 65%)',
        }} />

        <div className="relative max-w-5xl mx-auto space-y-8 flex flex-col items-center justify-center" style={{ minHeight: '72vh' }}>
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-mono font-medium"
            style={{ background: 'rgba(6,182,212,0.07)', borderColor: 'rgba(6,182,212,0.3)', color: '#0891b2' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Deployed on Arc Mainnet · Chain ID 5042
          </div>

          {/* Headline — frosted backdrop for crisp contrast over the image */}
          <div className="px-8 py-8 md:px-12 md:py-10 rounded-3xl" style={{
            background: 'rgba(255,255,255,0.75)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.6)',
            boxShadow: '0 8px 48px rgba(6,182,212,0.12), 0 2px 0 rgba(255,255,255,0.9) inset',
          }}>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-none">
              <span style={{ color: '#111827' }}>THE SELF-DRIVING</span>
              <br />
              <span style={{ background: 'linear-gradient(90deg,#06b6d4,#3b82f6,#8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                USDC TREASURY
              </span>
              <br />
              <span style={{ color: '#111827' }}>WITH </span>
              <span style={{ background: 'linear-gradient(90deg,#10b981,#06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                UNBREAKABLE GUARDRAILS
              </span>
            </h1>
          </div>

          <p className="text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed" style={{ color: '#4B5563' }}>
            ArcGentic automates USDC yield allocation with AI-driven on-chain strategies, enforced spending guardrails, and Circle CCTP bridging — all without ever holding your keys.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-4">
            <button onClick={onLaunch}
              className="flex items-center gap-2 px-7 py-3.5 rounded-xl font-bold text-sm transition-all"
              style={{ background: 'linear-gradient(135deg,#06b6d4,#3b82f6)', color: '#fff', boxShadow: '0 0 32px rgba(6,182,212,0.4)' }}
              onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 0 48px rgba(6,182,212,0.6)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow='0 0 32px rgba(6,182,212,0.4)'; }}>
              Launch Treasury App <ArrowRight className="w-4 h-4" />
            </button>
            <a href="https://github.com/DAOmindbreaker/arcgentic" target="_blank" rel="noreferrer"
              className="flex items-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-sm border transition-all"
              style={{ borderColor: 'rgba(17,24,39,0.15)', color: '#374151' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor='rgba(17,24,39,0.3)'; e.currentTarget.style.color='#111827'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor='rgba(17,24,39,0.15)'; e.currentTarget.style.color='#374151'; }}>
              View Source <ExternalLink className="w-4 h-4" />
            </a>
          </div>

          {/* Stats */}
          <div ref={heroRef} className="grid grid-cols-3 gap-6 pt-8 max-w-xl mx-auto">
            {[
              { label: 'TVL', value: `$${tvlCount.toLocaleString()}`, unit: 'USDC' },
              { label: 'Live APY', value: `${apyCount.toFixed(2)}%`, unit: 'weighted' },
              { label: 'Strategies', value: txCount.toLocaleString(), unit: 'executed' },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <div className="text-2xl font-bold font-mono tabular-nums" style={{ color: '#06b6d4' }}>{s.value}</div>
                <div className="text-[11px] font-mono uppercase tracking-wider mt-0.5" style={{ color: '#475569' }}>{s.unit}</div>
                <div className="text-xs mt-0.5" style={{ color: '#64748b' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works + Live Stream ── */}
      <section id="how-it-works" className="py-24 px-6 relative"
        style={{ background: 'rgba(17,24,39,0.02)', borderTop: '1px solid rgba(17,24,39,0.07)', borderBottom: '1px solid rgba(17,24,39,0.07)' }}>
        <div className="max-w-7xl mx-auto">
          <Reveal>
            <div className="text-center mb-16 space-y-3">
              <div className="text-xs font-mono tracking-[0.2em] uppercase" style={{ color: '#06b6d4' }}>Don't take our word for it</div>
              <h2 className="text-3xl sm:text-4xl font-bold" style={{ color: '#111827' }}>Watch it work in real time</h2>
              <p className="text-base max-w-xl mx-auto" style={{ color: '#6B7280' }}>Four on-chain steps. One self-driving treasury. No human in the loop.</p>
            </div>
          </Reveal>

          <div className="grid lg:grid-cols-2 gap-12 items-start">
            {/* Left: scroll steps */}
            <div className="space-y-3">
              {STEPS.map((step, i) => (
                <button key={i} onClick={() => setActiveStep(i)}
                  className="w-full text-left rounded-2xl border p-5 transition-all duration-300"
                  style={{
                    background: activeStep === i ? `rgba(${step.color === '#06b6d4' ? '6,182,212' : step.color === '#10b981' ? '16,185,129' : step.color === '#3b82f6' ? '59,130,246' : '139,92,246'},0.08)` : 'transparent',
                    borderColor: activeStep === i ? step.color + '50' : 'rgba(17,24,39,0.1)',
                    transform: activeStep === i ? 'translateX(4px)' : '',
                  }}>
                  <div className="flex items-start gap-4">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl shrink-0"
                      style={{ background: activeStep === i ? step.color + '20' : 'rgba(17,24,39,0.05)', color: step.color, border: `1px solid ${step.color}30` }}>
                      {step.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-mono" style={{ color: step.color }}>{step.num}</span>
                        <span className="text-sm font-bold" style={{ color: '#111827' }}>{step.title}</span>
                        {activeStep === i && <CheckCircle2 className="w-3.5 h-3.5 ml-auto" style={{ color: step.color }} />}
                      </div>
                      <p className="text-sm leading-relaxed" style={{ color: activeStep === i ? '#4B5563' : '#6B7280' }}>
                        {step.desc}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Right: live stream card */}
            <div className="lg:sticky lg:top-24">
              <Reveal delay={150}>
                <LiveStream />
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <Reveal>
            <div className="text-center mb-16 space-y-3">
              <div className="text-xs font-mono tracking-[0.2em] uppercase" style={{ color: '#10b981' }}>Built different</div>
              <h2 className="text-3xl sm:text-4xl font-bold" style={{ color: '#111827' }}>Everything you need. Nothing you don't.</h2>
            </div>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f, i) => (
              <Reveal key={i} delay={i * 80}>
                <div className="rounded-2xl border p-6 h-full transition-all duration-300 group cursor-default"
                  style={{ background: '#ffffff', borderColor: 'rgba(17,24,39,0.08)' }}
                  onMouseEnter={e => { (e.currentTarget).style.borderColor = f.color + '50'; (e.currentTarget).style.background = f.color + '08'; }}
                  onMouseLeave={e => { (e.currentTarget).style.borderColor = 'rgba(17,24,39,0.08)'; (e.currentTarget).style.background = '#ffffff'; }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                    style={{ background: f.color + '15', color: f.color, border: `1px solid ${f.color}25` }}>
                    {f.icon}
                  </div>
                  <h3 className="text-sm font-bold mb-2" style={{ color: '#111827' }}>{f.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: '#6B7280' }}>{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 px-6 text-center relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 60% 60% at 50% 50%, rgba(6,182,212,0.08) 0%, transparent 70%)' }} />
        <Reveal>
          <div className="relative max-w-2xl mx-auto space-y-6">
            <h2 className="text-4xl font-extrabold leading-tight" style={{ color: '#111827' }}>
              Ready to put your USDC<br />
              <span style={{ background: 'linear-gradient(90deg,#06b6d4,#10b981)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>
                to work autonomously?
              </span>
            </h2>
            <p className="text-base" style={{ color: '#64748b' }}>Connect your wallet, fund the vault, and let ArcGentic handle the rest.</p>
            <button onClick={onLaunch}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-base transition-all"
              style={{ background: 'linear-gradient(135deg,#06b6d4,#3b82f6)', color: '#fff', boxShadow: '0 0 40px rgba(6,182,212,0.35)' }}
              onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 0 56px rgba(6,182,212,0.55)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow='0 0 40px rgba(6,182,212,0.35)'; }}>
              Launch Treasury App <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </Reveal>
      </section>

      {/* ── Footer ── */}
      <footer className="py-8 px-6 border-t text-center" style={{ borderColor: 'rgba(17,24,39,0.08)' }}>
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm" style={{ color: '#6B7280' }}>
            <span className="font-semibold" style={{ color: '#111827' }}>ArcGentic</span>
            <span>·</span>
            <span>Powered by Arc L1 &amp; Circle USDC</span>
          </div>
          <div className="flex items-center gap-5">
            {[
              { label: 'GitHub', href: 'https://github.com/DAOmindbreaker/arcgentic' },
              { label: 'Arc Docs', href: 'https://docs.arc.io' },
              { label: 'Circle Dev', href: 'https://developers.circle.com' },
            ].map(l => (
              <a key={l.label} href={l.href} target="_blank" rel="noreferrer"
                className="text-xs font-medium transition-colors flex items-center gap-1"
                style={{ color: '#6B7280' }}
                onMouseEnter={e => e.currentTarget.style.color='#111827'}
                onMouseLeave={e => e.currentTarget.style.color='#6B7280'}>
                {l.label} <ExternalLink className="w-3 h-3" />
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
