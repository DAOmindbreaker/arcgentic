import { useState, useEffect, useRef, useCallback } from 'react';
import { useAccount, useReadContract, useSwitchChain } from 'wagmi';
import { erc20Abi } from 'viem';
import { ConnectKitButton } from 'connectkit';
import { ArrowDown, ChevronDown, CheckCircle2, Loader2, ExternalLink,
         Search, X, Settings, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { createViemAdapterFromProvider } from '@circle-fin/adapter-viem-v2';
import { AppKit } from '@circle-fin/app-kit';
import type { EIP1193Provider } from 'viem';

// ── Token registry ───────────────────────────────────────────────────────────
export const SWAP_TOKENS = [
  {
    symbol: 'USDC',   name: 'USD Coin',            decimals: 6,
    address: '0x3600000000000000000000000000000000000000' as `0x${string}`,
    color: '#2775CA', usdRate: 1,
    note: 'Native gas token on Arc Mainnet',
    tag: 'Circle',
  },
  {
    symbol: 'EURC',   name: 'Euro Coin',            decimals: 6,
    address: '0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1' as `0x${string}`,
    color: '#6366f1', usdRate: 1.08,
    note: 'Circle Euro Stablecoin on Arc',
    tag: 'Circle',
  },
  {
    symbol: 'cirBTC', name: 'Circle Wrapped BTC',   decimals: 8,
    address: '0x8E730732E440C9a6C663e05bc31a44bb47E21e11' as `0x${string}`,
    color: '#F7931A', usdRate: 65000,
    note: 'Circle Wrapped Bitcoin on Arc',
    tag: 'Circle',
  },
] as const;

type TokenSymbol = typeof SWAP_TOKENS[number]['symbol'];
const getToken = (s: TokenSymbol) => SWAP_TOKENS.find(t => t.symbol === s)!;

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtBalance(raw: bigint, decimals: number) {
  const n = Number(raw) / 10 ** decimals;
  if (decimals === 8) return n.toFixed(5);
  return n.toFixed(2);
}
function parseAmt(s: string, decimals: number): bigint | null {
  const v = parseFloat(s);
  if (!s || isNaN(v) || v <= 0) return null;
  try { return BigInt(Math.round(v * 10 ** decimals)); } catch { return null; }
}

// Token logo SVG-based initials badge
function TokenBadge({ symbol, color, size = 36 }: { symbol: string; color: string; size?: number }) {
  return (
    <div
      className="rounded-full flex items-center justify-center shrink-0 font-black text-white"
      style={{ width: size, height: size, background: color, fontSize: size * 0.28 }}
    >
      {symbol.slice(0, 2)}
    </div>
  );
}

const CHAIN_ID = 5042;
const SLIPPAGE_OPTIONS = [10, 50, 100]; // bps

// ── Token selector modal (dark, bottom-sheet style) ─────────────────────────
function TokenSelectModal({ value, exclude, walletAddress, onChange, onClose }: {
  value: TokenSymbol;
  exclude?: TokenSymbol;
  walletAddress?: string;
  onChange: (t: TokenSymbol) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 60); }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const filtered = SWAP_TOKENS.filter(t => {
    if (t.symbol === exclude) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return t.symbol.toLowerCase().includes(q) ||
           t.name.toLowerCase().includes(q) ||
           t.address.toLowerCase().includes(q);
  });

  return (
    <div
      className="fixed inset-0 z-[600] flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />

      {/* Sheet */}
      <div
        className="relative w-full max-w-[420px] rounded-t-3xl sm:rounded-3xl overflow-hidden"
        style={{
          background: 'linear-gradient(160deg, #13111c 0%, #0f0d18 100%)',
          border: '1px solid rgba(139,92,246,0.18)',
          boxShadow: '0 -8px 60px rgba(99,102,241,0.15), 0 0 0 1px rgba(255,255,255,0.04)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <h3 className="font-extrabold text-[15px] text-white tracking-tight">Select token</h3>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors hover:bg-white/10">
            <X className="w-4 h-4 text-white/50" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 pt-3 pb-2">
          <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl transition-colors"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }}>
            <Search className="w-4 h-4 shrink-0" style={{ color: 'rgba(255,255,255,0.35)' }} />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by name, symbol, or address"
              className="flex-1 bg-transparent text-[13px] text-white placeholder-white/30 focus:outline-none min-w-0"
            />
            {query && (
              <button onClick={() => setQuery('')} className="text-white/30 hover:text-white/60">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* List label */}
        <div className="px-5 pb-1.5">
          <span className="text-[10px] font-bold uppercase tracking-widest"
            style={{ color: 'rgba(255,255,255,0.3)' }}>
            {query ? 'Results' : 'All tokens'}
          </span>
        </div>

        {/* Token rows */}
        <div className="px-2 pb-4 max-h-[340px] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-[13px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
              No tokens found
            </div>
          ) : filtered.map(t => (
            <ModalTokenRow
              key={t.symbol}
              token={t}
              isSelected={t.symbol === value}
              walletAddress={walletAddress}
              onClick={() => { onChange(t.symbol); onClose(); }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ModalTokenRow({ token, isSelected, walletAddress, onClick }: {
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
      className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl text-left transition-all"
      style={{
        background: isSelected ? 'rgba(99,102,241,0.12)' : 'transparent',
        border: isSelected ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent',
      }}
      onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; }}
      onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
    >
      <TokenBadge symbol={token.symbol} color={token.color} size={40} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-bold text-white">{token.symbol}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
            style={{ background: 'rgba(99,102,241,0.18)', color: '#a5b4fc' }}>
            {token.tag}
          </span>
        </div>
        <div className="text-[11px] truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>{token.name}</div>
      </div>
      <div className="text-right shrink-0">
        {walletAddress && balance !== undefined ? (
          <>
            <div className="text-[13px] font-bold text-white tabular">{fmtBalance(balance, token.decimals)}</div>
            <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
              ${(Number(balance) / 10 ** token.decimals * token.usdRate).toFixed(2)}
            </div>
          </>
        ) : (
          <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{token.note}</div>
        )}
      </div>
    </button>
  );
}

// ── Settings popover ─────────────────────────────────────────────────────────
function SlippagePopover({ slippage, setSlippage, onClose }: {
  slippage: number;
  setSlippage: (n: number) => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute top-10 right-0 z-[400] w-[240px] rounded-2xl p-4 shadow-2xl"
      style={{
        background: 'linear-gradient(160deg,#13111c,#0f0d18)',
        border: '1px solid rgba(139,92,246,0.22)',
        boxShadow: '0 8px 40px rgba(99,102,241,0.2)',
      }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[12px] font-bold text-white/70">Max slippage</span>
        <button onClick={onClose}><X className="w-3.5 h-3.5 text-white/40 hover:text-white/70" /></button>
      </div>
      <div className="flex gap-2">
        {SLIPPAGE_OPTIONS.map(bps => (
          <button key={bps} onClick={() => { setSlippage(bps); onClose(); }}
            className="flex-1 py-2 rounded-xl text-[12px] font-bold transition-all"
            style={{
              background: slippage === bps ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.07)',
              color: slippage === bps ? '#fff' : 'rgba(255,255,255,0.5)',
              border: slippage === bps ? '1px solid rgba(99,102,241,0.6)' : '1px solid transparent',
            }}>
            {(bps / 100).toFixed(1)}%
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main SwapCard ────────────────────────────────────────────────────────────
export default function SwapCard() {
  const { address: walletAddress, connector, chainId: walletChainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();

  const [fromToken, setFromToken] = useState<TokenSymbol>('USDC');
  const [toToken,   setToToken]   = useState<TokenSymbol>('EURC');
  const [amount,    setAmount]    = useState('');
  const [slippage,  setSlippage]  = useState(50);
  const [phase,     setPhase]     = useState<'idle'|'quoting'|'quoted'|'swapping'|'done'|'error'>('idle');
  const [estimate,  setEstimate]  = useState<{ amountOut: string; fee: string } | null>(null);
  const [txHash,    setTxHash]    = useState('');
  const [errMsg,    setErrMsg]    = useState('');
  const [modal,     setModal]     = useState<'from'|'to'|null>(null);
  const [showSlip,  setShowSlip]  = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fromMeta = getToken(fromToken);
  const toMeta   = getToken(toToken);

  // Live balances
  const { data: fromBalance, isLoading: fromLoading } = useReadContract({
    address: fromMeta.address, abi: erc20Abi, functionName: 'balanceOf',
    args: walletAddress ? [walletAddress] : undefined,
    chainId: CHAIN_ID,
    query: { enabled: !!walletAddress, refetchInterval: 8000, staleTime: 5000, retry: false },
  });
  const { data: toBalance, isLoading: toLoading } = useReadContract({
    address: toMeta.address, abi: erc20Abi, functionName: 'balanceOf',
    args: walletAddress ? [walletAddress] : undefined,
    chainId: CHAIN_ID,
    query: { enabled: !!walletAddress, refetchInterval: 8000, staleTime: 5000, retry: false },
  });
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

  const amtUsd = (parseFloat(amount || '0') * fromMeta.usdRate).toFixed(2);
  const outUsd = estimate ? (parseFloat(estimate.amountOut) * toMeta.usdRate).toFixed(2) : null;

  function reset() { setEstimate(null); setErrMsg(''); if (phase !== 'idle') setPhase('idle'); }

  const appKitRef = useRef(new AppKit());

  const getAdapter = useCallback(async (chainId: number) => {
    if (!connector) throw new Error('Wallet not connected');
    await switchChainAsync({ chainId });
    const provider = await connector.getProvider() as EIP1193Provider;
    return createViemAdapterFromProvider({ provider });
  }, [connector, switchChainAsync]);

  const runQuote = useCallback(async (amt: string, from: TokenSymbol, to: TokenSymbol, bps: number) => {
    if (!walletAddress || from === to) return;
    if (parseAmt(amt, getToken(from).decimals) === null) { setPhase('idle'); return; }
    setPhase('quoting'); setEstimate(null); setErrMsg('');
    try {
      const adapter = await getAdapter(CHAIN_ID);
      const est = await appKitRef.current.estimateSwap({
        from: { adapter, chain: 'Arc' },
        tokenIn: from, tokenOut: to,
        amountIn: amt, config: { slippageBps: bps },
      });
      setEstimate({ amountOut: est.estimatedOutput.amount, fee: est.fees?.[0]?.amount ?? '—' });
      setPhase('quoted');
    } catch (e: unknown) {
      setErrMsg(e instanceof Error ? e.message : String(e));
      setPhase('error');
    }
  }, [getAdapter, walletAddress]);

  useEffect(() => {
    if (!walletAddress) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!amount || parseFloat(amount) <= 0) { reset(); return; }
    debounceRef.current = setTimeout(() => void runQuote(amount, fromToken, toToken, slippage), 600);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, fromToken, toToken, slippage, walletAddress]);

  const isWrongChain = !!walletAddress && walletChainId !== CHAIN_ID;

  async function handleSwap() {
    if (!estimate) return;
    if (isWrongChain) {
      const tid = toast.loading('Switching to Arc Mainnet…');
      try { await switchChainAsync({ chainId: CHAIN_ID }); toast.dismiss(tid); }
      catch { toast.dismiss(tid); toast.error('Switch to Arc Mainnet (Chain 5042) first'); return; }
    }
    setPhase('swapping');
    const tid = toast.loading(`Swapping ${amount} ${fromToken} → ${toToken}…`);
    try {
      const adapter = await getAdapter(CHAIN_ID);
      const result = await appKitRef.current.swap({
        from: { adapter, chain: 'Arc' },
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

  // ── Shared dark card style ─────────────────────────────────────────────────
  const cardBg: React.CSSProperties = {
    background: 'linear-gradient(160deg,#13111c 0%,#0f0d18 100%)',
    border: '1px solid rgba(139,92,246,0.15)',
  };
  const innerBg: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
  };

  // Token selector pill
  function TokenPill({ token, onClick }: { token: typeof SWAP_TOKENS[number]; onClick: () => void }) {
    return (
      <button
        onClick={onClick}
        className="flex items-center gap-2 px-3 py-2 rounded-2xl font-bold text-[14px] transition-all shrink-0 hover:scale-105 active:scale-95"
        style={{
          background: 'rgba(255,255,255,0.07)',
          border: '1px solid rgba(255,255,255,0.12)',
          color: '#fff',
        }}
      >
        <TokenBadge symbol={token.symbol} color={token.color} size={26} />
        <span>{token.symbol}</span>
        <ChevronDown className="w-3.5 h-3.5 opacity-50" />
      </button>
    );
  }

  const ctaDisabled = !walletAddress || !amount || parseFloat(amount || '0') <= 0
    || phase === 'quoting' || phase === 'swapping'
    || (phase !== 'quoted' && phase !== 'done');

  return (
    <>
      {/* Token select modals */}
      {modal === 'from' && (
        <TokenSelectModal
          value={fromToken} exclude={toToken} walletAddress={walletAddress}
          onChange={t => { setFromToken(t); reset(); }}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'to' && (
        <TokenSelectModal
          value={toToken} exclude={fromToken} walletAddress={walletAddress}
          onChange={t => { setToToken(t); reset(); }}
          onClose={() => setModal(null)}
        />
      )}

      <div className="max-w-[440px] mx-auto">
        {/* ── Main card ── */}
        <div className="rounded-3xl overflow-hidden" style={cardBg}>

          {/* Card header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-4"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div>
              <h2 className="text-[17px] font-extrabold text-white tracking-tight">Swap</h2>
              <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Arc Mainnet · gas paid in USDC
              </p>
            </div>
            <div className="flex items-center gap-2">
              {phase === 'quoting' && (
                <RefreshCw className="w-4 h-4 animate-spin" style={{ color: '#a5b4fc' }} />
              )}
              <div className="relative">
                <button
                  onClick={() => setShowSlip(s => !s)}
                  className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:bg-white/10"
                  style={{ border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <Settings className="w-4 h-4" style={{ color: showSlip ? '#a5b4fc' : 'rgba(255,255,255,0.4)' }} />
                </button>
                {showSlip && (
                  <SlippagePopover
                    slippage={slippage}
                    setSlippage={setSlippage}
                    onClose={() => setShowSlip(false)}
                  />
                )}
              </div>
            </div>
          </div>

          {/* ── SEND box ── */}
          <div className="p-4">
            <div className="rounded-2xl p-4" style={innerBg}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>Send</span>
                {walletAddress && displayFrom !== undefined ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      {fmtBalance(displayFrom, fromMeta.decimals)} {fromToken}
                    </span>
                    <button
                      onClick={() => setAmount(fmtBalance(displayFrom, fromMeta.decimals))}
                      className="text-[10px] font-black px-2 py-0.5 rounded-lg transition-all"
                      style={{ background: 'rgba(165,180,252,0.15)', color: '#a5b4fc', border: '1px solid rgba(165,180,252,0.25)' }}
                    >
                      MAX
                    </button>
                  </div>
                ) : walletAddress && fromLoading && !fromTimedOut ? (
                  <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.3)' }}>Loading…</span>
                ) : null}
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <input
                    type="number" min="0" step="any"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="0"
                    className="w-full bg-transparent text-[36px] font-black text-white placeholder-white/15 focus:outline-none tabular leading-tight"
                  />
                  <p className="text-[12px] mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>${amtUsd}</p>
                </div>
                <TokenPill token={fromMeta} onClick={() => setModal('from')} />
              </div>
            </div>
          </div>

          {/* ── Flip arrow ── */}
          <div className="flex justify-center -mt-1 -mb-1 relative z-10">
            <button
              onClick={flipTokens}
              className="w-10 h-10 rounded-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95"
              style={{
                background: 'linear-gradient(135deg,#1e1b4b,#312e81)',
                border: '2px solid rgba(139,92,246,0.35)',
                boxShadow: '0 0 16px rgba(99,102,241,0.3)',
              }}
            >
              <ArrowDown className="w-4 h-4" style={{ color: '#a5b4fc' }} />
            </button>
          </div>

          {/* ── RECEIVE box ── */}
          <div className="p-4">
            <div className="rounded-2xl p-4" style={innerBg}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>Receive</span>
                {walletAddress && displayTo !== undefined ? (
                  <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    {fmtBalance(displayTo, toMeta.decimals)} {toToken}
                  </span>
                ) : walletAddress && toLoading && !toTimedOut ? (
                  <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.3)' }}>Loading…</span>
                ) : null}
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  {phase === 'quoting' ? (
                    <div className="h-10 w-28 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.08)' }} />
                  ) : estimate ? (
                    <p className="text-[36px] font-black tabular leading-tight" style={{ color: '#34d399' }}>
                      {estimate.amountOut}
                    </p>
                  ) : (
                    <p className="text-[36px] font-black leading-tight" style={{ color: 'rgba(255,255,255,0.15)' }}>0</p>
                  )}
                  <p className="text-[12px] mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    {outUsd ? `$${outUsd}` : '\u00a0'}
                  </p>
                </div>
                <TokenPill token={toMeta} onClick={() => setModal('to')} />
              </div>
            </div>
          </div>

          {/* ── Rate / fee row ── */}
          {estimate && (
            <div className="mx-4 mb-3 px-4 py-2.5 rounded-2xl flex items-center justify-between"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                1 {fromToken} ≈ {(parseFloat(estimate.amountOut) / parseFloat(amount || '1'))
                  .toFixed(toMeta.decimals === 8 ? 8 : 4)} {toToken}
              </span>
              <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Fee: {estimate.fee} · Gas: USDC
              </span>
            </div>
          )}

          {/* ── Error ── */}
          {phase === 'error' && errMsg && (
            <div className="mx-4 mb-3 px-4 py-3 rounded-2xl text-[12px]"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5' }}>
              {errMsg}
            </div>
          )}

          {/* ── Success ── */}
          {phase === 'done' && txHash && (
            <div className="mx-4 mb-3 px-4 py-3 rounded-2xl flex items-center justify-between"
              style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }}>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: '#34d399' }} />
                <span className="text-[12px] font-semibold" style={{ color: '#34d399' }}>Swap confirmed</span>
              </div>
              <a href={`https://explorer.arc.io/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-[11px] font-mono hover:opacity-80"
                style={{ color: '#a5b4fc' }}>
                {txHash.slice(0, 10)}… <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}

          {/* ── Wrong chain ── */}
          {isWrongChain && (
            <div className="mx-4 mb-3 px-4 py-3 rounded-2xl flex items-center justify-between gap-3"
              style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)' }}>
              <span className="text-[12px] font-semibold" style={{ color: '#fcd34d' }}>
                Switch to Arc Mainnet (Chain 5042)
              </span>
              <button
                onClick={() => void switchChainAsync({ chainId: CHAIN_ID })}
                className="shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-colors"
                style={{ background: '#f59e0b', color: '#1c1917' }}
              >
                Switch
              </button>
            </div>
          )}

          {/* ── CTA ── */}
          <div className="px-4 pb-5">
            {!walletAddress ? (
              <div className="flex justify-center py-1">
                <ConnectKitButton label="Connect Wallet" />
              </div>
            ) : (
              <button
                onClick={phase === 'quoted' ? () => void handleSwap() : undefined}
                disabled={ctaDisabled}
                className="w-full min-h-[52px] rounded-2xl text-[15px] font-extrabold tracking-tight disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
                style={{
                  background: ctaDisabled
                    ? 'rgba(99,102,241,0.2)'
                    : 'linear-gradient(135deg,#6366f1 0%,#8b5cf6 50%,#a78bfa 100%)',
                  color: '#fff',
                  boxShadow: ctaDisabled ? 'none' : '0 4px 24px rgba(99,102,241,0.4)',
                }}
              >
                {phase === 'quoting'  && <><Loader2 className="w-4 h-4 animate-spin" /> Fetching rate…</>}
                {phase === 'swapping' && <><Loader2 className="w-4 h-4 animate-spin" /> Swapping…</>}
                {phase === 'done'     && <><CheckCircle2 className="w-4 h-4" /> Swap Complete</>}
                {phase === 'quoted'   && <>Exchange {fromToken} → {toToken}</>}
                {(phase === 'idle' || phase === 'error') && <>Enter an amount</>}
              </button>
            )}
          </div>
        </div>

        {/* Ambient glow */}
        <div className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center"
          aria-hidden>
          <div className="w-[320px] h-[320px] rounded-full blur-[80px] opacity-20"
            style={{ background: 'radial-gradient(circle,#6366f1,transparent 70%)' }} />
        </div>
      </div>
    </>
  );
}
