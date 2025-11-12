import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { baseSepolia } from 'wagmi/chains';
import { http } from 'wagmi';

// Use Base Sepolia public RPC
const baseSepoliaWithCustomRpc = {
  ...baseSepolia,
  rpcUrls: {
    default: {
      http: ['https://sepolia.base.org'],
    },
    public: {
      http: ['https://sepolia.base.org'],
    },
  },
};

export const config = getDefaultConfig({
  appName: 'zkAliPay',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '',
  chains: [baseSepoliaWithCustomRpc],
  transports: {
    [baseSepolia.id]: http('https://sepolia.base.org'),
  },
  ssr: true,
});
