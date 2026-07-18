"use client";

import { PrivyProvider, useWallets } from "@privy-io/react-auth";
import { WagmiProvider, createConfig, useSetActiveWallet } from "@privy-io/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, useAccount, useDisconnect } from "wagmi";
import { monadTestnet } from "wagmi/chains";
import { useEffect, type ReactNode } from "react";

const queryClient = new QueryClient();

const wagmiConfig = createConfig({
  chains: [monadTestnet],
  transports: {
    [monadTestnet.id]: http("https://testnet-rpc.monad.xyz"),
  },
});

/** Keeps wagmi's connector state in sync with Privy's own auth state, in both
 * directions: Privy's session persists across reloads, but wagmi doesn't know which
 * wallet to treat as active until told (`useAccount().isConnected` would otherwise
 * stay false after a reload despite still being logged in). Conversely, calling
 * Privy's `logout()` clears its own wallet list but doesn't itself disconnect wagmi's
 * connector, so without the second branch here `useAccount()` keeps reporting the old
 * connected address until the page is reloaded. */
function WalletSync() {
  const { wallets } = useWallets();
  const { setActiveWallet } = useSetActiveWallet();
  const { isConnected } = useAccount();
  const { disconnect } = useDisconnect();

  useEffect(() => {
    if (!isConnected && wallets.length > 0) {
      setActiveWallet(wallets[0]);
    } else if (isConnected && wallets.length === 0) {
      disconnect();
    }
  }, [isConnected, wallets, setActiveWallet, disconnect]);

  return null;
}

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        loginMethods: ["google", "apple", "discord", "twitter", "farcaster", "wallet"],
        defaultChain: monadTestnet,
        supportedChains: [monadTestnet],
        embeddedWallets: {
          ethereum: {
            createOnLogin: "users-without-wallets",
          },
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>
          <WalletSync />
          {children}
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
