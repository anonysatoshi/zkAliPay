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
      <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-gray-200/50 dark:border-gray-800/50 shadow-lg">
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
          <div className="flex items-center text-sm font-semibold text-yellow-700 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30 px-3 py-1.5 rounded-xl border border-yellow-300 dark:border-yellow-700">
            <Clock className="h-4 w-4 mr-1.5" />
            Pending Payment
          </div>
        );
      case 1:
        return (
          <div className="flex items-center text-sm font-semibold text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-3 py-1.5 rounded-xl border border-green-300 dark:border-green-700">
            <CheckCircle2 className="h-4 w-4 mr-1.5" />
            Settled
          </div>
        );
      case 2:
        return (
          <div className="flex items-center text-sm font-semibold text-gray-700 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-xl border border-gray-300 dark:border-gray-700">
            <AlertCircle className="h-4 w-4 mr-1.5" />
            Expired
          </div>
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
        className={`bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-gray-200/50 dark:border-gray-800/50 shadow-lg transition-all hover:shadow-xl ${isCompleted ? 'opacity-70' : ''}`}
      >
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-mono text-gray-700 dark:text-gray-300">
                Trade: {formatAddress(trade.trade_id)}
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Created {new Date(trade.created_at * 1000).toLocaleString()}
              </CardDescription>
            </div>
            {getStatusBadge(trade.status)}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Trade Info - Apple Style Grid */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-gradient-to-br from-gray-50 to-blue-50/30 dark:from-gray-800/50 dark:to-blue-900/10 rounded-xl border border-gray-200/50 dark:border-gray-700/50">
            <div className="space-y-1">
              <p className="text-gray-600 dark:text-gray-400 text-xs font-medium">Token Received</p>
              <p className="font-bold text-base text-gray-900 dark:text-gray-100">{tokenAmount}</p>
            </div>
            <div className="space-y-1">
              <p className="text-gray-600 dark:text-gray-400 text-xs font-medium">CNY Paid</p>
              <p className="font-bold text-base text-green-600 dark:text-green-400">¥{cnyAmount}</p>
            </div>
            <div className="space-y-1">
              <p className="text-gray-600 dark:text-gray-400 text-xs font-medium">Payment Nonce</p>
              <p className="font-mono text-xs text-gray-700 dark:text-gray-300">{trade.payment_nonce}</p>
            </div>
            <div className="space-y-1">
              <p className="text-gray-600 dark:text-gray-400 text-xs font-medium">
                {isPending ? 'Expires At' : isSettled ? 'Settled At' : 'Expired At'}
              </p>
              <p className="text-xs text-gray-700 dark:text-gray-300">
                {new Date(trade.expires_at * 1000).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Transaction Links - Modern Style */}
          {(trade.escrow_tx_hash || trade.settlement_tx_hash) && (
            <div className="pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
              {trade.escrow_tx_hash && (
                <a
                  href={getTransactionUrl(trade.escrow_tx_hash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  View Creation TX
                </a>
              )}
              {trade.settlement_tx_hash && (
                <a
                  href={getTransactionUrl(trade.settlement_tx_hash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 font-medium transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  View Settlement TX
                </a>
              )}
            </div>
          )}

          {/* Warning for expired pending trades */}
          {isActuallyExpired && isPending && (
            <Alert variant="destructive" className="border-red-300 dark:border-red-700">
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
      {/* Toggle Buttons - Apple Style */}
      <div className="flex gap-3">
        <Button
          size="lg"
          onClick={() => setView('pending')}
          className={view === 'pending'
            ? "flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg rounded-xl transition-all duration-300"
            : "flex-1 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-2 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 rounded-xl transition-all duration-300"
          }
        >
          Pending Trades
          {pendingTrades.length > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-white/20 text-white font-semibold">
              {pendingTrades.length}
            </span>
          )}
        </Button>
        <Button
          size="lg"
          onClick={() => setView('completed')}
          className={view === 'completed'
            ? "flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg rounded-xl transition-all duration-300"
            : "flex-1 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-2 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 rounded-xl transition-all duration-300"
          }
        >
          Completed Trades
          {completedTrades.length > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-white/20 text-white font-semibold">
              {completedTrades.length}
            </span>
          )}
        </Button>
      </div>

      {/* Trades Display */}
      <div className="space-y-4">
        {displayedTrades.length === 0 ? (
          <Alert className="border-gray-200 dark:border-gray-700">
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

