'use client';

import { useState, useEffect, useRef } from 'react';
import { useAccount } from 'wagmi';
import { CustomCursor } from '@/components/custom-cursor';
import { GrainOverlay } from '@/components/grain-overlay';
import { Shader, ChromaFlow, Swirl } from "shaders/react";
import { useAddSubname, useIsSubnameAvailable, useUpdateSubname } from '@justaname.id/react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import QRCode from 'qrcode';

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
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  
  const [config, setConfig] = useState<MerchantConfig>({
    chainId: 1,
    token: 'ETH',
    address: '',
    businessName: '',
    description: '',
    amount: '',
  });
  
  const [merchantSubname, setMerchantSubname] = useState<string>('');
  const [isSubnameRegistered, setIsSubnameRegistered] = useState<boolean>(false);
  const [generatedUrl, setGeneratedUrl] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [isTestingMode, setIsTestingMode] = useState(false); // Testing mode to skip subname registration

  // Subname hooks
  const { isSubnameAvailable } = useIsSubnameAvailable({ 
    username: merchantSubname 
  });
  const { addSubname } = useAddSubname();
  const { updateSubname, isUpdateSubnamePending } = useUpdateSubname();
  const [isUpdatingSubname, setIsUpdatingSubname] = useState(false);

  // Shader loading effect
  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 1000);
    return () => clearTimeout(timer);
  }, []);

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
      return 'Business name (subname) is required';
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
    if (!isSubnameRegistered && !isTestingMode) {
      return 'Subname must be registered before proceeding';
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
        ? 'https://nexxpay.vercel.app' 
        : 'https://nexxpay.vercel.app';
      
      const paymentUrl = `${baseUrl}/pay?config=${encodedConfig}`;
      
      setGeneratedUrl(paymentUrl);
      
      // Generate QR code preview
      try {
        const qrDataUrl = await QRCode.toDataURL(paymentUrl, {
          width: 256,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF',
          },
        });
        setQrCodeDataUrl(qrDataUrl);
      } catch (qrErr) {
        console.error('Failed to generate QR code preview:', qrErr);
      }
      
      setSuccess('Payment URL generated successfully!');
      
      // Store payment URL on-chain if subname is registered (not in testing mode)
      if (config.businessName && isTestingMode && isSubnameRegistered) {
        await storePaymentUrlOnChain(paymentUrl);
      }
      
    } catch (err: any) {
      setError(`Failed to generate URL: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const storePaymentUrlOnChain = async (paymentUrl: string) => {
    if (!config.businessName) {
      console.error('No business name configured');
      return;
    }

    setIsUpdatingSubname(true);
    setSuccess('Storing payment URL on-chain...');

    try {
      await updateSubname({
        ens: config.businessName,
        text: [
          { key: 'url', value: paymentUrl },
        ],
      });
      
      setSuccess('Payment URL stored on-chain successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Failed to store URL on-chain:', err);
      setError(`Failed to store URL on-chain: ${err.message}`);
    } finally {
      setIsUpdatingSubname(false);
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

  const downloadQRCode = async () => {
    if (!generatedUrl) {
      setError('Please generate a payment URL first');
      return;
    }

    try {
      setSuccess('Generating QR code...');
      
      // Generate QR code as data URL
      const qrDataUrl = await QRCode.toDataURL(generatedUrl, {
        width: 512,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });

      // Create a temporary link to download the QR code
      const link = document.createElement('a');
      link.href = qrDataUrl;
      link.download = `payment-qr-${config.businessName.split('.')[0]}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setSuccess('QR code downloaded successfully!');
      setTimeout(() => setSuccess(null), 2000);
    } catch (err: any) {
      setError(`Failed to generate QR code: ${err.message}`);
    }
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
    setMerchantSubname('');
    setIsSubnameRegistered(false);
    setError(null);
    setSuccess(null);
    setQrCodeDataUrl(null);
    setIsTestingMode(false);
  };

  const handleSubnameRegistration = async () => {
    if (!merchantSubname || !isConnected || !address) {
      setError('Please connect wallet and enter a subname');
      return;
    }

    if (!isSubnameAvailable?.isAvailable) {
      setError('Subname is not available');
      return;
    }

    try {
      await addSubname({ 
        username: merchantSubname, 
        ensDomain: "resolverlens.eth", 
        chainId: 1,
        addresses: {
          2147492101: address,
        }
      });
      
      // Set the business name to the full subname
      const fullSubname = `${merchantSubname}.resolverlens.eth`;
      setConfig(prev => ({
        ...prev,
        businessName: fullSubname
      }));
      
      setIsSubnameRegistered(true);
      setSuccess(`Subname ${fullSubname} registered successfully!`);
      
      // Auto-proceed to next step after successful registration
      setTimeout(() => {
        setCurrentStep(2);
        setSuccess(null);
      }, 2000);
      
    } catch (error) {
      console.error('Error claiming subname:', error);
      setError('Failed to register subname. Please try again.');
    }
  };

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-background">
      <CustomCursor />
      <GrainOverlay />

      {/* Shader Background */}
      <div
        className={`fixed inset-0 z-0 transition-opacity duration-700 ${isLoaded ? "opacity-100" : "opacity-0"}`}
        style={{ contain: "strict" }}
      >
        <Shader className="h-full w-full">
          <Swirl
            colorA="#1275d8"
            colorB="#e19136"
            speed={0.8}
            detail={0.8}
            blend={50}
            coarseX={40}
            coarseY={40}
            mediumX={40}
            mediumY={40}
            fineX={40}
            fineY={40}
          />
          <ChromaFlow
            baseColor="#0066ff"
            upColor="#0066ff"
            downColor="#d1d1d1"
            leftColor="#e19136"
            rightColor="#e19136"
            intensity={0.9}
            radius={1.8}
            momentum={25}
            maskType="alpha"
            opacity={0.97}
          />
        </Shader>
        <div className="absolute inset-0 bg-black/20" />
      </div>

      <div className={`relative z-10 py-12 transition-opacity duration-700 ${isLoaded ? "opacity-100" : "opacity-0"}`}>
        <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full mb-6">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-4">Merchant Onboarding</h1>
          <p className="text-xl text-foreground/80 max-w-2xl mx-auto">
            Complete your merchant setup in 3 simple steps
          </p>
        </div>

        {/* Step Progress */}
        <div className="mb-12">
          <div className="flex items-center justify-center space-x-8">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                  currentStep >= step 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-foreground/20 text-foreground/60'
                }`}>
                  {step}
                </div>
                {step < 3 && (
                  <div className={`w-16 h-px mx-4 transition-all ${
                    currentStep > step ? 'bg-blue-600' : 'bg-foreground/20'
                  }`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-center mt-4 space-x-16">
            <span className={`text-sm font-medium ${currentStep >= 1 ? 'text-foreground' : 'text-foreground/60'}`}>
              Onboard Merchant
            </span>
            <span className={`text-sm font-medium ${currentStep >= 2 ? 'text-foreground' : 'text-foreground/60'}`}>
              Chain Details
            </span>
            <span className={`text-sm font-medium ${currentStep >= 3 ? 'text-foreground' : 'text-foreground/60'}`}>
              Generate Link
            </span>
          </div>
        </div>

        {/* Status Messages */}
        {isTestingMode && (
          <div className="mb-8 p-4 bg-yellow-900/20 border-2 border-yellow-500/50 text-yellow-300 rounded-xl backdrop-blur-sm">
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              🧪 Testing Mode Active - Subname registration skipped
            </div>
          </div>
        )}
        
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

        {/* Step Content */}
        <div className="bg-foreground/5 backdrop-blur-sm border border-foreground/10 rounded-2xl p-8">
          {currentStep === 1 && (
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center">
                <svg className="w-6 h-6 mr-3 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Step 1: Merchant Onboarding
              </h2>
            
              <div className="space-y-6">
                {/* Business Name with Subname Integration */}
                <div>
                  <label className="block text-foreground font-medium mb-2">Business Name (Subname) *</label>
                  <p className="text-sm text-foreground/60 mb-3">This will be your business name: <span className="text-blue-400 font-mono">{merchantSubname || 'yourname'}.resolverlens.eth</span></p>
                  <div className="relative">
                    <input
                      type="text"
                      value={merchantSubname}
                      onChange={(e) => setMerchantSubname(e.target.value)}
                      placeholder="Enter your business subname"
                      className="w-full px-4 py-3 pr-32 bg-foreground/10 border border-foreground/20 rounded-xl text-foreground placeholder-foreground/60 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-foreground/60 text-sm">
                      .resolverlens.eth
                    </div>
                  </div>
                  
                  {/* Subname Availability Status */}
                  {merchantSubname && (
                    <div className="mt-3">
                      {isSubnameAvailable?.isAvailable === true ? (
                        <div className="flex items-center text-green-400">
                          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Available! You can register this subname.
                        </div>
                      ) : isSubnameAvailable?.isAvailable === false ? (
                        <div className="flex items-center text-red-400">
                          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Already taken. Please choose a different subname.
                        </div>
                      ) : null}
                    </div>
                  )}

                  {/* Registration Status */}
                  {isSubnameRegistered && (
                    <div className="mt-3 flex items-center text-green-400">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Subname registered successfully! Proceeding to next step...
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-foreground font-medium mb-2">Description (Optional)</label>
                  <textarea
                    value={config.description}
                    onChange={(e) => setConfig(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Brief description of your business"
                    className="w-full px-4 py-3 bg-foreground/10 border border-foreground/20 rounded-xl text-foreground placeholder-foreground/60 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all h-20 resize-none"
                  />
                </div>

                {/* Wallet Connection */}
                <div>
                  <label className="block text-foreground font-medium mb-2">Connect Wallet</label>
                  <ConnectButton />
                </div>

                {/* Register Button */}
                <div className="space-y-3">
                  <button
                    onClick={handleSubnameRegistration}
                    disabled={!merchantSubname || !isConnected || !isSubnameAvailable?.isAvailable || isSubnameRegistered}
                    className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:from-blue-700 hover:to-purple-700 transition-all transform hover:scale-105"
                  >
                    {!isConnected ? 'Connect Wallet to Register' : 
                     !merchantSubname ? 'Enter a subname' :
                     !isSubnameAvailable?.isAvailable ? 'Subname not available' :
                     isSubnameRegistered ? 'Subname Registered ✓' :
                     'Register Subname'}
                  </button>
                  
                  {/* Testing Mode Skip Button */}
                  <button
                    onClick={() => {
                      setIsTestingMode(true);
                      setIsSubnameRegistered(true);
                      if (!config.businessName.trim() && merchantSubname) {
                        setConfig(prev => ({
                          ...prev,
                          businessName: `${merchantSubname}.resolverlens.eth`
                        }));
                      }
                      setSuccess('Testing mode enabled - Skipping subname registration');
                      setTimeout(() => {
                        setCurrentStep(2);
                        setSuccess(null);
                      }, 1500);
                    }}
                    className="w-full px-6 py-3 bg-yellow-600/20 border-2 border-yellow-500/50 text-yellow-400 rounded-xl font-medium hover:bg-yellow-600/30 transition-all"
                  >
                    🧪 Skip Registration (Testing Mode)
                  </button>
                </div>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center">
                <svg className="w-6 h-6 mr-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Step 2: Chain Details
              </h2>

              <div className="space-y-6">
                {/* Chain Selection */}
                <div>
                  <label className="block text-foreground font-medium mb-2">Preferred Chain *</label>
                  <select
                    value={config.chainId}
                    onChange={(e) => setConfig(prev => ({ ...prev, chainId: Number(e.target.value) }))}
                    className="w-full px-4 py-3 bg-foreground/10 border border-foreground/20 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
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
                  <label className="block text-foreground font-medium mb-2">Preferred Token *</label>
                  <select
                    value={config.token}
                    onChange={(e) => setConfig(prev => ({ ...prev, token: e.target.value }))}
                    disabled={isAcrossChain(config.chainId)}
                    className={`w-full px-4 py-3 bg-foreground/10 border border-foreground/20 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
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
                    <p className="text-xs text-foreground/60 mt-1">Only USDC supported for Across chains</p>
                  )}
                </div>

                {/* Receiving Address */}
                <div>
                  <label className="block text-foreground font-medium mb-2">Receiving Address *</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={config.address}
                      onChange={(e) => setConfig(prev => ({ ...prev, address: e.target.value }))}
                      placeholder="0x..."
                      className="w-full px-4 py-3 pr-12 bg-foreground/10 border border-foreground/20 rounded-xl text-foreground placeholder-foreground/60 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-mono text-sm"
                    />
                    {isConnected && (
                      <button
                        onClick={() => setConfig(prev => ({ ...prev, address: address || '' }))}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-blue-400 hover:text-blue-300 transition-colors"
                        title="Use connected wallet address"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-foreground/60 mt-1">Enter the address where you want to receive payments</p>
                </div>

                {/* Amount (Optional) */}
                <div>
                  <label className="block text-foreground font-medium mb-2">Fixed Amount (Optional)</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={config.amount}
                      onChange={(e) => setConfig(prev => ({ ...prev, amount: e.target.value }))}
                      placeholder="0.0"
                      step="0.000001"
                      className="w-full px-4 py-3 pr-16 bg-foreground/10 border border-foreground/20 rounded-xl text-foreground placeholder-foreground/60 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-foreground/60 text-sm">
                      {config.token}
                    </div>
                  </div>
                  <p className="text-xs text-foreground/60 mt-1">Leave empty to allow customers to enter any amount</p>
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    onClick={() => setCurrentStep(1)}
                    className="px-6 py-3 bg-foreground/10 border border-foreground/20 text-foreground rounded-xl font-medium hover:bg-foreground/20 transition-all"
                  >
                    Back
                  </button>
                  <button
                    onClick={async () => {
                      await generatePaymentUrl();
                      setCurrentStep(3);
                    }}
                    disabled={!config.address || !config.chainId || (!isSubnameRegistered && !isTestingMode)}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:from-blue-700 hover:to-purple-700 transition-all transform hover:scale-105"
                  >
                    Generate Payment Link
                  </button>
                </div>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center">
                <svg className="w-6 h-6 mr-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Step 3: Payment Link Generated
              </h2>

              <div className="space-y-6">
                {/* QR Code Display */}
                {qrCodeDataUrl && (
                  <div className="flex flex-col items-center bg-black/30 rounded-xl p-6 border border-foreground/10">
                    <h3 className="text-lg font-semibold text-foreground mb-4">Scan to Pay</h3>
                    <div className="bg-white p-4 rounded-lg shadow-lg">
                      <img src={qrCodeDataUrl} alt="Payment QR Code" className="w-64 h-64" />
                    </div>
                    <p className="text-sm text-foreground/60 mt-4 text-center">
                      Customers can scan this QR code to make payments
                    </p>
                  </div>
                )}

                <div className="bg-black/30 rounded-xl p-4 border border-foreground/10">
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-sm font-medium text-foreground/80">Generated Payment URL:</span>
                    <button
                      onClick={() => copyToClipboard(generatedUrl)}
                      className="text-blue-400 hover:text-blue-300 transition-colors"
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    onClick={() => copyToClipboard(generatedUrl)}
                    className="px-4 py-3 bg-green-600/20 border border-green-500/30 text-green-300 rounded-xl font-medium hover:bg-green-600/30 transition-all flex items-center justify-center"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy URL
                  </button>
                  
                  <button
                    onClick={downloadQRCode}
                    className="px-4 py-3 bg-purple-600/20 border border-purple-500/30 text-purple-300 rounded-xl font-medium hover:bg-purple-600/30 transition-all flex items-center justify-center"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                    </svg>
                    Download QR Code
                  </button>
                </div>

                {/* Store on-chain button (only show if subname is registered and not in testing mode) */}
                {!isTestingMode && isSubnameRegistered && config.businessName && (
                  <div className="bg-gradient-to-r from-orange-900/20 to-pink-900/20 border-2 border-orange-500/30 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-orange-300 font-medium">Store on-chain (ENS)</h3>
                      {isUpdatingSubname && (
                        <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                      )}
                    </div>
                    <p className="text-sm text-orange-200/80 mb-3">
                      Store your payment URL permanently on the blockchain as an ENS text record
                    </p>
                    <button
                      onClick={() => storePaymentUrlOnChain(generatedUrl)}
                      disabled={isUpdatingSubname || isUpdateSubnamePending || !generatedUrl}
                      className="w-full px-4 py-3 bg-gradient-to-r from-orange-600 to-pink-600 text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:from-orange-700 hover:to-pink-700 transition-all flex items-center justify-center"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                      </svg>
                      {isUpdatingSubname || isUpdateSubnamePending ? 'Storing...' : 'Store URL on-chain'}
                    </button>
                  </div>
                )}

                <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-4">
                  <h3 className="text-blue-300 font-medium mb-2">Configuration Summary:</h3>
                  <div className="space-y-1 text-sm text-foreground/80">
                    <div><span className="text-foreground/60">Business Name:</span> {config.businessName}</div>
                    <div><span className="text-foreground/60">Description:</span> {config.description || 'No description'}</div>
                    <div><span className="text-foreground/60">Chain:</span> {MERCHANT_CHAINS.find(c => c.value === config.chainId)?.label}</div>
                    <div><span className="text-foreground/60">Token:</span> {config.token}</div>
                    <div><span className="text-foreground/60">Address:</span> <code className="text-xs">{config.address.slice(0, 10)}...{config.address.slice(-8)}</code></div>
                    {config.amount && <div><span className="text-foreground/60">Amount:</span> {config.amount} {config.token}</div>}
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    onClick={() => setCurrentStep(2)}
                    className="px-6 py-3 bg-foreground/10 border border-foreground/20 text-foreground rounded-xl font-medium hover:bg-foreground/20 transition-all"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => {
                      setCurrentStep(1);
                      setGeneratedUrl('');
                      setMerchantSubname('');
                      setIsSubnameRegistered(false);
                      setQrCodeDataUrl(null);
                      setIsTestingMode(false);
                      setConfig({
                        chainId: 1,
                        token: 'ETH',
                        address: '',
                        businessName: '',
                        description: '',
                        amount: '',
                      });
                    }}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-medium hover:from-green-700 hover:to-emerald-700 transition-all transform hover:scale-105"
                  >
                    Create Another Link
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        </div>
      </div>
    </main>
  );
}
