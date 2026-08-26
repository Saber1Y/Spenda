/**
 * Fallback relayer: submits handleOps directly to the EntryPoint via a raw
 * transaction, bypassing the broken bundler entirely. No paymaster - the
 * account pays gas from its BOT balance. The relayer:
 *   1. Ensures the account has enough BOT for gas (~0.005 BOT)
 *   2. Submits handleOps with empty paymasterAndData
 *   3. The EntryPoint validates the owner signature and executes the spend
 */
import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  http,
  parseAbi,
  type Hex,
  type Address,
} from "viem";
import {privateKeyToAccount} from "viem/accounts";

const RPC = "https://rpc.botchain.ai";
const EP = "0x0000000071727De22E5E9d8BAf0edAc6f37da032" as Address;
const CHAIN = {id: 677, name: "BOT Chain", nativeCurrency: {name: "BOT", symbol: "BOT", decimals: 18}, rpcUrls: {default: {http: [RPC]}}};

const MIN_BOT_FOR_GAS = 5_000_000_000_000_000n; // 0.005 BOT
const FUND_AMOUNT = 10_000_000_000_000_000n; // 0.01 BOT per top-up

const handleOpsAbi = parseAbi([
  "function handleOps((address sender,uint256 nonce,bytes initCode,bytes callData,bytes32 accountGasLimits,uint256 preVerificationGas,bytes32 gasFees,bytes paymasterAndData,bytes signature)[],address payable beneficiary)",
]);

export interface RelayedResult {
  ok: boolean;
  txHash?: string;
  error?: string;
  funded?: boolean;
}

/**
 * Submit handleOps directly to the EntryPoint via the relayer EOA.
 * Automatically funds the account with BOT if its balance is too low.
 */
export async function relayHandleOps(
  packedOps: Array<{
    sender: Address;
    nonce: string;
    initCode: Hex;
    callData: Hex;
    accountGasLimits: Hex;
    preVerificationGas: string;
    gasFees: Hex;
    paymasterAndData: Hex;
    signature: Hex;
  }>,
  treasuryKey: Hex,
): Promise<RelayedResult> {
  const account = privateKeyToAccount(treasuryKey);
  const publicClient = createPublicClient({chain: CHAIN, transport: http(RPC)});
  const walletClient = createWalletClient({account, chain: CHAIN, transport: http(RPC)});

  const sender = packedOps[0].sender;

  // Step 1: Check if account needs BOT for gas
  const bal = await publicClient.getBalance({address: sender});
  let funded = false;
  if (bal < MIN_BOT_FOR_GAS) {
    // Fund the account with BOT from treasury
    const fundHash = await walletClient.sendTransaction({
      to: sender,
      value: FUND_AMOUNT,
    });
    await publicClient.waitForTransactionReceipt({hash: fundHash});
    funded = true;
  }

  // Step 2: Strip paymasterAndData — account pays gas directly
  const opsNoPm = packedOps.map((op) => ({...op, paymasterAndData: "0x" as Hex}));

  // Step 3: Encode handleOps
  const opsForAbi = opsNoPm.map((op) => ({
    ...op,
    nonce: BigInt(op.nonce),
    preVerificationGas: BigInt(op.preVerificationGas),
  }));
  const data = encodeFunctionData({
    abi: handleOpsAbi,
    functionName: "handleOps",
    args: [opsForAbi, account.address],
  });

  // Step 4: Submit the tx
  const nonce = await publicClient.getTransactionCount({address: account.address});
  const gas = await publicClient.estimateGas({
    to: EP,
    data,
    account: account.address,
  });

  const hash = await walletClient.sendTransaction({
    to: EP,
    data,
    gas: gas * 15n / 10n,
    nonce,
  });

  const receipt = await publicClient.waitForTransactionReceipt({hash});

  return {
    ok: receipt.status === "success",
    txHash: hash,
    funded,
    error: receipt.status !== "success" ? "handleOps reverted on-chain" : undefined,
  };
}
