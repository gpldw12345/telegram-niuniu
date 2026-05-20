import { AdminShell } from "./AdminShell";
import { BetsTable, MatchesTable, Topbar } from "./components";
import { formatPoints, getSummary } from "./adminData";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { data, error } = await getSummary();
  const metrics = [
    { label: "Post Enabled", value: data.metrics.openMatches.toLocaleString() },
    { label: "Pending Bets", value: data.metrics.pendingBets.toLocaleString() },
    { label: "Total Users", value: data.metrics.totalUsers.toLocaleString() },
    { label: "Profit/Loss", value: formatPoints(data.metrics.profitLoss) }
  ];

  return (
    <AdminShell active="Dashboard">
      <Topbar eyebrow="Overview" error={error} title="Dashboard" />

      <section className="metric-grid" aria-label="Dashboard metrics">
        {metrics.map((metric) => (
          <article className="metric-card" key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </article>
        ))}
      </section>

      <section className="panel">
          <div className="panel-header">
            <h3>Next Matches</h3>
            <a className="panel-link" href="/matches">Open</a>
          </div>
          <MatchesTable matches={data.matches.slice(0, 5)} />
      </section>

      <section className="panel wide-panel">
        <div className="panel-header">
          <h3>Recent Bets</h3>
          <a className="panel-link" href="/bets">Open</a>
        </div>
        <BetsTable bets={data.bets.slice(0, 5)} />
      </section>
    </AdminShell>
  );
}
