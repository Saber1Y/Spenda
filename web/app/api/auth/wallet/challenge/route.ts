import {NextResponse, type NextRequest} from "next/server";
import {randomBytes} from "node:crypto";
import {isAddress, getAddress} from "viem";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  if (typeof body.address !== "string" || !isAddress(body.address)) return NextResponse.json({error: "invalid_wallet_address"}, {status: 400});
  const address = getAddress(body.address);
  const nonce = randomBytes(24).toString("hex");
  const issuedAt = new Date().toISOString();
  const message = [
    "Spenda wants you to sign in with your wallet:",
    address,
    "",
    "Sign in to Spenda. This signature does not authorize a transaction or move funds.",
    "",
    `URI: ${new URL(request.url).origin}`,
    "Version: 1",
    "Chain ID: 968",
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
  ].join("\n");
  const response = NextResponse.json({message, nonce});
  response.cookies.set("spenda_wallet_challenge", JSON.stringify({address: address.toLowerCase(), nonce, message}), {httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 300, path: "/"});
  return response;
}
