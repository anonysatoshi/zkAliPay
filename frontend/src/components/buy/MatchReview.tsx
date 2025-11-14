'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, CheckCircle2, AlertCircle, TrendingUp, DollarSign, Users } from 'lucide-react';
import { BuyFlowData } from '@/app/buy/page';
import { api } from '@/lib/api';
import { getTokenInfo, getExchangeRateLabel } from '@/lib/tokens';
import { useTranslations } from 'next-intl';

interface MatchReviewProps {
  flowData: BuyFlowData;
  updateFlowData: (data: Partial<BuyFlowData>) => void;
  goToNextStep: () => void;
  goBack: () => void;
}

export function MatchReview({ flowData, goToNextStep, goBack }: MatchReviewProps) {
  const { matchPlan } = flowData;
  const t = useTranslations('buy.matchReview');
  const [minTradeValueCNY, setMinTradeValueCNY] = useState<number | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Fetch contract configuration for validation only (non-blocking)
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const config = await api.getContractConfig();
        const minCny = parseInt(config.min_trade_value_cny) / 100; // Convert cents to yuan
        setMinTradeValueCNY(minCny);
        
        console.log('Contract config loaded:', {
          minCny: minCny + ' CNY',
        });
      } catch (err) {
        console.error('Failed to fetch contract config:', err);
        // Use fallback value if fetch fails (non-blocking)
        setMinTradeValueCNY(7); // Default: 7 CNY
      }
    };

    fetchConfig();
  }, []);

  // Validate CNY amounts when config is loaded (but don't block UI)
  useEffect(() => {
    if (!matchPlan || minTradeValueCNY === null) {
      return;
    }

    const tokenAddress = matchPlan.fills[0]?.token || '';
    const tokenInfo = getTokenInfo(tokenAddress);

    const invalidFills = matchPlan.fills.filter(fill => {
      const fillAmount = parseFloat(fill.fill_amount) / Math.pow(10, tokenInfo.decimals);
      const rate = parseFloat(fill.exchange_rate) / 100;
      const fillCNY = fillAmount * rate;
      return fillCNY < minTradeValueCNY;
    });

    if (invalidFills.length > 0) {
      const fillAmount = parseFloat(invalidFills[0].fill_amount) / Math.pow(10, tokenInfo.decimals);
      const rate = parseFloat(invalidFills[0].exchange_rate) / 100;
      const fillCNY = fillAmount * rate;
      setValidationError(
        `One or more trades are below the minimum CNY amount. ` +
        `Minimum: ¥${minTradeValueCNY.toFixed(2)} CNY, but a trade has only ¥${fillCNY.toFixed(2)} CNY. ` +
        `Please increase your ${tokenInfo.symbol} amount or choose a higher exchange rate to meet the minimum.`
      );
    } else {
      setValidationError(null);
    }
  }, [matchPlan, minTradeValueCNY]);

  if (!matchPlan) {
    return (
      <Alert variant="destructive">
        <AlertDescription>No match plan available. Please go back and try again.</AlertDescription>
      </Alert>
    );
  }

  // Get token info from the first fill (all fills in a match plan are for the same token)
  const tokenAddress = matchPlan.fills[0]?.token || '';
  const tokenInfo = getTokenInfo(tokenAddress);

  const totalAmount = parseFloat(matchPlan.total_filled) / Math.pow(10, tokenInfo.decimals);
  
  // Calculate total CNY and average rate correctly from fills
  let totalCNY = 0;
  matchPlan.fills.forEach(fill => {
    const fillAmount = parseFloat(fill.fill_amount) / Math.pow(10, tokenInfo.decimals);
    const rate = parseFloat(fill.exchange_rate) / 100;
    totalCNY += fillAmount * rate;
  });
  
  const avgRate = totalAmount > 0 ? totalCNY / totalAmount : 0;

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Page Header */}
      <div className="text-center space-y-3">
        <h2 className="text-3xl font-bold tracking-tight">
          Review Match Plan
        </h2>
        <p className="text-muted-foreground text-lg">
          We've found the best rates for your purchase
        </p>
      </div>

      {/* Main Content Card */}
      <Card className="border-2 shadow-xl bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800/50">
        <CardContent className="p-8 space-y-8">
          
          {/* Section 1: Order Matches */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
                <Users className="h-5 w-5" />
              </div>
              <h3 className="text-xl font-semibold">Matched Orders ({matchPlan.fills.length})</h3>
            </div>
            
            <div className="pl-[52px] space-y-3">
              {matchPlan.fills.map((fill, index) => {
                const fillAmount = parseFloat(fill.fill_amount) / Math.pow(10, tokenInfo.decimals);
                const rate = parseFloat(fill.exchange_rate) / 100;
                const fillCNY = fillAmount * rate;

                return (
                  <div
                    key={fill.order_id}
                    className="border-2 rounded-xl p-5 bg-gradient-to-br from-muted/30 to-muted/50 hover:shadow-md transition-all"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-semibold text-lg">Order {index + 1}</span>
                      <span className="text-xs font-mono bg-muted px-2 py-1 rounded">
                        {fill.order_id.slice(0, 10)}...
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground font-medium">Token Amount</p>
                        <p className="text-base font-bold">{fillAmount.toFixed(tokenInfo.decimals === 6 ? 2 : 4)} {tokenInfo.symbol}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground font-medium">CNY Amount</p>
                        <p className="text-base font-bold text-primary">¥{fillCNY.toFixed(2)}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground font-medium">Exchange Rate</p>
                        <p className="text-sm font-semibold">{rate.toFixed(2)} {getExchangeRateLabel(tokenAddress)}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground font-medium">Seller</p>
                        <p className="font-mono text-xs bg-white dark:bg-gray-800 px-2 py-1 rounded">
                          {fill.seller.slice(0, 6)}...{fill.seller.slice(-4)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t"></div>

          {/* Section 2: Total Summary */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <h3 className="text-xl font-semibold">Total Summary</h3>
            </div>
            
            <div className="pl-[52px]">
              <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 border-2 border-blue-200 dark:border-blue-800 rounded-xl p-6 space-y-4">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-blue-600" />
                      <p className="text-sm text-muted-foreground font-medium">Total {tokenInfo.symbol}</p>
                    </div>
                    <p className="text-3xl font-bold">{totalAmount.toFixed(tokenInfo.decimals === 6 ? 2 : 4)}</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-primary" />
                      <p className="text-sm text-muted-foreground font-medium">Total CNY to Pay</p>
                    </div>
                    <p className="text-3xl font-bold text-primary">¥{totalCNY.toFixed(2)}</p>
                  </div>
                </div>
                <div className="pt-3 border-t border-blue-200 dark:border-blue-800">
                  <p className="text-sm text-muted-foreground font-medium mb-1">Average Exchange Rate</p>
                  <p className="text-xl font-bold">{avgRate.toFixed(4)} {getExchangeRateLabel(tokenAddress)}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t"></div>

          {/* Section 3: Payment Preview */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-orange-500 flex items-center justify-center text-white font-bold">
                <DollarSign className="h-5 w-5" />
              </div>
              <h3 className="text-xl font-semibold">Payment Breakdown</h3>
            </div>
            
            <div className="pl-[52px]">
              <div className="bg-gradient-to-br from-muted/30 to-muted/50 border border-muted rounded-xl p-5 space-y-3">
                {matchPlan.fills.map((fill, index) => {
                  const fillAmount = parseFloat(fill.fill_amount) / Math.pow(10, tokenInfo.decimals);
                  const rate = parseFloat(fill.exchange_rate) / 100;
                  const fillCNY = fillAmount * rate;
                  
                  return (
                    <div key={fill.order_id} className="flex justify-between items-center py-2 border-b last:border-0">
                      <span className="text-sm text-muted-foreground">
                        Payment {index + 1} to <span className="font-semibold text-foreground">{fill.alipay_name}</span>
                      </span>
                      <span className="text-lg font-bold">
                        ¥{fillCNY.toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Validation Error Alert */}
          {validationError && (
            <Alert variant="destructive" className="border-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Cannot proceed:</strong> {validationError}
              </AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex gap-4 pt-4">
            <Button 
              variant="outline" 
              onClick={goBack} 
              className="flex-1 h-14 text-base border-2"
              size="lg"
            >
              <ArrowLeft className="mr-2 h-5 w-5" />
              Back
            </Button>
            <Button 
              onClick={goToNextStep} 
              className="flex-1 h-14 text-base bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold shadow-lg"
              size="lg"
              disabled={!!validationError}
            >
              <CheckCircle2 className="mr-2 h-5 w-5" />
              Confirm Match
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

