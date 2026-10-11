// Arc Mainnet onchain facts — chain registry + USDC + explorer helpers
// Real chain IDs and addresses sourced from viem/chains and Circle developer docs

export const ARC_MAINNET_CHAIN_ID = 5042;   // Arc Mainnet (viem: arc)
export const ARC_TESTNET_CHAIN_ID = 5042002; // Arc Testnet  (viem: arcTestnet)

interface ChainFact {
  chainId: number;
  name: string;
  rpcUrls: string[];
  explorerBase: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
}

interface UsdcFact {
  chainId: number;
  address: `0x${string}`;
  decimals: number;
}

const CHAINS: Record<number, ChainFact> = {
  // Arc Mainnet — chain ID 5042 (viem: arc)
  5042: {
    chainId: 5042,
    name: 'Arc',
    rpcUrls: ['https://rpc.mainnet.arc.io'],
    explorerBase: 'https://explorer.arc.io',
    nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  },
  // Arc Testnet — chain ID 5042002 (viem: arcTestnet) — kept for reference
  5042002: {
    chainId: 5042002,
    name: 'Arc Testnet',
    rpcUrls: ['https://rpc.testnet.arc.io'],
    explorerBase: 'https://explorer.testnet.arc.io',
    nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  },
  // Ethereum Mainnet
  1: {
    chainId: 1,
    name: 'Ethereum',
    rpcUrls: ['https://cloudflare-eth.com'],
    explorerBase: 'https://etherscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  },
  // Base Mainnet
  8453: {
    chainId: 8453,
    name: 'Base',
    rpcUrls: ['https://mainnet.base.org'],
    explorerBase: 'https://basescan.org',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  },
  // Arbitrum One
  42161: {
    chainId: 42161,
    name: 'Arbitrum One',
    rpcUrls: ['https://arb1.arbitrum.io/rpc'],
    explorerBase: 'https://arbiscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  },
  // OP Mainnet
  10: {
    chainId: 10,
    name: 'OP Mainnet',
    rpcUrls: ['https://mainnet.optimism.io'],
    explorerBase: 'https://optimistic.etherscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  },
  // Ethereum Sepolia (kept for fallback/testing reference)
  11155111: {
    chainId: 11155111,
    name: 'Ethereum Sepolia',
    rpcUrls: ['https://rpc.sepolia.org'],
    explorerBase: 'https://sepolia.etherscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  },
};

// USDC contract addresses per chain — official Circle sources
const USDC: Record<number, UsdcFact> = {
  // Arc: USDC is the same fixed predeploy address on both mainnet and testnet
  5042:     { chainId: 5042,     address: '0x3600000000000000000000000000000000000000', decimals: 6 },
  5042002:  { chainId: 5042002,  address: '0x3600000000000000000000000000000000000000', decimals: 6 },
  // Mainnets
  1:        { chainId: 1,        address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
  8453:     { chainId: 8453,     address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 },
  42161:    { chainId: 42161,    address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6 },
  10:       { chainId: 10,       address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', decimals: 6 },
  // Testnets kept for reference
  11155111: { chainId: 11155111, address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', decimals: 6 },
};

/**
 * Returns chain facts or undefined — never throws.
 * Use this anywhere an unknown chain should degrade gracefully.
 */
export function getChain(chainId: number): ChainFact | undefined {
  return CHAINS[chainId];
}

/**
 * Returns chain facts or throws.
 * Only call this where chainId is a known compile-time constant.
 */
export function requireChain(chainId: number): ChainFact {
  const c = CHAINS[chainId];
  if (!c) throw new Error(`Unknown chain ${chainId}`);
  return c;
}

export function getUsdc(chainId: number): UsdcFact | undefined {
  return USDC[chainId];
}

export function buildTxExplorerUrl(chainId: number, txHash: string): string {
  const c = CHAINS[chainId];
  if (!c) return `https://explorer.arc.io/tx/${txHash}`;
  return `${c.explorerBase}/tx/${txHash}`;
}

export function buildAddressExplorerUrl(chainId: number, address: string): string {
  const c = CHAINS[chainId];
  if (!c) return `https://explorer.arc.io/address/${address}`;
  return `${c.explorerBase}/address/${address}`;
}
