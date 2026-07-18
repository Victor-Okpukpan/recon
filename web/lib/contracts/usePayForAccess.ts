"use client";

import { useWriteContract } from "wagmi";
import { reconAccessAbi } from "./abi";
import { RECON_ACCESS_ADDRESS } from "./addresses";
import { quotePayForAccess, publicClient } from "./reconAccess";

// Explicit ceiling for payForAccess, per Monad's gas model: gas is charged on
// gas_limit (not gas actually used), so we ship a fixed limit here rather than
// trusting wallet-side eth_estimateGas. Confirmed against a real testnet
// transaction: actual usage was 86k-518k depending on path, comfortably under this.
export const PAY_FOR_ACCESS_GAS_LIMIT = 700_000n;

/**
 * Uses wagmi's standard `useWriteContract` (plain `eth_sendTransaction`) rather than
 * Monad's `useWriteContractSync` extension: the sync variant's custom RPC method isn't
 * implemented by Privy's embedded-wallet transport, so its promise never resolves or
 * rejects — the transaction lands on-chain but the UI hangs forever waiting on a
 * response that's never coming. Waiting on the receipt via a plain public RPC client
 * (not the wallet) sidesteps that entirely and works regardless of wallet transport.
 */
export function usePayForAccess() {
  const { writeContractAsync, ...rest } = useWriteContract();

  async function payForAccess(marketId: `0x${string}`) {
    const quote = await quotePayForAccess();

    const hash = await writeContractAsync({
      address: RECON_ACCESS_ADDRESS,
      abi: reconAccessAbi,
      functionName: "payForAccess",
      args: [marketId, quote.priceUpdateData],
      value: quote.totalValueWei,
      gas: PAY_FOR_ACCESS_GAS_LIMIT,
    });

    // Monad's block time is ~400ms — viem's default 4s polling interval is way more
    // conservative than the chain needs, so tighten it to get near-instant confirmation
    // once the tx actually lands instead of an unnecessary multi-second wait.
    await publicClient.waitForTransactionReceipt({ hash, pollingInterval: 500 });
  }

  return { payForAccess, ...rest };
}
