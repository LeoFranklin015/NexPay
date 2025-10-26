"use client";

import { useAddSubname, useIsSubnameAvailable } from '@justaname.id/react';
import { useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';

export const AddSubname = () => {
  const { isConnected, address } = useAccount();
  const [username, setUsername] = useState<string>('');
  const { isSubnameAvailable } = useIsSubnameAvailable({ 
    username: username 
  });
  const { addSubname } = useAddSubname();

  const handleClaim = async () => {
    try {
      await addSubname({ 
        username, 
        ensDomain: "resolverlens.eth", 
        chainId: 1,
        addresses: {
          2147492101: address,
        }
      });
      alert('Subname claimed successfully!');
      setUsername('');
    } catch (error) {
      console.error('Error claiming subname:', error);
      alert('Failed to claim subname. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-center">Claim your subdomain</h1>
        
        <div className="bg-gray-900 rounded-2xl p-8">
          {/* Connect Wallet Section */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Connect Wallet</h2>
            <ConnectButton />
          </div>

          {/* Username Input Section */}
          <div className="mb-8">
            <label htmlFor="username" className="block text-lg font-medium mb-3">
              Choose your subdomain
            </label>
            <div className="relative">
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter a subdomain"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                .resolverlens.eth
              </div>
            </div>
            
            {/* Availability Status */}
            {username && (
              <div className="mt-3">
                {isSubnameAvailable?.isAvailable === true ? (
                  <div className="flex items-center text-green-400">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Available! You can claim this subdomain.
                  </div>
                ) : isSubnameAvailable?.isAvailable === false ? (
                  <div className="flex items-center text-red-400">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Already taken. Please choose a different subdomain.
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {/* Claim Button */}
          <button
            onClick={handleClaim}
            disabled={!isSubnameAvailable?.isAvailable || !isConnected || !username}
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:from-blue-700 hover:to-purple-700 transition-all transform hover:scale-105 disabled:hover:scale-100"
          >
            {!isConnected ? 'Connect Wallet to Claim' : 
             !username ? 'Enter a subdomain' :
             !isSubnameAvailable?.isAvailable ? 'Subdomain not available' :
             'Claim Subdomain'}
          </button>

          {/* Info Section */}
          <div className="mt-8 p-4 bg-blue-900/20 border border-blue-500/30 rounded-xl">
            <h3 className="text-lg font-semibold mb-2 text-blue-300">How it works</h3>
            <ul className="text-sm text-gray-300 space-y-1">
              <li>• Connect your wallet to get started</li>
              <li>• Enter your desired subdomain name</li>
              <li>• Check if it's available</li>
              <li>• Claim it to make it yours!</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
