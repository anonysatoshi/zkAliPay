'use client';

import { useEffect, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getTransactionUrl } from '@/lib/contracts';
import { formatTokenAmountWithSymbol, getExchangeRateLabel, getTokenSymbol } from '@/lib/tokens';

interface DbOrder {
  order_id: string;
  seller: string;
  token: string;
  total_amount: string;
  remaining_amount: string;
  exchange_rate: string;
  alipay_id: string;
  alipay_name: string;
  created_at: number;
  synced_at: string;
}

interface DbTrade {
  trade_id: string;
  order_id: string;
  buyer: string;
  token_amount: string;
  cny_amount: string;
  payment_nonce: string;
  created_at: number;
  expires_at: number;
  status: number; // 0=PENDING, 1=SETTLED, 2=EXPIRED
  synced_at: string;
  escrow_tx_hash: string | null;
  settlement_tx_hash: string | null;
  pdf_filename?: string | null;
  pdf_uploaded_at?: string | null;
  axiom_proof_id?: string | null;
  proof_generated_at?: string | null;
  proof_json?: string | null;  // Full proof JSON
}

interface DatabaseDump {
  orders: DbOrder[];
  trades: DbTrade[];
}

function formatAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatCnyAmount(amount: string): string {
  const num = parseInt(amount) / 100; // CNY in cents
  return `¥${num.toFixed(2)}`;
}

function formatExchangeRate(rate: string): string {
  const num = parseInt(rate) / 100; // Rate in cents
  return num.toFixed(2);
}

function formatTimestamp(ts: number): string {
  return new Date(ts * 1000).toLocaleString();
}

function getTradeStatus(status: number): string {
  switch (status) {
    case 0: return 'PENDING';
    case 1: return 'SETTLED';
    case 2: return 'EXPIRED';
    default: return 'UNKNOWN';
  }
}

export default function DatabaseViewer() {
  const [data, setData] = useState<DatabaseDump | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const response = await fetch(`${API_URL}/api/debug/database`);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        setData(result);
        setError(null);
        setLastUpdate(new Date());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch database');
        console.error('Database fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    // Initial fetch
    fetchData();

    // Auto-refresh every 5 seconds
    const interval = setInterval(fetchData, 5000);

    return () => clearInterval(interval);
  }, []);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-lg">Loading database...</div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-lg text-red-500">Error: {error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-lg">No data available</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Database Debug Panel</h1>
        <div className="text-sm text-muted-foreground">
          Last updated: {lastUpdate.toLocaleTimeString()}
          {error && <span className="ml-2 text-red-500">({error})</span>}
        </div>
      </div>

      {/* Orders Table */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">
          Orders ({data.orders.length})
        </h2>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                <TableHead>Seller</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Remaining</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Alipay</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No orders found
                  </TableCell>
                </TableRow>
              ) : (
                data.orders.map((order) => (
                  <TableRow key={order.order_id}>
                    <TableCell className="font-mono text-xs">
                      {formatAddress(order.order_id)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {formatAddress(order.seller)}
                    </TableCell>
                    <TableCell>{formatTokenAmountWithSymbol(order.total_amount, order.token)}</TableCell>
                    <TableCell className="font-semibold">
                      {formatTokenAmountWithSymbol(order.remaining_amount, order.token)}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {formatExchangeRate(order.exchange_rate)}
                        <div className="text-xs text-muted-foreground">{getExchangeRateLabel(order.token)}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="font-medium">{order.alipay_name}</div>
                        <div className="text-muted-foreground">{order.alipay_id}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {formatTimestamp(order.created_at)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Trades Table */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">
          Trades ({data.trades.length})
        </h2>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Trade ID</TableHead>
                <TableHead>Order ID</TableHead>
                <TableHead>Buyer</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>CNY Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Nonce</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Escrow Tx</TableHead>
                <TableHead>Settlement Tx</TableHead>
                <TableHead>Proof</TableHead>
                <TableHead>PDF</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.trades.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center text-muted-foreground">
                    No trades found
                  </TableCell>
                </TableRow>
              ) : (
                data.trades.map((trade) => {
                  // Find the order for this trade to get token info
                  const order = data.orders.find(o => o.order_id === trade.order_id);
                  const tokenAddress = order?.token || '0x0000000000000000000000000000000000000000';
                  
                  return (
                  <TableRow key={trade.trade_id}>
                    <TableCell className="font-mono text-xs">
                      {formatAddress(trade.trade_id)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {formatAddress(trade.order_id)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {formatAddress(trade.buyer)}
                    </TableCell>
                    <TableCell>{formatTokenAmountWithSymbol(trade.token_amount, tokenAddress)}</TableCell>
                    <TableCell>{formatCnyAmount(trade.cny_amount)}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                        trade.status === 0 ? 'bg-yellow-100 text-yellow-800' :
                        trade.status === 1 ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {getTradeStatus(trade.status)}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-sm font-semibold">
                      {trade.payment_nonce}
                    </TableCell>
                    <TableCell className="text-xs">
                      {formatTimestamp(trade.expires_at)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {trade.escrow_tx_hash ? (
                        <a
                          href={getTransactionUrl(trade.escrow_tx_hash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline flex items-center gap-1"
                        >
                          {formatAddress(trade.escrow_tx_hash)}
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {trade.settlement_tx_hash ? (
                        <a
                          href={getTransactionUrl(trade.settlement_tx_hash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline flex items-center gap-1"
                        >
                          {formatAddress(trade.settlement_tx_hash)}
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      {trade.proof_json ? (
                        <button
                          onClick={() => {
                            window.open(
                              `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/trades/${trade.trade_id}/proof`,
                              '_blank'
                            );
                          }}
                          className="text-primary hover:underline flex items-center gap-1 text-xs"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          Download
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {trade.pdf_filename ? (
                        <a
                          href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/trades/${trade.trade_id}/pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline flex items-center gap-1 text-xs"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          View PDF
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

