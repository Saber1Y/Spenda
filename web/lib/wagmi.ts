import {createConfig, http} from "wagmi";
import {injected} from "wagmi/connectors";
import {botChain} from "./chain";

/** Light wallet-connect: injected/MetaMask only, no heavy kit. Owner writes (increment b). */
export const wagmiConfig = createConfig({
  chains: [botChain],
  connectors: [injected()],
  transports: {[botChain.id]: http()},
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
