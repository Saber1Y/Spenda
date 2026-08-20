import {NextResponse, type NextRequest} from "next/server";
import {createHmac, timingSafeEqual} from "node:crypto";
import {getAddress} from "viem";

function tokenPayload(token: string): string | null {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  const expected = createHmac("sha256", process.env.SPENDA_SESSION_SECRET ?? "development-only-change-me").update(Buffer.from(encoded, "base64url").toString()).digest("base64url");
  if (expected.length !== signature.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return null;
  return Buffer.from(encoded, "base64url").toString();
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get("spenda_wallet_session")?.value;
  if (!token) return NextResponse.json({authenticated: false});
  try {
    const payload = JSON.parse(tokenPayload(token) ?? "null");
    if (!payload || payload.expiresAt <= Math.floor(Date.now() / 1000)) return NextResponse.json({authenticated: false});
    return NextResponse.json({authenticated: true, session: {...payload, address: getAddress(payload.address)}});
  } catch { return NextResponse.json({authenticated: false}); }
}
