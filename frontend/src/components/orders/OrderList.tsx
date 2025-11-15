'use client';

import { useOrders } from '@/hooks/useOrders';
import { OrderCard } from './OrderCard';
import { AlertCircle, Loader2 } from 'lucide-react';

export function OrderList() {
  const { data, isLoading, error, isRefetching } = useOrders();

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-sm text-muted-foreground">Loading orders...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <h3 className="mt-4 text-lg font-semibold">Failed to load orders</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {error instanceof Error ? error.message : 'An error occurred'}
        </p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="rounded-full bg-muted p-3">
          <svg
            className="h-6 w-6 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
        </div>
        <h3 className="mt-4 text-lg font-semibold">No active orders</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Check back later for available orders
        </p>
      </div>
    );
  }

  return (
    <div>
      {isRefetching && (
        <div className="flex items-center justify-end text-sm text-muted-foreground mb-6">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          Refreshing...
        </div>
      )}
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {data.map((order) => (
          <OrderCard key={order.order_id} order={order} />
        ))}
      </div>
      
      <div className="mt-6 text-center text-xs text-muted-foreground">
        Auto-refreshing every 10 seconds
      </div>
    </div>
  );
}

