import { AdminShell } from "../AdminShell";
import { MatchesTable, Topbar } from "../components";
import { getSummary } from "../adminData";

export const dynamic = "force-dynamic";

export default async function MatchesPage() {
  const { data, error } = await getSummary();

  return (
    <AdminShell active="Matches">
      <Topbar
        action={
          <form action="/api/sync-matches" method="post">
            <button type="submit">Sync Odds</button>
          </form>
        }
        eyebrow="Match Control"
        error={error}
        title="Matches"
      />
      <section className="panel">
        <div className="panel-header">
          <h3>Next 5 Days</h3>
        </div>
        <MatchesTable matches={data.matches} />
      </section>
    </AdminShell>
  );
}
