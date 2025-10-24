'use client';
 
import { useState } from 'react';
import { useAccount } from 'wagmi';
import { CustomConnectButton } from '@/components/ConnectButton';
import InitButton from '@/components/init-button';
import FetchUnifiedBalanceButton from '@/components/fetch-unified';
import { isInitialized } from '@/lib/nexus';
 
export default function Page() {
  const { isConnected } = useAccount();
  const [initialized, setInitialized] = useState(isInitialized());
  const [balances, setBalances] = useState<any>(null);
 
  const btn =
    'px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 ' +
    'disabled:opacity-50 disabled:cursor-not-allowed';
 
  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <CustomConnectButton  />
        <InitButton className={btn} onReady={() => setInitialized(true)} />
        <FetchUnifiedBalanceButton className={btn} onResult={(r: any) => setBalances(r)} />
 
        <div className="mt-2">
          <b>Wallet Status:</b> {isConnected ? 'Connected' : 'Not connected'}
        </div>
        <div className="mt-2">
          <b>Nexus SDK Initialization Status:</b> {initialized ? 'Initialized' : 'Not initialized'}
        </div>
 
        {balances && (
          <pre className="whitespace-pre-wrap">{JSON.stringify(balances, null, 2)}</pre>
        )}
      </div>
    </main>
  );
}