'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { parseUnits } from 'viem';
import { transfer, getUnifiedBalances, isInitialized } from '@/lib/nexus';
import type { TransferParams } from '@avail-project/nexus-core';

// Supported chains for Case 1 (Nexus-supported chains only)
const CHAINS = [
  { value: 11155111, label: 'Ethereum Sepolia' },
  { value: 84532, label: 'Base Sepolia' },
  { value: 421614, label: 'Arbitrum Sepolia' },
  { value: 80002, label: 'Polygon Amoy' },
];

// Supported tokens
const TOKENS = [
  { value: 'USDC', label: 'USDC', decimals: 6 },
  { value: 'USDT', label: 'USDT', decimals: 6 },
  { value: 'ETH', label: 'ETH', decimals: 18 },
  { value: 'MON', label: 'MON', decimals: 18 },
];

interface PaymentResult {
  success: boolean;
  message: string;
  data?: any;
}

export default function TestComponent() {
  const { address, isConnected } = useAccount();
  
  const [sourceChain, setSourceChain] = useState<number | null>(null); // Optional: let user choose or leave empty
  const [destinationChain, setDestinationChain] = useState<number>(11155111); // Sepolia
  const [token, setToken] = useState('USDC');
  const [amount, setAmount] = useState('1');
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PaymentResult | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [balances, setBalances] = useState<any>(null);

  const handleTransfer = async () => {
    if (!address || !isConnected) {
      setError('Please connect your wallet first');
      return;
    }

    if (!isInitialized()) {
      setError('Nexus SDK not initialized');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const params: TransferParams = {
        token: token as any,
        amount: amount, // Use decimal string, not wei
        chainId: destinationChain as any,
        recipient: address,
        ...(sourceChain && { sourceChains: [sourceChain] as any }),
      };

      console.log('Transfer params:', params);
      const transferResult = await transfer(params);
      
      setResult({
        success: true,
        message: 'Transfer completed successfully!',
        data: transferResult,
      });
      setShowModal(true);
    } catch (err: any) {
      console.error('Transfer error:', err);
      setError(err.message || 'Transfer failed');
      setResult({
        success: false,
        message: err.message || 'Transfer failed',
      });
      setShowModal(true);
    } finally {
      setIsLoading(false);
    }
  };



  return (
    <div className="max-w-4xl mx-auto p-6 bg-black border border-gray-800 rounded-lg">
      <h2 className="text-2xl font-bold text-white mb-4">Case 1: Nexus-Supported Chains Transfer</h2>
      <p className="text-gray-300 mb-6">
        Transfer tokens between Nexus-supported chains (Sepolia, Base Sepolia, Arbitrum Sepolia, Amoy)
      </p>

      {!isInitialized() && (
        <div className="p-4 bg-yellow-900 text-yellow-400 rounded-md mb-4">
          ⚠️ Please initialize Nexus SDK first
        </div>
      )}

      {/* Fetch Balances Button */}
      <div className="mb-6">
        <button
          onClick={async () => {
            try {
              const bal = await getUnifiedBalances();
              setBalances(bal);
              setError(null);
            } catch (err: any) {
              setError(err.message || 'Failed to fetch balances');
            }
          }}
          disabled={!isInitialized() || isLoading}
          className="px-4 py-2 bg-purple-600 text-white rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-purple-700 transition"
        >
          Fetch Unified Balances
        </button>

        {balances && (
          <div className="mt-4 p-4 bg-gray-900 rounded-md border border-gray-700">
            <h3 className="text-white font-medium mb-2">Your Unified Balances:</h3>
            <div className="space-y-2">
              {balances.map((b: any) => (
                <div key={b.symbol} className="flex justify-between text-sm">
                  <span className="text-gray-300">{b.symbol}:</span>
                  <span className="text-white font-mono">
                    {parseFloat(b.balance).toFixed(4)} ({b.balanceInFiat || 'N/A'})
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Source Chain Selection */}
        <div>
          <label className="text-white font-medium mb-2 block">From Chain</label>
          <select
            value={sourceChain || ''}
            onChange={(e) => setSourceChain(e.target.value ? Number(e.target.value) : null)}
            className="w-full px-4 py-2 bg-gray-900 text-white rounded-md border border-gray-700 focus:border-blue-500 focus:outline-none"
          >
            <option value="">Any chain (SDK will optimize)</option>
            {CHAINS.map(chain => (
              <option key={chain.value} value={chain.value}>{chain.label}</option>
            ))}
          </select>
        </div>

        {/* Destination Chain Selection */}
        <div>
          <label className="text-white font-medium mb-2 block">To Chain</label>
          <select
            value={destinationChain}
            onChange={(e) => setDestinationChain(Number(e.target.value))}
            className="w-full px-4 py-2 bg-gray-900 text-white rounded-md border border-gray-700 focus:border-blue-500 focus:outline-none"
          >
            {CHAINS.map(chain => (
              <option key={chain.value} value={chain.value}>{chain.label}</option>
            ))}
          </select>
        </div>

        {/* Token Selection */}
        <div>
          <label className="text-white font-medium mb-2 block">Token</label>
          <select
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="w-full px-4 py-2 bg-gray-900 text-white rounded-md border border-gray-700 focus:border-blue-500 focus:outline-none"
          >
            {TOKENS.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* Amount */}
        <div>
          <label className="text-white font-medium mb-2 block">Amount</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter amount"
            className="w-full px-4 py-2 bg-gray-900 text-white rounded-md border border-gray-700 focus:border-blue-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Action Button */}
      <div className="mb-4">
        <button
          onClick={handleTransfer}
          disabled={isLoading || !isConnected || !isInitialized()}
          className="w-full px-6 py-3 bg-green-600 text-white rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-green-700 transition"
        >
          {isLoading ? 'Processing...' : 'Transfer'}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-900 text-red-400 rounded-md mb-4">
          ❌ {error}
        </div>
      )}

      {/* Result Modal */}
      {showModal && result && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg border border-gray-700 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-2xl font-bold text-white">
                  {result.success ? '✅ Success' : '❌ Failed'}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-white text-2xl"
                >
                  ×
                </button>
              </div>
              
              <div className="mb-4">
                <p className={`text-lg ${result.success ? 'text-green-400' : 'text-red-400'}`}>
                  {result.message}
                </p>
              </div>

              {result.data && (
                <div className="mt-4">
                  <h4 className="text-white font-medium mb-2">Transaction Details:</h4>
                  <pre className="bg-black border border-gray-700 p-4 rounded-md overflow-auto text-xs text-gray-300">
                    {JSON.stringify(result.data, null, 2)}
                  </pre>
                </div>
              )}

              <button
                onClick={() => setShowModal(false)}
                className="w-full mt-6 px-6 py-3 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
