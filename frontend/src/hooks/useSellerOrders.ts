import { useQuery } from '@tanstack/react-query';
import { useAccount } from 'wagmi';
import { api, Order } from '@/lib/api';

export function useSellerOrders() {
  const { address } = useAccount();

  return useQuery<Order[]>({
    queryKey: ['orders', 'seller', address],
    queryFn: async () => {
      if (!address) return [];
      
      const response = await api.getOrdersBySeller(address);
      return response.orders;
    },
    enabled: !!address, // Only fetch when wallet connected
    refetchInterval: 10000, // Auto-refresh every 10 seconds
    staleTime: 5000,
  });
}

