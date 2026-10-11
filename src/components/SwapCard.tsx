import { useState, useEffect, useRef, useCallback } from 'react';
import { useAccount, useReadContract, useSwitchChain } from 'wagmi';
import { erc20Abi } from 'viem';
import { ConnectKitButton } from 'connectkit';
import { ArrowDown, ChevronDown, CheckCircle2, Loader2, ExternalLink, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { createViemAdapterFromProvider } from '@circle-fin/adapter-viem-v2';
import { AppKit } from '@circle-fin/app-kit';

import type { EIP1193Provider } from 'viem';

// ── Token registry — official Arc Mainnet (Chain ID 5042) assets ────────────
export const SWAP_TOKENS = [
  {
    symbol: 'USDC', name: 'USD Coin', decimals: 6,
    address: '0x3600000000000000000000000000000000000000' as `0x${string}`,
    icon: '🔵', color: '#2775CA', usdRate: 1,
    note: 'Native gas token on Arc Mainnet'
  },
  {
    symbol: 'EURC', name: 'Euro Coin', decimals: 6,
    address: '0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1' as `0x${string}`,
    icon: '🟣', color: '#6366f1', usdRate: 1.08,
    note: 'Circle Euro Stablecoin on Arc'
  },
  {
    symbol: 'cirBTC', name: 'Circle Wrapped BTC', decimals: 8,
    address: '0x8E730732E440C9a6C663e05bc31a44bb47E21e11' as `0x${string}`,
    icon: '🟠', color: '#F7931A', usdRate: 65000,
    note: 'Circle Wrapped Bitcoin on Arc'
  },
] as const;

type TokenSymbol = typeof SWAP_TOKENS[number]['symbol'];
const getToken = (s: TokenSymbol) => SWAP_TOKENS.find(t => t.symbol === s)!;

// ── Helpers ─────────────────────────────────────────────────────────────────
function fmtBalance(raw: bigint, decimals: number) {
  const n = Number(raw) / 10 ** decimals;
  if (decimals >= 18) return n.toFixed(4);
  if (decimals === 8) return n.toFixed(5);
  return n.toFixed(2);
}
function parseAmt(s: string, decimals: number): bigint | null {
  const v = parseFloat(s);
  if (!s || isNaN(v) || v <= 0) return null;
  try { return BigInt(Math.round(v * 10 ** decimals)); } catch { return null; }
}

const CHAIN_ID = 5042; // Arc Mainnet
const SLIPPAGE_OPTIONS = [10, 50, 100]; // bps

// ── Token modal component ────────────────────────────────────────────────────
function TokenModal({ value, exclude, walletAddress, onChange }: {
  value: TokenSymbol;
  exclude?: TokenSymbol;
  walletAddress?: string;
  onChange: (t: TokenSymbol) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const meta = getToken(value);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const filtered = SWAP_TOKENS.filter(t => {
    if (t.symbol === exclude) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q) || t.address.toLowerCase().includes(q);
  });

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-2 rounded-2xl min-h-[44px] font-bold text-[14px] border border-[var(--border-strong)] bg-[var(--surface-strong)] hover:border-[var(--primary-border)] transition-all shrink-0"
        style={{ color: 'var(--ink)' }}
      >
        <span className="text-[18px] leading-none">{meta.icon}</span>
        <span>{meta.symbol}</span>
        <ChevronDown className="w-3.5 h-3.5 text-[var(--subtle)]" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[500] flex items-end sm:items-center justify-center p-4" onClick={() => setOpen(false)}>
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Modal */}
          <div
            className="relative w-full max-w-[400px] rounded-3xl border border-[var(--border-strong)] bg-[var(--surface-strong)] shadow-2xl overflow-hidden"
            style={{ backdropFilter: 'blur(24px)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-[var(--border)]">
              <h3 className="font-extrabold text-[15px] text-[var(--ink)]">Select token</h3>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-xl hover:bg-white/5 transition-colors">
                <X className="w-4 h-4 text-[var(--subtle)]" />
              </button>
            </div>

            {/* Search */}
            <div className="px-4 py-3">
              <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] focus-within:border-[var(--primary-border)] transition-colors">
                <Search className="w-4 h-4 text-[var(--subtle)] shrink-0" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search by name, symbol, or address"
                  className="flex-1 bg-transparent text-[13px] text-[var(--ink)] placeholder-[var(--subtle)] focus:outline-none min-w-0"
                />
                {query && (
                  <button onClick={() => setQuery('')} className="text-[var(--subtle)] hover:text-[var(--ink)]">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Token list */}
            <div className="px-2 pb-4 max-h-[320px] overflow-y-auto space-y-0.5">
              {filtered.length === 0 ? (
                <div className="py-8 text-center text-[13px] text-[var(--subtle)]">No tokens found</div>
              ) : filtered.map(t => (
                <TokenRow
                  key={t.symbol}
                  token={t}
                  isSelected={t.symbol === value}
                  walletAddress={walletAddress}
                  onClick={() => { onChange(t.symbol); setOpen(false); setQuery(''); }}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Token row (with live balance inside modal) ────────────────────────────────
function TokenRow({ token, isSelected, walletAddress, onClick }: {
  token: typeof SWAP_TOKENS[number];
  isSelected: boolean;
  walletAddress?: string;
  onClick: () => void;
}) {
  const { data: balance } = useReadContract({
    address: token.address, abi: erc20Abi, functionName: 'balanceOf',
    args: walletAddress ? [walletAddress as `0x${string}`] : undefined,
    chainId: CHAIN_ID,
    query: { enabled: !!walletAddress, staleTime: 10000, retry: false },
  });

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-3 rounded-2xl text-left hover:bg-white/5 transition-colors ${isSelected ? 'bg-[var(--primary)]/8' : ''}`}
    >
      <span className="text-[24px] leading-none shrink-0">{token.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-[14px] font-bold ${isSelected ? 'text-[var(--primary)]' : 'text-[var(--ink)]'}`}>{token.symbol}</span>
          {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)]" />}
        </div>
        <div className="text-[11px] text-[var(--subtle)] truncate">{token.name}</div>
      </div>
      <div className="text-right shrink-0">
        {walletAddress && balance !== undefined ? (
          <>
            <div className="text-[13px] font-bold text-[var(--ink)] tabular">{fmtBalance(balance, token.decimals)}</div>
            <div className="text-[10px] text-[var(--subtle)]">${(Number(balance) / 10 ** token.decimals * token.usdRate).toFixed(2)}</div>
          </>
        ) : (
          <div className="text-[11px] text-[var(--subtle)]">{token.note}</div>
        )}
      </div>
    </button>
  );
}

// ── Main SwapCard ────────────────────────────────────────────────────────────
export default function SwapCard() {
  const { address: walletAddress, connector } = useAccount();
  const { switchChainAsync } = useSwitchChain();

  const [fromToken, setFromToken] = useState<TokenSymbol>('USDC');
  const [toToken,   setToToken]   = useState<TokenSymbol>('EURC');
  const [amount,    setAmount]    = useState('');
  const [slippage,  setSlippage]  = useState(50);
  const [phase,     setPhase]     = useState<'idle'|'quoting'|'quoted'|'swapping'|'done'|'error'>('idle');
  const [estimate,  setEstimate]  = useState<{ amountOut: string; fee: string } | null>(null);
  const [txHash,    setTxHash]    = useState('');
  const [errMsg,    setErrMsg]    = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fromMeta = getToken(fromToken);
  const toMeta   = getToken(toToken);

  // Live balances — retry:false + 5s staleTime prevents perpetual "Loading…"
  const { data: fromBalance, isLoading: fromLoading } = useReadContract({
    address: fromMeta.address, abi: erc20Abi, functionName: 'balanceOf',
    args: walletAddress ? [walletAddress] : undefined,
    chainId: CHAIN_ID,
    query: { enabled: !!walletAddress, refetchInterval: 8000, staleTime: 5000, retry: false, gcTime: 10000 },
  });
  const { data: toBalance, isLoading: toLoading } = useReadContract({
    address: toMeta.address, abi: erc20Abi, functionName: 'balanceOf',
    args: walletAddress ? [walletAddress] : undefined,
    chainId: CHAIN_ID,
    query: { enabled: !!walletAddress, refetchInterval: 8000, staleTime: 5000, retry: false, gcTime: 10000 },
  });

  // 5s fallback: if still loading after timeout, show 0.00 instead of hanging
  const [fromTimedOut, setFromTimedOut] = useState(false);
  const [toTimedOut,   setToTimedOut]   = useState(false);
  useEffect(() => {
    if (!walletAddress || !fromLoading) { setFromTimedOut(false); return; }
    const t = setTimeout(() => setFromTimedOut(true), 5000);
    return () => clearTimeout(t);
  }, [walletAddress, fromLoading, fromToken]);
  useEffect(() => {
    if (!walletAddress || !toLoading) { setToTimedOut(false); return; }
    const t = setTimeout(() => setToTimedOut(true), 5000);
    return () => clearTimeout(t);
  }, [walletAddress, toLoading, toToken]);

  const displayFrom = fromBalance ?? (fromTimedOut ? 0n : undefined);
  const displayTo   = toBalance   ?? (toTimedOut   ? 0n : undefined);

  // USD value estimation from registry rates
  const amtUsd  = (parseFloat(amount || '0') * fromMeta.usdRate).toFixed(2);
  const outUsd  = estimate ? (parseFloat(estimate.amountOut) * toMeta.usdRate).toFixed(2) : null;

  function reset() { setEstimate(null); setErrMsg(''); if (phase !== 'idle') setPhase('idle'); }

  const appKit = new AppKit();

  // Auto-quote debounce
  const getAdapter = useCallback(async (chainId: number) => {
    if (!connector) throw new Error('Wallet not connected');
    await switchChainAsync({ chainId });
    const provider = await connector.getProvider() as EIP1193Provider;
    return createViemAdapterFromProvider({ provider });
  }, [connector, switchChainAsync]);

  const runQuote = useCallback(async (amt: string, from: TokenSymbol, to: TokenSymbol, bps: number) => {
    if (!walletAddress || from === to) return;
    const raw = parseAmt(amt, getToken(from).decimals);
    if (raw === null) { setPhase('idle'); return; }
    setPhase('quoting'); setEstimate(null); setErrMsg('');
    try {
      const adapter = await getAdapter(CHAIN_ID);
      const est = await appKit.estimateSwap({
        from: { adapter, chain: 'Arc_Testnet' },
        tokenIn: from, tokenOut: to,
        amountIn: amt, config: { slippageBps: bps },
      });
      setEstimate({ amountOut: est.estimatedOutput.amount, fee: est.fees?.[0]?.amount ?? '—' });
      setPhase('quoted');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setErrMsg(msg); setPhase('error');
    }
  }, [getAdapter, walletAddress, appKit]);

  useEffect(() => {
    if (!walletAddress) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!amount || parseFloat(amount) <= 0) { reset(); return; }
    debounceRef.current = setTimeout(() => { void runQuote(amount, fromToken, toToken, slippage); }, 600);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, fromToken, toToken, slippage, walletAddress]);

  async function handleSwap() {
    if (!estimate) return;
    setPhase('swapping');
    const tid = toast.loading(`Swapping ${amount} ${fromToken} → ${toToken}…`);
    try {
      const adapter = await getAdapter(CHAIN_ID);
      const result = await appKit.swap({
        from: { adapter, chain: 'Arc_Testnet' },
        tokenIn: fromToken, tokenOut: toToken,
        amountIn: amount, config: { slippageBps: slippage },
      });
      setTxHash(result.txHash ?? '');
      setPhase('done');
      toast.dismiss(tid);
      toast.success('Swap confirmed', { description: result.txHash?.slice(0, 14) + '…' });
    } catch (e: unknown) {
      toast.dismiss(tid);
      const msg = e instanceof Error ? e.message : String(e);
      setErrMsg(msg); setPhase('error');
      toast.error('Swap failed', { description: msg.slice(0, 80) });
    }
  }

  function flipTokens() {
    const prev = fromToken;
    setFromToken(toToken); setToToken(prev);
    setAmount(''); reset();
  }

  // CTA state
  const ctaLabel = () => {
    if (phase === 'quoting')  return <><Loader2 className="w-4 h-4 animate-spin" /> Getting rate…</>;
    if (phase === 'swapping') return <><Loader2 className="w-4 h-4 animate-spin" /> Swapping…</>;
    if (phase === 'done')     return <><CheckCircle2 className="w-4 h-4" /> Swap Complete</>;
    if (phase === 'quoted')   return <>Exchange {fromToken} → {toToken}</>;
    return <>Enter an amount</>;
  };
  const ctaDisabled = !walletAddress || !amount || parseFloat(amount || '0') <= 0
    || phase === 'quoting' || phase === 'swapping'
    || (phase !== 'quoted' && phase !== 'done');

  return (
    <div className="max-w-[480px] mx-auto space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="display text-xl font-extrabold text-[var(--ink)]">Swap</h2>
          <p className="text-[11px] text-[var(--subtle)] mt-0.5">Trade tokens on Arc Testnet. Gas paid in USDC.</p>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1.5 rounded-full border border-violet-500/30 bg-violet-950/20 text-violet-300">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400 inline-block" />
          Circle App Kit
        </div>
      </div>

      {/* Main swap card — Jumper style */}
      <div className="rounded-3xl border border-[var(--border-strong)] bg-[var(--surface-strong)]">

        {/* FROM box */}
        <div className="p-4 pb-3">
          <div className="flex items-center justify-between mb-1.5 gap-2">
            <span className="text-[11px] font-semibold text-[var(--subtle)]">You pay</span>
            <div className="flex items-center gap-2 min-w-0">
              {walletAddress && displayFrom !== undefined ? (
                <>
                  <span className="text-[11px] text-[var(--subtle)] truncate">
                    Balance: <span className="text-[var(--ink-2)] font-semibold">{fmtBalance(displayFrom, fromMeta.decimals)} {fromToken}</span>
                  </span>
                  <button
                    onClick={() => setAmount(fmtBalance(displayFrom, fromMeta.decimals))}
                    className="shrink-0 px-2 py-0.5 rounded-lg text-[10px] font-extrabold tracking-wide border border-[var(--primary-border)] text-[var(--primary)] hover:bg-[var(--primary)]/10 transition-all"
                  >
                    MAX
                  </button>
                </>
              ) : walletAddress && fromLoading && !fromTimedOut ? (
                <span className="text-[11px] text-[var(--subtle)]">Loading…</span>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <input
                type="number" min="0" step="any"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0"
                className="w-full bg-transparent display text-[32px] font-extrabold text-[var(--ink)] placeholder-[var(--border-strong)] focus:outline-none tabular leading-tight"
              />
              <p className="text-[12px] text-[var(--subtle)] mt-1">${amtUsd}</p>
            </div>
            <TokenModal value={fromToken} exclude={toToken} walletAddress={walletAddress} onChange={t => { setFromToken(t); reset(); }} />
          </div>
        </div>

        {/* Divider with flip button */}
        <div className="relative h-px bg-[var(--border)] mx-4">
          <button
            onClick={flipTokens}
            className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-xl border-2 border-[var(--border-strong)] bg-[var(--surface-strong)] hover:border-[var(--primary-border)] hover:bg-[var(--surface)] flex items-center justify-center transition-all group shadow-md"
            title="Flip tokens"
          >
            <ArrowDown className="w-4 h-4 text-[var(--subtle)] group-hover:text-[var(--primary)] transition-colors" />
          </button>
        </div>

        {/* TO box */}
        <div className="p-4 pt-5 pb-5">
          <div className="flex items-center justify-between mb-1.5 gap-2">
            <span className="text-[11px] font-semibold text-[var(--subtle)]">You receive</span>
            <div className="min-w-0">
              {walletAddress && displayTo !== undefined ? (
                <span className="text-[11px] text-[var(--subtle)] truncate">
                  Balance: <span className="text-[var(--ink-2)] font-semibold">{fmtBalance(displayTo, toMeta.decimals)} {toToken}</span>
                </span>
              ) : walletAddress && toLoading && !toTimedOut ? (
                <span className="text-[11px] text-[var(--subtle)]">Loading…</span>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              {phase === 'quoting' ? (
                <div className="h-10 w-32 rounded-xl bg-[var(--surface)] animate-pulse" />
              ) : estimate ? (
                <p className="display text-[32px] font-extrabold tabular leading-tight" style={{ color: 'var(--success)' }}>
                  {estimate.amountOut}
                </p>
              ) : (
                <p className="display text-[32px] font-extrabold text-[var(--border-strong)] leading-tight">0</p>
              )}
              {outUsd ? (
                <p className="text-[12px] text-[var(--subtle)] mt-1">${outUsd}</p>
              ) : (
                <p className="text-[12px] text-transparent mt-1">$0.00</p>
              )}
            </div>
            <TokenModal value={toToken} exclude={fromToken} walletAddress={walletAddress} onChange={t => { setToToken(t); reset(); }} />
          </div>
        </div>
      </div>

      {/* Slippage row */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold text-[var(--subtle)] shrink-0">Max slippage</span>
        <div className="flex gap-1.5">
          {SLIPPAGE_OPTIONS.map(bps => (
            <button
              key={bps}
              onClick={() => setSlippage(bps)}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all min-h-[32px] ${
                slippage === bps
                  ? 'bg-[var(--primary)] text-white border-transparent shadow-sm'
                  : 'bg-transparent text-[var(--subtle)] border-[var(--border)] hover:border-[var(--border-strong)]'
              }`}
            >
              {(bps / 100).toFixed(1)}%
            </button>
          ))}
        </div>
      </div>

      {/* Quote detail row */}
      {estimate && phase !== 'idle' && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)] text-[12px] overflow-hidden">
          <div className="flex justify-between px-4 py-2.5">
            <span className="text-[var(--subtle)]">Rate</span>
            <span className="font-semibold text-[var(--ink)] tabular">
              1 {fromToken} ≈ {(parseFloat(estimate.amountOut) / parseFloat(amount || '1')).toFixed(toMeta.decimals === 8 ? 8 : 4)} {toToken}
            </span>
          </div>
          <div className="flex justify-between px-4 py-2.5">
            <span className="text-[var(--subtle)]">Provider fee</span>
            <span className="font-semibold text-[var(--ink)] tabular">{estimate.fee}</span>
          </div>
          <div className="flex justify-between px-4 py-2.5">
            <span className="text-[var(--subtle)]">Gas</span>
            <span className="font-semibold text-[var(--ink)]">USDC (Arc native)</span>
          </div>
        </div>
      )}

      {/* Error */}
      {phase === 'error' && errMsg && (
        <div className="rounded-2xl border border-[var(--danger)]/40 bg-[var(--danger)]/8 px-4 py-3 text-[12px] text-[var(--danger)]">{errMsg}</div>
      )}

      {/* Success */}
      {phase === 'done' && txHash && (
        <div className="rounded-2xl border border-emerald-700/30 bg-emerald-950/20 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-[12px] text-emerald-400 font-semibold">Swap confirmed</span>
          </div>
          <a href={`https://testnet.arcscan.app/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] mono text-[var(--primary)] hover:opacity-80">
            {txHash.slice(0, 10)}… <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}

      {/* CTA */}
      {!walletAddress ? (
        <div className="flex justify-center pt-1">
          <ConnectKitButton label="Connect Wallet to Swap" />
        </div>
      ) : (
        <button
          onClick={phase === 'quoted' ? () => void handleSwap() : undefined}
          disabled={ctaDisabled}
          className="w-full min-h-[52px] rounded-2xl btn-primary text-white text-[15px] font-extrabold tracking-tight disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
        >
          {ctaLabel()}
        </button>
      )}
    </div>
  );
}
