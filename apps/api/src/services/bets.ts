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
        market: confirmed.selection.market === "1x2" ? "ONE_X_TWO" : "ASIAN_HANDICAP",
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
