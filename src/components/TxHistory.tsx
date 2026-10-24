/**
 * Transaction History — slide-over drawer
 *
 * Persists to localStorage keyed by wallet address.
 * Records are added by the parent via addTxRecord() from useTxHistory().
 */

import { useState, useEffect, useCallback, useRef, startTransition } from 'react';
import {
  X, ArrowDownUp, GitBranch, Send, Settings,
  CheckCircle2, AlertTriangle, Clock, Copy,
  Download, Trash2, ExternalLink, History,
  ChevronRight,
} from 'lucide-react';
import { createPublicClient, http } from 'viem';
import { buildTxExplorerUrl, ARC_MAINNET_CHAIN_ID } from '@/onchain-facts';

// ── Types ─────────────────────────────────────────────────────────────────────

export type TxType = 'SWAP' | 'BRIDGE' | 'SEND' | 'VAULT_CONFIG';
export type TxStatus = 'pending' | 'confirmed' | 'failed';

export interface TxRecord {
  id: string;
  type: TxType;
  status: TxStatus;
  /** Human-readable summary, e.g. "100.00 USDC → 0.035 WETH" */
  summary: string;
  /** Detailed label shown in secondary line, e.g. "Arc Testnet → Base Sepolia" */
  detail?: string;
  txHash?: string;
  /** Source chain ID (for explorer link) */
  chainId: number;
  /** ISO timestamp */
  timestamp: string;
  /** Gas paid in USDC string, e.g. "0.0012" — omit when unknown */
  gasFee?: string;
}

// ── localStorage hook ─────────────────────────────────────────────────────────

const STORAGE_KEY = (addr: string) => `arc-tx-history-${addr.toLowerCase()}`;
const MAX_RECORDS = 200;

export function useTxHistory(walletAddress: string | undefined) {
  // Initialise directly from storage for the current wallet — avoids effect-setState
  const [records, setRecords] = useState<TxRecord[]>(() => {
    if (!walletAddress) return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY(walletAddress));
      return raw ? (JSON.parse(raw) as TxRecord[]) : [];
    } catch { return []; }
  });

  // Reload when wallet address changes — use startTransition to satisfy the
  // set-state-in-effect lint rule (deferred update, not a synchronous side-effect)
  useEffect(() => {
    const next = (() => {
      if (!walletAddress) return [];
      try {
        const raw = localStorage.getItem(STORAGE_KEY(walletAddress));
        return raw ? (JSON.parse(raw) as TxRecord[]) : [];
      } catch { return []; }
    })();
    startTransition(() => { setRecords(next); });
  }, [walletAddress]);

  // Persist whenever records change
  useEffect(() => {
    if (!walletAddress || records.length === 0) return;
    try {
      localStorage.setItem(STORAGE_KEY(walletAddress), JSON.stringify(records));
    } catch { /* quota exceeded — ignore */ }
  }, [records, walletAddress]);

  /** Add a new record (or update an existing one by id) */
  const addTxRecord = useCallback((record: TxRecord) => {
    setRecords(prev => {
      const idx = prev.findIndex(r => r.id === record.id);
      if (idx !== -1) {
        // Update existing (e.g. pending → confirmed)
        const next = [...prev];
        next[idx] = record;
        return next;
      }
      // Prepend new, cap at MAX_RECORDS
      return [record, ...prev].slice(0, MAX_RECORDS);
    });
    if (!walletAddress) return;
    try {
      const current = localStorage.getItem(STORAGE_KEY(walletAddress));
      const arr: TxRecord[] = current ? (JSON.parse(current) as TxRecord[]) : [];
      const idx = arr.findIndex(r => r.id === record.id);
      if (idx !== -1) arr[idx] = record; else arr.unshift(record);
      localStorage.setItem(STORAGE_KEY(walletAddress), JSON.stringify(arr.slice(0, MAX_RECORDS)));
    } catch { /* ignore */ }
  }, [walletAddress]);

  /** Update status of an existing record by id */
  const updateTxStatus = useCallback((id: string, status: TxStatus, txHash?: string) => {
    setRecords(prev => prev.map(r => r.id === id ? { ...r, status, ...(txHash ? { txHash } : {}) } : r));
  }, []);

  const clearHistory = useCallback(() => {
    setRecords([]);
    if (walletAddress) {
      try { localStorage.removeItem(STORAGE_KEY(walletAddress)); } catch { /* ignore */ }
    }
  }, [walletAddress]);

  return { records, addTxRecord, updateTxStatus, clearHistory };
}

