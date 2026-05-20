import type { AdminSummary } from "./adminData";
import { formatDate, formatPoints, formatStat } from "./adminData";

export function Topbar({
  title,
  eyebrow,
  error,
  action
}: {
  title: string;
  eyebrow: string;
  error: string | null;
  action?: React.ReactNode;
}) {
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      <div className="topbar-actions">
        {action}
        <span className={error ? "status-pill warning" : "status-pill"}>{error || "Live"}</span>
      </div>
    </header>
  );
}

export function MatchesTable({ matches }: { matches: AdminSummary["matches"] }) {
  if (matches.length === 0) {
    return <div className="empty-state">No matches found.</div>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Match</th>
            <th>League</th>
            <th>Kickoff</th>
            <th>Post</th>
            <th>CS</th>
            <th>Settle</th>
            <th>Status</th>
            <th>Pending</th>
          </tr>
        </thead>
        <tbody>
          {matches.map((match) => (
            <tr key={match.id}>
              <td>{match.title}</td>
              <td>{match.sportTitle || match.sportKey}</td>
              <td>{formatDate(match.commenceTime)}</td>
              <td>
                <form action={`/api/matches/${match.id}/post-enabled`} method="post">
                  <input name="enabled" type="hidden" value={match.isPostEnabled ? "false" : "true"} />
                  <button className={match.isPostEnabled ? "tick-button selected" : "tick-button"} type="submit">
                    {match.isPostEnabled ? "Ticked" : "Tick"}
                  </button>
                </form>
              </td>
              <td>
                {match.sportKey.startsWith("soccer_") ? (
                  <a className="small-action" href={`/matches/${match.id}/correct-score`}>CS</a>
                ) : (
                  "-"
                )}
              </td>
              <td>
                <form className="score-form" action={`/api/matches/${match.id}/settle`} method="post">
                  <input defaultValue={match.homeScore ?? ""} min="0" name="homeScore" placeholder="H" type="number" />
                  <span>-</span>
                  <input defaultValue={match.awayScore ?? ""} min="0" name="awayScore" placeholder="A" type="number" />
                  <button className="settle-button" type="submit">Settle</button>
                </form>
              </td>
              <td>{match.status}</td>
              <td>{match.pendingBets}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function BetsTable({ bets }: { bets: AdminSummary["bets"] }) {
  if (bets.length === 0) {
    return <div className="empty-state">No bets yet.</div>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>User</th>
            <th>Match</th>
            <th>Market</th>
            <th>Selection</th>
            <th>Stake</th>
            <th>Return</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {bets.map((bet) => (
            <tr key={bet.id}>
              <td>{bet.user}</td>
              <td>{bet.match}</td>
              <td>{bet.market}</td>
              <td>{bet.selection}</td>
              <td>{formatPoints(bet.stake)}</td>
              <td>{formatPoints(bet.potentialPayout)}</td>
              <td>{bet.status}</td>
              <td>
                {bet.status === "PENDING" ? (
                  <form action={`/api/bets/${bet.id}/cancel`} method="post">
                    <button className="danger-button" type="submit">Cancel</button>
                  </form>
                ) : (
                  "-"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function UsersList({ users }: { users: AdminSummary["users"] }) {
  if (users.length === 0) {
    return <div className="empty-state">No users yet.</div>;
  }

  return (
    <div className="user-list">
      {users.map((user) => (
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
          <form className="adjust-form" action={`/api/users/${user.id}/adjust-points`} method="post">
            <input min="1" name="amount" placeholder="Points" type="number" />
            <input name="note" placeholder="Note" type="text" />
            <button name="direction" type="submit" value="add">Add</button>
            <button className="danger-button" name="direction" type="submit" value="deduct">Deduct</button>
          </form>
        </div>
      ))}
    </div>
  );
}
