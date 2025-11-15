'use client';

import { Button } from '@/components/ui/button';
import { ExternalLink, HelpCircle } from 'lucide-react';
import { getTransactionUrl } from '@/lib/contracts';
import type { Trade, TradeStatus } from './types';

interface PaymentDetailsSectionProps {
  trade: Trade;
  status: TradeStatus;
  cnyAmount: string;
  onOpenTutorial: () => void;
}

export function PaymentDetailsSection({ 
  trade, 
  status, 
  cnyAmount,
  onOpenTutorial 
}: PaymentDetailsSectionProps) {
  return (
    <>
      {/* Payment Details - Apple Style */}
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden shadow-sm">
        {/* Header with Tutorial Link */}
        {status.status === 'pending' && status.timeRemaining > 0 && (
          <div className="flex items-center justify-between px-6 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-b border-gray-200 dark:border-gray-700">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Payment Instructions</span>
            <Button
              onClick={onOpenTutorial}
              variant="ghost"
              size="sm"
              className="h-7 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-100/50 dark:hover:bg-blue-900/30 gap-1.5"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              Need Help?
            </Button>
          </div>
        )}
        
        {/* Payment Details Grid */}
        <div className="p-6 space-y-4">
          {/* Alipay Account */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Alipay Account
            </label>
            <div className="font-mono text-xl font-bold text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700">
              {trade.alipay_id}
            </div>
          </div>

          {/* Account Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Account Name
            </label>
            <div className="text-xl font-bold text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700">
              {trade.alipay_name}
            </div>
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Amount to Transfer
            </label>
            <div className="text-3xl font-bold text-green-600 dark:text-green-400 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 px-4 py-3 rounded-xl border-2 border-green-200 dark:border-green-800">
              ¥{cnyAmount}
            </div>
          </div>

          {/* Payment Note - Critical */}
          <div className="space-y-1.5 pt-2 border-t-2 border-gray-200 dark:border-gray-700">
            <label className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wide flex items-center gap-1">
              <span className="text-base">⚠️</span>
              Payment Note (CRITICAL)
            </label>
            <div className="font-mono text-3xl font-bold text-red-600 dark:text-red-400 bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/20 dark:to-orange-950/20 px-4 py-4 rounded-xl border-2 border-red-300 dark:border-red-700 text-center tracking-wider">
              {trade.payment_nonce}
            </div>
            <p className="text-xs text-red-600 dark:text-red-400 font-semibold text-center">
              You MUST include this exact number in the payment note field!
            </p>
          </div>
        </div>
      </div>

      {/* Trade Info - Minimalist Footer */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span className="font-mono">
          ID: {trade.trade_id.slice(0, 8)}...{trade.trade_id.slice(-6)}
        </span>
        <div className="flex items-center gap-3">
          <a
            href={getTransactionUrl(trade.tx_hash)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary flex items-center gap-1 hover:underline transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            View Trade
          </a>
          {status.tx_hash && (
            <a
              href={getTransactionUrl(status.tx_hash)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary flex items-center gap-1 hover:underline transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              View Proof
            </a>
          )}
        </div>
      </div>
    </>
  );
}