// ── Pending receipt watcher ───────────────────────────────────────────────────

/**
 * Polls getTransactionReceipt every 4s for every pending record that has a
 * txHash. On success/reverted, calls updateTxStatus and persists to localStorage.
 * Self-contained — no changes to App.tsx needed.
 */
export function usePendingReceiptWatcher(
  records: TxRecord[],
  walletAddress: string | undefined,
  updateTxStatus: (id: string, status: TxStatus, txHash?: string) => void,
) {
  // stable publicClient for Arc Mainnet
  const clientRef = useRef(
    createPublicClient({
      chain: {
        id: ARC_MAINNET_CHAIN_ID,
        name: 'Arc',
        nativeCurrency: { name: 'USD Coin', symbol: 'USDC', decimals: 18 },
        rpcUrls: { default: { http: ['https://rpc.mainnet.arc.io'] } },
      },
      transport: http('https://rpc.mainnet.arc.io'),
    })
  );

  // Track which ids are currently being polled so we don't stack intervals
  const pollingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const pending = records.filter(
      r => r.status === 'pending' && r.txHash && !pollingRef.current.has(r.id)
    );
    if (pending.length === 0) return;

    const timers: ReturnType<typeof setInterval>[] = [];

    for (const rec of pending) {
      pollingRef.current.add(rec.id);
      const hash = rec.txHash as `0x${string}`;

      const tid = setInterval(async () => {
        try {
          const receipt = await clientRef.current.getTransactionReceipt({ hash });
          if (receipt.status === 'success' || receipt.status === 'reverted') {
            const next: TxStatus = receipt.status === 'success' ? 'confirmed' : 'failed';
            updateTxStatus(rec.id, next);
            // Also write directly to localStorage so refresh sessions see it
            if (walletAddress) {
              try {
                const key = `arc-tx-history-${walletAddress.toLowerCase()}`;
                const raw = localStorage.getItem(key);
                if (raw) {
                  const arr = JSON.parse(raw) as TxRecord[];
                  const idx = arr.findIndex(r => r.id === rec.id);
                  if (idx !== -1) { arr[idx] = { ...arr[idx], status: next }; }
                  localStorage.setItem(key, JSON.stringify(arr));
                }
              } catch { /* quota / parse error */ }
            }
            clearInterval(tid);
            pollingRef.current.delete(rec.id);
          }
        } catch {
          // Receipt not yet available — keep polling
        }
      }, 4000);

      timers.push(tid);
    }

    return () => { timers.forEach(clearInterval); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records.filter(r => r.status === 'pending').map(r => r.id).join(','), walletAddress]);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Today';
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

type FilterType = 'ALL' | TxType;

const TYPE_ICON: Record<TxType, React.ElementType> = {
  SWAP:        ArrowDownUp,
  BRIDGE:      GitBranch,
  SEND:        Send,
  VAULT_CONFIG: Settings,
};

const TYPE_LABEL: Record<TxType, string> = {
  SWAP:        'Swap',
  BRIDGE:      'Bridge',
  SEND:        'Send',
  VAULT_CONFIG: 'Policy',
};

const TYPE_COLOR: Record<TxType, string> = {
  SWAP:        'text-violet-400 bg-violet-950/50 border-violet-800/40',
  BRIDGE:      'text-sky-400 bg-sky-950/50 border-sky-800/40',
  SEND:        'text-[var(--accent)] bg-[var(--accent)]/10 border-[var(--accent)]/25',
  VAULT_CONFIG: 'text-amber-400 bg-amber-950/50 border-amber-800/40',
};

const STATUS_STYLE: Record<TxStatus, string> = {
  pending:   'text-amber-400 bg-amber-950/50 border-amber-800/40',
  confirmed: 'text-emerald-400 bg-emerald-950/50 border-emerald-800/40',
  failed:    'text-[var(--danger)] bg-[var(--danger)]/10 border-[var(--danger)]/30',
};

