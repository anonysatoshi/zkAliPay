import { useState, useEffect } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';
import { ESCROW_ABI, ESCROW_ADDRESS, getAddress } from '@/lib/contracts';

export interface WithdrawParams {
  orderId: string;
  amount: string; // Human-readable (e.g., "50.5")
  tokenAddress: string; // ERC20 token address
  tokenDecimals: number; // Token decimals (6, 9, 18, etc.)
}

export type WithdrawStep = 'idle' | 'withdrawing' | 'success' | 'error';

export function useWithdraw() {
  const [currentStep, setCurrentStep] = useState<WithdrawStep>('idle');
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const { writeContract, data: withdrawHash, error: withdrawError } = useWriteContract();

  const { isLoading: isWithdrawing, isSuccess: isWithdrawSuccess } = useWaitForTransactionReceipt({
    hash: withdrawHash,
  });

  // Handle errors
  useEffect(() => {
    if (withdrawError) {
      console.error('Withdraw error:', withdrawError);
      setError(withdrawError.message || 'Failed to withdraw');
      setCurrentStep('error');
    }
  }, [withdrawError]);

  // Handle success
  useEffect(() => {
    if (isWithdrawSuccess && currentStep === 'withdrawing') {
      console.log('Withdrawal confirmed!');
      setCurrentStep('success');
      setTxHash(withdrawHash || null);
    }
  }, [isWithdrawSuccess, currentStep, withdrawHash]);

  const executeWithdraw = async (params: WithdrawParams) => {
    try {
      setError(null);
      setCurrentStep('withdrawing');

      // Parse amount with token-specific decimals
      const amountWei = parseUnits(params.amount, params.tokenDecimals);

      // Convert orderId to bytes32
      const orderIdBytes = params.orderId.startsWith('0x') 
        ? params.orderId 
        : `0x${params.orderId}`;

      console.log('Withdrawing...', {
        orderId: orderIdBytes,
        amount: amountWei.toString(),
        token: params.tokenAddress,
        decimals: params.tokenDecimals,
      });

      writeContract({
        address: getAddress(ESCROW_ADDRESS),
        abi: ESCROW_ABI,
        functionName: 'withdrawAmount',
        args: [orderIdBytes as `0x${string}`, amountWei],
      });
    } catch (err) {
      console.error('Error in withdrawal:', err);
      setError(err instanceof Error ? err.message : 'Failed to withdraw');
      setCurrentStep('error');
    }
  };

  const resetState = () => {
    setCurrentStep('idle');
    setError(null);
    setTxHash(null);
  };

  return {
    executeWithdraw,
    resetState,
    currentStep,
    isWithdrawing,
    error,
    txHash,
  };
}

