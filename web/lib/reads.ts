import {getAbiItem, type Address, type Hex} from "viem";
import {publicClient} from "./chain";
import {CONTRACTS, DEMO, vaultAbi, erc20Abi, entryPointAbi, getActiveContracts} from "./contracts";

export interface Policy {
  maxPerTx: bigint;
  dailyCap: bigint;
  spentToday: bigint;
  lastResetTime: bigint;
  expiry: bigint;
  active: boolean;
}

export interface VaultState {
  vaultBalance: bigint;
  policy: Policy;
  remainingDailyCap: bigint;
  targetAllowed: boolean; // vendor
  tokenAllowed: boolean; // official mainnet USDT
  paymasterDeposit: bigint;
  agentNative: bigint;
  agentDeposit: bigint;
  ownerNative: bigint;
  agentDeployed: boolean;
  vaultOwner: Address;
}

/** One batched load of every read the dashboard shows, keyed on the agent ADDRESS. */
export async function readVaultState(agent: Address): Promise<VaultState> {
  const active = getActiveContracts();
  const vault = active.vault;
  const vendor = active.vendor;
  const agentOwnerEOA = active.agentOwnerEOA;
  const [
    vaultBalance,
    policy,
    remainingDailyCap,
    targetAllowed,
    tokenAllowed,
    paymasterDeposit,
    agentNative,
    agentDeposit,
    ownerNative,
    agentCode,
    vaultOwner,
  ] = await Promise.all([
    publicClient.readContract({address: active.mockUSD, abi: erc20Abi, functionName: "balanceOf", args: [vault]}),
    publicClient.readContract({address: vault, abi: vaultAbi, functionName: "getPolicy", args: [agent]}),
    publicClient.readContract({address: vault, abi: vaultAbi, functionName: "remainingDailyCap", args: [agent]}),
    publicClient.readContract({address: vault, abi: vaultAbi, functionName: "allowedTarget", args: [agent, vendor]}),
    publicClient.readContract({address: vault, abi: vaultAbi, functionName: "allowedToken", args: [agent, active.mockUSD]}),
    publicClient.readContract({address: CONTRACTS.entryPoint, abi: entryPointAbi, functionName: "balanceOf", args: [active.paymaster]}),
    publicClient.getBalance({address: agent}),
    publicClient.readContract({address: CONTRACTS.entryPoint, abi: entryPointAbi, functionName: "balanceOf", args: [agent]}),
    publicClient.getBalance({address: agentOwnerEOA}),
    publicClient.getCode({address: agent}),
    publicClient.readContract({address: vault, abi: vaultAbi, functionName: "owner", args: []}),
  ]);

  return {
    vaultBalance,
    policy: policy as Policy,
    remainingDailyCap,
    targetAllowed,
    tokenAllowed,
    paymasterDeposit,
    agentNative,
    agentDeposit,
    ownerNative,
    agentDeployed: !!agentCode && agentCode !== "0x",
    vaultOwner,
  };
}

export type ActionKind = "approved" | "blocked";
export interface AgentAction {
  kind: ActionKind;
  agent: Address;
  target: Address;
  token: Address;
  amount: bigint;
  reason?: string;
  actionId?: Hex;
  blockNumber: bigint;
  txHash: Hex;
  logIndex: number;
}

const approvedEvent = getAbiItem({abi: vaultAbi, name: "AgentActionApproved"});
const blockedEvent = getAbiItem({abi: vaultAbi, name: "AgentActionBlocked"});

/** Read approved/blocked actions for one agent over [fromBlock, toBlock]. */
export async function readActions(agent: Address, fromBlock: bigint, toBlock: bigint): Promise<AgentAction[]> {
  const active = getActiveContracts();
  const [approved, blocked] = await Promise.all([
    publicClient.getLogs({address: active.vault, event: approvedEvent, args: {agent}, fromBlock, toBlock}),
    publicClient.getLogs({address: active.vault, event: blockedEvent, args: {agent}, fromBlock, toBlock}),
  ]);

  const out: AgentAction[] = [];
  for (const l of approved) {
    out.push({
      kind: "approved",
      agent: l.args.agent!,
      target: l.args.target!,
      token: l.args.token!,
      amount: l.args.amount!,
      actionId: l.args.actionId,
      blockNumber: l.blockNumber!,
      txHash: l.transactionHash!,
      logIndex: l.logIndex!,
    });
  }
  for (const l of blocked) {
    out.push({
      kind: "blocked",
      agent: l.args.agent!,
      target: l.args.target!,
      token: l.args.token!,
      amount: l.args.amount!,
      reason: l.args.reason,
      blockNumber: l.blockNumber!,
      txHash: l.transactionHash!,
      logIndex: l.logIndex!,
    });
  }
  return out;
}

export const sortNewestFirst = (a: AgentAction, b: AgentAction): number =>
  a.blockNumber === b.blockNumber ? b.logIndex - a.logIndex : Number(b.blockNumber - a.blockNumber);

export async function latestBlock(): Promise<bigint> {
  return publicClient.getBlockNumber();
}
