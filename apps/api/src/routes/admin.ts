import type { FastifyInstance } from "fastify";
import { prisma } from "../config/db.js";
import { syncConfiguredMatches } from "../services/matchSync.js";

export async function registerAdminRoutes(app: FastifyInstance) {
  app.get("/admin/summary", async () => {
    const [totalUsers, pendingBets, postEnabledMatches, users, bets, matches, exposureAggregate] =
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
        createdAt: user.createdAt.toISOString()
      })),
      bets: bets.map((bet) => ({
        id: bet.id,
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
      matches: matches.map((match) => ({
        id: match.id,
        title: `${match.homeTeam} vs ${match.awayTeam}`,
        sportKey: match.sportKey,
        sportTitle: match.sportTitle,
        commenceTime: match.commenceTime.toISOString(),
        status: match.status,
        isPostEnabled: match.isPostEnabled,
        oddsSyncedAt: match.oddsSyncedAt?.toISOString() ?? null,
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
}
