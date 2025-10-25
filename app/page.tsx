'use client';
 
import { useState } from 'react';
import { useAccount } from 'wagmi';
import { CustomConnectButton } from '@/components/ConnectButton';
import InitButton from '@/components/init-button';
import FetchUnifiedBalanceButton from '@/components/fetch-unified';
import TransferComponent from '@/components/Transfer';
import BridgeComponent from '@/components/Bridge';
import BridgeAndExecuteComponent from '@/components/BridgeAndExecute';
import { isInitialized } from '@/lib/nexus';
import ExecuteComponent from '@/components/Execute';
import AcrossSwap from '@/components/AcrossSwap';
import AcrossToUnichain from '@/components/AcrossToUnichain';
import TestComponent from '@/components/test';
import Case2Component from '@/components/Case2';

export default function Page() {
  const { isConnected } = useAccount();
  const [initialized, setInitialized] = useState(isInitialized());
  const [balances, setBalances] = useState<any>(null);
 
  const btn =
    'px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 border border-blue-500 ' +
    'disabled:opacity-50 disabled:cursor-not-allowed';
 
  return (
    <main className="min-h-screen bg-black py-8">
      <div className="container mx-auto px-4">
        {/* Header Section */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">NexPay - Advanced Cross-Chain Operations</h1>
          <p className="text-lg text-gray-300">Transfer, bridge, and execute smart contracts across multiple chains using the Nexus SDK</p>
        </div>

        {/* Setup Section */}
        <div className="max-w-2xl mx-auto mb-8">
          <div className="bg-gray-900 border border-gray-800 rounded-lg shadow-2xl p-6">
            <h2 className="text-2xl font-bold text-white mb-4">Setup</h2>
            <div className="flex flex-col items-center gap-4">
              <CustomConnectButton />
              <InitButton className={btn} onReady={() => setInitialized(true)} />
              <FetchUnifiedBalanceButton className={btn} onResult={(r: any) => setBalances(r)} />
            </div>
            
            <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
              <div className="text-center">
                <span className="font-medium text-white">Wallet Status:</span>
                <span className={`ml-2 ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
                  {isConnected ? 'Connected' : 'Not connected'}
                </span>
              </div>
              <div className="text-center">
                <span className="font-medium text-white">Nexus SDK:</span>
                <span className={`ml-2 ${initialized ? 'text-green-400' : 'text-red-400'}`}>
                  {initialized ? 'Initialized' : 'Not initialized'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Transfer Component */}
        <TransferComponent balances={balances} />

        {/* Bridge Component */}
        <BridgeComponent balances={balances} />

        {/* Bridge and Execute Component */}
        <BridgeAndExecuteComponent balances={balances} />


        {/* Across Swap Component */}
        <AcrossSwap />

        {/* Across to Unichain Component */}
        <AcrossToUnichain />

        {/* Case 1: Nexus-Only Transfer Component */}
        <TestComponent />

        {/* Case 2: Non-Nexus Chains via Base (Across) */}
        <Case2Component />

        {/* Balances Display */}
        {balances && (
          <div className="max-w-4xl mx-auto mt-8">
            <div className="bg-gray-900 border border-gray-800 rounded-lg shadow-2xl p-6">
              <h2 className="text-2xl font-bold text-white mb-4">Unified Balances</h2>
              <pre className="whitespace-pre-wrap bg-black border border-gray-700 p-4 rounded-md overflow-auto text-sm text-gray-300">
                {JSON.stringify(balances, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}