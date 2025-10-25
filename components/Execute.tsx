'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { bridgeAndExecute, simulateBridgeAndExecute, isInitialized } from '@/lib/nexus';
import type { BridgeAndExecuteParams, BridgeAndExecuteResult, BridgeAndExecuteSimulationResult } from '@avail-project/nexus-core';
import { parseUnits } from 'viem';

export default function ExecuteComponent() {
  const { isConnected, address } = useAccount();
  const [isLoading, setIsLoading] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [simulationResult, setSimulationResult] = useState<BridgeAndExecuteSimulationResult | null>(null);
  const [bridgeAndExecuteResult, setBridgeAndExecuteResult] = useState<BridgeAndExecuteResult | null>(null);

  const handleSimulate = async () => {
    if (!isConnected || !isInitialized() || !address) {
      setError('Please connect wallet and initialize SDK first');
      return;
    }

    setIsSimulating(true);
    setError(null);

    try {
      const params: BridgeAndExecuteParams = {
        token: 'USDC',
        amount: '1000000', // 100 USDC (6 decimals)
        toChainId: 11155111, // Ethereum Sepolia
        sourceChains: [84532], // Base Sepolia
        execute: {
          contractAddress: '0xa354F35829Ae975e850e23e9615b11Da1B3dC4DE', // Yearn USDC Vault
          contractAbi: [
            {
              inputs: [
                { internalType: 'uint256', name: 'assets', type: 'uint256' },
                { internalType: 'address', name: 'receiver', type: 'address' },
              ],
              name: 'deposit',
              outputs: [{ internalType: 'uint256', name: 'shares', type: 'uint256' }],
              stateMutability: 'nonpayable',
              type: 'function',
            },
          ],
          functionName: 'deposit',
          buildFunctionParams: (
            token: any,
            amount: string,
            chainId: any,
            userAddress: `0x${string}`,
          ) => {
            const decimals = 6; // USDC has 6 decimals
            const amountWei = parseUnits(amount, decimals);
            return {
              functionParams: [amountWei, userAddress],
            };
          },
          tokenApproval: {
            token: 'USDC',
            amount: '100000000',
          },
        },
        waitForReceipt: true,
      };

      const result = await simulateBridgeAndExecute(params);
      setSimulationResult(result);
      
      if (result.success) {
        setSuccess('Simulation completed successfully!');
      } else {
        setError(result.error || 'Simulation failed');
      }
    } catch (err: any) {
      setError(err.message || 'Simulation failed');
    } finally {
      setIsSimulating(false);
    }
  };

  const handleBridgeAndExecute = async () => {
    if (!isConnected || !isInitialized() || !address) {
      setError('Please connect wallet and initialize SDK first');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const params: BridgeAndExecuteParams = {
        token: 'USDC',
        amount: '100000000', // 100 USDC (6 decimals)
        toChainId: 11155111, // Ethereum Sepolia
        sourceChains: [84532], // Base Sepolia
        execute: {
          contractAddress: '0xa354F35829Ae975e850e23e9615b11Da1B3dC4DE', // Yearn USDC Vault
          contractAbi: [
            {
              inputs: [
                { internalType: 'uint256', name: 'assets', type: 'uint256' },
                { internalType: 'address', name: 'receiver', type: 'address' },
              ],
              name: 'deposit',
              outputs: [{ internalType: 'uint256', name: 'shares', type: 'uint256' }],
              stateMutability: 'nonpayable',
              type: 'function',
            },
          ],
          functionName: 'deposit',
          buildFunctionParams: (
            token: any,
            amount: string,
            chainId: any,
            userAddress: `0x${string}`,
          ) => {
            const decimals = 6; // USDC has 6 decimals
            const amountWei = parseUnits(amount, decimals);
            return {
              functionParams: [amountWei, userAddress],
            };
          },
          tokenApproval: {
            token: 'USDC',
            amount: '100000000',
          },
        },
        waitForReceipt: true,
      };

      const result = await bridgeAndExecute(params);
      setBridgeAndExecuteResult(result);
      
      if (result.success) {
        setSuccess('Bridge and Execute successful!');
      } else {
        setError(result.error || 'Bridge and Execute failed');
      }
    } catch (err: any) {
      setError(err.message || 'Bridge and Execute failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-black border border-gray-800 rounded-lg">
      <h2 className="text-2xl font-bold text-white mb-4">Bridge and Execute</h2>
      <p className="text-gray-300 mb-4">
        Bridge 100 USDC from Base Sepolia to Ethereum Sepolia and deposit into Yearn USDC Vault
      </p>
      
      <div className="flex space-x-4 mb-4">
        <button
          onClick={handleSimulate}
          disabled={isSimulating || isLoading}
          className="px-4 py-2 bg-gray-800 text-white rounded-md disabled:opacity-50"
        >
          {isSimulating ? 'Simulating...' : 'Simulate'}
        </button>
        <button
          onClick={handleBridgeAndExecute}
          disabled={isLoading || isSimulating}
          className="px-4 py-2 bg-blue-600 text-white rounded-md disabled:opacity-50"
        >
          {isLoading ? 'Executing...' : 'Bridge & Execute'}
        </button>
      </div>

      {error && <div className="mt-4 p-4 bg-red-900 text-red-400 rounded-md">{error}</div>}
      {success && <div className="mt-4 p-4 bg-green-900 text-green-400 rounded-md">{success}</div>}

      {simulationResult && (
        <div className="mt-4 p-4 bg-gray-900 rounded-md">
          <h3 className="text-white font-medium mb-2">Simulation Results:</h3>
          <pre className="text-xs text-gray-300 overflow-auto">
            {JSON.stringify(simulationResult, null, 2)}
          </pre>
        </div>
      )}

      {bridgeAndExecuteResult && (
        <div className="mt-4 p-4 bg-gray-900 rounded-md">
          <h3 className="text-white font-medium mb-2">Execution Results:</h3>
          <pre className="text-xs text-gray-300 overflow-auto">
            {JSON.stringify(bridgeAndExecuteResult, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
