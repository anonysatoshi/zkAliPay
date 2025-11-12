'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { AmountInput } from '@/components/buy/AmountInput';
import { MatchReview } from '@/components/buy/MatchReview';
import { ExecuteTrade } from '@/components/buy/ExecuteTrade';
import { PaymentInstructions } from '@/components/buy/PaymentInstructions';
import { BuyProgress, BuyStep as ProgressStep } from '@/components/buy/BuyProgress';
import { MyTrades } from '@/components/buyer/MyTrades';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { MatchPlan } from '@/lib/api';
import { getTransactionUrl } from '@/lib/contracts';

export type BuyStep = 'amount' | 'review' | 'execute' | 'payment' | 'settled';

export interface Trade {
  trade_id: string;
  order_id: string;
  tx_hash: string;
  alipay_id: string;
  alipay_name: string;
  cny_amount: string;
  payment_nonce: string;
  expires_at: number;
}

export interface BuyFlowData {
  amount: string;
  maxRate?: string;
  matchPlan?: MatchPlan;
  buyerAddress?: string;
  tradeIds?: string[];
  trades?: Trade[];
}

export default function BuyPage() {
  const { isConnected } = useAccount();
  const [currentStep, setCurrentStep] = useState<BuyStep>('amount');
  const [flowData, setFlowData] = useState<BuyFlowData>({ amount: '' });

  const updateFlowData = (data: Partial<BuyFlowData>) => {
    setFlowData((prev) => ({ ...prev, ...data }));
  };

  const goToStep = (step: BuyStep) => {
    setCurrentStep(step);
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight mb-2">Buy Tokens</h1>
        <p className="text-lg text-muted-foreground">
          Purchase tokens with CNY via Alipay
        </p>
      </div>

      {/* Tabs: New Order vs My Trades */}
      <Tabs defaultValue="new-order" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="new-order">New Order</TabsTrigger>
          <TabsTrigger value="my-trades" disabled={!isConnected}>
            My Trades {!isConnected && '(Connect Wallet)'}
          </TabsTrigger>
        </TabsList>

        {/* New Order Tab */}
        <TabsContent value="new-order" className="space-y-6">
          {/* Progress Bar */}
          <BuyProgress currentStep={currentStep as ProgressStep} />

          {/* Step Content */}
          <div className="mt-8">
            {currentStep === 'amount' && (
              <AmountInput
                flowData={flowData}
                updateFlowData={updateFlowData}
                goToNextStep={() => goToStep('review')}
              />
            )}

            {currentStep === 'review' && (
              <MatchReview
                flowData={flowData}
                updateFlowData={updateFlowData}
                goToNextStep={() => goToStep('execute')}
                goBack={() => goToStep('amount')}
              />
            )}

            {currentStep === 'execute' && (
              <ExecuteTrade
                flowData={flowData}
                updateFlowData={updateFlowData}
                goBack={() => goToStep('review')}
                goToNextStep={() => goToStep('payment')}
              />
            )}

            {currentStep === 'payment' && flowData.trades && (
              <PaymentInstructions
                trades={flowData.trades}
                onAllSettled={() => goToStep('settled')}
              />
            )}

            {currentStep === 'settled' && (
              <div className="text-center py-12 space-y-6">
                <div className="text-6xl">🎉</div>
                <h2 className="text-3xl font-bold">Your Trade is Complete!</h2>
                <p className="text-muted-foreground">
                  Your tokens have been sent to your wallet.
                </p>
                
                {/* Settlement Transaction Links */}
                {flowData.trades && (
                  <div className="mt-6 space-y-2">
                    <p className="text-sm text-muted-foreground font-semibold">Settlement Transactions:</p>
                    {flowData.trades.map((trade) => {
                      const tradeStatus = (window as any).tradeStatuses?.get(trade.trade_id);
                      const settlementTxHash = tradeStatus?.settlement_tx_hash;
                      
                      if (settlementTxHash) {
                        return (
                          <a
                            key={trade.trade_id}
                            href={getTransactionUrl(settlementTxHash)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-primary hover:underline flex items-center justify-center gap-2"
                          >
                            View Settlement TX on Explorer
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        );
                      }
                      return null;
                    })}
                  </div>
                )}
                
                <button
                  onClick={() => {
                    setCurrentStep('amount');
                    setFlowData({ amount: '' });
                  }}
                  className="mt-6 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                >
                  Start New Purchase
                </button>
              </div>
            )}
          </div>
        </TabsContent>

        {/* My Trades Tab */}
        <TabsContent value="my-trades" className="mt-6">
          {isConnected ? (
            <MyTrades />
          ) : (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">
                  Please connect your wallet to view your trades
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

