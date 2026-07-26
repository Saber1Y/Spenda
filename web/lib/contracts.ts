import {parseAbi, type Address} from "viem";

/** Live BOT Chain 968 deployment (from the backend handoff). All addresses are public. */
export const CONTRACTS = {
  entryPoint: "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
  mockUSD: "0x981a7E272F309193D846dc585b64E4a2f172aD21",
  vault: "0xf23147dfe0e9e38d0e8d20d780f7ca9301ea182b",
  factory: "0xC7e8a13d62752Eb58b21391f2BA302B1043D13b1",
  paymaster: "0xde609e52d9164c227d4f174d6260289bc3e62ec2",
} as const satisfies Record<string, Address>;

/** Deployed agent + its owner EOA + the allowlisted vendor. */
export const DEMO = {
  agent: "0xfdfa27c2ecc43e7b76a098409e95d125e0089598",
  agentOwnerEOA: "0x3F5b96A494061F7338Da529e3047809Ac6a7FB84",
  vendor: "0x3F5b96A494061F7338Da529e3047809Ac6a7FB84",
} as const satisfies Record<string, Address>;

/** Vault deploy block — the fromBlock floor for the history log reader. */
export const DEPLOY_BLOCK = 15_388_923n;

/** The two headline artifacts for the marketing LiveProof (real, on-chain). */
export const PROOF_TX = {
  approved: "0xb2143fb3de65583fa75655b068cf23189a39b1a810c98e41653f67c7f6997d2c",
  blocked: "0x299021d91bdd354f3c9462629b0f10219578be08f1fe9c3e9e187e982e7f25f9",
} as const;

export const MUSD_DECIMALS = 6;

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
      if (parsed.vaultAddress && parsed.paymasterAddress && parsed.agentAddress) {
        return {
          entryPoint: CONTRACTS.entryPoint as Address,
          mockUSD: parsed.mockUSDAddress ?? CONTRACTS.mockUSD,
          vault: parsed.vaultAddress as Address,
          factory: CONTRACTS.factory as Address,
          paymaster: parsed.paymasterAddress as Address,
          agent: parsed.agentAddress as Address,
          agentOwnerEOA: parsed.agentOwnerEOA as Address,
          vendor: parsed.vendorAddress as Address,
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
  "function mint(address to,uint256 amount)",
  "function transfer(address to,uint256 amount) returns (bool)",
  "event Transfer(address indexed from,address indexed to,uint256 value)",
]);

export const entryPointAbi = parseAbi(["function balanceOf(address) view returns (uint256)"]);

export const paymasterAbi = parseAbi(["function deposit() payable"]);
