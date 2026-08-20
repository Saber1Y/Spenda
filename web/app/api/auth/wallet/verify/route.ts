import {NextResponse, type NextRequest} from "next/server";
import {createHmac, randomUUID, timingSafeEqual} from "node:crypto";
import {getAddress, isAddress, recoverMessageAddress, type Hex} from "viem";

export const runtime = "nodejs";
const SESSION_MAX_AGE = 7 * 24 * 60 * 60;

function secret(): string { return process.env.SPENDA_SESSION_SECRET ?? "development-only-change-me"; }
function tokenFor(payload: string): string { return `${Buffer.from(payload).toString("base64url")}.${createHmac("sha256", secret()).update(payload).digest("base64url")}`; }

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  if (typeof body.address !== "string" || !isAddress(body.address) || typeof body.signature !== "string") return NextResponse.json({error: "address_and_signature_required"}, {status: 400});
  const challenge = request.cookies.get("spenda_wallet_challenge")?.value;
  if (!challenge) return NextResponse.json({error: "challenge_missing_or_expired"}, {status: 400});
  let parsed: {address: string; nonce: string; message: string};
  try { parsed = JSON.parse(challenge); } catch { return NextResponse.json({error: "challenge_invalid"}, {status: 400}); }
  if (parsed.address !== body.address.toLowerCase()) return NextResponse.json({error: "challenge_address_mismatch"}, {status: 400});
  let recovered: string;
  try { recovered = await recoverMessageAddress({message: parsed.message, signature: body.signature as Hex}); } catch { return NextResponse.json({error: "signature_invalid"}, {status: 401}); }
  if (recovered.toLowerCase() !== parsed.address) return NextResponse.json({error: "signature_address_mismatch"}, {status: 401});
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE;
  const payload = JSON.stringify({address: getAddress(recovered), chainId: 968, expiresAt, sessionId: randomUUID()});
  const response = NextResponse.json({ok: true, session: {address: getAddress(recovered), chainId: 968, expiresAt}});
  response.cookies.set("spenda_wallet_session", tokenFor(payload), {httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: SESSION_MAX_AGE, path: "/"});
  response.cookies.set("spenda_wallet_challenge", "", {httpOnly: true, expires: new Date(0), path: "/"});
  return response;
}
