import Link from "next/link";
import { Bars } from "@/components/Bars";
import { requireUser } from "@/lib/auth";
import { addDays, fmtDate, som, todayISO } from "@/lib/format";
import { listVenues } from "@/lib/queries";
import {
  disciplineBoard,
  finesTotal,
  periodSummary,
  revenueByDay,
  topProducts,
  visitorsByDay,
  visitorsByHour,
} from "@/lib/stats";

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Наличные",
  card: "Карта",
  qr: "QR (ELQR)",
};

function percent(value: number | null) {
  return value == null ? "—" : `${Math.round(value * 100)}%`;
}

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; venue?: string }>;
}) {
  await requireUser();
  const params = await searchParams;
  const parsedDays = Number(params.days);
  const days = parsedDays === 7 || parsedDays === 90 ? parsedDays : 30;
  const venues = listVenues();
  const selectedVenue = venues.find((venue) => String(venue.id) === params.venue);
  const venueId = selectedVenue?.id ?? null;
  const venueParam = selectedVenue ? String(selectedVenue.id) : "all";
  const to = todayISO();
  const from = addDays(to, -(days - 1));

  const summary = periodSummary(venueId, from, to);
  const fines = finesTotal(venueId, from, to);
  const revenue = revenueByDay(venueId, from, to);
  const visitors = visitorsByDay(venueId, from, to);
  const hourly = visitorsByHour(venueId, from, to);
  const products = topProducts(venueId, from, to);
  const discipline = disciplineBoard(from, to).slice(0, 8);
  const comparisons = venues.map((venue) => ({
    venue,
    summary: periodSummary(venue.id, from, to),
  }));
  const bestRevenue = Math.max(0, ...comparisons.map((row) => row.summary.revenue));
  const largestPayment = Math.max(0, ...summary.paymentMix.map((item) => item.total));

  return (
    <>
      <div className="page-head">
        <div className="page-head__row">
          <div>
            <div className="kicker kicker--red">// Аналитика</div>
            <h1>Статистика</h1>
            <div className="small muted">{fmtDate(from)} — {fmtDate(to)}</div>
          </div>
          <div>
            <div className="actions mb-1">
              {[7, 30, 90].map((period) => (
                <Link
                  className={`btn btn--sm${days === period ? "" : " btn--ghost"}`}
                  href={`/stats?days=${period}&venue=${venueParam}`}
                  key={period}
                >
                  {period} дней
                </Link>
              ))}
            </div>
            <div className="actions">
              <Link
                className={`btn btn--sm${venueId === null ? "" : " btn--ghost"}`}
                href={`/stats?days=${days}&venue=all`}
              >
                Вся сеть
              </Link>
              {venues.map((venue) => (
                <Link
                  className={`btn btn--sm${venue.id === venueId ? "" : " btn--ghost"}`}
                  href={`/stats?days=${days}&venue=${venue.id}`}
                  key={venue.id}
                >
                  {venue.name}
                </Link>
              ))}
            </div>
          </div>
        </div>
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
        <div className="stat">
          <div className="stat__label">Посетители</div>
          <div className="stat__value">{summary.visitors}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Конверсия в покупку</div>
          <div className="stat__value">{percent(summary.conversion)}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Удержания за период</div>
          <div className="stat__value stat__value--red">{som(fines)}</div>
        </div>
      </div>

      <div className="card">
        <div className="flex-between mb-1">
          <div className="kicker">Выручка по дням</div>
          <div className="mono small">{som(summary.revenue)}</div>
        </div>
        <Bars
          points={revenue.map((point) => ({ label: fmtDate(point.date), value: point.value }))}
          formatValue={som}
        />
      </div>

      <div className="card">
        <div className="flex-between mb-1">
          <div className="kicker">Посетители по дням</div>
          <div className="mono small">{summary.visitors}</div>
        </div>
        <Bars
          points={visitors.map((point) => ({ label: fmtDate(point.date), value: point.value }))}
          formatValue={(value) => String(value)}
        />
      </div>

      <div className="grid-2 mt-1">
        <div className="card">
          <div className="kicker mb-1">Пиковые часы</div>
          <Bars
            accentLast={false}
            points={hourly.map((point) => ({
              label: `${String(point.hour).padStart(2, "0")}:00`,
              value: point.value,
            }))}
            formatValue={(value) => String(value)}
          />
          <p className="muted small mt-1">
            Суммарно посетителей за период по часам суток.
          </p>
        </div>

        <div className="card">
          <div className="kicker mb-1">Способы оплаты</div>
          {summary.paymentMix.length === 0 ? (
            <p className="muted small">За выбранный период оплат не было.</p>
          ) : (
            <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Метод</th>
                  <th className="num">Сумма</th>
                  <th className="num">Доля</th>
                </tr>
              </thead>
              <tbody>
                {summary.paymentMix.map((item) => (
                  <tr key={item.method}>
                    <td>{PAYMENT_LABELS[item.method] ?? item.method}</td>
                    <td className="num">{som(item.total)}</td>
                    <td className="num">
                      <span className={item.total === largestPayment ? "stat__value--red" : ""}>
                        {summary.revenue ? Math.round((item.total / summary.revenue) * 100) : 0}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
      </div>

      <div className="grid-2 mt-1">
        <div className="card">
          <div className="kicker mb-1">Топ товаров</div>
          {products.length === 0 ? (
            <p className="muted small">Продаж товаров за выбранный период нет.</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Товар</th>
                    <th>Категория</th>
                    <th className="num">Шт.</th>
                    <th className="num">Выручка</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={`${product.category}-${product.name}`}>
                      <td>{product.name}</td>
                      <td className="muted">{product.category}</td>
                      <td className="num">{product.qty}</td>
                      <td className="num">{som(product.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <div className="kicker mb-1">Дисциплина</div>
          {discipline.length === 0 ? (
            <p className="muted small">Активных сотрудников нет.</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Сотрудник</th>
                    <th>Точка</th>
                    <th className="num">Удержания</th>
                    <th className="num">Наруш.</th>
                    <th className="num">Прогулы</th>
                  </tr>
                </thead>
                <tbody>
                  {discipline.map((row) => (
                    <tr key={row.employee_id}>
                      <td><Link href={`/staff/${row.employee_id}`}>{row.name}</Link></td>
                      <td>{row.venue_name}</td>
                      <td className="num">
                        <span className={row.fines > 0 ? "stat__value--red" : ""}>{som(row.fines)}</span>
                      </td>
                      <td className="num">{row.incidents}</td>
                      <td className="num">{row.missedShifts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="card mt-1">
        <div className="kicker mb-1">Сравнение точек</div>
        {comparisons.length === 0 ? (
          <p className="muted small">Заведений пока нет.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Точка</th>
                  <th className="num">Выручка</th>
                  <th className="num">Чеков</th>
                  <th className="num">Средний чек</th>
                  <th className="num">Посетители</th>
                  <th className="num">Конверсия</th>
                  <th className="num">Выручка / гость</th>
                </tr>
              </thead>
              <tbody>
                {comparisons.map(({ venue, summary: venueSummary }) => (
                  <tr key={venue.id}>
                    <td><Link href={`/venues/${venue.id}`}>{venue.name}</Link></td>
                    <td className="num">
                      <span className={venueSummary.revenue === bestRevenue ? "stat__value--red" : ""}>
                        {som(venueSummary.revenue)}
                      </span>
                    </td>
                    <td className="num">{venueSummary.salesCount}</td>
                    <td className="num">{som(venueSummary.avgCheck)}</td>
                    <td className="num">{venueSummary.visitors}</td>
                    <td className="num">{percent(venueSummary.conversion)}</td>
                    <td className="num">
                      {som(venueSummary.visitors ? Math.round(venueSummary.revenue / venueSummary.visitors) : 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