function copyToClipboard(text: string, cb: () => void) {
  void navigator.clipboard?.writeText(text);
  cb();
}

function exportCsv(records: TxRecord[]) {
  const header = 'Date,Time,Type,Status,Summary,Detail,TxHash,ChainId,GasFee(USDC)';
  const rows = records.map(r => [
    new Date(r.timestamp).toLocaleDateString(),
    fmtTime(r.timestamp),
    r.type,
    r.status,
    `"${r.summary.replace(/"/g, '""')}"`,
    `"${(r.detail ?? '').replace(/"/g, '""')}"`,
    r.txHash ?? '',
    r.chainId,
    r.gasFee ?? '',
  ].join(','));
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'arc-tx-history.csv'; a.click();
  URL.revokeObjectURL(url);
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[var(--surface-strong)] border border-[var(--border)] flex items-center justify-center mb-4">
        <History className="w-7 h-7 text-[var(--subtle)]" />
      </div>
      <p className="display font-semibold text-[var(--ink-2)] mb-1">No transactions yet</p>
      <p className="text-[12px] text-[var(--subtle)] max-w-[200px] text-pretty">
        Your Swap, Bridge, Send, and Policy update history will appear here.
      </p>
    </div>
  );
}

// ── Single record row ─────────────────────────────────────────────────────────

