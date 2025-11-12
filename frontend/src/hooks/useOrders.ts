import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Order {
  order_id: string;
  seller: string;
  token: string;
  remaining_amount: string;
  exchange_rate: string;
  created_at: number;
}

export function useOrders() {
  return useQuery<Order[]>({
    queryKey: ['orders', 'active'],
    queryFn: async () => {
      return await api.getActiveOrders();
    },
    refetchInterval: 10000, // Auto-refresh every 10 seconds
    staleTime: 5000, // Consider data stale after 5 seconds
  });
}

