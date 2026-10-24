import React from 'react';
import { USDCBalance } from './USDCBalance';
import {
  ArrowUpRight,
  TrendingUp,
  ShieldCheck,
  Layers,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { useReadContract } from 'wagmi';
import { erc20Abi } from 'viem';
import { formatUnits } from 'viem';

// ── Arc Mainnet constants ──────────────────────────────────────────────────────
const CHAIN_ID   = 5042;
const USDC_ADDR  = '0x3600000000000000000000000000000000000000' as `0x${string}`;
const VAULT_ADDR = '0x02793cfd3a14f341da0768bea80a61b32b9a94a0' as `0x${string}`;

const VAULT_ABI = [
  { name: 'dailyLimit',        type: 'function', stateMutability: 'view', inputs: [],                      outputs: [{ type: 'uint256' }] },
  { name: 'spentToday',        type: 'function', stateMutability: 'view', inputs: [],                      outputs: [{ type: 'uint256' }] },
  { name: 'allowedProtocols',  type: 'function', stateMutability: 'view', inputs: [{ type: 'address' }],   outputs: [{ type: 'bool'    }] },
] as const;

const STRATEGIES = [
  { id: 1, name: 'Arc USDC Liquidity Vault',      apy: 5.82, allocated: 50000 },
  { id: 2, name: 'Arc Yield Aggregator',           apy: 7.40, allocated: 65000 },
  { id: 3, name: 'Arc FX Delta Neutral Pool',      apy: 11.80, allocated: 15000 },
];

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export const MainDashboard: React.FC = () => {
  // ── Live vault balance read ────────────────────────────────────────────────
  const {
    data: balanceRaw,
    isLoading: balLoading,
    isError: balError,
    refetch,
  } = useReadContract({
    address: USDC_ADDR,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [VAULT_ADDR],
    chainId: CHAIN_ID,
    query: { refetchInterval: 8000, retry: 2, staleTime: 5000 },
  });

  const { data: dailyLimitRaw } = useReadContract({
    address: VAULT_ADDR,
    abi: VAULT_ABI,
    functionName: 'dailyLimit',
    chainId: CHAIN_ID,
    query: { refetchInterval: 8000 },
  });

  const { data: spentTodayRaw } = useReadContract({
    address: VAULT_ADDR,
    abi: VAULT_ABI,
    functionName: 'spentToday',
    chainId: CHAIN_ID,
    query: { refetchInterval: 8000 },
  });

  const dailyLimit  = dailyLimitRaw  !== undefined ? Number(formatUnits(dailyLimitRaw,  6)) : null;
  const spentToday  = spentTodayRaw  !== undefined ? Number(formatUnits(spentTodayRaw,  6)) : null;
  const totalTVL    = STRATEGIES.reduce((s, st) => s + st.allocated, 0);
  const budgetPct   = dailyLimit && spentToday !== null ? Math.min(100, (spentToday / dailyLimit) * 100) : 0;

  return (
    <div className="min-h-screen text-slate-100 flex flex-col antialiased"
         style={{ background: 'var(--bg)', color: 'var(--ink)' }}>

      {/* ── Nav bar ────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b backdrop-blur-sm"
              style={{ borderColor: 'var(--border)', background: 'var(--surface-glass)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold font-mono"
                 style={{ background: 'var(--primary-dim)', border: '1px solid var(--primary-border)', color: 'var(--primary)' }}>
              AG
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold tracking-tight" style={{ color: 'var(--ink)' }}>ArcGentic</span>
              <span className="px-2 py-0.5 text-[10px] font-mono font-medium rounded border"
                    style={{ background: 'var(--surface-strong)', color: 'var(--muted)', borderColor: 'var(--border-strong)' }}>
                Chain ID: {CHAIN_ID}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => void refetch()}
              className="p-2 rounded-lg transition-all focus:outline-none min-h-[36px] min-w-[36px] flex items-center justify-center"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--muted)' }}
              aria-label="Refresh data"
            >
              <RefreshCw className={`w-4 h-4 ${balLoading ? 'animate-spin' : ''}`}
                         style={balLoading ? { color: 'var(--emerald)' } : {}} />
            </button>

            <div className="flex items-center space-x-2 rounded-lg px-3 py-1.5 text-xs font-mono"
                 style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink-2)' }}>
              <span className="w-2 h-2 rounded-full" style={{ background: 'var(--emerald)' }} />
              <span>Arc Mainnet</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* Page heading */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b"
             style={{ borderColor: 'var(--border)' }}>
          <div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--ink)' }}>
              Treasury Management
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
              Automated yield allocation and vault balancing on Arc Mainnet.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button className="px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 min-h-[40px]"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink-2)' }}>
              <ArrowUpRight className="w-4 h-4" style={{ color: 'var(--muted)' }} />
              Deposit Funds
            </button>
            <button className="px-4 py-2 text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 min-h-[40px] btn-neon-emerald">
              <TrendingUp className="w-4 h-4" />
              Rebalance Vault
            </button>
          </div>
        </div>

        {/* ── Metric cards ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

          {/* USDC Balance */}
          <div className="ag-card ag-card-emerald p-5 space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider"
                 style={{ color: 'var(--muted)' }}>
              <span>Vault USDC Balance</span>
              <span className="text-[10px] font-mono rounded px-1.5 py-0.5 pill-violet">Native ERC-20</span>
            </div>
            <USDCBalance
              rawValue={balanceRaw}
              isLoading={balLoading}
              isError={balError}
              onRefresh={() => void refetch()}
            />
            <div className="pt-2 border-t text-xs font-mono" style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
              Verified via{' '}
              <a href="https://explorer.arc.io" target="_blank" rel="noopener noreferrer"
                 className="hover:underline" style={{ color: 'var(--emerald)' }}>Arc Explorer</a>
            </div>
          </div>

          {/* TVL */}
          <div className="ag-card p-5 space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider"
                 style={{ color: 'var(--muted)' }}>
              <span>Total Value Locked</span>
              <span className="text-[10px] font-mono rounded px-1.5 py-0.5 pill-pink">Active</span>
            </div>
            <div className="text-3xl font-bold font-mono-num" style={{ color: 'var(--ink)' }}>
              ${fmt(totalTVL)}
            </div>
            <div className="pt-2 border-t text-xs" style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
              {STRATEGIES.length} AI Yield Strategy Vaults
            </div>
          </div>

          {/* Daily budget */}
          <div className="ag-card ag-card-amber p-5 space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider"
                 style={{ color: 'var(--muted)' }}>
              <span>Daily Budget</span>
              <span className="flex items-center gap-1 text-[10px] font-mono rounded px-1.5 py-0.5 pill-emerald">
                <ShieldCheck className="w-3 h-3" /> Guardrail
              </span>
            </div>
            <div className="text-3xl font-bold font-mono-num" style={{ color: 'var(--ink)' }}>
              {dailyLimit !== null ? `$${fmt(dailyLimit)}` : '—'}
            </div>
            {/* Budget progress bar */}
            {dailyLimit !== null && spentToday !== null && (
              <div className="space-y-1">
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                  <div className="h-full rounded-full transition-all duration-700"
                       style={{ width: `${budgetPct}%`, background: budgetPct > 80 ? 'var(--danger)' : 'var(--amber)' }} />
                </div>
                <div className="flex justify-between text-[10px] font-mono" style={{ color: 'var(--muted)' }}>
                  <span>Spent: ${fmt(spentToday)}</span>
                  <span>Remaining: ${fmt(Math.max(0, dailyLimit - spentToday))}</span>
                </div>
              </div>
            )}
            <div className="pt-1 border-t text-xs" style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
              OpenZeppelin v5.1.0 Guardrail
            </div>
          </div>

        </div>

        {/* ── Strategy table ───────────────────────────────────────────────── */}
        <div className="ag-card overflow-hidden">
          <div className="px-6 py-4 border-b flex items-center justify-between"
               style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center space-x-2">
              <Layers className="w-4 h-4" style={{ color: 'var(--primary)' }} />
              <h2 className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Active Vault Strategies</h2>
            </div>
            <a href="https://arcgentic.netlify.app" target="_blank" rel="noreferrer"
               className="text-xs flex items-center gap-1 transition-colors"
               style={{ color: 'var(--muted)' }}>
              Live App <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-xs font-mono uppercase tracking-wider"
                    style={{ borderColor: 'var(--border)', background: 'var(--surface-muted)', color: 'var(--muted)' }}>
                  <th className="py-3.5 px-6">Vault Name</th>
                  <th className="py-3.5 px-6">Current APY</th>
                  <th className="py-3.5 px-6">Allocated</th>
                  <th className="py-3.5 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody style={{ color: 'var(--ink-2)' }}>
                {STRATEGIES.map((s, i) => (
                  <tr key={s.id}
                      className="transition-colors"
                      style={{ borderBottom: i < STRATEGIES.length - 1 ? `1px solid var(--border)` : undefined }}>
                    <td className="py-4 px-6 font-medium" style={{ color: 'var(--ink)' }}>{s.name}</td>
                    <td className="py-4 px-6 font-mono font-semibold" style={{ color: 'var(--emerald)' }}>{s.apy.toFixed(2)}%</td>
                    <td className="py-4 px-6 font-mono-num">${fmt(s.allocated)}</td>
                    <td className="py-4 px-6 text-right">
                      <button className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors min-h-[32px] btn-ghost">
                        Manage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </main>
    </div>
  );
};
