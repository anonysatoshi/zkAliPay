import { getAddress as viemGetAddress } from 'viem';

// Contract addresses - MUST be set via environment variables from deployment.config.json
// No fallback values to ensure proper configuration
if (!process.env.NEXT_PUBLIC_ESCROW_ADDRESS) {
  throw new Error('NEXT_PUBLIC_ESCROW_ADDRESS must be set in environment variables');
}
if (!process.env.NEXT_PUBLIC_USDC_ADDRESS) {
  throw new Error('NEXT_PUBLIC_USDC_ADDRESS must be set in environment variables');
}
if (!process.env.NEXT_PUBLIC_BLOCK_EXPLORER) {
  throw new Error('NEXT_PUBLIC_BLOCK_EXPLORER must be set in environment variables');
}

export const ESCROW_ADDRESS = process.env.NEXT_PUBLIC_ESCROW_ADDRESS as `0x${string}`;
export const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`;
export const BLOCK_EXPLORER_URL = process.env.NEXT_PUBLIC_BLOCK_EXPLORER;

// Re-export getAddress for convenience
export const getAddress = viemGetAddress;

// Helper to get block explorer transaction URL
export function getTransactionUrl(txHash: string): string {
  return `${BLOCK_EXPLORER_URL}/tx/${txHash}`;
}

// USDC ABI (ERC20)
export const USDC_ABI = [
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// Escrow ABI (minimal - just what we need)
export const ESCROW_ABI = [
  {
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'totalAmount', type: 'uint256' },
      { name: 'exchangeRate', type: 'uint256' },
      { name: 'alipayId', type: 'string' },
      { name: 'alipayName', type: 'string' },
    ],
    name: 'createAndLockOrder',
    outputs: [{ name: 'orderId', type: 'bytes32' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'orderId', type: 'bytes32' },
      { name: 'buyer', type: 'address' },
      { name: 'fillAmount', type: 'uint256' },
    ],
    name: 'fillOrder',
    outputs: [{ name: 'tradeId', type: 'bytes32' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'tradeId', type: 'bytes32' },
      { name: 'proof', type: 'bytes' },
      { name: 'publicInputs', type: 'bytes' },
    ],
    name: 'submitPaymentProof',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'orderId', type: 'bytes32' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'withdrawAmount',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

// Helper to format addresses
export function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Helper to format USDC amounts (6 decimals)
export function formatUSDC(amount: bigint | string): string {
  const amt = typeof amount === 'string' ? BigInt(amount) : amount;
  return (Number(amt) / 1_000_000).toFixed(2);
}

// Helper to format CNY amounts (cents)
export function formatCNY(cents: bigint | string): string {
  const amt = typeof cents === 'string' ? BigInt(cents) : cents;
  return (Number(amt) / 100).toFixed(2);
}

// Helper to parse USDC input (6 decimals)
export function parseUSDC(amount: string): bigint {
  const num = parseFloat(amount);
  return BigInt(Math.floor(num * 1_000_000));
}

