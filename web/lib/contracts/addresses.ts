export const MONAD_TESTNET_CHAIN_ID = 10143;

export const RECON_ACCESS_ADDRESS = process.env.NEXT_PUBLIC_RECON_ACCESS_ADDRESS as `0x${string}`;

// Monad testnet Pyth contract — the "current" (pre-upgrade) address, not the
// "upgraded" one Pyth's docs also list, which doesn't accept real Hermes update
// data until Pyth's own scheduled Aug 18, 2026 upgrade actually goes live (confirmed
// live: the upgraded address reverts with a Wormhole "invalid guardian set" error).
// Same values ReconAccess.sol was deployed with — see contracts/script/Deploy.s.sol.
export const PYTH_TESTNET_ADDRESS = "0x2880aB155794e7179c9eE2e38200202908C17B43" as const;
export const MON_USD_PRICE_FEED_ID = "0x31491744e2dbf6df7fcf4ac0820d18a609b49076d45066d3568424e62f686cd1" as const;
export const PYTH_HERMES_ENDPOINT = "https://hermes.pyth.network";

