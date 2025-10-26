'use client';

import { useState, useEffect } from 'react';
import { useRecords } from '@justaname.id/react';
import { CustomCursor } from '@/components/custom-cursor';
import { GrainOverlay } from '@/components/grain-overlay';
import { Shader, ChromaFlow, Swirl } from "shaders/react";

export default function ENSResolutionPage() {
  const [ensName, setEnsName] = useState('');
  const [resolvedEns, setResolvedEns] = useState('');
  const [isLoaded, setIsLoaded] = useState(false);

  // Use the useRecords hook to fetch ENS records
  const { records, isRecordsLoading, refetchRecords } = useRecords({
    ens: resolvedEns,
    enabled: !!resolvedEns, // Only fetch when we have an ENS name
  });

  // Shader loading effect
  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Check for payment URL and redirect if valid
  useEffect(() => {
    if (records?.sanitizedRecords?.url) {
      const url = records.sanitizedRecords.url;
      
      // Check if URL is from localhost:3000/pay or nexxpay.vercel.app/pay
      const isValidPaymentUrl = 
        url.includes('localhost:3000/pay') || 
        url.includes('nexxpay.vercel.app/pay');
      
      if (isValidPaymentUrl) {
        // Delay redirect to show the message first
        const timer = setTimeout(() => {
          window.location.href = url;
        }, 2000); // 2 second delay
        
        return () => clearTimeout(timer);
      }
    }
  }, [records]);

  const handleResolve = (e: React.FormEvent) => {
    e.preventDefault();
    if (ensName.trim()) {
      // Ensure the ENS name has .eth suffix if not provided
      const nameToResolve = ensName.trim().endsWith('.eth') 
        ? ensName.trim() 
        : `${ensName.trim()}.eth`;
      setResolvedEns(nameToResolve);
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h1 className="text-4xl font-bold text-foreground mb-4">ENS Pay</h1>
            <p className="text-xl text-foreground/80 max-w-2xl mx-auto">
              Enter an ENS name to pay. If configured, you'll be redirected to the payment gateway.
            </p>
          </div>

          {/* ENS Input Form */}
          <div className="bg-foreground/5 backdrop-blur-sm border border-foreground/10 rounded-2xl p-8 mb-8">
            <form onSubmit={handleResolve} className="space-y-4">
              <div>
                <label className="block text-foreground font-medium mb-2">
                  ENS Name
                </label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={ensName}
                    onChange={(e) => setEnsName(e.target.value)}
                    placeholder="Enter ENS name (e.g., alice.eth or alice)"
                    className="flex-1 px-4 py-3 bg-foreground/10 border border-foreground/20 rounded-xl text-foreground placeholder-foreground/60 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  />
                  <button
                    type="submit"
                    className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-medium hover:from-purple-700 hover:to-pink-700 transition-all transform hover:scale-105"
                  >
                    Resolve
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Loading State */}
          {isRecordsLoading && resolvedEns && (
            <div className="bg-foreground/5 backdrop-blur-sm border border-foreground/10 rounded-2xl p-8">
              <div className="flex items-center justify-center py-12">
                <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="ml-4 text-foreground">Resolving ENS records...</span>
              </div>
            </div>
          )}

          {/* No ENS Name or Invalid ENS Message */}
          {!records && !isRecordsLoading && resolvedEns && (
            <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-xl p-6">
              <div className="flex items-start">
                <svg className="w-6 h-6 text-yellow-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <h3 className="text-yellow-300 font-semibold mb-1">Please Enter a Valid ENS Name</h3>
                  <p className="text-yellow-200 text-sm">
                    No records found for "{resolvedEns}". Please check the ENS name and try again.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Records Display */}
          {records && !isRecordsLoading && records.ens && (
            <div className="bg-foreground/5 backdrop-blur-sm border border-foreground/10 rounded-2xl p-8 space-y-6">


              {/* Payment URL Check */}
              {records.sanitizedRecords?.url ? (
                <div className={`rounded-xl p-4 border ${
                  records.sanitizedRecords.url.includes('localhost:3000/pay') || 
                  records.sanitizedRecords.url.includes('nexxpay.vercel.app/pay')
                    ? 'bg-green-900/20 border-green-500/30'
                    : 'bg-red-900/20 border-red-500/30'
                }`}>
                  <div className="flex items-start">
                    {records.sanitizedRecords.url.includes('localhost:3000/pay') || 
                     records.sanitizedRecords.url.includes('nexxpay.vercel.app/pay') ? (
                      <>
                        <svg className="w-6 h-6 text-green-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                          <h3 className="text-green-300 font-semibold mb-1">Payment URL Configured</h3>
                          <p className="text-green-200 text-sm">Redirecting to payment page...</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <svg className="w-6 h-6 text-red-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <div>
                          <h3 className="text-red-300 font-semibold mb-1">Payment URL Not Configured</h3>
                          <p className="text-red-200 text-sm">
                            The payment URL is not from localhost:3000/pay or nexxpay.vercel.app/pay
                          </p>
                          <p className="text-red-300 text-xs mt-1 font-mono break-all">
                            {records.sanitizedRecords.url}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4">
                  <div className="flex items-start">
                    <svg className="w-6 h-6 text-red-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                      <h3 className="text-red-300 font-semibold mb-1">No Payment URL Configured</h3>
                      <p className="text-red-200 text-sm">
                        This ENS name does not have a payment URL configured
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
