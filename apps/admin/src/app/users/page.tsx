import { AdminShell } from "../AdminShell";
import { Topbar, UsersList } from "../components";
import { getSummary } from "../adminData";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const { data, error } = await getSummary();

  return (
    <AdminShell active="Users">
      <Topbar
        action={<a className="export-button" href="/api/export/users">Export Users</a>}
        eyebrow="User Management"
        error={error}
        title="Users"
      />
      <section className="panel">
        <div className="panel-header">
          <h3>Balances And Results</h3>
        </div>
        <UsersList users={data.users} />
      </section>
    </AdminShell>
  );
}
