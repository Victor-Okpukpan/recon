# Recon

Recon is a research assistant that sits in front of a Polymarket market. Before
committing capital, Recon surfaces current, relevant sources on the underlying
question — any category Polymarket lists, not just politics or sports — generates
an AI summary of what those sources say, and explicitly says when evidence is too
thin to support a conclusion. Full-depth research unlocks per market through a small
onchain payment on Monad testnet — that payment gate is the project's onchain
component for the Monad Spark hackathon (BuildAnything track).

## Problem

Prediction markets ask a specific, time-sensitive question, but the market page
itself gives you nothing beyond a price and a resolution rule — no current news, no
sense of whether the situation has actually moved recently, nothing to tell a casual
bettor apart from someone who's actually done the reading. For a headline race
(a presidential election) that's less of an issue — mainstream coverage is
everywhere. For the hundreds of smaller, local, or niche markets that make up most
of Polymarket's volume, there's often no research tooling at all, and manually
searching news per-market before every bet doesn't scale.

## Solution

Recon automates that research step per market: pull current sources, extract
discrete claims, check them against each other for contradictions, and produce a
plain-language summary with source attribution — refusing to produce one at all if
there isn't enough current material to support it. A small onchain payment on Monad
unlocks the full result per market, priced in USD cents and settled in native MON at
the live rate via a Pyth pull-oracle update.

## How it works

1. Browse every live Polymarket market — filter pills are computed live from
   whatever tags are actually trending in the current batch (never a hardcoded
   category list), or open a market directly.
2. **Recon Sources** resolves current material on the market's question — API-Football
   for sports (injuries, head-to-head, fixtures), Exa news search for everything
   else — and returns a free preview: source count plus a Sufficient/Inconclusive
   state. No payment required to see this much.
3. Connect a wallet (Privy — email, social login, or an external wallet) and pay
   `payForAccess(marketId)` on `ReconAccess`.
4. **Recon Digest** unlocks: a plain-language summary, per-claim source attribution,
   cross-source contradiction flags, and "Recon's read" — an AI-derived outcome lean
   with a confidence level, always paired with a hardcoded "not financial advice"
   disclaimer.
5. **My Sessions** lists markets a wallet has unlocked, re-verified against the real
   onchain `hasAccess()` check every time — never trusted from a client-side flag.

## Repo layout

```
web/         Next.js 16 frontend + API routes — see web/README.md
contracts/   ReconAccess.sol (Foundry) — see contracts/README.md
```

## Stack

- **Frontend**: Next.js 16 (App Router, Turbopack), wagmi, Tailwind v4
- **Wallet**: Privy embedded wallets + external wallet connect, Monad testnet only
- **Digest**: Claude (Anthropic API) for claim extraction, consistency checking,
  summarization, and the outcome lean
- **Sources**: API-Football (sports), Exa news search (everything else)
- **Markets**: Polymarket's public CLOB REST API, read-only
- **Payment gate**: `ReconAccess.sol` on Monad testnet, priced via a Pyth pull-oracle

## Deployment

- **Network**: Monad Testnet, chain id `10143`
- **Contract**: `ReconAccess` at [`0x48b6b86fB228451421d0AB1548C2902488ACA998`](https://testnet.monadvision.com/address/0x48b6b86fB228451421d0AB1548C2902488ACA998) (verified)

## Getting started

See `web/README.md` for frontend setup (env vars, dev server) and
`contracts/README.md` for building, testing, and deploying the contract.
