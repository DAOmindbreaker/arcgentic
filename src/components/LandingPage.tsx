import React, { useState } from 'react';
import { 
  Shield, 
  Zap, 
  Bot, 
  ArrowRight, 
  Lock, 
  TrendingUp, 
  CheckCircle2, 
  ExternalLink,
  ChevronRight
} from 'lucide-react';

interface LandingPageProps {
  onLaunch: () => void;
}

export function LandingPage({ onLaunch }: LandingPageProps) {
  const [activeTab, setActiveTab] = useState<'treasury' | 'guardrails' | 'yield'>('treasury');

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-[#111827] font-sans antialiased selection:bg-sky-100 selection:text-sky-900">
      
      {/* Navbar */}
      <header className="sticky top-0 z-50 bg-[#F9FAFB]/90 backdrop-blur-md border-b border-black/[0.05]">
        <div className="max-w-7xl mx-auto px-6 h-16 grid grid-cols-3 items-center">
          {/* Left: Logo */}
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl shadow-sm overflow-hidden shrink-0 bg-sky-50 border border-sky-100">
              <img
                src="https://raw.githubusercontent.com/DAOmindbreaker/arcgentic/main/public/logo.png"
                alt="ArcGentic"
                width={36}
                height={36}
                className="w-full h-full object-contain"
                onError={(e) => {
                  const el = e.currentTarget;
                  el.style.display = 'none';
                  const parent = el.parentElement;
                  if (parent) {
                    parent.style.background = '#0284c7';
                    parent.innerHTML = '<span style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:white;font-weight:700;font-size:13px;font-family:monospace">AG</span>';
                  }
                }}
              />
            </div>
            <span className="font-bold text-base tracking-tight text-[#111827]">ArcGentic</span>
            <span className="hidden sm:inline-block px-2.5 py-0.5 text-[10px] font-mono font-medium bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
              Arc Mainnet
            </span>
          </div>

          {/* Center: Nav links */}
          <nav className="hidden md:flex items-center justify-center space-x-1">
            <a href="#features" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-all">Features</a>
            <a href="#solutions" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-all">Solutions</a>
            <a href="#security" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-all">Security</a>
          </nav>

          {/* Right: CTA */}
          <div className="flex items-center justify-end">
            <button
              onClick={onLaunch}
              className="px-4 py-2 text-sm font-semibold text-white bg-[#111827] hover:bg-black rounded-lg transition-all shadow-sm flex items-center space-x-2"
            >
              <span>Launch App</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-20 pb-16 px-6 max-w-5xl mx-auto text-center space-y-8 overflow-visible">
        {/* ── MCU Sci-Fi 3D Portal Assembly ──────────────────────────────────── */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center -z-10 overflow-visible opacity-90"
          style={{ filter: 'drop-shadow(0 0 35px rgba(6,182,212,0.45))' }}>

          {/* ① Core portal aura — static radial energy flare */}
          <div className="absolute w-[420px] h-[420px] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.22) 0%, rgba(59,130,246,0.14) 40%, transparent 70%)', filter: 'blur(32px)' }} />

          {/* ② Upper/Back arch ring — counter-clockwise 25s */}
          <svg className="absolute w-[640px] h-[320px]"
            style={{ animation: 'spin-reverse 25s linear infinite', transformOrigin: '50% 100%', filter: 'drop-shadow(0 0 18px rgba(6,182,212,0.7))' }}
            viewBox="0 0 640 320" fill="none">
            <defs>
              <linearGradient id="mcu-arch" x1="0" y1="0" x2="640" y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0%"   stopColor="#06b6d4" stopOpacity="0.1" />
                <stop offset="25%"  stopColor="#06b6d4" stopOpacity="0.9" />
                <stop offset="50%"  stopColor="#10b981" />
                <stop offset="75%"  stopColor="#06b6d4" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.1" />
              </linearGradient>
              <linearGradient id="mcu-arch2" x1="0" y1="0" x2="640" y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0%"   stopColor="#3b82f6" stopOpacity="0.05" />
                <stop offset="30%"  stopColor="#3b82f6" stopOpacity="0.6" />
                <stop offset="50%"  stopColor="#6366f1" stopOpacity="0.8" />
                <stop offset="70%"  stopColor="#3b82f6" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.05" />
              </linearGradient>
            </defs>
            {/* Primary arch */}
            <path d="M 20 320 A 300 300 0 0 1 620 320" stroke="url(#mcu-arch)" strokeWidth="3" fill="none" />
            {/* Inner arch track */}
            <path d="M 60 320 A 260 260 0 0 1 580 320" stroke="url(#mcu-arch2)" strokeWidth="1.5" strokeDasharray="10 8" fill="none" />
            {/* Outer arch track */}
            <path d="M 0 320 A 320 320 0 0 1 640 320" stroke="#06b6d4" strokeWidth="0.75" strokeDasharray="3 20" strokeOpacity="0.45" fill="none" />
            {/* Circuit node dots on arch */}
            {[0.15, 0.3, 0.5, 0.7, 0.85].map((t, i) => {
              const angle = Math.PI * (1 - t);
              const r = 300, cx2 = 320, cy2 = 320;
              const x = cx2 + r * Math.cos(angle), y = cy2 - r * Math.sin(angle);
              return (
                <g key={i}>
                  <circle cx={x} cy={y} r="4" fill={i === 2 ? '#10b981' : '#06b6d4'} fillOpacity="0.95" />
                  <circle cx={x} cy={y} r="8" fill={i === 2 ? '#10b981' : '#06b6d4'} fillOpacity="0.2" />
                </g>
              );
            })}
            {/* Holographic circuit tick marks */}
            {[0.1, 0.25, 0.4, 0.6, 0.75, 0.9].map((t, i) => {
              const angle = Math.PI * (1 - t);
              const r = 300, cx2 = 320, cy2 = 320;
              const nx = Math.cos(angle), ny = -Math.sin(angle);
              const x1 = cx2 + (r - 12) * nx, y1 = cy2 + (r - 12) * ny;
              const x2 = cx2 + (r + 12) * nx, y2 = cy2 + (r + 12) * ny;
              return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#10b981" strokeWidth="1.5" strokeOpacity="0.7" />;
            })}
          </svg>

          {/* ③ Lower pedestal base — clockwise 35s */}
          <svg className="absolute w-[640px] h-[220px]"
            style={{ animation: 'spin-slow 35s linear infinite', transformOrigin: '50% 0%', filter: 'drop-shadow(0 0 14px rgba(59,130,246,0.6))' }}
            viewBox="0 0 640 220" fill="none">
            <defs>
              <linearGradient id="mcu-ped" x1="0" y1="0" x2="640" y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0%"   stopColor="#3b82f6" stopOpacity="0.05" />
                <stop offset="30%"  stopColor="#3b82f6" stopOpacity="0.8" />
                <stop offset="50%"  stopColor="#06b6d4" />
                <stop offset="70%"  stopColor="#3b82f6" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.05" />
              </linearGradient>
            </defs>
            {/* Primary platform ellipse */}
            <ellipse cx="320" cy="40" rx="300" ry="40" stroke="url(#mcu-ped)" strokeWidth="2.5" fill="none" />
            {/* HUD ring 1 */}
            <ellipse cx="320" cy="40" rx="260" ry="32" stroke="#06b6d4" strokeWidth="1" strokeDasharray="8 10" strokeOpacity="0.5" fill="none" />
            {/* HUD ring 2 */}
            <ellipse cx="320" cy="40" rx="220" ry="26" stroke="#6366f1" strokeWidth="0.75" strokeDasharray="4 16" strokeOpacity="0.4" fill="none" />
            {/* Pedestal vertical pillars */}
            {[0.15, 0.35, 0.5, 0.65, 0.85].map((t, i) => {
              const angle = Math.PI * (1 - t);
              const rx2 = 300, ry2 = 40;
              const x = 320 + rx2 * Math.cos(angle);
              const y = 40 - ry2 * Math.sin(angle);
              return (
                <g key={i}>
                  <line x1={x} y1={y} x2={x} y2={y + 60 + i * 8} stroke="#3b82f6" strokeWidth="1" strokeOpacity="0.45" />
                  <circle cx={x} cy={y} r="3.5" fill="#3b82f6" fillOpacity="0.8" />
                </g>
              );
            })}
            {/* Neon HUD ticks */}
            {[0.05,0.2,0.38,0.5,0.62,0.8,0.95].map((t, i) => {
              const angle = Math.PI * (1 - t);
              const rx2 = 300, ry2 = 40;
              const nx = Math.cos(angle), ny = -Math.sin(angle) * (ry2 / rx2);
              const scale = Math.sqrt(nx * nx * rx2 * rx2 + ny * ny * rx2 * rx2) / rx2;
              const x1 = 320 + (rx2 - 10) * Math.cos(angle);
              const y1 = 40 - (ry2 - 4) * Math.sin(angle);
              const x2 = 320 + (rx2 + 10) * Math.cos(angle);
              const y2 = 40 - (ry2 + 4) * Math.sin(angle);
              return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#06b6d4" strokeWidth="1.5" strokeOpacity="0.7" />;
            })}
          </svg>

          {/* ④ Ambient connecting glow between arch and pedestal */}
          <div className="absolute w-[180px] h-[180px] rounded-full bg-cyan-500/20 blur-3xl" />

        </div>
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white border border-gray-200 shadow-2xs text-xs font-medium text-gray-700">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Autonomous Corporate Treasury on Arc L1</span>
        </div>

        <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight text-[#111827] leading-[1.08]">
          The self-driving USDC treasury with <span className="text-sky-600">unbreakable guardrails.</span>
        </h1>

        <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto font-normal leading-relaxed">
          ArcGentic automatically optimizes yield across Arc Mainnet protocols while hard-enforcing on-chain daily spend limits and allowlists.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          <button
            onClick={onLaunch}
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-base transition-all shadow-md shadow-sky-600/20 flex items-center justify-center space-x-2"
          >
            <span>Open Treasury Dashboard</span>
            <ChevronRight className="w-4 h-4" />
          </button>
          <a
            href="https://github.com/DAOmindbreaker/arcgentic"
            target="_blank"
            rel="noreferrer"
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 text-gray-800 font-semibold text-base transition-all shadow-2xs flex items-center justify-center space-x-2"
          >
            <span>View Smart Contracts</span>
            <ExternalLink className="w-4 h-4 text-gray-400" />
          </a>
        </div>
      </section>

      {/* Metric Cards */}
      <section id="features" className="py-12 px-6 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 bg-white rounded-2xl border border-gray-200/80 shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <span>Security Standard</span>
              <Shield className="w-4 h-4 text-sky-600" />
            </div>
            <div className="text-3xl font-bold font-mono tracking-tight text-gray-900">OpenZeppelin v5</div>
            <p className="text-xs text-gray-500">ReentrancyGuard & Enforced Access Control</p>
          </div>

          <div className="p-6 bg-white rounded-2xl border border-gray-200/80 shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <span>Daily Spend Cap</span>
              <Lock className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-3xl font-bold font-mono tracking-tight text-gray-900">Hard-Capped</div>
            <p className="text-xs text-gray-500">On-chain limit resets every 24 hours</p>
          </div>

          <div className="p-6 bg-white rounded-2xl border border-gray-200/80 shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <span>Native Rail</span>
              <Zap className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-3xl font-bold font-mono tracking-tight text-gray-900">Circle CCTP v2</div>
            <p className="text-xs text-gray-500">Native USDC burn-and-mint settlement</p>
          </div>
        </div>
      </section>

      {/* Interactive Tab Switcher */}
      <section id="solutions" className="py-16 px-6 max-w-5xl mx-auto">
        <div className="text-center space-y-3 mb-10">
          <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Built for modern Web3 teams and DAOs</h2>
          <p className="text-gray-600 text-sm">Select a module below to preview how ArcGentic operates on-chain.</p>
        </div>

        <div className="bg-white rounded-3xl border border-gray-200/90 shadow-sm overflow-hidden p-8 space-y-8">
          <div className="flex justify-center border-b border-gray-100 pb-4">
            <div className="inline-flex p-1 bg-gray-100 rounded-xl space-x-1">
              <button
                onClick={() => setActiveTab('treasury')}
                className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  activeTab === 'treasury' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Autonomous Treasury
              </button>
              <button
                onClick={() => setActiveTab('guardrails')}
                className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  activeTab === 'guardrails' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                On-Chain Guardrails
              </button>
              <button
                onClick={() => setActiveTab('yield')}
                className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  activeTab === 'yield' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Smart Yield Routing
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center pt-2">
            <div className="space-y-4">
              <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600">
                {activeTab === 'treasury' && <Bot className="w-5 h-5" />}
                {activeTab === 'guardrails' && <Shield className="w-5 h-5" />}
                {activeTab === 'yield' && <TrendingUp className="w-5 h-5" />}
              </div>
              <h3 className="text-2xl font-bold text-gray-900">
                {activeTab === 'treasury' && 'Programmatic vault control without emotional bias.'}
                {activeTab === 'guardrails' && 'Strict daily limits that no agent or exploit can bypass.'}
                {activeTab === 'yield' && 'Automated allocation to verified Arc lending markets.'}
              </h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                {activeTab === 'treasury' && 'Deposit organizational USDC into ArcGentic. The AI Agent continuously evaluates liquidity demands and allocates idle capital according to your pre-set rules.'}
                {activeTab === 'guardrails' && 'Set a daily expenditure limit on the smart contract. Even if an AI agent generates a transaction, execution automatically reverts if it exceeds the remaining budget.'}
                {activeTab === 'yield' && 'Yield optimization strategies interact strictly with allowlisted protocol addresses, auto-resetting allowances after every strategy execution.'}
              </p>
              <ul className="space-y-2 pt-2 text-xs font-medium text-gray-700">
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Native USDC support on Arc Mainnet (Chain ID 5042)</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Transparent execution logs on explorer.arc.io</span>
                </li>
              </ul>
            </div>

            <div className="bg-gray-50 rounded-2xl border border-gray-200 p-6 space-y-4 font-mono text-xs">
              <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                <span className="text-gray-500 uppercase font-bold">Live Contract Status</span>
                <span className="text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded">ACTIVE</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">Vault Balance:</span>
                  <span className="font-bold text-gray-900">$115,000.00 USDC</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">24h Spend Cap:</span>
                  <span className="font-bold text-gray-900">$10,000.00 USDC</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">AI Agent Address:</span>
                  <span className="text-sky-600">0x0279...94a0</span>
                </div>
              </div>
              <div className="pt-3 border-t border-gray-200">
                <button
                  onClick={onLaunch}
                  className="w-full py-2.5 bg-gray-900 hover:bg-black text-white font-sans font-semibold rounded-lg text-xs transition-colors"
                >
                  Interactive Demo App →
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-8 bg-white mt-20">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-500">
          <div>
            © 2026 ArcGentic. Built with Arc Studio for Arc Microgrants.
          </div>
          <div className="flex items-center space-x-6">
            <a href="https://docs.arc.io" target="_blank" rel="noreferrer" className="hover:text-gray-900">Arc Docs</a>
            <a href="https://explorer.arc.io" target="_blank" rel="noreferrer" className="hover:text-gray-900">Arc Explorer</a>
            <a href="https://developers.circle.com" target="_blank" rel="noreferrer" className="hover:text-gray-900">Circle Devs</a>
          </div>
        </div>
      </footer>

    </div>
  );
}