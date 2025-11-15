'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { 
  AlertCircle, 
  CheckCircle2, 
  Loader2,
  RotateCcw 
} from 'lucide-react';
import type { TradeStatus } from './types';

interface ErrorAlertsProps {
  status: TradeStatus;
  onRetry: () => void;
}

export function ErrorAlerts({ status, onRetry }: ErrorAlertsProps) {
  // Proof generation failed
  if (status.status === 'proof_failed') {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-sm">
          <div className="font-semibold mb-2">❌ Proof Generation Failed</div>
          <p className="mb-2">{status.error}</p>
          <p className="mt-2 text-xs">
            The zero-knowledge proof could not be generated. This may be due to a temporary issue with the proving network. Please try again later or contact support.
          </p>
          <Button
            onClick={onRetry}
            variant="outline"
            size="sm"
            className="mt-3"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // PDF validation failed
  if (status.status === 'invalid') {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-sm">
          <div className="font-semibold mb-2">❌ PDF Validation Failed</div>
          <p className="mb-2">{status.error}</p>
          {status.expectedHash && status.actualHash && (
            <div className="mt-2 p-2 bg-white/50 rounded text-xs font-mono space-y-1">
              <div>
                <span className="text-muted-foreground">Expected Hash:</span>
                <div className="break-all">{status.expectedHash}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Actual Hash:</span>
                <div className="break-all text-red-600">{status.actualHash}</div>
              </div>
            </div>
          )}
          <p className="mt-2 text-xs">
            Please ensure you uploaded the correct Alipay payment receipt PDF with the exact payment details shown above.
          </p>
          <Button
            onClick={onRetry}
            variant="outline"
            size="sm"
            className="mt-3"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // Processing (legacy state)
  if (status.status === 'processing') {
    return (
      <Alert>
        <AlertDescription className="text-sm">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Generating zkPDF proof via Axiom API...</span>
          </div>
          {status.uploadedFilename && (
            <span className="block mt-2 font-mono text-xs text-muted-foreground">
              File: {status.uploadedFilename}
            </span>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            This may take a few minutes. Please do not close this page.
          </p>
        </AlertDescription>
      </Alert>
    );
  }

  // Trade settled
  if (status.status === 'settled') {
    return (
      <Alert className="bg-green-50 border-green-200">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-sm text-green-800">
          ✅ Trade settled! USDC has been sent to your wallet.
        </AlertDescription>
      </Alert>
    );
  }

  // Payment expired
  if (status.status === 'expired') {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-sm">
          ⏰ Payment window expired. This trade can be cancelled.
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}

