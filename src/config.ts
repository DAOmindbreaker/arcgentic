/**
 * wagmi configuration — Arc Mainnet
 * Built with Arc Studio — https://studio.arc.io
 */

import { http, createConfig } from 'wagmi'
import { mainnet, arc } from 'viem/chains'
import { injected, coinbaseWallet } from 'wagmi/connectors'
import { registerChain } from './tracing'

// Pre-register chain RPC URLs so trace events show correct chain names immediately
registerChain(arc.id, arc.rpcUrls.default.http[0])

// Arc Mainnet public RPC
const ARC_RPC = arc.rpcUrls.default.http[0] // https://rpc.mainnet.arc.io

export const config = createConfig({
  chains: [arc, mainnet],          // mainnet kept for ENS resolution
  connectors: [
    injected(),                                             // MetaMask + any injected wallet
    coinbaseWallet({ appName: 'ArcGentic Treasury' }),      // Coinbase Wallet
    // WalletConnect omitted — requires a valid projectId from https://cloud.walletconnect.com
    // Add: walletConnect({ projectId: import.meta.env.VITE_WC_PROJECT_ID }) when ready
  ],
  transports: {
    [arc.id]:     http(ARC_RPC),  // explicit RPC — no silent public-node fallback
    [mainnet.id]: http(),         // ENS resolution uses mainnet
  },
})
