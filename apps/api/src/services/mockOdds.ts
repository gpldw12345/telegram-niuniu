import type { OddsApiEvent } from "./oddsApi.js";

export function getMockWorldCupOdds(): OddsApiEvent[] {
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(12, 0, 0, 0);

  const later = new Date(tomorrow);
  later.setUTCHours(18, 0, 0, 0);

  return [
    {
      id: "mock-argentina-japan",
      sport_key: "soccer_fifa_world_cup",
      sport_title: "FIFA World Cup",
      commence_time: tomorrow.toISOString(),
      home_team: "Argentina",
      away_team: "Japan",
      bookmakers: [
        {
          key: "mockbook",
          title: "Mock Book",
          last_update: new Date().toISOString(),
          markets: [
            {
              key: "h2h",
              outcomes: [
                { name: "Argentina", price: 1.82 },
                { name: "Draw", price: 3.45 },
                { name: "Japan", price: 4.2 }
              ]
            },
            {
              key: "spreads",
              outcomes: [
                { name: "Argentina", price: 0.75, point: -0.25 },
                { name: "Japan", price: 1.05, point: 0.25 },
                { name: "Argentina", price: 0.9, point: -0.5 },
                { name: "Japan", price: 0.98, point: 0.5 },
                { name: "Argentina", price: 1.1, point: -0.75 },
                { name: "Japan", price: 0.82, point: 0.75 }
              ]
            }
          ]
        }
      ]
    },
    {
      id: "mock-brazil-france",
      sport_key: "soccer_fifa_world_cup",
      sport_title: "FIFA World Cup",
      commence_time: later.toISOString(),
      home_team: "Brazil",
      away_team: "France",
      bookmakers: [
        {
          key: "mockbook",
          title: "Mock Book",
          last_update: new Date().toISOString(),
          markets: [
            {
              key: "h2h",
              outcomes: [
                { name: "Brazil", price: 2.15 },
                { name: "Draw", price: 3.2 },
                { name: "France", price: 2.9 }
              ]
            },
            {
              key: "spreads",
              outcomes: [
                { name: "Brazil", price: 0.88, point: 0 },
                { name: "France", price: 0.98, point: 0 },
                { name: "Brazil", price: 1.04, point: -0.25 },
                { name: "France", price: 0.78, point: 0.25 },
                { name: "Brazil", price: 0.72, point: 0.25 },
                { name: "France", price: 1.12, point: -0.25 }
              ]
            }
          ]
        }
      ]
    }
  ];
}
