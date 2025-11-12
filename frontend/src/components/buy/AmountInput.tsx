'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { isAddress } from 'viem';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { BuyFlowData } from '@/app/buy/page';
import { parseContractError } from '@/lib/contractErrors';
import { getTokenInfo, type TokenInfo, SUPPORTED_TOKENS } from '@/lib/tokens';

interface AmountInputProps {
  flowData: BuyFlowData;
  updateFlowData: (data: Partial<BuyFlowData>) => void;
  goToNextStep: () => void;
}

export function AmountInput({ flowData, updateFlowData, goToNextStep }: AmountInputProps) {
  const { address, isConnected } = useAccount();
  const [selectedToken, setSelectedToken] = useState<string>(SUPPORTED_TOKENS[0]);
  const [tokenInfo, setTokenInfo] = useState<TokenInfo>(getTokenInfo(SUPPORTED_TOKENS[0]));
  const [amount, setAmount] = useState(flowData.amount || '');
  const [maxRate, setMaxRate] = useState(flowData.maxRate || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useManualAddress, setUseManualAddress] = useState(false);
  const [manualAddress, setManualAddress] = useState('');

  // Update token info when token selection changes
  useEffect(() => {
    setTokenInfo(getTokenInfo(selectedToken));
  }, [selectedToken]);

  const handleGetMatch = async () => {
    // Determine which address to use
    // If not connected OR user chose manual, use manual address
    // Otherwise use connected wallet address
    const buyerAddress = (!isConnected || useManualAddress) ? manualAddress : address;
    
    console.log('Validating address:', buyerAddress);
    console.log('isConnected:', isConnected);
    console.log('useManualAddress:', useManualAddress);
    console.log('manualAddress:', manualAddress);
    console.log('connected address:', address);
    
    // Validate address format FIRST (more specific error)
    if (buyerAddress && !isAddress(buyerAddress)) {
      console.log('Address validation failed!');
      setError('This address is not valid. Please enter a valid Ethereum address (42 characters starting with 0x).');
      return;
    }
    
    // Then validate address exists
    if (!buyerAddress) {
      console.log('No address provided');
      setError('Please connect your wallet or enter a receive address');
      return;
    }
    
    console.log('Address validation passed');

    const amountNum = parseFloat(amount);
    if (!amount || amountNum <= 0) {
      setError('Please enter a valid amount greater than 0');
      return;
    }

    // Note: Minimum CNY validation is done at the match review stage
    // since the actual CNY amount depends on the matched exchange rate

    if (maxRate) {
      const maxRateNum = parseFloat(maxRate);
      if (maxRateNum <= 0) {
        setError('Max rate must be greater than 0');
        return;
      }
    }
    
    // Confirmation for manual address
    if (useManualAddress || !isConnected) {
      const shortened = `${buyerAddress.slice(0, 6)}...${buyerAddress.slice(-4)}`;
      const confirmed = window.confirm(
        `⚠️ IMPORTANT: Confirm Receive Address\n\n` +
        `Tokens will be sent to:\n${buyerAddress}\n(${shortened})\n\n` +
        `This address CANNOT be changed later. Please verify it's correct.\n\n` +
        `Click OK to continue or Cancel to go back.`
      );
      
      if (!confirmed) {
        return;
      }
    }

    setError(null);
    setIsLoading(true);

    try {
      console.log('Calling match intent API...', { token: selectedToken, amount, maxRate, buyerAddress });
      
      // Convert amount to wei with token-specific decimals
      const amountWei = (amountNum * Math.pow(10, tokenInfo.decimals)).toString();
      
      // Convert max rate to cents if provided
      const maxRateCents = maxRate ? (parseFloat(maxRate) * 100).toString() : undefined;

      const matchPlan = await api.matchIntent(selectedToken, amountWei, maxRateCents);

      console.log('Match plan received:', matchPlan);

      if (!matchPlan.fully_fillable) {
        setError(
          `Only ${(parseFloat(matchPlan.total_filled) / Math.pow(10, tokenInfo.decimals)).toFixed(2)} ${tokenInfo.symbol} available. ` +
          `Requested ${amountNum} ${tokenInfo.symbol}.`
        );
        setIsLoading(false);
        return;
      }

      // Update flow data and proceed (use buyerAddress instead of address)
      updateFlowData({
        amount,
        maxRate,
        matchPlan,
        buyerAddress,
      });

      goToNextStep();
    } catch (err: any) {
      console.error('Match intent error:', err);
      // Use the contract error decoder to get a human-readable message
      const errorMessage = parseContractError(err);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Enter Buy Order Info</CardTitle>
        <CardDescription>
          Select token and specify how much you want to buy with CNY via Alipay
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Token Selection */}
        <div className="space-y-2">
          <Label htmlFor="token">Select Token</Label>
          <Select
            value={selectedToken}
            onValueChange={(value) => {
              setSelectedToken(value);
              setAmount(''); // Reset amount when token changes
            }}
            disabled={isLoading}
          >
            <SelectTrigger id="token">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_TOKENS.map((tokenAddr) => {
                const info = getTokenInfo(tokenAddr);
                return (
                  <SelectItem key={tokenAddr} value={tokenAddr}>
                    {info.symbol} - {info.name}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {/* Address Selection */}
        <div className="space-y-3 border rounded-lg p-4 bg-muted/50">
          <Label>Receive Tokens At:</Label>
          
          {/* Show connected wallet address */}
          {isConnected && !useManualAddress && (
            <div className="flex items-center gap-2">
              <div className="flex-1 font-mono text-sm bg-background p-2 rounded border">
                {address}
              </div>
              <span className="text-xs text-green-600 font-semibold">✓ Connected</span>
            </div>
          )}
          
          {/* Checkbox to use different address */}
          {isConnected && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="useManual"
                checked={useManualAddress}
                onChange={(e) => setUseManualAddress(e.target.checked)}
                className="h-4 w-4 cursor-pointer"
              />
              <Label htmlFor="useManual" className="font-normal cursor-pointer text-sm">
                Send to a different address
              </Label>
            </div>
          )}
          
          {/* Manual address input */}
          {(!isConnected || useManualAddress) && (
            <div className="space-y-2">
              <Input
                type="text"
                placeholder="0x... (Ethereum address)"
                value={manualAddress}
                onChange={(e) => {
                  setManualAddress(e.target.value);
                  // Clear error when user starts typing
                  if (error && error.includes('address')) {
                    setError(null);
                  }
                }}
                disabled={isLoading}
                className="font-mono text-sm"
              />
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <strong>Warning:</strong> Double-check this address! Tokens will be sent here after payment. 
                  Funds sent to wrong address cannot be recovered.
                </AlertDescription>
              </Alert>
            </div>
          )}
          
          {/* Helper text */}
          {!isConnected && !manualAddress && (
            <p className="text-xs text-muted-foreground">
              💡 Tip: You can connect your wallet or enter any Ethereum address to receive tokens
            </p>
          )}
        </div>

        {/* Amount Input */}
        <div className="space-y-2">
          <Label htmlFor="amount">
            {tokenInfo.symbol} Amount <span className="text-destructive">*</span>
          </Label>
          <Input
            id="amount"
            type="number"
            placeholder="100"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={isLoading}
            step="any"
            min="0.01"
          />
          <p className="text-xs text-muted-foreground">
            Enter the amount of {tokenInfo.symbol} you want to purchase. Minimum trade limits will be validated based on the CNY amount after matching.
          </p>
        </div>

        {/* Max Rate Input (Optional) */}
        <div className="space-y-2">
          <Label htmlFor="maxRate">
            Maximum Exchange Rate (Optional)
          </Label>
          <Input
            id="maxRate"
            type="number"
            placeholder="7.50"
            value={maxRate}
            onChange={(e) => setMaxRate(e.target.value)}
            disabled={isLoading}
            step="0.01"
            min="0"
          />
          <p className="text-xs text-muted-foreground">
            Only match with orders at or below this rate (CNY per {tokenInfo.symbol})
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Get Match Button */}
        <Button
          onClick={handleGetMatch}
          disabled={isLoading || (!address && !manualAddress) || !amount}
          className="w-full"
          size="lg"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Finding Best Match...
            </>
          ) : (
            'Get Match'
          )}
        </Button>

        {/* Info Box */}
        <div className="bg-muted p-4 rounded-lg text-sm space-y-2">
          <p className="font-semibold">How it works:</p>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
            <li>Select the token you want to buy</li>
            <li>Enter the amount you want to purchase</li>
            <li>We'll match you with the best exchange rates</li>
            <li>Review the match plan and confirm</li>
            <li>Send CNY via Alipay to the seller</li>
            <li>Submit payment proof and receive tokens!</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}

