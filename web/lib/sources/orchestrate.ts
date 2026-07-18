import type { PolymarketMarket } from "../polymarket/client";
import type { DigestSource } from "../digest/types";
import { classifyMarket } from "./classifyMarket";
import { searchTeam, getHeadToHead, getUpcomingFixturesForTeam, getInjuriesForFixture } from "./sports";
import { searchNews } from "./news";

export interface ResolvedMarketSources {
  category: "sports" | "general";
  sources: DigestSource[];
}

const GENERAL_SEARCH_WINDOW_DAYS = 14;
const SPORTS_UPCOMING_FIXTURE_LOOKAHEAD = 10;

async function resolveSportsSources(teamAName: string, teamBName: string): Promise<DigestSource[]> {
  const [teamA, teamB] = await Promise.all([searchTeam(teamAName), searchTeam(teamBName)]);
  if (!teamA || !teamB) {
    return [];
  }

  const now = new Date().toISOString();
  const sources: DigestSource[] = [];

  try {
    const h2h = await getHeadToHead(teamA.id, teamB.id);
    for (const f of h2h) {
      sources.push({
        id: `fixture-${f.fixture.id}`,
        kind: "sports",
        label: `${f.teams.home.name} vs ${f.teams.away.name} (head-to-head, ${f.league.name})`,
        publishedAt: f.fixture.date,
        content: `${f.teams.home.name} ${f.goals.home ?? "?"}-${f.goals.away ?? "?"} ${f.teams.away.name}, ${f.league.name} ${f.league.round}, played ${f.fixture.date}.`,
      });
    }
  } catch {
    // Head-to-head unavailable (e.g. free-tier restriction) — proceed without it rather than fail the whole preview.
  }

  try {
    const upcoming = await getUpcomingFixturesForTeam(teamA.id, SPORTS_UPCOMING_FIXTURE_LOOKAHEAD);
    const matchedFixture = upcoming.find((f) => f.teams.home.id === teamB.id || f.teams.away.id === teamB.id);
    if (matchedFixture) {
      sources.push({
        id: `upcoming-${matchedFixture.fixture.id}`,
        kind: "sports",
        label: `Scheduled: ${matchedFixture.teams.home.name} vs ${matchedFixture.teams.away.name}`,
        publishedAt: now,
        content: `${matchedFixture.teams.home.name} vs ${matchedFixture.teams.away.name} scheduled for ${matchedFixture.fixture.date} (${matchedFixture.league.name}).`,
      });

      try {
        const injuries = await getInjuriesForFixture(matchedFixture.fixture.id);
        for (const i of injuries) {
          sources.push({
            id: `injury-${i.player.id}-${matchedFixture.fixture.id}`,
            kind: "sports",
            label: `Injury report: ${i.player.name} (${i.team.name})`,
            publishedAt: now,
            content: `${i.player.name} (${i.team.name}): ${i.type} — ${i.reason}.`,
          });
        }
      } catch {
        // Injuries endpoint restricted for the current season on the free API-Football tier —
        // this is a real, honest gap, not something to paper over with fake data.
      }
    }
  } catch {
    // Upcoming-fixture lookup failed — H2H sources (if any) still stand on their own.
  }

  return sources;
}

async function resolveGeneralSources(searchQuery: string): Promise<DigestSource[]> {
  const windowStart = new Date(Date.now() - GENERAL_SEARCH_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const articles = await searchNews(searchQuery, { startPublishedDate: windowStart, numResults: 10 });

  return articles.map((a) => ({
    id: a.id,
    kind: "general" as const,
    label: a.title,
    url: a.url,
    publishedAt: a.publishedDate,
    content: a.text.slice(0, 3000),
  }));
}

/** Resolves any Polymarket market into the Recon Sources it needs — sports gets team/H2H/injury data, everything else gets news search. */
export async function resolveMarketSources(market: PolymarketMarket): Promise<ResolvedMarketSources> {
  const classification = await classifyMarket(market.question, market.description, market.tags ?? []);

  if (classification.category === "sports") {
    const sources = await resolveSportsSources(classification.teamAName, classification.teamBName);
    return { category: "sports", sources };
  }

  const sources = await resolveGeneralSources(classification.searchQuery);
  return { category: "general", sources };
}
