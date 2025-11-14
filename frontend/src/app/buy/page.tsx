'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { AmountInput } from '@/components/buy/AmountInput';
import { MatchReview } from '@/components/buy/MatchReview';
import { ExecuteTrade } from '@/components/buy/ExecuteTrade';
import { PaymentInstructions } from '@/components/buy/PaymentInstructions';
import { BuyProgress, BuyStep as ProgressStep } from '@/components/buy/BuyProgress';
import { MyTrades } from '@/components/buyer/MyTrades';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MatchPlan } from '@/lib/api';
import { getTransactionUrl } from '@/lib/contracts';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { ShoppingCart, ListOrdered, ArrowRight } from 'lucide-react';

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
  const t = useTranslations('buy');
  const [currentStep, setCurrentStep] = useState<BuyStep>('amount');
  const [flowData, setFlowData] = useState<BuyFlowData>({ amount: '' });
  const [activeView, setActiveView] = useState<'new-order' | 'my-trades'>('new-order');

  const updateFlowData = (data: Partial<BuyFlowData>) => {
    setFlowData((prev) => ({ ...prev, ...data }));
  };

  const goToStep = (step: BuyStep) => {
    setCurrentStep(step);
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section - Apple Style */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-950 dark:to-purple-950">
        <div className="container mx-auto px-4 py-12 md:py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-4xl mx-auto"
          >
            {/* Main Headline */}
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 dark:from-blue-400 dark:via-purple-400 dark:to-pink-400">
                {t('title')}
              </span>
            </h1>

            <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 mb-8">
              {t('subtitle')}
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button
                size="lg"
                onClick={() => setActiveView('new-order')}
                className={activeView === 'new-order'
                  ? "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-6 rounded-full shadow-lg transition-all duration-300"
                  : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-2 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 px-8 py-6 rounded-full transition-all duration-300"
                }
              >
                <ShoppingCart className="mr-2 h-5 w-5" />
                {t('tabs.newOrder')}
              </Button>
              <Button
                size="lg"
                onClick={() => setActiveView('my-trades')}
                disabled={!isConnected}
                className={activeView === 'my-trades'
                  ? "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-6 rounded-full shadow-lg transition-all duration-300"
                  : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-2 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 px-8 py-6 rounded-full transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                }
              >
                <ListOrdered className="mr-2 h-5 w-5" />
                {t('tabs.myTrades')}
                {!isConnected && <span className="ml-2 text-xs">{t('tabs.connectWallet')}</span>}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-12">
        <div className="container mx-auto px-4 max-w-4xl">
          <motion.div
            key={activeView}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            {activeView === 'new-order' ? (
              <div className="space-y-6">
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
                      <div className="text-6xl">{t('settled.emoji')}</div>
                      <h2 className="text-3xl font-bold">{t('settled.title')}</h2>
                      <p className="text-muted-foreground">
                        {t('settled.subtitle')}
                      </p>
                      
                      {/* Settlement Transaction Links */}
                      {flowData.trades && (
                        <div className="mt-6 space-y-2">
                          <p className="text-sm text-muted-foreground font-semibold">{t('settled.settlementTx')}</p>
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
                                  {t('settled.viewTx')}
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
                        {t('settled.newPurchase')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              // My Trades View
              isConnected ? (
                <MyTrades />
              ) : (
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-center text-muted-foreground">
                      {t('connectPrompt')}
                    </p>
                  </CardContent>
                </Card>
              )
            )}
          </motion.div>
        </div>
      </section>
    </div>
  );
}

