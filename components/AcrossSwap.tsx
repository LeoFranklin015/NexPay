'use client';

import { useState } from 'react';
import { useAccount, useSendTransaction, useWriteContract } from 'wagmi';
import axios from 'axios';
import { parseUnits, Address, decodeFunctionData } from 'viem';

interface SwapData {
  checks: {
    allowance: any;
    balance: any;
  };
  steps: any;
  swapTx: any;
  approvalTxns?: any[];
  expectedOutputAmount: string;
  minOutputAmount: string;
  expectedFillTime: number;
}

// AbacusSpoke ABI for deposit function
const ABACUS_SPOKE_ABI = [
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

export default function AcrossSwap() {
  const { address, isConnected } = useAccount();
  const { sendTransaction } = useSendTransaction();
  const { writeContract } = useWriteContract();
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [swapData, setSwapData] = useState<SwapData | null>(null);
  const [approvalHash, setApprovalHash] = useState<string | null>(null);
  const [swapHash, setSwapHash] = useState<string | null>(null);

  const handleFetchSwap = async () => {
    if (!address || !isConnected) {
      setError('Please connect your wallet first');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSwapData(null);

    try {
      // Swap 1 USDC on Ethereum Sepolia (11155111) to USDC on Base Sepolia (84532)
      const { data } = await axios.get('https://testnet.across.to/api/swap/approval', {
        params: {
          tradeType: 'minOutput',
          amount: parseUnits('1', 6).toString(), // 1 USDC (6 decimals)
          inputToken: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // USDC on Ethereum Sepolia
          originChainId: 11155111, // Ethereum Sepolia
          outputToken: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // USDC on Base Sepolia
          destinationChainId: 84532, // Base Sepolia
          depositor: address,
        }
      });

      setSwapData(data);
      setSuccess('Swap details fetched successfully!');
    } catch (err: any) {
      setError(err.message || 'Failed to fetch swap details');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproval = async () => {
    if (!swapData?.approvalTxns || swapData.approvalTxns.length === 0) {
      setError('No approval transactions needed');
      return;
    }

    try {
      for (const approvalTxn of swapData.approvalTxns) {
        sendTransaction(
          {
            to: approvalTxn.to as `0x${string}`,
            data: approvalTxn.data as `0x${string}`,
          },
          {
            onSuccess: (hash) => {
              setApprovalHash(hash);
              console.log('Approval tx hash:', hash);
            },
            onError: (error) => {
              setError(`Approval failed: ${error.message}`);
            },
          }
        );
      }
    } catch (err: any) {
      setError(err.message || 'Approval failed');
    }
  };

  const handleExecuteSwap = async () => {
    if (!swapData?.swapTx) {
      setError('No swap transaction available');
      return;
    }

    try {
      // Decode the function data to get parameters
      const decoded = decodeFunctionData({
        abi: ABACUS_SPOKE_ABI,
        data: swapData.swapTx.data as `0x${string}`,
      });

      console.log('Decoded params:', decoded.args);

      // Use writeContract to call deposit with decoded parameters
      writeContract({
        address: swapData.swapTx.to as Address,
        abi: ABACUS_SPOKE_ABI,
        functionName: 'deposit',
        args: decoded.args as any,
      });

      setSwapHash('Transaction sent...');
      setSuccess('Crosschain swap transaction sent!');
    } catch (err: any) {
      setError(err.message || 'Swap execution failed');
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-black border border-gray-800 rounded-lg">
      <h2 className="text-2xl font-bold text-white mb-4">Across Crosschain Swap</h2>
      <p className="text-gray-300 mb-4">
        Swap 1 USDC from Ethereum Sepolia to USDC on Base Sepolia
      </p>

      <div className="space-y-4">
        <button
          onClick={handleFetchSwap}
          disabled={isLoading || !isConnected}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-md disabled:opacity-50"
        >
          {isLoading ? 'Loading...' : 'Fetch Swap Details'}
        </button>

        {swapData && (
          <>
            <div className="p-4 bg-gray-900 rounded-md">
              <h3 className="text-white font-medium mb-2">Swap Details</h3>
              <div className="text-sm text-gray-300 space-y-1">
                <p>Expected Output: {swapData.expectedOutputAmount}</p>
                <p>Min Output: {swapData.minOutputAmount}</p>
                <p>Fill Time: {swapData.expectedFillTime}s</p>
              </div>
            </div>

            {swapData.approvalTxns && swapData.approvalTxns.length > 0 && (
              <button
                onClick={handleApproval}
                disabled={!!approvalHash}
                className="w-full px-4 py-2 bg-gray-700 text-white rounded-md disabled:opacity-50"
              >
                {approvalHash ? `Approved: ${approvalHash}` : 'Approve Tokens'}
              </button>
            )}

            <button
              onClick={handleExecuteSwap}
              disabled={!!swapHash || (swapData.approvalTxns && swapData.approvalTxns.length > 0 && !approvalHash)}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-md disabled:opacity-50"
            >
              {swapHash ? `Swapped: ${swapHash}` : 'Execute Swap'}
            </button>
          </>
        )}
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-900 text-red-400 rounded-md">
          {error}
        </div>
      )}

      {success && !swapHash && (
        <div className="mt-4 p-4 bg-green-900 text-green-400 rounded-md">
          {success}
        </div>
      )}

      {swapData && (
        <div className="mt-4 p-4 bg-gray-900 rounded-md">
          <h3 className="text-white font-medium mb-2">Raw Response:</h3>
          <pre className="text-xs text-gray-300 overflow-auto max-h-96">
            {JSON.stringify(swapData, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
