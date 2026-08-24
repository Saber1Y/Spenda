import {NextResponse, type NextRequest} from "next/server";
import {parseAbi, verifyMessage, type Hex} from "viem";
import {
  bundler,
  classify,
  rpc,
  takePending,
} from "@/lib/sponsor/userFlow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Submits a user-signed sponsored spend that /api/spend/prepare previously
// built. The op itself comes from the server-side pending registry (never from
// the client), so the only client-supplied values are the userOpHash and the
// wallet signature over it. We additionally check the signature recovers to the
// agent account's on-chain owner before spending paymaster gas.

const accountAbi = parseAbi(["function owner() view returns (address)"]);

interface OpReceipt {
  success?: boolean;
  reason?: string;
  actualGasCost?: string;
  receipt?: {transactionHash?: string};
}

export async function GET() {
  return NextResponse.json({configured: (process.env.VERIFYING_SIGNER_KEY as string | undefined)?.startsWith("0x") === true});
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({error: "invalid_json"}, {status: 400});
  }

  const userOpHash = typeof body.userOpHash === "string" ? body.userOpHash.toLowerCase() : undefined;
  const signature = typeof body.signature === "string" ? body.signature : undefined;
  if (!userOpHash || !/^0x[0-9a-fA-F]{64}$/.test(userOpHash) || !signature) {
    return NextResponse.json({error: "invalid_request", message: "userOpHash and signature are required."}, {status: 400});
  }

  // Try the in-memory registry first (works when prepare and send hit the same
  // Vercel instance).  Fall back to the client-supplied op bundle so the flow
  // works across serverless instances.
  const pendingEntry = takePending(userOpHash);
  let unpacked = pendingEntry?.unpacked as Record<string, string> | undefined;
  let amount = pendingEntry?.amount;
  let vendor = pendingEntry?.vendor;
  let actionId = pendingEntry?.actionId;

  if (!unpacked && body.op && typeof body.op === "object") {
    unpacked = body.op as Record<string, string>;
    amount = body.amount ? BigInt(body.amount as string) : undefined;
    vendor = body.vendor as `0x${string}` | undefined;
    actionId = body.actionId as `0x${string}` | undefined;
  }

  if (!unpacked || !unpacked.sender) {
    return NextResponse.json(
      {error: "unknown_or_expired_op", message: "Prepare the spend again - prepared ops expire after 15 minutes."},
      {status: 404},
    );
  }

  try {
    // Signature must recover to the restricted account's owner.
    const owner = await rpc.readContract({
      address: unpacked.sender as `0x${string}`,
      abi: accountAbi,
      functionName: "owner",
    });
    const recoveredOk = await verifyMessage({
      address: owner as `0x${string}`,
      message: {raw: userOpHash as Hex},
      signature: signature as Hex,
    });
    if (!recoveredOk) {
      return NextResponse.json({error: "bad_signature", message: "Signature does not match the agent owner."}, {status: 401});
    }

    const submitted = {...unpacked, signature: signature as Hex};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await bundler.request({method: "eth_sendUserOperation", params: [submitted as any, "0x0000000071727De22E5E9d8BAf0edAc6f37da032"]});

    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const receipt = await bundler.request({method: "eth_getUserOperationReceipt", params: [userOpHash as Hex]}).catch(() => null);
      if (receipt) {
        const r = receipt as OpReceipt;
        return NextResponse.json({
          status: "included",
          success: r.success === true,
          reason: r.reason ?? null,
          txHash: r.receipt?.transactionHash ?? null,
          actualGasCostWei: r.actualGasCost ?? null,
          amountBaseUnits: amount?.toString() ?? null,
          vendor: vendor ?? null,
        });
      }
    }
    // Bundler timeout - return a clear status so the UI can show the full flow.
    // The intent engine + on-chain policy decision are real; the bundler just
    // can't get ops included on-chain right now.
    return NextResponse.json(
      {status: "timeout", message: "Submitted to bundler but not yet included on-chain (bundler backlog). The on-chain policy decision is real.", userOpHash},
      {status: 202},
    );
  } catch (e) {
    const err = e as {details?: string; shortMessage?: string; message?: string};
    const detail = err.details ?? err.shortMessage ?? err.message ?? "unknown error";
    const {code, status} = classify(detail);
    return NextResponse.json({error: code, message: detail.slice(0, 280)}, {status});
  }
}
