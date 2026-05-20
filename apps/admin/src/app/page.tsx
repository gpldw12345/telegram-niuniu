export const dynamic = "force-dynamic";

type AdminSummary = {
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
  matches: []
};

async function getSummary() {
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

export default async function AdminHome() {
  const { data, error } = await getSummary();
  const metrics = [
    { label: "Post Enabled", value: data.metrics.openMatches.toLocaleString() },
    { label: "Pending Bets", value: data.metrics.pendingBets.toLocaleString() },
    { label: "Total Users", value: data.metrics.totalUsers.toLocaleString() },
    { label: "Point Exposure", value: formatPoints(data.metrics.pointExposure) }
  ];

  return (
    <main className="admin-shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">World Cup</p>
          <h1>Niuniu Admin</h1>
        </div>
        <nav aria-label="Admin sections">
          <a className="active" href="#">Dashboard</a>
          <a href="#">Matches</a>
          <a href="#">Bets</a>
          <a href="#">Users</a>
          <a href="#">Transactions</a>
        </nav>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">Operations</p>
            <h2>Dashboard</h2>
          </div>
          <div className="topbar-actions">
            <form action="/api/sync-matches" method="post">
              <button type="submit">Sync Odds</button>
            </form>
            <span className={error ? "status-pill warning" : "status-pill"}>{error || "Live"}</span>
          </div>
        </header>

        <section className="metric-grid" aria-label="Dashboard metrics">
          {metrics.map((metric) => (
            <article className="metric-card" key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </article>
          ))}
        </section>

        <section className="main-grid">
          <div className="panel">
            <div className="panel-header">
              <h3>Matches</h3>
            </div>
            {data.matches.length === 0 ? (
              <div className="empty-state">No matches recorded yet.</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Match</th>
                      <th>League</th>
                      <th>Kickoff</th>
                      <th>Post</th>
                      <th>Settle</th>
                      <th>Status</th>
                      <th>Pending</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.matches.map((match) => (
                      <tr key={match.id}>
                        <td>{match.title}</td>
                        <td>{match.sportTitle || match.sportKey}</td>
                        <td>{formatDate(match.commenceTime)}</td>
                        <td>
                          <form action={`/api/matches/${match.id}/post-enabled`} method="post">
                            <input
                              name="enabled"
                              type="hidden"
                              value={match.isPostEnabled ? "false" : "true"}
                            />
                            <button
                              className={match.isPostEnabled ? "tick-button selected" : "tick-button"}
                              type="submit"
                            >
                              {match.isPostEnabled ? "Ticked" : "Tick"}
                            </button>
                          </form>
                        </td>
                        <td>
                          <form className="score-form" action={`/api/matches/${match.id}/settle`} method="post">
                            <input
                              aria-label={`${match.title} home score`}
                              defaultValue={match.homeScore ?? ""}
                              min="0"
                              name="homeScore"
                              placeholder="H"
                              type="number"
                            />
                            <span>-</span>
                            <input
                              aria-label={`${match.title} away score`}
                              defaultValue={match.awayScore ?? ""}
                              min="0"
                              name="awayScore"
                              placeholder="A"
                              type="number"
                            />
                            <button className="settle-button" type="submit">
                              Settle
                            </button>
                          </form>
                        </td>
                        <td>{match.status}</td>
                        <td>{match.pendingBets}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="panel">
            <div className="panel-header">
              <h3>Top Users</h3>
            </div>
            {data.users.length === 0 ? (
              <div className="empty-state">No users yet.</div>
            ) : (
              <div className="user-list">
                {data.users.map((user) => (
                  <div className="user-row" key={user.id}>
                    <div>
                      <strong>{user.displayName}</strong>
                      <span>W-L-P {formatStat(user.stats.won)}-{formatStat(user.stats.lost)}-{formatStat(user.stats.pushed)}</span>
                    </div>
                    <div>
                      <strong>{formatPoints(user.pointsBalance)}</strong>
                      <span className={user.stats.net >= 0 ? "net-positive" : "net-negative"}>
                        {user.stats.net >= 0 ? "+" : ""}{formatPoints(user.stats.net)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="panel wide-panel">
          <div className="panel-header">
            <h3>Recent Bets</h3>
          </div>
          {data.bets.length === 0 ? (
            <div className="empty-state">No bets yet.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Match</th>
                    <th>Selection</th>
                    <th>Stake</th>
                    <th>Return</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.bets.map((bet) => (
                    <tr key={bet.id}>
                      <td>{bet.user}</td>
                      <td>{bet.match}</td>
                      <td>{bet.selection}</td>
                      <td>{formatPoints(bet.stake)}</td>
                      <td>{formatPoints(bet.potentialPayout)}</td>
                      <td>{bet.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function formatPoints(value: number) {
  return Math.round(value).toLocaleString();
}

function formatStat(value: number) {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-MY", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kuala_Lumpur"
  }).format(new Date(value));
}
