import { env } from "../config/env.js";
import { getMockWorldCupOdds } from "./mockOdds.js";
import { oddsApiClient } from "./oddsApi.js";

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
