/**
 * Type definitions for payment flow components
 */

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

export interface PaymentInstructionsProps {
  trades: Trade[];
  onAllSettled: () => void;
}

export interface TradeStatus {
  status: 
    | 'pending' 
    | 'uploading' 
    | 'validating' 
    | 'valid' 
    | 'invalid' 
    | 'processing' 
    | 'settled' 
    | 'expired' 
    | 'generating_proof' 
    | 'proof_ready' 
    | 'proof_failed' 
    | 'proof_submitted' 
    | 'submitting_to_blockchain' 
    | 'blockchain_submitted' 
    | 'settling';
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

