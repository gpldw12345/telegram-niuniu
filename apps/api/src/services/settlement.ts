import { BetStatus, Prisma } from "@prisma/client";
import { prisma } from "../config/db.js";

type SettlementResult = {
  status: BetStatus;
  credit: Prisma.Decimal;
  note: string;
};

export async function settleMatchManually(matchId: string, homeScore: number, awayScore: number) {
  return prisma.$transaction(async (tx) => {
    const match = await tx.match.update({
      where: {
        id: matchId
      },
      data: {
        homeScore,
        awayScore,
        status: "FINISHED",
        isPostEnabled: false
      }
    });

    const pendingBets = await tx.bet.findMany({
      where: {
        matchId,
        status: "PENDING"
      },
      include: {
        user: true
      },
      orderBy: {
        placedAt: "asc"
      }
    });

    let settledBets = 0;
    let creditedPoints = new Prisma.Decimal(0);
    const notifications: Array<{
      telegramId: string;
      matchTitle: string;
      selection: string;
      stake: number;
      status: BetStatus;
      credit: number;
      note: string;
    }> = [];

    for (const bet of pendingBets) {
      const result = calculateBetSettlement({
        market: bet.market,
        teamSide: bet.teamSide,
        handicap: bet.handicap,
        odds: bet.odds,
        stake: bet.stake,
        homeScore,
        awayScore
      });

      await tx.bet.update({
        where: {
          id: bet.id
        },
        data: {
          status: result.status,
          settlementNote: result.note,
          settledAt: new Date()
        }
      });

      if (result.credit.gt(0)) {
        const updatedUser = await tx.telegramUser.update({
          where: {
            id: bet.userId
          },
          data: {
            pointsBalance: {
              increment: result.credit
            }
          }
        });

        await tx.walletTransaction.create({
          data: {
            userId: bet.userId,
            amount: result.credit,
            balanceAfter: updatedUser.pointsBalance,
            type:
              result.status === "PUSHED" || result.status === "HALF_LOST" || result.status === "VOID"
                ? "BET_REFUND"
                : "BET_WIN",
            source: "SETTLEMENT",
            referenceType: "Bet",
            referenceId: bet.id,
            note: result.note
          }
        });
      }

      creditedPoints = creditedPoints.add(result.credit);
      settledBets += 1;
      notifications.push({
        telegramId: bet.user.telegramId,
        matchTitle: `${match.homeTeam} vs ${match.awayTeam}`,
        selection: bet.selectionLabel,
        stake: bet.stake.toNumber(),
        status: result.status,
        credit: result.credit.toNumber(),
        note: result.note
      });
    }

    await tx.betWindow.updateMany({
      where: {
        matchId
      },
      data: {
        status: "SETTLED"
      }
    });

    return {
      match,
      settledBets,
      creditedPoints: creditedPoints.toNumber(),
      notifications
    };
  });
}

function calculateBetSettlement(input: {
  market: string;
  teamSide: string | null;
  handicap: Prisma.Decimal | null;
  odds: Prisma.Decimal;
  stake: Prisma.Decimal;
  homeScore: number;
  awayScore: number;
}): SettlementResult {
  if (input.market === "ONE_X_TWO") {
    return settleOneXTwo(input);
  }

  if (input.market === "ASIAN_HANDICAP") {
    return settleAsianHandicap(input);
  }

  if (input.market === "OVER_UNDER") {
    return settleOverUnder(input);
  }

  return {
    status: "VOID",
    credit: input.stake,
    note: "Market not supported for settlement yet. Stake refunded."
  };
}

