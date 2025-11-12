'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, CheckCircle2, Info, AlertCircle } from 'lucide-react';
import { BuyFlowData } from '@/app/buy/page';
import { formatUSDC, formatCNY } from '@/lib/contracts';
import { api } from '@/lib/api';
import { getTokenInfo, formatTokenAmount, getExchangeRateLabel } from '@/lib/tokens';

interface MatchReviewProps {
  flowData: BuyFlowData;
  updateFlowData: (data: Partial<BuyFlowData>) => void;
  goToNextStep: () => void;
  goBack: () => void;
}

export function MatchReview({ flowData, goToNextStep, goBack }: MatchReviewProps) {
  const { matchPlan } = flowData;
  const [minTradeValueCNY, setMinTradeValueCNY] = useState<number | null>(null);
  const [maxTradeValueCNY, setMaxTradeValueCNY] = useState<number | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [paymentWindowSeconds, setPaymentWindowSeconds] = useState<number>(90); // Default 90s

  // Fetch contract configuration on mount
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const config = await api.getContractConfig();
        
        // Contract stores values in CNY cents (e.g., 70000 = 700 CNY)
        const minCny = parseInt(config.min_trade_value_cny) / 100; // Convert cents to yuan
        const maxCny = parseInt(config.max_trade_value_cny) / 100;
        const paymentWindow = parseInt(config.payment_window); // Get payment window in seconds
        
        setMinTradeValueCNY(minCny);
        setMaxTradeValueCNY(maxCny);
        setPaymentWindowSeconds(paymentWindow);
        
        console.log('Contract config loaded:', {
          minCny: minCny + ' CNY',
          maxCny: maxCny + ' CNY',
          paymentWindow: paymentWindow + ' seconds',
        });
      } catch (err) {
        console.error('Failed to fetch contract config:', err);
        // Use fallback values if fetch fails
        setMinTradeValueCNY(7); // Default: 7 CNY (700 cents)
        setMaxTradeValueCNY(72000); // Default: 72000 CNY
        setPaymentWindowSeconds(90); // Default: 90 seconds
      } finally {
        setIsLoadingConfig(false);
      }
    };

    fetchConfig();
  }, []);

  // Validate CNY amounts when config is loaded
  useEffect(() => {
    if (isLoadingConfig || !matchPlan || minTradeValueCNY === null) {
      return;
    }

    // Get token info from the first fill for calculations
    const tokenAddress = matchPlan.fills[0]?.token || '';
    const tokenInfo = getTokenInfo(tokenAddress);

    // Check each fill to see if any violates the minimum CNY requirement
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
  }, [isLoadingConfig, matchPlan, minTradeValueCNY]);

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
    <div className="space-y-6">
      {/* Match Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>Review Match Plan</CardTitle>
          <CardDescription>
            We've found the best rates for your purchase
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Individual Fills */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Orders to Fill:</h3>
            {matchPlan.fills.map((fill, index) => {
              const fillAmount = parseFloat(fill.fill_amount) / Math.pow(10, tokenInfo.decimals);
              const rate = parseFloat(fill.exchange_rate) / 100;
              // Recalculate CNY correctly (backend has wrong decimals)
              const fillCNY = fillAmount * rate;

              return (
                <div
                  key={fill.order_id}
                  className="border rounded-lg p-4 space-y-2 bg-muted/50"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Order {index + 1}</span>
                    <span className="text-sm text-muted-foreground">
                      {fill.order_id.slice(0, 10)}...
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">{tokenInfo.symbol} Amount</p>
                      <p className="font-semibold">{fillAmount.toFixed(tokenInfo.decimals === 6 ? 2 : 4)} {tokenInfo.symbol}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">CNY Amount</p>
                      <p className="font-semibold">¥{fillCNY.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Exchange Rate</p>
                      <p className="font-semibold">{rate.toFixed(2)} {getExchangeRateLabel(tokenAddress)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Seller</p>
                      <p className="font-mono text-xs">
                        {fill.seller.slice(0, 6)}...{fill.seller.slice(-4)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Total Summary */}
          <div className="border-t pt-4">
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                Total Summary
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total {tokenInfo.symbol}</p>
                  <p className="text-2xl font-bold">{totalAmount.toFixed(tokenInfo.decimals === 6 ? 2 : 4)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total CNY to Pay</p>
                  <p className="text-2xl font-bold text-primary">¥{totalCNY.toFixed(2)}</p>
                </div>
              </div>
              <div className="pt-2 border-t">
                <p className="text-sm text-muted-foreground">Average Exchange Rate</p>
                <p className="text-lg font-semibold">{avgRate.toFixed(4)} {getExchangeRateLabel(tokenAddress)}</p>
              </div>
            </div>
          </div>

          {/* Info Alert */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Next steps:</strong> After confirming, you'll be shown Alipay payment
              instructions. You'll have <strong>{paymentWindowSeconds} seconds</strong> to send the payment and submit
              proof.
            </AlertDescription>
          </Alert>

          {/* Validation Error Alert */}
          {validationError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Cannot proceed:</strong> {validationError}
              </AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={goBack} className="flex-1">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button 
              onClick={goToNextStep} 
              className="flex-1" 
              size="lg"
              disabled={isLoadingConfig || !!validationError}
            >
              {isLoadingConfig ? 'Loading...' : 'Confirm Match'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Payment Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Payment Preview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {matchPlan.fills.map((fill, index) => {
            const fillAmount = parseFloat(fill.fill_amount) / Math.pow(10, tokenInfo.decimals);
            const rate = parseFloat(fill.exchange_rate) / 100;
            const fillCNY = fillAmount * rate;
            
            return (
              <div key={fill.order_id} className="flex justify-between py-2 border-b last:border-0">
                <span className="text-muted-foreground">
                  Payment {index + 1} to {fill.alipay_name}
                </span>
                <span className="font-semibold">
                  ¥{fillCNY.toFixed(2)}
                </span>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

