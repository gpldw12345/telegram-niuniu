import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { prisma } from "../config/db.js";
import { calculateBetStats } from "../services/bets.js";
import { syncConfiguredMatches } from "../services/matchSync.js";
import { settleMatchManually } from "../services/settlement.js";
import { formatSignedPoints, notifyTelegramUser } from "../services/telegramNotify.js";

export async function registerAdminRoutes(app: FastifyInstance) {
  app.get("/admin/summary", async () => {
    const now = new Date();
    const fiveDaysLater = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
    const [totalUsers, pendingBets, postEnabledMatches, users, bets, matches, transactions, exposureAggregate] =
      await Promise.all([
        prisma.telegramUser.count(),
        prisma.bet.count({
          where: {
            status: "PENDING"
          }
        }),
        prisma.match.count({
          where: {
            isPostEnabled: true,
            status: "SCHEDULED"
          }
        }),
        prisma.telegramUser.findMany({
          include: {
            bets: true
          },
          orderBy: {
            pointsBalance: "desc"
          },
          take: 8
        }),
        prisma.bet.findMany({
          include: {
            user: true,
            match: true
          },
          orderBy: {
            placedAt: "desc"
          },
          take: 10
        }),
        prisma.match.findMany({
          where: {
            commenceTime: {
              gte: now,
              lte: fiveDaysLater
            }
          },
          include: {
            bets: {
              where: {
                status: "PENDING"
              }
            },
            windows: true
          },
          orderBy: {
            commenceTime: "asc"
          },
          take: 50
        }),
        prisma.walletTransaction.findMany({
          include: {
            user: true
          },
          orderBy: {
            createdAt: "desc"
          },
          take: 50
        }),
        prisma.bet.aggregate({
          where: {
            status: "PENDING"
          },
          _sum: {
            potentialPayout: true
          }
        })
      ]);

    return {
      metrics: {
        openMatches: postEnabledMatches,
        pendingBets,
        totalUsers,
        pointExposure: exposureAggregate._sum.potentialPayout?.toNumber() ?? 0
      },
      users: users.map((user) => ({
        id: user.id,
        telegramId: user.telegramId,
        username: user.username,
        displayName: user.displayName || user.username || user.telegramId,
        pointsBalance: user.pointsBalance.toNumber(),
        stats: calculateBetStats(user.bets),
        createdAt: user.createdAt.toISOString()
      })),
      bets: bets.map((bet) => ({
        id: bet.id,
        userId: bet.userId,
        user: bet.user.displayName || bet.user.username || bet.user.telegramId,
        match: `${bet.match.homeTeam} vs ${bet.match.awayTeam}`,
        market: bet.market,
        selection: bet.selectionLabel,
        stake: bet.stake.toNumber(),
        odds: bet.odds.toNumber(),
        potentialPayout: bet.potentialPayout.toNumber(),
        status: bet.status,
        placedAt: bet.placedAt.toISOString()
      })),
      transactions: transactions.map((transaction) => ({
        id: transaction.id,
        user: transaction.user.displayName || transaction.user.username || transaction.user.telegramId,
        amount: transaction.amount.toNumber(),
        balanceAfter: transaction.balanceAfter.toNumber(),
        type: transaction.type,
        source: transaction.source,
        note: transaction.note,
        createdAt: transaction.createdAt.toISOString()
      })),
      matches: matches.map((match) => ({
        id: match.id,
        title: `${match.homeTeam} vs ${match.awayTeam}`,
        sportKey: match.sportKey,
        sportTitle: match.sportTitle,
        commenceTime: match.commenceTime.toISOString(),
        status: match.status,
        isPostEnabled: match.isPostEnabled,
        oddsSyncedAt: match.oddsSyncedAt?.toISOString() ?? null,
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        pendingBets: match.bets.length,
        openWindows: match.windows.filter((window) => window.status === "OPEN").length
      }))
    };
  });

  app.post("/admin/sync-matches", async () => syncConfiguredMatches());

  app.patch<{
    Params: {
      id: string;
    };
    Body: {
      enabled?: boolean;
    };
  }>("/admin/matches/:id/post-enabled", async (request) => {
    const enabled = Boolean(request.body.enabled);
    const match = await prisma.match.update({
      where: {
        id: request.params.id
      },
      data: {
        isPostEnabled: enabled
      }
    });

    return {
      id: match.id,
      isPostEnabled: match.isPostEnabled
    };
  });

  app.post<{
    Params: {
      id: string;
    };
    Body: {
      homeScore?: number;
      awayScore?: number;
    };
  }>("/admin/matches/:id/settle", async (request, reply) => {
    const homeScore = Number(request.body.homeScore);
    const awayScore = Number(request.body.awayScore);

    if (
      !Number.isInteger(homeScore) ||
      !Number.isInteger(awayScore) ||
      homeScore < 0 ||
      awayScore < 0
    ) {
      return reply.code(400).send({
        message: "homeScore and awayScore must be non-negative whole numbers"
      });
    }

    const result = await settleMatchManually(request.params.id, homeScore, awayScore);

    await Promise.all(
      result.notifications.map((notification) =>
        notifyTelegramUser(
          notification.telegramId,
          [
            "Bet settled",
            notification.matchTitle,
            notification.selection,
            `Status: ${notification.status}`,
            `Credit: ${formatSignedPoints(notification.credit)}`,
            notification.note
          ].join("\n")
        )
      )
    );

    return result;
  });

  app.post<{
    Params: {
      id: string;
    };
    Body: {
      amount?: number;
      note?: string;
    };
  }>("/admin/users/:id/adjust-points", async (request, reply) => {
    const amount = new Prisma.Decimal(Number(request.body.amount));

    if (!amount.isFinite() || amount.isZero()) {
      return reply.code(400).send({ message: "amount is required" });
    }

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.telegramUser.update({
        where: {
          id: request.params.id
        },
        data: {
          pointsBalance: {
            increment: amount
          }
        }
      });

      await tx.walletTransaction.create({
        data: {
          userId: user.id,
          amount,
          balanceAfter: user.pointsBalance,
          type: "ADMIN_ADJUSTMENT",
          source: "ADMIN",
          referenceType: "AdminAdjustment",
          note: request.body.note || "Admin point adjustment"
        }
      });

      return user;
    });

    await notifyTelegramUser(
      result.telegramId,
      [
        "Points adjusted",
        `Amount: ${formatSignedPoints(amount.toNumber())}`,
        `Balance: ${result.pointsBalance.toFixed(0)} points`,
        request.body.note ? `Note: ${request.body.note}` : ""
      ]
        .filter(Boolean)
        .join("\n")
    );

    return {
      id: result.id,
      pointsBalance: result.pointsBalance.toNumber()
    };
  });

  app.post<{
    Params: {
      id: string;
    };
  }>("/admin/bets/:id/cancel", async (request, reply) => {
    const bet = await prisma.bet.findUnique({
      where: {
        id: request.params.id
      },
      include: {
        user: true,
        match: true
      }
    });

    if (!bet) {
      return reply.code(404).send({ message: "Bet not found" });
    }

    if (bet.status !== "PENDING") {
      return reply.code(400).send({ message: "Only pending bets can be cancelled" });
    }

    const refund = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.telegramUser.update({
        where: {
          id: bet.userId
        },
        data: {
          pointsBalance: {
            increment: bet.stake
          }
        }
      });

      await tx.bet.update({
        where: {
          id: bet.id
        },
        data: {
          status: "VOID",
          settlementNote: "Cancelled by admin. Stake refunded.",
          settledAt: new Date()
        }
      });

      await tx.walletTransaction.create({
        data: {
          userId: bet.userId,
          amount: bet.stake,
          balanceAfter: updatedUser.pointsBalance,
          type: "BET_REFUND",
          source: "ADMIN",
          referenceType: "Bet",
          referenceId: bet.id,
          note: "Admin cancelled pending bet"
        }
      });

      return updatedUser;
    });

    await notifyTelegramUser(
      bet.user.telegramId,
      [
        "Bet cancelled",
        `${bet.match.homeTeam} vs ${bet.match.awayTeam}`,
        bet.selectionLabel,
        `Refund: ${formatSignedPoints(bet.stake.toNumber())}`,
        `Balance: ${refund.pointsBalance.toFixed(0)} points`
      ].join("\n")
    );

    return { ok: true };
  });
}
