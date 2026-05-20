export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="login-shell">
      <form className="login-panel" action="/api/login" method="post">
        <div>
          <p className="eyebrow">Niuniu</p>
          <h1>Admin Login</h1>
        </div>
        <input name="next" type="hidden" value={params.next || "/"} />
        {params.error ? <div className="login-error">Wrong ID or password.</div> : null}
        <label>
          ID
          <input autoComplete="username" name="id" required type="text" />
        </label>
        <label>
          Password
          <input autoComplete="current-password" name="password" required type="password" />
        </label>
        <button type="submit">Login</button>
      </form>
    </main>
  );
}
