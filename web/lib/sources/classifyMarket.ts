import { anthropic as client } from "../anthropicClient";

export type MarketClassification =
  | { category: "sports"; teamAName: string; teamBName: string; sport: string }
  | { category: "general"; searchQuery: string };

const schema = {
  type: "object",
  properties: {
    category: { type: "string", enum: ["sports", "general"] },
    searchQuery: { type: "string" },
    teamAName: { type: "string" },
    teamBName: { type: "string" },
    sport: { type: "string" },
  },
  required: ["category", "searchQuery", "teamAName", "teamBName", "sport"],
  additionalProperties: false,
} as const;

/**
 * Classifies a Polymarket question into "sports" (has dedicated team/H2H/injury data
 * clients) or "general" (everything else — politics, crypto, entertainment, business,
 * weather — resolved via Exa's news search using the question itself as the query,
 * since that works for any topic, not just politics).
 */
export async function classifyMarket(question: string, description: string, tags: string[]): Promise<MarketClassification> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1024,
    output_config: { format: { type: "json_schema", schema } },
    messages: [
      {
        role: "user",
        content: `Classify this prediction market question into exactly one category:
- "sports": a specific match/game/contest between two teams or athletes.
- "general": anything else — elections, legislation, crypto prices, entertainment, business, weather, etc.

Question: ${question}
Description: ${description}
Tags: ${tags.join(", ")}

If "general": set searchQuery to a short, news-searchable phrasing of the question's underlying topic. Leave teamAName/teamBName/sport as empty strings.
If "sports": set teamAName and teamBName to the two competing teams/athletes as they're commonly known (not the full market question text), and sport to the sport name (e.g. "football", "basketball", "American football"). Leave searchQuery as an empty string.`,
      },
    ],
  });

  if (response.stop_reason === "max_tokens") {
    throw new Error("Market classification was truncated by max_tokens");
  }

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Market classification returned no text content");
  }

  const parsed = JSON.parse(textBlock.text) as {
    category: "sports" | "general";
    searchQuery: string;
    teamAName: string;
    teamBName: string;
    sport: string;
  };

  if (parsed.category === "sports") {
    return { category: "sports", teamAName: parsed.teamAName, teamBName: parsed.teamBName, sport: parsed.sport };
  }
  return { category: "general", searchQuery: parsed.searchQuery };
}
