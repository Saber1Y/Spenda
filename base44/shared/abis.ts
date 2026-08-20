export const vaultAbi = [
  "function getPolicy(address agent) view returns ((uint128 maxPerTx,uint128 dailyCap,uint128 spentToday,uint64 lastResetTime,uint64 expiry,bool active))",
  "function remainingDailyCap(address agent) view returns (uint256)",
  "function allowedTarget(address agent,address target) view returns (bool)",
  "function allowedToken(address agent,address token) view returns (bool)",
  "function owner() view returns (address)",
  "function setAgentPolicy(address agent,uint128 maxPerTx,uint128 dailyCap,uint64 expiry,bool active)",
  "function setAllowedTarget(address agent,address target,bool allowed)",
  "function setAllowedToken(address agent,address token,bool allowed)",
  "function revokeAgent(address agent)",
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
] as const;

export const erc20Abi = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
] as const;

export const entryPointAbi = [
  "function balanceOf(address) view returns (uint256)",
] as const;
