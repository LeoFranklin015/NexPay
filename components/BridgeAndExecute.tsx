'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { bridgeAndExecute, simulateBridgeAndExecute, isInitialized } from '@/lib/nexus';
import type { BridgeAndExecuteParams, BridgeAndExecuteResult, BridgeAndExecuteSimulationResult, ExecuteParams } from '@avail-project/nexus-core';

// Supported tokens and chains based on actual SDK data
const SUPPORTED_TOKENS = [
  { value: 'ETH', label: 'ETH', icon: 'https://coin-images.coingecko.com/coins/images/279/large/ethereum.png' },
  { value: 'USDC', label: 'USDC', icon: 'https://coin-images.coingecko.com/coins/images/6319/large/usdc.png' },
  { value: 'USDT', label: 'USDT', icon: 'https://coin-images.coingecko.com/coins/images/35023/large/USDT.png' },
  { value: 'MON', label: 'MON', icon: 'https://assets.coingecko.com/coins/images/38927/large/monad.jpg' },
  { value: 'POL', label: 'POL', icon: 'https://coin-images.coingecko.com/coins/images/32440/standard/polygon.png' },
] as const;

const SUPPORTED_CHAINS = [
  { value: 11155111, label: 'Ethereum Sepolia', logo: 'https://assets.coingecko.com/asset_platforms/images/279/large/ethereum.png' },
  { value: 84532, label: 'Base Sepolia', logo: 'https://assets.coingecko.com/asset_platforms/images/131/large/base-network.png' },
  { value: 80002, label: 'Amoy', logo: 'https://assets.coingecko.com/asset_platforms/images/15/large/polygon_pos.png' },
  { value: 421614, label: 'Arbitrum Sepolia', logo: 'https://assets.coingecko.com/coins/images/16547/large/arb.jpg' },
  { value: 11155420, label: 'OP Sepolia', logo: 'https://assets.coingecko.com/coins/images/25244/large/Optimism.png' },
  { value: 10143, label: 'Monad Testnet', logo: 'https://assets.coingecko.com/coins/images/38927/standard/monad.jpg' },
] as const;

