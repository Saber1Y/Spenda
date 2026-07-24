import {createConfig, http} from "wagmi";
import {metaMask} from "wagmi/connectors";
import {botChain} from "./chain";

/** Light wallet-connect: MetaMask only, no heavy kit. Owner writes (increment b). */
export const wagmiConfig = createConfig({
  chains: [botChain],
  connectors: [metaMask()],
  transports: {[botChain.id]: http()},
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
