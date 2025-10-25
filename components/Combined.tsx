'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract } from 'wagmi';
import { parseUnits, Address, decodeFunctionData } from 'viem';
import axios from 'axios';
import { transfer, getUnifiedBalances, isInitialized, bridgeAndExecute, simulateBridgeAndExecute } from '@/lib/nexus';
import type { TransferParams, BridgeAndExecuteParams, BridgeAndExecuteSimulationResult } from '@avail-project/nexus-core';
import { getTokenAddress } from '@/lib/AcrossMainnet';

// Main 11 supported chains
const MAIN_CHAINS = [
  { value: 1, label: 'Ethereum', nativeCurrency: 'ETH' },
  { value: 10, label: 'Optimism', nativeCurrency: 'ETH' },
  { value: 137, label: 'Polygon', nativeCurrency: 'MATIC' },
  { value: 42161, label: 'Arbitrum', nativeCurrency: 'ETH' },
  { value: 43114, label: 'Avalanche', nativeCurrency: 'AVAX' },
  { value: 8453, label: 'Base', nativeCurrency: 'ETH' },
  { value: 534351, label: 'Scroll', nativeCurrency: 'ETH' },
  { value: 50104, label: 'Sophon', nativeCurrency: 'SOPH' },
  { value: 8217, label: 'Kaia', nativeCurrency: 'KAIA' },
  { value: 56, label: 'BNB Chain', nativeCurrency: 'BNB' },
  { value: 9000000, label: 'HyperEVM', nativeCurrency: 'HYPE' },
];

// Additional chains via Across
const ACROSS_CHAINS = [
  { value: 59144, label: 'Linea (Across)' },
  { value: 534352, label: 'Scroll (Across)' },
  { value: 480, label: 'World (Across)' },
  { value: 130, label: 'Horizen EON (Across)' },
  { value: 232, label: 'Espresso (Across)' },
  { value: 999, label: 'HyperEVM (Across)' },
];

// Combined chains list
const ALL_CHAINS = [...MAIN_CHAINS, ...ACROSS_CHAINS];

// Check if a chain is an Across chain
const isAcrossChain = (chainId: number) => {
  return ACROSS_CHAINS.some(chain => chain.value === chainId);
};

// Get available tokens for a specific chain
const getTokensForChain = (chainId: number) => {
  if (isAcrossChain(chainId)) {
    // For Across chains, only USDC
    return [
      { value: 'USDC', label: 'USDC', decimals: 6 },
    ];
  }

  // For main chains, native + USDC + USDT
  const chain = MAIN_CHAINS.find(c => c.value === chainId);
  if (!chain) return [];

  const baseTokens = [
    { value: 'USDC', label: 'USDC', decimals: 6 },
    { value: 'USDT', label: 'USDT', decimals: 6 },
  ];

  const nativeToken = {
    value: chain.nativeCurrency,
    label: chain.nativeCurrency,
    decimals: 18,
  };

  return [nativeToken, ...baseTokens];
};

const MIDDLE_CHAIN = 8453; // Base

