import { createPublicClient, http } from "viem";
import { monadTestnet } from "wagmi/chains";
import { reconAccessAbi } from "./abi";
import { pythAbi } from "./pythAbi";
import {
  MON_USD_PRICE_FEED_ID,
  PYTH_HERMES_ENDPOINT,
  PYTH_TESTNET_ADDRESS,
  RECON_ACCESS_ADDRESS,
} from "./addresses";

export const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http("https://testnet-rpc.monad.xyz"),
});

interface HermesPriceUpdateResponse {
  binary: { encoding: string; data: string[] };
  parsed?: { price: { price: string; expo: number; publish_time: number } }[];
}

export interface PayForAccessQuote {
  priceUpdateData: `0x${string}`[];
  updateFeeWei: bigint;
  requiredMonWei: bigint;
  totalValueWei: bigint;
  monUsdPrice: bigint;
  monUsdExpo: number;
}

async function fetchMonUsdPriceUpdate(): Promise<{
  updateData: `0x${string}`[];
  price: bigint;
  expo: number;
}> {
  const url = `${PYTH_HERMES_ENDPOINT}/v2/updates/price/latest?ids[]=${MON_USD_PRICE_FEED_ID}&parsed=true`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Hermes price update fetch failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as HermesPriceUpdateResponse;
  const parsed = json.parsed?.[0];
  if (!parsed) throw new Error("Hermes response missing parsed MON/USD price");

  return {
    updateData: json.binary.data.map((hex) => `0x${hex}` as `0x${string}`),
    price: BigInt(parsed.price.price),
    expo: parsed.price.expo,
  };
}

/**
 * Quotes the full cost of unlocking a market: fetches a fresh Pyth price update
 * from Hermes, then reads both the Pyth update fee and the contract's own
 * requiredMonWei (same math payForAccess enforces on-chain) so the quote can't
 * drift from what the contract will actually require.
 */
export async function quotePayForAccess(): Promise<PayForAccessQuote> {
  const { updateData, price, expo } = await fetchMonUsdPriceUpdate();

  const [priceUsdCents, updateFeeWei] = await Promise.all([
    publicClient.readContract({
      address: RECON_ACCESS_ADDRESS,
      abi: reconAccessAbi,
      functionName: "PRICE_USD_CENTS",
    }),
    publicClient.readContract({
      address: PYTH_TESTNET_ADDRESS,
      abi: pythAbi,
      functionName: "getUpdateFee",
      args: [updateData],
    }),
  ]);

  const requiredMonWei = await publicClient.readContract({
    address: RECON_ACCESS_ADDRESS,
    abi: reconAccessAbi,
    functionName: "requiredMonWei",
    args: [priceUsdCents, price, expo],
  });

  return {
    priceUpdateData: updateData,
    updateFeeWei,
    requiredMonWei,
    totalValueWei: updateFeeWei + requiredMonWei,
    monUsdPrice: price,
    monUsdExpo: expo,
  };
}

/**
 * Reads unlock status directly from the contract. Callable server-side so API routes
 * can gate paid content on-chain rather than trusting a client-supplied flag.
 */
export async function checkHasAccess(marketId: `0x${string}`, wallet: `0x${string}`): Promise<boolean> {
  return publicClient.readContract({
    address: RECON_ACCESS_ADDRESS,
    abi: reconAccessAbi,
    functionName: "hasAccess",
    args: [marketId, wallet],
  });
}

/**
 * Confirms on-chain access for a batch of candidate market ids, returning only the
 * ones that actually pass. Used by "My Sessions" — the candidate list comes from a
 * client-side localStorage cache (see lib/sessions.ts), but access itself is always
 * re-verified against the contract here, never trusted from the client.
 *
 * Note: this can't be built from AccessPaid event history instead — Monad testnet's
 * RPC caps eth_getLogs to a 100-block range, and the contract is already 200k+ blocks
 * old, so a full log scan isn't viable without a dedicated indexer.
 */
export async function filterMarketsWithAccess(marketIds: `0x${string}`[], wallet: `0x${string}`): Promise<`0x${string}`[]> {
  const results = await Promise.all(marketIds.map((id) => checkHasAccess(id, wallet)));
  return marketIds.filter((_, i) => results[i]);
}
