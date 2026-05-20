import { AdminShell } from "./AdminShell";
import { BetsTable, MatchesTable, Topbar } from "./components";
import { formatDate, formatDateTimeInput, formatPoints, getSummary } from "./adminData";

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
          <div>
            <h3>Report Period</h3>
            <span>
              Counting from {data.metrics.reportPeriodStart ? formatDate(data.metrics.reportPeriodStart) : "all time"}
            </span>
          </div>
        </div>
        <form className="period-form" action="/api/report-period" method="post">
          <label>
            Start calculating from
            <input
              defaultValue={formatDateTimeInput(data.metrics.reportPeriodStart)}
              name="reportPeriodStart"
              type="datetime-local"
            />
          </label>
          <button type="submit">Save Period</button>
        </form>
        <form className="period-revoke-form" action="/api/report-period/revoke" method="post">
          <button className="danger-button" type="submit">Revoke Last Period Save</button>
        </form>
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
