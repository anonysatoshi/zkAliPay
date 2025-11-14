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
import { useTranslations } from 'next-intl';

interface AmountInputProps {
  flowData: BuyFlowData;
  updateFlowData: (data: Partial<BuyFlowData>) => void;
  goToNextStep: () => void;
}

export function AmountInput({ flowData, updateFlowData, goToNextStep }: AmountInputProps) {
  const { address, isConnected } = useAccount();
  const t = useTranslations('buy.amountInput');
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
      setError(t('errors.invalidAddress'));
      return;
    }
    
    // Then validate address exists
    if (!buyerAddress) {
      console.log('No address provided');
      setError(t('errors.noAddress'));
      return;
    }
    
    console.log('Address validation passed');

    const amountNum = parseFloat(amount);
    if (!amount || amountNum <= 0) {
      setError(t('errors.invalidAmount'));
      return;
    }

    // Note: Minimum CNY validation is done at the match review stage
    // since the actual CNY amount depends on the matched exchange rate

    if (maxRate) {
      const maxRateNum = parseFloat(maxRate);
      if (maxRateNum <= 0) {
        setError(t('errors.invalidMaxRate'));
        return;
      }
    }
    
    // Confirmation for manual address
    if (useManualAddress || !isConnected) {
      const shortened = `${buyerAddress.slice(0, 6)}...${buyerAddress.slice(-4)}`;
      const confirmMessage = t('errors.confirmAddress')
        .replace('{address}', buyerAddress)
        .replace('{shortened}', shortened);
      
      const confirmed = window.confirm(confirmMessage);
      
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
        const filled = (parseFloat(matchPlan.total_filled) / Math.pow(10, tokenInfo.decimals)).toFixed(2);
        const requested = amountNum.toString();
        const errorMsg = t('errors.partialFill')
          .replace('{filled}', filled)
          .replace('{symbol}', tokenInfo.symbol)
          .replace('{requested}', requested);
        setError(errorMsg);
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
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>
          {t('description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Token Selection */}
        <div className="space-y-2">
          <Label htmlFor="token">{t('selectToken')}</Label>
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
          <Label>{t('receiveAt')}</Label>
          
          {/* Show connected wallet address */}
          {isConnected && !useManualAddress && (
            <div className="flex items-center gap-2">
              <div className="flex-1 font-mono text-sm bg-background p-2 rounded border">
                {address}
              </div>
              <span className="text-xs text-green-600 font-semibold">{t('connected')}</span>
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
                {t('differentAddress')}
              </Label>
            </div>
          )}
          
          {/* Manual address input */}
          {(!isConnected || useManualAddress) && (
            <div className="space-y-2">
              <Input
                type="text"
                placeholder={t('addressPlaceholder')}
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
                  <strong>Warning:</strong> {t('addressWarning')}
                </AlertDescription>
              </Alert>
            </div>
          )}
          
          {/* Helper text */}
          {!isConnected && !manualAddress && (
            <p className="text-xs text-muted-foreground">
              {t('addressTip')}
            </p>
          )}
        </div>

        {/* Amount Input */}
        <div className="space-y-2">
          <Label htmlFor="amount">
            {tokenInfo.symbol} {t('amountLabel')} <span className="text-destructive">{t('required')}</span>
          </Label>
          <Input
            id="amount"
            type="number"
            placeholder={t('amountPlaceholder')}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={isLoading}
            step="any"
            min="0.01"
          />
          <p className="text-xs text-muted-foreground">
            {t('amountHelp')}
          </p>
        </div>

        {/* Max Rate Input (Optional) */}
        <div className="space-y-2">
          <Label htmlFor="maxRate">
            {t('maxRate')}
          </Label>
          <Input
            id="maxRate"
            type="number"
            placeholder={t('maxRatePlaceholder')}
            value={maxRate}
            onChange={(e) => setMaxRate(e.target.value)}
            disabled={isLoading}
            step="0.01"
            min="0"
          />
          <p className="text-xs text-muted-foreground">
            {t('maxRateHelp')}
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
              {t('finding')}
            </>
          ) : (
            t('getMatch')
          )}
        </Button>

        {/* Info Box */}
        <div className="bg-muted p-4 rounded-lg text-sm space-y-2">
          <p className="font-semibold">{t('howItWorks')}</p>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
            <li>{t('step1')}</li>
            <li>{t('step2')}</li>
            <li>{t('step3')}</li>
            <li>{t('step4')}</li>
            <li>{t('step5')}</li>
            <li>{t('step6')}</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}

