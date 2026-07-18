import { anthropic as client } from "../anthropicClient";
import type { Claim, ContradictionPair, DigestSource } from "./types";

const schema = {
  type: "object",
  properties: {
    claims: {
      type: "array",
      items: {
        type: "object",
        properties: {
          sourceId: { type: "string" },
          text: { type: "string" },
        },
        required: ["sourceId", "text"],
        additionalProperties: false,
      },
    },
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
  required: ["claims", "contradictions"],
  additionalProperties: false,
} as const;

export interface ClaimsAndConsistency {
  claims: Claim[];
  contradictions: ContradictionPair[];
  /** Fraction (0-1) of claims involved in at least one contradiction. */
  contradictionRate: number;
}

/**
 * Extracts claims and checks them for cross-source contradictions in a single Claude
 * call instead of two sequential ones (extract, then separately check). The Digest
 * pipeline chains several of these round-trips and each one adds real wall-clock time
 * that a serverless platform's execution-time limit doesn't forgive — merging the two
 * steps that both operate on the same claim set removes one full hop from that chain.
 */
export async function extractClaimsAndConsistency(sources: DigestSource[]): Promise<ClaimsAndConsistency> {
  if (sources.length === 0) return { claims: [], contradictions: [], contradictionRate: 0 };

  const sourceBlock = sources
    .map((s) => `[${s.id}] (${s.kind}, published ${s.publishedAt})\n${s.content}`)
    .join("\n\n---\n\n");

  const response = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 5120,
    output_config: { format: { type: "json_schema", schema } },
    messages: [
      {
        role: "user",
        content: `Extract discrete, checkable factual claims from each of the following sources, then identify contradictions among the claims you extracted.

Step 1 — claims: Attribute every claim to its source id exactly as given in brackets. Do not editorialize, infer beyond what's stated, or merge claims across sources. Skip filler text (headlines, bylines) — only extract substantive factual assertions.

Step 2 — contradictions: Using the claims array you just built (indexed from 0), identify pairs that directly contradict each other (opposite facts about the same subject — not merely different emphasis or additional detail). Reference claims by their index in your own claims array. If there are none, return an empty list.

${sourceBlock}`,
      },
    ],
  });

  if (response.stop_reason === "max_tokens") {
    throw new Error("Digest claim extraction was truncated by max_tokens — reduce source content or raise the limit");
  }

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Digest claim extraction returned no text content");
  }

  const parsed = JSON.parse(textBlock.text) as {
    claims: Claim[];
    contradictions: { claimAIndex: number; claimBIndex: number; explanation: string }[];
  };

  const contradictions: ContradictionPair[] = parsed.contradictions.map((c) => ({
    claimA: parsed.claims[c.claimAIndex],
    claimB: parsed.claims[c.claimBIndex],
    explanation: c.explanation,
  }));

  const contradictingIndices = new Set<number>();
  for (const c of parsed.contradictions) {
    contradictingIndices.add(c.claimAIndex);
    contradictingIndices.add(c.claimBIndex);
  }

  return {
    claims: parsed.claims,
    contradictions,
    contradictionRate: parsed.claims.length > 0 ? contradictingIndices.size / parsed.claims.length : 0,
  };
}
