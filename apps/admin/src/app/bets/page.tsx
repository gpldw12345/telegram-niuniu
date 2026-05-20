import { AdminShell } from "../AdminShell";
import { BetsTable, Topbar } from "../components";
import { getSummary } from "../adminData";

export const dynamic = "force-dynamic";

export default async function BetsPage() {
  const { data, error } = await getSummary();

  return (
    <AdminShell active="Bets">
      <Topbar eyebrow="Bet Monitoring" error={error} title="Bets" />
      <section className="panel">
        <div className="panel-header">
          <h3>Latest Bets</h3>
        </div>
        <BetsTable bets={data.bets} />
      </section>
    </AdminShell>
  );
}
