import { getDb } from "./db";

export type DayPoint = { date: string; value: number };
export type HourPoint = { hour: number; value: number };

/** Выручка по дням за период (включительно), нули для пустых дней. */
export function revenueByDay(venueId: number | null, from: string, to: string): DayPoint[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT substr(ts, 1, 10) AS date, SUM(total) AS value
       FROM sales
       WHERE (? IS NULL OR venue_id = ?) AND substr(ts,1,10) BETWEEN ? AND ?
       GROUP BY 1 ORDER BY 1`
    )
    .all(venueId, venueId, from, to) as DayPoint[];
  return fillDays(rows, from, to);
}

export function visitorsByDay(venueId: number | null, from: string, to: string): DayPoint[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT substr(ts, 1, 10) AS date, SUM(count) AS value
       FROM visits
       WHERE (? IS NULL OR venue_id = ?) AND substr(ts,1,10) BETWEEN ? AND ?
       GROUP BY 1 ORDER BY 1`
    )
    .all(venueId, venueId, from, to) as DayPoint[];
  return fillDays(rows, from, to);
}

/** Средняя посещаемость по часам суток (тепловая карта пиковых часов). */
export function visitorsByHour(venueId: number | null, from: string, to: string): HourPoint[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT CAST(substr(ts, 12, 2) AS INTEGER) AS hour, SUM(count) AS value
       FROM visits
       WHERE (? IS NULL OR venue_id = ?) AND substr(ts,1,10) BETWEEN ? AND ?
       GROUP BY 1 ORDER BY 1`
    )
    .all(venueId, venueId, from, to) as HourPoint[];
  const map = new Map(rows.map((r) => [r.hour, r.value]));
  return Array.from({ length: 24 }, (_, hour) => ({ hour, value: map.get(hour) ?? 0 }));
}

export type PeriodSummary = {
  revenue: number;
  salesCount: number;
  avgCheck: number;
  visitors: number;
  /** Доля посетителей, совершивших покупку (0..1); null если посетителей нет. */
  conversion: number | null;
  paymentMix: { method: string; total: number }[];
};

export function periodSummary(venueId: number | null, from: string, to: string): PeriodSummary {
  const db = getDb();
  const s = db
    .prepare(
      `SELECT COALESCE(SUM(total),0) AS revenue, COUNT(*) AS salesCount
       FROM sales WHERE (? IS NULL OR venue_id = ?) AND substr(ts,1,10) BETWEEN ? AND ?`
    )
    .get(venueId, venueId, from, to) as { revenue: number; salesCount: number };
  const v = db
    .prepare(
      `SELECT COALESCE(SUM(count),0) AS visitors
       FROM visits WHERE (? IS NULL OR venue_id = ?) AND substr(ts,1,10) BETWEEN ? AND ?`
    )
    .get(venueId, venueId, from, to) as { visitors: number };
  const paymentMix = db
    .prepare(
      `SELECT payment_method AS method, SUM(total) AS total
       FROM sales WHERE (? IS NULL OR venue_id = ?) AND substr(ts,1,10) BETWEEN ? AND ?
       GROUP BY 1 ORDER BY total DESC`
    )
    .all(venueId, venueId, from, to) as { method: string; total: number }[];

  return {
    revenue: s.revenue,
    salesCount: s.salesCount,
    avgCheck: s.salesCount ? Math.round(s.revenue / s.salesCount) : 0,
    visitors: v.visitors,
    conversion: v.visitors ? Math.min(1, s.salesCount / v.visitors) : null,
    paymentMix,
  };
}

export type TopProduct = { name: string; category: string; qty: number; revenue: number };

export function topProducts(venueId: number | null, from: string, to: string, limit = 10): TopProduct[] {
  return getDb()
    .prepare(
      `SELECT p.name, p.category, SUM(si.qty) AS qty, SUM(si.qty * si.price) AS revenue
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       JOIN products p ON p.id = si.product_id
       WHERE (? IS NULL OR s.venue_id = ?) AND substr(s.ts,1,10) BETWEEN ? AND ?
       GROUP BY p.id ORDER BY revenue DESC LIMIT ?`
    )
    .all(venueId, venueId, from, to, limit) as TopProduct[];
}

export type EmployeeDiscipline = {
  employee_id: number;
  name: string;
  venue_name: string;
  fines: number;
  incidents: number;
  missedShifts: number;
};

/** Антирейтинг по дисциплине за период. */
export function disciplineBoard(from: string, to: string): EmployeeDiscipline[] {
  return getDb()
    .prepare(
      `SELECT e.id AS employee_id, e.name, v.name AS venue_name,
         COALESCE((SELECT SUM(a.amount) FROM adjustments a
           WHERE a.employee_id = e.id AND a.kind = 'fine' AND a.date BETWEEN ? AND ?), 0) AS fines,
         (SELECT COUNT(*) FROM incidents i
           WHERE i.employee_id = e.id AND i.status = 'approved'
             AND substr(i.occurred_at,1,10) BETWEEN ? AND ?) AS incidents,
         (SELECT COUNT(*) FROM shifts sh
           WHERE sh.employee_id = e.id AND sh.status = 'missed' AND sh.date BETWEEN ? AND ?) AS missedShifts
       FROM employees e JOIN venues v ON v.id = e.venue_id
       WHERE e.status = 'active'
       ORDER BY fines DESC, incidents DESC`
    )
    .all(from, to, from, to, from, to) as EmployeeDiscipline[];
}

/** Затраты на персонал за период (по журналу: базу считаем по сменам/окладам грубо в UI). */
export function finesTotal(venueId: number | null, from: string, to: string): number {
  const r = getDb()
    .prepare(
      `SELECT COALESCE(SUM(amount),0) AS t FROM adjustments
       WHERE kind='fine' AND (? IS NULL OR venue_id = ?) AND date BETWEEN ? AND ?`
    )
    .get(venueId, venueId, from, to) as { t: number };
  return r.t;
}

function fillDays(rows: DayPoint[], from: string, to: string): DayPoint[] {
  const map = new Map(rows.map((r) => [r.date, r.value]));
  const out: DayPoint[] = [];
  const cursor = new Date(from + "T00:00:00");
  const end = new Date(to + "T00:00:00");
  while (cursor <= end) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, "0");
    const d = String(cursor.getDate()).padStart(2, "0");
    const iso = `${y}-${m}-${d}`;
    out.push({ date: iso, value: map.get(iso) ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}
