# ReconAccess

Onchain paywall for Recon Digest, deployed on Monad testnet. Per-market unlock, priced in USD cents and paid in native MON, converted at call time via a Pyth pull-oracle update (no hardcoded MON/USD rate). See `src/ReconAccess.sol` for the full design notes.

Both the unlock price (`setPriceUsdCents`) and the Pyth contract address (`setPythContract`) are owner-settable post-deploy, not immutable — the latter specifically because Pyth's own EVM contracts go through periodic upgrades (see the gotcha below), and needing a full redeploy every time that happens would also wipe every existing payment receipt.

## Current deployment

- **Network**: Monad Testnet, chain id `10143`
- **Contract**: [`0x48b6b86fB228451421d0AB1548C2902488ACA998`](https://testnet.monadvision.com/address/0x48b6b86fB228451421d0AB1548C2902488ACA998) — verified

## Build & test

```shell
forge build
forge test
```

## Deploy to Monad testnet

1. Import a deployer key into a local Foundry keystore (never paste a raw key into
   any file in this repo):

   ```shell
   cast wallet import monad-deployer --interactive
   ```

2. Fund that address from the faucet: https://testnet.monad.xyz

3. Set the unlock price (USD cents — e.g. `5` for $0.05) and deploy:

   ```shell
   PRICE_USD_CENTS=<cents> forge script script/Deploy.s.sol \
     --rpc-url monad_testnet \
     --account monad-deployer \
     --broadcast
   ```

   `PRICE_USD_CENTS` has no default on purpose — the unlock price is a product
   decision, not something the script should guess.

4. Note the deployed address from the script output — it goes into
   `web/lib/contracts/addresses.ts`.

## Verify (all explorers in one call)

```shell
ADDR=<deployed address>
forge verify-contract "$ADDR" src/ReconAccess.sol:ReconAccess \
  --chain 10143 --show-standard-json-input > /tmp/standard-input.json
# python3 instead of jq — no extra install needed, jq isn't guaranteed to be present.
python3 -c "import json; print(json.dumps(json.load(open('out/ReconAccess.sol/ReconAccess.json'))['metadata']))" > /tmp/metadata.json

ARGS=$(cast abi-encode "constructor(address,bytes32,uint256,address)" \
  0x2880aB155794e7179c9eE2e38200202908C17B43 \
  0x31491744e2dbf6df7fcf4ac0820d18a609b49076d45066d3568424e62f686cd1 \
  <PRICE_USD_CENTS> <OWNER_ADDRESS>)

curl -X POST https://agents.devnads.com/v1/verify -H "Content-Type: application/json" -d @- <<EOF
{
  "chainId": 10143,
  "contractAddress": "$ADDR",
  "contractName": "src/ReconAccess.sol:ReconAccess",
  "compilerVersion": "v<fill from /tmp/metadata.json's .compiler.version, e.g. v0.8.34+commit.80d5c536>",
  "standardJsonInput": $(cat /tmp/standard-input.json),
  "foundryMetadata": $(cat /tmp/metadata.json),
  "constructorArgs": "${ARGS#0x}"
}
EOF
```

## Pyth references used by this contract

- Pyth contract (Monad testnet, **current** address — not the "upgraded" one Pyth's
  docs also list, see gotcha below): `0x2880aB155794e7179c9eE2e38200202908C17B43`
- MON/USD price feed id (Pyth Stable channel, matches the address above): `0x31491744e2dbf6df7fcf4ac0820d18a609b49076d45066d3568424e62f686cd1`
- Price update data for a `payForAccess` call must be fetched off-chain from Hermes
  (`https://hermes.pyth.network/v2/updates/price/latest?ids[]=<feed id>`) and passed
  as `bytes[]` — this is what the frontend's Monad contract client does before
  calling `payForAccess`.

## Gotcha: two Pyth addresses, only one actually works right now

Pyth's docs list two contract addresses for Monad testnet: a "current" one and an "upgraded" one recommended for new integrations. **Use the current one.** The upgraded address is deployed on-chain but isn't actually synced with a valid Wormhole guardian set until Pyth's own scheduled upgrade goes live (Aug 18, 2026 at time of writing) — pointing at it makes every `payForAccess` call revert with Wormhole's `InvalidWormholeVaa` ("invalid guardian set"), confirmed by tracing a real failed testnet transaction. If that upgrade has since gone live and you want to switch, call `setPythContract(newAddress)` as the contract owner rather than redeploying.
