import Anthropic from "@anthropic-ai/sdk";
import type { Claim, DigestSource } from "./types";

const client = new Anthropic();

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
  },
  required: ["claims"],
  additionalProperties: false,
} as const;

/** Extracts discrete, source-attributed factual claims from Recon Sources output. */
export async function extractClaims(sources: DigestSource[]): Promise<Claim[]> {
  if (sources.length === 0) return [];

  const sourceBlock = sources
    .map((s) => `[${s.id}] (${s.kind}, published ${s.publishedAt})\n${s.content}`)
    .join("\n\n---\n\n");

  const response = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 16000,
    output_config: { format: { type: "json_schema", schema } },
    messages: [
      {
        role: "user",
        content: `Extract discrete, checkable factual claims from each of the following sources. Attribute every claim to its source id exactly as given in brackets. Do not editorialize, infer beyond what's stated, or merge claims across sources. Skip filler text (headlines, bylines) — only extract substantive factual assertions.\n\n${sourceBlock}`,
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
  const parsed = JSON.parse(textBlock.text) as { claims: Claim[] };
  return parsed.claims;
}
