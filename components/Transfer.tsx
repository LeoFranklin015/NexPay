'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { transfer, simulateTransfer, isInitialized } from '@/lib/nexus';
import type { TransferParams, TransferResult, SimulationResult } from '@avail-project/nexus-core';

// Supported tokens and chains based on actual SDK data
const SUPPORTED_TOKENS = [
  { value: 'ETH', label: 'ETH', icon: 'https://coin-images.coingecko.com/coins/images/279/large/ethereum.png' },
  { value: 'USDC', label: 'USDC', icon: 'https://coin-images.coingecko.com/coins/images/6319/large/usdc.png' },
  { value: 'USDT', label: 'USDT', icon: 'https://coin-images.coingecko.com/coins/images/35023/large/USDT.png' },
  { value: 'MON', label: 'MON', icon: 'https://assets.coingecko.com/coins/images/38927/large/monad.jpg' },
  { value: 'POL', label: 'POL', icon: 'https://coin-images.coingecko.com/coins/images/32440/standard/polygon.png' },
] as const;

const SUPPORTED_CHAINS = [
  { value: 1, label: 'Ethereum', logo: 'https://assets.coingecko.com/asset_platforms/images/279/large/ethereum.png' },
  { value: 8453, label: 'Base', logo: 'https://assets.coingecko.com/asset_platforms/images/131/large/base-network.png' },
  { value: 137, label: 'Polygon', logo: 'https://assets.coingecko.com/asset_platforms/images/15/large/polygon_pos.png' },
  { value: 42161, label: 'Arbitrum', logo: 'https://assets.coingecko.com/coins/images/16547/large/arb.jpg' },
  { value: 10, label: 'Optimism', logo: 'https://assets.coingecko.com/coins/images/25244/large/Optimism.png' },
  { value: 324, label: 'zkSync Era', logo: 'https://assets.coingecko.com/coins/images/22925/large/zksync.png' },
] as const;

interface TransferComponentProps {
  className?: string;
  balances?: any[];
  onTransferComplete?: (result: TransferResult) => void;
  onSimulationComplete?: (result: SimulationResult) => void;
}

