import { env } from "../config/env.js";
import { getMockWorldCupOdds } from "./mockOdds.js";
import type { OddsApiEvent } from "./oddsApi.js";
import { oddsApiClient } from "./oddsApi.js";

const defaultExtraSports = ["soccer_epl"];

export async function getConfiguredWorldCupOdds() {
  if (env.ODDS_PROVIDER === "mock") {
    return {
      provider: "mock" as const,
      events: getMockWorldCupOdds()
    };
  }

  return {
    provider: "odds-api" as const,
    events: await oddsApiClient.getWorldCupOdds(["h2h", "spreads"])
  };
}

export async function getConfiguredOddsForSports() {
  if (env.ODDS_PROVIDER === "mock") {
    return {
      provider: "mock" as const,
      events: getMockWorldCupOdds(),
      errors: [] as string[]
    };
  }

  const sportKeys = getConfiguredSportKeys();
  const results = await Promise.all(
    sportKeys.map(async (sportKey) => {
      try {
        return {
          sportKey,
          events: await oddsApiClient.getOddsForSport(sportKey, ["h2h", "spreads"]),
          error: null
        };
      } catch (error) {
        return {
          sportKey,
          events: [] as OddsApiEvent[],
          error: error instanceof Error ? error.message : `Could not fetch ${sportKey}`
        };
      }
    })
  );

  return {
    provider: "odds-api" as const,
    events: results.flatMap((result) => result.events),
    errors: results.flatMap((result) => (result.error ? [`${result.sportKey}: ${result.error}`] : []))
  };
}

export function getConfiguredSportKeys() {
  if (env.ODDS_API_SPORT_KEYS) {
    return uniqueKeys(env.ODDS_API_SPORT_KEYS.split(","));
  }

  return uniqueKeys([env.ODDS_API_SPORT_KEY, ...defaultExtraSports]);
}

function uniqueKeys(keys: string[]) {
  return [...new Set(keys.map((key) => key.trim()).filter(Boolean))];
}
