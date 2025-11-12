'use client';

import { useSellerOrders } from '@/hooks/useSellerOrders';
import { useWithdraw } from '@/hooks/useWithdraw';
import { formatAddress, getTransactionUrl } from '@/lib/contracts';
import { getTokenInfo, formatTokenAmount, getExchangeRateLabel } from '@/lib/tokens';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2, Loader2, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { Order } from '@/lib/api';

type OrderView = 'active' | 'completed';

export function MyOrders() {
  const { data: orders, isLoading, error: fetchError, refetch } = useSellerOrders();
  const {
    executeWithdraw,
    resetState,
    currentStep,
    isWithdrawing,
    error: withdrawError,
    txHash,
  } = useWithdraw();

  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [withdrawAmounts, setWithdrawAmounts] = useState<Record<string, string>>({});
  const [view, setView] = useState<OrderView>('active');

  const handleWithdraw = (orderId: string, tokenAddress: string, tokenDecimals: number) => {
    const amount = withdrawAmounts[orderId];
    if (!amount || parseFloat(amount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    setSelectedOrder(orderId);
    executeWithdraw({ orderId, amount, tokenAddress, tokenDecimals });
  };

  const handleSuccess = () => {
    setWithdrawAmounts({});
    setSelectedOrder(null);
    resetState();
    // Refetch orders to show updated remaining amounts
    refetch();
  };

  const setWithdrawAmount = (orderId: string, amount: string) => {
    setWithdrawAmounts(prev => ({ ...prev, [orderId]: amount }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading your orders...</span>
      </div>
    );
  }

  if (fetchError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Failed to load orders. Please try again.</AlertDescription>
      </Alert>
    );
  }

  // Separate active and completed orders
  const activeOrders = orders?.filter((order: Order) => {
    const tokenInfo = getTokenInfo(order.token);
    const remaining = parseFloat(formatTokenAmount(order.remaining_amount, order.token));
    return remaining > 0;
  }) || [];
  
  const completedOrders = orders?.filter((order: Order) => {
    const tokenInfo = getTokenInfo(order.token);
    const remaining = parseFloat(formatTokenAmount(order.remaining_amount, order.token));
    return remaining === 0;
  }) || [];
  
  // Determine which orders to display based on current view
  const displayedOrders = view === 'active' ? activeOrders : completedOrders;

  if (!orders || orders.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">
            You don't have any orders. Create one to get started!
          </p>
        </CardContent>
      </Card>
    );
  }

  const renderOrderCard = (order: Order) => {
        const tokenInfo = getTokenInfo(order.token);
        const remainingAmount = formatTokenAmount(order.remaining_amount, order.token);
        const totalAmount = formatTokenAmount(order.total_amount, order.token);
        const exchangeRate = parseFloat(order.exchange_rate) / 100;
        const estimatedCNY = parseFloat(remainingAmount) * exchangeRate;
        const withdrawAmount = withdrawAmounts[order.order_id] || '';
        const isCompleted = view === 'completed';

        return (
          <Card key={order.order_id} className={isCompleted ? 'opacity-70' : ''}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-mono">
                    Order: {formatAddress(order.order_id)}
                  </CardTitle>
                  <CardDescription>
                    Created {new Date(order.created_at * 1000).toLocaleString()}
                  </CardDescription>
                </div>
                {isCompleted && (
                  <div className="flex items-center text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Completed
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Order Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Total Locked</p>
                  <p className="font-semibold">{totalAmount} {tokenInfo.symbol}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Remaining</p>
                  <p className="font-semibold text-green-600">
                    {remainingAmount} {tokenInfo.symbol}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Exchange Rate</p>
                  <p className="font-semibold">{exchangeRate.toFixed(2)} {getExchangeRateLabel(order.token)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Est. CNY Value</p>
                  <p className="font-semibold">¥{estimatedCNY.toFixed(2)}</p>
                </div>
              </div>

              {/* Withdraw Section */}
              {!isCompleted && parseFloat(remainingAmount) > 0 && (
                <div className="pt-4 border-t space-y-3">
                  <Label htmlFor={`withdraw-${order.order_id}`}>
                    Withdraw Amount ({tokenInfo.symbol})
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id={`withdraw-${order.order_id}`}
                      type="number"
                      placeholder="0.00"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(order.order_id, e.target.value)}
                      max={remainingAmount}
                      step="any"
                      disabled={isWithdrawing}
                    />
                    <Button
                      variant="outline"
                      onClick={() => setWithdrawAmount(order.order_id, remainingAmount)}
                      disabled={isWithdrawing}
                    >
                      Max
                    </Button>
                    <Button
                      onClick={() => handleWithdraw(order.order_id, order.token, tokenInfo.decimals)}
                      disabled={
                        isWithdrawing ||
                        !withdrawAmount ||
                        parseFloat(withdrawAmount) <= 0 ||
                        parseFloat(withdrawAmount) > parseFloat(remainingAmount)
                      }
                    >
                      {isWithdrawing && selectedOrder === order.order_id ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Withdrawing...
                        </>
                      ) : (
                        'Withdraw'
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Available: {remainingAmount} {tokenInfo.symbol}
                  </p>
                </div>
              )}

              {/* No funds available */}
              {isCompleted && (
                <div className="pt-4 border-t">
                  <Alert>
                    <AlertDescription>
                      All funds from this order have been withdrawn or filled.
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </CardContent>
          </Card>
        );
  };

  return (
    <div className="space-y-6">
      {/* Success Message */}
      {currentStep === 'success' && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              Withdrawal successful!{' '}
              {txHash && (
                <a
                  href={getTransactionUrl(txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline inline-flex items-center"
                >
                  View on Explorer <ExternalLink className="ml-1 h-3 w-3" />
                </a>
              )}
            </span>
            <Button onClick={handleSuccess} size="sm" variant="outline">
              OK
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Error Message */}
      {withdrawError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{withdrawError}</AlertDescription>
        </Alert>
      )}

      {/* Toggle Buttons */}
      <div className="flex gap-2 border-b">
        <Button
          variant={view === 'active' ? 'default' : 'ghost'}
          onClick={() => setView('active')}
          className="rounded-b-none"
        >
          Active Orders
          {activeOrders.length > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-primary-foreground text-primary">
              {activeOrders.length}
            </span>
          )}
        </Button>
        <Button
          variant={view === 'completed' ? 'default' : 'ghost'}
          onClick={() => setView('completed')}
          className="rounded-b-none"
        >
          Completed Orders
          {completedOrders.length > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-primary-foreground text-primary">
              {completedOrders.length}
            </span>
          )}
        </Button>
      </div>

      {/* Orders Display */}
      <div className="space-y-4">
        {displayedOrders.length === 0 ? (
          <Alert>
            <AlertDescription>
              {view === 'active' 
                ? "You have no active orders. All your orders have been completed or you haven't created any yet."
                : "You have no completed orders yet."}
            </AlertDescription>
          </Alert>
        ) : (
          displayedOrders.map((order: Order) => renderOrderCard(order))
        )}
      </div>
    </div>
  );
}

