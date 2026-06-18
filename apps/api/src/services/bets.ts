import { Prisma } from "@prisma/client";
import type { User } from "telegraf/types";
import type { ConfirmedBet } from "../bot/betFlow.js";
import { prisma } from "../config/db.js";
import { ensureTelegramUser } from "./users.js";

export class InsufficientPointsError extends Error {
  constructor() {
    super("Insufficient points");
  }
}

export class BettingClosedError extends Error {
  constructor() {
    super("Betting closed");
  }
}

export async function placeConfirmedBet(from: User, confirmed: ConfirmedBet) {
  return prisma.$transaction(async (tx) => {
    const user = await ensureTelegramUser(from);
    const freshUser = await tx.telegramUser.findUniqueOrThrow({
      where: {
        id: user.id
      }
    });

    const stake = new Prisma.Decimal(confirmed.stake);
    const odds = new Prisma.Decimal(confirmed.selection.odds);
    const potentialPayout = stake.mul(odds);
    const commenceTime = new Date(confirmed.event.commence_time);

    if (Date.now() >= commenceTime.getTime()) {
      throw new BettingClosedError();
    }

    if (freshUser.pointsBalance.lt(stake)) {
      throw new InsufficientPointsError();
    }

    const match = await tx.match.upsert({
      where: {
        oddsApiEventId: confirmed.event.id
      },
      create: {
        oddsApiEventId: confirmed.event.id,
        sportKey: confirmed.event.sport_key,
        homeTeam: confirmed.event.home_team,
        awayTeam: confirmed.event.away_team,
        commenceTime
      },
      update: {
        sportKey: confirmed.event.sport_key,
        homeTeam: confirmed.event.home_team,
        awayTeam: confirmed.event.away_team,
        commenceTime
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
        closesAt: commenceTime
      },
      update: {
        status: "OPEN",
        closesAt: commenceTime
      }
    });

    const updatedUser = await tx.telegramUser.update({
      where: {
        id: freshUser.id
      },
      data: {
        pointsBalance: {
          decrement: stake
        }
      }
    });

    const bet = await tx.bet.create({
      data: {
        userId: freshUser.id,
        matchId: match.id,
        windowId: window.id,
        market:
          confirmed.selection.market === "1x2"
            ? "ONE_X_TWO"
            : confirmed.selection.market === "ah"
              ? "ASIAN_HANDICAP"
              : confirmed.selection.market === "ou"
                ? "OVER_UNDER"
                : "CORRECT_SCORE",
        selectionKey: confirmed.selection.selectionKey,
        selectionLabel: confirmed.selection.label,
        teamSide: confirmed.selection.teamSide,
        handicap:
          confirmed.selection.handicap === undefined
            ? undefined
            : new Prisma.Decimal(confirmed.selection.handicap),
        correctHomeScore: confirmed.selection.correctHomeScore,
        correctAwayScore: confirmed.selection.correctAwayScore,
        odds,
        stake,
        potentialPayout,
        status: "PENDING"
      }
    });

    await tx.walletTransaction.create({
      data: {
        userId: freshUser.id,
        amount: stake.neg(),
        balanceAfter: updatedUser.pointsBalance,
        type: "BET_STAKE",
        source: "BET",
        referenceType: "Bet",
        referenceId: bet.id,
        note: confirmed.selection.label
      }
    });

    return {
      bet,
      balanceAfter: updatedUser.pointsBalance
    };
  });
}

export async function getRecentBets(from: User) {
  const user = await ensureTelegramUser(from);

  return prisma.bet.findMany({
    where: {
      userId: user.id
    },
    include: {
      match: true
    },
    orderBy: {
      placedAt: "desc"
    },
    take: 5
  });
}

export type BetHistoryFilter = "all" | "running" | "upcoming" | "settled";

export async function getUserBetHistory(from: User, filter: BetHistoryFilter = "all") {
  const user = await ensureTelegramUser(from);
  const now = new Date();
  const where: Prisma.BetWhereInput = { userId: user.id };

  if (filter === "running") {
    where.status = "PENDING";
    where.match = {
      commenceTime: {
        lte: now
      },
      status: {
        notIn: ["FINISHED", "CANCELLED"]
      }
    };
  } else if (filter === "upcoming") {
    where.status = "PENDING";
    where.match = {
      commenceTime: {
        gt: now
      }
    };
  } else if (filter === "settled") {
    where.status = {
      not: "PENDING"
    };
  }
  const bets = await prisma.bet.findMany({
    where,
    include: {
      match: true
    },
    orderBy:
      filter === "upcoming"
        ? {
            match: {
              commenceTime: "asc"
            }
          }
        : filter === "settled"
          ? {
              settledAt: "desc"
            }
          : {
              placedAt: "desc"
            },
    take: 20
  });
  const allBets = await prisma.bet.findMany({
    where: {
      userId: user.id
    }
  });

  return {
    bets,
    stats: calculateBetStats(allBets)
  };
}

export function calculateBetStats(
  bets: Array<{
    status: string;
    stake: Prisma.Decimal;
    odds: Prisma.Decimal;
  }>
) {
  return bets.reduce(
    (stats, bet) => {
      const stake = bet.stake.toNumber();
      const odds = bet.odds.toNumber();

      stats.totalBets += 1;
      stats.totalStake += stake;

      if (bet.status === "PENDING") {
        stats.pending += 1;
        return stats;
      }

      if (bet.status === "WON") {
        stats.won += 1;
        stats.net += stake * (odds - 1);
        return stats;
      }

      if (bet.status === "HALF_WON") {
        stats.won += 0.5;
        stats.pushed += 0.5;
        stats.net += (stake * (odds - 1)) / 2;
        return stats;
      }

      if (bet.status === "LOST") {
        stats.lost += 1;
        stats.net -= stake;
        return stats;
      }

      if (bet.status === "HALF_LOST") {
        stats.lost += 0.5;
        stats.pushed += 0.5;
        stats.net -= stake / 2;
        return stats;
      }

      stats.pushed += 1;
      return stats;
    },
    {
      totalBets: 0,
      pending: 0,
      won: 0,
      lost: 0,
      pushed: 0,
      totalStake: 0,
      net: 0
    }
  );
}
