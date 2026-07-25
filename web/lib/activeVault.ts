import {type Address} from "viem";
import {CONTRACTS, DEMO, DEPLOY_BLOCK} from "./contracts";

const STORAGE_KEY = "spenda:activeVault";

export interface ActiveVaultConfig {
  vaultAddress: Address;
  paymasterAddress: Address;
  agentAddress: Address;
  agentOwnerEOA: Address;
  vendorAddress: Address;
  mockUSDAddress: Address;
  deployBlock: bigint;
}

function loadFromStorage(): ActiveVaultConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.vaultAddress || !parsed.paymasterAddress || !parsed.agentAddress) return null;
    return {
      vaultAddress: parsed.vaultAddress as Address,
      paymasterAddress: parsed.paymasterAddress as Address,
      agentAddress: parsed.agentAddress as Address,
      agentOwnerEOA: parsed.agentOwnerEOA as Address,
      vendorAddress: parsed.vendorAddress as Address,
      mockUSDAddress: parsed.mockUSDAddress as Address,
      deployBlock: BigInt(parsed.deployBlock ?? DEPLOY_BLOCK),
    };
  } catch {
    return null;
  }
}

/** Get the active vault config. Falls back to demo vault if nothing stored. */
export function getActiveVault(): ActiveVaultConfig {
  const stored = loadFromStorage();
  if (stored) return stored;
  return {
    vaultAddress: CONTRACTS.vault,
    paymasterAddress: CONTRACTS.paymaster,
    agentAddress: DEMO.agent,
    agentOwnerEOA: DEMO.agentOwnerEOA,
    vendorAddress: DEMO.vendor,
    mockUSDAddress: CONTRACTS.mockUSD,
    deployBlock: DEPLOY_BLOCK,
  };
}

/** Persist a newly deployed vault config to localStorage. */
export function saveActiveVault(config: ActiveVaultConfig): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      vaultAddress: config.vaultAddress,
      paymasterAddress: config.paymasterAddress,
      agentAddress: config.agentAddress,
      agentOwnerEOA: config.agentOwnerEOA,
      vendorAddress: config.vendorAddress,
      mockUSDAddress: config.mockUSDAddress,
      deployBlock: config.deployBlock.toString(),
    }),
  );
}

/** Check whether the user has a custom vault deployed (not the demo). */
export function hasCustomVault(): boolean {
  if (typeof window === "undefined") return false;
  return loadFromStorage() !== null;
}

/** Clear custom vault, reverting to demo defaults. */
export function clearActiveVault(): void {
  localStorage.removeItem(STORAGE_KEY);
}