function settleOverUnder(input: {
  teamSide: string | null;
  handicap: Prisma.Decimal | null;
  odds: Prisma.Decimal;
  stake: Prisma.Decimal;
  homeScore: number;
  awayScore: number;
}): SettlementResult {
  if (!input.teamSide || input.handicap === null) {
    return {
      status: "VOID",
      credit: input.stake,
      note: "Over/Under bet missing line. Stake refunded."
    };
  }

  const totalScore = input.homeScore + input.awayScore;
  const totalLine = input.handicap.toNumber();
  const didWin =
    (input.teamSide === "OVER" && totalScore > totalLine) ||
    (input.teamSide === "UNDER" && totalScore < totalLine);
  const didPush = totalScore === totalLine;

  if (didPush) {
    return {
      status: "PUSHED",
      credit: input.stake,
      note: `O/U ${formatHandicap(totalLine)} pushed. Final total ${totalScore}.`
    };
  }

  return {
    status: didWin ? "WON" : "LOST",
    credit: didWin ? input.stake.mul(input.odds) : new Prisma.Decimal(0),
    note: `O/U ${formatHandicap(totalLine)} ${input.teamSide}. Final total ${totalScore}.`
  };
}

function settleOneXTwo(input: {
  teamSide: string | null;
  odds: Prisma.Decimal;
  stake: Prisma.Decimal;
  homeScore: number;
  awayScore: number;
}): SettlementResult {
  const winningSide =
    input.homeScore > input.awayScore
      ? "HOME"
      : input.homeScore < input.awayScore
        ? "AWAY"
        : "DRAW";
  const didWin = input.teamSide === winningSide;

  return {
    status: didWin ? "WON" : "LOST",
    credit: didWin ? input.stake.mul(input.odds) : new Prisma.Decimal(0),
    note: `1X2 result ${winningSide}. Final score ${input.homeScore}-${input.awayScore}.`
  };
}

function settleAsianHandicap(input: {
  teamSide: string | null;
  handicap: Prisma.Decimal | null;
  odds: Prisma.Decimal;
  stake: Prisma.Decimal;
  homeScore: number;
  awayScore: number;
}): SettlementResult {
  if (!input.teamSide || input.handicap === null) {
    return {
      status: "VOID",
      credit: input.stake,
      note: "Asian Handicap bet missing team or line. Stake refunded."
    };
  }

  const selectedScore = input.teamSide === "HOME" ? input.homeScore : input.awayScore;
  const opponentScore = input.teamSide === "HOME" ? input.awayScore : input.homeScore;
  const handicap = input.handicap.toNumber();
  const lines = splitAsianHandicapLine(handicap);
  const stakePerLine = input.stake.div(lines.length);
  const lineResults = lines.map((line) => settleHandicapLine(selectedScore, opponentScore, line));
  const credit = lineResults.reduce((total, result) => {
    if (result === "WIN") {
      return total.add(stakePerLine.mul(input.odds));
    }

    if (result === "PUSH") {
      return total.add(stakePerLine);
    }

    return total;
  }, new Prisma.Decimal(0));

  const status = statusFromLineResults(lineResults);

  return {
    status,
    credit,
    note: `AH ${formatHandicap(handicap)} settled ${lineResults.join("/")}. Final score ${input.homeScore}-${input.awayScore}.`
  };
}

function splitAsianHandicapLine(handicap: number) {
  const quarter = Math.abs(handicap * 100) % 50 === 25;

  if (!quarter) {
    return [handicap];
  }

  return [handicap - 0.25, handicap + 0.25].sort((left, right) => left - right);
}

function settleHandicapLine(selectedScore: number, opponentScore: number, handicap: number) {
  const margin = selectedScore + handicap - opponentScore;

  if (margin > 0) {
    return "WIN" as const;
  }

  if (margin === 0) {
    return "PUSH" as const;
  }

  return "LOSE" as const;
}

function statusFromLineResults(results: Array<"WIN" | "PUSH" | "LOSE">): BetStatus {
  const wins = results.filter((result) => result === "WIN").length;
  const pushes = results.filter((result) => result === "PUSH").length;
  const losses = results.filter((result) => result === "LOSE").length;

  if (wins === results.length) {
    return "WON";
  }

  if (losses === results.length) {
    return "LOST";
  }

  if (pushes === results.length) {
    return "PUSHED";
  }

  if (wins > 0 && pushes > 0) {
    return "HALF_WON";
  }

  return "HALF_LOST";
}

function formatHandicap(handicap: number) {
  return handicap > 0 ? `+${handicap}` : `${handicap}`;
}
