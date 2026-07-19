# Recon — Web

The Next.js frontend for Recon: browse any Polymarket market, preview free source counts, and unlock a full AI-generated research Digest per market by paying through an onchain gate on Monad testnet.

## What lives here

- **Market browsing** (`app/markets`, `app/market/[id]`) — reads Polymarket's public CLOB REST API directly (no SDK — see `lib/polymarket/client.ts` for why). Every category Polymarket has is browsable; the category filter pills are computed live from whatever tags are actually most frequent in the currently-fetched markets, not a hardcoded list (Polymarket's tags mix genuine categories with hundreds of narrow sub-tags at no fixed taxonomy level, so there's nothing authoritative to hardcode).
- **Recon Sources / Recon Digest** (`lib/sources`, `lib/digest`) — resolves current news for a market (API-Football for sports, Exa for everything else), extracts claims, checks cross-source consistency, and produces a plain-language summary plus an outcome lean ("Recon's read") via Claude. Gated behind payment; a free preview shows only the source count and Sufficient/Inconclusive state.
- **Wallet + payment** (`app/providers.tsx`, `lib/contracts`) — Privy embedded wallets (`@privy-io/react-auth` + `@privy-io/wagmi`) on Monad testnet only, paying `ReconAccess.payForAccess()` (see `../contracts`) with a Pyth pull-oracle price update fetched from Hermes at call time.
- **My Sessions** (`app/sessions`) — a convenience list of markets a wallet has unlocked, backed by a localStorage candidate list but always re-verified against the real onchain `hasAccess()` check before showing anything as unlocked.

## Getting starte 
```shell
npm install
cp .env.local.example .env.local   # then fill in the values below
npm run dev
```

Open http://localhost:3000.

## Environment variables

| Variable | Where it comes from |
|---|---|
| `API_FOOTBALL_KEY` | https://www.api-football.com — free tier, 100 req/day |
| `EXA_API_KEY` | https://exa.ai — free tier, 1,000 req/month |
| `ANTHROPIC_API_KEY` | Anthropic Console — server-side only, powers Recon Digest |
| `NEXT_PUBLIC_RECON_ACCESS_ADDRESS` | `ReconAccess` deployment address — see `../contracts/README.md` |
| `NEXT_PUBLIC_PRIVY_APP_ID` | Privy Dashboard (dashboard.privy.io) — create an app, copy its App ID |
| `RECON_ALLOWLISTED_WALLETS` | Optional, comma-separated. Wallets that skip payment during testing — layered on top of the real onchain check, never a substitute for it |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Optional. Upstash Redis (e.g. via Vercel's marketplace integration — auto-injected once connected). Without these, caching falls back to a local-disk cache that only helps `next dev`, not a real serverless deployment — see below |

**One manual step Privy requires**: enabling login methods (Google, Apple, Discord,
Twitter/X, Farcaster) happens in the Privy Dashboard under "Login Methods," not in
code — `app/providers.tsx`'s `loginMethods` array only sets which methods the app
*asks* Privy for, the dashboard controls what's actually turned on.

## Commands

```shell
npx tsc --noEmit   # typecheck
npx next build     # production build
npm run dev        # dev server (Turbopack)
```

## Notable implementation details worth knowing before changing things

- `lib/polymarket/client.ts` talks to Polymarket's CLOB REST endpoints with a plain `fetch()` and its own retry/timeout wrapper, not the `@polymarket/clob-client-v2` SDK — that SDK was dropped after it silently swallowed a real connection failure into a resolved value shaped like valid data.
- `lib/contracts/usePayForAccess.ts` uses wagmi's standard `useWriteContract` + a plain `waitForTransactionReceipt` call, not Monad's `useWriteContractSync` extension — the sync variant's custom RPC method isn't implemented by Privy's embedded-wallet transport, so its promise never resolves.
- `lib/net.ts` sets Node's DNS resolution to prefer IPv4 (`dns.setDefaultResultOrder`) process-wide. Some sandboxed/dev environments have an unreliable outbound IPv6 route; Node's fetch tries IPv6 first by default and can hang or fail outright when it's down, while tools like `curl` (which prefer IPv4) don't show the problem. Every external HTTP call in this app (Polymarket, Exa, API-Football, Anthropic) goes through this fix. This is a process-wide setting — it needs an actual dev-server restart to take effect if changed, not just a file save.
- `lib/anthropicClient.ts` is a single shared, hardened Claude client used by every Digest step (classification, claim extraction + consistency check combined, summary, leaning) instead of a separate instance per step. `describeAnthropicError()` there distinguishes a real "out of API credits" failure from a generic connection error, since the two look similar otherwise but mean very different things. `lib/digest/extractClaimsAndConsistency.ts` merges what used to be two sequential Claude calls into one — the Digest pipeline is 3 sequential hops (classify → extract claims + check consistency → summary/leaning in parallel), not 4, both for speed and to stay well under the `maxDuration` above.
- Caching (`lib/cache.ts`) checks an in-memory `Map` first (fast path within a single warm instance), then falls through to whichever persistent backend is configured: Upstash Redis if `KV_REST_API_URL`/`KV_REST_API_TOKEN` are set (the only option that actually persists across serverless invocations — this is what production should use), otherwise a JSON file per key under `.cache/` (gitignored; local-dev convenience only, so a `next dev` restart doesn't throw away an already-computed Digest — a fresh one costs several real Claude API calls). Current TTLs: market data 1 hour, sources 30 minutes, full Digest (including "Recon's read") 2 hours — deliberately generous, since news/market sentiment doesn't meaningfully shift minute-to-minute and recomputing is the expensive part.
- `app/api/digest/route.ts` and `app/api/sources/route.ts` set `export const maxDuration = 60` — a fresh Digest chains a few sequential Claude calls (classification, claim extraction + consistency, summary/leaning) that can legitimately take longer than a serverless platform's default execution timeout for a content-heavy market. 60s is Vercel Hobby's ceiling; raise it if deployed on a plan that allows more.
- User-facing expectation: the first time a market's Digest is requested (nothing cached yet), expect **at least ~30 seconds** before it appears, more for a market with a lot of source material — it's several real sequential Claude calls, not a lookup. `app/market/[id]/page.tsx` reflects this with a "Retrying…" / "this can take a moment" state rather than a spinner that implies something's wrong. Once computed, the result is cached (see below), so revisiting the same market is fast.
- Any page using `useSearchParams()` (currently `app/markets/page.tsx`, for the footer's category deep-links) must wrap the component that calls it in a `<Suspense>` boundary, or the production build fails with "should be wrapped in a suspense boundary." A local `npx next build` did **not** catch this — only Vercel's actual build did (it ran with 1 worker vs. 7 locally, which appears to affect whether the check triggers) — so don't trust a clean local build alone as proof this is fine if you add another `useSearchParams()` call elsewhere.
