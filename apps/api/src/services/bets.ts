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
        commenceTime: new Date(confirmed.event.commence_time)
      },
      update: {
        sportKey: confirmed.event.sport_key,
        homeTeam: confirmed.event.home_team,
        awayTeam: confirmed.event.away_team,
        commenceTime: new Date(confirmed.event.commence_time)
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
        closesAt: new Date(confirmed.event.commence_time)
      },
      update: {
        status: "OPEN",
        closesAt: new Date(confirmed.event.commence_time)
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
              : "OVER_UNDER",
        selectionKey: confirmed.selection.selectionKey,
        selectionLabel: confirmed.selection.label,
        teamSide: confirmed.selection.teamSide,
        handicap:
          confirmed.selection.handicap === undefined
            ? undefined
            : new Prisma.Decimal(confirmed.selection.handicap),
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

export async function getUserBetHistory(from: User) {
  const user = await ensureTelegramUser(from);
  const bets = await prisma.bet.findMany({
    where: {
      userId: user.id
    },
    include: {
      match: true
    },
    orderBy: {
      placedAt: "desc"
    },
    take: 10
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
