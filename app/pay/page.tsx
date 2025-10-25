'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract } from 'wagmi';
import { useSearchParams } from 'next/navigation';
import { parseUnits, Address, decodeFunctionData } from 'viem';
import axios from 'axios';
import { transfer, getUnifiedBalances, isInitialized, bridgeAndExecute, simulateBridgeAndExecute ,simulateTransfer} from '@/lib/nexus';
import type { TransferParams, BridgeAndExecuteParams, BridgeAndExecuteSimulationResult } from '@avail-project/nexus-core';
import { getTokenAddress } from '@/lib/AcrossMainnet';
import { CustomConnectButton } from '@/components/ConnectButton';
import InitButton from '@/components/init-button';

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

const ALL_CHAINS = [...MAIN_CHAINS, ...ACROSS_CHAINS];

// Check if a chain is an Across chain
const isAcrossChain = (chainId: number) => {
  return ACROSS_CHAINS.some(chain => chain.value === chainId);
};

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

interface MerchantConfig {
  chainId: number;
  token: string;
  address: string;
  businessName: string;
  description?: string;
  amount?: string;
  timestamp: number;
}

interface PaymentResult {
  success: boolean;
  message: string;
  data?: any;
}

export default function PaymentPage() {
  const { address, isConnected } = useAccount();
  const { writeContract } = useWriteContract();
  const searchParams = useSearchParams();
  
  const [merchantConfig, setMerchantConfig] = useState<MerchantConfig | null>(null);
  const [amount, setAmount] = useState('');
  const [usdAmount, setUsdAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PaymentResult | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [balances, setBalances] = useState<any>(null);
  const [swapData, setSwapData] = useState<any>(null);
  const [approvalHash, setApprovalHash] = useState<string | null>(null);
  const [simulationResult, setSimulationResult] = useState<BridgeAndExecuteSimulationResult | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Parse merchant configuration from URL
  useEffect(() => {
    const configParam = searchParams.get('config');
    if (configParam) {
      try {
        const decodedConfig = JSON.parse(atob(configParam));
        setMerchantConfig(decodedConfig);
        
        // Set amount if provided by merchant
        if (decodedConfig.amount) {
          setAmount(decodedConfig.amount);
          setUsdAmount(decodedConfig.amount);
        }
      } catch (err) {
        setError('Invalid payment configuration');
      }
    } else {
      setError('No payment configuration found');
    }
  }, [searchParams]);

  // Check if initialized
  useEffect(() => {
    setInitialized(isInitialized());
  }, []);

  // Fetch balances when connected and initialized
  useEffect(() => {
    if (isConnected && initialized) {
      fetchBalances();
    }
  }, [isConnected, initialized]);

  const fetchBalances = async () => {
    try {
      const bal = await getUnifiedBalances();
      setBalances(bal);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch balances');
    }
  };

  const getUsdBalance = () => {
    if (!balances) return 0;
    const usdcBalance = balances.find((b: any) => b.symbol === 'USDC');
    const usdtBalance = balances.find((b: any) => b.symbol === 'USDT');
    return (usdcBalance?.balanceInFiat || 0) + (usdtBalance?.balanceInFiat || 0);
  };

  const getEthBalance = () => {
    if (!balances) return 0;
    const ethBalance = balances.find((b: any) => b.symbol === 'ETH');
    return ethBalance?.balanceInFiat || 0;
  };

  const handleTransfer = async () => {
    if (!address || !isConnected) {
      setError('Please connect your wallet first');
      return;
    }

    if (!initialized) {
      setError('Please initialize the SDK first');
      return;
    }

    if (!merchantConfig) {
      setError('Merchant configuration not found');
      return;
    }

    if (!amount) {
      setError('Please enter an amount');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const params: TransferParams = {
        token: merchantConfig.token as any,
        amount: amount,
        chainId: merchantConfig.chainId as any,
        recipient: merchantConfig.address as `0x${string}`,
        ...(address && { sourceChains: [] as any }),
      };

      console.log('Transfer params:', params);
      const transferResult = await transfer(params);
      
      setResult({
        success: true,
        message: 'Payment completed successfully!',
        data: transferResult,
      });
      setShowModal(true);
    } catch (err: any) {
      console.error('Transfer error:', err);
      setError(err.message || 'Payment failed');
      setResult({
        success: false,
        message: err.message || 'Payment failed',
      });
      setShowModal(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSimulateTransfer = async () => {
    if (!address || !isConnected) {
      setError('Please connect your wallet first');
      return;
    }

    if (!initialized) {
      setError('Please initialize the SDK first');
      return;
    }

    if (!merchantConfig) {
      setError('Merchant configuration not found');
      return;
    }

    if (!amount) {
      setError('Please enter an amount');
      return;
    }

    setIsSimulating(true);
    setError(null);
    setResult(null);

    try {
      const params: TransferParams = {
        token: merchantConfig.token as any,
        amount: amount,
        chainId: merchantConfig.chainId as any,
        recipient: merchantConfig.address as `0x${string}`,
        ...(address && { sourceChains: [] as any }),
      };

      console.log('Simulate Transfer params:', params);
      
      // Use the actual simulateTransfer function from the SDK
      const simResult = await simulateTransfer(params);
      
      setResult({
        success: true,
        message: 'Transfer simulation completed successfully!',
        data: {
          type: 'simulation',
          method: 'transfer',
          params: params,
          simulationResult: simResult,
          estimatedGas: '~50,000',
          estimatedTime: '~30 seconds',
          note: 'This is a simulation. No actual transaction will be executed.'
        },
      });
      setShowModal(true);
    } catch (err: any) {
      console.error('Simulate Transfer error:', err);
      setError(err.message || 'Simulation failed');
      setResult({
        success: false,
        message: err.message || 'Simulation failed',
      });
      setShowModal(true);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleBridgeAndExecute = async () => {
    if (!address || !isConnected) {
      setError('Please connect your wallet first');
      return;
    }

    if (!initialized) {
      setError('Please initialize the SDK first');
      return;
    }

    if (!merchantConfig) {
      setError('Merchant configuration not found');
      return;
    }

    if (!amount) {
      setError('Please enter an amount');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const amountWei = parseUnits(amount, TOKEN_DECIMALS['USDC'] || 18).toString();
      
      const inputTokenAddress = getTokenAddress(8453, 'USDC', true);
      const outputTokenAddress = getTokenAddress(merchantConfig.chainId, merchantConfig.token, false);

      if (!inputTokenAddress || !outputTokenAddress) {
        throw new Error('Token addresses not found for the selected route');
      }

      const { data: swapData } = await axios.get('https://across.to/api/swap/approval', {
        params: {
          tradeType: 'minOutput',
          amount: amountWei,
          inputToken: inputTokenAddress,
          originChainId: 8453,
          outputToken: outputTokenAddress,
          destinationChainId: merchantConfig.chainId,
          depositor: address,
          recipient: merchantConfig.address,
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
        toChainId: 8453 as any,
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
        message: 'Payment completed successfully!',
        data: bridgeResult,
      });
      setShowModal(true);
    } catch (err: any) {
      console.error('Bridge and Execute error:', err);
      setError(err.message || 'Payment failed');
      setResult({
        success: false,
        message: err.message || 'Payment failed',
      });
      setShowModal(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSimulateBridgeAndExecute = async () => {
    if (!address || !isConnected) {
      setError('Please connect your wallet first');
      return;
    }

    if (!initialized) {
      setError('Please initialize the SDK first');
      return;
    }

    if (!merchantConfig) {
      setError('Merchant configuration not found');
      return;
    }

    if (!amount) {
      setError('Please enter an amount');
      return;
    }

    setIsSimulating(true);
    setError(null);
    setResult(null);

    try {
      const amountWei = parseUnits(amount, TOKEN_DECIMALS['USDC'] || 18).toString();
      
      const inputTokenAddress = getTokenAddress(8453, 'USDC', true);
      const outputTokenAddress = getTokenAddress(merchantConfig.chainId, merchantConfig.token, false);

      if (!inputTokenAddress || !outputTokenAddress) {
        throw new Error('Token addresses not found for the selected route');
      }

      const { data: swapData } = await axios.get('https://across.to/api/swap/approval', {
        params: {
          tradeType: 'minOutput',
          amount: amountWei,
          inputToken: inputTokenAddress,
          originChainId: 8453,
          outputToken: outputTokenAddress,
          destinationChainId: merchantConfig.chainId,
          depositor: address,
          recipient: merchantConfig.address,
        }
      });

      console.log('Simulate Bridge and Execute - Swap Data from Across:', swapData);
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
        toChainId: 8453 as any,
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

      console.log('Simulate Bridge and Execute params:', params);
      
      const simResult = await simulateBridgeAndExecute(params);
      setSimulationResult(simResult);
      
      setResult({
        success: true,
        message: 'Bridge and execute simulation completed successfully!',
        data: {
          type: 'simulation',
          method: 'bridgeAndExecute',
          simulationResult: simResult,
          estimatedGas: '~150,000',
          estimatedTime: '~2-5 minutes',
          note: 'This is a simulation. No actual transaction will be executed.'
        },
      });
      setShowModal(true);
    } catch (err: any) {
      console.error('Simulate Bridge and Execute error:', err);
      setError(err.message || 'Simulation failed');
      setResult({
        success: false,
        message: err.message || 'Simulation failed',
      });
      setShowModal(true);
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

  if (!merchantConfig) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-2xl mb-4">❌ Invalid Payment Link</div>
          <div className="text-gray-300">
            This payment link is invalid or corrupted.
            <br />
            Please contact the merchant for a valid payment link.
          </div>
        </div>
      </div>
    );
  }

  const isDestinationAcross = isAcrossChain(merchantConfig.chainId);

  return (
    <div className="min-h-screen bg-black">
      {/* Status Bar */}
      <div className="flex justify-between items-center px-4 py-2 text-white text-sm">
        <span>3:19</span>
        <div className="flex items-center space-x-1">
          <div className="w-4 h-2 bg-white rounded-sm"></div>
          <div className="w-4 h-2 bg-white rounded-sm"></div>
          <div className="w-4 h-2 bg-white rounded-sm"></div>
          <span className="ml-2">57%</span>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4">
        <button className="text-white">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-semibold text-white">Payment</h1>
        <div className="flex items-center bg-blue-600 px-3 py-1 rounded-full text-sm text-white">
          <div className="w-2 h-2 bg-blue-300 rounded-full mr-2"></div>
          {ALL_CHAINS.find(c => c.value === merchantConfig.chainId)?.label}
          <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Main Amount Display */}
      <div className="px-4 py-8 text-center">
        <div className="text-6xl font-bold text-blue-500 mb-2">
          ${merchantConfig.amount || '0.00'}
        </div>
        <div className="text-white text-lg mb-1">
          {merchantConfig.amount ? `${merchantConfig.amount} ${merchantConfig.token}` : `0.00 ${merchantConfig.token}`}
        </div>
        <div className="text-gray-400 text-sm">
          {balances ? `$${getUsdBalance().toFixed(2)} available` : 'Loading balance...'}
        </div>
      </div>

      {/* Wallet Balances Section */}
      {balances && (
        <div className="px-4 py-4">
          <div className="bg-gray-900 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold text-lg">Your Portfolio</h3>
              <div className="text-right">
                <div className="text-2xl font-bold text-white">${(getUsdBalance() + getEthBalance()).toFixed(2)}</div>
                <div className="text-gray-400 text-sm">Total Balance</div>
              </div>
            </div>
            
            <div className="space-y-3">
              {balances.slice(0, 5).map((balance: any, index: number) => (
                <div key={balance.symbol} className="flex items-center justify-between py-2">
                  <div className="flex items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 ${
                      balance.symbol === 'ETH' ? 'bg-blue-600' :
                      balance.symbol === 'USDC' ? 'bg-green-600' :
                      balance.symbol === 'USDT' ? 'bg-blue-500' :
                      balance.symbol === 'MATIC' ? 'bg-purple-600' :
                      balance.symbol === 'AVAX' ? 'bg-red-600' :
                      'bg-gray-600'
                    }`}>
                      <span className="text-white font-bold text-sm">
                        {balance.symbol === 'ETH' ? 'Ξ' :
                         balance.symbol === 'USDC' ? '$' :
                         balance.symbol === 'USDT' ? '₮' :
                         balance.symbol === 'MATIC' ? 'M' :
                         balance.symbol === 'AVAX' ? 'A' :
                         balance.symbol.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <div className="text-white font-medium">{balance.symbol}</div>
                      <div className="text-gray-400 text-sm">
                        {balance.symbol === 'ETH' ? 'Ethereum' :
                         balance.symbol === 'USDC' ? 'USD Coin' :
                         balance.symbol === 'USDT' ? 'Tether USD' :
                         balance.symbol === 'MATIC' ? 'Polygon' :
                         balance.symbol === 'AVAX' ? 'Avalanche' :
                         balance.symbol}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-white font-medium">
                      ${balance.balanceInFiat ? parseFloat(balance.balanceInFiat).toFixed(2) : '0.00'}
                    </div>
                    <div className="text-gray-400 text-sm">
                      {parseFloat(balance.balance).toFixed(4)} {balance.symbol}
                    </div>
                  </div>
                </div>
              ))}
              
              {balances.length > 5 && (
                <div className="text-center pt-2">
                  <button className="text-blue-400 text-sm hover:text-blue-300">
                    View all {balances.length} assets
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Merchant Info */}
      <div className="px-4 py-4">
        <div className="bg-gray-900 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mr-3">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <div className="text-white font-medium">{merchantConfig.businessName}</div>
                <div className="text-gray-400 text-sm">{merchantConfig.description || 'Payment Request'}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-white text-sm">{merchantConfig.token}</div>
              <div className="text-gray-400 text-xs">
                {ALL_CHAINS.find(c => c.value === merchantConfig.chainId)?.label}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Setup Section - Only show if not connected/initialized */}
      {(!isConnected || !initialized) && (
        <div className="px-4 py-4">
          <div className="bg-gray-900 rounded-2xl p-4">
            <h3 className="text-white font-medium mb-4">Setup Required</h3>
            <div className="space-y-3">
              <CustomConnectButton />
              <InitButton 
                className="w-full px-4 py-3 bg-purple-600 text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-purple-700 transition" 
                onReady={() => setInitialized(true)} 
              />
            </div>
          </div>
        </div>
      )}

      {/* Pay Button */}
      <div className="px-4 py-6">
        <button
          onClick={() => setShowPaymentModal(true)}
          disabled={!isConnected || !initialized}
          className="w-full py-4 bg-blue-600 text-white rounded-2xl font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-all"
        >
          {!isConnected ? 'Connect Wallet to Pay' : 
           !initialized ? 'Initialize SDK to Pay' : 
           'Pay Merchant'}
        </button>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end z-50">
          <div className="bg-gray-900 rounded-t-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">Payment Details</h2>
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Merchant Info */}
              <div className="bg-gray-800 rounded-xl p-4 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mr-3">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-white font-medium">{merchantConfig.businessName}</div>
                      <div className="text-gray-400 text-sm">{merchantConfig.description || 'Payment Request'}</div>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">Chain:</span>
                    <div className="text-white font-medium">
                      {ALL_CHAINS.find(c => c.value === merchantConfig.chainId)?.label}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-400">Token:</span>
                    <div className="text-white font-medium">{merchantConfig.token}</div>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-400">Address:</span>
                    <div className="text-white font-mono text-xs">
                      {merchantConfig.address.slice(0, 10)}...{merchantConfig.address.slice(-8)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Amount Input */}
              <div className="mb-6">
                <label className="block text-white font-medium mb-2">Amount to Pay</label>
                <div className="relative">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      setUsdAmount(e.target.value);
                    }}
                    placeholder="Enter amount"
                    step="0.000001"
                    className="w-full px-4 py-3 pr-20 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-2">
                    <button
                      onClick={() => {
                        const tokenBalance = balances?.find((b: any) => b.symbol === merchantConfig.token);
                        if (tokenBalance) {
                          setAmount(parseFloat(tokenBalance.balance).toString());
                          setUsdAmount(parseFloat(tokenBalance.balance).toString());
                        }
                      }}
                      className="text-blue-400 text-xs font-medium hover:text-blue-300 transition-colors"
                    >
                      Max
                    </button>
                    <div className="text-gray-400 text-sm">
                      {merchantConfig.token}
                    </div>
                  </div>
                </div>
                {merchantConfig.amount && (
                  <p className="text-xs text-gray-400 mt-1">
                    Fixed amount: {merchantConfig.amount} {merchantConfig.token}
                  </p>
                )}
                {balances && (
                  <p className="text-xs text-gray-400 mt-1">
                    Available: {balances.find((b: any) => b.symbol === merchantConfig.token)?.balance || '0'} {merchantConfig.token}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                {/* Simulate Button */}
                <button
                  onClick={isDestinationAcross ? handleSimulateBridgeAndExecute : handleSimulateTransfer}
                  disabled={isSimulating || !isConnected || !initialized || !amount}
                  className="w-full px-6 py-3 bg-purple-600/20 border border-purple-500/30 text-purple-300 rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-purple-600/30 transition-all flex items-center justify-center"
                >
                  {isSimulating ? (
                    <div className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-purple-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Simulating...
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      Simulate Payment
                    </div>
                  )}
                </button>

                {/* Payment Button */}
                <button
                  onClick={isDestinationAcross ? handleBridgeAndExecute : handleTransfer}
                  disabled={isLoading || isSimulating || !isConnected || !initialized || !amount}
                  className="w-full px-6 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:from-green-700 hover:to-emerald-700 transition-all transform hover:scale-105"
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing Payment...
                    </div>
                  ) : (
                    <div className="flex items-center justify-center">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                      </svg>
                      Pay {amount || '0'} {merchantConfig.token}
                    </div>
                  )}
                </button>
              </div>

              {/* Approval button if needed for Across chains */}
              {isDestinationAcross && swapData && needsApproval() && (
                <button
                  onClick={handleApproval}
                  disabled={isLoading || !!approvalHash}
                  className="w-full px-6 py-3 bg-gray-700 text-white rounded-xl font-medium disabled:opacity-50 mt-3"
                >
                  {approvalHash ? `Approved: ${approvalHash}` : 'Approve Tokens First'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Result Modal */}
      {showModal && result && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg border border-gray-700 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-2xl font-bold text-white">
                  {result.success ? '✅ Payment Successful' : '❌ Payment Failed'}
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
