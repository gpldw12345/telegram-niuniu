import { Markup } from "telegraf";
import type { InlineKeyboardMarkup } from "telegraf/types";
import type { OddsApiEvent } from "../services/oddsApi.js";
import { displayTeamName } from "./teamNames.js";

export type Market = "1x2" | "ah" | "ou" | "cs";

export type BetSelection = {
  market: Market;
  label: string;
  odds: number;
  selectionKey: string;
  teamSide?: string;
  handicap?: number;
  correctHomeScore?: number;
  correctAwayScore?: number;
};

type PendingBet = {
  event: OddsApiEvent;
  selection?: BetSelection;
  stake?: number;
  awaitingStake?: boolean;
};

export type ConfirmedBet = PendingBet & {
  userId: number;
  confirmedAt: Date;
  selection: BetSelection;
  stake: number;
};

const pendingBets = new Map<number, PendingBet>();
const confirmedBets: ConfirmedBet[] = [];

export function beginBet(userId: number, event: OddsApiEvent) {
  pendingBets.set(userId, { event });
}

export function getPendingBet(userId: number) {
  return pendingBets.get(userId);
}

export function setPendingSelection(userId: number, selection: BetSelection) {
  const pending = pendingBets.get(userId);

  if (!pending) {
    return null;
  }

  pending.selection = selection;
  pending.stake = undefined;
  pending.awaitingStake = true;
  return pending;
}

export function setPendingStake(userId: number, stake: number) {
  const pending = pendingBets.get(userId);

  if (!pending || !pending.selection) {
    return null;
  }

  pending.stake = stake;
  pending.awaitingStake = false;
  return pending;
}

export function confirmPendingBet(userId: number) {
  const pending = pendingBets.get(userId);

  if (!pending?.selection || !pending.stake) {
    return null;
  }

  const confirmed: ConfirmedBet = {
    ...pending,
    userId,
    selection: pending.selection,
    stake: pending.stake,
    confirmedAt: new Date()
  };

  confirmedBets.push(confirmed);
  pendingBets.delete(userId);
  return confirmed;
}

export function getUserConfirmedBets(userId: number) {
  return confirmedBets.filter((bet) => bet.userId === userId);
}

export function cancelPendingBet(userId: number) {
  pendingBets.delete(userId);
}

export function isAwaitingStake(userId: number) {
  return pendingBets.get(userId)?.awaitingStake ?? false;
}

export function marketKeyboard(event?: OddsApiEvent): Markup.Markup<InlineKeyboardMarkup> {
  const isBasketball = event?.sport_key.startsWith("basketball_");
  const buttons = [
    [Markup.button.callback(isBasketball ? "Moneyline" : "1X2", "bet:market:1x2")],
    [Markup.button.callback("Asian Handicap", "bet:market:ah")],
    [Markup.button.callback("Over / Under", "bet:market:ou")]
  ];

  if (!isBasketball) {
    buttons.push([Markup.button.callback("Correct Score", "bet:market:cs")]);
  }

  return Markup.inlineKeyboard(buttons);
}

export function selectionKeyboard(event: OddsApiEvent, market: Market) {
  const selections = getSelections(event, market);

  if (selections.length === 0) {
    return null;
  }

  return Markup.inlineKeyboard(
    selections.map((selection, index) => [
      Markup.button.callback(selection.label, `bet:selection:${market}:${index}`)
    ])
  );
}

export function confirmKeyboard(): Markup.Markup<InlineKeyboardMarkup> {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("Confirm", "bet:confirm"),
      Markup.button.callback("Cancel", "bet:cancel")
    ]
  ]);
}

export function getSelections(event: OddsApiEvent, market: Market): BetSelection[] {
  if (market === "1x2") {
    const h2h = event.bookmakers
      ?.flatMap((bookmaker) => bookmaker.markets)
      .find((bookmakerMarket) => bookmakerMarket.key === "h2h");

    if (!h2h) {
      return [];
    }

    const names = event.sport_key.startsWith("basketball_")
      ? [event.home_team, event.away_team]
      : [event.home_team, "Draw", event.away_team];

    return names.flatMap((name) => {
      const outcome = h2h.outcomes.find((candidate) => candidate.name === name);

      if (!outcome) {
        return [];
      }

      return {
        market,
        label: `${name === "Draw" ? "Draw" : displayTeamName(name)} @ ${formatOdds(outcome.price)}`,
        selectionKey: name,
        teamSide: name === "Draw" ? "DRAW" : name === event.home_team ? "HOME" : "AWAY",
        odds: outcome.price
      };
    });
  }

  if (market === "ah") {
    return pickAsianHandicapSelections(event);
  }

  if (market === "ou") {
    return pickOverUnderSelections(event);
  }

  return [];
}

