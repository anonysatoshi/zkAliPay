'use client';

import { ExternalLink, Upload, Zap, Send } from 'lucide-react';
import { PhaseProgress } from './PhaseProgress';
import { getTransactionUrl } from '@/lib/contracts';
import type { TradeStatus } from './types';

interface ProcessingSectionProps {
  status: TradeStatus;
}

export function ProcessingSection({ status }: ProcessingSectionProps) {
  // Only show if not pending, expired, or settled
  if (status.status === 'pending' || status.status === 'expired' || status.status === 'settled') {
    return null;
  }

  return (
    <div className="space-y-3 pt-4">
      {/* Phase 1: Upload & Validation */}
      <PhaseProgress
        phase={1}
        title="Upload & Validate Payment"
        description="Upload PDF and verify payment details"
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
        estimatedTime="10-30s"
        details={
          <div className="space-y-2">
            {status.uploadedFilename && (
              <div className="p-2 bg-white/60 rounded text-xs">
                <span className="text-muted-foreground">File:</span> 
                <span className="font-mono ml-2">{status.uploadedFilename}</span>
              </div>
            )}
            {status.status === 'uploading' && (
              <p className="text-xs text-blue-700">📤 Uploading PDF to server...</p>
            )}
            {status.status === 'validating' && (
              <p className="text-xs text-blue-700">🔍 Validating payment details with Axiom Execute mode...</p>
            )}
            {['valid', 'generating_proof', 'proof_ready', 'submitting_to_blockchain', 'blockchain_submitted', 'proof_submitted', 'settled'].includes(status.status) && (
              <div className="space-y-2">
                <p className="text-xs text-green-700 font-semibold">✅ Validation complete!</p>
                {status.validationDetails && (
                  <p className="text-xs text-green-700">{status.validationDetails}</p>
                )}
                {status.expectedHash && status.actualHash && (
                  <div className="p-2 bg-white/60 rounded text-xs font-mono space-y-1">
                    <div>
                      <span className="text-muted-foreground">Expected:</span>
                      <div className="break-all text-[10px]">{status.expectedHash.slice(0, 32)}...</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Actual:</span>
                      <div className="break-all text-[10px]">{status.actualHash.slice(0, 32)}...</div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        }
      />

      {/* Phase 2: Generate Proof */}
      <PhaseProgress
        phase={2}
        title="Generate Zero-Knowledge Proof"
        description="Create cryptographic proof via Axiom network"
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
        estimatedTime="5-10 min"
        details={
          <div className="space-y-2">
            {status.status === 'generating_proof' && (
              <>
                <p className="text-xs text-blue-700">
                  ⚡ Generating EVM-compatible zero-knowledge proof via Axiom OpenVM proving network...
                </p>
                <div className="mt-2 space-y-1 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                    <span>Generating proof on remote server</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-gray-300"></div>
                    <span>Downloading proof for verification</span>
                  </div>
                </div>
                <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                  <p className="text-xs text-yellow-800">
                    ⏰ <strong>Please wait:</strong> This process may take 5-10 minutes. Do not close this page.
                  </p>
                </div>
              </>
            )}
            {['proof_ready', 'submitting_to_blockchain', 'blockchain_submitted', 'proof_submitted', 'settled'].includes(status.status) && (
              <p className="text-xs text-green-700 font-semibold">
                ✅ Zero-knowledge proof generated successfully!
              </p>
            )}
          </div>
        }
      />

      {/* Phase 3: Submit to Blockchain */}
      <PhaseProgress
        phase={3}
        title="Submit to Blockchain"
        description="Submit proof to smart contract for settlement"
        status={
          ['settled', 'proof_submitted'].includes(status.status)
            ? 'completed'
            : ['submitting_to_blockchain', 'blockchain_submitted', 'settling'].includes(status.status)
            ? 'in_progress'
            : 'pending'
        }
        icon={Send}
        estimatedTime="10-30s"
        details={
          <div className="space-y-2">
            {['submitting_to_blockchain', 'blockchain_submitted'].includes(status.status) && (
              <>
                <p className="text-xs text-blue-700">
                  📤 Submitting proof to zkAlipay smart contract...
                </p>
                {status.blockchain_tx_hash && (
                  <div className="p-2 bg-white/60 rounded">
                    <p className="text-xs text-muted-foreground mb-1">Transaction Hash:</p>
                    <a
                      href={getTransactionUrl(status.blockchain_tx_hash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-primary hover:underline break-all"
                    >
                      {status.blockchain_tx_hash}
                      <ExternalLink className="h-3 w-3 flex-shrink-0" />
                    </a>
                  </div>
                )}
              </>
            )}
            {['proof_submitted', 'settled'].includes(status.status) && (
              <p className="text-xs text-green-700 font-semibold">
                ✅ Proof submitted! Waiting for settlement confirmation...
              </p>
            )}
          </div>
        }
      />
    </div>
  );
}

