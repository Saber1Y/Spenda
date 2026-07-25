import {type Address, type WalletClient, type PublicClient, parseUnits} from "viem";
import {CONTRACTS} from "./contracts";
import {BOTSpendVaultBytecode, BOTSpendPaymasterBytecode} from "./artifacts";

const vaultAbi = [
  {type: "function", name: "setAgentPolicy", inputs: [{name: "agent", type: "address"}, {name: "maxPerTx", type: "uint128"}, {name: "dailyCap", type: "uint128"}, {name: "expiry", type: "uint64"}, {name: "active", type: "bool"}], outputs: [], stateMutability: "nonpayable"},
  {type: "function", name: "setAllowedTarget", inputs: [{name: "agent", type: "address"}, {name: "target", type: "address"}, {name: "allowed", type: "bool"}], outputs: [], stateMutability: "nonpayable"},
  {type: "function", name: "setAllowedToken", inputs: [{name: "agent", type: "address"}, {name: "token", type: "address"}, {name: "allowed", type: "bool"}], outputs: [], stateMutability: "nonpayable"},
] as const;

const paymasterAbi = [
  {type: "function", name: "deposit", inputs: [], outputs: [], stateMutability: "payable"},
] as const;

const factoryAbi = [
  {type: "function", name: "getAddress", inputs: [{name: "owner", type: "address"}, {name: "salt", type: "uint256"}], outputs: [{name: "", type: "address"}], stateMutability: "view"},
  {type: "function", name: "createAccount", inputs: [{name: "owner", type: "address"}, {name: "salt", type: "uint256"}], outputs: [{name: "ret", type: "address"}], stateMutability: "nonpayable"},
] as const;

const mockUSDAbi = [
  {type: "function", name: "mint", inputs: [{name: "to", type: "address"}, {name: "amount", type: "uint256"}], outputs: [], stateMutability: "nonpayable"},
] as const;

export interface DeployConfig {
  ownerAddress: Address;
  vendorAddress: Address;
  maxPerTx: bigint;
  dailyCap: bigint;
  expiryDays: number;
  fundAmount: bigint;
}

export interface DeployResult {
  vaultAddress: Address;
  paymasterAddress: Address;
  agentAddress: Address;
  txHashes: string[];
}

export async function deployFullStack(
  wallet: WalletClient,
  publicClient: PublicClient,
  config: DeployConfig,
): Promise<DeployResult> {
  const account = wallet.account!.address;
  const txHashes: string[] = [];
  const paymasterDeposit = parseUnits("0.05", 18);

  // 1. Deploy BOTSpendVault(owner = caller)
  const vaultHash = await wallet.deployContract({
    abi: vaultAbi,
    bytecode: BOTSpendVaultBytecode,
    args: [account],
  });
  const vaultReceipt = await publicClient.waitForTransactionReceipt({hash: vaultHash});
  if (!vaultReceipt.contractAddress) throw new Error("Vault deployment failed");
  const vaultAddress = vaultReceipt.contractAddress;
  txHashes.push(vaultHash);

  // 2. Deploy BOTSpendPaymaster(entryPoint, verifyingSigner, vault)
  const paymasterHash = await wallet.deployContract({
    abi: paymasterAbi,
    bytecode: BOTSpendPaymasterBytecode,
    args: [CONTRACTS.entryPoint, account, vaultAddress],
  });
  const paymasterReceipt = await publicClient.waitForTransactionReceipt({hash: paymasterHash});
  if (!paymasterReceipt.contractAddress) throw new Error("Paymaster deployment failed");
  const paymasterAddress = paymasterReceipt.contractAddress;
  txHashes.push(paymasterHash);

  // 3. Compute agent address from factory
  const agentAddress = (await publicClient.readContract({
    address: CONTRACTS.factory,
    abi: factoryAbi,
    functionName: "getAddress",
    args: [account, 0n],
  })) as Address;

  // 4. Deploy agent account via factory
  const createHash = await wallet.writeContract({
    address: CONTRACTS.factory,
    abi: factoryAbi,
    functionName: "createAccount",
    args: [account, 0n],
  });
  await publicClient.waitForTransactionReceipt({hash: createHash});
  txHashes.push(createHash);

  // 5. Set agent policy
  const now = Math.floor(Date.now() / 1000);
  const expiry = BigInt(now + config.expiryDays * 86400);
  const policyHash = await wallet.writeContract({
    address: vaultAddress,
    abi: vaultAbi,
    functionName: "setAgentPolicy",
    args: [agentAddress, config.maxPerTx, config.dailyCap, expiry, true],
  });
  await publicClient.waitForTransactionReceipt({hash: policyHash});
  txHashes.push(policyHash);

  // 6. Allowlist vendor
  const targetHash = await wallet.writeContract({
    address: vaultAddress,
    abi: vaultAbi,
    functionName: "setAllowedTarget",
    args: [agentAddress, config.vendorAddress, true],
  });
  await publicClient.waitForTransactionReceipt({hash: targetHash});
  txHashes.push(targetHash);

  // 7. Allowlist mockUSD token
  const tokenHash = await wallet.writeContract({
    address: vaultAddress,
    abi: vaultAbi,
    functionName: "setAllowedToken",
    args: [agentAddress, CONTRACTS.mockUSD, true],
  });
  await publicClient.waitForTransactionReceipt({hash: tokenHash});
  txHashes.push(tokenHash);

  // 8. Fund vault with mockUSD
  if (config.fundAmount > 0n) {
    const fundHash = await wallet.writeContract({
      address: CONTRACTS.mockUSD,
      abi: mockUSDAbi,
      functionName: "mint",
      args: [vaultAddress, config.fundAmount],
    });
    await publicClient.waitForTransactionReceipt({hash: fundHash});
    txHashes.push(fundHash);
  }

  // 9. Fund paymaster deposit (native BOT)
  const depositHash = await wallet.sendTransaction({
    to: paymasterAddress,
    value: paymasterDeposit,
  });
  await publicClient.waitForTransactionReceipt({hash: depositHash});
  txHashes.push(depositHash);

  return {vaultAddress, paymasterAddress, agentAddress, txHashes};
}
