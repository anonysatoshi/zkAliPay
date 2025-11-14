'use client';

import { useState, useEffect } from 'react';
import { useAccount, useBalance } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useCreateOrder, CreateOrderParams } from '@/hooks/useCreateOrder';
import { getTokenInfo, type TokenInfo, SUPPORTED_TOKENS } from '@/lib/tokens';

export function CreateOrderForm() {
  const { address, isConnected } = useAccount();
  
  const [selectedToken, setSelectedToken] = useState<string>(SUPPORTED_TOKENS[0]);
  const [tokenInfo, setTokenInfo] = useState<TokenInfo>(getTokenInfo(SUPPORTED_TOKENS[0]));
  
  const { data: tokenBalance } = useBalance({
    address: address,
    token: selectedToken as `0x${string}`,
  });

  const [amount, setAmount] = useState('');
  const [exchangeRate, setExchangeRate] = useState('');
  const [alipayId, setAlipayId] = useState('');
  const [alipayName, setAlipayName] = useState('');
  const [orderParams, setOrderParams] = useState<CreateOrderParams | null>(null);

  const {
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
  } = useCreateOrder();

  // Update token info when token selection changes
  useEffect(() => {
    setTokenInfo(getTokenInfo(selectedToken));
  }, [selectedToken]);

  // Handle approval success
  useEffect(() => {
    console.log('Approval status check:', { 
      isApproveSuccess, 
      orderParams: !!orderParams, 
      currentStep 
    });
    
    if (isApproveSuccess && orderParams && currentStep === 'approving') {
      console.log('Approval confirmed! Moving to create order step...');
      handleApprovalSuccess(orderParams);
    }
  }, [isApproveSuccess, orderParams, currentStep, handleApprovalSuccess]);

  // Handle create success
  useEffect(() => {
    console.log('Create status check:', { 
      isCreateSuccess, 
      currentStep 
    });
    
    if (isCreateSuccess && currentStep === 'creating') {
      console.log('Order creation confirmed! Moving to success...');
      handleCreateSuccess();
    }
  }, [isCreateSuccess, currentStep, handleCreateSuccess]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!amount || !exchangeRate || !alipayId || !alipayName) {
      return;
    }

    // Convert exchange rate from human format (7.30) to cents (730)
    const rateInCents = Math.round(parseFloat(exchangeRate) * 100).toString();

    const params: CreateOrderParams = {
      tokenAddress: selectedToken,
      tokenDecimals: tokenInfo.decimals,
      amount,
      exchangeRate: rateInCents,
      alipayId,
      alipayName,
    };

    setOrderParams(params);
    await executeCreateOrder(params);
  };

  const handleMaxClick = () => {
    if (tokenBalance) {
      setAmount(formatUnits(tokenBalance.value, tokenInfo.decimals));
    }
  };

  const calculateCnyAmount = () => {
    if (!amount || !exchangeRate) return '0.00';
    const tokenAmount = parseFloat(amount);
    const rate = parseFloat(exchangeRate);
    return (tokenAmount * rate).toFixed(2);
  };

  const isFormValid = () => {
    if (!amount || !exchangeRate || !alipayId || !alipayName) return false;
    if (parseFloat(amount) <= 0 || parseFloat(exchangeRate) <= 0) return false;
    if (tokenBalance && parseUnits(amount, tokenInfo.decimals) > tokenBalance.value) return false;
    return true;
  };

  if (!isConnected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Create Sell Order</CardTitle>
          <CardDescription>Please connect your wallet to create an order</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Connect your wallet using the button in the top right corner
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (currentStep === 'success') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-6 w-6 text-green-500" />
            Order Created Successfully!
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted p-4 space-y-2">
            <p className="text-sm font-medium">Transaction Hash:</p>
            <p className="text-xs font-mono break-all">{createHash}</p>
          </div>
          <Alert>
            <AlertDescription>
              Your order will appear on the homepage once the transaction is confirmed and synced.
              This usually takes 10-30 seconds.
            </AlertDescription>
          </Alert>
          <Button onClick={() => {
            resetState();
            setAmount('');
            setExchangeRate('');
            setAlipayId('');
            setAlipayName('');
            setOrderParams(null);
          }} className="w-full">
            Create Another Order
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Sell Order</CardTitle>
        <CardDescription>
          Lock your tokens and set your exchange rate to start selling
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Token Selection */}
          <div className="space-y-2">
            <Label htmlFor="token">Select Token</Label>
            <Select
              value={selectedToken}
              onValueChange={(value) => {
                setSelectedToken(value);
                setAmount(''); // Reset amount when token changes
              }}
              disabled={currentStep !== 'idle'}
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

          {/* Token Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">{tokenInfo.symbol} Amount</Label>
            <div className="flex gap-2">
              <Input
                id="amount"
                type="number"
                step="any"
                placeholder="100.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={currentStep !== 'idle'}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleMaxClick}
                disabled={currentStep !== 'idle'}
              >
                Max
              </Button>
            </div>
            {tokenBalance && (
              <p className="text-sm text-muted-foreground">
                Balance: {formatUnits(tokenBalance.value, tokenInfo.decimals)} {tokenInfo.symbol}
              </p>
            )}
          </div>

          {/* Exchange Rate */}
          <div className="space-y-2">
            <Label htmlFor="exchangeRate">Exchange Rate (CNY per {tokenInfo.symbol})</Label>
            <Input
              id="exchangeRate"
              type="number"
              step="0.01"
              placeholder="7.30"
              value={exchangeRate}
              onChange={(e) => setExchangeRate(e.target.value)}
              disabled={currentStep !== 'idle'}
            />
            <p className="text-sm text-muted-foreground">
              You will receive: ¥{calculateCnyAmount()} CNY
            </p>
          </div>

          {/* Alipay ID */}
          <div className="space-y-2">
            <Label htmlFor="alipayId">Your Alipay ID</Label>
            <Input
              id="alipayId"
              type="text"
              placeholder="seller@alipay.cn or phone number"
              value={alipayId}
              onChange={(e) => setAlipayId(e.target.value)}
              disabled={currentStep !== 'idle'}
            />
            <p className="text-sm text-muted-foreground">
              Buyers will send CNY to this Alipay account
            </p>
          </div>

          {/* Alipay Name */}
          <div className="space-y-2">
            <Label htmlFor="alipayName">Your Alipay Name</Label>
            <Input
              id="alipayName"
              type="text"
              placeholder="Wang Jian"
              value={alipayName}
              onChange={(e) => setAlipayName(e.target.value)}
              disabled={currentStep !== 'idle'}
            />
            <p className="text-sm text-muted-foreground">
              Must match the name on your Alipay account
            </p>
          </div>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Transaction Status */}
          {currentStep === 'approving' && (
            <Alert>
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertDescription>
                Step 1/2: Approving {tokenInfo.symbol} spending...
                {approveHash && (
                  <span className="block text-xs mt-1 font-mono">Tx: {approveHash.slice(0, 10)}...</span>
                )}
              </AlertDescription>
            </Alert>
          )}

          {currentStep === 'creating' && (
            <Alert>
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertDescription>
                Step 2/2: Creating and locking order...
                {createHash && (
                  <span className="block text-xs mt-1 font-mono">Tx: {createHash.slice(0, 10)}...</span>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full"
            disabled={!isFormValid() || currentStep !== 'idle'}
          >
            {currentStep === 'idle' && 'Create Order'}
            {currentStep === 'approving' && (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Approving {tokenInfo.symbol}...
              </>
            )}
            {currentStep === 'creating' && (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Order...
              </>
            )}
          </Button>

          {/* Info Box */}
          <Alert>
            <AlertDescription className="text-sm">
              <strong>Note:</strong> You will need to confirm two transactions:
              <ol className="list-decimal list-inside mt-2 space-y-1">
                <li>Approve {tokenInfo.symbol} spending for the escrow contract</li>
                <li>Create and lock your sell order</li>
              </ol>
            </AlertDescription>
          </Alert>
        </form>
      </CardContent>
    </Card>
  );
}

