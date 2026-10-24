import React from 'react';
import { formatUnits } from 'viem';
import { RefreshCw, AlertCircle } from 'lucide-react';

interface USDCBalanceProps {
  rawValue: bigint | undefined;
  isLoading: boolean;
  isError: boolean;
  onRefresh?: () => void;
}

export const USDCBalance: React.FC<USDCBalanceProps> = ({
  rawValue,
  isLoading,
  isError,
  onRefresh,
}) => {
  if (isLoading) {
    return (
      <div
        className="h-9 w-36 rounded-md animate-pulse"
        style={{ background: 'var(--surface-strong)' }}
        aria-label="Loading balance"
      />
    );
  }

  if (isError) {
    return (
      <div className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--danger)' }}>
        <AlertCircle className="w-4 h-4 shrink-0" />
        <span>Failed to load balance</span>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="ml-1 p-1 rounded transition-colors"
            style={{ background: 'transparent' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-strong)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            title="Retry"
            aria-label="Retry loading balance"
          >
            <RefreshCw className="w-3.5 h-3.5" style={{ color: 'var(--muted)' }} />
          </button>
        )}
      </div>
    );
  }

  // USDC uses 6 decimals on Arc Mainnet
  const formattedBalance =
    rawValue !== undefined
      ? Number(formatUnits(rawValue, 6)).toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : '0.00';

  return (
    <div className="flex items-baseline gap-2">
      <span
        className="text-3xl font-bold tracking-tight font-mono-num"
        style={{ color: 'var(--ink)' }}
      >
        ${formattedBalance}
      </span>
      <span
        className="text-xs font-semibold font-mono"
        style={{ color: 'var(--muted)' }}
      >
        USDC
      </span>
    </div>
  );
};
