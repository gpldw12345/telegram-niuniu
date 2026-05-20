import { AdminShell } from "../AdminShell";
import { Topbar } from "../components";
import { formatDate, formatPoints, getSummary } from "../adminData";

export const dynamic = "force-dynamic";

export default async function TransactionsPage() {
  const { data, error } = await getSummary();

  return (
    <AdminShell active="Transactions">
      <Topbar eyebrow="Point Ledger" error={error} title="Transactions" />
      <section className="panel">
        <div className="panel-header">
          <h3>Recent Point Movements</h3>
        </div>
        {data.transactions.length === 0 ? (
          <div className="empty-state">No transactions yet.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Balance</th>
                  <th>Source</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {data.transactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td>{transaction.user}</td>
                    <td>{transaction.type}</td>
                    <td>{transaction.amount > 0 ? "+" : ""}{formatPoints(transaction.amount)}</td>
                    <td>{formatPoints(transaction.balanceAfter)}</td>
                    <td>{transaction.source}</td>
                    <td>{formatDate(transaction.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AdminShell>
  );
}
