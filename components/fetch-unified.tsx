'use client';

import { getUnifiedBalances, isInitialized } from '../lib/nexus';

export default function FetchUnifiedBalanceButton({
  className,
  onResult,
}: { className?: string; onResult?: (r: any) => void }) {
  const onClick = async () => {
    if (!isInitialized()) return alert('Initialize first');
    const res = await getUnifiedBalances();
    onResult?.(res);
    console.log(res);
  };
  return <button className={className} onClick={onClick} disabled={!isInitialized()}>Fetch Unified Balances</button>;
}
