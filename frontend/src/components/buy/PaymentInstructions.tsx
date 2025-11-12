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
  RotateCcw
} from 'lucide-react';
import { api } from '@/lib/api';
import { getTransactionUrl } from '@/lib/contracts';

interface Trade {
  trade_id: string;
  order_id: string;
  tx_hash: string;
  alipay_id: string;
  alipay_name: string;
  cny_amount: string;
  payment_nonce: string;
  expires_at: number;
}

interface PaymentInstructionsProps {
  trades: Trade[];
  onAllSettled: () => void;
}

interface TradeStatus {
  status: 'pending' | 'uploading' | 'validating' | 'valid' | 'invalid' | 'processing' | 'settled' | 'expired' | 'generating_proof' | 'proof_ready' | 'proof_failed' | 'proof_submitted' | 'submitting_to_blockchain' | 'blockchain_submitted' | 'settling';
  tx_hash?: string;
  settlement_tx_hash?: string; // Settlement transaction hash from DB
  blockchain_tx_hash?: string; // Transaction hash from blockchain submission
  timeRemaining: number;
  error?: string; // Add error field for inline error display
  uploadedFilename?: string; // Uploaded PDF filename
  validationDetails?: string; // Validation details (expected vs actual hash)
  expectedHash?: string;
  actualHash?: string;
}

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

      // Step 2: Validate PDF using OpenVM
      console.log('Starting PDF validation...');
      
      // Note: PDF is already saved in database from Step 1
      // Backend will read it from there, no need to send it again
      const validationResponse = await api.validatePdf(tradeId);
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
        // ⚠️ AXIOM API TEMPORARILY DISABLED FOR CODEBASE CLEANUP
        // TODO: Uncomment the code below after Base migration is complete
        // ============================================================================
        
        /* COMMENTED OUT FOR CLEANUP - RESTORE AFTER BASE MIGRATION
        
        // Step 3: Generate Axiom proof (this takes time - up to 20 minutes)
        console.log('Starting Axiom proof generation...');
        
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
        
        END OF COMMENTED CODE */
        
        // Temporary: Just mark as complete for testing
        console.log('⚠️ Axiom API temporarily disabled - skipping proof generation');
        
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

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Production Mode:</strong> Upload your Alipay payment PDF below.
          The PDF will be stored securely and used to generate a zkPDF proof for settlement.
        </AlertDescription>
      </Alert>

      {trades.map((trade) => {
        const status = tradeStatuses.get(trade.trade_id)!;
        const cnyAmount = (parseFloat(trade.cny_amount) / 100).toFixed(2);

        return (
          <Card key={trade.trade_id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  Payment: ¥{cnyAmount} CNY
                </CardTitle>
                <div className="flex items-center gap-2">
                  {status.status === 'pending' && status.timeRemaining > 0 && (
                    <div className="flex items-center gap-1 text-sm font-semibold text-orange-600">
                      <Clock className="h-4 w-4" />
                      {formatTime(status.timeRemaining)}
                    </div>
                  )}
                  {status.status === 'expired' && (
                    <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded-full font-semibold">
                      EXPIRED
                    </span>
                  )}
                  {status.status === 'proof_submitted' && (
                    <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full font-semibold">
                      PROOF SUBMITTED
                    </span>
                  )}
                  {status.status === 'settled' && (
                    <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full font-semibold flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      SETTLED
                    </span>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Payment Details */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Alipay Account:</span>
                  <span className="font-mono font-semibold">{trade.alipay_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Account Name:</span>
                  <span className="font-semibold">{trade.alipay_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="font-semibold text-lg">¥{cnyAmount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Payment Note:</span>
                  <span className="font-mono text-lg font-bold">{trade.payment_nonce}</span>
                </div>
              </div>

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

              {status.status === 'uploading' && (
                <Button disabled className="w-full">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading PDF...
                </Button>
              )}

              {status.status === 'validating' && (
                <Alert>
                  <AlertDescription className="text-sm">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Validating PDF with OpenVM...</span>
                    </div>
                    {status.uploadedFilename && (
                      <span className="block mt-2 font-mono text-xs text-muted-foreground">
                        File: {status.uploadedFilename}
                      </span>
                    )}
                    <p className="mt-2 text-xs text-muted-foreground">
                      This verifies your payment details match the PDF signature and content.
                    </p>
                  </AlertDescription>
                </Alert>
              )}

              {status.status === 'valid' && (
                <Alert className="bg-green-50 border-green-200">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-sm text-green-800">
                    <div className="font-semibold mb-2">✅ PDF Validation Complete!</div>
                    <p className="mb-2">{status.validationDetails}</p>
                    {status.expectedHash && status.actualHash && (
                      <div className="mt-2 p-2 bg-white/50 rounded text-xs font-mono space-y-1">
                        <div>
                          <span className="text-muted-foreground">Expected Hash:</span>
                          <div className="break-all">{status.expectedHash}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Actual Hash:</span>
                          <div className="break-all">{status.actualHash}</div>
                        </div>
                      </div>
                    )}
                    <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
                      <p className="text-xs text-yellow-800">
                        ⚠️ <strong>Axiom API Disabled:</strong> Proof generation and blockchain submission are temporarily disabled for codebase cleanup.
                      </p>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {status.status === 'generating_proof' && (
                <Alert className="bg-blue-50 border-blue-200">
                  <AlertDescription className="text-sm text-blue-800">
                    <div className="flex items-center gap-2 mb-2">
                      <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                      <span className="font-semibold">🚀 Generating Zero-Knowledge Proof...</span>
                    </div>
                    <p className="mb-2">
                      Your payment proof is being generated via Axiom OpenVM proving network.
                    </p>
                    <div className="mt-3 space-y-1 text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <span>✓ PDF uploaded & validated locally</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                        <span>⏳ Generating EVM proof (this may take 5-20 minutes)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-gray-300"></div>
                        <span>Proof ready for blockchain submission</span>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground font-semibold">
                      ⚠️ Please keep this page open. Do not refresh or navigate away.
                    </p>
                  </AlertDescription>
                </Alert>
              )}

              {status.status === 'proof_ready' && (
                <Alert className="bg-green-50 border-green-200">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-sm text-green-800">
                    <div className="font-semibold mb-2">✅ Proof Generated Successfully!</div>
                    <p className="mb-2">
                      Your zero-knowledge proof has been generated and verified by Axiom.
                    </p>
                    <div className="mt-3 space-y-1 text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <span>✓ PDF validated</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <span>✓ EVM proof generated & downloaded</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                        <span>⏳ Submitting to blockchain for settlement...</span>
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {status.status === 'submitting_to_blockchain' && (
                <Alert className="bg-blue-50 border-blue-200">
                  <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                  <AlertDescription className="text-sm text-blue-800">
                    <div className="font-semibold mb-2">📤 Submitting Proof to Blockchain...</div>
                    <p className="mb-2">
                      Your proof is being submitted to the smart contract for settlement. This usually takes 10-30 seconds.
                    </p>
                    <div className="mt-3 space-y-1 text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <span>✓ PDF validated</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <span>✓ EVM proof generated</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                        <span>⏳ Calling smart contract...</span>
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {status.status === 'blockchain_submitted' && (
                <Alert className="bg-green-50 border-green-200">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-sm text-green-800">
                    <div className="font-semibold mb-2">🎉 Proof Submitted to Blockchain!</div>
                    <p className="mb-2">
                      Your proof has been successfully submitted. Waiting for blockchain confirmation...
                    </p>
                    {status.blockchain_tx_hash && (
                      <div className="mt-2 p-2 bg-white/50 rounded">
                        <p className="text-xs text-muted-foreground mb-1">Transaction Hash:</p>
                        <div className="flex items-center gap-2">
                          <code className="text-xs break-all">{status.blockchain_tx_hash}</code>
                          <ExternalLink 
                            className="h-3 w-3 flex-shrink-0 cursor-pointer text-blue-600"
                            onClick={() => status.blockchain_tx_hash && window.open(getTransactionUrl(status.blockchain_tx_hash), '_blank')}
                          />
                        </div>
                      </div>
                    )}
                    <div className="mt-3 space-y-1 text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <span>✓ PDF validated</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <span>✓ EVM proof generated</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <span>✓ Proof submitted to blockchain</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                        <span>⏳ Confirming settlement...</span>
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
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
    </div>
  );
}

