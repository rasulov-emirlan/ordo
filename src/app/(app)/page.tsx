import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listVenues } from "@/lib/queries";
import { periodSummary, revenueByDay, finesTotal } from "@/lib/stats";
import { listIncidents } from "@/lib/incidents";
import { som, todayISO, addDays, fmtDate, fmtDateTime, plural } from "@/lib/format";
import { Bars } from "@/components/Bars";

export default async function DashboardPage() {
  await requireUser();
  const venues = listVenues();
  const today = todayISO();
  const from30 = addDays(today, -29);

  const todayAll = periodSummary(null, today, today);
  const month = periodSummary(null, from30, today);
  const revenue30 = revenueByDay(null, from30, today);
  const fines30 = finesTotal(null, from30, today);
  const pending = listIncidents({ status: "pending", limit: 6 });

  return (
    <>
      <div className="page-head">
        <div className="kicker kicker--red">// Обзор сети</div>
        <h1>Сегодня, {fmtDate(today)}</h1>
      </div>

      <div className="stat-grid">
        <div className="stat">
          <div className="stat__label">Выручка сегодня</div>
          <div className="stat__value">{som(todayAll.revenue)}</div>
          <div className="stat__sub">{todayAll.salesCount} {plural(todayAll.salesCount, "чек", "чека", "чеков")}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Посетители сегодня</div>
          <div className="stat__value">{todayAll.visitors}</div>
          <div className="stat__sub">
            конверсия {todayAll.conversion != null ? Math.round(todayAll.conversion * 100) + "%" : "—"}
          </div>
        </div>
        <div className="stat">
          <div className="stat__label">Средний чек (30 дн)</div>
          <div className="stat__value">{som(month.avgCheck)}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Штрафы (30 дн)</div>
          <div className="stat__value stat__value--red">{som(fines30)}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Инциденты в очереди</div>
          <div className={"stat__value" + (pending.length ? " stat__value--red" : "")}>
            {pending.length}
          </div>
          <div className="stat__sub">
            <Link href="/incidents">рассмотреть →</Link>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex-between">
          <div className="kicker">Выручка сети · 30 дней</div>
          <div className="mono small">{som(month.revenue)}</div>
        </div>
        <Bars
          points={revenue30.map((p) => ({ label: fmtDate(p.date), value: p.value }))}
          formatValue={som}
        />
      </div>

      <div className="grid-2 mt-1">
        <div className="card">
          <div className="kicker mb-1">Заведения сегодня</div>
          <table className="table">
            <thead>
              <tr>
                <th>Точка</th>
                <th className="num">Выручка</th>
                <th className="num">Гости</th>
                <th className="num">Чеков</th>
              </tr>
            </thead>
            <tbody>
              {venues.map((v) => {
                const s = periodSummary(v.id, today, today);
                return (
                  <tr key={v.id}>
                    <td>
                      <Link href={`/venues/${v.id}`}>{v.name}</Link>
                      <div className="small muted">{v.city}</div>
                    </td>
                    <td className="num">{som(s.revenue)}</td>
                    <td className="num">{s.visitors}</td>
                    <td className="num">{s.salesCount}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="flex-between mb-1">
            <div className="kicker">Требуют решения</div>
            <Link className="small" href="/incidents">
              все →
            </Link>
          </div>
          {pending.length === 0 && <p className="muted small">Очередь пуста — нарушений нет.</p>}
          {pending.map((i) => (
            <div key={i.id} className="flex-between" style={{ padding: "0.4rem 0", borderBottom: "1px solid var(--gray-300)" }}>
              <div>
                <span className={"badge" + (i.severity === "critical" ? " badge--red" : "")}>
                  {i.source === "manual" ? "вручную" : "камера"}
                </span>{" "}
                <strong className="small">{i.type_title}</strong>
                <div className="small muted">
                  {i.venue_name}
                  {i.employee_name ? ` · ${i.employee_name}` : ""} · {fmtDateTime(i.occurred_at)}
                </div>
              </div>
              <div className="mono small">{som(i.suggested_fine)}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
