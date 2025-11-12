'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Loader2, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';
import { BuyFlowData } from '@/app/buy/page';
import { api, TradeResult, TradeResultWithCNY, MatchPlan, FillWithCNY } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { parseContractError } from '@/lib/contractErrors';
import { getTransactionUrl } from '@/lib/contracts';
import { getTokenDecimals } from '@/lib/tokens';

interface ExecuteTradeProps {
  flowData: BuyFlowData;
  updateFlowData: (data: Partial<BuyFlowData>) => void;
  goBack: () => void;
  goToNextStep: () => void;
}

type ExecuteStatus = 'idle' | 'executing' | 'success' | 'error';

export function ExecuteTrade({ flowData, updateFlowData, goBack, goToNextStep }: ExecuteTradeProps) {
  const router = useRouter();
  const [status, setStatus] = useState<ExecuteStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [trades, setTrades] = useState<TradeResultWithCNY[]>([]);
  const [progress, setProgress] = useState(0);

  const { matchPlan, buyerAddress } = flowData;
  const hasExecutedRef = useRef(false);

  useEffect(() => {
    if (status === 'idle' && !hasExecutedRef.current) {
      // Auto-execute on mount (only once)
      hasExecutedRef.current = true; // Set BEFORE calling async function
      executeTradeFlow();
    }
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const executeTradeFlow = async () => {
    if (!matchPlan || !buyerAddress) {
      setError('Missing match plan or buyer address');
      setStatus('error');
      return;
    }

    setStatus('executing');
    setError(null);
    setProgress(10);

    try {
      console.log('Executing fill order via relayer...', { matchPlan, buyerAddress });

      setProgress(30);

      // Calculate CNY amounts locally (will be merged with backend response)
      const fillsWithCNY: FillWithCNY[] = matchPlan.fills.map(fill => {
        const tokenDecimals = getTokenDecimals(fill.token);
        const fillAmount = parseFloat(fill.fill_amount) / Math.pow(10, tokenDecimals);
        const rate = parseFloat(fill.exchange_rate) / 100; // Convert cents to yuan
        const correctCnyAmount = Math.round(fillAmount * rate * 100); // Convert to cents
        
        return {
          ...fill,
          cny_amount: correctCnyAmount.toString(),
        };
      });
      
      const correctedMatchPlan = {
        ...matchPlan,
        fills: fillsWithCNY,
      };

      // Call backend API to execute fills via relayer
      const executedTrades = await api.executeFill(correctedMatchPlan, buyerAddress);

      console.log('Trades executed:', executedTrades);

      setProgress(60);

      // Merge backend response with local CNY calculations
      // Backend returns trade_id, order_id, tx_hash, alipay details, payment_nonce, expires_at
      // We add cny_amount from our local fillsWithCNY by matching order_id
      const tradesWithCNY: TradeResultWithCNY[] = executedTrades.map(trade => {
        const fill = fillsWithCNY.find(f => f.order_id === trade.order_id);
        return {
          ...trade,
          cny_amount: fill?.cny_amount || '0', // Fallback to '0' if not found (shouldn't happen)
        };
      });

      // Wait for trades to be synced to database
      // This prevents race condition where user tries to submit proof before DB sync
      console.log('Waiting for trades to sync to database...');
      
      const tradeIds = tradesWithCNY.map((t) => t.trade_id);
      const syncSuccess = await waitForTradesSync(tradeIds);
      
      if (!syncSuccess) {
        throw new Error('Trades created but database sync timed out. Please refresh and try again.');
      }

      console.log('Trades synced to database!');
      setProgress(90);

      setTrades(tradesWithCNY);
      updateFlowData({ 
        tradeIds: tradesWithCNY.map((t) => t.trade_id),
        trades: tradesWithCNY,
      });

      setProgress(100);
      setStatus('success');

      // Navigate to payment page after 2 seconds
      setTimeout(() => {
        goToNextStep();
      }, 2000);
    } catch (err: any) {
      console.error('Execute trade error:', err);
      // Use the contract error decoder to get a human-readable message
      const errorMessage = parseContractError(err);
      setError(errorMessage);
      setStatus('error');
      setProgress(0);
    }
  };

  // Poll database to ensure trades are synced before proceeding
  const waitForTradesSync = async (tradeIds: string[]): Promise<boolean> => {
    const maxAttempts = 20; // 20 attempts
    const delayMs = 3000; // 3 seconds between attempts = 60 seconds max wait
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      console.log(`Checking if trades synced (attempt ${attempt + 1}/${maxAttempts})...`);
      
      try {
        // Try to fetch each trade from the database
        const fetchPromises = tradeIds.map((tradeId) => api.getTrade(tradeId));
        await Promise.all(fetchPromises);
        
        // If all trades fetched successfully, they're synced!
        console.log('All trades confirmed in database!');
        return true;
      } catch (error) {
        // Trade not found yet, wait and retry
        console.log(`Trades not synced yet, waiting ${delayMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
    
    // Timeout after max attempts
    console.error('Timeout waiting for trades to sync to database');
    return false;
  };

  const retry = () => {
    setStatus('idle');
    setProgress(0);
    setError(null);
    executeTradeFlow();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Executing Trade</CardTitle>
        <CardDescription>
          {status === 'executing' && 'Creating trades on the blockchain...'}
          {status === 'success' && 'Trades created successfully!'}
          {status === 'error' && 'Failed to create trades'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Progress Bar */}
        {status === 'executing' && (
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-center text-muted-foreground">
              {progress < 40 && 'Calling smart contract...'}
              {progress >= 40 && progress < 65 && 'Waiting for confirmation...'}
              {progress >= 65 && progress < 95 && '⏳ Syncing trades to database...'}
              {progress >= 95 && 'Done! Redirecting...'}
            </p>
          </div>
        )}

        {/* Loading State */}
        {status === 'executing' && (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-lg font-semibold">Creating your trades...</p>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              {progress < 65 
                ? 'Submitting transaction to blockchain...'
                : 'Waiting for database sync (this ensures secure proof submission)...'
              }
            </p>
            <p className="text-xs text-muted-foreground">
              This may take 10-60 seconds. Please don't close this page.
            </p>
          </div>
        )}

        {/* Success State */}
        {status === 'success' && (
          <div className="space-y-4">
            <div className="flex flex-col items-center justify-center py-6 space-y-4">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
              </div>
              <p className="text-xl font-bold text-center">Trades Created Successfully!</p>
              <p className="text-sm text-muted-foreground text-center max-w-md">
                Redirecting to payment instructions...
              </p>
            </div>

            {/* Trade Details */}
            <div className="space-y-2">
              {trades.map((trade, index) => (
                <div
                  key={trade.trade_id}
                  className="border rounded-lg p-4 bg-muted/50 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Trade {index + 1}</span>
                    <span className="text-xs text-green-600 font-semibold">PENDING</span>
                  </div>
                  <div className="text-sm space-y-1">
                    <p className="text-muted-foreground">
                      Trade ID:{' '}
                      <span className="font-mono text-xs">
                        {trade.trade_id.slice(0, 10)}...{trade.trade_id.slice(-8)}
                      </span>
                    </p>
                    <p className="text-muted-foreground">
                      Amount: ¥{(parseFloat(trade.cny_amount) / 100).toFixed(2)} CNY
                    </p>
                    <p className="text-muted-foreground">
                      Payment to: {trade.alipay_name} ({trade.alipay_id})
                    </p>
                    {trade.tx_hash && (
                      <a
                        href={getTransactionUrl(trade.tx_hash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary text-xs flex items-center gap-1 hover:underline"
                      >
                        View on Explorer <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => (window.location.href = '/buy')}
                className="flex-1"
              >
                Start New Purchase
              </Button>
              <Button
                variant="outline"
                onClick={() => (window.location.href = '/debug')}
                className="flex-1"
              >
                View Database
              </Button>
            </div>
          </div>
        )}

        {/* Error State */}
        {status === 'error' && (
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>

            <div className="flex gap-3">
              <Button variant="outline" onClick={goBack} className="flex-1">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button onClick={retry} className="flex-1">
                Retry
              </Button>
            </div>
          </div>
        )}

        {/* Info */}
        {status === 'executing' && (
          <Alert>
            <AlertDescription className="text-xs">
              <strong>What's happening:</strong> The relayer is calling the smart contract to
              create your trades. This locks the USDC from the seller's orders and generates
              payment instructions for you.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

