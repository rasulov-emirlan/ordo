import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { loginAction } from "./actions";
import { ensureSeeded } from "@/lib/bootstrap";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  ensureSeeded();
  const user = await getSessionUser();
  if (user) redirect("/");
  const { error } = await searchParams;

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="kicker kicker--red">// Ordo</div>
        <h1>
          Управление сетью
          <br />
          кофеен
        </h1>
        <p className="muted small">
          Персонал, смены, камеры, продажи и штрафы — все заведения в одном месте.
        </p>
        <form action={loginAction}>
          <label className="field">
            <span className="field__label">Логин</span>
            <input className="input" name="login" autoComplete="username" required defaultValue="demo" />
          </label>
          <label className="field">
            <span className="field__label">Пароль</span>
            <input
              className="input"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              defaultValue="demo2026"
            />
          </label>
          {error && (
            <p className="small" style={{ color: "var(--red)" }}>
              Неверный логин или пароль
            </p>
          )}
          <button className="btn" type="submit" style={{ width: "100%" }}>
            Войти
          </button>
        </form>
        <p className="small muted" style={{ marginTop: "1rem", marginBottom: 0 }}>
          Демо-доступ: <span className="mono">demo / demo2026</span>
        </p>
      </div>
    </div>
  );
}
