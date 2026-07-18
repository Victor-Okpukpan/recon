import Anthropic from "@anthropic-ai/sdk";
import type { Claim, ContradictionPair } from "./types";

const client = new Anthropic();

/**
 * Plain-language summary only — never a directional betting recommendation.
 * That constraint is enforced by instruction here, not by any downstream filter,
 * so keep the prompt language explicit if this is ever reworded.
 */
export async function summarizeDigest(question: string, claims: Claim[], contradictions: ContradictionPair[]): Promise<string> {
  if (claims.length === 0) return "";

  const claimList = claims.map((c) => `- (${c.sourceId}) ${c.text}`).join("\n");
  const contradictionList =
    contradictions.length > 0
      ? contradictions.map((c) => `- "${c.claimA.text}" vs "${c.claimB.text}": ${c.explanation}`).join("\n")
      : "None found.";

  const response = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `You are summarizing research for a prediction market question, for a reader deciding whether they understand the situation well enough to form their own view.

Question: ${question}

Extracted claims from current sources:
${claimList}

Contradictions found across sources:
${contradictionList}

Write a short (3-5 sentence) plain-language summary of what the current sources say. Rules:
- Never state or imply which outcome is more likely, and never give a betting or trading recommendation ("should bet yes/no", "the odds favor...", etc.) — that is explicitly out of scope.
- If sources disagree, say so plainly rather than picking a side.
- Stick to what the claims actually say — don't add outside knowledge or speculation.`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Digest summary generation returned no text content");
  }
  return textBlock.text.trim();
}
