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
import { useTranslations } from 'next-intl';

interface ErrorAlertsProps {
  status: TradeStatus;
  onRetry: () => void;
}

export function ErrorAlerts({ status, onRetry }: ErrorAlertsProps) {
  const t = useTranslations('buy.errorAlerts');
  
  // Proof generation failed
  if (status.status === 'proof_failed') {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-sm">
          <div className="font-semibold mb-2">{t('proofFailed.title')}</div>
          <p className="mb-2">{status.error}</p>
          <p className="mt-2 text-xs">
            {t('proofFailed.description')}
          </p>
          <Button
            onClick={onRetry}
            variant="outline"
            size="sm"
            className="mt-3"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            {t('proofFailed.tryAgain')}
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
          <div className="font-semibold mb-2">{t('validationFailed.title')}</div>
          <p className="mt-2 text-xs">
            {t('validationFailed.description')}
          </p>
          <Button
            onClick={onRetry}
            variant="outline"
            size="sm"
            className="mt-3"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            {t('validationFailed.tryAgain')}
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
            <span>{t('processing.generating')}</span>
          </div>
          {status.uploadedFilename && (
            <span className="block mt-2 font-mono text-xs text-muted-foreground">
              {t('processing.file')} {status.uploadedFilename}
            </span>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            {t('processing.wait')}
          </p>
        </AlertDescription>
      </Alert>
    );
  }

  // Trade settled
  if (status.status === 'settled') {
    return (
      <Alert className="bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800">
        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
        <AlertDescription className="text-sm text-green-800 dark:text-green-200">
          {t('settled.message')}
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
          {t('expired.message')}
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}

