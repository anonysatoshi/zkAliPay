'use client';

import { ExternalLink, Upload, Zap, Send } from 'lucide-react';
import { PhaseProgress } from './PhaseProgress';
import { getTransactionUrl } from '@/lib/contracts';
import type { TradeStatus } from './types';
import { useTranslations } from 'next-intl';

interface ProcessingSectionProps {
  status: TradeStatus;
}

export function ProcessingSection({ status }: ProcessingSectionProps) {
  const t = useTranslations('buy.paymentInstructions.processingSection');
  
  // Only show if not pending, expired, or settled
  if (status.status === 'pending' || status.status === 'expired' || status.status === 'settled') {
    return null;
  }

  return (
    <div className="space-y-3 pt-4">
      {/* Phase 1: Upload & Validation */}
      <PhaseProgress
        phase={1}
        title={t('phase1.title')}
        description={t('phase1.description')}
        status={
          ['settled', 'submitting_to_blockchain', 'blockchain_submitted', 'proof_submitted', 'generating_proof', 'proof_ready', 'valid'].includes(status.status)
            ? 'completed'
            : ['uploading', 'validating'].includes(status.status)
            ? 'in_progress'
            : status.status === 'invalid'
            ? 'failed'
            : 'pending'
        }
        icon={Upload}
        estimatedTime={t('phase1.estimatedTime')}
        details={
          <div className="space-y-2">
            {status.uploadedFilename && (
              <div className="p-2 bg-white/70 dark:bg-gray-800/70 rounded-lg border border-gray-200 dark:border-gray-700 text-xs">
                <span className="text-gray-600 dark:text-gray-400">{t('phase1.file')}</span> 
                <span className="font-mono ml-2 text-gray-900 dark:text-gray-100">{status.uploadedFilename}</span>
              </div>
            )}
            {status.status === 'uploading' && (
              <p className="text-xs text-blue-700 dark:text-blue-400 font-medium">{t('phase1.uploading')}</p>
            )}
            {status.status === 'validating' && (
              <p className="text-xs text-blue-700 dark:text-blue-400 font-medium">{t('phase1.validating')}</p>
            )}
            {['valid', 'generating_proof', 'proof_ready', 'submitting_to_blockchain', 'blockchain_submitted', 'proof_submitted', 'settled'].includes(status.status) && (
              <div className="space-y-2">
                <p className="text-xs text-green-700 dark:text-green-400 font-semibold">{t('phase1.validationComplete')}</p>
                {status.validationDetails && (
                  <p className="text-xs text-green-700 dark:text-green-400">{status.validationDetails}</p>
                )}
              </div>
            )}
          </div>
        }
      />

      {/* Phase 2: Generate Proof */}
      <PhaseProgress
        phase={2}
        title={t('phase2.title')}
        description={t('phase2.description')}
        status={
          ['settled', 'submitting_to_blockchain', 'blockchain_submitted', 'proof_submitted', 'proof_ready'].includes(status.status)
            ? 'completed'
            : status.status === 'generating_proof'
            ? 'in_progress'
            : status.status === 'proof_failed'
            ? 'failed'
            : 'pending'
        }
        icon={Zap}
        estimatedTime={t('phase2.estimatedTime')}
        details={
          <div className="space-y-2">
            {status.status === 'generating_proof' && (
              <>
                <p className="text-xs text-blue-700 dark:text-blue-400 font-medium">
                  {t('phase2.requesting')}
                </p>
                <div className="mt-2 space-y-1.5 text-xs text-gray-700 dark:text-gray-300">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500 dark:bg-blue-400 animate-pulse"></div>
                    <span>{t('phase2.generating')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-500"></div>
                    <span>{t('phase2.downloading')}</span>
                  </div>
                </div>
                <div className="mt-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <p className="text-xs text-yellow-900 dark:text-yellow-200 font-medium">
                    ⏰ <strong>{t('phase2.pleaseWait')}</strong> {t('phase2.waitMessage')}
                  </p>
                </div>
              </>
            )}
            {['proof_ready', 'submitting_to_blockchain', 'blockchain_submitted', 'proof_submitted', 'settled'].includes(status.status) && (
              <p className="text-xs text-green-700 dark:text-green-400 font-semibold">
                {t('phase2.proofGenerated')}
              </p>
            )}
          </div>
        }
      />

      {/* Phase 3: Submit to Blockchain */}
      <PhaseProgress
        phase={3}
        title={t('phase3.title')}
        description={t('phase3.description')}
        status={
          ['settled', 'proof_submitted'].includes(status.status)
            ? 'completed'
            : ['submitting_to_blockchain', 'blockchain_submitted', 'settling'].includes(status.status)
            ? 'in_progress'
            : 'pending'
        }
        icon={Send}
        estimatedTime={t('phase3.estimatedTime')}
        details={
          <div className="space-y-2">
            {['submitting_to_blockchain', 'blockchain_submitted'].includes(status.status) && (
              <>
                <p className="text-xs text-blue-700 dark:text-blue-400 font-medium">
                  {t('phase3.submitting')}
                </p>
                {status.blockchain_tx_hash && (
                  <div className="p-3 bg-white/70 dark:bg-gray-800/70 rounded-lg border border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1.5 font-medium">{t('phase3.transactionHash')}</p>
                    <a
                      href={getTransactionUrl(status.blockchain_tx_hash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline break-all font-mono"
                    >
                      {status.blockchain_tx_hash}
                      <ExternalLink className="h-3 w-3 flex-shrink-0" />
                    </a>
                  </div>
                )}
              </>
            )}
            {['proof_submitted', 'settled'].includes(status.status) && (
              <p className="text-xs text-green-700 dark:text-green-400 font-semibold">
                {t('phase3.proofSubmitted')}
              </p>
            )}
          </div>
        }
      />
    </div>
  );
}

