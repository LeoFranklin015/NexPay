'use client';

import { useState } from 'react';
import { useAccount, useWriteContract } from 'wagmi';
import axios from 'axios';
import { parseUnits, Address, decodeFunctionData } from 'viem';
import { bridgeAndExecute, isInitialized } from '@/lib/nexus';
import type { BridgeAndExecuteParams } from '@avail-project/nexus-core';
import { getTokensForChain, getDestinationChains, getTokenAddress } from '@/lib/AcrossMainnet';

// Supported source chains (always start from these)
const SOURCE_CHAINS = [
  { value: 1, label: 'Ethereum' },
  { value: 8453, label: 'Base' },
  { value: 42161, label: 'Arbitrum' },
  { value: 137, label: 'Polygon' },
  { value: 10, label: 'Optimism' },
];

// All destination chains including non-Nexus-supported
const DESTINATION_CHAINS = [
  { value: 1, label: 'Ethereum' },
  { value: 8453, label: 'Base' },
  { value: 42161, label: 'Arbitrum' },
  { value: 137, label: 'Polygon' },
  { value: 10, label: 'Optimism' },
  { value: 250, label: 'Fantom' },
  { value: 43114, label: 'Avalanche' },
  { value: 56, label: 'BNB Chain' },
  { value: 100, label: 'Gnosis' },
  { value: 324, label: 'zkSync Era' },
  { value: 59144, label: 'Linea' },
  { value: 534352, label: 'Scroll' },
];

const MIDDLE_CHAIN = 8453; // Base

// Token decimals mapping
const TOKEN_DECIMALS: Record<string, number> = {
  'USDC': 6,
  'USDT': 6,
  'ETH': 18,
  'WETH': 18,
  'XYZ': 18,
};

// ERC20 ABI for approve function
const ERC20_ABI = [
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function'
  }
] as const;

interface PaymentResult {
  success: boolean;
  message: string;
  data?: any;
}

