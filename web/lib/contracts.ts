import {parseAbi, type Address} from "viem";

/** Live BOT Chain mainnet 677 deployment mirrored from deployments/mainnet.json. */
export const CONTRACTS = {
  entryPoint: "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
  // Official bridged USDT on chain 677. The legacy `mockUSD` key name is kept for
  // call-site compatibility; there is no mock token on mainnet and nothing mints here.
  mockUSD: "0xaBabc7Ddc03e501d190C676BF3d92ef0e6e87a3C",
  vault: "0xf23147Df55089eA6bA87BF24bb4eEE6f7Cea182b",
  factory: "0xBC88d6012b3bf8426C2851d3798cEB5257658332",
  paymaster: "0xfB88d06289EaDD3aE23ef5C7bEF816baFfbf4000",
  verifyingSigner: "0x98DD16d41a4Cd230f8286e593273f8D049193177",
} as const satisfies Record<string, Address>;

/** Deployed agent + its owner EOA + the allowlisted vendor. */
export const DEMO = {
  agent: "0x055b36a6db61cbadf1832fe946be0cfe19b33b59",
  agentOwnerEOA: "0x3F5b96A494061F7338Da529e3047809Ac6a7FB84",
  vendor: "0x3F5b96A494061F7338Da529e3047809Ac6a7FB84",
} as const satisfies Record<string, Address>;

/** Vault deploy block — the fromBlock floor for the history log reader. */
export const DEPLOY_BLOCK = 20_533_755n;

/** Mainnet bundler for ERC-4337 UserOperations (chain 677). */
export const BUNDLER_URL = "https://bundler.botchain.ai/rpc";

/** The two headline artifacts for the marketing LiveProof (real, on-chain). */
export const PROOF_TX = {
  approved: "0xdf7fdd68949e5209730ec24fae79416579b2f162d29d195dc47e32522d52d909",
  blocked: "0xc8077a9089676a4d22b47a670d4eceed809f867cf3f526f1c671ea369848d3a5",
} as const;

export const MUSD_DECIMALS = 6;
export const SPEND_TOKEN_SYMBOL = "USDT";

/**
 * Returns the full set of contract addresses, using the active vault from
 * localStorage if one has been deployed, otherwise falling back to the demo.
 */
export function getActiveContracts() {
  if (typeof window === "undefined") {
    return {
      entryPoint: CONTRACTS.entryPoint as Address,
      mockUSD: CONTRACTS.mockUSD as Address,
      vault: CONTRACTS.vault as Address,
      factory: CONTRACTS.factory as Address,
      paymaster: CONTRACTS.paymaster as Address,
      agent: DEMO.agent as Address,
      agentOwnerEOA: DEMO.agentOwnerEOA as Address,
      vendor: DEMO.vendor as Address,
      deployBlock: DEPLOY_BLOCK,
    };
  }
  try {
    const raw = localStorage.getItem("spenda:activeVault");
    if (raw) {
      const parsed = JSON.parse(raw);
      const eq = (a: unknown, b: string) => typeof a === "string" && a.toLowerCase() === b.toLowerCase();
      // Only honor a saved stack if every address matches the canonical mainnet
      // deployment; anything else is stale testnet data and must be ignored.
      if (
        (!parsed.chainId || Number(parsed.chainId) === 677) &&
        eq(parsed.vaultAddress, CONTRACTS.vault) &&
        eq(parsed.paymasterAddress, CONTRACTS.paymaster) &&
        eq(parsed.agentAddress, DEMO.agent)
      ) {
        return {
          entryPoint: CONTRACTS.entryPoint as Address,
          mockUSD: CONTRACTS.mockUSD as Address,
          vault: CONTRACTS.vault as Address,
          factory: CONTRACTS.factory as Address,
          paymaster: CONTRACTS.paymaster as Address,
          agent: DEMO.agent as Address,
          agentOwnerEOA: DEMO.agentOwnerEOA as Address,
          vendor: DEMO.vendor as Address,
          deployBlock: BigInt(parsed.deployBlock ?? DEPLOY_BLOCK),
        };
      }
    }
  } catch {}
  return {
    entryPoint: CONTRACTS.entryPoint as Address,
    mockUSD: CONTRACTS.mockUSD as Address,
    vault: CONTRACTS.vault as Address,
    factory: CONTRACTS.factory as Address,
    paymaster: CONTRACTS.paymaster as Address,
    agent: DEMO.agent as Address,
    agentOwnerEOA: DEMO.agentOwnerEOA as Address,
    vendor: DEMO.vendor as Address,
    deployBlock: DEPLOY_BLOCK,
  };
}

export const vaultAbi = parseAbi([
  // reads
  "function getPolicy(address agent) view returns ((uint128 maxPerTx,uint128 dailyCap,uint128 spentToday,uint64 lastResetTime,uint64 expiry,bool active))",
  "function remainingDailyCap(address agent) view returns (uint256)",
  "function isAllowed(address agent,address target,address token) view returns (bool)",
  "function allowedTarget(address agent,address target) view returns (bool)",
  "function allowedToken(address agent,address token) view returns (bool)",
  "function usedAction(bytes32 actionId) view returns (bool)",
  "function owner() view returns (address)",
  "function NATIVE() view returns (address)",
  // owner writes
  "function setAgentPolicy(address agent,uint128 maxPerTx,uint128 dailyCap,uint64 expiry,bool active)",
  "function setAllowedTarget(address agent,address target,bool allowed)",
  "function setAllowedToken(address agent,address token,bool allowed)",
  "function revokeAgent(address agent)",
  // events
  "event AgentActionApproved(address indexed agent,address indexed target,address indexed token,uint256 amount,bytes32 actionId)",
  "event AgentActionBlocked(address indexed agent,address indexed target,address indexed token,uint256 amount,string reason)",
  "event AgentActionDecision(address indexed agent,address indexed target,address indexed token,uint256 amount,bytes32 actionId,bool approved,string reason)",
  "event ReceiptIssued(address indexed agent,address indexed target,address token,uint256 amount,bytes32 actionId,uint256 timestamp)",
  "event VaultFunded(address indexed from,uint256 amount)",
  "event PolicyCreated(address indexed agent,uint128 maxPerTx,uint128 dailyCap,uint64 expiry,bool active)",
  "event PolicyUpdated(address indexed agent,uint128 maxPerTx,uint128 dailyCap,uint64 expiry,bool active)",
  "event TargetAllowlisted(address indexed agent,address indexed target,bool allowed)",
  "event TokenAllowlisted(address indexed agent,address indexed token,bool allowed)",
  "event AgentRevoked(address indexed agent)",
]);

export const erc20Abi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function transfer(address to,uint256 amount) returns (bool)",
  "event Transfer(address indexed from,address indexed to,uint256 value)",
]);

export const entryPointAbi = parseAbi(["function balanceOf(address) view returns (uint256)"]);

export const paymasterAbi = parseAbi(["function deposit() payable"]);