// Common contract ABIs for popular DeFi protocols
const COMMON_CONTRACTS = [
  {
    name: 'Compound V3 USDC Market',
    address: '0xc3d688B66703497DAA19211EEdff47f25384cdc3',
    abi: [
      {
        inputs: [
          { internalType: 'address', name: 'asset', type: 'address' },
          { internalType: 'uint256', name: 'amount', type: 'uint256' },
        ],
        name: 'supply',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      },
    ],
    functionName: 'supply',
    description: 'Supply USDC to Compound V3',
  },
  {
    name: 'Yearn USDC Vault',
    address: '0xa354F35829Ae975e850e23e9615b11Da1B3dC4DE',
    abi: [
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
    description: 'Deposit USDC to Yearn Vault',
  },
  {
    name: 'Uniswap V3 Swap',
    address: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    abi: [
      {
        inputs: [
          {
            components: [
              { internalType: 'address', name: 'tokenIn', type: 'address' },
              { internalType: 'address', name: 'tokenOut', type: 'address' },
              { internalType: 'uint24', name: 'fee', type: 'uint24' },
              { internalType: 'address', name: 'recipient', type: 'address' },
              { internalType: 'uint256', name: 'deadline', type: 'uint256' },
              { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
              { internalType: 'uint256', name: 'amountOutMinimum', type: 'uint256' },
              { internalType: 'uint160', name: 'sqrtPriceLimitX96', type: 'uint160' },
            ],
            internalType: 'struct ISwapRouter.ExactInputSingleParams',
            name: 'params',
            type: 'tuple',
          },
        ],
        name: 'exactInputSingle',
        outputs: [{ internalType: 'uint256', name: 'amountOut', type: 'uint256' }],
        stateMutability: 'payable',
        type: 'function',
      },
    ],
    functionName: 'exactInputSingle',
    description: 'Swap tokens on Uniswap V3',
  },
];

interface BridgeAndExecuteComponentProps {
  className?: string;
  balances?: any[];
  onBridgeAndExecuteComplete?: (result: BridgeAndExecuteResult) => void;
  onSimulationComplete?: (result: BridgeAndExecuteSimulationResult) => void;
}

export default function BridgeAndExecuteComponent({ 
  className = '', 
  balances = [],
  onBridgeAndExecuteComplete,
  onSimulationComplete 
}: BridgeAndExecuteComponentProps) {
  const { isConnected, address } = useAccount();
  const [isLoading, setIsLoading] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [simulationResult, setSimulationResult] = useState<BridgeAndExecuteSimulationResult | null>(null);
  const [bridgeAndExecuteResult, setBridgeAndExecuteResult] = useState<BridgeAndExecuteResult | null>(null);

  // Form state
  const [formData, setFormData] = useState<BridgeAndExecuteParams>({
    toChainId: 11155111,
    token: 'USDC',
    amount: '',
    recipient: undefined,
    sourceChains: [],
    execute: undefined,
    enableTransactionPolling: true,
    transactionTimeout: 300000, // 5 minutes
    waitForReceipt: true,
    receiptTimeout: 60000, // 1 minute
    requiredConfirmations: 1,
    recentApprovalTxHash: undefined,
  });

  // Contract execution state
  const [contractData, setContractData] = useState({
    contractAddress: '',
    contractAbi: '',
    functionName: '',
    functionParams: '',
    tokenApprovalToken: 'USDC',
    tokenApprovalAmount: '',
  });

  const handleInputChange = (field: keyof BridgeAndExecuteParams, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: field === 'amount' ? String(value) : value
    }));
    setError(null);
    setSuccess(null);
  };

  const handleContractDataChange = (field: string, value: any) => {
    setContractData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSourceChainToggle = (chainId: number) => {
    setFormData(prev => ({
      ...prev,
      sourceChains: prev.sourceChains?.includes(chainId)
        ? prev.sourceChains.filter(id => id !== chainId)
        : [...(prev.sourceChains || []), chainId]
    }));
  };

  const handleContractPreset = (preset: any) => {
    setContractData({
      contractAddress: preset.address,
      contractAbi: JSON.stringify(preset.abi, null, 2),
      functionName: preset.functionName,
      functionParams: '',
      tokenApprovalToken: formData.token,
      tokenApprovalAmount: String(formData.amount),
    });
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
    if (!contractData.contractAddress) {
      return 'Please enter a contract address';
    }
    if (!contractData.contractAbi) {
      return 'Please enter contract ABI';
    }
    if (!contractData.functionName) {
      return 'Please enter function name';
    }
    return null;
  };

  const buildExecuteParams = (): Omit<ExecuteParams, 'toChainId'> | undefined => {
    if (!contractData.contractAddress || !contractData.contractAbi || !contractData.functionName) {
      return undefined;
    }

    try {
      const abi = JSON.parse(contractData.contractAbi);
      return {
        contractAddress: contractData.contractAddress,
        contractAbi: abi,
        functionName: contractData.functionName,
        buildFunctionParams: (
          token: string,
          amount: string,
          chainId: number,
          userAddress: `0x${string}`,
        ) => {
          // Simple parameter builder - in real implementation, this would be more sophisticated
          const functionParams = contractData.functionParams 
            ? JSON.parse(contractData.functionParams)
            : [amount, userAddress];
          
          return {
            functionParams,
          };
        },
        tokenApproval: contractData.tokenApprovalAmount ? {
          token: contractData.tokenApprovalToken as any,
          amount: contractData.tokenApprovalAmount,
        } : undefined,
      };
    } catch (error) {
      console.error('Error parsing contract ABI:', error);
      return undefined;
    }
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
      const executeParams = buildExecuteParams();
      if (!executeParams) {
        setError('Invalid contract configuration');
        return;
      }

      const params: BridgeAndExecuteParams = {
        ...formData,
        amount: String(formData.amount),
        execute: executeParams,
      };

      const result = await simulateBridgeAndExecute(params);
      setSimulationResult(result);
      onSimulationComplete?.(result);
      setSuccess('Simulation completed successfully!');
    } catch (err: any) {
      setError(err.message || 'Simulation failed');
    } finally {
      setIsSimulating(false);
    }
  };

  const handleBridgeAndExecute = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);
    setError(null);
    setBridgeAndExecuteResult(null);

    try {
      const executeParams = buildExecuteParams();
      if (!executeParams) {
        setError('Invalid contract configuration');
        return;
      }

      const params: BridgeAndExecuteParams = {
        ...formData,
        amount: String(formData.amount),
        execute: executeParams,
      };

      const result = await bridgeAndExecute(params);
      setBridgeAndExecuteResult(result);
      onBridgeAndExecuteComplete?.(result);
      
      if (result.success) {
        setSuccess(`Bridge and Execute successful! Bridge skipped: ${result.bridgeSkipped}`);
      } else {
        setError(result.error || 'Bridge and Execute failed');
      }
    } catch (err: any) {
      setError(err.message || 'Bridge and Execute failed');
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
  const textareaClasses = "w-full px-3 py-2 bg-gray-900 border border-gray-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400 min-h-[100px]";

  return (
    <div className={`max-w-4xl mx-auto p-6 bg-black border border-gray-800 rounded-lg shadow-2xl ${className}`}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">Bridge and Execute</h2>
        <p className="text-gray-300">
          Bridge tokens and execute a smart contract function on the destination chain in a single flow.
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Bridge Configuration */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white mb-4">Bridge Configuration</h3>
          
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
                      {token.label} {tokenBalance ? `(${tokenBalance.balance.toFixed(6)})` : ''}
                    </option>
                  );
                })}
              </select>
              {(() => {
                const selectedTokenBalance = getTokenBalance(formData.token);
                return selectedTokenBalance && selectedTokenBalance.balance > 0 ? (
                  <div className="p-3 bg-gray-900 border border-green-500 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <img src={SUPPORTED_TOKENS.find(t => t.value === formData.token)?.icon} alt={formData.token} className="w-5 h-5" />
                        <span className="font-medium text-green-400 text-sm">
                          Available: {selectedTokenBalance.balance.toFixed(6)} {formData.token}
                        </span>
                      </div>
                      <span className="text-green-300 font-medium text-sm">
                        ${selectedTokenBalance.balanceInFiat.toFixed(2)}
                      </span>
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
                placeholder="Enter amount to bridge"
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
              value={formData.toChainId}
              onChange={(e) => handleInputChange('toChainId', parseInt(e.target.value))}
              className={inputClasses}
            >
              {SUPPORTED_CHAINS.map(chain => (
                <option key={chain.value} value={chain.value}>
                  {chain.label} ({chain.value})
                </option>
              ))}
            </select>
          </div>

          {/* Recipient (Optional) */}
          <div>
            <label className={labelClasses}>Recipient (Optional)</label>
            <input
              type="text"
              value={formData.recipient || ''}
              onChange={(e) => handleInputChange('recipient', e.target.value || undefined)}
              placeholder="0x... (leave empty to use your address)"
              className={inputClasses}
            />
          </div>

          {/* Source Chains */}
          <div>
            <label className={labelClasses}>Source Chains (Optional)</label>
            <p className="text-sm text-gray-400 mb-2">
              Select specific chains to source funds from.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {SUPPORTED_CHAINS.map(chain => {
                const isSelected = formData.sourceChains?.includes(chain.value) || false;
                return (
                  <label 
                    key={chain.value} 
                    className={`flex items-center space-x-2 p-2 rounded border cursor-pointer transition-colors text-xs ${
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
                    <img src={chain.logo} alt={chain.label} className="w-4 h-4" />
                    <span className="text-white">{chain.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column - Contract Execution */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white mb-4">Contract Execution</h3>
          
          {/* Contract Presets */}
          <div>
            <label className={labelClasses}>Quick Setup (Optional)</label>
            <select
              onChange={(e) => {
                const preset = COMMON_CONTRACTS.find(c => c.name === e.target.value);
                if (preset) handleContractPreset(preset);
              }}
              className={inputClasses}
            >
              <option value="">Select a preset contract...</option>
              {COMMON_CONTRACTS.map(contract => (
                <option key={contract.name} value={contract.name}>
                  {contract.name} - {contract.description}
                </option>
              ))}
            </select>
          </div>

          {/* Contract Address */}
          <div>
            <label className={labelClasses}>Contract Address</label>
            <input
              type="text"
              value={contractData.contractAddress}
              onChange={(e) => handleContractDataChange('contractAddress', e.target.value)}
              placeholder="0x..."
              className={inputClasses}
            />
          </div>

          {/* Contract ABI */}
          <div>
            <label className={labelClasses}>Contract ABI (JSON)</label>
            <textarea
              value={contractData.contractAbi}
              onChange={(e) => handleContractDataChange('contractAbi', e.target.value)}
              placeholder='[{"inputs":[],"name":"functionName","outputs":[],"stateMutability":"nonpayable","type":"function"}]'
              className={textareaClasses}
            />
          </div>

          {/* Function Name */}
          <div>
            <label className={labelClasses}>Function Name</label>
            <input
              type="text"
              value={contractData.functionName}
              onChange={(e) => handleContractDataChange('functionName', e.target.value)}
              placeholder="supply, deposit, swap, etc."
              className={inputClasses}
            />
          </div>

          {/* Function Parameters */}
          <div>
            <label className={labelClasses}>Function Parameters (JSON Array)</label>
            <input
              type="text"
              value={contractData.functionParams}
              onChange={(e) => handleContractDataChange('functionParams', e.target.value)}
              placeholder='["0x...", "1000000"]'
              className={inputClasses}
            />
            <p className="text-xs text-gray-400 mt-1">
              Use amount and userAddress will be auto-filled
            </p>
          </div>

          {/* Token Approval */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelClasses}>Approval Token</label>
              <select
                value={contractData.tokenApprovalToken}
                onChange={(e) => handleContractDataChange('tokenApprovalToken', e.target.value)}
                className={inputClasses}
              >
                {SUPPORTED_TOKENS.map(token => (
                  <option key={token.value} value={token.value}>
                    {token.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClasses}>Approval Amount</label>
              <input
                type="text"
                value={contractData.tokenApprovalAmount}
                onChange={(e) => handleContractDataChange('tokenApprovalAmount', e.target.value)}
                placeholder="Leave empty for auto"
                className={inputClasses}
              />
            </div>
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
          {isSimulating ? 'Simulating...' : 'Simulate Bridge & Execute'}
        </button>
        <button
          onClick={handleBridgeAndExecute}
          disabled={isLoading || isSimulating}
          className={`${buttonClasses} bg-blue-600 text-white hover:bg-blue-700 border border-blue-500`}
        >
          {isLoading ? 'Executing...' : 'Bridge & Execute'}
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
              <span className="font-medium text-white">Steps:</span>
              <pre className="mt-1 p-2 bg-black rounded border border-gray-700 text-xs overflow-auto text-gray-300">
                {JSON.stringify(simulationResult.steps, null, 2)}
              </pre>
            </div>
            <div>
              <span className="font-medium text-white">Total Estimated Cost:</span>
              <span className="ml-2 text-blue-300">
                {typeof simulationResult.totalEstimatedCost === 'string' 
                  ? simulationResult.totalEstimatedCost 
                  : JSON.stringify(simulationResult.totalEstimatedCost)
                }
              </span>
            </div>
            {simulationResult.metadata && (
              <div className="space-y-1">
                <div>
                  <span className="font-medium text-white">Approval Required:</span>
                  <span className="ml-2 text-blue-300">{simulationResult.metadata.approvalRequired ? 'Yes' : 'No'}</span>
                </div>
                <div>
                  <span className="font-medium text-white">Bridge Receive Amount:</span>
                  <span className="ml-2 text-blue-300">{simulationResult.metadata.bridgeReceiveAmount}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bridge and Execute Results */}
      {bridgeAndExecuteResult && (
        <div className="mt-6 p-4 bg-gray-900 border border-green-500 rounded-md">
          <h3 className="text-lg font-medium text-green-400 mb-3">Bridge & Execute Results</h3>
          {bridgeAndExecuteResult.success ? (
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium text-white">Bridge Skipped:</span>
                <span className="ml-2 text-green-300">{bridgeAndExecuteResult.bridgeSkipped ? 'Yes' : 'No'}</span>
              </div>
              {bridgeAndExecuteResult.bridgeTransactionHash && (
                <div>
                  <span className="font-medium text-white">Bridge Transaction:</span>
                  <a 
                    href={bridgeAndExecuteResult.bridgeExplorerUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="ml-2 text-blue-400 hover:underline"
                  >
                    {bridgeAndExecuteResult.bridgeTransactionHash}
                  </a>
                </div>
              )}
              {bridgeAndExecuteResult.executeTransactionHash && (
                <div>
                  <span className="font-medium text-white">Execute Transaction:</span>
                  <a 
                    href={bridgeAndExecuteResult.executeExplorerUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="ml-2 text-blue-400 hover:underline"
                  >
                    {bridgeAndExecuteResult.executeTransactionHash}
                  </a>
                </div>
              )}
              {bridgeAndExecuteResult.approvalTransactionHash && (
                <div>
                  <span className="font-medium text-white">Approval Transaction:</span>
                  <span className="ml-2 text-blue-400">{bridgeAndExecuteResult.approvalTransactionHash}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-red-300">
              <span className="font-medium">Error:</span> {bridgeAndExecuteResult.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
