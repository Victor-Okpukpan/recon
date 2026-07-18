import { fetchWithRetry } from "../net";

const API_FOOTBALL_BASE = "https://v3.football.api-sports.io";

export interface ApiFootballEnvelope<T> {
  get: string;
  parameters: Record<string, string>;
  errors: string[] | Record<string, string>;
  results: number;
  paging: { current: number; total: number };
  response: T[];
}

export interface Fixture {
  fixture: {
    id: number;
    date: string;
    timestamp: number;
    status: { long: string; short: string; elapsed: number | null };
  };
  league: { id: number; name: string; season: number; round: string };
  teams: {
    home: { id: number; name: string; winner: boolean | null };
    away: { id: number; name: string; winner: boolean | null };
  };
  goals: { home: number | null; away: number | null };
}

export interface Injury {
  player: { id: number; name: string; photo: string };
  team: { id: number; name: string };
  fixture: { id: number; date: string };
  league: { id: number; season: number };
  type: string;
  reason: string;
}

export interface TeamSearchResult {
  team: { id: number; name: string; country: string };
}

function apiFootballKey(): string {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) {
    throw new Error("API_FOOTBALL_KEY is not set — cannot fetch sports sources without a live API key");
  }
  return key;
}

async function apiFootballFetch<T>(path: string, params: Record<string, string | number | undefined>): Promise<T[]> {
  const url = new URL(API_FOOTBALL_BASE + path);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }

  const res = await fetchWithRetry(url, { headers: { "x-apisports-key": apiFootballKey() } });
  if (!res.ok) {
    throw new Error(`API-Football ${path} failed: ${res.status} ${res.statusText}`);
  }

  const body = (await res.json()) as ApiFootballEnvelope<T>;
  const errors = Array.isArray(body.errors) ? body.errors : Object.values(body.errors ?? {});
  if (errors.length > 0) {
    throw new Error(`API-Football ${path} returned errors: ${errors.join(", ")}`);
  }
  return body.response;
}

/** Fixtures on a given calendar date (YYYY-MM-DD, API-Football's own timezone default is UTC). */
export async function getFixturesByDate(date: string): Promise<Fixture[]> {
  return apiFootballFetch<Fixture>("/fixtures", { date });
}

/** Next N upcoming fixtures for a team. */
export async function getUpcomingFixturesForTeam(teamId: number, next = 1): Promise<Fixture[]> {
  return apiFootballFetch<Fixture>("/fixtures", { team: teamId, next });
}

/** Historical head-to-head results between two teams. `last` is a paid-tier-only filter — omit it on the free tier. */
export async function getHeadToHead(teamAId: number, teamBId: number, last?: number): Promise<Fixture[]> {
  return apiFootballFetch<Fixture>("/fixtures/headtohead", { h2h: `${teamAId}-${teamBId}`, last });
}

/** Injuries for a specific fixture — the primary lookup Recon Sources needs pre-match. */
export async function getInjuriesForFixture(fixtureId: number): Promise<Injury[]> {
  return apiFootballFetch<Injury>("/injuries", { fixture: fixtureId });
}

/** Injuries for a team in a season, used when no single fixture ID is known yet. */
export async function getInjuriesForTeam(teamId: number, season: number): Promise<Injury[]> {
  return apiFootballFetch<Injury>("/injuries", { team: teamId, season });
}

/** Resolves a team name (as commonly known, e.g. from a market question) to an API-Football team id. */
export async function searchTeam(name: string): Promise<TeamSearchResult["team"] | null> {
  const results = await apiFootballFetch<TeamSearchResult>("/teams", { search: name });
  return results[0]?.team ?? null;
}
