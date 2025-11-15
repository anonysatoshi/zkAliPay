'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { isAddress } from 'viem';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2, Wallet, TrendingUp, ShieldCheck } from 'lucide-react';
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

  // Check for preselected token from order card click
  useEffect(() => {
    const preselectedToken = sessionStorage.getItem('preselectedToken');
    if (preselectedToken && SUPPORTED_TOKENS.includes(preselectedToken)) {
      console.log('Preselected token from order card:', preselectedToken);
      setSelectedToken(preselectedToken);
      // Clear the session storage after using it
      sessionStorage.removeItem('preselectedToken');
    }
  }, []);

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
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Page Header */}
      <div className="text-center space-y-3">
        <h2 className="text-3xl font-bold tracking-tight">
          {t('title')}
        </h2>
        <p className="text-muted-foreground text-lg">
          {t('description')}
        </p>
      </div>

      {/* Main Card */}
      <Card className="border-2 shadow-xl bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800/50">
        <CardContent className="p-8 space-y-8">
          
          {/* Section 1: Token Selection */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
                1
              </div>
              <h3 className="text-xl font-semibold">{t('section1Title')}</h3>
            </div>
            
            <div className="pl-[52px] space-y-3">
              <label className="text-sm font-medium text-muted-foreground">
                {t('selectToken')}
              </label>
              <Select
                value={selectedToken}
                onValueChange={(value) => {
                  setSelectedToken(value);
                  setAmount(''); // Reset amount when token changes
                }}
                disabled={isLoading}
              >
                <SelectTrigger className="h-14 text-base border-2 hover:border-primary transition-colors">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_TOKENS.map((tokenAddr) => {
                    const info = getTokenInfo(tokenAddr);
                    return (
                      <SelectItem key={tokenAddr} value={tokenAddr} className="text-base py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{info.symbol}</span>
                          <span className="text-muted-foreground">- {info.name}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="border-t"></div>

          {/* Section 2: Amount & Rate */}
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                2
              </div>
              <h3 className="text-xl font-semibold">{t('section2Title')}</h3>
            </div>
            
            <div className="pl-[52px] space-y-6">
              {/* Amount Input */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-muted-foreground">
                  {tokenInfo.symbol} {t('amountLabel')} <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <TrendingUp className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    type="number"
                    placeholder={t('amountPlaceholder')}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={isLoading}
                    step="any"
                    min="0.01"
                    className="h-14 text-base pl-12 border-2 hover:border-primary transition-colors font-semibold"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('amountHelp')}
                </p>
              </div>

              {/* Max Rate Input */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-muted-foreground">
                  {t('maxRate')} <span className="text-xs font-normal">(Optional)</span>
                </label>
                <Input
                  type="number"
                  placeholder={t('maxRatePlaceholder')}
                  value={maxRate}
                  onChange={(e) => setMaxRate(e.target.value)}
                  disabled={isLoading}
                  step="0.01"
                  min="0"
                  className="h-14 text-base border-2 hover:border-primary transition-colors"
                />
                <p className="text-xs text-muted-foreground">
                  {t('maxRateHelp')}
                </p>
              </div>
            </div>
          </div>

          <div className="border-t"></div>

          {/* Section 3: Receiving Address */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-orange-500 flex items-center justify-center text-white font-bold">
                3
              </div>
              <h3 className="text-xl font-semibold">{t('section3Title')}</h3>
            </div>
            
            <div className="pl-[52px] space-y-4">
              <label className="text-sm font-medium text-muted-foreground">
                {t('receiveAt')}
              </label>
              
              {/* Connected Wallet Display */}
              {isConnected && !useManualAddress && (
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-2 border-green-200 dark:border-green-800 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <Wallet className="h-5 w-5 text-green-600" />
                    <div className="flex-1 font-mono text-sm break-all">
                      {address}
                    </div>
                    <span className="text-xs bg-green-200 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded-full font-semibold">
                      {t('connected')}
                    </span>
                  </div>
                </div>
              )}
              
              {/* Checkbox for different address */}
              {isConnected && (
                <div className="flex items-center gap-2 pl-1">
                  <input
                    type="checkbox"
                    id="useManual"
                    checked={useManualAddress}
                    onChange={(e) => setUseManualAddress(e.target.checked)}
                    className="h-4 w-4 cursor-pointer"
                  />
                  <label htmlFor="useManual" className="font-normal cursor-pointer text-sm text-muted-foreground">
                    {t('differentAddress')}
                  </label>
                </div>
              )}
              
              {/* Manual Address Input */}
              {(!isConnected || useManualAddress) && (
                <div className="space-y-3">
                  <div className="relative">
                    <Wallet className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder={t('addressPlaceholder')}
                      value={manualAddress}
                      onChange={(e) => {
                        setManualAddress(e.target.value);
                        if (error && error.includes('address')) {
                          setError(null);
                        }
                      }}
                      disabled={isLoading}
                      className="h-14 text-sm font-mono pl-12 border-2 hover:border-primary transition-colors"
                    />
                  </div>
                  <Alert className="bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800">
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                    <AlertDescription className="text-xs text-yellow-800 dark:text-yellow-200">
                      <strong>Warning:</strong> {t('addressWarning')}
                    </AlertDescription>
                  </Alert>
                </div>
              )}
              
              {/* Helper text */}
              {!isConnected && !manualAddress && (
                <p className="text-xs text-muted-foreground pl-1">
                  {t('addressTip')}
                </p>
              )}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <Alert variant="destructive" className="border-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Submit Button */}
          <Button
            onClick={handleGetMatch}
            disabled={isLoading || (!address && !manualAddress) || !amount}
            className="w-full h-14 text-base bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold shadow-lg"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                {t('finding')}
              </>
            ) : (
              <>
                <ShieldCheck className="mr-2 h-5 w-5" />
                {t('getMatch')}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Info Box */}
      <Card className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 border-2 border-blue-200 dark:border-blue-800">
        <CardContent className="p-6">
          <h4 className="font-semibold text-lg mb-3 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-blue-600" />
            {t('howItWorks')}
          </h4>
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            <li>{t('step1')}</li>
            <li>{t('step2')}</li>
            <li>{t('step3')}</li>
            <li>{t('step4')}</li>
            <li>{t('step5')}</li>
            <li>{t('step6')}</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

