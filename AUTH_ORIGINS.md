# Spenda Authentication Origins

Spenda has one user-facing authentication flow.
Users log in through the Spenda Next.js application.
Base44 provides authentication APIs and backend functions, but users do not need to navigate through the Base44 dashboard.

## Local Development

- App origin: `http://localhost:3000`
- OAuth callback: `http://localhost:3000/api/apps/auth/final-callback`
- Start with `cd web && npm run dev -- --port 3000`.

## Production

- App origin: `https://spenda-delta.vercel.app`
- OAuth callback: `https://spenda-delta.vercel.app/api/apps/auth/final-callback`

The Google login button builds the callback from `window.location.origin`, so localhost and production do not share a redirect URL.
The Base44 app ID remains public configuration.
The access token is stored in browser local storage by the SDK callback and is forwarded to Base44 functions when needed.

Spenda also exposes wallet authentication at `/api/auth/wallet/*`.
Wallet sessions use a one-time challenge, a chain-968 signed message, and an HTTP-only cookie.
This flow is independent of the Base44 hosted domain and works on localhost and Vercel.

## Base44 Configuration

The Base44 application must allow both callback origins in its OAuth/domain settings:

- `http://localhost:3000/api/apps/auth/final-callback`
- `https://spenda-delta.vercel.app/api/apps/auth/final-callback`

This is an allowlist configuration requirement, not a second user authentication flow.

Do not set the Base44 dashboard URL as the user-facing redirect target.

## Security Rules

- Callback redirects accept only same-origin relative paths.
- External `next` URLs are replaced with `/dashboard`.
- Private keys remain server-only.
- Wallet sessions use `SPENDA_SESSION_SECRET`, which must be set in Vercel and local server environments.
- Before deploying wallet auth to Vercel, set `SPENDA_SESSION_SECRET` for Production, Preview, and Development as appropriate.
- Browser tokens are never placed in `NEXT_PUBLIC_` environment variables.
- Local and production origins must be configured separately in the OAuth provider.
