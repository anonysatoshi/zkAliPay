'use client';

import { useBuyerTrades } from '@/hooks/useBuyerTrades';
import { formatAddress, getTransactionUrl } from '@/lib/contracts';
import { formatTokenAmountWithSymbol, getTokenSymbol } from '@/lib/tokens';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2, Loader2, Clock, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { Trade } from '@/lib/api';

type TradeView = 'pending' | 'completed';

export function MyTrades() {
  const { data: tradesData, isLoading, error: fetchError, refetch } = useBuyerTrades();
  const [view, setView] = useState<TradeView>('pending');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading your trades...</span>
      </div>
    );
  }

  if (fetchError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Failed to load trades. Please try again.</AlertDescription>
      </Alert>
    );
  }

  const trades = tradesData?.trades || [];

  // Separate pending and completed trades
  // Status: 0=PENDING, 1=SETTLED, 2=EXPIRED
  const pendingTrades = trades.filter((trade: Trade) => trade.status === 0);
  const completedTrades = trades.filter((trade: Trade) => trade.status === 1 || trade.status === 2);
  
  const displayedTrades = view === 'pending' ? pendingTrades : completedTrades;

  if (trades.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">
            You don't have any trades yet. Buy some tokens to get started!
          </p>
        </CardContent>
      </Card>
    );
  }

  const getStatusBadge = (status: number) => {
    switch (status) {
      case 0:
        return (
          <span className="flex items-center text-xs text-yellow-600 bg-yellow-100 px-2 py-1 rounded">
            <Clock className="h-3 w-3 mr-1" />
            Pending Payment
          </span>
        );
      case 1:
        return (
          <span className="flex items-center text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Settled
          </span>
        );
      case 2:
        return (
          <span className="flex items-center text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
            <AlertCircle className="h-3 w-3 mr-1" />
            Expired
          </span>
        );
      default:
        return null;
    }
  };

  const renderTradeCard = (trade: Trade, isCompleted: boolean) => {
    const tokenAddress = trade.token || '0x0000000000000000000000000000000000000000'; // Fallback for old trades
    const tokenAmount = formatTokenAmountWithSymbol(trade.token_amount, tokenAddress);
    const tokenSymbol = getTokenSymbol(tokenAddress);
    const cnyAmount = (parseFloat(trade.cny_amount) / 100).toFixed(2);
    const isExpired = trade.status === 2;
    const isSettled = trade.status === 1;
    const isPending = trade.status === 0;

    // Check if expired but not marked as such yet
    const isActuallyExpired = isPending && Date.now() / 1000 > trade.expires_at;

    return (
      <Card 
        key={trade.trade_id} 
        className={isCompleted ? 'opacity-70' : ''}
      >
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-mono">
                Trade: {formatAddress(trade.trade_id)}
              </CardTitle>
              <CardDescription>
                Created {new Date(trade.created_at * 1000).toLocaleString()}
              </CardDescription>
            </div>
            {getStatusBadge(trade.status)}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Trade Info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Token</p>
              <p className="font-semibold">{tokenAmount}</p>
            </div>
            <div>
              <p className="text-muted-foreground">CNY Paid</p>
              <p className="font-semibold">¥{cnyAmount}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Payment Nonce</p>
              <p className="font-mono text-xs">{trade.payment_nonce}</p>
            </div>
            <div>
              <p className="text-muted-foreground">
                {isPending ? 'Expires At' : isSettled ? 'Settled At' : 'Expired At'}
              </p>
              <p className="text-xs">
                {new Date(trade.expires_at * 1000).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Transaction Links */}
          <div className="pt-4 border-t space-y-2">
            {trade.escrow_tx_hash && (
              <a
                href={getTransactionUrl(trade.escrow_tx_hash)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary flex items-center gap-1 hover:underline"
              >
                View Creation TX <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {trade.settlement_tx_hash && (
              <a
                href={getTransactionUrl(trade.settlement_tx_hash)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-green-600 flex items-center gap-1 hover:underline"
              >
                View Settlement TX <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>

          {/* Warning for expired pending trades */}
          {isActuallyExpired && isPending && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                This trade has expired. The auto-cancel service will clean it up shortly.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Toggle Buttons */}
      <div className="flex gap-2 border-b">
        <Button
          variant={view === 'pending' ? 'default' : 'ghost'}
          onClick={() => setView('pending')}
          className="rounded-b-none"
        >
          Pending Trades
          {pendingTrades.length > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-primary-foreground text-primary">
              {pendingTrades.length}
            </span>
          )}
        </Button>
        <Button
          variant={view === 'completed' ? 'default' : 'ghost'}
          onClick={() => setView('completed')}
          className="rounded-b-none"
        >
          Completed Trades
          {completedTrades.length > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-primary-foreground text-primary">
              {completedTrades.length}
            </span>
          )}
        </Button>
      </div>

      {/* Trades Display */}
      <div className="space-y-4">
        {displayedTrades.length === 0 ? (
          <Alert>
            <AlertDescription>
              {view === 'pending' 
                ? "You have no pending trades."
                : "You have no completed trades yet."}
            </AlertDescription>
          </Alert>
        ) : (
          displayedTrades.map((trade: Trade) => renderTradeCard(trade, view === 'completed'))
        )}
      </div>
    </div>
  );
}

