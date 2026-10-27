import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useReadContract, useReadContracts, useAccount, useSwitchChain, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { erc20Abi, parseUnits } from 'viem';
import type { EIP1193Provider } from 'viem';
import { ConnectKitButton } from 'connectkit';
import { AppKit } from '@circle-fin/app-kit';
import { createViemAdapterFromProvider } from '@circle-fin/adapter-viem-v2';
import { toast } from 'sonner';
import {
  Bot, ShieldAlert, TrendingUp, Activity, Play, Pause,
  DollarSign, Clock, CheckCircle2, AlertTriangle,
  Copy, ExternalLink, RefreshCw, Layers, ArrowUpRight,
  Lock, Zap, ArrowDownUp, GitBranch,
  ArrowRight, Loader2, Wallet, Settings, Send, AlertCircle, History,
  Sun, Moon, Search, X, ChevronDown,
} from 'lucide-react';
import { TokenUSDC } from '@web3icons/react';
import { Amount, formatUsdc } from '@/onchain-money';
import { getUsdc, requireChain, buildTxExplorerUrl } from '@/onchain-facts';
import { TxHistoryDrawer, useTxHistory, usePendingReceiptWatcher } from '@/components/TxHistory';
import SwapCard from '@/components/SwapCard';
import { EcosystemSection } from '@/components/EcosystemFooter';
import { USDCBalance } from '@/components/USDCBalance';
import { LandingPage } from '@/components/LandingPage';

// ── AppKit instance (keyless — no kitKey in browser) ──────────────────────────
const appKit = new AppKit();

// ── Contract config ────────────────────────────────────────────────────────────
const CHAIN_ID = 5042; // Arc Mainnet
const VAULT_ADDRESS = '0x02793cfd3a14f341da0768bea80a61b32b9a94a0' as const;
const chain = requireChain(CHAIN_ID);
const usdcFact = getUsdc(CHAIN_ID)!;
const USDC_ADDRESS = usdcFact.address;

const VAULT_ABI = [
  { name: 'owner',              type: 'function', stateMutability: 'view',       inputs: [],                                        outputs: [{ type: 'address' }] },
  { name: 'aiAgent',            type: 'function', stateMutability: 'view',       inputs: [],                                        outputs: [{ type: 'address' }] },
  { name: 'dailyLimit',         type: 'function', stateMutability: 'view',       inputs: [],                                        outputs: [{ type: 'uint256' }] },
  { name: 'spentToday',         type: 'function', stateMutability: 'view',       inputs: [],                                        outputs: [{ type: 'uint256' }] },
  { name: 'lastResetTimestamp', type: 'function', stateMutability: 'view',       inputs: [],                                        outputs: [{ type: 'uint256' }] },
  { name: 'usdcToken',          type: 'function', stateMutability: 'view',       inputs: [],                                        outputs: [{ type: 'address' }] },
  { name: 'updateDailyLimit',     type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'newLimit',   type: 'uint256' }],                                                  outputs: [] },
  { name: 'updateAgent',          type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'newAgent',   type: 'address' }],                                                  outputs: [] },
  { name: 'emergencyWithdrawAll', type: 'function', stateMutability: 'nonpayable', inputs: [],                                                                                          outputs: [] },
  { name: 'setAllowedProtocol',   type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'protocol',   type: 'address' }, { name: 'allowed', type: 'bool' }],               outputs: [] },
  { name: 'allowedProtocols',     type: 'function', stateMutability: 'view',       inputs: [{ name: 'protocol',   type: 'address' }],                                                  outputs: [{ type: 'bool' }] },
  { name: 'executeStrategy',      type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'targetProtocol', type: 'address' }, { name: 'amount', type: 'uint256' }, { name: 'data', type: 'bytes' }, { name: 'strategyType', type: 'string' }], outputs: [] },
] as const;

// ── Arc Mainnet token registry ─────────────────────────────────────────────────
// All tokens available for Swap, Send, and balance display.
// Arc USDC is ERC-20 at 0x3600…0000 (6 decimals). EURC is Circle's Euro Coin (6 decimals).
// cirBTC is Circle's canonical BTC token on Arc (8 decimals).
export const ARC_TOKENS = [
  {
    symbol: 'USDC',  label: 'USD Coin',        desc: 'Arc Mainnet Native USDC',
    address: '0x3600000000000000000000000000000000000000' as const,
    decimals: 6,  color: '#2775CA', abbr: 'UC',
  },
  {
    symbol: 'EURC',  label: 'Euro Coin',        desc: 'Circle Euro Coin on Arc',
    address: '0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1' as const,
    decimals: 6,  color: '#3D5AFE', abbr: 'EC',
  },
  {
    symbol: 'cirBTC', label: 'Circle BTC',      desc: 'Circle Wrapped Bitcoin',
    address: '0x29f2D40B0605204364af54EC677bD022dA425d03' as const,
    decimals: 8,  color: '#F7931A', abbr: 'cB',
  },
  {
    symbol: 'WETH',  label: 'Wrapped Ether',    desc: 'Wrapped ETH on Arc',
    address: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14' as const,
    decimals: 18, color: '#627EEA', abbr: 'WE',
  },
  {
    symbol: 'USDT',  label: 'Tether USD',       desc: 'Tether USD on Arc',
    address: '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06' as const,
    decimals: 6,  color: '#26A17B', abbr: 'UT',
  },
] as const;
type ArcTokenSymbol = (typeof ARC_TOKENS)[number]['symbol'];
function getToken(sym: ArcTokenSymbol) { return ARC_TOKENS.find(t => t.symbol === sym)!; }

// Send-eligible tokens (USDC + Circle-issued)
const SENDABLE_TOKENS = ARC_TOKENS.filter(t => ['USDC','EURC','cirBTC'].includes(t.symbol));

// ── Swap tokens (on Arc_Testnet, avoid USDC↔NATIVE — same asset) ─────────────
// Both sides are now selectable. Exclude USDC↔USDC pair.



// ── Bridge destinations — all CCTP v2 EVM mainnet chains supported by App Kit ──
// App Kit BridgeChain enum keys: Arbitrum, Avalanche, Base, Codex, Cronos, Edge,
// Ethereum, HyperEVM, Injective, Ink, Linea, Monad, Morph, Optimism, Pharos,
// Plasma, Plume, Polygon, Sei, Sonic, Unichain, World_Chain, XDC, X_Layer
const BRIDGE_CHAINS = [
  { id: 'Ethereum',   label: 'Ethereum',    chainId: 1,     icon: '🔷', fast: true  },
  { id: 'Base',       label: 'Base',        chainId: 8453,  icon: '🔵', fast: true  },
  { id: 'Arbitrum',   label: 'Arbitrum',    chainId: 42161, icon: '🔵', fast: true  },
  { id: 'Optimism',   label: 'OP Mainnet',  chainId: 10,    icon: '🔴', fast: true  },
  { id: 'Polygon',    label: 'Polygon',     chainId: 137,   icon: '🟣', fast: false },
  { id: 'Avalanche',  label: 'Avalanche',   chainId: 43114, icon: '🔺', fast: false },
  { id: 'Unichain',   label: 'Unichain',    chainId: 130,   icon: '🦄', fast: true  },
  { id: 'Linea',      label: 'Linea',       chainId: 59144, icon: '⬛', fast: true  },
  { id: 'Sonic',      label: 'Sonic',       chainId: 146,   icon: '⚡', fast: false },
  { id: 'World_Chain',label: 'World Chain', chainId: 480,   icon: '🌐', fast: true  },
  { id: 'Ink',        label: 'Ink',         chainId: 57073, icon: '🖊', fast: true  },
  { id: 'Plume',      label: 'Plume',       chainId: 98865, icon: '🪶', fast: true  },
  { id: 'Sei',        label: 'Sei',         chainId: 1329,  icon: '🌊', fast: false },
  { id: 'Monad',      label: 'Monad',       chainId: 10143, icon: '🟪', fast: false },
  { id: 'HyperEVM',   label: 'HyperEVM',    chainId: 998,   icon: '⚙️', fast: false },
  { id: 'XDC',        label: 'XDC',         chainId: 50,    icon: '🔶', fast: false },
  { id: 'Codex',      label: 'Codex',       chainId: 5115,  icon: '📖', fast: true  },
] as const;
type BridgeChainId = (typeof BRIDGE_CHAINS)[number]['id'];

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtAddr(addr: string) { return `${addr.slice(0, 6)}...${addr.slice(-4)}`; }

/** Parse a user-entered USDC amount string → bigint, or null if invalid/non-positive. */
function parseUsdcInput(value: string, decimals: number): bigint | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  if (!isFinite(num) || num <= 0) return null;
  try {
    return parseUnits(trimmed, decimals);
  } catch {
    return null;
  }
}

/** True when rawAmount (bigint) exceeds the wallet balance (also bigint). */
function exceedsBalance(rawAmount: bigint, balance: bigint): boolean {
  return rawAmount > balance;
}

function fmtUsdc(raw: bigint | undefined): string {
  if (raw === undefined) return '—';
  return formatUsdc(raw);
}

