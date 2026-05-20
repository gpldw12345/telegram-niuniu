import { Prisma } from "@prisma/client";
import { prisma } from "../config/db.js";
import type { BetSelection } from "../bot/betFlow.js";
import { displayTeamName } from "../bot/teamNames.js";

export function correctScoreKeys() {
  const keys: Array<{ key: string; label: string; home: number | null; away: number | null }> = [];

  for (let home = 0; home <= 4; home += 1) {
    for (let away = 0; away <= 4; away += 1) {
      keys.push({ key: `${home}-${away}`, label: `${home}-${away}`, home, away });
    }
  }

  keys.push({ key: "OTHER", label: "Other Score", home: null, away: null });
  return keys;
}

export async function getCorrectScoreAdmin(matchId: string) {
  const match = await prisma.match.findUniqueOrThrow({
    where: { id: matchId },
    include: {
      offers: {
        where: {
          market: "CORRECT_SCORE",
          isActive: true
        }
      }
    }
  });

  return {
    match: {
      ...match,
      homeTeam: displayTeamName(match.homeTeam),
      awayTeam: displayTeamName(match.awayTeam)
    },
    scores: correctScoreKeys().map((score) => {
      const offer = match.offers.find((candidate) => candidate.selectionKey === score.key);
      return {
        ...score,
        odds: offer?.odds.toNumber() ?? ""
      };
    })
  };
}

export async function saveCorrectScoreOdds(matchId: string, oddsByKey: Record<string, number>) {
  return prisma.$transaction(async (tx) => {
    const match = await tx.match.findUniqueOrThrow({
      where: { id: matchId }
    });
    const window = await tx.betWindow.upsert({
      where: {
        matchId_type: {
          matchId,
          type: "PRE_MATCH"
        }
      },
      create: {
        matchId,
        type: "PRE_MATCH",
        status: "OPEN",
        closesAt: match.commenceTime
      },
      update: {
        status: "OPEN",
        closesAt: match.commenceTime
      }
    });

    await tx.marketOffer.deleteMany({
      where: {
        matchId,
        windowId: window.id,
        market: "CORRECT_SCORE",
        source: "ADMIN"
      }
    });

    const scores = correctScoreKeys();
    const data = Object.entries(oddsByKey).flatMap(([key, odds]) => {
      const score = scores.find((candidate) => candidate.key === key);

      if (!score || !Number.isFinite(odds) || odds <= 0) {
        return [];
      }

      return {
        matchId,
        windowId: window.id,
        market: "CORRECT_SCORE" as const,
        selectionKey: key,
        selectionLabel: score.label,
        correctHomeScore: score.home ?? undefined,
        correctAwayScore: score.away ?? undefined,
        odds: new Prisma.Decimal(odds),
        source: "ADMIN" as const,
        raw: { key, label: score.label }
      };
    });

    if (data.length > 0) {
      await tx.marketOffer.createMany({ data });
    }

    return { saved: data.length };
  });
}

export async function getCorrectScoreSelections(oddsApiEventId: string): Promise<BetSelection[]> {
  const match = await prisma.match.findUnique({
    where: { oddsApiEventId },
    include: {
      offers: {
        where: {
          market: "CORRECT_SCORE",
          isActive: true
        },
        orderBy: {
          selectionKey: "asc"
        }
      }
    }
  });

  if (!match) {
    return [];
  }

  return match.offers.map((offer) => ({
    market: "cs",
    label: `${offer.selectionLabel} @ ${offer.odds.toFixed(2).replace(/\.00$/, "")}`,
    selectionKey: offer.selectionKey,
    odds: offer.odds.toNumber(),
    correctHomeScore: offer.correctHomeScore ?? undefined,
    correctAwayScore: offer.correctAwayScore ?? undefined
  }));
}
