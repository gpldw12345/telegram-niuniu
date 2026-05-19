const metrics = [
  { label: "Open Matches", value: "0" },
  { label: "Pending Bets", value: "0" },
  { label: "Total Users", value: "0" },
  { label: "Point Exposure", value: "0" }
];

const workQueue = [
  "Connect admin login",
  "Sync World Cup matches",
  "Review handicap lines",
  "Settle finished matches"
];

export default function AdminHome() {
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
          <button type="button">Sync Matches</button>
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
              <h3>Today's Matches</h3>
              <button type="button" className="secondary">Open Match</button>
            </div>
            <div className="empty-state">No matches synced yet.</div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <h3>Work Queue</h3>
            </div>
            <ul className="queue">
              {workQueue.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </section>
      </section>
    </main>
  );
}
