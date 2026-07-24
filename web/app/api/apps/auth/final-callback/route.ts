import {type NextRequest, NextResponse} from "next/server";

export async function GET(req: NextRequest) {
  const {searchParams} = new URL(req.url);
  const token = searchParams.get("access_token");
  const state = searchParams.get("state");

  let redirectTo = "/dashboard";
  if (state) {
    try {
      const parsed = JSON.parse(state);
      if (parsed.from_url) redirectTo = parsed.from_url;
    } catch {}
  }

  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const safeToken = JSON.stringify(token);
  const safeRedirect = JSON.stringify(redirectTo);

  const html = `<!DOCTYPE html><html><body><script>
    localStorage.setItem("base44_access_token", ${safeToken});
    localStorage.setItem("token", ${safeToken});
    window.location.replace(${safeRedirect});
  </script></body></html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {"Content-Type": "text/html"},
  });
}
