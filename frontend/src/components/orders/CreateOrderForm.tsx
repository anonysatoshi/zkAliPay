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
import { Loader2, CheckCircle2, AlertCircle, ExternalLink, Coins, TrendingUp, User } from 'lucide-react';
import { useCreateOrder, CreateOrderParams } from '@/hooks/useCreateOrder';
import { getTokenInfo, type TokenInfo, SUPPORTED_TOKENS } from '@/lib/tokens';
import { motion } from 'framer-motion';

const BASESCAN_URL = 'https://sepolia.basescan.org/tx';

interface CreateOrderFormProps {
  onSwitchToManage?: () => void;
}

export function CreateOrderForm({ onSwitchToManage }: CreateOrderFormProps = {}) {
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
    if (isApproveSuccess && orderParams && currentStep === 'approving') {
      handleApprovalSuccess(orderParams);
    }
  }, [isApproveSuccess, orderParams, currentStep, handleApprovalSuccess]);

  // Handle create success
  useEffect(() => {
    if (isCreateSuccess && currentStep === 'creating') {
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
      <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-gray-200/50 dark:border-gray-800/50 shadow-xl">
        <CardHeader className="text-center pb-8">
          <div className="mx-auto mb-4 w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center">
            <AlertCircle className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl">Connect Your Wallet</CardTitle>
          <CardDescription className="text-base">
            Please connect your wallet to create a sell order
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30">
            <AlertDescription className="text-center">
              Click the <strong>Connect Wallet</strong> button in the top right corner to get started
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (currentStep === 'success') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-gray-200/50 dark:border-gray-800/50 shadow-xl">
          <CardContent className="pt-12 pb-12 text-center space-y-6">
            {/* Success Icon */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="mx-auto w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center"
            >
              <CheckCircle2 className="h-12 w-12 text-white" />
            </motion.div>

            {/* Success Message */}
            <div>
              <h2 className="text-3xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-green-600 to-emerald-600 dark:from-green-400 dark:to-emerald-400">
                Order Created Successfully!
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Your order is now live on the marketplace
              </p>
            </div>

            {/* Order Details */}
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-2xl p-6 border border-blue-200/50 dark:border-blue-800/50">
              <div className="space-y-3 text-left">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Amount:</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {amount} {tokenInfo.symbol}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Rate:</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    ¥{exchangeRate}/{tokenInfo.symbol}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Total Value:</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    ¥{calculateCnyAmount()} CNY
                  </span>
                </div>
              </div>
            </div>

            {/* Transaction Hash */}
            {createHash && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Transaction Hash:</p>
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
                  <p className="text-xs font-mono break-all text-gray-600 dark:text-gray-400">{createHash}</p>
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => window.open(`${BASESCAN_URL}/${createHash}`, '_blank')}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View on BaseScan
                </Button>
              </div>
            )}

            {/* Info Alert */}
            <Alert className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30">
              <AlertDescription className="text-sm text-center">
                Your order will appear on the homepage once the transaction is confirmed and synced.
                <br />
                <strong>This usually takes 10-30 seconds.</strong>
              </AlertDescription>
            </Alert>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => onSwitchToManage && onSwitchToManage()}
              >
                View My Orders
              </Button>
              <Button
                className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                onClick={() => {
                  resetState();
                  setAmount('');
                  setExchangeRate('');
                  setAlipayId('');
                  setAlipayName('');
                  setOrderParams(null);
                }}
              >
                Create Another Order
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-gray-200/50 dark:border-gray-800/50 shadow-xl">
      <CardHeader>
        <CardTitle className="text-2xl">Create Sell Order</CardTitle>
        <CardDescription className="text-base">
          Lock your tokens and set your exchange rate to start earning
        </CardDescription>
        
        {/* Workflow Description */}
        <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-xl border border-blue-200/50 dark:border-blue-800/50">
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            <strong className="text-blue-600 dark:text-blue-400">How it works:</strong> Lock your crypto in escrow, buyers pay you via Alipay, 
            submit zero-knowledge proof, and receive crypto automatically. Your funds are protected by smart contracts.
          </p>
        </div>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Section 1: What are you selling? */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-4 p-6 bg-gradient-to-br from-gray-50 to-blue-50/30 dark:from-gray-800/50 dark:to-blue-900/10 rounded-2xl border border-gray-200/50 dark:border-gray-700/50"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center text-white font-bold">
                1
              </div>
              <div>
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Coins className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  What are you selling?
                </h3>
              </div>
            </div>

            {/* Token Selection */}
            <div className="space-y-2">
              <Label htmlFor="token">Select Token</Label>
              <Select
                value={selectedToken}
                onValueChange={(value) => {
                  setSelectedToken(value);
                  setAmount('');
                }}
                disabled={currentStep !== 'idle'}
              >
                <SelectTrigger id="token" className="h-12">
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

            {/* Amount Input */}
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
                  className="h-12 text-lg"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleMaxClick}
                  disabled={currentStep !== 'idle'}
                  className="h-12 px-6"
                >
                  Max
                </Button>
              </div>
              {tokenBalance && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Balance: <strong>{formatUnits(tokenBalance.value, tokenInfo.decimals)} {tokenInfo.symbol}</strong>
                </p>
              )}
            </div>
          </motion.div>

          {/* Section 2: Your exchange rate */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-4 p-6 bg-gradient-to-br from-gray-50 to-purple-50/30 dark:from-gray-800/50 dark:to-purple-900/10 rounded-2xl border border-gray-200/50 dark:border-gray-700/50"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold">
                2
              </div>
              <div>
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  Your exchange rate
                </h3>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="exchangeRate">Exchange Rate (CNY per {tokenInfo.symbol})</Label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-lg font-semibold">¥</span>
                <Input
                  id="exchangeRate"
                  type="number"
                  step="0.01"
                  placeholder="7.30"
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(e.target.value)}
                  disabled={currentStep !== 'idle'}
                  className="h-12 text-lg pl-9"
                />
              </div>
              {amount && exchangeRate && (
                <div className="mt-3 p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 rounded-xl border border-green-200/50 dark:border-green-800/50">
                  <p className="text-sm text-gray-600 dark:text-gray-400">You'll receive:</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    ¥{calculateCnyAmount()} <span className="text-base font-normal">CNY</span>
                  </p>
                </div>
              )}
            </div>
          </motion.div>

          {/* Section 3: Your Alipay details */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-4 p-6 bg-gradient-to-br from-gray-50 to-pink-50/30 dark:from-gray-800/50 dark:to-pink-900/10 rounded-2xl border border-gray-200/50 dark:border-gray-700/50"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl flex items-center justify-center text-white font-bold">
                3
              </div>
              <div>
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <User className="h-5 w-5 text-pink-600 dark:text-pink-400" />
                  Your Alipay details
                </h3>
              </div>
            </div>

            {/* Alipay ID */}
            <div className="space-y-2">
              <Label htmlFor="alipayId">Your Alipay ID</Label>
              <Input
                id="alipayId"
                type="text"
                placeholder="11-digit cell number"
                value={alipayId}
                onChange={(e) => setAlipayId(e.target.value)}
                disabled={currentStep !== 'idle'}
                className="h-12"
              />
              <Alert className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
                <AlertDescription className="text-xs">
                  <strong>⚠️ Important:</strong> Only Chinese mainland cell phone numbered Alipay IDs are supported in this beta release.
                  <br />
                  Buyers will send CNY to this Alipay account.
                </AlertDescription>
              </Alert>
            </div>

            {/* Alipay Name */}
            <div className="space-y-2">
              <Label htmlFor="alipayName">Your Alipay Name</Label>
              <Input
                id="alipayName"
                type="text"
                placeholder=""
                value={alipayName}
                onChange={(e) => setAlipayName(e.target.value)}
                disabled={currentStep !== 'idle'}
                className="h-12"
              />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                ℹ️ Must match the name on your Alipay account
              </p>
            </div>
          </motion.div>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Transaction Status */}
          {currentStep === 'approving' && (
            <Alert className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30">
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertDescription>
                <strong>Step 1/2:</strong> Approving {tokenInfo.symbol} spending...
                {approveHash && (
                  <span className="block text-xs mt-1 font-mono">Tx: {approveHash.slice(0, 10)}...</span>
                )}
              </AlertDescription>
            </Alert>
          )}

          {currentStep === 'creating' && (
            <Alert className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30">
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertDescription>
                <strong>Step 2/2:</strong> Creating and locking order...
                {createHash && (
                  <span className="block text-xs mt-1 font-mono">Tx: {createHash.slice(0, 10)}...</span>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full h-14 text-lg bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 shadow-lg hover:shadow-xl transition-all duration-300"
            disabled={!isFormValid() || currentStep !== 'idle'}
          >
            {currentStep === 'idle' && 'Create Order'}
            {currentStep === 'approving' && (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Approving {tokenInfo.symbol}...
              </>
            )}
            {currentStep === 'creating' && (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Creating Order...
              </>
            )}
          </Button>

          {/* Info Box */}
          <Alert className="border-gray-200 dark:border-gray-700">
            <AlertDescription className="text-sm">
              <strong>📋 Note:</strong> You will need to confirm two transactions:
              <ol className="list-decimal list-inside mt-2 space-y-1 ml-2">
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