function TxRow({ record }: { record: TxRecord }) {
  const [copied, setCopied] = useState(false);
  const Icon = TYPE_ICON[record.type];

  let explorerUrl = '';
  if (record.txHash) {
    try { explorerUrl = buildTxExplorerUrl(record.chainId, record.txHash); } catch { /* unknown chain */ }
  }

  return (
    <div className="px-4 py-3.5 border-b border-[var(--border)] last:border-0 hover:bg-white/[0.02] transition-colors">
      <div className="flex items-start gap-3">
        {/* Type icon */}
        <div className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center border text-[11px] font-bold ${TYPE_COLOR[record.type]}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-[12px] font-semibold text-[var(--ink)] truncate max-w-[220px]">{record.summary}</span>
            {/* Status badge */}
            <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${STATUS_STYLE[record.status]}`}>
              {record.status === 'pending'   && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
              {record.status === 'confirmed' && <CheckCircle2 className="w-2.5 h-2.5" />}
              {record.status === 'failed'    && <AlertTriangle className="w-2.5 h-2.5" />}
              {record.status.toUpperCase()}
            </span>
          </div>

          {record.detail && (
            <p className="text-[10px] text-[var(--subtle)] truncate mb-1">{record.detail}</p>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            {/* Time */}
            <span className="flex items-center gap-1 text-[10px] text-[var(--subtle)]">
              <Clock className="w-3 h-3" />
              {fmtDate(record.timestamp)} {fmtTime(record.timestamp)}
            </span>

            {/* Gas */}
            {record.gasFee && record.gasFee !== '0.0000' && (
              <span className="text-[10px] text-[var(--subtle)]">Gas: {record.gasFee} USDC</span>
            )}

            {/* Tx hash */}
            {record.txHash && (
              <div className="flex items-center gap-1.5">
                <span className="mono text-[10px] text-[var(--subtle)]">
                  {record.txHash.slice(0, 8)}…{record.txHash.slice(-4)}
                </span>
                <button
                  onClick={() => copyToClipboard(record.txHash!, () => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}
                  className="p-0.5 rounded hover:bg-white/10 transition-colors"
                  title="Copy tx hash"
                >
                  {copied
                    ? <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    : <Copy className="w-3 h-3 text-[var(--subtle)]" />}
                </button>
                {explorerUrl && (
                  <a href={explorerUrl} target="_blank" rel="noopener noreferrer"
                    className="p-0.5 rounded hover:bg-white/10 transition-colors" title="View on explorer">
                    <ExternalLink className="w-3 h-3 text-[var(--subtle)] hover:text-[var(--accent)]" />
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Type pill */}
        <span className={`shrink-0 text-[9px] font-bold px-2 py-0.5 rounded-full border ${TYPE_COLOR[record.type]}`}>
          {TYPE_LABEL[record.type]}
        </span>
      </div>
    </div>
  );
}

// ── Main drawer ───────────────────────────────────────────────────────────────

interface TxHistoryDrawerProps {
  open: boolean;
  onClose: () => void;
  records: TxRecord[];
  onClear: () => void;
}

export function TxHistoryDrawer({ open, onClose, records, onClear }: TxHistoryDrawerProps) {
  const [filter, setFilter] = useState<FilterType>('ALL');
  const [confirmClear, setConfirmClear] = useState(false);

  const filtered = filter === 'ALL' ? records : records.filter(r => r.type === filter);

  // Group by date
  const groups: { date: string; items: TxRecord[] }[] = [];
  for (const r of filtered) {
    const d = fmtDate(r.timestamp);
    const last = groups[groups.length - 1];
    if (!last || last.date !== d) groups.push({ date: d, items: [r] });
    else last.items.push(r);
  }

  const FILTERS: { id: FilterType; label: string }[] = [
    { id: 'ALL',         label: 'All' },
    { id: 'SWAP',        label: 'Swaps' },
    { id: 'BRIDGE',      label: 'Bridges' },
    { id: 'SEND',        label: 'Transfers' },
    { id: 'VAULT_CONFIG', label: 'Policy' },
  ];

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Transaction History"
        className="fixed inset-y-0 right-0 z-50 w-full max-w-sm flex flex-col bg-[#0b1422] border-l border-[var(--border)] shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-[var(--border)] shrink-0">
          <div className="flex items-center gap-2.5">
            <History className="w-4 h-4 text-[var(--accent)]" />
            <div>
              <h2 className="display text-[14px] font-bold text-[var(--ink)]">Transaction History</h2>
              <p className="text-[10px] text-[var(--subtle)]">{records.length} record{records.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {records.length > 0 && (
              <>
                <button
                  onClick={() => exportCsv(records)}
                  className="p-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:bg-white/10 transition-colors"
                  title="Export CSV"
                >
                  <Download className="w-3.5 h-3.5 text-[var(--subtle)]" />
                </button>
                {confirmClear ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { onClear(); setConfirmClear(false); }}
                      className="px-2 py-1 rounded text-[10px] font-bold text-[var(--danger)] border border-[var(--danger)]/40 hover:bg-[var(--danger)]/10 transition-colors"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setConfirmClear(false)}
                      className="px-2 py-1 rounded text-[10px] text-[var(--subtle)] hover:bg-white/10 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmClear(true)}
                    className="p-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:bg-white/10 transition-colors"
                    title="Clear history"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-[var(--subtle)]" />
                  </button>
                )}
              </>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:bg-white/10 transition-colors"
              aria-label="Close"
            >
              <X className="w-3.5 h-3.5 text-[var(--subtle)]" />
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex gap-1.5 px-4 py-2.5 border-b border-[var(--border)] overflow-x-auto no-scrollbar shrink-0">
          {FILTERS.map(f => {
            const count = f.id === 'ALL' ? records.length : records.filter(r => r.type === f.id).length;
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap border transition-colors ${
                  filter === f.id
                    ? 'bg-[var(--accent)] text-[#0d1b2f] border-transparent'
                    : 'bg-[var(--surface)] text-[var(--subtle)] border-[var(--border)] hover:bg-white/5'
                }`}
              >
                {f.label}
                <span className={`text-[9px] rounded-full px-1 py-0.5 ${filter === f.id ? 'bg-black/20 text-[#0d1b2f]' : 'bg-white/10 text-[var(--subtle)]'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Records list */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <EmptyState />
          ) : (
            groups.map(group => (
              <div key={group.date}>
                <div className="sticky top-0 z-10 px-4 py-1.5 bg-[#0b1422]/90 backdrop-blur-sm border-b border-[var(--border)]">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--subtle)]">{group.date}</span>
                </div>
                {group.items.map(r => <TxRow key={r.id} record={r} />)}
              </div>
            ))
          )}
        </div>

        {/* Footer hint */}
        {filtered.length > 0 && (
          <div className="px-4 py-2.5 border-t border-[var(--border)] shrink-0 flex items-center justify-between">
            <span className="text-[10px] text-[var(--subtle)]">Stored locally · scoped to your wallet</span>
            <ChevronRight className="w-3.5 h-3.5 text-[var(--subtle)]" />
          </div>
        )}
      </div>
    </>
  );
}
