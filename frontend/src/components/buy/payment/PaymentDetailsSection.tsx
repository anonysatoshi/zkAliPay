'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';
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
      {/* Payment Details */}
      <div className="bg-gradient-to-br from-muted/30 to-muted/50 border border-muted rounded-xl p-4 space-y-3 text-sm shadow-sm">
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground font-medium">Alipay Account:</span>
          <span className="font-mono font-semibold bg-white dark:bg-gray-800 px-2 py-1 rounded">{trade.alipay_id}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground font-medium">Account Name:</span>
          <span className="font-semibold">{trade.alipay_name}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground font-medium">Amount:</span>
          <span className="font-bold text-lg text-primary">¥{cnyAmount}</span>
        </div>
        <div className="flex justify-between items-center border-t pt-2 mt-2">
          <span className="text-muted-foreground font-medium">Payment Note:</span>
          <span className="font-mono text-base font-bold bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 px-2 py-1 rounded">{trade.payment_nonce}</span>
        </div>
      </div>

      {/* Tutorial Button - Only show for pending trades */}
      {status.status === 'pending' && status.timeRemaining > 0 && (
        <Alert className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-300">
          <AlertDescription>
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <p className="text-sm font-semibold text-blue-900 mb-1">
                  First time using zkAlipay?
                </p>
                <p className="text-xs text-blue-700">
                  Follow our step-by-step guide with screenshots to complete your payment successfully.
                </p>
              </div>
              <Button
                onClick={onOpenTutorial}
                className="bg-blue-600 hover:bg-blue-700 text-white flex-shrink-0"
                size="sm"
              >
                📚 How to Pay
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Trade Info */}
      <div className="text-xs text-muted-foreground space-y-1">
        <p>
          Trade ID:{' '}
          <span className="font-mono">
            {trade.trade_id.slice(0, 10)}...{trade.trade_id.slice(-8)}
          </span>
        </p>
        <a
          href={getTransactionUrl(trade.tx_hash)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary flex items-center gap-1 hover:underline"
        >
          View on Explorer <ExternalLink className="h-3 w-3" />
        </a>
        {status.tx_hash && (
          <a
            href={getTransactionUrl(status.tx_hash)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary flex items-center gap-1 hover:underline"
          >
            View Proof TX <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </>
  );
}