export default function Case2Component() {
  const { address, isConnected } = useAccount();
  const { writeContract } = useWriteContract();
  
  const [sourceChain, setSourceChain] = useState<number>(1); // Ethereum Mainnet
  const [destinationChain, setDestinationChain] = useState<number>(8453); // Base
  const [token, setToken] = useState('USDC');
  const [amount, setAmount] = useState('1');
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PaymentResult | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [swapData, setSwapData] = useState<any>(null);
  const [approvalHash, setApprovalHash] = useState<string | null>(null);

  // Get available tokens for destination chain
  const destinationTokens = getTokensForChain(destinationChain);

  const detectRoute = async () => {
    if (destinationTokens.includes(token)) {
      setResult({
        success: true,
        message: `Route available: ${SOURCE_CHAINS.find(c => c.value === sourceChain)?.label} → Base → ${DESTINATION_CHAINS.find(c => c.value === destinationChain)?.label}`,
      });
      setShowModal(true);
    } else {
      setError(`Token ${token} not available for destination chain ${destinationChain}`);
    }
  };

  const handleApproval = async () => {
    if (!swapData || !address) {
      setError('No swap data available');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const { allowance } = swapData.checks;
      const allowanceActual = BigInt(allowance.actual);
      const allowanceExpected = BigInt(allowance.expected);

      if (allowanceActual >= allowanceExpected) {
        setApprovalHash('Already approved');
        setResult({
          success: true,
          message: 'Token already approved',
        });
        setShowModal(true);
        return;
      }

      await writeContract({
        address: allowance.token as Address,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [allowance.spender as Address, allowanceExpected],
      });

      setApprovalHash('Approval sent');
      setResult({
        success: true,
        message: 'Approval transaction sent!',
      });
      setShowModal(true);
    } catch (err: any) {
      setError(`Approval failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBridgeAndExecute = async () => {
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
      // Step 1: Fetch swap details from Across API for Base -> Destination
      const amountWei = parseUnits(amount, TOKEN_DECIMALS[token] || 18).toString();
      
      const inputTokenAddress = getTokenAddress(MIDDLE_CHAIN, token, true);
      const outputTokenAddress = getTokenAddress(destinationChain, token, false);

      if (!inputTokenAddress || !outputTokenAddress) {
        throw new Error('Token addresses not found for the selected route');
      }

      const { data: swapData } = await axios.get('https://across.to/api/swap/approval', {
        params: {
          tradeType: 'minOutput',
          amount: amountWei,
          inputToken: inputTokenAddress,
          originChainId: MIDDLE_CHAIN,
          outputToken: outputTokenAddress,
          destinationChainId: destinationChain,
          depositor: address,
        }
      });

      console.log('Swap Data from Across:', swapData);
      setSwapData(swapData);

      // Step 2: Decode swap parameters
      const abi = [
        {
          inputs: [
            { name: 'depositor', type: 'bytes32' },
            { name: 'recipient', type: 'bytes32' },
            { name: 'inputToken', type: 'bytes32' },
            { name: 'outputToken', type: 'bytes32' },
            { name: 'inputAmount', type: 'uint256' },
            { name: 'outputAmount', type: 'uint256' },
            { name: 'destinationChainId', type: 'uint256' },
            { name: 'exclusiveRelayer', type: 'bytes32' },
            { name: 'quoteTimestamp', type: 'uint32' },
            { name: 'fillDeadline', type: 'uint32' },
            { name: 'exclusivityParameter', type: 'uint32' },
            { name: 'message', type: 'bytes' }
          ],
          name: 'deposit',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function'
        }
      ] as const;

      const decoded = decodeFunctionData({
        abi: abi as any,
        data: swapData.swapTx.data as `0x${string}`,
      });

      // Step 3: Build bridge-and-execute params
      const params: BridgeAndExecuteParams = {
        token: token as any,
        amount: amountWei,
        toChainId: MIDDLE_CHAIN as any, // Bridge to Base first
        sourceChains: [sourceChain] as any, // From source chain
        execute: {
          contractAddress: swapData.swapTx.to as Address,
          contractAbi: abi,
          functionName: 'deposit' as const,
          buildFunctionParams: () => ({
            functionParams: decoded.args as any,
          }),
          tokenApproval: {
            token: token as any,
            amount: amountWei,
          },
        },
        waitForReceipt: true,
      };

      console.log('Bridge and Execute params:', params);
      
      const bridgeResult = await bridgeAndExecute(params);
      
      setResult({
        success: true,
        message: 'Bridge and execute completed successfully!',
        data: bridgeResult,
      });
      setShowModal(true);
    } catch (err: any) {
      console.error('Bridge and Execute error:', err);
      setError(err.message || 'Bridge and execute failed');
      setResult({
        success: false,
        message: err.message || 'Bridge and execute failed',
      });
      setShowModal(true);
    } finally {
      setIsLoading(false);
    }
  };

  const needsApproval = () => {
    if (!swapData) return false;
    const allowanceActual = BigInt(swapData.checks.allowance.actual);
    const allowanceExpected = BigInt(swapData.checks.allowance.expected);
    return allowanceActual < allowanceExpected;
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-black border border-gray-800 rounded-lg">
      <h2 className="text-2xl font-bold text-white mb-4">Case 2: Non-Nexus Chains via Base (Across)</h2>
      <p className="text-gray-300 mb-6">
        Bridge tokens from Nexus-supported chains to any destination via Base using Across
      </p>

      {!isInitialized() && (
        <div className="p-4 bg-yellow-900 text-yellow-400 rounded-md mb-4">
          ⚠️ Please initialize Nexus SDK first
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Source Chain */}
        <div>
          <label className="text-white font-medium mb-2 block">From Chain</label>
          <select
            value={sourceChain}
            onChange={(e) => setSourceChain(Number(e.target.value))}
            className="w-full px-4 py-2 bg-gray-900 text-white rounded-md border border-gray-700"
          >
            {SOURCE_CHAINS.map(chain => (
              <option key={chain.value} value={chain.value}>{chain.label}</option>
            ))}
          </select>
        </div>

        {/* Destination Chain */}
        <div>
          <label className="text-white font-medium mb-2 block">To Chain</label>
          <select
            value={destinationChain}
            onChange={(e) => setDestinationChain(Number(e.target.value))}
            className="w-full px-4 py-2 bg-gray-900 text-white rounded-md border border-gray-700"
          >
            {DESTINATION_CHAINS.map(chain => (
              <option key={chain.value} value={chain.value}>{chain.label}</option>
            ))}
          </select>
        </div>

        {/* Token */}
        <div>
          <label className="text-white font-medium mb-2 block">Token</label>
          <select
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="w-full px-4 py-2 bg-gray-900 text-white rounded-md border border-gray-700"
          >
            {destinationTokens.length > 0 ? (
              destinationTokens.map(t => (
                <option key={t} value={t}>{t}</option>
              ))
            ) : (
              <option>No tokens available</option>
            )}
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
            className="w-full px-4 py-2 bg-gray-900 text-white rounded-md border border-gray-700"
          />
        </div>
      </div>

      {/* Route Info */}
      <div className="mb-4 p-4 bg-blue-900 bg-opacity-30 rounded-md">
        <p className="text-blue-300 text-sm">
          Route: {SOURCE_CHAINS.find(c => c.value === sourceChain)?.label} → Base → {DESTINATION_CHAINS.find(c => c.value === destinationChain)?.label}
        </p>
      </div>

      {/* Buttons */}
      <div className="flex gap-4 mb-4">
        <button
          onClick={detectRoute}
          disabled={isLoading || !isConnected || !isInitialized()}
          className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-md font-medium disabled:opacity-50"
        >
          Detect Route
        </button>
        <button
          onClick={handleBridgeAndExecute}
          disabled={isLoading || !isConnected || !isInitialized()}
          className="flex-1 px-6 py-3 bg-green-600 text-white rounded-md font-medium disabled:opacity-50"
        >
          {isLoading ? 'Processing...' : 'Bridge & Execute'}
        </button>
      </div>

      {/* Approval button if needed */}
      {swapData && needsApproval() && (
        <div className="mb-4">
          <button
            onClick={handleApproval}
            disabled={isLoading || !!approvalHash}
            className="w-full px-6 py-3 bg-gray-700 text-white rounded-md font-medium disabled:opacity-50"
          >
            {approvalHash ? `Approved: ${approvalHash}` : 'Approve Tokens First'}
          </button>
        </div>
      )}

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
