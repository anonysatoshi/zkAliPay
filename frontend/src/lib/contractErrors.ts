// Contract error decoder for ZkAliPayEscrow
// Maps error selectors to human-readable messages

export interface ContractError {
  selector: string;
  name: string;
  message: string;
}

// Error selectors from ZkAliPayEscrow.sol
export const CONTRACT_ERRORS: Record<string, ContractError> = {
  '0x2fcd1a0f': {
    selector: '0x2fcd1a0f',
    name: 'AmountBelowMinimum',
    message: 'Trade amount is below the minimum (¥700.00). Please increase your purchase amount.',
  },
  '0x339cee21': {
    selector: '0x339cee21',
    name: 'AmountExceedsAvailable',
    message: 'The requested amount exceeds what\'s available in this order. Try a smaller amount or refresh to see updated availability.',
  },
  '0x8cce984e': {
    selector: '0x8cce984e',
    name: 'WithdrawalExceedsAvailable',
    message: 'Withdrawal amount exceeds the order\'s remaining balance.',
  },
  '0x06250401': {
    selector: '0x06250401',
    name: 'AmountTooLarge',
    message: 'Trade amount exceeds the maximum (¥72,000.00). Please reduce your purchase amount.',
  },
  '0xd36d8965': {
    selector: '0xd36d8965',
    name: 'OrderNotFound',
    message: 'This order no longer exists. It may have been filled or cancelled. Please refresh and try a different order.',
  },
  '0x630bae04': {
    selector: '0x630bae04',
    name: 'TradeNotFound',
    message: 'Trade not found. Please refresh and try again.',
  },
  '0x5f3f6cfc': {
    selector: '0x5f3f6cfc',
    name: 'TradeNotPending',
    message: 'This trade is no longer pending. It may have already been settled or expired.',
  },
  '0xe170cd29': {
    selector: '0xe170cd29',
    name: 'TradeNotExpired',
    message: 'This trade has not expired yet and cannot be cancelled.',
  },
  '0xea8e4eb5': {
    selector: '0xea8e4eb5',
    name: 'NotAuthorized',
    message: 'You are not authorized to perform this action.',
  },
  '0xd611c318': {
    selector: '0xd611c318',
    name: 'ProofVerificationFailed',
    message: 'Payment proof verification failed. Please ensure you uploaded the correct Alipay payment receipt.',
  },
  '0x826d29e4': {
    selector: '0x826d29e4',
    name: 'PaymentDetailsMismatch',
    message: 'Payment details do not match the trade requirements. Please check the payment amount and recipient.',
  },
  '0x90b8ec18': {
    selector: '0x90b8ec18',
    name: 'TransferFailed',
    message: 'Token transfer failed. Please check your wallet balance and approvals.',
  },
  '0x118cdaa7': {
    selector: '0x118cdaa7',
    name: 'OwnableUnauthorizedAccount',
    message: 'Unauthorized: Only the contract owner can perform this action. The current wallet is not the owner.',
  },
};

/**
 * Decode a contract error from error data
 * @param errorData - The error data from the contract (e.g., "0xd36d8965")
 * @returns Human-readable error message
 */
export function decodeContractError(errorData: string): string {
  // Extract the first 10 characters (0x + 8 hex chars = error selector)
  const selector = errorData.substring(0, 10).toLowerCase();
  
  const error = CONTRACT_ERRORS[selector];
  
  if (error) {
    return `${error.name}: ${error.message}`;
  }
  
  // If we don't recognize the error, return a generic message with the selector
  return `Contract error (${selector}). Please try again or contact support if the issue persists.`;
}

/**
 * Extract error data from various error formats
 * @param error - The error object from the API or contract call
 * @returns Decoded error message
 */
export function parseContractError(error: any): string {
  // Try to extract error data from various formats
  let errorData: string | undefined;
  
  // Format 1: Direct error data in message
  if (typeof error === 'string') {
    const match = error.match(/0x[0-9a-fA-F]{8,}/);
    if (match) {
      errorData = match[0];
    }
  }
  
  // Format 2: Error in response data
  if (error?.response?.data?.error) {
    const match = error.response.data.error.match(/0x[0-9a-fA-F]{8,}/);
    if (match) {
      errorData = match[0];
    }
  }
  
  // Format 3: Error message contains the data
  if (error?.message) {
    const match = error.message.match(/0x[0-9a-fA-F]{8,}/);
    if (match) {
      errorData = match[0];
    }
  }
  
  // Format 4: Axios error with nested structure
  if (error?.response?.data) {
    const dataStr = JSON.stringify(error.response.data);
    const match = dataStr.match(/0x[0-9a-fA-F]{8,}/);
    if (match) {
      errorData = match[0];
    }
  }
  
  if (errorData) {
    return decodeContractError(errorData);
  }
  
  // Fallback to original error message
  return error?.response?.data?.error || error?.message || 'An unknown error occurred';
}

