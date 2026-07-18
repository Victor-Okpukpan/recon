import Anthropic from "@anthropic-ai/sdk";
import "./net"; // applies the ipv4first DNS fix process-wide before any request is made

// One shared client for every Digest step (classification, claim extraction +
// consistency check combined, summary, leaning) instead of separate instances per
// step. Timeout is deliberately generous, not aggressive — the claim-extraction-plus-
// consistency call generates up to 5,120 tokens, which can legitimately take real time
// under perfectly normal conditions, so a short timeout mistakes "still generating"
// for "connection hung" and cuts off calls that would have succeeded. Retries stay
// modest (2, not more) since a Digest chains 3 sequential hops (classify → extract+
// consistency → summary/leaning in parallel) — an aggressive per-call retry budget
// compounds into a multi-minute silent hang on a sustained outage instead of failing
// at a sane time, and each hop also eats into a serverless platform's execution-time
// limit (see maxDuration on the digest/sources route handlers).
export const anthropic = new Anthropic({
  maxRetries: 2,
  timeout: 45_000,
});

/**
 * Distinguishes a real "out of API credits/quota" failure (a 400 with Anthropic's
 * specific credit-balance wording) from a generic connection error, so the two don't
 * get confused in whatever message reaches the user — one means "add credits," the
 * other means "transient network issue, retry."
 */
export function describeAnthropicError(err: unknown): string {
  if (err instanceof Anthropic.APIError && err.status === 400 && /credit balance/i.test(err.message)) {
    return "Anthropic API credits are exhausted — add credits or enable auto-reload in the Anthropic Console before retrying.";
  }
  return err instanceof Error ? err.message : String(err);
}
