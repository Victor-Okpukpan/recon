const EXA_SEARCH_URL = "https://api.exa.ai/search";

export interface ExaNewsResult {
  id: string;
  title: string;
  url: string;
  publishedDate: string;
  author: string | null;
  text: string;
}

interface ExaSearchResponse {
  results: ExaNewsResult[];
}

function exaApiKey(): string {
  const key = process.env.EXA_API_KEY;
  if (!key) {
    throw new Error("EXA_API_KEY is not set — cannot fetch politics sources without a live API key");
  }
  return key;
}

/**
 * Searches Exa's news category with full article text returned inline, filtered to
 * publications after `startPublishedDate` — the caller applies the category-specific
 * staleness window (politics: 14 days) before deciding Sufficient vs Inconclusive.
 */
export async function searchPoliticalNews(
  query: string,
  opts: { startPublishedDate: string; numResults?: number }
): Promise<ExaNewsResult[]> {
  const res = await fetch(EXA_SEARCH_URL, {
    method: "POST",
    headers: {
      "x-api-key": exaApiKey(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      category: "news",
      numResults: opts.numResults ?? 10,
      startPublishedDate: opts.startPublishedDate,
      contents: { text: true },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Exa search failed: ${res.status} ${res.statusText} ${body}`);
  }

  const data = (await res.json()) as ExaSearchResponse;
  return data.results;
}
