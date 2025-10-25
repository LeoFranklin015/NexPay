'use client';

import { useState } from 'react';
import { useAccount, useWriteContract } from 'wagmi';
import axios from 'axios';
import { parseUnits, Address, decodeFunctionData } from 'viem';
import { bridgeAndExecute, simulateBridgeAndExecute } from '@/lib/nexus';
import type { BridgeAndExecuteParams } from '@avail-project/nexus-core';

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

interface SwapData {
  checks: {
    allowance: any;
    balance: any;
  };
  steps: any;
  swapTx: any;
  expectedOutputAmount: string;
  minOutputAmount: string;
  expectedFillTime: number;
}

export default function AcrossToUnichain() {
  const { address, isConnected } = useAccount();
  const { writeContract } = useWriteContract();
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [swapData, setSwapData] = useState<SwapData | null>(null);
  const [bridgeResult, setBridgeResult] = useState<any>(null);
  const [approvalHash, setApprovalHash] = useState<string | null>(null);

  const handleFetchSwap = async () => {
    if (!address || !isConnected) {
      setError('Please connect your wallet first');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSwapData(null);

    try {
      // Call Across API to get swap details from Base to Unichain
      const { data } = await axios.get('https://testnet.across.to/api/swap/approval', {
        params: {
          tradeType: 'minOutput',
          amount: parseUnits('4', 6).toString(), // 3 USDC (6 decimals)
          inputToken: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // USDC on Base Sepolia
          originChainId: 84532, // Base Sepolia
          outputToken: '0x31d0220469e10c4E71834a79b1f276d740d3768F', // USDC on Unichain (1301)
          destinationChainId: 1301, // Unichain
          depositor: address,
        }
      });

      setSwapData(data);
      setSuccess('Swap details fetched successfully!');
      
      console.log('Swap Data:', data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch swap details');
    } finally {
      setIsLoading(false);
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
        setSuccess('Token already approved');
        setIsLoading(false);
        return;
      }

      console.log('Approving token:', {
        token: allowance.token,
        spender: allowance.spender,
        amount: allowanceExpected.toString()
      });

      // Approve the spender to spend the expected amount
      await writeContract({
        address: allowance.token as Address,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [allowance.spender as Address, allowanceExpected],
      });

      setApprovalHash('Approval sent');
      setSuccess('Approval transaction sent!');
    } catch (err: any) {
      console.error('Approval error:', err);
      setError(`Approval failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBridgeAndExecute = async () => {
    if (!swapData || !address) {
      setError('No swap data available');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Prepare the execute configuration for Base chain
      const executeConfig = {
        contractAddress: swapData.swapTx.to as Address, // AbacusSpoke contract
        contractAbi: [
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
        ] as const,
        functionName: 'deposit' as const,
        buildFunctionParams: (
          token: any,
          amount: string,
          chainId: any,
          userAddress: `0x${string}`
        ) => {
          // Decode the swapTx.data to get the deposit parameters
          const abi = executeConfig.contractAbi;
          const decoded = decodeFunctionData({
            abi: abi as any,
            data: swapData.swapTx.data as `0x${string}`,
          });
          
          console.log('Decoded deposit params:', decoded.args);
          
          return {
            functionParams: decoded.args as any,
          };
        },
        tokenApproval: {
          token: 'USDC' as any,
          amount: swapData.swapTx.inputAmount || '3000000', // Default to 3 USDC in wei
        },
      };

      // Bridge USDC from Sepolia (11155111) to Base (84532) and execute the call
      const params: BridgeAndExecuteParams = {
        token: 'USDC',
        amount: '4100000', // 3 USDC (6 decimals)
        toChainId: 84532 as any, // Base Sepolia
        sourceChains: [11155111] as any, // Ethereum Sepolia
        execute: executeConfig,
        waitForReceipt: true,
      };

      console.log('Bridge and Execute params:', params);

      const result = await bridgeAndExecute(params);
      
      setBridgeResult(result);
      setSuccess('Bridge and execute completed successfully!');
      console.log('Bridge and Execute result:', result);
    } catch (err: any) {
      console.error('Bridge and Execute error:', err);
      setError(`Bridge and Execute failed: ${err.message || 'Unknown error'}`);
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
    <div className="max-w-2xl mx-auto p-6 bg-black border border-gray-800 rounded-lg">
      <h2 className="text-2xl font-bold text-white mb-4">Bridge USDC: Sepolia → Base → Unichain</h2>
      <p className="text-gray-300 mb-4">
        Bridge 3 USDC from Ethereum Sepolia to Base, then execute swap from Base to Unichain
      </p>

      <div className="space-y-4">
        <button
          onClick={handleFetchSwap}
          disabled={isLoading || !isConnected || !!swapData}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-md disabled:opacity-50"
        >
          {isLoading ? 'Loading...' : '1. Fetch Swap Details'}
        </button>

        {swapData && (
          <>
            <div className="p-4 bg-gray-900 rounded-md">
              <h3 className="text-white font-medium mb-2">Swap Details (Base → Unichain)</h3>
              <div className="text-sm text-gray-300 space-y-1">
                <p>Expected Output: {swapData.expectedOutputAmount}</p>
                <p>Min Output: {swapData.minOutputAmount}</p>
                <p>Fill Time: {swapData.expectedFillTime}s</p>
                <p className="text-orange-400">
                  Needs Approval: {needsApproval() ? 'Yes' : 'No'}
                </p>
              </div>
            </div>

            {needsApproval() && (
              <button
                onClick={handleApproval}
                disabled={isLoading || !!approvalHash}
                className="w-full px-4 py-2 bg-gray-700 text-white rounded-md disabled:opacity-50"
              >
                {approvalHash ? `Approved: ${approvalHash}` : '2. Approve Tokens'}
              </button>
            )}

            <button
              onClick={handleBridgeAndExecute}
              disabled={isLoading || !!bridgeResult || (needsApproval() && !approvalHash)}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-md disabled:opacity-50"
            >
              {isLoading ? 'Processing...' : '3. Bridge & Execute'}
            </button>
          </>
        )}
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-900 text-red-400 rounded-md">
          {error}
        </div>
      )}

      {success && !bridgeResult && (
        <div className="mt-4 p-4 bg-green-900 text-green-400 rounded-md">
          {success}
        </div>
      )}

      {bridgeResult && (
        <div className="mt-4 p-4 bg-gray-900 rounded-md">
          <h3 className="text-white font-medium mb-2">Bridge & Execute Result:</h3>
          <pre className="text-xs text-gray-300 overflow-auto max-h-96">
            {JSON.stringify(bridgeResult, null, 2)}
          </pre>
        </div>
      )}

      {swapData && (
        <div className="mt-4 p-4 bg-gray-900 rounded-md">
          <h3 className="text-white font-medium mb-2">Raw Swap Response:</h3>
          <pre className="text-xs text-gray-300 overflow-auto max-h-96">
            {JSON.stringify(swapData, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
