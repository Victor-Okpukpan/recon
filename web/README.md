# Recon — Web

The Next.js frontend for Recon: browse Polymarket markets, preview free source
counts, and unlock a full AI-generated research Digest per market by paying
through an onchain gate on Monad testnet.

## What lives here

- **Market browsing** (`app/markets`, `app/market/[id]`) — reads Polymarket's public
  CLOB REST API directly (no SDK — see `lib/polymarket/client.ts` for why), scoped to
  Politics and Sports markets.
- **Recon Sources / Recon Digest** (`lib/sources`, `lib/digest`) — resolves current
  news for a market (API-Football for sports, Exa for everything else), extracts
  claims, checks cross-source consistency, and produces a plain-language summary plus
  an outcome lean ("Recon's read") via Claude. Gated behind payment; a free preview
  shows only the source count and Sufficient/Inconclusive state.
- **Wallet + payment** (`app/providers.tsx`, `lib/contracts`) — Privy embedded wallets
  (`@privy-io/react-auth` + `@privy-io/wagmi`) on Monad testnet only, paying
  `ReconAccess.payForAccess()` (see `../contracts`) with a Pyth pull-oracle price
  update fetched from Hermes at call time.
- **My Sessions** (`app/sessions`) — a convenience list of markets a wallet has
  unlocked, backed by a localStorage candidate list but always re-verified against
  the real onchain `hasAccess()` check before showing anything as unlocked.

## Getting started

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

- `lib/polymarket/client.ts` talks to Polymarket's CLOB REST endpoints with a plain
  `fetch()` and its own retry/timeout wrapper, not the `@polymarket/clob-client-v2`
  SDK — that SDK was dropped after it silently swallowed a real connection failure
  into a resolved value shaped like valid data.
- `lib/contracts/usePayForAccess.ts` uses wagmi's standard `useWriteContract` +
  a plain `waitForTransactionReceipt` call, not Monad's `useWriteContractSync`
  extension — the sync variant's custom RPC method isn't implemented by Privy's
  embedded-wallet transport, so its promise never resolves.
- The Digest (including "Recon's read") is cached per market for 15 minutes
  (`lib/digest/getMarketDigest.ts`), sources separately for 5 — revisiting the same
  market repeatedly within that window shows the same result, not a live recompute.
