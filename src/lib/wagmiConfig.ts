import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { defineChain } from "viem";

export const ritualTestnet = defineChain({
  id: 1979,
  name: "Ritual Chain Testnet",
  nativeCurrency: {
    decimals: 18,
    name: "RITUAL",
    symbol: "RITUAL",
  },
  rpcUrls: {
    default: { http: ["https://rpc.ritualfoundation.org"] },
  },
  testnet: true,
});

export const wagmiConfig = getDefaultConfig({
  appName: "ChainWatch",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "chainwatch",
  chains: [ritualTestnet],
  ssr: false,
});