export default function TransferComponent({ 
  className = '', 
  balances = [],
  onTransferComplete,
  onSimulationComplete 
}: TransferComponentProps) {
  const { isConnected, address } = useAccount();
  const [isLoading, setIsLoading] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [transferResult, setTransferResult] = useState<TransferResult | null>(null);

  // Form state
  const [formData, setFormData] = useState<TransferParams>({
    token: 'USDC',
    amount: '',
    chainId: 8453, // Default to Base mainnet
    recipient: '' as `0x${string}`,
    sourceChains: [],
  });

  const handleInputChange = (field: keyof TransferParams, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: field === 'amount' ? String(value) : value
    }));
    setError(null);
    setSuccess(null);
  };

  const handleSourceChainToggle = (chainId: number) => {
    setFormData(prev => ({
      ...prev,
      sourceChains: prev.sourceChains?.includes(chainId)
        ? prev.sourceChains.filter(id => id !== chainId)
        : [...(prev.sourceChains || []), chainId]
    }));
  };

  const validateForm = (): string | null => {
    if (!isConnected) {
      return 'Please connect your wallet first';
    }
    if (!isInitialized()) {
      return 'Please initialize the Nexus SDK first';
    }
    if (!formData.amount || parseFloat(String(formData.amount)) <= 0) {
      return 'Please enter a valid amount';
    }
    if (!formData.recipient || !/^0x[a-fA-F0-9]{40}$/.test(formData.recipient)) {
      return 'Please enter a valid Ethereum address';
    }
    return null;
  };

  const handleSimulate = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSimulating(true);
    setError(null);
    setSimulationResult(null);

    try {
      const params: TransferParams = {
        ...formData,
        amount: parseFloat(String(formData.amount)),
        recipient: formData.recipient as `0x${string}`,
      };

      const result = await simulateTransfer(params);
      setSimulationResult(result);
      onSimulationComplete?.(result);
      setSuccess('Simulation completed successfully!');
    } catch (err: any) {
      setError(err.message || 'Simulation failed');
    } finally {
      setIsSimulating(false);
    }
  };

  const handleTransfer = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);
    setError(null);
    setTransferResult(null);

    try {
      const params: TransferParams = {
        ...formData,
        amount: parseFloat(String(formData.amount)),
        recipient: formData.recipient as `0x${string}`,
      };

      const result = await transfer(params);
      setTransferResult(result);
      onTransferComplete?.(result);
      
      if (result.success) {
        setSuccess(`Transfer successful! Transaction: ${result.transactionHash}`);
      } else {
        setError(result.error);
      }
    } catch (err: any) {
      setError(err.message || 'Transfer failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to get balance for a specific token
  const getTokenBalance = (tokenSymbol: string) => {
    if (!balances || !Array.isArray(balances)) {
      return null;
    }
    const token = balances.find(b => b.symbol === tokenSymbol);
    return token ? {
      balance: parseFloat(token.balance),
      balanceInFiat: token.balanceInFiat,
      breakdown: token.breakdown
    } : null;
  };

  const buttonClasses = "px-4 py-2 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const inputClasses = "w-full px-3 py-2 bg-gray-900 border border-gray-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400";
  const labelClasses = "block text-sm font-medium text-white mb-1";

  return (
    <div className={`max-w-2xl mx-auto p-6 bg-black border border-gray-800 rounded-lg shadow-2xl ${className}`}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">Transfer Tokens</h2>
        <p className="text-gray-300">
          Use the Nexus SDK to transfer tokens across multiple chains with automatic optimization.
        </p>
      </div>

      {/* Status Indicators */}
      <div className="mb-6 p-4 bg-gray-900 border border-gray-700 rounded-lg">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium text-white">Wallet:</span>
            <span className={`ml-2 ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
              {isConnected ? 'Connected' : 'Not Connected'}
            </span>
          </div>
          <div>
            <span className="font-medium text-white">Nexus SDK:</span>
            <span className={`ml-2 ${isInitialized() ? 'text-green-400' : 'text-red-400'}`}>
              {isInitialized() ? 'Initialized' : 'Not Initialized'}
            </span>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="space-y-4">
        {/* Token Selection */}
        <div>
          <label className={labelClasses}>Token</label>
          <div className="space-y-2">
            <select
              value={formData.token}
              onChange={(e) => handleInputChange('token', e.target.value)}
              className={inputClasses}
            >
              {SUPPORTED_TOKENS.map(token => {
                const tokenBalance = getTokenBalance(token.value);
                return (
                  <option key={token.value} value={token.value}>
                    {token.label} {tokenBalance ? `(${tokenBalance.balance.toFixed(6)} - $${tokenBalance.balanceInFiat.toFixed(2)})` : ''}
                  </option>
                );
              })}
            </select>
            {(() => {
              const selectedTokenBalance = getTokenBalance(formData.token);
              return selectedTokenBalance && selectedTokenBalance.balance > 0 ? (
                <div className="p-4 bg-gray-900 border border-green-500 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <img src={SUPPORTED_TOKENS.find(t => t.value === formData.token)?.icon} alt={formData.token} className="w-6 h-6" />
                      <span className="font-medium text-green-400">
                        Available: {selectedTokenBalance.balance.toFixed(6)} {formData.token}
                      </span>
                    </div>
                    <span className="text-green-300 font-medium">
                      ${selectedTokenBalance.balanceInFiat.toFixed(2)}
                    </span>
                  </div>
                  <div className="mt-3 text-sm text-gray-300">
                    <div className="font-medium mb-2 text-white">Balance breakdown by chain:</div>
                    <div className="space-y-2">
                      {selectedTokenBalance.breakdown
                        .filter((chain: any) => parseFloat(chain.balance) > 0)
                        .map((chain: any) => (
                          <div key={chain.chain.id} className="flex items-center justify-between bg-gray-800 p-2 rounded">
                            <div className="flex items-center space-x-2">
                              <img src={chain.chain.logo} alt={chain.chain.name} className="w-4 h-4" />
                              <span className="text-white">{chain.chain.name}</span>
                            </div>
                            <span className="text-gray-300">{parseFloat(chain.balance).toFixed(6)} {formData.token}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              ) : null;
            })()}
          </div>
        </div>

        {/* Amount */}
        <div>
          <label className={labelClasses}>Amount</label>
          <div className="flex space-x-2">
            <input
              type="number"
              step="0.000001"
              value={formData.amount}
              onChange={(e) => handleInputChange('amount', e.target.value)}
              placeholder="Enter amount to transfer"
              className={`${inputClasses} flex-1`}
            />
            {(() => {
              const selectedTokenBalance = getTokenBalance(formData.token);
              return selectedTokenBalance && selectedTokenBalance.balance > 0 ? (
                <button
                  type="button"
                  onClick={() => handleInputChange('amount', selectedTokenBalance.balance.toString())}
                  className="px-3 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition-colors text-sm font-medium border border-gray-600"
                >
                  Max
                </button>
              ) : null;
            })()}
          </div>
        </div>

        {/* Destination Chain */}
        <div>
          <label className={labelClasses}>Destination Chain</label>
          <select
            value={formData.chainId}
            onChange={(e) => handleInputChange('chainId', parseInt(e.target.value))}
            className={inputClasses}
          >
            {SUPPORTED_CHAINS.map(chain => (
              <option key={chain.value} value={chain.value}>
                {chain.label} ({chain.value})
              </option>
            ))}
          </select>
        </div>

        {/* Recipient Address */}
        <div>
          <label className={labelClasses}>Recipient Address</label>
          <input
            type="text"
            value={formData.recipient}
            onChange={(e) => handleInputChange('recipient', e.target.value)}
            placeholder="0x..."
            className={inputClasses}
          />
        </div>

        {/* Source Chains (Optional) */}
        <div>
          <label className={labelClasses}>Source Chains (Optional)</label>
          <p className="text-sm text-gray-400 mb-3">
            Select specific chains to source funds from. Leave empty to use all available chains.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {SUPPORTED_CHAINS.map(chain => {
              const isSelected = formData.sourceChains?.includes(chain.value) || false;
              return (
                <label 
                  key={chain.value} 
                  className={`flex items-center space-x-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                    isSelected 
                      ? 'border-blue-500 bg-gray-800' 
                      : 'border-gray-700 hover:border-gray-600 bg-gray-900'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleSourceChainToggle(chain.value)}
                    className="rounded border-gray-600 text-blue-500 focus:ring-blue-500 bg-gray-800"
                  />
                  <img src={chain.logo} alt={chain.label} className="w-6 h-6" />
                  <div className="flex-1">
                    <div className="font-medium text-sm text-white">{chain.label}</div>
                    <div className="text-xs text-gray-400">ID: {chain.value}</div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-6 flex space-x-4">
        <button
          onClick={handleSimulate}
          disabled={isSimulating || isLoading}
          className={`${buttonClasses} bg-gray-800 text-white hover:bg-gray-700 border border-gray-600`}
        >
          {isSimulating ? 'Simulating...' : 'Simulate Transfer'}
        </button>
        <button
          onClick={handleTransfer}
          disabled={isLoading || isSimulating}
          className={`${buttonClasses} bg-blue-600 text-white hover:bg-blue-700 border border-blue-500`}
        >
          {isLoading ? 'Transferring...' : 'Transfer'}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-4 p-4 bg-red-900 border border-red-500 rounded-md">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-400">Error</h3>
              <div className="mt-2 text-sm text-red-300">{error}</div>
            </div>
          </div>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="mt-4 p-4 bg-green-900 border border-green-500 rounded-md">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-green-400">Success</h3>
              <div className="mt-2 text-sm text-green-300">{success}</div>
            </div>
          </div>
        </div>
      )}

      {/* Simulation Results */}
      {simulationResult && (
        <div className="mt-6 p-4 bg-gray-900 border border-blue-500 rounded-md">
          <h3 className="text-lg font-medium text-blue-400 mb-3">Simulation Results</h3>
          <div className="space-y-2 text-sm">
            <div>
              <span className="font-medium text-white">Fees:</span>
              <pre className="mt-1 p-2 bg-black rounded border border-gray-700 text-xs overflow-auto text-gray-300">
                {JSON.stringify(simulationResult.intent?.fees, null, 2)}
              </pre>
            </div>
            <div>
              <span className="font-medium text-white">Optimization Path:</span>
              <p className="text-blue-300">
                {simulationResult.intent?.fees?.gasSupplied 
                  ? 'Direct transfer will be used (faster, cheaper)'
                  : 'Chain abstraction will be used (sources from multiple chains)'
                }
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Results */}
      {transferResult && (
        <div className="mt-6 p-4 bg-gray-900 border border-green-500 rounded-md">
          <h3 className="text-lg font-medium text-green-400 mb-3">Transfer Results</h3>
          {transferResult.success ? (
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium text-white">Transaction Hash:</span>
                <a 
                  href={transferResult.explorerUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="ml-2 text-blue-400 hover:underline"
                >
                  {transferResult.transactionHash}
                </a>
              </div>
              <div>
                <span className="font-medium text-white">Explorer:</span>
                <a 
                  href={transferResult.explorerUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="ml-2 text-blue-400 hover:underline"
                >
                  View on Explorer
                </a>
              </div>
            </div>
          ) : (
            <div className="text-red-300">
              <span className="font-medium">Error:</span> {transferResult.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
