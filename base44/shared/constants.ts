export const RPC_URL = "https://rpc.bohr.life";
export const CHAIN_ID = 968;
export const DEPLOY_BLOCK = 20_550_329n;

export const CONTRACTS = {
  entryPoint: "0x0000000071727De22E5E9d8BAf0edAc6f37da032" as const,
  mockUSD: "0xAD6F06ebA7927FC0f114c296C221fCfd6C5eBf58" as const,
  vault: "0xfB88d06289EaDD3aE23ef5C7bEF816baFfbf4000" as const,
  factory: "0x3951041d3e98A34EeDBefd9Db660d29F68B2387b" as const,
  paymaster: "0x0b860c25Dc6b2Df451AA66cFCdc7D6c6D7802F66" as const,
};

export const DEMO = {
  agent: "0x2649495B56e8c06C6682549438ac9279599A3aD8" as const,
  agentOwnerEOA: "0x3F5b96A494061F7338Da529e3047809Ac6a7FB84" as const,
  vendor: "0x3F5b96A494061F7338Da529e3047809Ac6a7FB84" as const,
};

export const MUSD_DECIMALS = 6;
