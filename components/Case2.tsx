'use client';

import { useState } from 'react';
import { useAccount, useWriteContract, useBalance } from 'wagmi';
import axios from 'axios';
import { parseUnits, Address, decodeFunctionData } from 'viem';
import { bridgeAndExecute, simulateBridgeAndExecute, isInitialized } from '@/lib/nexus';
import type { BridgeAndExecuteParams, BridgeAndExecuteSimulationResult } from '@avail-project/nexus-core';
import { getTokensForChain, getDestinationChains, getTokenAddress } from '@/lib/AcrossMainnet';

// Chains to exclude (already supported in main 11 chains)
const EXCLUDED_CHAINS = [1, 10, 137, 42161, 43114, 8453, 534351, 50104, 8217, 56, 9000000];

// Chain ID to name mapping for additional chains only
const CHAIN_NAMES: Record<number, string> = {
  59144: 'Linea',
  534352: 'Scroll',
  480: 'World',
  130: 'Horizen EON',
  232: 'Espresso',
  999: 'HyperEVM',
};

// Supported destination chains from the actual data (excluding the 11 main chains)
const DESTINATION_CHAINS = [
  { value: 59144, label: CHAIN_NAMES[59144] || 'Unidentified' },
  { value: 534352, label: CHAIN_NAMES[534352] || 'Unidentified' },
  { value: 480, label: CHAIN_NAMES[480] || 'Unidentified' },
  { value: 130, label: CHAIN_NAMES[130] || 'Unidentified' },
  { value: 232, label: CHAIN_NAMES[232] || 'Unidentified' },
  { value: 999, label: CHAIN_NAMES[999] || 'Unidentified' },
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
  
  const [destinationChain, setDestinationChain] = useState<number>(1); // Ethereum
  const [token, setToken] = useState('USDC');
  const [amount, setAmount] = useState('1');
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PaymentResult | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [swapData, setSwapData] = useState<any>(null);
  const [approvalHash, setApprovalHash] = useState<string | null>(null);
  const [simulationResult, setSimulationResult] = useState<BridgeAndExecuteSimulationResult | null>(null);

  const detectRoute = async () => {
    if (token === 'USDC') {
      setResult({
        success: true,
        message: `Route available: Base → ${DESTINATION_CHAINS.find(c => c.value === destinationChain)?.label}`,
      });
      setShowModal(true);
    } else {
      setError(`Only USDC is supported for this route`);
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
      // Step 1: Fetch swap details from Across API for Base -> Destination
      const amountWei = parseUnits(amount, TOKEN_DECIMALS['USDC'] || 18).toString();
      
      // Input token is always USDC on Base, output token is the selected token from dropdown
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

      const params: BridgeAndExecuteParams = {
        token: "USDC" as any,
        amount: amountWei,
        toChainId: MIDDLE_CHAIN as any, // Bridge to Base first
        sourceChains: [] as any, // No source chains needed
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
        waitForReceipt: false, // Don't wait during simulation
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
      // Note: Make sure you have enough USDC balance on both source and destination chains
      // The SDK bridges USDC to Base first, then executes on Base, so you need:
      // 1. Enough USDC on the source chain (for the bridge)
      // 2. The bridged USDC will be available on Base for the execute step
      // Step 1: Fetch swap details from Across API for Base -> Destination
      const amountWei = parseUnits(amount, TOKEN_DECIMALS['USDC'] || 18).toString();
      
      // Input token is always USDC on Base, output token is the selected token from dropdown
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
      
      const params: BridgeAndExecuteParams = {
        token: "USDC" as any,
        amount: amountWei,
        toChainId: MIDDLE_CHAIN as any, // Bridge to Base first
        sourceChains: [] as any, // No source chains needed
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

  const needsApproval = () => {
    if (!swapData) return false;
    const allowanceActual = BigInt(swapData.checks.allowance.actual);
    const allowanceExpected = BigInt(swapData.checks.allowance.expected);
    return allowanceActual < allowanceExpected;
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-black border border-gray-800 rounded-lg">
      <h2 className="text-2xl font-bold text-white mb-4">Case 2: Bridge USDC from Base to Destination Chains</h2>
      <p className="text-gray-300 mb-6">
        Bridge USDC from Base to supported destination chains using Across
      </p>

      {!isInitialized() && (
        <div className="p-4 bg-yellow-900 text-yellow-400 rounded-md mb-4">
          ⚠️ Please initialize Nexus SDK first
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
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

        {/* Token - Fixed to USDC */}
        <div>
          <label className="text-white font-medium mb-2 block">Token</label>
          <select
            value={token}
            disabled
            className="w-full px-4 py-2 bg-gray-700 text-gray-400 rounded-md border border-gray-600 cursor-not-allowed"
          >
            <option value="USDC">USDC</option>
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
          Route: Base → {DESTINATION_CHAINS.find(c => c.value === destinationChain)?.label}
        </p>
      </div>

      {/* Buttons */}
      <div className="flex gap-4 mb-4">
        <button
          onClick={detectRoute}
          disabled={isLoading || isSimulating || !isConnected || !isInitialized()}
          className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-md font-medium disabled:opacity-50"
        >
          Detect Route
        </button>
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
