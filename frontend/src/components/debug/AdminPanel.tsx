'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { parseContractError } from '@/lib/contractErrors';
import { getTransactionUrl } from '@/lib/contracts';

interface ContractConfig {
  min_trade_value_cny: string;
  max_trade_value_cny: string;
  payment_window: string;
  paused: boolean;
  zk_verifier: string;
  public_key_der_hash: string;
  app_exe_commit: string;
  app_vm_commit: string;
}

export default function AdminPanel() {
  const [config, setConfig] = useState<ContractConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [txHash, setTxHash] = useState('');

  // Form states
  const [minTradeValue, setMinTradeValue] = useState('');
  const [maxTradeValue, setMaxTradeValue] = useState('');
  const [paymentWindow, setPaymentWindow] = useState('');
  const [verifierAddress, setVerifierAddress] = useState('');
  const [publicKeyDerHash, setPublicKeyDerHash] = useState('');
  const [appExeCommit, setAppExeCommit] = useState('');
  const [appVmCommit, setAppVmCommit] = useState('');

  // Loading states
  const [updating, setUpdating] = useState(false);
  const [pauseToggling, setPauseToggling] = useState(false);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const data = await api.getContractConfig();
      setConfig(data);
      setError('');
    } catch (err: any) {
      setError('Failed to fetch contract config: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
    const interval = setInterval(fetchConfig, 10000); // Refresh every 10s from blockchain
    return () => clearInterval(interval);
  }, []);

  const handleUpdateConfig = async () => {
    setUpdating(true);
    setError('');
    setSuccess('');
    setTxHash('');

    try {
      const response = await api.updateConfig(
        minTradeValue ? parseInt(minTradeValue) : undefined,
        maxTradeValue ? parseInt(maxTradeValue) : undefined,
        paymentWindow ? parseInt(paymentWindow) : undefined
      );
      setSuccess(response.message);
      setTxHash(response.tx_hash);
      
      // Clear form
      setMinTradeValue('');
      setMaxTradeValue('');
      setPaymentWindow('');
      
      // Refresh config after 3 seconds (wait for blockchain confirmation)
      setTimeout(fetchConfig, 3000);
    } catch (err: any) {
      const errorMessage = parseContractError(err);
      setError('Failed to update config: ' + errorMessage);
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdateVerifier = async () => {
    setUpdating(true);
    setError('');
    setSuccess('');
    setTxHash('');

    try {
      const response = await api.updateVerifier(verifierAddress);
      setSuccess(response.message);
      setTxHash(response.tx_hash);
      
      // Clear form
      setVerifierAddress('');
      
      setTimeout(fetchConfig, 3000);
    } catch (err: any) {
      const errorMessage = parseContractError(err);
      setError('Failed to update verifier: ' + errorMessage);
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdateZkPDFConfig = async () => {
    setUpdating(true);
    setError('');
    setSuccess('');
    setTxHash('');

    try {
      const response = await api.updateZkPDFConfig(
        publicKeyDerHash,
        appExeCommit,
        appVmCommit
      );
      setSuccess(response.message);
      setTxHash(response.tx_hash);
      
      // Clear form
      setPublicKeyDerHash('');
      setAppExeCommit('');
      setAppVmCommit('');
      
      setTimeout(fetchConfig, 3000);
    } catch (err: any) {
      const errorMessage = parseContractError(err);
      setError('Failed to update zkPDF config: ' + errorMessage);
    } finally {
      setUpdating(false);
    }
  };

  const handleTogglePause = async () => {
    setPauseToggling(true);
    setError('');
    setSuccess('');
    setTxHash('');

    try {
      const response = config?.paused
        ? await api.unpauseContract()
        : await api.pauseContract();
      setSuccess(response.message);
      setTxHash(response.tx_hash);
      
      setTimeout(fetchConfig, 3000);
    } catch (err: any) {
      const errorMessage = parseContractError(err);
      setError(
        'Failed to ' +
          (config?.paused ? 'unpause' : 'pause') +
          ' contract: ' +
          errorMessage
      );
    } finally {
      setPauseToggling(false);
    }
  };

  if (loading && !config) {
    return (
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>🔧 Admin Panel (Relay Wallet)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Loading contract configuration...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>🔧 Admin Panel (Relay Wallet)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Configuration */}
        {config && (
          <div className="bg-muted p-4 rounded-lg space-y-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold text-lg">Current Configuration</h3>
              <span className="text-xs text-muted-foreground">
                🔄 Synced from blockchain (refreshes every 10s)
              </span>
            </div>
            
            {/* Basic Settings */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Min Trade Value (CNY):</span>
                <p className="font-mono font-semibold">
                  {(parseInt(config.min_trade_value_cny) / 100).toFixed(2)} CNY
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Max Trade Value (CNY):</span>
                <p className="font-mono font-semibold">
                  {(parseInt(config.max_trade_value_cny) / 100).toFixed(2)} CNY
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Payment Window:</span>
                <p className="font-mono font-semibold">{config.payment_window} seconds</p>
              </div>
              <div>
                <span className="text-muted-foreground">Contract Status:</span>
                <p
                  className={`font-mono font-semibold ${
                    config.paused ? 'text-red-600' : 'text-green-600'
                  }`}
                >
                  {config.paused ? '⏸ PAUSED' : '✅ ACTIVE'}
                </p>
              </div>
            </div>

            {/* zkPDF Configuration */}
            <div className="border-t pt-4 space-y-3">
              <h4 className="font-semibold text-sm text-muted-foreground">zkPDF Configuration</h4>
              
              <div>
                <span className="text-muted-foreground text-xs">Verifier Contract:</span>
                <p className="font-mono text-xs break-all">{config.zk_verifier}</p>
              </div>
              
              <div>
                <span className="text-muted-foreground text-xs">Public Key DER Hash:</span>
                <p className="font-mono text-xs break-all">{config.public_key_der_hash}</p>
              </div>
              
              <div>
                <span className="text-muted-foreground text-xs">Guest Program Commitment:</span>
                <p className="font-mono text-xs break-all">{config.app_exe_commit}</p>
              </div>
              
              <div>
                <span className="text-muted-foreground text-xs">OpenVM Version Commitment:</span>
                <p className="font-mono text-xs break-all">{config.app_vm_commit}</p>
              </div>
            </div>
          </div>
        )}

        {/* Success/Error Messages */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert className="bg-green-50 text-green-900 border-green-200">
            <AlertDescription>
              <strong>{success}</strong>
              {txHash && (
                <div className="mt-2">
                  <a
                    href={getTransactionUrl(txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline text-xs font-mono"
                  >
                    View TX: {txHash.slice(0, 10)}...{txHash.slice(-8)}
                  </a>
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Update Config Form */}
        <div className="border p-4 rounded-lg space-y-4">
          <h3 className="font-semibold text-lg">Update Contract Configuration</h3>
          <p className="text-sm text-muted-foreground">
            Leave fields empty to keep current values. Values should be:
            <br />• Min/Max CNY: in CNY cents (e.g., 10000 = 100 CNY)
            <br />• Payment Window: in seconds (e.g., 90 = 1.5 minutes)
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="minTradeValue">Min CNY (cents)</Label>
              <Input
                id="minTradeValue"
                type="number"
                placeholder="e.g., 10000 (100 CNY)"
                value={minTradeValue}
                onChange={(e) => setMinTradeValue(e.target.value)}
                disabled={updating}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxTradeValue">Max CNY (cents)</Label>
              <Input
                id="maxTradeValue"
                type="number"
                placeholder="e.g., 500000 (5000 CNY)"
                value={maxTradeValue}
                onChange={(e) => setMaxTradeValue(e.target.value)}
                disabled={updating}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentWindow">Payment Window (sec)</Label>
              <Input
                id="paymentWindow"
                type="number"
                placeholder="e.g., 90"
                value={paymentWindow}
                onChange={(e) => setPaymentWindow(e.target.value)}
                disabled={updating}
              />
            </div>
          </div>
          
          <Button
            onClick={handleUpdateConfig}
            disabled={updating || (!minTradeValue && !maxTradeValue && !paymentWindow)}
          >
            {updating ? 'Updating...' : 'Update Configuration'}
          </Button>
        </div>

        {/* Panel 1: Update Public Key Hash */}
        <div className="border p-4 rounded-lg space-y-4 bg-blue-50/50">
          <h3 className="font-semibold text-lg">📝 Panel 1: Update Public Key Hash</h3>
          <p className="text-sm text-muted-foreground">
            Update the Alipay public key DER hash for PDF signature verification
          </p>
          
          <div className="space-y-2">
            <Label htmlFor="publicKeyDerHash">Public Key DER Hash</Label>
            <Input
              id="publicKeyDerHash"
              type="text"
              placeholder="0x..."
              value={publicKeyDerHash}
              onChange={(e) => setPublicKeyDerHash(e.target.value)}
              disabled={updating}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Extract using: <code className="bg-gray-100 px-1 py-0.5 rounded">cargo run --bin extract_hash</code> in <code className="bg-gray-100 px-1 py-0.5 rounded">sample-pdfs/</code>
            </p>
          </div>
          
          <Button
            onClick={async () => {
              setUpdating(true);
              setError('');
              setSuccess('');
              setTxHash('');

              try {
                const response = await api.updateZkPDFConfig(
                  publicKeyDerHash,
                  config?.app_exe_commit || '',
                  config?.app_vm_commit || ''
                );
                setSuccess('Public key hash updated successfully!');
                setTxHash(response.tx_hash);
                setPublicKeyDerHash('');
                setTimeout(fetchConfig, 3000);
              } catch (err: any) {
                const errorMessage = parseContractError(err);
                setError('Failed to update public key hash: ' + errorMessage);
              } finally {
                setUpdating(false);
              }
            }}
            disabled={updating || !publicKeyDerHash}
            className="w-full"
          >
            {updating ? 'Updating...' : 'Update Public Key Hash'}
          </Button>
        </div>

        {/* Panel 2: Update Verifier & Commitments */}
        <div className="border p-4 rounded-lg space-y-4 bg-purple-50/50">
          <h3 className="font-semibold text-lg">🔐 Panel 2: Update Verifier & Commitments</h3>
          <p className="text-sm text-muted-foreground">
            Update the zkPDF verifier contract address, OpenVM version commitment, and guest program commitment
          </p>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="verifierAddress">Verifier Contract Address</Label>
              <Input
                id="verifierAddress"
                type="text"
                placeholder="0x..."
                value={verifierAddress}
                onChange={(e) => setVerifierAddress(e.target.value)}
                disabled={updating}
                className="font-mono text-xs"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="appVmCommit">OpenVM Version Commitment</Label>
              <Input
                id="appVmCommit"
                type="text"
                placeholder="0x..."
                value={appVmCommit}
                onChange={(e) => setAppVmCommit(e.target.value)}
                disabled={updating}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Get from: <code className="bg-gray-100 px-1 py-0.5 rounded">cargo openvm setup</code> output (VM commitment)
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="appExeCommit">Guest Program Commitment</Label>
              <Input
                id="appExeCommit"
                type="text"
                placeholder="0x..."
                value={appExeCommit}
                onChange={(e) => setAppExeCommit(e.target.value)}
                disabled={updating}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Get from: <code className="bg-gray-100 px-1 py-0.5 rounded">cargo openvm build</code> output (EXE commitment)
              </p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button
              onClick={handleUpdateVerifier}
              disabled={updating || !verifierAddress}
              variant="outline"
              className="flex-1"
            >
              {updating ? 'Updating...' : 'Update Verifier Only'}
            </Button>
            
            <Button
              onClick={async () => {
                setUpdating(true);
                setError('');
                setSuccess('');
                setTxHash('');

                try {
                  const response = await api.updateZkPDFConfig(
                    config?.public_key_der_hash || '',
                    appExeCommit,
                    appVmCommit
                  );
                  setSuccess('Commitments updated successfully!');
                  setTxHash(response.tx_hash);
                  setAppExeCommit('');
                  setAppVmCommit('');
                  setTimeout(fetchConfig, 3000);
                } catch (err: any) {
                  const errorMessage = parseContractError(err);
                  setError('Failed to update commitments: ' + errorMessage);
                } finally {
                  setUpdating(false);
                }
              }}
              disabled={updating || !appExeCommit || !appVmCommit}
              className="flex-1"
            >
              {updating ? 'Updating...' : 'Update Commitments'}
            </Button>
          </div>
        </div>

        {/* Pause/Unpause */}
        <div className="border p-4 rounded-lg space-y-4">
          <h3 className="font-semibold text-lg">Emergency Controls</h3>
          <p className="text-sm text-muted-foreground">
            {config?.paused
              ? 'The contract is currently paused. Click to resume normal operations.'
              : 'Pause the contract to prevent all operations (for emergencies only).'}
          </p>
          
          <Button
            onClick={handleTogglePause}
            disabled={pauseToggling}
            variant={config?.paused ? 'default' : 'destructive'}
          >
            {pauseToggling
              ? 'Processing...'
              : config?.paused
              ? '▶️ Unpause Contract'
              : '⏸ Pause Contract'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

