'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Loader2, CheckCircle2, AlertCircle, ExternalLink, Rocket, Database, Clock, ArrowRight } from 'lucide-react';
import { BuyFlowData } from '@/app/buy/page';
import { api, TradeResultWithCNY, FillWithCNY } from '@/lib/api';
import { parseContractError } from '@/lib/contractErrors';
import { getTransactionUrl } from '@/lib/contracts';
import { getTokenDecimals } from '@/lib/tokens';
import { useTranslations } from 'next-intl';

interface ExecuteTradeProps {
  flowData: BuyFlowData;
  updateFlowData: (data: Partial<BuyFlowData>) => void;
  goBack: () => void;
  goToNextStep: () => void;
}

type ExecuteStatus = 'idle' | 'executing' | 'success' | 'error';

export function ExecuteTrade({ flowData, updateFlowData, goBack, goToNextStep }: ExecuteTradeProps) {
  const t = useTranslations('buy.executeTrade');
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

      // Don't auto-redirect - let user click Continue button
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
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Page Header */}
      <div className="text-center space-y-3">
        <h2 className="text-3xl font-bold tracking-tight">
          {status === 'executing' && 'Creating Your Trades'}
          {status === 'success' && 'Trades Created Successfully!'}
          {status === 'error' && 'Trade Creation Failed'}
        </h2>
        <p className="text-muted-foreground text-lg">
          {status === 'executing' && 'Submitting transactions to the blockchain...'}
          {status === 'success' && 'Redirecting to payment instructions'}
          {status === 'error' && 'Something went wrong'}
        </p>
      </div>

      {/* Main Card */}
      <Card className="border-2 shadow-xl bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800/50">
        <CardContent className="p-8 space-y-8">
          
          {/* Executing State */}
          {status === 'executing' && (
            <>
              {/* Loading Animation */}
              <div className="flex flex-col items-center justify-center py-12 space-y-6">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center animate-pulse">
                    <Rocket className="h-12 w-12 text-white" />
                  </div>
                  <Loader2 className="absolute -top-2 -right-2 h-8 w-8 animate-spin text-primary" />
                </div>
                
                <div className="text-center space-y-2">
                  <p className="text-2xl font-bold">Creating your trades...</p>
                  <p className="text-muted-foreground max-w-md">
                    {progress < 40 && (
                      <span className="flex items-center justify-center gap-2">
                        <Rocket className="h-4 w-4" />
                        Calling smart contract...
                      </span>
                    )}
                    {progress >= 40 && progress < 65 && (
                      <span className="flex items-center justify-center gap-2">
                        <Clock className="h-4 w-4" />
                        Waiting for blockchain confirmation...
                      </span>
                    )}
                    {progress >= 65 && progress < 95 && (
                      <span className="flex items-center justify-center gap-2">
                        <Database className="h-4 w-4 animate-pulse" />
                        Syncing trades to database...
                      </span>
                    )}
                    {progress >= 95 && (
                      <span className="flex items-center justify-center gap-2 text-green-600">
                        <CheckCircle2 className="h-4 w-4" />
                        Done! Redirecting...
                      </span>
                    )}
                  </p>
                </div>

                {/* Progress Bar */}
                <div className="w-full max-w-md space-y-2">
                  <Progress value={progress} className="h-3" />
                  <p className="text-xs text-center text-muted-foreground">
                    {progress}% Complete
                  </p>
                </div>

                <div className="bg-blue-50 dark:bg-blue-950/20 border-2 border-blue-200 dark:border-blue-800 rounded-xl p-4 max-w-md">
                  <p className="text-sm text-blue-800 dark:text-blue-200 text-center">
                    {progress < 65 
                      ? '⚡ Submitting transaction to blockchain...'
                      : '🔄 Waiting for database sync (ensures secure proof submission)...'
                    }
                  </p>
                  <p className="text-xs text-center text-blue-600 dark:text-blue-300 mt-2">
                    This may take 10-60 seconds. Please don't close this page.
                  </p>
                </div>
              </div>
            </>
          )}

          {/* Success State */}
          {status === 'success' && (
            <>
              {/* Success Animation */}
              <div className="flex flex-col items-center justify-center py-8 space-y-6">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center shadow-lg">
                  <CheckCircle2 className="h-14 w-14 text-white" />
                </div>
                <div className="text-center space-y-2">
                  <p className="text-3xl font-bold">All Set!</p>
                  <p className="text-muted-foreground">
                    Your trades have been created successfully
                  </p>
                </div>
              </div>

              <div className="border-t"></div>

              {/* Trade Details */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  Created Trades ({trades.length})
                </h3>
                
                <div className="space-y-3">
                  {trades.map((trade, index) => (
                    <div
                      key={trade.trade_id}
                      className="border-2 rounded-xl p-5 bg-gradient-to-br from-green-50/50 to-emerald-50/50 dark:from-green-950/10 dark:to-emerald-950/10"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-semibold text-lg">Trade {index + 1}</span>
                        <span className="text-xs px-3 py-1.5 bg-green-200 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full font-semibold">
                          PENDING PAYMENT
                        </span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Amount</span>
                          <span className="font-bold">¥{(parseFloat(trade.cny_amount) / 100).toFixed(2)} CNY</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Payment to</span>
                          <span className="font-semibold">{trade.alipay_name} ({trade.alipay_id})</span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t">
                          <span className="text-xs text-muted-foreground font-mono">
                            {trade.trade_id.slice(0, 10)}...{trade.trade_id.slice(-8)}
                          </span>
                          {trade.tx_hash && (
                            <a
                              href={getTransactionUrl(trade.tx_hash)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary text-xs flex items-center gap-1 hover:underline"
                            >
                              View TX <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 pt-4">
                <Button
                  onClick={goToNextStep}
                  className="flex-1 h-14 text-base bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold shadow-lg"
                >
                  <ArrowRight className="mr-2 h-5 w-5" />
                  Continue to Payment
                </Button>
              </div>
            </>
          )}

          {/* Error State */}
          {status === 'error' && (
            <>
              {/* Error Display */}
              <div className="flex flex-col items-center justify-center py-8 space-y-6">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center shadow-lg">
                  <AlertCircle className="h-14 w-14 text-white" />
                </div>
                <div className="text-center space-y-2">
                  <p className="text-2xl font-bold">Transaction Failed</p>
                  <p className="text-muted-foreground">
                    Unable to create trades on the blockchain
                  </p>
                </div>
              </div>

              {/* Error Message */}
              <Alert variant="destructive" className="border-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>

              {/* Action Buttons */}
              <div className="flex gap-4">
                <Button 
                  variant="outline" 
                  onClick={goBack} 
                  className="flex-1 h-14 text-base border-2"
                >
                  <ArrowLeft className="mr-2 h-5 w-5" />
                  Back
                </Button>
                <Button 
                  onClick={retry} 
                  className="flex-1 h-14 text-base bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold shadow-lg"
                >
                  <Rocket className="mr-2 h-5 w-5" />
                  Retry
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

