// Money helpers for USDC (6-decimal fixed-point)
import { formatUnits, parseUnits } from 'viem';

const USDC_DECIMALS = 6;

// ── Amount ────────────────────────────────────────────────────────────────────
export class Amount {
  readonly raw: bigint;
  readonly decimals: number;

  private constructor(raw: bigint, decimals: number) {
    this.raw = raw;
    this.decimals = decimals;
  }

  static fromRaw(raw: bigint, decimals = USDC_DECIMALS): Amount {
    return new Amount(raw, decimals);
  }

  static fromString(value: string, decimals = USDC_DECIMALS): Amount {
    return new Amount(parseUnits(value, decimals), decimals);
  }

  toFixed(dp = 2): string {
    return Number(formatUnits(this.raw, this.decimals)).toFixed(dp);
  }

  toString(): string {
    return formatUnits(this.raw, this.decimals);
  }

  add(other: Amount): Amount {
    return new Amount(this.raw + other.raw, this.decimals);
  }

  sub(other: Amount): Amount {
    return new Amount(this.raw - other.raw, this.decimals);
  }

  gt(other: Amount): boolean {
    return this.raw > other.raw;
  }

  gte(other: Amount): boolean {
    return this.raw >= other.raw;
  }

  lte(other: Amount): boolean {
    return this.raw <= other.raw;
  }
}

// ── Formatting ────────────────────────────────────────────────────────────────
export function formatUsdc(raw: bigint, decimals = USDC_DECIMALS): string {
  return formatUnits(raw, decimals);
}

// ── Parsing ───────────────────────────────────────────────────────────────────
/** Parse a user-entered USDC string into raw bigint. Returns null on invalid input. */
export function parseUsdcInput(value: string, decimals = USDC_DECIMALS): bigint | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed === '.' || trimmed === '0') return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0) return null;
  try {
    return parseUnits(trimmed, decimals);
  } catch {
    return null;
  }
}

// ── Arc-specific native↔ERC20 conversion ──────────────────────────────────────
// On Arc, native token has 18 decimals, ERC-20 USDC has 6 decimals.
// Same pool — just different views.
const NATIVE_DECIMALS = 18;

export function usdcToGasToken(usdcRaw: bigint): bigint {
  // multiply by 10^(18-6) = 10^12
  return usdcRaw * 1_000_000_000_000n;
}

export function gasTokenToUsdc(gasRaw: bigint): bigint {
  // divide by 10^12 (truncating)
  return gasRaw / 1_000_000_000_000n;
}

export function formatNative(raw: bigint): string {
  return formatUnits(raw, NATIVE_DECIMALS);
}
