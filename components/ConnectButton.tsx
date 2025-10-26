"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
export const CustomConnectButton = () => {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        authenticationStatus,
        mounted,
      }) => {
        // Note: If your app doesn't use authentication, you
        // can remove all 'authenticationStatus' checks
        const ready = mounted && authenticationStatus !== "loading";
        const connected =
          ready &&
          account &&
          chain &&
          (!authenticationStatus || authenticationStatus === "authenticated");
        return (
          <div
            {...(!ready && {
              "aria-hidden": true,
              style: {
                opacity: 0,
                pointerEvents: "none",
                userSelect: "none",
              },
            })}
          >
            {(() => {
              if (!connected) {
                return (
                  <button
                    onClick={openConnectModal}
                    type="button"
                    className="w-full px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl transition-colors flex items-center justify-center font-semibold shadow-lg"
                  >
                    Connect
                  </button>
                );
              }
              if (chain.unsupported) {
                return (
                  <button
                    onClick={openChainModal}
                    type="button"
                    className="w-full px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl transition-colors flex items-center justify-center font-semibold shadow-lg"
                  >
                    Wrong Network
                  </button>
                );
              }
              return (
                <div className="flex items-center gap-4">
                  <button
                    onClick={openAccountModal}
                    type="button"
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors flex items-center font-medium shadow-sm border border-white/20"
                  >
                    {account.displayName}
                    {account.displayBalance
                      ? ` (${account.displayBalance})`
                      : ""}
                  </button>
                </div>
              );
            })()}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
};
