export type ThresholdResult =
  | { status: "sufficient" }
  | { status: "inconclusive"; reason: string };

export interface ThresholdInput {
  kind: "sports" | "general";
  sources: { publishedAt: string }[];
  now?: Date;
  /** General category only — fraction (0-1) of extracted claims involved in a contradiction. */
  contradictionRate?: number;
}

const SPORTS_WINDOW_DAYS = 7;
const SPORTS_MIN_SOURCES = 3;
const GENERAL_WINDOW_DAYS = 14;
const GENERAL_MIN_SOURCES = 3;
const GENERAL_MAX_CONTRADICTION_RATE = 0.4;

/** Recon Sources / Digest Inconclusive decision, isolated from the LLM and API clients so it's unit-testable on its own. */
export function evaluateThreshold(input: ThresholdInput): ThresholdResult {
  const now = input.now ?? new Date();
  const windowDays = input.kind === "sports" ? SPORTS_WINDOW_DAYS : GENERAL_WINDOW_DAYS;
  const minSources = input.kind === "sports" ? SPORTS_MIN_SOURCES : GENERAL_MIN_SOURCES;
  const windowMs = windowDays * 24 * 60 * 60 * 1000;

  const freshSources = input.sources.filter((s) => now.getTime() - new Date(s.publishedAt).getTime() <= windowMs);

  if (freshSources.length < minSources) {
    return {
      status: "inconclusive",
      reason: `Only ${freshSources.length} source(s) published within the last ${windowDays} days (need at least ${minSources}).`,
    };
  }

  if (input.kind === "general" && input.contradictionRate !== undefined && input.contradictionRate > GENERAL_MAX_CONTRADICTION_RATE) {
    return {
      status: "inconclusive",
      reason: `Sources contradict each other on ${(input.contradictionRate * 100).toFixed(0)}% of extracted claims (threshold: ${(GENERAL_MAX_CONTRADICTION_RATE * 100).toFixed(0)}%).`,
    };
  }

  return { status: "sufficient" };
}
