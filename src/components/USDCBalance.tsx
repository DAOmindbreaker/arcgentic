import React from 'react';
import { formatUnits } from 'viem';
import { RefreshCw } from 'lucide-react';

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

  // USDC uses 6 decimals on Arc Mainnet.
  // Treat an error with no raw value as zero — a vault with no balance is valid.
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
      {isError && onRefresh && (
        <button
          onClick={onRefresh}
          className="ml-1 p-1 rounded transition-colors"
          style={{ background: 'transparent' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-strong)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          title="Retry balance fetch"
          aria-label="Retry loading balance"
        >
          <RefreshCw className="w-3 h-3" style={{ color: 'var(--muted)' }} />
        </button>
      )}
    </div>
  );
};
