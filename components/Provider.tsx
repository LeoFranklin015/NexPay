"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { getDefaultConfig, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { mainnet} from "wagmi/chains";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { JustaNameProvider } from '@justaname.id/react';
import { ChainId } from '@justaname.id/sdk';

const getOrigin = () => {
  if (process.env.NEXT_ENV === 'dev') {
    return "http://localhost:3000/";
  }
  return process.env.NEXT_PUBLIC_URL || "http://localhost:3000/";
};

const getDomain = () => {
  if (process.env.NEXT_ENV === 'dev') {
    return "localhost";
  }
  return process.env.NEXT_PUBLIC_URL?.replace('https://', '').replace('http://', '') || "localhost";
};

const justnameConfig = {
  config: {
    origin: getOrigin(),
    domain: getDomain(),
    signInTtl: 86400000,
  },
  ensDomains: [
    {
      ensDomain: "resolverlens.eth",
      apiKey: process.env.NEXT_PUBLIC_JUSTNAME_API_KEY ||"",
      chainId: 1 as ChainId,
    },
  ],
  color: {
    primary: "hsl(216, 90%, 58%)",
    background: "hsl(0, 0%, 100%)",
    destructive: "hsl(0, 100%, 50%)",
  },
  networks: [
      { chainId: 1 as ChainId, providerUrl: "https://eth.drpc.org" } 
    ],
};


const config = getDefaultConfig({
  appName: "NexPay",
  projectId: process.env.NEXT_PUBLIC_PROJECT_ID || "",
  chains: [mainnet],
  ssr: true, // If your dApp uses server side rendering (SSR)
});

export default function Provider({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient();
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <JustaNameProvider config={justnameConfig}>
            {children}
          </JustaNameProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
