import { useState, useEffect } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi';
import { parseUnits, Address, getAddress } from 'viem';
import { ESCROW_ABI, ESCROW_ADDRESS, USDC_ABI } from '@/lib/contracts';

export interface CreateOrderParams {
  tokenAddress: string; // ERC20 token address
  tokenDecimals: number; // Token decimals (6 for USDC/USDT, 9 for SOL, 18 for others)
  amount: string; // Token amount (in human-readable format, e.g. "100")
  exchangeRate: string; // Exchange rate in cents (e.g. "730" for 7.30 CNY/token)
  alipayId: string;
  alipayName: string;
}

export type CreateOrderStep = 'idle' | 'approving' | 'creating' | 'success' | 'error';

export function useCreateOrder() {
  const [currentStep, setCurrentStep] = useState<CreateOrderStep>('idle');
  const [error, setError] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);

  const publicClient = usePublicClient();
  
  const { writeContract: approve, data: approveHash, error: approveError } = useWriteContract();
  const { writeContract: createOrder, data: createHash, error: createError } = useWriteContract();

  const { isLoading: isApproving, isSuccess: isApproveSuccess } = useWaitForTransactionReceipt({
    hash: approveHash,
  });

  const { isLoading: isCreating, isSuccess: isCreateSuccess } = useWaitForTransactionReceipt({
    hash: createHash,
  });

  const resetState = () => {
    setCurrentStep('idle');
    setError(null);
    setOrderId(null);
  };

  // Handle approve errors
  useEffect(() => {
    if (approveError) {
      console.error('Approval error:', approveError);
      setError(approveError.message || 'Failed to approve USDC');
      setCurrentStep('error');
    }
  }, [approveError]);

  // Handle create errors
  useEffect(() => {
    if (createError) {
      console.error('Create order error:', createError);
      setError(createError.message || 'Failed to create order');
      setCurrentStep('error');
    }
  }, [createError]);

  const executeCreateOrder = async (params: CreateOrderParams) => {
    try {
      setError(null);
      setCurrentStep('approving');

      // Parse amount with token-specific decimals
      const amountWei = parseUnits(params.amount, params.tokenDecimals);

      // Step 1: Approve token
      console.log('Approving token...', { 
        token: params.tokenAddress,
        amount: amountWei.toString(), 
        escrow: ESCROW_ADDRESS,
      });
      
      approve({
        address: getAddress(params.tokenAddress),
        abi: USDC_ABI, // Generic ERC20 ABI works for all tokens
        functionName: 'approve',
        args: [getAddress(ESCROW_ADDRESS), amountWei],
      });

      // Wait for approval (handled by isApproving state)
      // Once approved, move to creation step
    } catch (err) {
      console.error('Error in approval:', err);
      setError(err instanceof Error ? err.message : 'Failed to approve token');
      setCurrentStep('error');
    }
  };

  // When approval succeeds, create the order
  const handleApprovalSuccess = async (params: CreateOrderParams) => {
    try {
      setCurrentStep('creating');
      
      const amountWei = parseUnits(params.amount, params.tokenDecimals);
      const rate = BigInt(params.exchangeRate);

      console.log('Creating order...', {
        token: params.tokenAddress,
        amount: amountWei.toString(),
        exchangeRate: rate.toString(),
        alipayId: params.alipayId,
        alipayName: params.alipayName,
      });

      createOrder({
        address: getAddress(ESCROW_ADDRESS),
        abi: ESCROW_ABI,
        functionName: 'createAndLockOrder',
        args: [
          getAddress(params.tokenAddress),
          amountWei,
          rate,
          params.alipayId,
          params.alipayName,
        ],
      });
    } catch (err) {
      console.error('Error creating order:', err);
      setError(err instanceof Error ? err.message : 'Failed to create order');
      setCurrentStep('error');
    }
  };

  // When order creation succeeds, extract order ID from logs
  const handleCreateSuccess = async () => {
    try {
      if (!createHash || !publicClient) return;

      const receipt = await publicClient.getTransactionReceipt({ hash: createHash });
      
      // Find OrderCreatedAndLocked event in logs
      // Event signature: OrderCreatedAndLocked(bytes32 indexed orderId, ...)
      const orderCreatedTopic = '0x' + '...' ; // Will be calculated from event signature
      
      // For now, just set success
      setCurrentStep('success');
      setOrderId(createHash); // Temporary - should extract from logs
      
    } catch (err) {
      console.error('Error extracting order ID:', err);
      setCurrentStep('success'); // Still consider it success even if we can't extract ID
    }
  };

  return {
    executeCreateOrder,
    handleApprovalSuccess,
    handleCreateSuccess,
    resetState,
    currentStep,
    isApproving,
    isCreating,
    error,
    orderId,
    approveHash,
    createHash,
    isApproveSuccess,
    isCreateSuccess,
  };
}

