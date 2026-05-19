import { env } from "../config/env.js";

type OddsApiOutcome = {
  name: string;
  price: number;
  point?: number;
  description?: string;
};

type OddsApiMarket = {
  key: string;
  last_update?: string;
  outcomes: OddsApiOutcome[];
};

type OddsApiBookmaker = {
  key: string;
  title: string;
  last_update?: string;
  markets: OddsApiMarket[];
};

export type OddsApiEvent = {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers?: OddsApiBookmaker[];
};

export class OddsApiClient {
  private readonly baseUrl = "https://api.the-odds-api.com/v4";

  async getWorldCupOdds(markets = ["h2h", "spreads"]): Promise<OddsApiEvent[]> {
    if (!env.ODDS_API_KEY) {
      throw new Error("ODDS_API_KEY is required to fetch odds");
    }

    const params = new URLSearchParams({
      apiKey: env.ODDS_API_KEY,
      regions: env.ODDS_API_REGIONS,
      markets: markets.join(","),
      oddsFormat: "decimal",
      dateFormat: "iso"
    });

    if (env.ODDS_API_BOOKMAKERS) {
      params.delete("regions");
      params.set("bookmakers", env.ODDS_API_BOOKMAKERS);
    }

    const response = await fetch(
      `${this.baseUrl}/sports/${env.ODDS_API_SPORT_KEY}/odds?${params.toString()}`
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`The Odds API failed: ${response.status} ${body}`);
    }

    return response.json() as Promise<OddsApiEvent[]>;
  }
}

export const oddsApiClient = new OddsApiClient();
