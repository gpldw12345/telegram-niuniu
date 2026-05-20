import type { Match, MarketOffer } from "@prisma/client";
import type { OddsApiEvent } from "../services/oddsApi.js";
import { displayTeamName } from "./teamNames.js";

export function formatMatchTitle(match: Pick<Match, "homeTeam" | "awayTeam" | "commenceTime">) {
  const kickoff = new Intl.DateTimeFormat("en-MY", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kuala_Lumpur"
  }).format(match.commenceTime);

  return `${match.homeTeam} vs ${match.awayTeam}\nKickoff: ${kickoff}`;
}

export function formatGroupMatchPost(
  match: Pick<Match, "homeTeam" | "awayTeam" | "commenceTime">,
  oneXTwoOffers: Array<Pick<MarketOffer, "selectionLabel" | "odds">>
) {
  const oddsLine =
    oneXTwoOffers.length > 0
      ? oneXTwoOffers.map((offer) => `${offer.selectionLabel} ${offer.odds}`).join(" | ")
      : "Odds pending";

  return `${formatMatchTitle(match)}\n\n1X2: ${oddsLine}`;
}

export function formatOddsApiGroupMatchPost(event: OddsApiEvent) {
  const kickoff = new Intl.DateTimeFormat("en-MY", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kuala_Lumpur"
  }).format(new Date(event.commence_time));

  const bookmaker = pickBookmakerWithH2h(event);
  const h2h = bookmaker?.markets.find((market) => market.key === "h2h");
  const homeOdd = h2h?.outcomes.find((outcome) => outcome.name === event.home_team);
  const awayOdd = h2h?.outcomes.find((outcome) => outcome.name === event.away_team);
  const drawOdd = h2h?.outcomes.find((outcome) => outcome.name === "Draw");
  const handicapLines = pickAsianHandicapLines(event);
  const totalLines = pickOverUnderLines(event);
  const isBasketball = event.sport_key.startsWith("basketball_");
  const sportIcon = isBasketball ? "🏀" : "⚽";
  const divider = "────────────";

  return [
    `${sportIcon} ${displayTeamName(event.home_team)} vs ${displayTeamName(event.away_team)}`,
    `⏰ ${kickoff}`,
    "",
    isBasketball ? "Moneyline" : "1X2",
    formatMoneylineLine(event.home_team, homeOdd?.price),
    isBasketball ? "" : formatMoneylineLine("Draw", drawOdd?.price),
    formatMoneylineLine(event.away_team, awayOdd?.price),
    divider,
    "AH（让/吃）",
    ...formatHandicapLines(handicapLines, event.home_team, event.away_team),
    divider,
    "O/U（大/小）",
    ...formatTotalLines(totalLines)
  ].filter((line) => line !== "").join("\n");
}

type HandicapLine = {
  homePoint: number;
  homePrice: number;
  awayPoint: number;
  awayPrice: number;
};

type TotalLine = {
  point: number;
  overPrice: number;
  underPrice: number;
};

function pickBookmakerWithH2h(event: OddsApiEvent) {
  return event.bookmakers?.find((bookmaker) =>
    bookmaker.markets.some((market) => market.key === "h2h")
  );
}

function pickAsianHandicapLines(event: OddsApiEvent): HandicapLine[] {
  const lines = new Map<string, HandicapLine>();

  for (const bookmaker of event.bookmakers ?? []) {
    const spreads = bookmaker.markets.find((market) => market.key === "spreads");

    if (!spreads) {
      continue;
    }

    const homeOutcomes = spreads.outcomes.filter(
      (outcome) => outcome.name === event.home_team && outcome.point !== undefined
    );
    const awayOutcomes = spreads.outcomes.filter(
      (outcome) => outcome.name === event.away_team && outcome.point !== undefined
    );

    for (const home of homeOutcomes) {
      const away = awayOutcomes.find(
        (candidate) => candidate.point !== undefined && candidate.point + home.point! === 0
      );

      if (!away || home.point === undefined || away.point === undefined) {
        continue;
      }

      const key = home.point.toFixed(2);

      if (!lines.has(key)) {
        lines.set(key, {
          homePoint: home.point,
          homePrice: home.price,
          awayPoint: away.point,
          awayPrice: away.price
        });
      }
    }
  }

  return [...lines.values()]
    .sort((left, right) => Math.abs(left.homePoint) - Math.abs(right.homePoint))
    .slice(0, 3);
}

function pickOverUnderLines(event: OddsApiEvent): TotalLine[] {
  const lines = new Map<string, TotalLine>();

  for (const bookmaker of event.bookmakers ?? []) {
    const totals = bookmaker.markets.find((market) => market.key === "totals");

    if (!totals) {
      continue;
    }

    const overs = totals.outcomes.filter((outcome) => outcome.name === "Over" && outcome.point !== undefined);
    const unders = totals.outcomes.filter((outcome) => outcome.name === "Under" && outcome.point !== undefined);

    for (const over of overs) {
      const under = unders.find((candidate) => candidate.point === over.point);

      if (!under || over.point === undefined || under.point === undefined) {
        continue;
      }

      const key = over.point.toFixed(2);

      if (!lines.has(key)) {
        lines.set(key, {
          point: over.point,
          overPrice: over.price,
          underPrice: under.price
        });
      }
    }
  }

  return [...lines.values()].sort((left, right) => left.point - right.point).slice(0, 3);
}

function formatHandicapLines(lines: HandicapLine[], homeTeam: string, awayTeam: string) {
  if (lines.length === 0) {
    return ["No AH odds available yet"];
  }

  return lines.map((line) => {
    const home = shortTeamName(homeTeam);
    const away = shortTeamName(awayTeam);
    return `${formatPoint(line.homePoint)}  ${home} ${formatOdds(line.homePrice)} / ${away} ${formatOdds(line.awayPrice)}`;
  });
}

function formatTotalLines(lines: TotalLine[]) {
  if (lines.length === 0) {
    return ["No O/U odds available yet"];
  }

  return lines.map(
    (line) => `${formatPoint(line.point)}  Over ${formatOdds(line.overPrice)} / Under ${formatOdds(line.underPrice)}`
  );
}

function formatMoneylineLine(name: string, odds: number | undefined) {
  return `${name === "Draw" ? "Draw" : shortTeamName(name)} ${formatOdds(odds)}`;
}

function shortTeamName(name: string) {
  return displayTeamName(name)
    .replace("Manchester City", "Man City")
    .replace("Manchester United", "Man United")
    .replace("Nottingham Forest", "Nottm Forest")
    .replace("Cleveland Cavaliers", "Cavaliers")
    .replace("New York Knicks", "Knicks");
}

function formatPoint(point: number | undefined) {
  if (point === undefined) {
    return "";
  }

  return point > 0 ? `+${point}` : `${point}`;
}

function formatOdds(odds: number | undefined) {
  if (odds === undefined) {
    return "-";
  }

  return odds.toFixed(2).replace(/\.00$/, "");
}
