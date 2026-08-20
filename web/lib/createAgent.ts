import {parseAbi, type Address, type PublicClient, type WalletClient} from "viem";
import {vaultAbi} from "./contracts";

const factoryAbi = parseAbi([
  "function getAddress(address owner,uint256 salt) view returns (address)",
  "function createAccount(address owner,uint256 salt) returns (address)",
]);

export interface CreateAgentInput {
  factory: Address;
  vault: Address;
  token: Address;
  target: Address;
  owner: Address;
  salt: bigint;
  maxPerTransaction: bigint;
  dailyCap: bigint;
  expiresAt: bigint;
}

export async function createRestrictedAgent(wallet: WalletClient, publicClient: PublicClient, input: CreateAgentInput) {
  const account = wallet.account?.address;
  if (!account || account.toLowerCase() !== input.owner.toLowerCase()) throw new Error("Connected wallet must own the new agent.");
  const agent = await publicClient.readContract({address: input.factory, abi: factoryAbi, functionName: "getAddress", args: [input.owner, input.salt]});
  const hashes: `0x${string}`[] = [];
  const confirm = async (hash: `0x${string}`, label: string) => {
    const receipt = await publicClient.waitForTransactionReceipt({hash});
    if (receipt.status !== "success") throw new Error(`${label} reverted on-chain.`);
    hashes.push(hash);
  };
  await confirm(await wallet.writeContract({address: input.factory, abi: factoryAbi, functionName: "createAccount", args: [input.owner, input.salt], account, chain: null}), "createAccount");
  await confirm(await wallet.writeContract({address: input.vault, abi: vaultAbi, functionName: "setAgentPolicy", args: [agent, input.maxPerTransaction, input.dailyCap, input.expiresAt, true], account, chain: null}), "setAgentPolicy");
  await confirm(await wallet.writeContract({address: input.vault, abi: vaultAbi, functionName: "setAllowedToken", args: [agent, input.token, true], account, chain: null}), "setAllowedToken");
  await confirm(await wallet.writeContract({address: input.vault, abi: vaultAbi, functionName: "setAllowedTarget", args: [agent, input.target, true], account, chain: null}), "setAllowedTarget");
  return {agent, hashes};
}
