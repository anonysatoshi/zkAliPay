'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  ExternalLink,
  Loader2,
  RotateCcw,
  Upload,
  Zap,
  Send,
} from 'lucide-react';
import { api } from '@/lib/api';
import { getTransactionUrl } from '@/lib/contracts';
import { PaymentTutorialModal } from './payment/PaymentTutorialModal';
import { PhaseProgress } from './payment/PhaseProgress';
import { formatTime } from './payment/utils';
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
        const cnyAmount = (parseFloat(trade.cny_amount) / 100).toFixed(2);

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
                        onClick={() => setTutorialOpen(trade.trade_id)}
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

              {/* Action Buttons */}
              {status.status === 'pending' && status.timeRemaining > 0 && (
                <>
                  {/* Error Display */}
                  {status.error && (
                    <Alert variant="destructive" className="mb-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-sm">
                        {status.error}
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  <div className="space-y-2 pt-2">
                    <label htmlFor={`pdf-upload-${trade.trade_id}`} className="text-sm font-medium">
                      Upload Alipay Payment PDF
                    </label>
                    <input
                      id={`pdf-upload-${trade.trade_id}`}
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handlePdfUpload(trade.trade_id, file);
                        }
                      }}
                      className="block w-full text-sm text-muted-foreground
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-md file:border-0
                        file:text-sm file:font-semibold
                        file:bg-primary file:text-primary-foreground
                        hover:file:bg-primary/90
                        cursor-pointer"
                    />
                    <p className="text-xs text-muted-foreground">
                      Upload the PDF of your Alipay payment receipt. Maximum file size: 10MB
                    </p>
                  </div>
                </>
              )}

              {/* Phase-Based Progress Display - Only show after user uploads */}
              {(status.status !== 'pending' && status.status !== 'expired' && status.status !== 'settled') && (
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
              )}

              {status.status === 'proof_failed' && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    <div className="font-semibold mb-2">❌ Proof Generation Failed</div>
                    <p className="mb-2">{status.error}</p>
                    <p className="mt-2 text-xs">
                      The zero-knowledge proof could not be generated. This may be due to a temporary issue with the proving network. Please try again later or contact support.
                    </p>
                    <Button
                      onClick={() => {
                        setTradeStatuses((prev) => {
                          const updated = new Map(prev);
                          updated.set(trade.trade_id, {
                            ...status,
                            status: 'pending',
                            error: undefined,
                          });
                          return updated;
                        });
                      }}
                      variant="outline"
                      size="sm"
                      className="mt-3"
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Try Again
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              {status.status === 'invalid' && (
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
                      onClick={() => {
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
                      }}
                      variant="outline"
                      size="sm"
                      className="mt-3"
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Try Again
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              {status.status === 'processing' && (
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
              )}

              {status.status === 'settled' && (
                <Alert className="bg-green-50 border-green-200">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-sm text-green-800">
                    ✅ Trade settled! USDC has been sent to your wallet.
                  </AlertDescription>
                </Alert>
              )}

              {status.status === 'expired' && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    ⏰ Payment window expired. This trade can be cancelled.
                  </AlertDescription>
                </Alert>
              )}
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

