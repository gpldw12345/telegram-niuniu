import { Prisma } from "@prisma/client";
import { prisma } from "../config/db.js";
import type { BetSelection } from "../bot/betFlow.js";
import { displayTeamName } from "../bot/teamNames.js";

export function correctScoreKeys() {
  return correctScoreRows().flatMap((row) => row.filter((score) => score !== null));
}

export function correctScoreRows() {
  return [
    [scoreKey(1, 0), scoreKey(0, 0), scoreKey(0, 1)],
    [scoreKey(2, 0), scoreKey(1, 1), scoreKey(0, 2)],
    [scoreKey(2, 1), scoreKey(2, 2), scoreKey(1, 2)],
    [scoreKey(3, 0), scoreKey(3, 3), scoreKey(0, 3)],
    [scoreKey(3, 1), scoreKey(4, 4), scoreKey(1, 3)],
    [scoreKey(3, 2), null, scoreKey(2, 3)],
    [scoreKey(4, 0), null, scoreKey(0, 4)],
    [scoreKey(4, 1), null, scoreKey(1, 4)],
    [scoreKey(4, 2), null, scoreKey(2, 4)],
    [scoreKey(4, 3), null, scoreKey(3, 4)],
    [null, { key: "OTHER", label: "Other Score", home: null, away: null }, null]
  ];
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
    }),
    rows: correctScoreRows().map((row) => row.map((score) => score?.key ?? null))
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

  return correctScoreKeys().flatMap((score) => {
    const offer = match.offers.find((candidate) => candidate.selectionKey === score.key);

    if (!offer) {
      return [];
    }

    return {
      market: "cs" as const,
      label: `${offer.selectionLabel} @ ${offer.odds.toFixed(2).replace(/\.00$/, "")}`,
      selectionKey: offer.selectionKey,
      odds: offer.odds.toNumber(),
      correctHomeScore: offer.correctHomeScore ?? undefined,
      correctAwayScore: offer.correctAwayScore ?? undefined
    };
  });
}

function scoreKey(home: number, away: number) {
  return { key: `${home}-${away}`, label: `${home}-${away}`, home, away };
}
