'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAccount } from 'wagmi';

export function useBuyerTrades() {
  const { address, isConnected } = useAccount();

  return useQuery({
    queryKey: ['buyer-trades', address],
    queryFn: () => {
      if (!address) throw new Error('No address');
      return api.getTradesByBuyer(address);
    },
    enabled: isConnected && !!address,
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  });
}