// Token decimals mapping
const TOKEN_DECIMALS: Record<string, number> = {
  'USDC': 6,
  'USDT': 6,
  'ETH': 18,
  'MATIC': 18,
  'AVAX': 18,
  'SOPH': 18,
  'KAIA': 18,
  'BNB': 18,
  'HYPE': 18,
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

export default function CombinedComponent() {
  const { address, isConnected } = useAccount();
  const { writeContract } = useWriteContract();
  
  const [sourceChain, setSourceChain] = useState<number | null>(null);
  const [destinationChain, setDestinationChain] = useState<number>(1);
  const [token, setToken] = useState('ETH');
  const [amount, setAmount] = useState('1');
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PaymentResult | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [balances, setBalances] = useState<any>(null);
  const [swapData, setSwapData] = useState<any>(null);
  const [approvalHash, setApprovalHash] = useState<string | null>(null);
  const [simulationResult, setSimulationResult] = useState<BridgeAndExecuteSimulationResult | null>(null);

  // Reset token when destination chain changes
  useEffect(() => {
    const availableTokens = getTokensForChain(destinationChain);
    if (availableTokens.length > 0) {
      setToken(availableTokens[0].value);
    }
  }, [destinationChain]);

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
        amount: amount,
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
      const amountWei = parseUnits(amount, TOKEN_DECIMALS['USDC'] || 18).toString();
      
      const inputTokenAddress = getTokenAddress(MIDDLE_CHAIN, 'USDC', true);
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
          recipient: '0x601A3f4cEd83190957Dcd1D068Ba830b0d6277cD',
        }
      });

      console.log('Swap Data from Across:', swapData);
      setSwapData(swapData);

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
      
      const params: BridgeAndExecuteParams = {
        token: "USDC" as any,
        amount: amountWei,
        toChainId: MIDDLE_CHAIN as any,
        sourceChains: [] as any,
        execute: {
          contractAddress: swapData.swapTx.to as Address,
          contractAbi: abi,
          functionName: 'deposit' as const,
          buildFunctionParams: () => ({
            functionParams: decoded.args as any,
          }),
          tokenApproval: {
            token: "USDC" as any,
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

  const handleSimulate = async () => {
    if (!address || !isConnected) {
      setError('Please connect your wallet first');
      return;
    }

    if (!isInitialized()) {
      setError('Nexus SDK not initialized');
      return;
    }

    setIsSimulating(true);
    setError(null);
    setSimulationResult(null);

    try {
      const amountWei = parseUnits(amount, TOKEN_DECIMALS[token] || 18).toString();
      
      const inputTokenAddress = getTokenAddress(MIDDLE_CHAIN, 'USDC', true);
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

      const params: BridgeAndExecuteParams = {
        token: "USDC" as any,
        amount: amountWei,
        toChainId: MIDDLE_CHAIN as any,
        sourceChains: [] as any,
        execute: {
          contractAddress: swapData.swapTx.to as Address,
          contractAbi: abi,
          functionName: 'deposit' as const,
          buildFunctionParams: () => ({
            functionParams: decoded.args as any,
          }),
          tokenApproval: {
            token: "USDC" as any,
            amount: amountWei,
          },
        },
        waitForReceipt: false,
      };

      const simResult = await simulateBridgeAndExecute(params);
      setSimulationResult(simResult);
      
      setResult({
        success: true,
        message: 'Simulation completed successfully!',
        data: simResult,
      });
      setShowModal(true);
    } catch (err: any) {
      console.error('Simulation error:', err);
      setError(err.message || 'Simulation failed');
    } finally {
      setIsSimulating(false);
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

  const needsApproval = () => {
    if (!swapData) return false;
    const allowanceActual = BigInt(swapData.checks.allowance.actual);
    const allowanceExpected = BigInt(swapData.checks.allowance.expected);
    return allowanceActual < allowanceExpected;
  };

  const isDestinationAcross = isAcrossChain(destinationChain);

  return (
    <div className="max-w-4xl mx-auto p-6 bg-black border border-gray-800 rounded-lg">
      <h2 className="text-2xl font-bold text-white mb-4">Multi-Chain Transfer & Bridge</h2>
      <p className="text-gray-300 mb-6">
        Transfer tokens between supported chains. Main chains support native + USDC + USDT. 
        Additional chains (marked with Across) support USDC only via bridge.
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
            {MAIN_CHAINS.map(chain => (
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
            {ALL_CHAINS.map(chain => (
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
            disabled={isDestinationAcross}
            className={`w-full px-4 py-2 bg-gray-900 text-white rounded-md border border-gray-700 focus:border-blue-500 focus:outline-none ${
              isDestinationAcross ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {getTokensForChain(destinationChain).map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          {isDestinationAcross && (
            <p className="text-xs text-gray-400 mt-1">Only USDC supported for Across chains</p>
          )}
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

      {/* Route Info */}
      <div className="mb-4 p-4 bg-blue-900 bg-opacity-30 rounded-md">
        <p className="text-blue-300 text-sm">
          {isDestinationAcross 
            ? `Route: Base → ${ALL_CHAINS.find(c => c.value === destinationChain)?.label} (via Across)`
            : `Route: ${sourceChain ? MAIN_CHAINS.find(c => c.value === sourceChain)?.label || 'Any' : 'Any'} → ${ALL_CHAINS.find(c => c.value === destinationChain)?.label}`
          }
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4 mb-4">
        {isDestinationAcross ? (
          <>
            <button
              onClick={handleSimulate}
              disabled={isLoading || isSimulating || !isConnected || !isInitialized()}
              className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-md font-medium disabled:opacity-50"
            >
              {isSimulating ? 'Simulating...' : 'Simulate'}
            </button>
            <button
              onClick={handleBridgeAndExecute}
              disabled={isLoading || isSimulating || !isConnected || !isInitialized()}
              className="flex-1 px-6 py-3 bg-green-600 text-white rounded-md font-medium disabled:opacity-50"
            >
              {isLoading ? 'Processing...' : 'Bridge & Execute'}
            </button>
          </>
        ) : (
          <button
            onClick={handleTransfer}
            disabled={isLoading || !isConnected || !isInitialized()}
            className="w-full px-6 py-3 bg-green-600 text-white rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-green-700 transition"
          >
            {isLoading ? 'Processing...' : 'Transfer'}
          </button>
        )}
      </div>

      {/* Approval button if needed for Across chains */}
      {isDestinationAcross && swapData && needsApproval() && (
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
