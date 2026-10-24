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
      <header className="sticky top-0 z-50 bg-[#F9FAFB]/80 backdrop-blur-md border-b border-black/[0.05]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
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
            <span className="font-bold text-lg tracking-tight text-[#111827]">ArcGentic</span>
            <span className="hidden sm:inline-block px-2.5 py-0.5 text-[11px] font-mono font-medium bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
              Arc Mainnet
            </span>
          </div>

          <nav className="hidden md:flex items-center space-x-8 text-sm font-medium text-gray-600">
            <a href="#features" className="hover:text-black transition-colors">Features</a>
            <a href="#solutions" className="hover:text-black transition-colors">Solutions</a>
            <a href="#security" className="hover:text-black transition-colors">Security</a>
          </nav>

          <div className="flex items-center space-x-3">
            <button
              onClick={onLaunch}
              className="px-4 py-2 text-sm font-semibold text-white bg-[#111827] hover:bg-black rounded-lg transition-all shadow-sm hover:shadow flex items-center space-x-2"
            >
              <span>Launch App</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-20 pb-16 px-6 max-w-5xl mx-auto text-center space-y-8">
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