export function formatBetHeader(event: OddsApiEvent) {
  const kickoff = new Intl.DateTimeFormat("en-MY", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kuala_Lumpur"
  }).format(new Date(event.commence_time));

  return [`${displayTeamName(event.home_team)} vs ${displayTeamName(event.away_team)}`, kickoff].join("\n");
}

export function formatBetSlip(
  pending: PendingBet,
  options: { currentBalance?: number; minBetAmount?: number; maxBetAmount?: number } = {}
) {
  if (!pending.selection) {
    return "No selection yet.";
  }

  const potentialPayout = pending.stake
    ? `\nPotential return: ${formatCurrency(pending.stake * pending.selection.odds)}`
    : "";
  const currentBalance =
    typeof options.currentBalance === "number" ? `*Current balance: ${formatCurrency(options.currentBalance)}*` : "";
  const betLimit =
    typeof options.minBetAmount === "number" && typeof options.maxBetAmount === "number"
      ? `_Min bet ${formatCurrency(options.minBetAmount)} / Max bet ${formatCurrency(options.maxBetAmount)}_`
      : "";

  return [
    formatBetHeader(pending.event),
    "",
    `Selection: ${pending.selection.label}`,
    pending.stake ? `Bet: ${formatCurrency(pending.stake)}` : "Bet: not selected",
    currentBalance,
    betLimit,
    potentialPayout
  ]
    .filter(Boolean)
    .join("\n");
}

function formatCurrency(value: number) {
  return `RM${formatOdds(value)}`;
}

function pickAsianHandicapSelections(event: OddsApiEvent): BetSelection[] {
  const lines = new Map<string, BetSelection[]>();

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
        lines.set(key, [
          {
            market: "ah",
            label: `${displayTeamName(event.home_team)} ${formatPoint(home.point)} @ ${formatOdds(home.price)}`,
            selectionKey: `${event.home_team}:${home.point}`,
            teamSide: "HOME",
            odds: home.price,
            handicap: home.point
          },
          {
            market: "ah",
            label: `${displayTeamName(event.away_team)} ${formatPoint(away.point)} @ ${formatOdds(away.price)}`,
            selectionKey: `${event.away_team}:${away.point}`,
            teamSide: "AWAY",
            odds: away.price,
            handicap: away.point
          }
        ]);
      }
    }
  }

  return [...lines.entries()]
    .sort(([left], [right]) => Math.abs(Number(left)) - Math.abs(Number(right)))
    .slice(0, 3)
    .flatMap(([, selections]) => selections);
}

function pickOverUnderSelections(event: OddsApiEvent): BetSelection[] {
  const lines = new Map<string, BetSelection[]>();

  for (const bookmaker of event.bookmakers ?? []) {
    const totals = bookmaker.markets.find((market) => market.key === "totals");

    if (!totals) {
      continue;
    }

    const overOutcomes = totals.outcomes.filter(
      (outcome) => outcome.name === "Over" && outcome.point !== undefined
    );
    const underOutcomes = totals.outcomes.filter(
      (outcome) => outcome.name === "Under" && outcome.point !== undefined
    );

    for (const over of overOutcomes) {
      const under = underOutcomes.find((candidate) => candidate.point === over.point);

      if (!under || over.point === undefined || under.point === undefined) {
        continue;
      }

      const key = over.point.toFixed(2);

      if (!lines.has(key)) {
        lines.set(key, [
          {
            market: "ou",
            label: `Over ${formatPoint(over.point)} @ ${formatOdds(over.price)}`,
            selectionKey: `OVER:${over.point}`,
            teamSide: "OVER",
            odds: over.price,
            handicap: over.point
          },
          {
            market: "ou",
            label: `Under ${formatPoint(under.point)} @ ${formatOdds(under.price)}`,
            selectionKey: `UNDER:${under.point}`,
            teamSide: "UNDER",
            odds: under.price,
            handicap: under.point
          }
        ]);
      }
    }
  }

  return [...lines.entries()]
    .sort(([left], [right]) => Number(left) - Number(right))
    .slice(0, 3)
    .flatMap(([, selections]) => selections);
}

function formatPoint(point: number) {
  return point > 0 ? `+${point}` : `${point}`;
}

function formatOdds(odds: number) {
  return odds.toFixed(2).replace(/\.00$/, "");
}
