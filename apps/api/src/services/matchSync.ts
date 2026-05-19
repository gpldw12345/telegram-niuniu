import { Prisma } from "@prisma/client";
import { getSelections } from "../bot/betFlow.js";
import { prisma } from "../config/db.js";
import type { OddsApiEvent } from "./oddsApi.js";
import { getConfiguredOddsForSports } from "./oddsProvider.js";

export async function syncConfiguredMatches() {
  const { events, errors, provider } = await getConfiguredOddsForSports();
  const synced = await syncOddsEvents(events);

  return {
    provider,
    events,
    synced,
    errors
  };
}

export async function syncOddsEvents(events: OddsApiEvent[]) {
  let synced = 0;

  for (const event of events) {
    await syncOddsEvent(event);
    synced += 1;
  }

  return synced;
}

export async function getPostEnabledMatches() {
  return prisma.match.findMany({
    where: {
      isPostEnabled: true,
      status: "SCHEDULED",
      commenceTime: {
        gte: new Date()
      }
    },
    orderBy: {
      commenceTime: "asc"
    },
    take: 20
  });
}

async function syncOddsEvent(event: OddsApiEvent) {
  return prisma.$transaction(async (tx) => {
    const match = await tx.match.upsert({
      where: {
        oddsApiEventId: event.id
      },
      create: {
        oddsApiEventId: event.id,
        sportKey: event.sport_key,
        sportTitle: event.sport_title,
        homeTeam: event.home_team,
        awayTeam: event.away_team,
        commenceTime: new Date(event.commence_time),
        oddsSyncedAt: new Date()
      },
      update: {
        sportKey: event.sport_key,
        sportTitle: event.sport_title,
        homeTeam: event.home_team,
        awayTeam: event.away_team,
        commenceTime: new Date(event.commence_time),
        oddsSyncedAt: new Date()
      }
    });

    const window = await tx.betWindow.upsert({
      where: {
        matchId_type: {
          matchId: match.id,
          type: "PRE_MATCH"
        }
      },
      create: {
        matchId: match.id,
        type: "PRE_MATCH",
        status: "OPEN",
        closesAt: new Date(event.commence_time)
      },
      update: {
        status: "OPEN",
        closesAt: new Date(event.commence_time)
      }
    });

    await tx.oddsSnapshot.create({
      data: {
        matchId: match.id,
        windowType: "PRE_MATCH",
        source: "ODDS_API",
        raw: stripUndefined(event)
      }
    });

    await tx.marketOffer.deleteMany({
      where: {
        matchId: match.id,
        windowId: window.id,
        source: "ODDS_API"
      }
    });

    const offers = buildMarketOffers(event, match.id, window.id);

    if (offers.length > 0) {
      await tx.marketOffer.createMany({
        data: offers
      });
    }
  });
}

function buildMarketOffers(
  event: OddsApiEvent,
  matchId: string,
  windowId: string
): Prisma.MarketOfferCreateManyInput[] {
  return [...getSelections(event, "1x2"), ...getSelections(event, "ah")].map((selection) => ({
    matchId,
    windowId,
    market: selection.market === "1x2" ? "ONE_X_TWO" : "ASIAN_HANDICAP",
    selectionKey: selection.selectionKey,
    selectionLabel: selection.label,
    teamSide: selection.teamSide,
    handicap:
      selection.handicap === undefined ? undefined : new Prisma.Decimal(selection.handicap),
    odds: new Prisma.Decimal(selection.odds),
    source: "ODDS_API",
    raw: stripUndefined(selection)
  }));
}

function stripUndefined(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
