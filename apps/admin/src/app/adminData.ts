export type AdminSummary = {
  metrics: {
    openMatches: number;
    pendingBets: number;
    totalUsers: number;
    pointExposure: number;
  };
  users: Array<{
    id: string;
    username: string | null;
    displayName: string;
    pointsBalance: number;
    stats: {
      totalBets: number;
      pending: number;
      won: number;
      lost: number;
      pushed: number;
      totalStake: number;
      net: number;
    };
  }>;
  bets: Array<{
    id: string;
    user: string;
    match: string;
    market: string;
    selection: string;
    stake: number;
    odds: number;
    potentialPayout: number;
    status: string;
    placedAt: string;
  }>;
  matches: Array<{
    id: string;
    title: string;
    sportKey: string;
    sportTitle: string | null;
    commenceTime: string;
    status: string;
    isPostEnabled: boolean;
    oddsSyncedAt: string | null;
    homeScore: number | null;
    awayScore: number | null;
    pendingBets: number;
    openWindows: number;
  }>;
  transactions: Array<{
    id: string;
    user: string;
    amount: number;
    balanceAfter: number;
    type: string;
    source: string;
    note: string | null;
    createdAt: string;
  }>;
};

const emptySummary: AdminSummary = {
  metrics: {
    openMatches: 0,
    pendingBets: 0,
    totalUsers: 0,
    pointExposure: 0
  },
  users: [],
  bets: [],
  matches: [],
  transactions: []
};

export async function getSummary() {
  const apiBaseUrl = process.env.API_BASE_URL || "http://localhost:4000";

  try {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/admin/summary`);

    if (!response.ok) {
      return {
        data: emptySummary,
        error: `API returned ${response.status}`
      };
    }

    return {
      data: (await response.json()) as AdminSummary,
      error: null
    };
  } catch (error) {
    return {
      data: emptySummary,
      error: error instanceof Error ? error.message : "Could not reach API"
    };
  }
}

export function formatPoints(value: number) {
  return Math.round(value).toLocaleString();
}

export function formatStat(value: number) {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-MY", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kuala_Lumpur"
  }).format(new Date(value));
}
