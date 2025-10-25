'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';

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
  { value: 59144, label: 'Linea (Across)', nativeCurrency: 'USDC' },
  { value: 534352, label: 'Scroll (Across)', nativeCurrency: 'USDC' },
  { value: 480, label: 'World (Across)', nativeCurrency: 'USDC' },
  { value: 130, label: 'Horizen EON (Across)', nativeCurrency: 'USDC' },
  { value: 232, label: 'Espresso (Across)', nativeCurrency: 'USDC' },
  { value: 999, label: 'HyperEVM (Across)', nativeCurrency: 'USDC' },
];

// Combined chains list
const MERCHANT_CHAINS = [...MAIN_CHAINS, ...ACROSS_CHAINS];

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

interface MerchantConfig {
  chainId: number;
  token: string;
  address: string;
  businessName: string;
  description?: string;
  amount?: string;
}

export default function MerchantSetupPage() {
  const { address, isConnected } = useAccount();
  
  const [config, setConfig] = useState<MerchantConfig>({
    chainId: 1,
    token: 'ETH',
    address: '',
    businessName: '',
    description: '',
    amount: '',
  });
  
  const [generatedUrl, setGeneratedUrl] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Reset token when chain changes
  useEffect(() => {
    const availableTokens = getTokensForChain(config.chainId);
    if (availableTokens.length > 0) {
      setConfig(prev => ({
        ...prev,
        token: availableTokens[0].value
      }));
    }
  }, [config.chainId]);

  // Auto-fill address if wallet is connected
  useEffect(() => {
    if (isConnected && address && !config.address) {
      setConfig(prev => ({
        ...prev,
        address: address
      }));
    }
  }, [isConnected, address, config.address]);

  const validateConfig = (): string | null => {
    if (!config.businessName.trim()) {
      return 'Business name is required';
    }
    if (!config.address.trim()) {
      return 'Receiving address is required';
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(config.address)) {
      return 'Please enter a valid Ethereum address';
    }
    if (config.amount && isNaN(Number(config.amount))) {
      return 'Amount must be a valid number';
    }
    return null;
  };

  const generatePaymentUrl = async () => {
    const validationError = validateConfig();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsGenerating(true);
    setError(null);
    setSuccess(null);

    try {
      // Create the payment configuration object
      const paymentConfig = {
        chainId: config.chainId,
        token: config.token,
        address: config.address,
        businessName: config.businessName,
        description: config.description || '',
        amount: config.amount || '',
        timestamp: Date.now(),
      };

      // Encode the configuration as base64
      const encodedConfig = btoa(JSON.stringify(paymentConfig));
      
      // Create the payment URL
      const baseUrl = process.env.NODE_ENV === 'production' 
        ? 'https://your-domain.com' 
        : 'http://localhost:3000';
      
      const paymentUrl = `${baseUrl}/pay?config=${encodedConfig}`;
      
      setGeneratedUrl(paymentUrl);
      setSuccess('Payment URL generated successfully!');
      
    } catch (err: any) {
      setError(`Failed to generate URL: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setSuccess('URL copied to clipboard!');
      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      setError('Failed to copy to clipboard');
    }
  };

  const downloadQRCode = () => {
    // This would generate a QR code - for now, we'll just show a placeholder
    setSuccess('QR Code generation would be implemented here');
  };

  const resetConfig = () => {
    setConfig({
      chainId: 1,
      token: 'ETH',
      address: '',
      businessName: '',
      description: '',
      amount: '',
    });
    setGeneratedUrl('');
    setError(null);
    setSuccess(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full mb-6">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">Merchant Payment Setup</h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Configure your payment preferences and generate a secure payment URL for your customers
          </p>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="mb-8 p-4 bg-red-900/20 border border-red-500/30 text-red-300 rounded-xl backdrop-blur-sm">
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          </div>
        )}
        
        {success && (
          <div className="mb-8 p-4 bg-green-900/20 border border-green-500/30 text-green-300 rounded-xl backdrop-blur-sm">
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              {success}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Configuration Form */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
              <svg className="w-6 h-6 mr-3 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Payment Configuration
            </h2>
            
            <div className="space-y-6">
              {/* Business Information */}
              <div>
                <label className="block text-white font-medium mb-2">Business Name *</label>
                <input
                  type="text"
                  value={config.businessName}
                  onChange={(e) => setConfig(prev => ({ ...prev, businessName: e.target.value }))}
                  placeholder="Enter your business name"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label className="block text-white font-medium mb-2">Description (Optional)</label>
                <textarea
                  value={config.description}
                  onChange={(e) => setConfig(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of your business"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all h-20 resize-none"
                />
              </div>

              {/* Chain Selection */}
              <div>
                <label className="block text-white font-medium mb-2">Preferred Chain *</label>
                <select
                  value={config.chainId}
                  onChange={(e) => setConfig(prev => ({ ...prev, chainId: Number(e.target.value) }))}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                >
                  {MERCHANT_CHAINS.map(chain => (
                    <option key={chain.value} value={chain.value} className="bg-gray-800">
                      {chain.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Token Selection */}
              <div>
                <label className="block text-white font-medium mb-2">Preferred Token *</label>
                <select
                  value={config.token}
                  onChange={(e) => setConfig(prev => ({ ...prev, token: e.target.value }))}
                  disabled={isAcrossChain(config.chainId)}
                  className={`w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all ${
                    isAcrossChain(config.chainId) ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {getTokensForChain(config.chainId).map(token => (
                    <option key={token.value} value={token.value} className="bg-gray-800">
                      {token.label}
                    </option>
                  ))}
                </select>
                {isAcrossChain(config.chainId) && (
                  <p className="text-xs text-gray-400 mt-1">Only USDC supported for Across chains</p>
                )}
              </div>

              {/* Receiving Address */}
              <div>
                <label className="block text-white font-medium mb-2">Receiving Address *</label>
                <div className="relative">
                  <input
                    type="text"
                    value={config.address}
                    onChange={(e) => setConfig(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="0x..."
                    className="w-full px-4 py-3 pr-12 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all font-mono text-sm"
                  />
                  {isConnected && (
                    <button
                      onClick={() => setConfig(prev => ({ ...prev, address: address || '' }))}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-purple-400 hover:text-purple-300 transition-colors"
                      title="Use connected wallet address"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-1">Enter the address where you want to receive payments</p>
              </div>

              {/* Amount (Optional) */}
              <div>
                <label className="block text-white font-medium mb-2">Fixed Amount (Optional)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={config.amount}
                    onChange={(e) => setConfig(prev => ({ ...prev, amount: e.target.value }))}
                    placeholder="0.0"
                    step="0.000001"
                    className="w-full px-4 py-3 pr-16 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm">
                    {config.token}
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-1">Leave empty to allow customers to enter any amount</p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 pt-4">
                <button
                  onClick={generatePaymentUrl}
                  disabled={isGenerating}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:from-purple-700 hover:to-pink-700 transition-all transform hover:scale-105"
                >
                  {isGenerating ? (
                    <div className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Generating...
                    </div>
                  ) : (
                    'Generate Payment URL'
                  )}
                </button>
                
                <button
                  onClick={resetConfig}
                  className="px-6 py-3 bg-white/10 border border-white/20 text-white rounded-xl font-medium hover:bg-white/20 transition-all"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>

          {/* Generated URL Display */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
              <svg className="w-6 h-6 mr-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Payment URL
            </h2>
            
            {generatedUrl ? (
              <div className="space-y-6">
                <div className="bg-black/30 rounded-xl p-4 border border-white/10">
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-sm font-medium text-gray-300">Generated URL:</span>
                    <button
                      onClick={() => copyToClipboard(generatedUrl)}
                      className="text-purple-400 hover:text-purple-300 transition-colors"
                      title="Copy URL"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                  <div className="bg-gray-900 rounded-lg p-3 overflow-x-auto">
                    <code className="text-green-400 text-sm break-all">{generatedUrl}</code>
                  </div>
                </div>

                <div className="space-y-3">
                  <button
                    onClick={() => copyToClipboard(generatedUrl)}
                    className="w-full px-4 py-3 bg-green-600/20 border border-green-500/30 text-green-300 rounded-xl font-medium hover:bg-green-600/30 transition-all flex items-center justify-center"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy URL
                  </button>
                  
                  <button
                    onClick={downloadQRCode}
                    className="w-full px-4 py-3 bg-purple-600/20 border border-purple-500/30 text-purple-300 rounded-xl font-medium hover:bg-purple-600/30 transition-all flex items-center justify-center"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                    </svg>
                    Download QR Code
                  </button>
                </div>

                <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-4">
                  <h3 className="text-blue-300 font-medium mb-2">Configuration Details:</h3>
                  <div className="space-y-1 text-sm text-gray-300">
                    <div><span className="text-gray-400">Business:</span> {config.businessName}</div>
                    <div><span className="text-gray-400">Chain:</span> {MERCHANT_CHAINS.find(c => c.value === config.chainId)?.label}</div>
                    <div><span className="text-gray-400">Token:</span> {config.token}</div>
                    <div><span className="text-gray-400">Address:</span> <code className="text-xs">{config.address.slice(0, 10)}...{config.address.slice(-8)}</code></div>
                    {config.amount && <div><span className="text-gray-400">Amount:</span> {config.amount} {config.token}</div>}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-700/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                </div>
                <p className="text-gray-400">Configure your payment settings and generate a URL</p>
              </div>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-12 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center">
            <svg className="w-6 h-6 mr-3 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            How to Use
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-gray-300">
            <div className="space-y-2">
              <h4 className="font-semibold text-white">1. Configure</h4>
              <p className="text-sm">Set your business details, preferred chain, token, and receiving address.</p>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-white">2. Generate</h4>
              <p className="text-sm">Click "Generate Payment URL" to create a secure, encoded payment link.</p>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-white">3. Share</h4>
              <p className="text-sm">Share the URL with customers or embed it in your website for payments.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
