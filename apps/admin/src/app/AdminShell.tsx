const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/matches", label: "Matches" },
  { href: "/bets", label: "Bets" },
  { href: "/users", label: "Users" },
  { href: "/transactions", label: "Transactions" }
];

export function AdminShell({
  active,
  children
}: {
  active: string;
  children: React.ReactNode;
}) {
  return (
    <main className="admin-shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">Niuniu</p>
          <h1>Admin</h1>
        </div>
        <nav aria-label="Admin sections">
          {navItems.map((item) => (
            <a className={active === item.label ? "active" : ""} href={item.href} key={item.href}>
              {item.label}
            </a>
          ))}
        </nav>
        <form action="/api/logout" method="post">
          <button className="logout-button" type="submit">Logout</button>
        </form>
      </aside>
      <section className="content">{children}</section>
    </main>
  );
}
