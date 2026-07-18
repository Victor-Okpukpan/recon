import { anthropic as client } from "../anthropicClient";
import type { Claim, ContradictionPair } from "./types";

const schema = {
  type: "object",
  properties: {
    outcome: { type: "string" },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    reasoning: { type: "string" },
  },
  required: ["outcome", "confidence", "reasoning"],
  additionalProperties: false,
} as const;

export interface Leaning {
  outcome: string;
  confidence: "low" | "medium" | "high";
  reasoning: string;
}

/**
 * A directional read of which outcome current sources point toward, with a
 * confidence level and short reasoning. Presented in the UI as analysis with an
 * explicit "not financial advice" disclaimer, never as an instruction to trade —
 * the disclaimer lives in the UI layer so it can't be dropped by a model response.
 */
export async function deriveLeaning(
  question: string,
  outcomes: string[],
  claims: Claim[],
  contradictions: ContradictionPair[]
): Promise<Leaning> {
  const claimList = claims.map((c) => `- (${c.sourceId}) ${c.text}`).join("\n");
  const contradictionList =
    contradictions.length > 0
      ? contradictions.map((c) => `- "${c.claimA.text}" vs "${c.claimB.text}": ${c.explanation}`).join("\n")
      : "None found.";

  const response = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1024,
    output_config: { format: { type: "json_schema", schema } },
    messages: [
      {
        role: "user",
        content: `Question: ${question}
Possible outcomes: ${outcomes.join(", ")}

Extracted claims from current sources:
${claimList}

Contradictions found across sources:
${contradictionList}

Based solely on the claims above, which of the possible outcomes do current sources point toward, and how confident should a careful reader be? Use the exact outcome label as given. Use "low" confidence whenever sources are thin, mixed, or conflicting — don't force a confident read the evidence doesn't support. Give 1-2 sentences of reasoning grounded only in the claims above, no outside knowledge. This is a summary of what current public sources indicate, not a trading instruction.`,
      },
    ],
  });

  if (response.stop_reason === "max_tokens") {
    throw new Error("Digest leaning generation was truncated by max_tokens");
  }
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Digest leaning generation returned no text content");
  }
  return JSON.parse(textBlock.text) as Leaning;
}
