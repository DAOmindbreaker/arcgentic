import { ExternalLink } from 'lucide-react';

const PARTNERS = [
  {
    name: 'Arc L1',
    role: 'Layer-1 Blockchain',
    desc: 'USDC-native L1 with sub-second finality and zero ETH gas.',
    url: 'https://arc.io',
    glow: 'rgba(16,185,129,0.18)',
    border: 'rgba(16,185,129,0.22)',
    iconBg: 'from-emerald-500/20 to-emerald-700/5',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-emerald-400">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M8 12h8M12 8v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    name: 'Circle',
    role: 'Native USDC & CCTP',
    desc: 'Issuer of USDC and CCTP v2 cross-chain transfer protocol.',
    url: 'https://circle.com',
    glow: 'rgba(124,58,237,0.20)',
    border: 'rgba(124,58,237,0.22)',
    iconBg: 'from-violet-500/20 to-violet-700/5',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-violet-400">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
        <circle cx="12" cy="12" r="5"  stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    ),
  },
  {
    name: 'Arc Studio',
    role: 'Development Framework',
    desc: 'The onchain app builder — write, audit, and deploy in minutes.',
    url: 'https://studio.arc.io',
    glow: 'rgba(96,175,245,0.16)',
    border: 'rgba(96,175,245,0.18)',
    iconBg: 'from-blue-500/20 to-blue-700/5',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-blue-400">
        <rect x="3"  y="3"  width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="13" y="3"  width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="3"  y="13" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="13" y="13" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    ),
  },
];

export function EcosystemSection() {
  return (
    <div className="space-y-4 pt-2 pb-4">
      {/* Section label */}
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--subtle)] syne">Supported By</p>

      {/* Partner badges — horizontal row on sm+, stacked on xs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {PARTNERS.map(p => (
          <a
            key={p.name}
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group rounded-2xl border p-4 flex items-center gap-3 transition-all duration-200 hover:-translate-y-0.5 min-h-[68px]"
            style={{ borderColor: p.border, background: 'rgba(255,255,255,0.025)' }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 0 20px ${p.glow}`; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
          >
            {/* Icon badge */}
            <div className={`p-2 rounded-xl bg-gradient-to-br ${p.iconBg} border border-white/8 shrink-0 backdrop-blur-sm`}>
              {p.icon}
            </div>

            {/* Text */}
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold text-[var(--ink)] leading-none">{p.name}</p>
              <p className="text-[10px] font-semibold text-[var(--subtle)] uppercase tracking-wide mt-1">{p.role}</p>
            </div>

            {/* External link — appears on hover */}
            <ExternalLink className="w-3.5 h-3.5 text-[var(--subtle)] shrink-0 opacity-0 group-hover:opacity-70 transition-opacity" />
          </a>
        ))}
      </div>

      {/* Minimal footer note */}
      <p className="text-center text-[10px] text-[var(--subtle)] pt-1">
        Built on Arc L1 · Powered by Circle USDC &amp; CCTP v2
      </p>
    </div>
  );
}
