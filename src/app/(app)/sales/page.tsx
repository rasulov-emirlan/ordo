import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { som, todayISO } from "@/lib/format";
import { listEmployees, listProducts, listVenues } from "@/lib/queries";
import { periodSummary } from "@/lib/stats";
import { SalesRegister } from "./SalesRegister";

type SaleRow = {
  id: number;
  ts: string;
  employee_name: string | null;
  items: string | null;
  payment_method: "cash" | "card" | "qr";
  total: number;
};

const PAYMENT_LABELS = {
  cash: "Наличные",
  card: "Карта",
  qr: "QR (ELQR)",
} as const;

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ venue?: string }>;
}) {
  await requireUser();
  const { venue: venueParam } = await searchParams;
  const venues = listVenues();
  const requestedVenueId = Number(venueParam);
  const selectedVenue =
    venues.find((venue) => venue.id === requestedVenueId) ?? venues[0];

  if (!selectedVenue) {
    return (
      <>
        <div className="page-head">
          <div className="kicker kicker--red">// Продажи</div>
          <h1>Касса</h1>
        </div>
        <div className="card">
          <p className="muted small">Заведений пока нет — сначала добавьте точку.</p>
          <Link className="btn btn--sm" href="/venues">К заведениям</Link>
        </div>
      </>
    );
  }

  const today = todayISO();
  const products = listProducts();
  const employees = listEmployees(selectedVenue.id);
  const summary = periodSummary(selectedVenue.id, today, today);
  const sales = getDb()
    .prepare(
      `SELECT s.id, s.ts, e.name AS employee_name, s.payment_method, s.total,
         (SELECT GROUP_CONCAT(item_title, ', ') FROM (
           SELECT p.name || CASE WHEN si.qty > 1 THEN ' ×' || si.qty ELSE '' END AS item_title
           FROM sale_items si JOIN products p ON p.id = si.product_id
           WHERE si.sale_id = s.id ORDER BY si.id
         )) AS items
       FROM sales s
       LEFT JOIN employees e ON e.id = s.employee_id
       WHERE s.venue_id = ? AND substr(s.ts, 1, 10) = ?
       ORDER BY s.ts DESC LIMIT 30`
    )
    .all(selectedVenue.id, today) as SaleRow[];

  return (
    <>
      <div className="page-head">
        <div className="page-head__row">
          <div>
            <div className="kicker kicker--red">// Продажи</div>
            <h1>Касса</h1>
          </div>
          <div className="actions">
            {venues.map((venue) => (
              <Link
                className={`btn btn--sm${venue.id === selectedVenue.id ? "" : " btn--ghost"}`}
                href={`/sales?venue=${venue.id}`}
                key={venue.id}
              >
                {venue.name}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <SalesRegister
        employees={employees.map(({ id, name }) => ({ id, name }))}
        products={products.map(({ id, name, category, price }) => ({ id, name, category, price }))}
        venueId={selectedVenue.id}
      />
      <p className="small muted mt-1">
        Ordo не является ККМ: фискализация чеков — в вашей кассе (О!Касса, eKassa) или через
        POS-интеграцию (Poster).
      </p>

      <div className="page-head mt-2">
        <div className="kicker">Сегодня · {selectedVenue.name}</div>
        <h2>Журнал продаж</h2>
      </div>
      <div className="stat-grid">
        <div className="stat">
          <div className="stat__label">Выручка</div>
          <div className="stat__value">{som(summary.revenue)}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Чеков</div>
          <div className="stat__value">{summary.salesCount}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Средний чек</div>
          <div className="stat__value">{som(summary.avgCheck)}</div>
        </div>
      </div>

      {sales.length === 0 ? (
        <p className="muted small">Сегодня чеков ещё нет — первая продажа появится здесь.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Время</th>
                <th>Продавец</th>
                <th>Позиции</th>
                <th>Оплата</th>
                <th className="num">Сумма</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((sale) => (
                <tr key={sale.id}>
                  <td className="mono">{sale.ts.slice(11, 16)}</td>
                  <td>{sale.employee_name ?? "—"}</td>
                  <td>{sale.items ?? "—"}</td>
                  <td>{PAYMENT_LABELS[sale.payment_method]}</td>
                  <td className="num">{som(sale.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
