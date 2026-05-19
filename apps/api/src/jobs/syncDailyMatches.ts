import { getConfiguredWorldCupOdds } from "../services/oddsProvider.js";

export async function syncDailyMatches() {
  const { events, provider } = await getConfiguredWorldCupOdds();

  return {
    provider,
    syncedEvents: events.length,
    note: "Database upsert and offer extraction will be implemented in the next step."
  };
}
