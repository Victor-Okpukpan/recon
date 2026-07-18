import { anthropic as client } from "../anthropicClient";
import type { Claim, ContradictionPair } from "./types";

const schema = {
  type: "object",
  properties: {
    contradictions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          claimAIndex: { type: "integer" },
          claimBIndex: { type: "integer" },
          explanation: { type: "string" },
        },
        required: ["claimAIndex", "claimBIndex", "explanation"],
        additionalProperties: false,
      },
    },
  },
  required: ["contradictions"],
  additionalProperties: false,
} as const;

export interface ConsistencyCheckResult {
  contradictions: ContradictionPair[];
  /** Fraction (0-1) of claims involved in at least one contradiction. */
  contradictionRate: number;
}

/** Cross-source consistency check — flags claims that directly contradict each other. */
export async function checkConsistency(claims: Claim[]): Promise<ConsistencyCheckResult> {
  if (claims.length < 2) {
    return { contradictions: [], contradictionRate: 0 };
  }

  const claimList = claims.map((c, i) => `[${i}] (source: ${c.sourceId}) ${c.text}`).join("\n");

  const response = await client.messages.create({
    model: "claude-sonnet-4-5",
    // A contradiction-pair list is small structured output, not prose — 8192 was
    // generous headroom left over from before claim counts were bounded upstream;
    // shrinking it cuts worst-case request duration the same way extractClaims' does.
    max_tokens: 4096,
    output_config: { format: { type: "json_schema", schema } },
    messages: [
      {
        role: "user",
        content: `Below is a numbered list of factual claims extracted from multiple sources. Identify pairs of claims that directly contradict each other (opposite facts about the same subject — not merely different emphasis or additional detail). Reference claims by their index number. If there are no contradictions, return an empty list.\n\n${claimList}`,
      },
    ],
  });

  if (response.stop_reason === "max_tokens") {
    throw new Error("Digest consistency check was truncated by max_tokens — reduce claim count or raise the limit");
  }

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Digest consistency check returned no text content");
  }
  const parsed = JSON.parse(textBlock.text) as {
    contradictions: { claimAIndex: number; claimBIndex: number; explanation: string }[];
  };

  const contradictions: ContradictionPair[] = parsed.contradictions.map((c) => ({
    claimA: claims[c.claimAIndex],
    claimB: claims[c.claimBIndex],
    explanation: c.explanation,
  }));

  const contradictingIndices = new Set<number>();
  for (const c of parsed.contradictions) {
    contradictingIndices.add(c.claimAIndex);
    contradictingIndices.add(c.claimBIndex);
  }

  return {
    contradictions,
    contradictionRate: contradictingIndices.size / claims.length,
  };
}
