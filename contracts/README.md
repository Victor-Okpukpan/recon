# ReconAccess

Onchain paywall for Recon Digest. Per-market unlock, priced in USD cents and paid
in native MON, converted at call time via a Pyth pull-oracle update (no hardcoded
MON/USD rate). See `src/ReconAccess.sol` for the full design notes.

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
cat out/ReconAccess.sol/ReconAccess.json | jq '.metadata' > /tmp/metadata.json

ARGS=$(cast abi-encode "constructor(address,bytes32,uint256,address)" \
  0xFC6bd9F9f0c6481c6Af3A7Eb46b296A5B85ed379 \
  0x31491744e2dbf6df7fcf4ac0820d18a609b49076d45066d3568424e62f686cd1 \
  <PRICE_USD_CENTS> <OWNER_ADDRESS>)

curl -X POST https://agents.devnads.com/v1/verify -H "Content-Type: application/json" -d @- <<EOF
{
  "chainId": 10143,
  "contractAddress": "$ADDR",
  "contractName": "src/ReconAccess.sol:ReconAccess",
  "compilerVersion": "v0.8.34+commit.<fill-from-forge---version>",
  "standardJsonInput": $(cat /tmp/standard-input.json),
  "foundryMetadata": $(cat /tmp/metadata.json),
  "constructorArgs": "${ARGS#0x}"
}
EOF
```

## Pyth references used by this contract

- Pyth contract (Monad testnet, upgraded address): `0xFC6bd9F9f0c6481c6Af3A7Eb46b296A5B85ed379`
- MON/USD price feed id (Pyth Stable channel, matches the address above): `0x31491744e2dbf6df7fcf4ac0820d18a609b49076d45066d3568424e62f686cd1`
- Price update data for a `payForAccess` call must be fetched off-chain from Hermes
  (`https://hermes.pyth.network/v2/updates/price/latest?ids[]=<feed id>`) and passed
  as `bytes[]` — this is what the frontend's Monad contract client does before
  calling `payForAccess`.
