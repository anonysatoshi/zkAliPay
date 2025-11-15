'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';
import { PaymentTutorialModal } from './payment/PaymentTutorialModal';
import { PaymentDetailsSection } from './payment/PaymentDetailsSection';
import { UploadSection } from './payment/UploadSection';
import { ProcessingSection } from './payment/ProcessingSection';
import { ErrorAlerts } from './payment/ErrorAlerts';
import { formatTime, formatCnyAmount } from './payment/utils';
import type { Trade, PaymentInstructionsProps, TradeStatus } from './payment/types';

export function PaymentInstructions({ trades, onAllSettled }: PaymentInstructionsProps) {
  const [tradeStatuses, setTradeStatuses] = useState<Map<string, TradeStatus>>(
    new Map(
      trades.map((t) => [
        t.trade_id,
        {
          status: 'pending',
          timeRemaining: Math.max(0, t.expires_at - Math.floor(Date.now() / 1000)),
        },
      ])
    )
  );

  // Tutorial modal state
  const [tutorialOpen, setTutorialOpen] = useState<string | null>(null);

  // Expose trade statuses to parent via window (for completion screen)
  useEffect(() => {
    (window as any).tradeStatuses = tradeStatuses;
  }, [tradeStatuses]);

  // Update countdown every second
  useEffect(() => {
    const interval = setInterval(() => {
      setTradeStatuses((prev) => {
        const updated = new Map(prev);
        trades.forEach((trade) => {
          const current = updated.get(trade.trade_id);
          if (current && current.status === 'pending') {
            const timeRemaining = Math.max(
              0,
              trade.expires_at - Math.floor(Date.now() / 1000)
            );
            updated.set(trade.trade_id, {
              ...current,
              timeRemaining,
              status: timeRemaining === 0 ? 'expired' : 'pending',
            });
          }
        });
        return updated;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [trades]);

  // Check if all trades are settled
  useEffect(() => {
    const allSettled = Array.from(tradeStatuses.values()).every(
      (s) => s.status === 'settled'
    );
    if (allSettled && trades.length > 0) {
      onAllSettled();
    }
  }, [tradeStatuses, trades.length, onAllSettled]);

  // Queue to ensure proofs are submitted sequentially (prevents nonce collisions)
  const proofSubmissionQueueRef = useRef<Promise<void>>(Promise.resolve());

  const handlePdfUpload = async (tradeId: string, file: File) => {
    if (!file) {
      setTradeStatuses((prev) => {
        const updated = new Map(prev);
        updated.set(tradeId, { 
          ...prev.get(tradeId)!, 
          error: 'Please select a PDF file'
        });
        return updated;
      });
      return;
    }

    // Validate file type
    if (file.type !== 'application/pdf') {
      setTradeStatuses((prev) => {
        const updated = new Map(prev);
        updated.set(tradeId, { 
          ...prev.get(tradeId)!, 
          error: 'Only PDF files are supported'
        });
        return updated;
      });
      return;
    }

    setTradeStatuses((prev) => {
      const updated = new Map(prev);
      updated.set(tradeId, { 
        ...prev.get(tradeId)!, 
        status: 'uploading',
        error: undefined // Clear previous error
      });
      return updated;
    });

    try {
      // Step 1: Upload PDF to backend
      const uploadResponse = await api.uploadPdf(tradeId, file);
      console.log('PDF uploaded successfully:', uploadResponse);
        
      setTradeStatuses((prev) => {
        const updated = new Map(prev);
        updated.set(tradeId, {
          ...prev.get(tradeId)!,
          status: 'validating',
          uploadedFilename: uploadResponse.filename,
        });
        return updated;
      });

      // Step 2: Validate PDF using Axiom Execute Mode (remote validation)
      console.log('⚡ Starting PDF validation via Axiom execute mode...');
      
      setTradeStatuses((prev) => {
        const updated = new Map(prev);
        updated.set(tradeId, {
          ...prev.get(tradeId)!,
          status: 'validating',
          uploadedFilename: file.name,
        });
        return updated;
      });
      
      // Note: PDF is already saved in database from Step 1
      // Backend will:
      //   1. Compute expected hash locally (fast)
      //   2. Generate 46 input streams
      //   3. Cache input streams for reuse in proof generation
      //   4. Send to Axiom API in execute mode (fast validation)
      //   5. Get actual output hash from Axiom
      //   6. Compare hashes
      const validationResponse = await api.validatePdfAxiom(tradeId);
      console.log('Validation result:', validationResponse);
      
      if (validationResponse.is_valid) {
        // PDF is valid - show success
        setTradeStatuses((prev) => {
          const updated = new Map(prev);
          updated.set(tradeId, {
            ...prev.get(tradeId)!,
            status: 'valid',
            uploadedFilename: file.name,
            validationDetails: validationResponse.details,
            expectedHash: validationResponse.expected_hash,
            actualHash: validationResponse.actual_hash,
          });
          return updated;
        });
        
        // ============================================================================
        // Step 3: Generate EVM Proof using Axiom (after validation success)
        // Step 4: Submit Proof to Blockchain
        // ============================================================================
        
        console.log('✅ Validation successful! Starting Axiom proof generation...');
        
        setTradeStatuses((prev) => {
          const updated = new Map(prev);
          updated.set(tradeId, {
            ...prev.get(tradeId)!,
            status: 'generating_proof',
          });
          return updated;
        });
        
        try {
          const proofResponse = await api.generateProof(tradeId);
          console.log('Proof generated:', proofResponse);
          
          if (proofResponse.success) {
            setTradeStatuses((prev) => {
              const updated = new Map(prev);
              updated.set(tradeId, {
                ...prev.get(tradeId)!,
                status: 'proof_ready',
              });
              return updated;
            });
            
            // Step 4: Submit proof to blockchain
            console.log('Submitting proof to blockchain...');
            
            setTradeStatuses((prev) => {
              const updated = new Map(prev);
              updated.set(tradeId, {
                ...prev.get(tradeId)!,
                status: 'submitting_to_blockchain',
              });
              return updated;
            });
            
            try {
              const blockchainResponse = await api.submitBlockchainProof(tradeId);
              console.log('Proof submitted to blockchain:', blockchainResponse);
              
              if (blockchainResponse.success) {
                setTradeStatuses((prev) => {
                  const updated = new Map(prev);
                  updated.set(tradeId, {
                    ...prev.get(tradeId)!,
                    status: 'blockchain_submitted',
                    blockchain_tx_hash: blockchainResponse.tx_hash,
                  });
                  return updated;
                });
                
                // Wait a bit for blockchain confirmation, then mark as settled
                setTimeout(() => {
                  setTradeStatuses((prev) => {
                    const updated = new Map(prev);
                    updated.set(tradeId, {
                      ...prev.get(tradeId)!,
                      status: 'settled',
                      settlement_tx_hash: blockchainResponse.tx_hash,
                    });
                    return updated;
                  });
                }, 3000); // Give 3 seconds for visual feedback
              } else {
                throw new Error(blockchainResponse.message || 'Blockchain submission failed');
              }
            } catch (blockchainError: any) {
              console.error('Blockchain submission error:', blockchainError);
              setTradeStatuses((prev) => {
                const updated = new Map(prev);
                updated.set(tradeId, {
                  ...prev.get(tradeId)!,
                  status: 'proof_failed',
                  error: blockchainError.response?.data?.error || blockchainError.message || 'Failed to submit proof to blockchain',
                });
                return updated;
              });
            }
          } else {
            throw new Error(proofResponse.message || 'Proof generation failed');
          }
        } catch (proofError: any) {
          console.error('Proof generation error:', proofError);
          setTradeStatuses((prev) => {
            const updated = new Map(prev);
            updated.set(tradeId, {
              ...prev.get(tradeId)!,
              status: 'proof_failed',
              error: proofError.response?.data?.message || proofError.message || 'Failed to generate proof',
            });
            return updated;
          });
        }
        
      } else {
        // PDF is invalid - show error
        setTradeStatuses((prev) => {
          const updated = new Map(prev);
          updated.set(tradeId, {
            ...prev.get(tradeId)!,
            status: 'invalid',
            error: 'PDF validation failed: ' + validationResponse.details,
            validationDetails: validationResponse.details,
            expectedHash: validationResponse.expected_hash,
            actualHash: validationResponse.actual_hash,
          });
          return updated;
        });
      }
      
    } catch (error: any) {
      console.error('PDF upload/validation error:', error);
      setTradeStatuses((prev) => {
        const updated = new Map(prev);
        updated.set(tradeId, { 
          ...prev.get(tradeId)!, 
          status: 'pending',
          error: error.response?.data?.message || error.message || 'Failed to process PDF'
        });
        return updated;
      });
    }
  };

  const pollTradeStatus = async (tradeId: string) => {
    // Poll every 3 seconds for up to 60 seconds (to account for event listener delay)
    let attempts = 0;
    const maxAttempts = 20; // Increased from 10 to 20 (60 seconds total)

    const poll = setInterval(async () => {
      attempts++;
      console.log(`Polling trade status (attempt ${attempts}/${maxAttempts})...`);
      
      try {
        const trade = await api.getTrade(tradeId);
        
        if (trade.status === 1) {  // 1 = SETTLED
          console.log('Trade settled! Updating UI...');
          setTradeStatuses((prev) => {
            const updated = new Map(prev);
            updated.set(tradeId, {
              ...prev.get(tradeId)!,
              status: 'settled',
              settlement_tx_hash: trade.settlement_tx_hash, // Store settlement tx hash from DB
            });
            return updated;
          });
          clearInterval(poll);
        }

        if (attempts >= maxAttempts) {
          console.warn('Polling timeout - trade may be settled but not synced yet');
          clearInterval(poll);
        }
      } catch (error) {
        console.error('Poll trade status error:', error);
        if (attempts >= maxAttempts) {
          clearInterval(poll);
        }
      }
    }, 3000);
  };

  return (
    <div className="space-y-6">
      {trades.map((trade) => {
        const status = tradeStatuses.get(trade.trade_id)!;
        const cnyAmount = formatCnyAmount(trade.cny_amount);

        const handleRetry = () => {
          setTradeStatuses((prev) => {
            const updated = new Map(prev);
            updated.set(trade.trade_id, {
              ...status,
              status: 'pending',
              error: undefined,
              uploadedFilename: undefined,
              validationDetails: undefined,
              expectedHash: undefined,
              actualHash: undefined,
            });
            return updated;
          });
        };

        return (
          <Card 
            key={trade.trade_id}
            className="border-2 hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800/50"
          >
            <CardHeader className="border-b bg-gradient-to-r from-blue-50/50 to-purple-50/50 dark:from-blue-950/20 dark:to-purple-950/20">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-bold">
                  💸 Payment: ¥{cnyAmount} CNY
                </CardTitle>
                <div className="flex items-center gap-2">
                  {status.status === 'pending' && status.timeRemaining > 0 && (
                    <div className="flex items-center gap-1 text-sm font-semibold text-orange-600 bg-orange-50 px-3 py-1 rounded-full">
                      <Clock className="h-4 w-4" />
                      {formatTime(status.timeRemaining)}
                    </div>
                  )}
                  {status.status === 'expired' && (
                    <span className="text-xs px-3 py-1.5 bg-red-100 text-red-700 rounded-full font-semibold">
                      EXPIRED
                    </span>
                  )}
                  {status.status === 'proof_submitted' && (
                    <span className="text-xs px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full font-semibold">
                      PROOF SUBMITTED
                    </span>
                  )}
                  {status.status === 'settled' && (
                    <span className="text-xs px-3 py-1.5 bg-green-100 text-green-700 rounded-full font-semibold flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      SETTLED
                    </span>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 pt-6">
              {/* Payment Details Section */}
              <PaymentDetailsSection
                trade={trade}
                status={status}
                cnyAmount={cnyAmount}
                onOpenTutorial={() => setTutorialOpen(trade.trade_id)}
              />

              {/* Upload Section - Only for pending trades */}
              {status.status === 'pending' && status.timeRemaining > 0 && (
                <UploadSection
                  tradeId={trade.trade_id}
                  error={status.error}
                  onFileUpload={(file) => handlePdfUpload(trade.trade_id, file)}
                />
              )}

              {/* Processing Section - Phases 1, 2, 3 */}
              <ProcessingSection status={status} />

              {/* Error Alerts - All error states */}
              <ErrorAlerts status={status} onRetry={handleRetry} />
            </CardContent>
          </Card>
        );
      })}

      {/* Tutorial Modal */}
      {tutorialOpen && trades.find((t) => t.trade_id === tutorialOpen) && (
        <PaymentTutorialModal
          isOpen={!!tutorialOpen}
          onClose={() => setTutorialOpen(null)}
          paymentNonce={trades.find((t) => t.trade_id === tutorialOpen)!.payment_nonce}
          alipayId={trades.find((t) => t.trade_id === tutorialOpen)!.alipay_id}
          alipayName={trades.find((t) => t.trade_id === tutorialOpen)!.alipay_name}
          amount={(parseFloat(trades.find((t) => t.trade_id === tutorialOpen)!.cny_amount) / 100).toFixed(2)}
        />
      )}
    </div>
  );
}