function fmtTimestamp(ts: bigint | undefined): string {
  if (!ts) return '—';
  const next = new Date(Number(ts) * 1000 + 86400000);
  return next.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ── Lerped number hook ─────────────────────────────────────────────────────────
function useLerpedNumber(target: number | null, speed = 0.14) {
  const [display, setDisplay] = useState(target ?? 0);
  const ref = useRef(target ?? 0);
  useEffect(() => {
    if (target == null) return;
    let raf = 0;
    const tick = () => {
      ref.current += (target - ref.current) * speed;
      if (Math.abs(target - ref.current) < 0.001) ref.current = target;
      setDisplay(ref.current);
      if (ref.current !== target) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, speed]);
  return display;
}

// ── Theme hook ─────────────────────────────────────────────────────────────────
function useTheme() {
  const [isDark, setIsDark] = useState<boolean>(() => {
    const stored = localStorage.getItem('arcgentic-theme');
    if (stored) return stored === 'dark';
    return false; // default light
  });
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('arcgentic-theme', isDark ? 'dark' : 'light');
  }, [isDark]);
  return { isDark, toggle: () => setIsDark(d => !d) };
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function BudgetBar({ spent, limit }: { spent: bigint; limit: bigint }) {
  const pct = limit === 0n ? 0 : Number((spent * 10000n) / limit) / 100;
  const color = pct >= 90 ? 'bg-[var(--danger)]' : pct >= 60 ? 'bg-[var(--warning)]' : 'bg-[var(--success)]';
  return (
    <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-700 ${color}`}
        style={{ width: `${Math.min(pct, 100)}%`, boxShadow: pct >= 90 ? 'var(--glow-danger)' : pct < 60 ? 'var(--glow-green)' : 'none' }}
      />
    </div>
  );
}

type GlowColor = 'cyan' | 'purple' | 'green' | 'amber';
// ArcGentic palette mapping — emerald=primary, violet=secondary
const CARD_BORDER: Record<GlowColor, string> = {
  cyan:   'border-[rgba(16,185,129,0.22)]  shadow-[0_2px_24px_rgba(16,185,129,0.07)]',
  purple: 'border-[rgba(99,102,241,0.22)]   shadow-[0_2px_24px_rgba(99,102,241,0.08)]',
  green:  'border-[rgba(16,185,129,0.22)]  shadow-[0_2px_24px_rgba(16,185,129,0.07)]',
  amber:  'border-[rgba(245,158,11,0.22)]   shadow-[0_2px_24px_rgba(245,158,11,0.08)]',
};
const CARD_ICON: Record<GlowColor, string> = {
  cyan:   'bg-[rgba(16,185,129,0.10)] border-[rgba(16,185,129,0.22)] text-[#34d399]',
  purple: 'bg-[rgba(99,102,241,0.10)]  border-[rgba(99,102,241,0.22)]  text-[#a5b4fc]',
  green:  'bg-[rgba(16,185,129,0.10)] border-[rgba(16,185,129,0.22)] text-[#34d399]',
  amber:  'bg-[rgba(245,158,11,0.10)]  border-[rgba(245,158,11,0.22)]  text-[#fcd34d]',
};
const CARD_TOP: Record<GlowColor, string> = {
  cyan:   'ag-card',
  purple: 'ag-card ag-card-violet',
  green:  'ag-card',
  amber:  'ag-card ag-card-amber',
};

function GlowStatCard({ label, value, sub, icon: Icon, glow = 'cyan', onClick, editContent }: {
  label: string; value: string; sub?: string; icon: React.ElementType; glow?: GlowColor;
  onClick?: () => void; editContent?: React.ReactNode;
}) {
  return (
    <div
      className={`${CARD_TOP[glow]} p-5 flex flex-col gap-2.5 transition-all strat-card ${CARD_BORDER[glow]} ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-[0.10em] text-[var(--subtle)] syne">{label}</span>
        <div className={`p-1.5 rounded-lg border ${CARD_ICON[glow]}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      <p className="display text-[1.65rem] font-bold text-[var(--ink)] tabular leading-none">{value}</p>
      {sub && <p className="text-[11px] text-[var(--subtle)] mt-0.5">{sub}</p>}
      {editContent}
    </div>
  );
}

// ── Allocation ring (pure SVG, no library) ─────────────────────────────────────
function AllocationRing({ strategies, weightedApy }: {
  strategies: typeof STRATEGIES; weightedApy: string;
}) {
  const total = strategies.reduce((a, s) => a + s.allocated, 0);
  if (total === 0) return null;
  const cx = 60; const cy = 60; const r = 44; const stroke = 10;
  const circ = 2 * Math.PI * r;
  const COLORS = ['#FC72FF', '#10b981', '#6366f1'];
  const arcs = strategies.reduce<{ dash: number; offset: number; color: string }[]>((acc, s, i) => {
    const share = s.allocated / total;
    const dash = share * circ;
    const prevOffset = acc.length > 0 ? acc[acc.length - 1].offset + acc[acc.length - 1].dash : 0;
    return [...acc, { dash, offset: prevOffset, color: COLORS[i % COLORS.length] }];
  }, []);
  return (
    <div className="flex items-center gap-6 flex-wrap">
      <div className="relative shrink-0">
        <svg width={120} height={120} viewBox="0 0 120 120" className="rotate-[-90deg]">
          {/* Track */}
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
          {/* Segments */}
          {arcs.map((arc, i) => (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none"
              stroke={arc.color} strokeWidth={stroke} strokeLinecap="round"
              strokeDasharray={`${arc.dash - 1.5} ${circ - arc.dash + 1.5}`}
              strokeDashoffset={-(arc.offset)}
              style={{ filter: `drop-shadow(0 0 6px ${arc.color}88)` }}
            />
          ))}
        </svg>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="display text-lg font-bold tabular text-[var(--ink)] leading-none">{weightedApy}%</span>
          <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--subtle)] mt-0.5">APY</span>
        </div>
      </div>
      {/* Legend */}
      <div className="flex-1 space-y-2.5 min-w-0">
        {strategies.map((s, i) => {
          const share = total > 0 ? ((s.allocated / total) * 100).toFixed(1) : '0';
          return (
            <div key={s.id} className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length], boxShadow: `0 0 6px ${COLORS[i % COLORS.length]}88` }} />
              <span className="text-[11px] text-[var(--ink-2)] truncate flex-1 min-w-0">{s.name}</span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="mono text-[10px] text-[var(--subtle)]">{share}%</span>
                <span className="text-[10px] font-bold text-[var(--success)]">{s.apy}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Quick action card ──────────────────────────────────────────────────────────
const QA_STYLES: Record<GlowColor, { wrap: string; icon: string; dot: string }> = {
  cyan:   { wrap: 'border-[rgba(16,185,129,0.22)] hover:border-[rgba(16,185,129,0.50)] hover:shadow-[0_6px_28px_rgba(16,185,129,0.12)]', icon: 'bg-[rgba(16,185,129,0.12)] border-[rgba(16,185,129,0.25)] text-[#34d399]', dot: 'bg-[#10b981]' },
  purple: { wrap: 'border-[rgba(99,102,241,0.22)]  hover:border-[rgba(99,102,241,0.50)]  hover:shadow-[0_6px_28px_rgba(99,102,241,0.12)]',  icon: 'bg-[rgba(99,102,241,0.12)]  border-[rgba(99,102,241,0.25)]  text-[#a5b4fc]',  dot: 'bg-[#6366f1]'  },
  green:  { wrap: 'border-[rgba(16,185,129,0.22)] hover:border-[rgba(16,185,129,0.50)] hover:shadow-[0_6px_28px_rgba(16,185,129,0.12)]', icon: 'bg-[rgba(16,185,129,0.12)] border-[rgba(16,185,129,0.25)] text-[#34d399]', dot: 'bg-[#10b981]' },
  amber:  { wrap: 'border-[rgba(245,158,11,0.22)]  hover:border-[rgba(245,158,11,0.50)]  hover:shadow-[0_6px_28px_rgba(245,158,11,0.12)]',  icon: 'bg-[rgba(245,158,11,0.12)]  border-[rgba(245,158,11,0.25)]  text-[#fcd34d]',  dot: 'bg-[#f59e0b]'  },
};

function QuickActionCard({ icon: Icon, label, desc, color, onClick }: {
  icon: React.ElementType; label: string; desc: string; color: GlowColor; onClick: () => void;
}) {
  const s = QA_STYLES[color];
  return (
    <button
      onClick={onClick}
      className={`flex-1 min-w-[100px] ag-card p-4 flex flex-col gap-3 transition-all text-left group border ${s.wrap}`}
    >
      <div className={`p-2.5 rounded-xl border w-fit ${s.icon} group-hover:scale-110 transition-transform`}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="syne text-[13px] font-bold text-[var(--ink)]">{label}</p>
        <p className="text-[10px] text-[var(--subtle)] mt-0.5">{desc}</p>
      </div>
    </button>
  );
}


function AddressRow({ label, value }: { label: string; value: string | undefined }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  function copy() {
    void navigator.clipboard?.writeText(value!);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }
  return (
    <div className="flex items-center justify-between py-3 border-b border-[var(--border)] last:border-0">
      <span className="text-[11px] text-[var(--subtle)]">{label}</span>
      <div className="flex items-center gap-2">
        <span className="mono text-[11px] text-[var(--ink-2)]">{fmtAddr(value)}</span>
        <button onClick={copy} className="p-1 rounded hover:bg-white/10 transition-colors" title="Copy">
          {copied
            ? <CheckCircle2 className="w-3 h-3 text-[var(--success)]" />
            : <Copy className="w-3 h-3 text-[var(--subtle)]" />}
        </button>
        <a href={`${chain.explorerBase}/address/${value}`} target="_blank" rel="noopener noreferrer"
          className="p-1 rounded hover:bg-white/10 transition-colors" title="Explorer">
          <ExternalLink className="w-3 h-3 text-[var(--subtle)]" />
        </a>
      </div>
    </div>
  );
}


// ── Strategies ─────────────────────────────────────────────────────────────────
// Protocol addresses below are PLACEHOLDER addresses for Arc Mainnet.
// The owner must deploy real protocol adapters and call setAllowedProtocol before
// executeStrategy will succeed. These addresses will revert until replaced.
const STRATEGIES = [
  {
    id: 1,
    name: 'Arc Yield Aggregator',
    strategyType: 'YIELD_MAXIMIZATION',
    protocolAddress: '0x1111111111111111111111111111111111111111' as `0x${string}`,
    apy: 7.4,
    risk: 'Low',
    status: 'OPTIMIZED',
    allocated: 65000,
    desc: 'Auto-compounding USDC lending & yield aggregation',
  },
  {
    id: 2,
    name: 'Arc Lending Market',
    strategyType: 'STABLE_LENDING',
    protocolAddress: '0x2222222222222222222222222222222222222222' as `0x${string}`,
    apy: 5.2,
    risk: 'Very Low',
    status: 'STABLE',
    allocated: 35000,
    desc: 'Over-collateralized USDC loans — lowest risk',
  },
  {
    id: 3,
    name: 'Arc FX Delta Neutral',
    strategyType: 'FX_DELTA_NEUTRAL',
    protocolAddress: '0x3333333333333333333333333333333333333333' as `0x${string}`,
    apy: 11.8,
    risk: 'Moderate',
    status: 'ACTIVE_ARBITRAGE',
    allocated: 15000,
    desc: 'USDC/EURC delta-neutral arbitrage vault',
  },
];
const STATUS_STYLES: Record<string, string> = {
  OPTIMIZED:        'bg-emerald-950/50 text-emerald-400 border-emerald-800/40',
  STABLE:           'bg-sky-950/50 text-sky-400 border-sky-800/40',
  ACTIVE_ARBITRAGE: 'bg-violet-950/50 text-violet-400 border-violet-800/40',
};
const RISK_COLOR: Record<string, string> = {
  'Very Low': 'text-emerald-400', Low: 'text-sky-400', Moderate: 'text-amber-400', High: 'text-[var(--danger)]',
};

// ── Activity log ───────────────────────────────────────────────────────────────
type LogEntry = { id: string; type: 'EXECUTION'|'GUARDRAIL'|'ANALYTICS'|'WARNING'; msg: string; txHash: string | null; ts: string };
const LOG_ICON: Record<LogEntry['type'], React.ElementType> = { EXECUTION: ArrowUpRight, GUARDRAIL: ShieldAlert, ANALYTICS: Activity, WARNING: AlertTriangle };
const LOG_COLOR: Record<LogEntry['type'], string> = { EXECUTION: 'text-[var(--accent)]', GUARDRAIL: 'text-emerald-400', ANALYTICS: 'text-[var(--subtle)]', WARNING: 'text-amber-400' };

type Tab = 'dashboard' | 'strategies' | 'guardrails' | 'swap';
type SwapMode = 'swap' | 'bridge';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard',   label: 'Dashboard',     icon: Activity    },
  { id: 'strategies',  label: 'Strategies',    icon: TrendingUp  },
  { id: 'guardrails',  label: 'Guardrails',    icon: ShieldAlert },
  { id: 'swap',        label: 'Swap & Bridge', icon: ArrowDownUp },
];

// ── Main ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [showApp, setShowApp] = useState(false);
  const [tab, setTab]           = useState<Tab>('dashboard');
  const [swapMode, setSwapMode] = useState<SwapMode>('swap');
  const [agentActive, setAgentActive] = useState(true);
  const [logs, setLogs] = useState<LogEntry[]>([{
    id: 'seed-1', type: 'GUARDRAIL',
    msg: 'Vault deployed. Policy enforcement active.',
    txHash: '0xffc667fa535a433ed4b640df933b3b2bad0586f009ee8d34f482e44702ebf258',
    ts: new Date().toLocaleTimeString(),
  }]);

  const { isDark, toggle: toggleTheme } = useTheme();
  const { connector, address: walletAddress, chainId: walletChainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();

  // ── Transaction history ───────────────────────────────────────────────────────
  const [historyOpen, setHistoryOpen] = useState(false);
  const { records: txRecords, addTxRecord, updateTxStatus, clearHistory } = useTxHistory(walletAddress);
  // Auto-resolve pending tx statuses by polling Arc Mainnet receipt
  usePendingReceiptWatcher(txRecords, walletAddress, updateTxStatus, historyOpen);

  /** Build a stable record id from txHash or a local id */
  function txId(base: string) { return `${base}-${Date.now()}`; }

  // ── Live connected-wallet USDC balance ───────────────────────────────────────
  const { data: walletUsdcBalance } = useReadContract({
    address: USDC_ADDRESS, abi: erc20Abi, functionName: 'balanceOf',
    args: walletAddress ? [walletAddress] : undefined,
    chainId: CHAIN_ID,
    query: { enabled: !!walletAddress, refetchInterval: 8000 },
  });

  // ── Write hooks ──────────────────────────────────────────────────────────────
  const { writeContractAsync: writeVault } = useWriteContract();

  function parseOnchainError(e: unknown): string {
    const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
    if (msg.includes('user rejected') || msg.includes('user denied')) return 'Transaction cancelled.';
    if (msg.includes('insufficient') || msg.includes('exceeds balance')) return 'Insufficient USDC balance.';
    if (msg.includes('reverted')) {
      const m = msg.match(/reason="([^"]+)"/);
      return m ? `Transaction failed: ${m[1]}` : 'Transaction reverted on-chain.';
    }
    if (msg.includes('network') || msg.includes('timeout')) return 'Network error — please retry.';
    return e instanceof Error ? e.message : 'Something went wrong.';
  }

  // updateDailyLimit state
  const [newLimitInput, setNewLimitInput] = useState('');
  const [limitTxHash, setLimitTxHash]   = useState<`0x${string}` | undefined>();
  const [limitPending, setLimitPending] = useState(false);
  const { isLoading: limitConfirming, isSuccess: limitSuccess } = useWaitForTransactionReceipt({ hash: limitTxHash, chainId: CHAIN_ID });
  useEffect(() => {
    if (limitSuccess && limitTxHash) updateTxStatus(limitTxHash, 'confirmed');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limitSuccess, limitTxHash]);

  async function handleUpdateLimit() {
    if (!walletAddress) { toast.error('Connect your wallet first'); return; }
    const rawLimit = parseUsdcInput(newLimitInput, usdcFact.decimals);
    if (rawLimit === null) { toast.error('Enter a valid positive USDC limit'); return; }
    if (walletChainId !== CHAIN_ID) {
      try { await switchChainAsync({ chainId: CHAIN_ID }); }
      catch { toast.error('Please switch to Arc Mainnet'); return; }
    }
    setLimitPending(true);
    const tid = toast.loading('Sending updateDailyLimit…');
    try {
      const hash = await writeVault({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'updateDailyLimit', args: [rawLimit], chainId: CHAIN_ID });
      setLimitTxHash(hash);
      toast.dismiss(tid);
      toast.success('Daily limit updated', { description: hash.slice(0, 14) + '…' });
      addLog({ type: 'GUARDRAIL', msg: `Daily limit updated to $${newLimitInput} USDC`, txHash: hash });
      addTxRecord({
        id: hash, type: 'VAULT_CONFIG', status: 'pending',
        summary: `Set daily limit to $${newLimitInput} USDC`,
        detail: 'Arc Mainnet · AgentTreasuryVault', txHash: hash, chainId: CHAIN_ID,
        timestamp: new Date().toISOString(),
      });
      setNewLimitInput('');
      void refetch();
    } catch (e: unknown) {
      toast.dismiss(tid);
      toast.error('Transaction failed', { description: parseOnchainError(e) });
    } finally {
      setLimitPending(false);
    }
  }

  // updateAgent state
  const [newAgentInput, setNewAgentInput] = useState('');
  const [agentTxHash, setAgentTxHash]     = useState<`0x${string}` | undefined>();
  const [agentTxPending, setAgentTxPending] = useState(false);
  const { isLoading: agentTxConfirming } = useWaitForTransactionReceipt({ hash: agentTxHash, chainId: CHAIN_ID });

  async function handleUpdateAgent() {
    if (!walletAddress) { toast.error('Connect your wallet first'); return; }
    const addr = newAgentInput.trim();
    if (!addr.startsWith('0x') || addr.length !== 42) {
      toast.error('Invalid address', { description: 'Must be a 42-character 0x address' }); return;
    }
    if (walletChainId !== CHAIN_ID) {
      try { await switchChainAsync({ chainId: CHAIN_ID }); }
      catch { toast.error('Please switch to Arc Mainnet'); return; }
    }
    setAgentTxPending(true);
    const tid = toast.loading('Sending updateAgent…');
    try {
      const hash = await writeVault({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'updateAgent', args: [addr as `0x${string}`], chainId: CHAIN_ID });
      setAgentTxHash(hash);
      toast.dismiss(tid);
      toast.success('Agent address updated', { description: hash.slice(0, 14) + '…' });
      addLog({ type: 'GUARDRAIL', msg: `Agent updated to ${newAgentInput.slice(0, 10)}…`, txHash: hash });
      addTxRecord({
        id: hash, type: 'VAULT_CONFIG', status: 'pending',
        summary: `Update agent → ${newAgentInput.slice(0, 8)}…`,
        detail: 'Arc Mainnet · AgentTreasuryVault', txHash: hash, chainId: CHAIN_ID,
        timestamp: new Date().toISOString(),
      });
      setNewAgentInput('');
      void refetch();
    } catch (e: unknown) {
      toast.dismiss(tid);
      toast.error('Transaction failed', { description: parseOnchainError(e) });
    } finally {
      setAgentTxPending(false);
    }
  }

  // emergencyWithdraw
  const [ewPending, setEwPending] = useState(false);
  async function handleEmergencyWithdraw() {
    if (!walletAddress) { toast.error('Connect your wallet first'); return; }
    if (!confirm('Withdraw ALL vault USDC to the owner address? This cannot be undone.')) return;
    if (walletChainId !== CHAIN_ID) {
      try { await switchChainAsync({ chainId: CHAIN_ID }); }
      catch { toast.error('Please switch to Arc Mainnet'); return; }
    }
    setEwPending(true);
    const tid = toast.loading('Sending emergencyWithdrawAll…');
    try {
      const hash = await writeVault({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'emergencyWithdrawAll', args: [], chainId: CHAIN_ID });
      toast.dismiss(tid);
      toast.success('Emergency withdrawal sent', { description: hash.slice(0, 14) + '…' });
      addLog({ type: 'WARNING', msg: 'Emergency withdrawal executed', txHash: hash });
      addTxRecord({
        id: hash, type: 'VAULT_CONFIG', status: 'pending',
        summary: 'Emergency withdraw all USDC',
        detail: 'Arc Mainnet · AgentTreasuryVault', txHash: hash, chainId: CHAIN_ID,
        timestamp: new Date().toISOString(),
      });
      void refetch();
    } catch (e: unknown) {
      toast.dismiss(tid);
      toast.error('Withdrawal failed', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setEwPending(false);
    }
  }

  // ── Run Strategy quick-execute (hero "Run Strategy" button) ─────────────────
  const [runModalOpen,    setRunModalOpen]    = useState(false);
  const [runStratIdx,     setRunStratIdx]     = useState(0);   // index into STRATEGIES
  const [runAmountInput,  setRunAmountInput]  = useState('');
  const [runPending,      setRunPending]      = useState(false);

  async function handleRunStrategy() {
    if (!walletAddress) { toast.error('Connect your wallet first'); return; }
    const strat = STRATEGIES[runStratIdx];
    if (!strat) return;
    const rawAmt = parseUsdcInput(runAmountInput, usdcFact.decimals);
    if (rawAmt === null) { toast.error('Enter a valid positive amount'); return; }
    if (walletChainId !== CHAIN_ID) {
      try { await switchChainAsync({ chainId: CHAIN_ID }); }
      catch { toast.error('Please switch to Arc Mainnet'); return; }
    }
    setRunPending(true);
    const displayAmt = formatUsdc(rawAmt);
    const tid = toast.loading(`Executing ${strat.strategyType}…`);
    try {
      const hash = await writeVault({
        address: VAULT_ADDRESS, abi: VAULT_ABI,
        functionName: 'executeStrategy',
        args: [strat.protocolAddress, rawAmt, '0x', strat.strategyType],
        chainId: CHAIN_ID,
      });
      toast.dismiss(tid);
      toast.success('Strategy executed', { description: hash.slice(0, 14) + '…' });
      addLog({ type: 'EXECUTION', msg: `Executed ${strat.name}: $${displayAmt} USDC`, txHash: hash });
      addTxRecord({
        id: hash, type: 'VAULT_CONFIG', status: 'pending',
        summary: `Execute ${strat.name} · $${displayAmt}`,
        detail: `Arc Mainnet · ${strat.strategyType}`, txHash: hash, chainId: CHAIN_ID,
        timestamp: new Date().toISOString(),
      });
      setRunModalOpen(false);
      setRunAmountInput('');
      void refetch();
    } catch (e: unknown) {
      toast.dismiss(tid);
      const msg = parseOnchainError(e);
      const detail = msg.includes('reverted')
        ? 'Protocol not allowlisted or vault has insufficient USDC. Check Strategies tab.'
        : msg;
      toast.error('Strategy failed', { description: detail });
    } finally {
      setRunPending(false);
    }
  }

  // ── Inline Daily Limit edit on Dashboard ─────────────────────────────────────
  const [limitEditOpen, setLimitEditOpen] = useState(false);
  const [dashLimitInput, setDashLimitInput] = useState('');

  async function handleDashUpdateLimit() {
    if (!walletAddress) { toast.error('Connect your wallet first'); return; }
    const rawLimit = parseUsdcInput(dashLimitInput, usdcFact.decimals);
    if (rawLimit === null) { toast.error('Enter a valid positive USDC limit'); return; }
    if (walletChainId !== CHAIN_ID) {
      try { await switchChainAsync({ chainId: CHAIN_ID }); }
      catch { toast.error('Please switch to Arc Mainnet'); return; }
    }
    setLimitPending(true);
    const tid = toast.loading('Updating daily limit…');
    try {
      const hash = await writeVault({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'updateDailyLimit', args: [rawLimit], chainId: CHAIN_ID });
      setLimitTxHash(hash);
      toast.dismiss(tid);
      toast.success('Daily limit updated', { description: hash.slice(0, 14) + '…' });
      addLog({ type: 'GUARDRAIL', msg: `Daily limit updated to $${dashLimitInput} USDC`, txHash: hash });
      addTxRecord({ id: hash, type: 'VAULT_CONFIG', status: 'pending', summary: `Set daily limit → $${dashLimitInput}`, detail: 'Arc Mainnet · AgentTreasuryVault', txHash: hash, chainId: CHAIN_ID, timestamp: new Date().toISOString() });
      setDashLimitInput('');
      setLimitEditOpen(false);
      void refetch();
    } catch (e: unknown) {
      toast.dismiss(tid);
      toast.error('Transaction failed', { description: parseOnchainError(e) });
    } finally {
      setLimitPending(false);
    }
  }

  // ── Send (multi-token ERC-20 transfer from connected wallet) ─────────────────
  const [sendToken_,    setSendToken_]   = useState<'USDC'|'EURC'|'cirBTC'>('USDC');
  const [sendRecipient, setSendRecipient] = useState('');
  const [sendAmount,    setSendAmount]    = useState('');
  const [sendTxHash,    setSendTxHash]    = useState<`0x${string}` | undefined>();
  const { writeContractAsync: sendToken, isPending: sendPending } = useWriteContract();
  const { isLoading: sendConfirming, isSuccess: sendSuccess } = useWaitForTransactionReceipt({ hash: sendTxHash, chainId: CHAIN_ID });
  const sendMeta = getToken(sendToken_);
  const { data: sendTokenBalance } = useReadContract({
    address: sendMeta.address,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: walletAddress ? [walletAddress] : undefined,
    chainId: CHAIN_ID,
    query: { enabled: !!walletAddress, refetchInterval: 8000 },
  });
  useEffect(() => {
    if (sendSuccess && sendTxHash) {
      updateTxStatus(sendTxHash, 'confirmed');
      // Auto-clear the success receipt after 6 s so the form is fresh for next use
      const t = setTimeout(() => setSendTxHash(undefined), 6000);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendSuccess, sendTxHash]);

  async function handleSendUsdc() {
    if (!walletAddress) { toast.error('Connect your wallet first'); return; }
    const recipient = sendRecipient.trim();
    if (!recipient.startsWith('0x') || recipient.length !== 42) {
      toast.error('Invalid recipient address', { description: 'Must be a 42-character 0x address' }); return;
    }
    const rawAmt = parseUsdcInput(sendAmount, sendMeta.decimals);
    if (rawAmt === null) { toast.error('Enter a valid positive amount'); return; }
    if (sendTokenBalance !== undefined && exceedsBalance(rawAmt, sendTokenBalance)) {
      toast.error('Insufficient balance', {
        description: `You have ${Amount.fromRaw(sendTokenBalance, sendMeta.decimals).toFixed(sendMeta.decimals === 8 ? 8 : 2)} ${sendToken_}`,
      });
      return;
    }
    if (walletChainId !== CHAIN_ID) {
      try { await switchChainAsync({ chainId: CHAIN_ID }); }
      catch { toast.error('Please switch to Arc Mainnet'); return; }
    }
    const displayAmt = `${Amount.fromRaw(rawAmt, sendMeta.decimals).toFixed(sendMeta.decimals === 8 ? 8 : 2)} ${sendToken_}`;
    const tid = toast.loading(`Sending ${displayAmt}…`);
    try {
      const hash = await sendToken({
        address: sendMeta.address,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [recipient as `0x${string}`, rawAmt],
        chainId: CHAIN_ID,
      });
      setSendTxHash(hash);
      toast.dismiss(tid);
      toast.success(`${sendToken_} sent`, { description: hash.slice(0, 14) + '…' });
      addLog({ type: 'EXECUTION', msg: `Sent ${displayAmt} to ${fmtAddr(recipient)}`, txHash: hash });
      addTxRecord({
        id: hash, type: 'SEND', status: 'pending',
        summary: `${displayAmt} → ${fmtAddr(recipient)}`,
        detail: 'Arc Mainnet', txHash: hash, chainId: CHAIN_ID,
        timestamp: new Date().toISOString(),
      });
      setSendAmount('');
      setSendRecipient('');
    } catch (e) {
      toast.dismiss(tid);
      toast.error('Send failed', { description: parseOnchainError(e) });
    }
  }

  // ── Live vault reads ─────────────────────────────────────────────────────────
  const { data: vaultData, isLoading: vaultLoading, refetch } = useReadContracts({
    contracts: [
      { address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'dailyLimit',         chainId: CHAIN_ID },
      { address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'spentToday',         chainId: CHAIN_ID },
      { address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'lastResetTimestamp', chainId: CHAIN_ID },
      { address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'owner',              chainId: CHAIN_ID },
      { address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'aiAgent',            chainId: CHAIN_ID },
      { address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'usdcToken',          chainId: CHAIN_ID },
    ],
    query: { refetchInterval: 8000 },
  });
  const {
    data: vaultUsdcBalance,
    isError: isBalanceError,
    refetch: refetchBalance,
  } = useReadContract({
    address: USDC_ADDRESS, abi: erc20Abi, functionName: 'balanceOf',
    args: [VAULT_ADDRESS], chainId: CHAIN_ID,
    query: { refetchInterval: 8000, retry: 2 },
  });

  const dailyLimit = vaultData?.[0].result;
  const spentToday = vaultData?.[1].result;
  const lastReset  = vaultData?.[2].result;
  const ownerAddr  = vaultData?.[3].result as string | undefined;
  const agentAddr  = vaultData?.[4].result as string | undefined;

  // ── Per-strategy allowlist status (live from chain) ──────────────────────────
  const { data: allowlistData, refetch: refetchAllowlist } = useReadContracts({
    contracts: STRATEGIES.map(s => ({
      address: VAULT_ADDRESS, abi: VAULT_ABI,
      functionName: 'allowedProtocols' as const,
      args: [s.protocolAddress] as const,
      chainId: CHAIN_ID,
    })),
    query: { refetchInterval: 10000 },
  });
  // allowlistData[i].result === true means strategy i is allowlisted
  const strategyAllowed = STRATEGIES.map((_, i) =>
    (allowlistData?.[i]?.result) ?? false
  );

  // Is connected wallet the vault owner?
  const isOwner = !!(walletAddress && ownerAddr &&
    walletAddress.toLowerCase() === ownerAddr.toLowerCase());
  // Can execute strategies (owner or agent)?
  const canExecute = !!(walletAddress && (
    walletAddress.toLowerCase() === ownerAddr?.toLowerCase() ||
    walletAddress.toLowerCase() === agentAddr?.toLowerCase()
  ));

  const remaining = useMemo(() => {
    if (dailyLimit === undefined || spentToday === undefined) return undefined;
    return dailyLimit > spentToday ? dailyLimit - spentToday : 0n;
  }, [dailyLimit, spentToday]);

  const budgetPct = useMemo(() => {
    if (!dailyLimit || !spentToday || dailyLimit === 0n) return 0;
    return Math.min(100, Number((spentToday * 10000n) / dailyLimit) / 100);
  }, [dailyLimit, spentToday]);

  function addLog(entry: Omit<LogEntry, 'id' | 'ts'>) {
    setLogs(prev => [{ ...entry, id: `log-${Date.now()}`, ts: new Date().toLocaleTimeString() }, ...prev.slice(0, 24)]);
  }

  function toggleAgent() {
    const next = !agentActive;
    setAgentActive(next);
    addLog({ type: next ? 'GUARDRAIL' : 'WARNING', msg: next ? 'AI Agent resumed (UI only).' : 'AI Agent PAUSED (UI only). Use Update Agent to change on-chain.', txHash: null });
    toast(next ? 'Agent resumed' : 'Agent paused (UI only)', { description: 'Use Guardrails → Update Agent to change the on-chain agent address.' });
  }

  // ── Strategy action state ────────────────────────────────────────────────────
  // Per-strategy: { amount: string, pending: boolean, txHash?: string }
  const [strategyInputs, setStrategyInputs] = useState<Record<number, string>>({});
  const [strategyPending, setStrategyPending] = useState<Record<number, boolean>>({});
  const [strategyTxHashes, setStrategyTxHashes] = useState<Record<number, string>>({});
  const [allowlistPending, setAllowlistPending] = useState<Record<number, boolean>>({});

  async function handleSetAllowedProtocol(strategyId: number, protocolAddress: `0x${string}`, allow: boolean) {
    if (!walletAddress) { toast.error('Connect your wallet first'); return; }
    if (!isOwner) { toast.error('Only the vault owner can manage the allowlist'); return; }
    if (walletChainId !== CHAIN_ID) {
      try { await switchChainAsync({ chainId: CHAIN_ID }); }
      catch { toast.error('Please switch to Arc Mainnet'); return; }
    }
    setAllowlistPending(prev => ({ ...prev, [strategyId]: true }));
    const tid = toast.loading(allow ? 'Allowlisting protocol…' : 'Removing from allowlist…');
    try {
      const hash = await writeVault({
        address: VAULT_ADDRESS, abi: VAULT_ABI,
        functionName: 'setAllowedProtocol',
        args: [protocolAddress, allow],
        chainId: CHAIN_ID,
      });
      toast.dismiss(tid);
      toast.success(allow ? 'Protocol allowlisted' : 'Protocol removed', { description: hash.slice(0, 14) + '…' });
      addLog({ type: 'GUARDRAIL', msg: `Protocol ${protocolAddress.slice(0, 10)}… ${allow ? 'allowlisted' : 'removed'}`, txHash: hash });
      addTxRecord({
        id: hash, type: 'VAULT_CONFIG', status: 'pending',
        summary: `${allow ? 'Allowlist' : 'Remove'} protocol: ${protocolAddress.slice(0, 10)}…`,
        detail: `Arc Mainnet · AgentTreasuryVault`,
        txHash: hash, chainId: CHAIN_ID, timestamp: new Date().toISOString(),
      });
      void refetchAllowlist();
    } catch (e) {
      toast.dismiss(tid);
      toast.error('Allowlist update failed', { description: parseOnchainError(e) });
    } finally {
      setAllowlistPending(prev => ({ ...prev, [strategyId]: false }));
    }
  }

  async function handleExecuteStrategy(strategyIdx: number) {
    const s = STRATEGIES[strategyIdx];
    if (!s) return;
    if (!walletAddress) { toast.error('Connect your wallet first'); return; }
    if (!canExecute) { toast.error('Only the vault owner or AI agent can execute strategies'); return; }
    const rawAmt = parseUsdcInput(strategyInputs[s.id] ?? '', usdcFact.decimals);
    if (rawAmt === null) { toast.error('Enter a valid positive USDC amount'); return; }
    if (vaultUsdcBalance !== undefined && exceedsBalance(rawAmt, vaultUsdcBalance)) {
      toast.error('Insufficient vault balance', {
        description: `Vault holds ${Amount.fromRaw(vaultUsdcBalance, usdcFact.decimals).toFixed(2)} USDC`,
      });
      return;
    }
    if (remaining !== undefined && rawAmt > remaining) {
      toast.error('Exceeds daily budget', {
        description: `Remaining today: $${fmtUsdc(remaining)} USDC`,
      });
      return;
    }
    if (walletChainId !== CHAIN_ID) {
      try { await switchChainAsync({ chainId: CHAIN_ID }); }
      catch { toast.error('Please switch to Arc Mainnet'); return; }
    }
    setStrategyPending(prev => ({ ...prev, [s.id]: true }));
    const displayAmt = formatUsdc(rawAmt);
    const tid = toast.loading(`Executing ${s.name}…`);
    try {
      const hash = await writeVault({
        address: VAULT_ADDRESS, abi: VAULT_ABI,
        functionName: 'executeStrategy',
        args: [s.protocolAddress, rawAmt, '0x', s.strategyType],
        chainId: CHAIN_ID,
      });
      setStrategyTxHashes(prev => ({ ...prev, [s.id]: hash }));
      toast.dismiss(tid);
      toast.success(`${s.name} executed`, { description: hash.slice(0, 14) + '…' });
      addLog({ type: 'EXECUTION', msg: `Strategy executed: ${s.name} · $${displayAmt} USDC`, txHash: hash });
      addTxRecord({
        id: hash, type: 'VAULT_CONFIG', status: 'pending',
        summary: `Execute: ${s.name} · $${displayAmt} USDC`,
        detail: `Arc Mainnet · ${s.strategyType}`,
        txHash: hash, chainId: CHAIN_ID, timestamp: new Date().toISOString(),
      });
      setStrategyInputs(prev => ({ ...prev, [s.id]: '' }));
      void refetch();
    } catch (e) {
      toast.dismiss(tid);
      const msg = parseOnchainError(e);
      // Explain the most common revert reason
      const detail = msg.includes('Protocol not allowed')
        ? 'The protocol is not yet allowlisted. Toggle it on with the owner wallet first.'
        : msg.includes('Exceeds agent daily limit')
        ? 'This amount exceeds the vault\'s daily spending limit.'
        : msg.includes('Not a contract')
        ? 'The protocol address has no code. Replace with a real deployed adapter.'
        : msg;
      toast.error('Strategy execution failed', { description: detail });
    } finally {
      setStrategyPending(prev => ({ ...prev, [s.id]: false }));
    }
  }

  // ── Adapter factory (switches wallet to source chain first) ──────────────────
  const getAdapter = useCallback(async (sourceChainId: number) => {
    if (!connector) throw new Error('Wallet not connected');
    await switchChainAsync({ chainId: sourceChainId });
    const provider = await connector.getProvider() as EIP1193Provider;
    return createViemAdapterFromProvider({ provider });
  }, [connector, switchChainAsync]);

  // ── Bridge state ─────────────────────────────────────────────────────────────
  const [bridgeAmount, setBridgeAmount]   = useState('');
  const [bridgeDest,   setBridgeDest]     = useState<BridgeChainId>('Base');
  type BridgeStep = {
    name: string;
    state: 'pending' | 'active' | 'success' | 'error';
    txHash?: string;
    explorerUrl?: string;
    error?: string;
  };
  const BRIDGE_STEP_NAMES = ['approve', 'burn', 'fetchAttestation', 'mint'] as const;

  const [bridgePhase, setBridgePhase]         = useState<'idle'|'bridging'|'done'|'error'>('idle');
  const [bridgeDestSearch, setBridgeDestSearch]   = useState('');
  const [destChainModalOpen, setDestChainModalOpen] = useState(false);
  const [bridgeError, setBridgeError] = useState('');
  const [bridgeSteps, setBridgeSteps] = useState<BridgeStep[]>([]);
  const [bridgeTxHash, setBridgeTxHash] = useState('');
  const [lastBridgeResult, setLastBridgeResult] = useState<Awaited<ReturnType<typeof appKit.bridge>> | null>(null);
  // retryBridge resumes from the failed step — never re-run bridge() from scratch after a soft error

  const destChain = BRIDGE_CHAINS.find(c => c.id === bridgeDest)!;

  function initSteps(): BridgeStep[] {
    return BRIDGE_STEP_NAMES.map((name, i) => ({
      name,
      state: i === 0 ? 'active' : 'pending',
    }));
  }

  function updateStep(name: string, patch: Partial<BridgeStep>) {
    setBridgeSteps(prev => {
      const updated = prev.map(s => s.name === name ? { ...s, ...patch } : s);
      // activate next pending step
      const doneIdx = updated.findIndex(s => s.name === name);
      if (patch.state === 'success' && doneIdx + 1 < updated.length && updated[doneIdx + 1].state === 'pending') {
        updated[doneIdx + 1] = { ...updated[doneIdx + 1], state: 'active' };
      }
      return updated;
    });
  }

  async function handleBridge() {
    if (!connector) { toast.error('Connect your wallet first'); return; }
    const rawAmt = parseUsdcInput(bridgeAmount, usdcFact.decimals);
    if (rawAmt === null) { toast.error('Enter a valid positive amount'); return; }
    if (walletUsdcBalance !== undefined && exceedsBalance(rawAmt, walletUsdcBalance)) {
      toast.error('Insufficient balance', {
        description: `You have ${Amount.fromRaw(walletUsdcBalance, usdcFact.decimals).toFixed(2)} USDC`,
      });
      return;
    }
    setBridgePhase('bridging');
    setBridgeError('');
    setBridgeSteps(initSteps());
    setBridgeTxHash('');
    setLastBridgeResult(null);

    // Add a pending record immediately
    const localBridgeId = txId('bridge');
    addTxRecord({
      id: localBridgeId, type: 'BRIDGE', status: 'pending',
      summary: `${bridgeAmount} USDC → ${destChain.label}`,
      detail: `Arc Mainnet → ${destChain.label} · CCTP v2`,
      chainId: CHAIN_ID, timestamp: new Date().toISOString(),
    });

    const tid = toast.loading('Step 1/4: Approving USDC…');

    // ── Subscribe to step events for live progress ───────────────────────────
    const onApprove = (payload: Parameters<Parameters<typeof appKit.on<'bridge.approve'>>[1]>[0]) => {
      if (payload.protocol !== 'cctp') return;
      const v = payload.values as { txHash?: string; state?: string };
      updateStep('approve', { state: 'success', txHash: v.txHash });
      toast.loading('Step 2/4: Burning USDC on Arc Mainnet…', { id: tid });
    };
    const onBurn = (payload: Parameters<Parameters<typeof appKit.on<'bridge.burn'>>[1]>[0]) => {
      const v = payload.values as { txHash?: string; explorerUrl?: string };
      updateStep('burn', { state: 'success', txHash: v.txHash, explorerUrl: v.explorerUrl });
      setBridgeTxHash(v.txHash ?? '');
      toast.loading('Step 3/4: Waiting for Circle attestation…', { id: tid });
    };
    const onAttestation = (payload: Parameters<Parameters<typeof appKit.on<'bridge.fetchAttestation'>>[1]>[0]) => {
      if (payload.protocol !== 'cctp') return;
      const v = payload.values as { state?: string };
      if (v.state === 'success') {
        updateStep('fetchAttestation', { state: 'success' });
        toast.loading('Step 4/4: Minting USDC on destination…', { id: tid });
      }
    };
    const onMint = (payload: Parameters<Parameters<typeof appKit.on<'bridge.mint'>>[1]>[0]) => {
      const v = payload.values as { txHash?: string; explorerUrl?: string };
      updateStep('mint', { state: 'success', txHash: v.txHash, explorerUrl: v.explorerUrl });
    };

    appKit.on('bridge.approve',          onApprove);
    appKit.on('bridge.burn',             onBurn);
    appKit.on('bridge.fetchAttestation', onAttestation);
    appKit.on('bridge.mint',             onMint);

    try {
      const adapter = await getAdapter(CHAIN_ID);
      const result = await appKit.bridge({
        from: { adapter, chain: 'Arc' },
        to:   { adapter, chain: bridgeDest, useForwarder: true },
        amount: bridgeAmount,
      });
      setLastBridgeResult(result);

      // Back-fill any steps the events may have missed (e.g. fast-mode race)
      result.steps?.forEach(s => {
        updateStep(s.name, {
          state: s.state as BridgeStep['state'],
          txHash: s.txHash ?? undefined,
          explorerUrl: s.explorerUrl ?? undefined,
          error: (s as { error?: string }).error,
        });
      });

      const burnTx = result.steps?.find(s => s.name === 'burn')?.txHash ?? bridgeTxHash;
      setBridgeTxHash(burnTx);

      if (result.state === 'error') {
        const failed = result.steps?.find(s => s.state === 'error');
        const errMsg = (failed as { error?: string })?.error ?? 'Bridge failed at an unknown step';
        setBridgeError(errMsg);
        setBridgePhase('error');
        toast.dismiss(tid);
        toast.error('Bridge failed', { description: errMsg });
      } else {
        setBridgePhase('done');
        toast.dismiss(tid);
        toast.success('Bridge confirmed', { description: burnTx ? burnTx.slice(0, 14) + '…' : undefined });
        addLog({ type: 'EXECUTION', msg: `Bridged ${bridgeAmount} USDC → ${destChain.label}`, txHash: burnTx || null });
        // Confirm the pending record, attach burn txHash
        updateTxStatus(localBridgeId, 'confirmed', burnTx || undefined);
      }
    } catch (e: unknown) {
      const userMsg = parseOnchainError(e);
      setBridgeError(userMsg);
      setBridgePhase('error');
      // Mark the active step as errored
      setBridgeSteps(prev => prev.map(s => s.state === 'active' ? { ...s, state: 'error', error: userMsg } : s));
      updateTxStatus(localBridgeId, 'failed');
      toast.dismiss(tid);
      toast.error('Bridge failed', { description: userMsg });
    } finally {
      appKit.off('bridge.approve',          onApprove);
      appKit.off('bridge.burn',             onBurn);
      appKit.off('bridge.fetchAttestation', onAttestation);
      appKit.off('bridge.mint',             onMint);
    }
  }

  async function handleRetryBridge() {
    if (!lastBridgeResult || !connector) return;
    setBridgePhase('bridging');
    setBridgeError('');
    const adapter = await getAdapter(CHAIN_ID);
    const tid = toast.loading('Retrying bridge from failed step…');
    try {
      const retryResult = await appKit.retryBridge(lastBridgeResult, { from: adapter, to: adapter });
      setLastBridgeResult(retryResult);
      retryResult.steps?.forEach(s => updateStep(s.name, {
        state: s.state as BridgeStep['state'],
        txHash: s.txHash ?? undefined,
        explorerUrl: s.explorerUrl ?? undefined,
      }));
      if (retryResult.state === 'error') {
        const failed = retryResult.steps?.find(s => s.state === 'error');
        const errMsg = (failed as { error?: string })?.error ?? 'Retry failed';
        setBridgeError(errMsg);
        setBridgePhase('error');
        toast.dismiss(tid);
        toast.error('Retry failed', { description: errMsg });
      } else {
        setBridgePhase('done');
        toast.dismiss(tid);
        toast.success('Bridge retry succeeded');
      }
    } catch (e: unknown) {
      const msg = parseOnchainError(e);
      setBridgeError(msg);
      setBridgePhase('error');
      toast.dismiss(tid);
      toast.error('Retry failed', { description: msg });
    }
  }

  // (state resets handled inline in the change handlers below)

  const loading = vaultLoading;

  // Force dark CSS vars while the app shell is visible
  useEffect(() => {
    document.documentElement.classList.add('dark');
    return () => {
      // Restore user preference when unmounted (back to landing)
      const stored = localStorage.getItem('arcgentic-theme');
      document.documentElement.classList.toggle('dark', stored === 'dark');
    };
  }, []);

  if (!showApp) {
    return <LandingPage onLaunch={() => setShowApp(true)} />;
  }

  return (
    <div className="min-h-dvh" style={{ background: '#0a0e1a' }}>

      {/* ── Header ─────────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-black/[0.06] backdrop-blur-md bg-white/90">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Brand logo — glowing gradient container */}
            <div className="relative w-9 h-9 rounded-xl shrink-0 overflow-hidden"
              style={{ background: 'linear-gradient(135deg,#10b981,#0ea5e9,#6366f1)', boxShadow: '0 0 14px 2px rgba(16,185,129,0.35), 0 0 28px 4px rgba(99,102,241,0.2)' }}>
              <img
                src="https://raw.githubusercontent.com/DAOmindbreaker/arcgentic/main/public/logo.png"
                alt="ArcGentic"
                width={36}
                height={36}
                className="w-full h-full object-contain"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            </div>
            {/* Brand name + badges */}
            <div className="flex items-center gap-2">
              <h1
                className="font-extrabold text-[16px] tracking-tight bg-clip-text text-transparent"
                style={{ backgroundImage: 'linear-gradient(90deg,#10b981 0%,#0ea5e9 50%,#6366f1 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
              >ArcGentic</h1>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold font-mono tracking-widest bg-gray-100 text-gray-500 border border-gray-200 uppercase">
                dApp
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Arc Mainnet
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Agent status pill + toggle */}
            <div className="hidden sm:flex items-center gap-1.5">
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                agentActive
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-amber-50 border-amber-200 text-amber-700'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${agentActive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                {agentActive ? 'ACTIVE' : 'PAUSED'}
              </div>
              <button onClick={toggleAgent} title={agentActive ? 'Pause agent' : 'Resume agent'}
                className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors">
                {agentActive ? <Pause className="w-3.5 h-3.5 text-red-500" /> : <Play className="w-3.5 h-3.5 fill-current text-emerald-600" />}
              </button>
            </div>

            {/* Connected wallet chip */}
            {walletAddress && (
              <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-lg border border-gray-200 bg-gray-50 text-[11px]">
                <Wallet className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                <span className="mono text-gray-700">{walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}</span>
                {walletUsdcBalance !== undefined && (
                  <>
                    <span className="text-gray-300">·</span>
                    <TokenUSDC variant="branded" size={12} />
                    <span className="tabular text-gray-700">
                      {Amount.fromRaw(walletUsdcBalance, usdcFact.decimals).toFixed(2)}
                    </span>
                  </>
                )}
                {walletChainId && walletChainId !== CHAIN_ID && (
                  <span className="text-[10px] font-bold text-amber-700 border border-amber-200 bg-amber-50 px-1.5 py-0.5 rounded-full">Wrong network</span>
                )}
              </div>
            )}

            {/* History button */}
            <button
              onClick={() => setHistoryOpen(true)}
              className="relative p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
              title="Transaction History"
            >
              <History className="w-4 h-4 text-gray-500" />
              {txRecords.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-sky-600 text-white text-[9px] font-bold flex items-center justify-center">
                  {txRecords.length > 99 ? '99' : txRecords.length}
                </span>
              )}
            </button>

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
            >
              {isDark
                ? <Sun className="w-4 h-4 text-[var(--amber)]" />
                : <Moon className="w-4 h-4 text-[var(--violet)]" />}
            </button>

            <ConnectKitButton />
          </div>
        </div>

        {/* Tab bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-0 overflow-x-auto no-scrollbar">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-[11px] font-semibold border-b-2 whitespace-nowrap transition-colors ${
                tab === t.id
                  ? 'border-cyan-500 text-cyan-600'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
              {t.id === 'swap' && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/30">NEW</span>
              )}
            </button>
          ))}
        </div>
      </header>

      {/* ── Main content ────────────────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

        {/* Wrong-chain banner — shown on every tab */}
        {walletAddress && walletChainId && walletChainId !== CHAIN_ID && (
          <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="text-[12px] text-amber-800">
                Your wallet is on the wrong network. Switch to <strong>Arc Mainnet</strong> to sign transactions.
              </span>
            </div>
            <button
              onClick={() => void switchChainAsync({ chainId: CHAIN_ID })}
              className="min-h-[40px] px-4 py-2 rounded-lg bg-amber-600 text-white text-[12px] font-semibold hover:bg-amber-700 transition-colors shrink-0"
            >
              Switch to Arc Mainnet
            </button>
          </div>
        )}

        {/* ══ Dashboard ══════════════════════════════════════════════════════════ */}
        {tab === 'dashboard' && (
          <div className="space-y-5">

            {/* ── Hero card ─────────────────────────────────────────────────── */}
            <div className="relative rounded-3xl border border-[var(--border-glow)] overflow-hidden"
              style={{ background: 'linear-gradient(135deg, rgba(0,200,255,0.06) 0%, rgba(9,13,22,0.95) 40%, rgba(120,40,255,0.06) 100%)', boxShadow: 'var(--glow-cyan)' }}>
              {/* Background noise texture */}
              <div className="absolute inset-0 opacity-[0.03]"
                style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'200\' height=\'200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\' opacity=\'1\'/%3E%3C/svg%3E")', backgroundSize: '200px 200px' }} />

              <div className="relative p-6 sm:p-8">
                {/* Top row */}
                <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-400/20 to-purple-500/20 border border-cyan-500/30 flex items-center justify-center">
                        <Bot className="w-5 h-5 text-cyan-400" />
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--subtle)]">Arc Autonomous Treasury</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="relative flex h-2 w-2">
                          <span className={`animate-ping-slow absolute inline-flex h-full w-full rounded-full ${agentActive ? 'bg-emerald-400' : 'bg-amber-400'} opacity-75`} />
                          <span className={`relative inline-flex rounded-full h-2 w-2 ${agentActive ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                        </span>
                        <span className={`text-[11px] font-bold ${agentActive ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {agentActive ? 'AI OPTIMIZING YIELD' : 'AGENT PAUSED'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => void refetch()}
                      className="p-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors" title="Refresh vault state">
                      <RefreshCw className="w-4 h-4 text-[var(--subtle)]" />
                    </button>
                    <a href={buildTxExplorerUrl(CHAIN_ID, '0xffc667fa535a433ed4b640df933b3b2bad0586f009ee8d34f482e44702ebf258')}
                      target="_blank" rel="noopener noreferrer"
                      className="p-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors" title="View deploy tx on explorer">
                      <ExternalLink className="w-4 h-4 text-[var(--subtle)]" />
                    </a>
                    <button
                      onClick={() => setRunModalOpen(true)}
                      className="px-3 py-2 min-h-[40px] rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 text-[11px] font-bold hover:bg-cyan-500/25 transition-colors flex items-center gap-1.5"
                    >
                      <Zap className="w-3.5 h-3.5" /> Run Strategy
                    </button>
                  </div>
                </div>

                {/* Big balance */}
                <div className="mb-1">
                  <div className="flex items-center gap-2 mb-2">
                    <TokenUSDC variant="branded" size={16} />
                    <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--subtle)]">Vault USDC Balance</span>
                  </div>
                  <USDCBalance
                    rawValue={vaultUsdcBalance}
                    isLoading={loading}
                    isError={isBalanceError}
                    onRefresh={refetchBalance}
                  />
                </div>

                {/* Status badges row */}
                <div className="flex flex-wrap gap-2 mt-4 mb-4">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold"
                    style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.25)' }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />VAULT ACTIVE
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold"
                    style={{ background: 'rgba(6,182,212,0.10)', color: '#67e8f9', border: '1px solid rgba(6,182,212,0.22)' }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />GUARDRAILS ENFORCED
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold"
                    style={{ background: 'rgba(139,92,246,0.10)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.22)' }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />NON-CUSTODIAL
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold ml-auto"
                    style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    Arc Mainnet · Chain 5042
                  </span>
                </div>

                {/* Vault address + budget in one row */}
                <div className="flex items-center justify-between gap-4 pt-4 flex-wrap"
                  style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <a href={`${chain.explorerBase}/address/${VAULT_ADDRESS}`} target="_blank" rel="noopener noreferrer"
                    className="mono text-[11px] hover:opacity-80 transition-opacity flex items-center gap-1.5"
                    style={{ color: 'rgba(255,255,255,0.4)' }}>
                    {VAULT_ADDRESS.slice(0,10)}…{VAULT_ADDRESS.slice(-6)} <ExternalLink className="w-3 h-3" />
                  </a>
                  {!loading && dailyLimit !== undefined && spentToday !== undefined && (
                    <div className="flex items-center gap-3 flex-1 min-w-[160px] max-w-xs">
                      <div className="flex-1">
                        <BudgetBar spent={spentToday} limit={dailyLimit} />
                      </div>
                      <span className="mono text-[10px] shrink-0" style={{ color: 'rgba(255,255,255,0.4)' }}>{budgetPct.toFixed(1)}% used</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Stat cards ────────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Daily Limit — clickable inline edit (owner only) */}
              <div
                className={`relative rounded-2xl p-5 flex flex-col gap-2.5 transition-all cursor-pointer
                  ${limitEditOpen ? 'col-span-2 lg:col-span-1' : ''}`}
                style={{
                  background: limitEditOpen ? 'rgba(6,182,212,0.08)' : 'rgba(6,182,212,0.05)',
                  border: limitEditOpen ? '1px solid rgba(6,182,212,0.4)' : '1px solid rgba(6,182,212,0.15)',
                  boxShadow: limitEditOpen ? '0 0 18px rgba(6,182,212,0.12)' : undefined,
                }}
                onClick={() => { if (!limitEditOpen && isOwner) { setLimitEditOpen(true); setDashLimitInput(''); } }}
                title={isOwner ? 'Click to edit daily limit' : undefined}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: 'rgba(103,232,249,0.6)' }}>Daily Limit</span>
                  <div className="flex items-center gap-1.5">
                    {isOwner && !limitEditOpen && <Settings className="w-3 h-3" style={{ color: 'rgba(103,232,249,0.4)' }} />}
                    <div className="p-1.5 rounded-lg" style={{ background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.2)' }}>
                      <Lock className="w-3.5 h-3.5" style={{ color: '#67e8f9' }} />
                    </div>
                  </div>
                </div>
                <p className="display text-2xl font-bold tabular text-white">{loading ? '…' : `$${fmtUsdc(dailyLimit)}`}</p>
                <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{isOwner ? 'Click to update' : 'Max spend / day'}</p>

                {/* Inline edit row — only when open */}
                {limitEditOpen && (
                  <div className="mt-2 space-y-2" onClick={e => e.stopPropagation()}>
                    <input
                      type="number" min="0" step="any" autoFocus
                      value={dashLimitInput}
                      onChange={e => setDashLimitInput(e.target.value)}
                      placeholder={fmtUsdc(dailyLimit)}
                      className="w-full bg-white/5 border border-cyan-500/30 rounded-xl px-3 py-2 display text-[13px] font-bold text-[var(--ink)] placeholder-white/20 focus:outline-none focus:border-cyan-400/60 tabular"
                      disabled={limitPending || limitConfirming}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => void handleDashUpdateLimit()}
                        disabled={limitPending || limitConfirming || !dashLimitInput}
                        className="flex-1 min-h-[36px] rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 text-[11px] font-bold hover:bg-cyan-500/30 disabled:opacity-40 transition-all flex items-center justify-center gap-1.5"
                      >
                        {limitPending || limitConfirming
                          ? <><Loader2 className="w-3 h-3 animate-spin" /> Confirming…</>
                          : <><CheckCircle2 className="w-3 h-3" /> Set Limit</>}
                      </button>
                      <button
                        onClick={() => setLimitEditOpen(false)}
                        className="px-3 min-h-[36px] rounded-xl border border-white/10 bg-white/5 text-[var(--subtle)] text-[11px] font-bold hover:bg-white/10 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <GlowStatCard label="Spent Today"   value={loading ? '…' : `$${fmtUsdc(spentToday)}`}  sub={`${budgetPct.toFixed(1)}% of limit`} icon={DollarSign} glow="purple" />
              <GlowStatCard label="Remaining"     value={loading ? '…' : `$${fmtUsdc(remaining)}`}   sub="Budget left"            icon={TrendingUp} glow="green"  />
              <GlowStatCard label="Resets At"     value={loading ? '…' : fmtTimestamp(lastReset)}    sub="Next 24h window"        icon={Clock}      glow="amber"  />
            </div>

            {/* ── Allocation ring + Quick actions (side by side on md+) ─────── */}
            <div className="grid md:grid-cols-2 gap-4">
              {/* Ring */}
              <div className="rounded-2xl p-5 space-y-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)' }}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: 'rgba(255,255,255,0.4)' }}>Portfolio Allocation</span>
                  <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{STRATEGIES.length} strategies</span>
                </div>
                <AllocationRing strategies={STRATEGIES} weightedApy={
                  (STRATEGIES.reduce((a, s) => a + s.apy * s.allocated, 0) /
                  Math.max(1, STRATEGIES.reduce((a, s) => a + s.allocated, 0))).toFixed(2)
                } />
              </div>

              {/* Quick actions */}
              <div className="rounded-2xl p-5 space-y-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)' }}>
                <span className="text-[10px] font-bold uppercase tracking-[0.08em] block" style={{ color: 'rgba(255,255,255,0.4)' }}>Quick Actions</span>
                <div className="flex gap-3 flex-wrap">
                  <QuickActionCard icon={Send}        label="Send"   desc="Transfer USDC"        color="cyan"   onClick={() => {/* handled below via Send form */}} />
                  <QuickActionCard icon={ArrowDownUp} label="Swap"   desc="USDC → token"         color="purple" onClick={() => { setTab('swap'); setSwapMode('swap');   }} />
                  <QuickActionCard icon={GitBranch}   label="Bridge" desc="Cross-chain transfer"  color="green"  onClick={() => { setTab('swap'); setSwapMode('bridge'); }} />
                </div>
              </div>
            </div>

            {/* ── Addresses + Activity log ───────────────────────────────────── */}
            <div className="grid lg:grid-cols-2 gap-4">
              <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <h2 className="text-[10px] font-bold uppercase tracking-[0.08em] mb-4" style={{ color: 'rgba(255,255,255,0.4)' }}>Vault Addresses</h2>
                <AddressRow label="Vault Contract" value={VAULT_ADDRESS} />
                <AddressRow label="Owner"          value={ownerAddr} />
                <AddressRow label="AI Agent"       value={agentAddr} />
                <AddressRow label="USDC Token"     value={usdcFact.address} />
              </div>
              <div className="rounded-2xl p-5 flex flex-col" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: 'rgba(255,255,255,0.4)' }}>Activity Log</h2>
                  <span className="mono text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{logs.length} entries</span>
                </div>
                <div className="overflow-y-auto max-h-60 scrollbar-thin" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  {logs.length === 0 && (
                    <p className="text-[11px] text-[var(--subtle)] py-4 text-center">No activity yet</p>
                  )}
                  {logs.map(entry => {
                    const EntryIcon = LOG_ICON[entry.type];
                    return (
                      <div key={entry.id} className="log-row flex items-start gap-3 py-3 first:pt-0 rounded-lg px-1 -mx-1">
                        <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                          entry.type === 'EXECUTION' ? 'bg-cyan-500/10 border border-cyan-500/20' :
                          entry.type === 'GUARDRAIL' ? 'bg-emerald-500/10 border border-emerald-500/20' :
                          entry.type === 'WARNING'   ? 'bg-amber-500/10 border border-amber-500/20' :
                          'bg-white/5 border border-white/10'
                        }`}>
                          <EntryIcon className={`w-3 h-3 ${LOG_COLOR[entry.type]}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-[var(--ink-2)] leading-snug text-pretty">{entry.msg}</p>
                          {entry.txHash && (
                            <a href={buildTxExplorerUrl(CHAIN_ID, entry.txHash)} target="_blank" rel="noopener noreferrer"
                              className="mono text-[10px] text-[var(--subtle)] hover:text-[var(--accent)] transition-colors">
                              {entry.txHash.slice(0, 14)}…
                            </a>
                          )}
                        </div>
                        <span className="mono text-[10px] text-[var(--subtle)] shrink-0 pt-0.5">{entry.ts}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ── Send Token ─────────────────────────────────────────────────────── */}
            <div className="rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-strong)] p-5 sm:p-6 overflow-hidden">
              <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-[var(--primary)]/10 border border-[var(--primary-border)]">
                    <Send className="w-4 h-4 text-[var(--primary)]" />
                  </div>
                  <div>
                    <h2 className="display text-[15px] font-bold text-[var(--ink)]">Send Tokens</h2>
                    <p className="text-[11px] text-[var(--subtle)]">ERC-20 transfer on Arc Mainnet</p>
                  </div>
                </div>
                {/* Token selector chips */}
                <div className="flex items-center gap-2 flex-wrap">
                  {SENDABLE_TOKENS.map(t => (
                    <button
                      key={t.symbol}
                      onClick={() => { setSendToken_(t.symbol as 'USDC' | 'EURC' | 'cirBTC'); setSendAmount(''); }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all min-h-[36px] ${
                        sendToken_ === t.symbol
                          ? 'text-white border-transparent'
                          : 'border-[var(--border)] text-[var(--subtle)] bg-[var(--surface)] hover:border-[var(--primary-border)]'
                      }`}
                      style={sendToken_ === t.symbol ? { background: t.color, borderColor: t.color } : {}}
                    >
                      <span className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black shrink-0"
                        style={{ background: sendToken_ === t.symbol ? 'rgba(255,255,255,0.25)' : t.color + '33', color: sendToken_ === t.symbol ? '#fff' : t.color }}>
                        {t.abbr}
                      </span>
                      {t.symbol}
                    </button>
                  ))}
                </div>
              </div>

              {/* Balance display */}
              {walletAddress && sendTokenBalance !== undefined && (
                <div className="mb-4 px-4 py-2.5 rounded-xl bg-[var(--surface-muted)] border border-[var(--border)] flex items-center justify-between">
                  <span className="text-[11px] text-[var(--subtle)]">{sendToken_} Balance</span>
                  <span className="mono text-[12px] font-bold text-[var(--ink-2)] tabular">
                    {Amount.fromRaw(sendTokenBalance, sendMeta.decimals).toFixed(sendMeta.decimals === 8 ? 8 : 2)} {sendToken_}
                  </span>
                </div>
              )}

              <div className="space-y-3">
                {/* Recipient */}
                <div className="rounded-xl bg-[var(--surface-muted)] border border-[var(--border)] p-4 overflow-hidden">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--subtle)] block mb-2">
                    Recipient Address
                  </label>
                  <input
                    type="text"
                    value={sendRecipient}
                    onChange={e => setSendRecipient(e.target.value)}
                    placeholder="0x1234…abcd"
                    className="w-full bg-transparent mono text-[13px] text-[var(--ink)] placeholder-[var(--subtle)] focus:outline-none min-w-0"
                    disabled={sendPending || sendConfirming}
                  />
                </div>

                {/* Amount + Max */}
                <div className="rounded-xl bg-[var(--surface-muted)] border border-[var(--border)] p-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--subtle)]">Amount</label>
                    {walletAddress && sendTokenBalance !== undefined && (
                      <button
                        onClick={() => setSendAmount(Amount.fromRaw(sendTokenBalance, sendMeta.decimals).toFixed(sendMeta.decimals))}
                        className="text-[10px] font-bold text-[var(--primary)] hover:opacity-80 transition-opacity"
                      >
                        MAX
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-3 min-w-0">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={sendAmount}
                      onChange={e => setSendAmount(e.target.value)}
                      placeholder="0.00"
                      className="flex-1 min-w-0 bg-transparent display text-2xl font-bold text-[var(--ink)] placeholder-[var(--subtle)] focus:outline-none tabular"
                      disabled={sendPending || sendConfirming}
                    />
                    <div className="flex items-center gap-1.5 shrink-0 px-3 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black"
                        style={{ background: sendMeta.color + '33', color: sendMeta.color }}>{sendMeta.abbr}</span>
                      <span className="text-[13px] font-bold text-[var(--ink)]">{sendToken_}</span>
                    </div>
                  </div>
                </div>

                {/* Success receipt */}
                {sendSuccess && sendTxHash && (
                  <div className="rounded-xl border border-emerald-800/40 bg-emerald-950/30 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="text-[12px] text-emerald-400 font-semibold">Transfer confirmed</span>
                    </div>
                    <a href={buildTxExplorerUrl(CHAIN_ID, sendTxHash)} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 mono text-[11px] text-[var(--accent)] hover:text-[var(--accent-hover)]">
                      {sendTxHash.slice(0, 12)}… <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}

                {/* CTA */}
                {!walletAddress ? (
                  <div className="flex justify-center py-2">
                    <ConnectKitButton label="Connect Wallet to Send" />
                  </div>
                ) : (
                  <button
                    onClick={() => void handleSendUsdc()}
                    disabled={sendPending || sendConfirming || !sendAmount || !sendRecipient}
                    className="w-full min-h-[48px] rounded-2xl btn-neon-primary text-white text-[13px] font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                  >
                    {sendPending
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Confirm in wallet…</>
                      : sendConfirming
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Confirming on-chain…</>
                      : <><Send className="w-4 h-4" /> Send {sendToken_}</>}
                  </button>
                )}
              </div>
            </div>

            {/* ── Run Strategy modal ──────────────────────────────────────────── */}
            {runModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                style={{ background: 'rgba(9,13,22,0.85)', backdropFilter: 'blur(8px)' }}
                onClick={() => { if (!runPending) setRunModalOpen(false); }}>
                <div
                  className="w-full max-w-sm rounded-3xl border border-cyan-500/25 p-6 space-y-5"
                  style={{ background: 'linear-gradient(135deg, rgba(0,200,255,0.06), rgba(9,13,22,0.98))', boxShadow: '0 0 40px rgba(0,200,255,0.12)' }}
                  onClick={e => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="display text-[17px] font-bold text-[var(--ink)]">Run Strategy</h3>
                      <p className="text-[11px] text-[var(--subtle)] mt-0.5">Calls <span className="mono">executeStrategy</span> on vault</p>
                    </div>
                    <button onClick={() => setRunModalOpen(false)} className="p-2 rounded-xl hover:bg-white/10 transition-colors text-[var(--subtle)]">
                      <AlertCircle className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Strategy picker */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--subtle)]">Strategy</label>
                    <div className="space-y-2">
                      {STRATEGIES.map((s, i) => (
                        <button key={s.id}
                          onClick={() => setRunStratIdx(i)}
                          className={`w-full rounded-xl border p-3 text-left flex items-center justify-between transition-all ${
                            runStratIdx === i
                              ? 'border-cyan-500/50 bg-cyan-950/20'
                              : 'border-white/10 bg-white/5 hover:bg-white/8'
                          }`}
                        >
                          <div>
                            <p className="text-[12px] font-semibold text-[var(--ink)]">{s.name}</p>
                            <p className="mono text-[10px] text-[var(--subtle)] mt-0.5">{s.protocolAddress.slice(0, 10)}…</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[12px] font-bold text-emerald-400 tabular">{s.apy}% APY</p>
                            <p className="text-[10px] text-[var(--subtle)]">{s.risk} risk</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Amount */}
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--subtle)]">Amount (USDC)</label>
                      {vaultUsdcBalance !== undefined && (
                        <button
                          onClick={() => setRunAmountInput(Amount.fromRaw(vaultUsdcBalance, usdcFact.decimals).toFixed(6))}
                          className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300 transition-colors"
                        >
                          MAX (vault)
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="number" min="0" step="any" autoFocus
                        value={runAmountInput}
                        onChange={e => setRunAmountInput(e.target.value)}
                        placeholder="0.00"
                        className="flex-1 bg-transparent display text-2xl font-bold text-[var(--ink)] placeholder-white/20 focus:outline-none tabular"
                        disabled={runPending}
                      />
                      <div className="flex items-center gap-1.5 shrink-0">
                        <TokenUSDC variant="branded" size={18} />
                        <span className="text-[13px] font-semibold text-[var(--ink-2)]">USDC</span>
                      </div>
                    </div>
                  </div>

                  {/* Vault balance preview */}
                  <div className="flex items-center justify-between text-[11px] px-1">
                    <span className="text-[var(--subtle)]">Vault balance</span>
                    <span className="tabular font-semibold text-[var(--ink-2)]">
                      {vaultUsdcBalance !== undefined ? `$${Amount.fromRaw(vaultUsdcBalance, usdcFact.decimals).toFixed(2)} USDC` : '—'}
                    </span>
                  </div>

                  {/* CTA */}
                  {!walletAddress ? (
                    <div className="flex justify-center"><ConnectKitButton label="Connect Wallet to Execute" /></div>
                  ) : (
                    <button
                      onClick={() => void handleRunStrategy()}
                      disabled={runPending || !runAmountInput}
                      className="w-full min-h-[48px] rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-[13px] font-bold hover:bg-cyan-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                    >
                      {runPending
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Confirming in wallet…</>
                        : <><Zap className="w-4 h-4" /> Execute on Arc Mainnet</>}
                    </button>
                  )}

                  <p className="text-[10px] text-[var(--subtle)] text-center">
                    Reverts unless the protocol is allowlisted — use Strategies tab to manage.
                  </p>
                </div>
              </div>
            )}

            {/* ── Ecosystem section ─────────────────────────────────────────────── */}
            <EcosystemSection />
          </div>
        )}

        {/* ══ Strategies ═════════════════════════════════════════════════════════ */}
        {tab === 'strategies' && (
          <div className="space-y-4">

            {/* Header bar */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h2 className="display font-bold text-[var(--ink)] text-[15px]">Strategy Allocation</h2>
                <p className="text-[11px] text-[var(--subtle)] mt-0.5">
                  {canExecute ? 'You can execute strategies as owner / agent.' : 'Connect the owner or agent wallet to execute.'}
                </p>
              </div>
              {!walletAddress && (
                <ConnectKitButton label="Connect Wallet" />
              )}
            </div>

            {/* Info notice — only shown while no protocol is allowlisted */}
            {strategyAllowed.every(a => !a) && (
              <div className="rounded-xl px-4 py-3 text-[12px] leading-relaxed" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: '#fcd34d' }}>
                No protocols are allowlisted yet.{isOwner
                  ? ' Toggle "Allowlist" on each strategy below to register the protocol address on-chain, then allocate USDC.'
                  : ' The vault owner must allowlist each protocol before execution is possible.'}
              </div>
            )}

            {/* Vault USDC + daily budget summary */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="rounded-xl p-4" style={{ background: 'rgba(6,182,212,0.05)', border: '1px solid rgba(6,182,212,0.15)' }}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'rgba(103,232,249,0.6)' }}>Vault Balance</p>
                <p className="display font-bold text-white tabular">
                  {vaultUsdcBalance !== undefined ? `$${Amount.fromRaw(vaultUsdcBalance, usdcFact.decimals).toFixed(2)}` : '—'}
                </p>
              </div>
              <div className="rounded-xl p-4" style={{ background: 'rgba(52,211,153,0.05)', border: '1px solid rgba(52,211,153,0.15)' }}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'rgba(52,211,153,0.6)' }}>Remaining Today</p>
                <p className="display font-bold tabular" style={{ color: '#34d399' }}>
                  {remaining !== undefined ? `$${fmtUsdc(remaining)}` : '—'}
                </p>
              </div>
              <div className="rounded-xl p-4 col-span-2 sm:col-span-1" style={{ background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.15)' }}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'rgba(196,181,253,0.6)' }}>Weighted APY</p>
                <p className="display font-bold tabular" style={{ color: '#a78bfa' }}>
                  {(() => {
                    const total = STRATEGIES.reduce((a, s) => a + s.allocated, 0);
                    const w = STRATEGIES.reduce((a, s) => a + s.apy * s.allocated, 0);
                    return total > 0 ? `${(w / total).toFixed(2)}%` : '—';
                  })()}
                </p>
              </div>
            </div>

            {/* Strategy cards */}
            {STRATEGIES.map((s, idx) => {
              const allowed  = strategyAllowed[idx];
              const pending  = !!strategyPending[s.id];
              const alPending = !!allowlistPending[s.id];
              const txHash   = strategyTxHashes[s.id];
              const inputVal = strategyInputs[s.id] ?? '';
              return (
                <div key={s.id} className="rounded-2xl overflow-hidden transition-all"
                  style={{
                    background: allowed ? 'rgba(6,182,212,0.04)' : 'rgba(255,255,255,0.03)',
                    border: allowed ? '1px solid rgba(6,182,212,0.22)' : '1px solid rgba(255,255,255,0.08)',
                    boxShadow: allowed ? '0 0 12px rgba(6,182,212,0.06)' : undefined,
                  }}>
                  {/* Card header */}
                  <div className="p-5 flex flex-col sm:flex-row sm:items-start gap-4">
                    <div className="flex-1 space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Layers className="w-4 h-4 text-[var(--accent)] shrink-0" />
                        <span className="font-semibold text-[var(--ink)]">{s.name}</span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${STATUS_STYLES[s.status] ?? ''}`}>
                          {s.status.replace(/_/g, ' ')}
                        </span>
                        {/* Allowlist badge */}
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ml-auto ${
                          allowed
                            ? 'bg-emerald-950/50 text-emerald-400 border-emerald-800/40'
                            : 'bg-white/5 text-[var(--subtle)] border-white/10'
                        }`}>
                          {allowed ? 'ALLOWLISTED' : 'NOT ALLOWLISTED'}
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--subtle)]">{s.desc}</p>
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-[11px] text-[var(--subtle)]">
                          Risk: <span className={`font-semibold ${RISK_COLOR[s.risk] ?? ''}`}>{s.risk}</span>
                        </span>
                        <span className="text-[11px] text-[var(--subtle)]">
                          APY: <span className="font-semibold text-[var(--success)]">{s.apy}%</span>
                        </span>
                        <span className="text-[11px] text-[var(--subtle)]">
                          Simulated: <span className="font-semibold tabular">${s.allocated.toLocaleString()}</span>
                        </span>
                      </div>
                      {/* Protocol address */}
                      <div className="flex items-center gap-1.5 pt-0.5">
                        <span className="text-[10px] text-[var(--subtle)]">Protocol:</span>
                        <a href={`${chain.explorerBase}/address/${s.protocolAddress}`}
                          target="_blank" rel="noopener noreferrer"
                          className="mono text-[10px] text-[var(--subtle)] hover:text-[var(--accent)] flex items-center gap-1 truncate max-w-[200px]">
                          {s.protocolAddress.slice(0, 10)}…{s.protocolAddress.slice(-4)}
                          <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                        </a>
                      </div>
                    </div>

                    {/* Owner: Allowlist toggle */}
                    {isOwner && (
                      <button
                        onClick={() => void handleSetAllowedProtocol(s.id, s.protocolAddress, !allowed)}
                        disabled={alPending}
                        className={`min-h-[40px] px-4 rounded-xl text-[11px] font-bold border transition-all flex items-center gap-2 shrink-0 ${
                          allowed
                            ? 'border-[var(--danger)]/40 bg-[var(--danger)]/10 text-[var(--danger)] hover:bg-[var(--danger)]/20'
                            : 'border-emerald-700/40 bg-emerald-950/30 text-emerald-400 hover:bg-emerald-950/50'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {alPending
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : allowed
                            ? <><AlertTriangle className="w-3.5 h-3.5" /> Remove</>
                            : <><CheckCircle2 className="w-3.5 h-3.5" /> Allowlist</>}
                      </button>
                    )}
                  </div>

                  {/* Allocate form — shown when allowed OR owner (so owner can test) */}
                  {(allowed || isOwner) && (
                    <div className="border-t border-[var(--border)] p-5 space-y-3 bg-[var(--surface-muted)]/30">
                      {!allowed && isOwner && (
                        <p className="text-[11px] text-amber-400">
                          Protocol not yet allowlisted — the transaction will revert until you allowlist it above.
                        </p>
                      )}
                      <div className="flex gap-2 items-end">
                        <div className="flex-1 rounded-xl bg-[var(--surface-muted)] border border-[var(--border)] p-3">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--subtle)] block mb-1.5">
                            USDC to Allocate
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number" min="0" step="any"
                              value={inputVal}
                              onChange={e => setStrategyInputs(prev => ({ ...prev, [s.id]: e.target.value }))}
                              placeholder="0.00"
                              disabled={pending}
                              className="flex-1 bg-transparent display text-xl font-bold text-[var(--ink)] placeholder-white/20 focus:outline-none tabular min-w-0"
                            />
                            <div className="flex items-center gap-1.5 shrink-0">
                              <TokenUSDC variant="branded" size={16} />
                              <span className="text-[12px] font-semibold text-[var(--ink-2)]">USDC</span>
                            </div>
                          </div>
                        </div>
                        {!walletAddress ? (
                          <ConnectKitButton label="Connect" />
                        ) : !canExecute ? (
                          <div className="text-[11px] text-[var(--subtle)] text-center max-w-[120px]">
                            Owner or agent wallet required
                          </div>
                        ) : (
                          <button
                            onClick={() => void handleExecuteStrategy(idx)}
                            disabled={pending || !inputVal}
                            className="min-h-[48px] px-5 rounded-xl bg-[var(--accent)] text-[#0d1b2f] text-[12px] font-bold hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2 whitespace-nowrap shrink-0"
                          >
                            {pending
                              ? <><Loader2 className="w-4 h-4 animate-spin" /> Executing…</>
                              : <><ArrowUpRight className="w-4 h-4" /> Allocate</>}
                          </button>
                        )}
                      </div>

                      {/* Latest tx hash for this strategy */}
                      {txHash && (
                        <a href={buildTxExplorerUrl(CHAIN_ID, txHash)} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 mono text-[10px] text-[var(--subtle)] hover:text-[var(--accent)] transition-colors">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                          Last tx: {txHash.slice(0, 16)}… <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                  )}

                  {/* No access message */}
                  {!allowed && !isOwner && (
                    <div className="border-t border-[var(--border)] px-5 py-3 text-[11px] text-[var(--subtle)]">
                      Waiting for owner to allowlist this protocol.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ══ Guardrails ══════════════════════════════════════════════════════════ */}
        {tab === 'guardrails' && (
          <div className="space-y-3">

            {/* Security control center header */}
            <div className="rounded-2xl p-5 flex items-center justify-between flex-wrap gap-3"
              style={{ background: 'linear-gradient(135deg,rgba(6,182,212,0.06) 0%,rgba(139,92,246,0.06) 100%)', border: '1px solid rgba(6,182,212,0.15)' }}>
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl" style={{ background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.2)' }}>
                  <ShieldAlert className="w-5 h-5" style={{ color: '#67e8f9' }} />
                </div>
                <div>
                  <h2 className="text-[15px] font-extrabold text-white tracking-tight">Security Control Center</h2>
                  <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>On-chain guardrails — enforced by smart contract logic</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold"
                  style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.25)' }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />ALL SYSTEMS ACTIVE
                </span>
              </div>
            </div>

            {/* Status cards */}
            {[
              { icon: Lock,          title: 'Daily Spend Cap',       live: `$${fmtUsdc(dailyLimit)} / day`, desc: 'Hard limit enforced on-chain. Resets every 24 h from the last window start.', accent: '#67e8f9', accentBg: 'rgba(6,182,212,0.08)', accentBorder: 'rgba(6,182,212,0.2)' },
              { icon: ShieldAlert,   title: 'Protocol Allowlist',    live: 'On-chain mapping',             desc: 'executeStrategy reverts unless the target address is pre-approved via setAllowedProtocol.', accent: '#34d399', accentBg: 'rgba(52,211,153,0.08)', accentBorder: 'rgba(52,211,153,0.2)' },
              { icon: Zap,           title: 'Code-Existence Guard',  live: 'Active',                       desc: 'Calls revert if targetProtocol has no bytecode, preventing execution against EOAs.', accent: '#c4b5fd', accentBg: 'rgba(139,92,246,0.08)', accentBorder: 'rgba(139,92,246,0.2)' },
              { icon: CheckCircle2,  title: 'Allowance Reset',       live: 'Post-call',                    desc: 'ERC-20 allowance is force-reset to 0 after every strategy call, eliminating residual drain risk.', accent: '#34d399', accentBg: 'rgba(52,211,153,0.08)', accentBorder: 'rgba(52,211,153,0.2)' },
            ].map(g => (
              <div key={g.title} className="rounded-2xl p-5 flex items-start gap-4 transition-all hover:scale-[1.005]"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="p-2.5 rounded-xl shrink-0" style={{ background: g.accentBg, border: `1px solid ${g.accentBorder}` }}>
                  <g.icon className="w-[1.125rem] h-[1.125rem]" style={{ color: g.accent }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                    <span className="font-bold text-white text-[13px]">{g.title}</span>
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399', border: '1px solid rgba(52,211,153,0.2)' }}>
                      <span className="w-1 h-1 rounded-full bg-emerald-400" />ENFORCED
                    </span>
                    <span className="mono text-[11px] ml-auto font-semibold" style={{ color: g.accent }}>{g.live}</span>
                  </div>
                  <p className="text-[12px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>{g.desc}</p>
                </div>
              </div>
            ))}

            {/* ── Owner write controls ── */}
            <div className="rounded-2xl p-5 space-y-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg" style={{ background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.2)' }}>
                  <Settings className="w-3.5 h-3.5" style={{ color: '#67e8f9' }} />
                </div>
                <h3 className="font-extrabold text-white text-[14px]">Owner Controls</h3>
                <span className="text-[10px] ml-auto" style={{ color: 'rgba(255,255,255,0.3)' }}>Requires owner wallet</span>
              </div>

              {/* Update daily limit */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest block" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Update Daily Limit (USDC)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number" min="0" step="any"
                    value={newLimitInput}
                    onChange={e => setNewLimitInput(e.target.value)}
                    placeholder={`Current: $${fmtUsdc(dailyLimit)}`}
                    className="flex-1 min-h-[48px] rounded-xl px-4 text-[13px] font-semibold text-white placeholder-white/20 focus:outline-none tabular"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                  <button
                    onClick={() => void handleUpdateLimit()}
                    disabled={limitPending || limitConfirming || !newLimitInput}
                    className="min-h-[48px] px-5 rounded-xl text-[12px] font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2 whitespace-nowrap"
                    style={{ background: 'linear-gradient(135deg,#06b6d4,#3b82f6)', color: '#fff' }}
                  >
                    {limitPending || limitConfirming ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {limitConfirming ? 'Confirming…' : limitPending ? 'Sending…' : 'Set Limit'}
                  </button>
                </div>
                {limitTxHash && (
                  <a href={buildTxExplorerUrl(CHAIN_ID, limitTxHash)} target="_blank" rel="noopener noreferrer"
                    className="mono text-[10px] text-[var(--subtle)] hover:text-[var(--accent)] flex items-center gap-1">
                    {limitTxHash.slice(0, 16)}… <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              {/* Update agent address */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest block" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Update AI Agent Address
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newAgentInput}
                    onChange={e => setNewAgentInput(e.target.value)}
                    placeholder="0x… new agent address"
                    className="flex-1 min-h-[48px] rounded-xl px-4 text-[12px] mono text-white placeholder-white/20 focus:outline-none"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                  <button
                    onClick={() => void handleUpdateAgent()}
                    disabled={agentTxPending || agentTxConfirming || !newAgentInput}
                    className="min-h-[48px] px-5 rounded-xl text-[12px] font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2 whitespace-nowrap"
                    style={{ background: 'linear-gradient(135deg,#06b6d4,#3b82f6)', color: '#fff' }}
                  >
                    {agentTxPending || agentTxConfirming ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {agentTxConfirming ? 'Confirming…' : agentTxPending ? 'Sending…' : 'Update Agent'}
                  </button>
                </div>
                {agentTxHash && (
                  <a href={buildTxExplorerUrl(CHAIN_ID, agentTxHash)} target="_blank" rel="noopener noreferrer"
                    className="mono text-[10px] text-[var(--subtle)] hover:text-[var(--accent)] flex items-center gap-1">
                    {agentTxHash.slice(0, 16)}… <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              {/* Emergency withdraw */}
              <div className="pt-3" style={{ borderTop: '1px solid rgba(239,68,68,0.15)' }}>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <p className="text-[12px] font-semibold" style={{ color: '#f87171' }}>Emergency Withdraw All</p>
                    <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>Drains 100% of vault USDC to the owner address.</p>
                  </div>
                  <button
                    onClick={() => void handleEmergencyWithdraw()}
                    disabled={ewPending}
                    className="min-h-[48px] px-5 rounded-xl border border-[var(--danger)]/50 bg-[var(--danger)]/10 text-[var(--danger)] text-[12px] font-bold hover:bg-[var(--danger)]/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                  >
                    {ewPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
                    {ewPending ? 'Sending…' : 'Withdraw All'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══ Swap & Bridge ═══════════════════════════════════════════════════════ */}
        {tab === 'swap' && (
          <div className="max-w-[520px] mx-auto space-y-4">

            {/* Sub-tab toggle */}
            <div className="flex items-center gap-1 p-1 rounded-2xl border border-[var(--border)] bg-[var(--surface)] w-fit">
              {(['swap', 'bridge'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setSwapMode(m)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-bold transition-all ${
                    swapMode === m
                      ? 'bg-white shadow-sm text-[var(--ink)] border border-[var(--border)]'
                      : 'text-[var(--subtle)] hover:text-[var(--ink)]'
                  }`}
                >
                  {m === 'swap' ? <ArrowDownUp className="w-3.5 h-3.5" /> : <GitBranch className="w-3.5 h-3.5" />}
                  {m === 'swap' ? 'Swap' : 'Bridge'}
                </button>
              ))}
            </div>

            {swapMode === 'swap' && (
              <div className="px-1">
                <SwapCard />
              </div>
            )}

            {swapMode === 'bridge' && (
              <div className="">

            {/* ── DestChainModal ─────────────────────────────────────── */}
            {destChainModalOpen && (
              <div className="fixed inset-0 z-[600] flex items-end sm:items-center justify-center" onClick={() => setDestChainModalOpen(false)}>
                <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
                <div
                  className="relative w-full max-w-[440px] rounded-t-3xl sm:rounded-3xl overflow-hidden"
                  style={{
                    background: 'linear-gradient(160deg,#13111c 0%,#0f0d18 100%)',
                    border: '1px solid rgba(6,182,212,0.18)',
                    boxShadow: '0 -8px 60px rgba(6,182,212,0.12), 0 0 0 1px rgba(255,255,255,0.04)',
                  }}
                  onClick={e => e.stopPropagation()}
                >
                  <div className="flex justify-center pt-3 pb-1 sm:hidden">
                    <div className="w-10 h-1 rounded-full bg-white/20" />
                  </div>
                  <div className="flex items-center justify-between px-5 pt-4 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <div>
                      <h3 className="font-extrabold text-[15px] text-white tracking-tight">Select destination</h3>
                      <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{BRIDGE_CHAINS.length} CCTP v2 chains</p>
                    </div>
                    <button onClick={() => setDestChainModalOpen(false)} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-white/10 transition-colors">
                      <X className="w-4 h-4 text-white/50" />
                    </button>
                  </div>
                  <div className="px-4 pt-3 pb-2">
                    <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl transition-colors" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }}>
                      <Search className="w-4 h-4 shrink-0" style={{ color: 'rgba(255,255,255,0.35)' }} />
                      <input
                        value={bridgeDestSearch}
                        onChange={e => setBridgeDestSearch(e.target.value)}
                        placeholder="Search network…"
                        className="flex-1 bg-transparent text-[13px] text-white placeholder-white/30 focus:outline-none min-w-0"
                        autoFocus
                      />
                      {bridgeDestSearch && <button onClick={() => setBridgeDestSearch('')} className="text-white/30 hover:text-white/60"><X className="w-3.5 h-3.5" /></button>}
                    </div>
                  </div>
                  <div className="px-2 pb-4 max-h-[380px] overflow-y-auto">
                    {BRIDGE_CHAINS.filter(c =>
                      !bridgeDestSearch ||
                      c.label.toLowerCase().includes(bridgeDestSearch.toLowerCase()) ||
                      String(c.chainId).includes(bridgeDestSearch)
                    ).map(c => {
                      const isSel = bridgeDest === c.id;
                      return (
                        <button
                          key={c.id}
                          onClick={() => { setBridgeDest(c.id); setBridgeDestSearch(''); setDestChainModalOpen(false); if (bridgePhase === 'done') setBridgePhase('idle'); }}
                          className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl text-left transition-all"
                          style={{
                            background: isSel ? 'rgba(6,182,212,0.1)' : 'transparent',
                            border: isSel ? '1px solid rgba(6,182,212,0.3)' : '1px solid transparent',
                          }}
                          onMouseEnter={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; }}
                          onMouseLeave={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                        >
                          <span className="text-[22px] leading-none shrink-0">{c.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[14px] font-bold text-white">{c.label}</span>
                              {c.fast && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399' }}>FAST</span>}
                            </div>
                            <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>Chain {c.chainId}</p>
                          </div>
                          {isSel && <div className="w-2 h-2 rounded-full shrink-0" style={{ background: '#06b6d4', boxShadow: '0 0 6px rgba(6,182,212,0.8)' }} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ── Bridge card ─────────────────────────────────────────── */}
            <div className="max-w-[440px] mx-auto">
              <div className="rounded-3xl overflow-hidden" style={{
                background: 'linear-gradient(160deg,#0a0e18 0%,#0d1120 100%)',
                border: '1px solid rgba(6,182,212,0.15)',
              }}>

                {/* Card header */}
                <div className="flex items-center justify-between px-5 pt-5 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <div>
                    <h2 className="text-[17px] font-extrabold text-white tracking-tight">Bridge</h2>
                    <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>Circle CCTP v2 · gas paid in USDC</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold" style={{ background: 'rgba(139,92,246,0.15)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.2)' }}>
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />CCTP v2
                    </span>
                  </div>
                </div>

                {/* FROM */}
                <div className="p-4">
                  <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>Send (Arc Mainnet)</span>
                      {walletAddress && walletUsdcBalance !== undefined && (
                        <div className="flex items-center gap-2">
                          <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                            {(Number(walletUsdcBalance) / 1e6).toFixed(2)} USDC
                          </span>
                          <button
                            onClick={() => setBridgeAmount((Number(walletUsdcBalance) / 1e6).toFixed(6))}
                            className="text-[10px] font-black px-2 py-0.5 rounded-lg transition-all"
                            style={{ background: 'rgba(6,182,212,0.15)', color: '#67e8f9', border: '1px solid rgba(6,182,212,0.25)' }}
                          >MAX</button>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <input
                          type="number" min="0" step="any"
                          value={bridgeAmount}
                          onChange={e => { setBridgeAmount(e.target.value); if (bridgePhase === 'done') setBridgePhase('idle'); }}
                          placeholder="0.00"
                          className="w-full bg-transparent text-[36px] font-black text-white placeholder-white/15 focus:outline-none tabular leading-tight"
                        />
                        <p className="text-[12px] mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
                          {bridgeAmount && parseFloat(bridgeAmount) > 0 ? `$${parseFloat(bridgeAmount).toFixed(2)}` : ' '}
                        </p>
                      </div>
                      {/* Source token pill */}
                      <div className="flex items-center gap-2 px-3 py-2 rounded-2xl shrink-0"
                        style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}>
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-white font-black text-[10px]" style={{ background: '#2775CA' }}>US</div>
                        <span className="text-[14px] font-bold text-white">USDC</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Arrow divider */}
                <div className="flex justify-center -mt-1 -mb-1 relative z-10">
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
                    style={{
                      background: 'linear-gradient(135deg,#0c1a2e,#0e2240)',
                      border: '2px solid rgba(6,182,212,0.35)',
                      boxShadow: '0 0 16px rgba(6,182,212,0.25)',
                    }}>
                    <ArrowRight className="w-4 h-4" style={{ color: '#67e8f9' }} />
                  </div>
                </div>

                {/* TO */}
                <div className="p-4">
                  <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>Receive</span>
                      <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.3)' }}>1:1 · no slippage</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-[36px] font-black tabular leading-tight" style={{ color: bridgeAmount && parseFloat(bridgeAmount) > 0 ? '#34d399' : 'rgba(255,255,255,0.15)' }}>
                          {bridgeAmount && parseFloat(bridgeAmount) > 0 ? parseFloat(bridgeAmount).toFixed(2) : '0'}
                        </p>
                        <p className="text-[12px] mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>USDC on {destChain.label}</p>
                      </div>
                      {/* Dest chain selector button */}
                      <button
                        onClick={() => setDestChainModalOpen(true)}
                        className="flex items-center gap-2 px-3 py-2 rounded-2xl shrink-0 transition-all hover:scale-105 active:scale-95"
                        style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }}
                      >
                        <span className="text-[18px] leading-none">{destChain.icon}</span>
                        <div className="text-left">
                          <p className="text-[13px] font-bold text-white leading-tight">{destChain.label}</p>
                          {destChain.fast && <p className="text-[9px]" style={{ color: '#34d399' }}>⚡ Fast</p>}
                        </div>
                        <ChevronDown className="w-3.5 h-3.5 opacity-40" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Route summary row */}
                <div className="mx-4 mb-3 px-4 py-2.5 rounded-2xl flex items-center justify-between"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    Arc → {destChain.label} · Circle CCTP v2
                  </span>
                  <span className={`text-[11px] font-semibold ${destChain.fast ? '' : ''}`}
                    style={{ color: destChain.fast ? '#34d399' : 'rgba(255,255,255,0.5)' }}>
                    {destChain.fast ? '⚡ ~8–20 s' : '~2–5 min'}
                  </span>
                </div>

                {/* Step tracker */}
                {bridgeSteps.length > 0 && (
                  <div className="mx-4 mb-3 rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div className="px-4 py-2.5 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.03)' }}>
                      <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>CCTP Steps</span>
                      {bridgePhase === 'bridging' && <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: '#67e8f9' }} />}
                      {bridgePhase === 'done'     && <CheckCircle2 className="w-3.5 h-3.5" style={{ color: '#34d399' }} />}
                      {bridgePhase === 'error'    && <AlertTriangle className="w-3.5 h-3.5 text-red-400" />}
                    </div>
                    {bridgeSteps.map((s, idx) => {
                      const LABELS: Record<string, string> = { approve: 'Approve USDC', burn: 'Burn on Arc', fetchAttestation: 'Circle Attestation', mint: 'Mint on Destination' };
                      const isActive  = s.state === 'active';
                      const isSuccess = s.state === 'success';
                      const isError   = s.state === 'error';
                      return (
                        <div key={s.name} className="px-4 py-3 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: isActive ? 'rgba(6,182,212,0.05)' : 'transparent' }}>
                          <div className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-extrabold"
                            style={{
                              background: isSuccess ? 'rgba(52,211,153,0.15)' : isError ? 'rgba(239,68,68,0.15)' : isActive ? 'rgba(6,182,212,0.15)' : 'rgba(255,255,255,0.06)',
                              color: isSuccess ? '#34d399' : isError ? '#f87171' : isActive ? '#67e8f9' : 'rgba(255,255,255,0.3)',
                              border: `1px solid ${isSuccess ? 'rgba(52,211,153,0.3)' : isError ? 'rgba(239,68,68,0.3)' : isActive ? 'rgba(6,182,212,0.3)' : 'rgba(255,255,255,0.08)'}`,
                            }}>
                            {isSuccess ? <CheckCircle2 className="w-3.5 h-3.5" /> : isActive ? <Loader2 className="w-3 h-3 animate-spin" /> : isError ? <AlertTriangle className="w-3 h-3" /> : <span>{idx + 1}</span>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-semibold" style={{ color: isSuccess ? '#34d399' : isError ? '#f87171' : isActive ? '#67e8f9' : 'rgba(255,255,255,0.4)' }}>
                              {LABELS[s.name] ?? s.name}
                            </p>
                            {s.txHash && (
                              <a href={s.explorerUrl ?? buildTxExplorerUrl(CHAIN_ID, s.txHash)} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1 font-mono text-[10px] hover:opacity-80" style={{ color: '#a5b4fc' }}>
                                {s.txHash.slice(0, 16)}… <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            )}
                          </div>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                            style={{
                              background: isSuccess ? 'rgba(52,211,153,0.1)' : isActive ? 'rgba(6,182,212,0.1)' : isError ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.05)',
                              color: isSuccess ? '#34d399' : isActive ? '#67e8f9' : isError ? '#f87171' : 'rgba(255,255,255,0.3)',
                              border: `1px solid ${isSuccess ? 'rgba(52,211,153,0.2)' : isActive ? 'rgba(6,182,212,0.2)' : isError ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)'}`,
                            }}>
                            {s.state.toUpperCase()}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Error */}
                {bridgePhase === 'error' && (
                  <div className="mx-4 mb-3 px-4 py-3 rounded-2xl space-y-1.5"
                    style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                      <p className="text-[12px] font-semibold text-red-400">Bridge failed</p>
                    </div>
                    <p className="text-[11px]" style={{ color: 'rgba(248,113,113,0.8)' }}>{bridgeError}</p>
                    {lastBridgeResult && (
                      <button onClick={() => void handleRetryBridge()} className="flex items-center gap-1.5 text-[11px] font-bold" style={{ color: '#67e8f9' }}>
                        <RefreshCw className="w-3 h-3" /> Retry from failed step
                      </button>
                    )}
                  </div>
                )}

                {/* Success */}
                {bridgePhase === 'done' && (
                  <div className="mx-4 mb-3 px-4 py-3 rounded-2xl space-y-1.5"
                    style={{ background: 'rgba(52,211,153,0.07)', border: '1px solid rgba(52,211,153,0.18)' }}>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: '#34d399' }} />
                      <p className="text-[12px] font-extrabold" style={{ color: '#34d399' }}>Bridge complete — all 4 steps confirmed</p>
                    </div>
                    {bridgeTxHash && (
                      <a href={buildTxExplorerUrl(CHAIN_ID, bridgeTxHash)} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 font-mono text-[11px] hover:opacity-80" style={{ color: '#a5b4fc' }}>
                        Burn tx: {bridgeTxHash.slice(0, 20)}… <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    <p className="text-[11px]" style={{ color: 'rgba(52,211,153,0.7)' }}>
                      USDC minted on <span className="font-semibold text-[#34d399]">{destChain.label}</span>. Check your wallet.
                    </p>
                  </div>
                )}

                {/* Wrong chain */}
                {walletAddress && walletChainId !== CHAIN_ID && (
                  <div className="mx-4 mb-3 px-4 py-3 rounded-2xl flex items-center justify-between gap-3"
                    style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                    <span className="text-[12px] font-semibold" style={{ color: '#fcd34d' }}>Switch to Arc Mainnet (Chain 5042)</span>
                    <button onClick={() => void switchChainAsync({ chainId: CHAIN_ID })}
                      className="shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-colors"
                      style={{ background: '#f59e0b', color: '#1c1917' }}>
                      Switch
                    </button>
                  </div>
                )}

                {/* CTA */}
                <div className="px-4 pb-5">
                  {!walletAddress ? (
                    <div className="flex justify-center py-1"><ConnectKitButton label="Connect Wallet to Bridge" /></div>
                  ) : (
                    <button
                      onClick={() => void handleBridge()}
                      disabled={!bridgeAmount || parseFloat(bridgeAmount || '0') <= 0 || bridgePhase === 'bridging' || walletChainId !== CHAIN_ID}
                      className="w-full min-h-[52px] rounded-2xl text-[15px] font-extrabold tracking-tight disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2.5 transition-all"
                      style={{
                        background: (!bridgeAmount || parseFloat(bridgeAmount || '0') <= 0)
                          ? 'rgba(6,182,212,0.15)'
                          : 'linear-gradient(135deg,#06b6d4 0%,#3b82f6 50%,#6366f1 100%)',
                        color: '#fff',
                        boxShadow: bridgeAmount && parseFloat(bridgeAmount) > 0 ? '0 4px 24px rgba(6,182,212,0.35)' : 'none',
                      }}
                    >
                      {bridgePhase === 'bridging' ? <><Loader2 className="w-5 h-5 animate-spin" /> Bridging…</> : <><GitBranch className="w-5 h-5" /> Initiate Bridge Route</>}
                    </button>
                  )}
                </div>
              </div>
            </div>
            </div>
            )}
          </div>
        )}


      </main>

      {/* Transaction History drawer */}
      <TxHistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        records={txRecords}
        onClear={clearHistory}
      />
    </div>
  );
}
