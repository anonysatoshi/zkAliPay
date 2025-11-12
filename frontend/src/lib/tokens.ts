/**
 * Token utilities for multi-token support
 */

export interface TokenInfo {
  symbol: string;
  name: string;
  decimals: number;
  address: string;
}

// Known token addresses (Base Sepolia testnet)
const KNOWN_TOKENS: Record<string, TokenInfo> = {
  // MockUSDC on Base Sepolia
  '0xdfcd0f5ae31008bc94224735a81881d651ab1a8b': {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    address: '0xDFcd0F5AE31008BC94224735a81881d651ab1a8B',
  },
  // MockUSDT on Base Sepolia
  '0x9c607084a30b3e5f222b8f92313c3f75fa12667f': {
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    address: '0x9C607084a30b3E5f222b8f92313c3f75fA12667F',
  },
  // MockSOL on Base Sepolia
  '0x9913854799d1bb4e049cde227156508bb3ba1abf': {
    symbol: 'SOL',
    name: 'Wrapped SOL',
    decimals: 9,
    address: '0x9913854799d1BB4E049CDE227156508bB3bA1AbF',
  },
  // MockBTC on Base Sepolia
  '0x819509cf2a5cd7849399c9a137547731686914ae': {
    symbol: 'BTC',
    name: 'Wrapped BTC',
    decimals: 8,
    address: '0x819509cF2A5CD7849399C9A137547731686914ae',
  },
  // MockETH on Base Sepolia
  '0x9e0cdc73bee1c6b8d99857ffa18b7c02d8ba162f': {
    symbol: 'WETH',
    name: 'Wrapped ETH',
    decimals: 18,
    address: '0x9e0cdc73bEE1C6b8D99857fFA18b7C02D8ba162F',
  },
};

/**
 * List of supported token addresses
 * To add a new token, simply add it to KNOWN_TOKENS above
 */
export const SUPPORTED_TOKENS = Object.values(KNOWN_TOKENS).map(t => t.address);

/**
 * Get token info by address (case-insensitive)
 */
export function getTokenInfo(address: string): TokenInfo {
  const normalized = address.toLowerCase();
  const token = KNOWN_TOKENS[normalized];
  
  if (token) {
    return token;
  }
  
  // Unknown token - return generic info
  return {
    symbol: 'TOKEN',
    name: 'Unknown Token',
    decimals: 18, // Default to 18 decimals (ERC20 standard)
    address: address,
  };
}

/**
 * Get token symbol by address
 */
export function getTokenSymbol(address: string): string {
  return getTokenInfo(address).symbol;
}

/**
 * Get token decimals by address
 */
export function getTokenDecimals(address: string): number {
  return getTokenInfo(address).decimals;
}

/**
 * Format token amount with correct decimals
 */
export function formatTokenAmount(amount: string, tokenAddress: string): string {
  const decimals = getTokenDecimals(tokenAddress);
  const num = parseInt(amount) / Math.pow(10, decimals);
  
  // Display format based on token decimals
  // 6 decimals (USDC/USDT): show 2 decimal places
  // 9 decimals (SOL): show 4 decimal places  
  // 18 decimals (ETH/ERC20): show 4 decimal places
  let displayDecimals = 2;
  if (decimals === 9) {
    displayDecimals = 4;
  } else if (decimals === 18) {
    displayDecimals = 4;
  }
  
  return num.toFixed(displayDecimals);
}

/**
 * Format token amount with symbol
 */
export function formatTokenAmountWithSymbol(amount: string, tokenAddress: string): string {
  const formatted = formatTokenAmount(amount, tokenAddress);
  const symbol = getTokenSymbol(tokenAddress);
  return `${formatted} ${symbol}`;
}

/**
 * Get exchange rate label for a token
 */
export function getExchangeRateLabel(tokenAddress: string): string {
  const symbol = getTokenSymbol(tokenAddress);
  return `CNY/${symbol}`;
}

