'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getTokenInfo, formatTokenAmount, getExchangeRateLabel } from '@/lib/tokens';
import type { Order } from '@/hooks/useOrders';

interface OrderCardProps {
  order: Order;
}

function formatExchangeRate(rate: string): string {
  const num = parseInt(rate) / 100; // Rate in cents
  return num.toFixed(2);
}

function formatTimestamp(ts: number): string {
  const now = Date.now() / 1000;
  const diff = now - ts;
  
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  return `${Math.floor(diff / 86400)} days ago`;
}

function formatAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function OrderCard({ order }: OrderCardProps) {
  const tokenInfo = getTokenInfo(order.token);
  const rate = formatExchangeRate(order.exchange_rate);
  const available = formatTokenAmount(order.remaining_amount, order.token);
  const timeAgo = formatTimestamp(order.created_at);

  return (
    <Card className="hover:shadow-lg transition-shadow duration-200">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-2xl font-bold text-primary">
              {rate} <span className="text-sm font-normal text-muted-foreground">{getExchangeRateLabel(order.token)}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{timeAgo}</p>
          </div>
          <Badge variant="secondary">Active</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Available:</span>
            <span className="text-lg font-semibold">{available} {tokenInfo.symbol}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Seller:</span>
            <span className="text-sm font-mono">{formatAddress(order.seller)}</span>
          </div>
          <div className="pt-2 border-t">
            <div className="text-xs text-muted-foreground">
              Order ID: {order.order_id.slice(0, 10)}...
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

