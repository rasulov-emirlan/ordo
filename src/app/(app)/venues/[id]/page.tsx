import Link from "next/link";
import { notFound } from "next/navigation";
import { Bars } from "@/components/Bars";
import { HlsPlayer } from "@/components/HlsPlayer";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { addDays, fmtDate, fmtDateTime, som, todayISO } from "@/lib/format";
import { listIncidents } from "@/lib/incidents";
import { getVenue, listCameras } from "@/lib/queries";
import { periodSummary, revenueByDay } from "@/lib/stats";
import { updateVenue } from "../actions";

type ShiftRow = {
  id: number;
  employee_id: number;
  name: string;
  position: string;
  start_time: string;
  end_time: string;
};

const STATUS_LABELS = {
  pending: "На рассмотрении",
  approved: "Утверждён",
  dismissed: "Отклонён",
} as const;

const SOURCE_LABELS = {
  manual: "вручную",
  camera: "камера",
  api: "API",
} as const;

export default async function VenuePage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const venue = getVenue(id);
  if (!venue) notFound();

  const today = todayISO();
  const summary = periodSummary(venue.id, today, today);
  const shifts = getDb()
    .prepare(
      `SELECT sh.id, sh.employee_id, e.name, e.position, sh.start_time, sh.end_time
       FROM shifts sh JOIN employees e ON e.id = sh.employee_id
       WHERE sh.venue_id = ? AND sh.date = ? AND sh.status IN ('scheduled', 'done')
       ORDER BY sh.start_time, e.name`
    )
    .all(venue.id, today) as ShiftRow[];
  const cameras = listCameras(venue.id);
  const incidents = listIncidents({ venueId: venue.id, limit: 8 });
  const from14 = addDays(today, -13);
  const revenue14 = revenueByDay(venue.id, from14, today);

  return (
    <>
      <div className="page-head">
        <div className="page-head__row">
          <div>
            <div className="kicker kicker--red">// Заведение</div>
            <h1>{venue.name}</h1>
            <div>{venue.address}, {venue.city}</div>
            <div className="mono small muted">{venue.opens_at}–{venue.closes_at}</div>
          </div>
          <Link className="btn btn--ghost btn--sm" href="/venues">← Все заведения</Link>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat">
          <div className="stat__label">Выручка сегодня</div>
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
          <div className="stat__label">Гости</div>
          <div className="stat__value">{summary.visitors}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Конверсия</div>
          <div className="stat__value">
            {summary.conversion == null ? "—" : `${Math.round(summary.conversion * 100)}%`}
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="kicker mb-1">Сейчас на смене</div>
          {shifts.length === 0 ? (
            <p className="muted small">Сегодня смен нет.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Сотрудник</th>
                  <th>Должность</th>
                  <th className="num">Смена</th>
                </tr>
              </thead>
              <tbody>
                {shifts.map((shift) => (
                  <tr key={shift.id}>
                    <td><Link href={`/staff/${shift.employee_id}`}>{shift.name}</Link></td>
                    <td>{shift.position}</td>
                    <td className="num">{shift.start_time}–{shift.end_time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <div className="flex-between mb-1">
            <div className="kicker">Выручка · 14 дней</div>
            <div className="mono small">с {fmtDate(from14)}</div>
          </div>
          <Bars
            points={revenue14.map((point) => ({ label: fmtDate(point.date), value: point.value }))}
            formatValue={som}
          />
        </div>
      </div>

      <div className="card mt-1">
        <div className="kicker mb-1">Камеры</div>
        {cameras.length === 0 ? (
          <p className="muted small">Камер на этой точке пока нет.</p>
        ) : (
          <div className="cam-grid">
            {cameras.map((camera) => (
              <Link className="cam-tile" href={`/cameras/${camera.id}`} key={camera.id}>
                <HlsPlayer src={camera.stream_url} />
                <span className="cam-tile__label">{camera.name} · {camera.zone}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="card mt-1">
        <div className="flex-between mb-1">
          <div className="kicker">Последние инциденты</div>
          <Link className="small" href={`/incidents?venue=${venue.id}`}>все →</Link>
        </div>
        {incidents.length === 0 ? (
          <p className="muted small">Инцидентов на этой точке нет.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Когда</th>
                  <th>Нарушение</th>
                  <th>Сотрудник</th>
                  <th>Источник</th>
                  <th>Статус</th>
                  <th className="num">Сумма</th>
                </tr>
              </thead>
              <tbody>
                {incidents.map((incident) => (
                  <tr key={incident.id}>
                    <td>{fmtDateTime(incident.occurred_at)}</td>
                    <td>
                      <span className={incident.severity === "critical" ? "badge badge--red" : "badge"}>
                        {incident.type_title}
                      </span>
                    </td>
                    <td>
                      {incident.employee_id ? (
                        <Link href={`/staff/${incident.employee_id}`}>{incident.employee_name}</Link>
                      ) : "—"}
                    </td>
                    <td>{SOURCE_LABELS[incident.source]}</td>
                    <td>{STATUS_LABELS[incident.status]}</td>
                    <td className="num">{som(incident.fine_amount ?? incident.suggested_fine)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <form action={updateVenue} className="card card--framed mt-1">
        <div className="kicker kicker--red">Параметры точки</div>
        <h2>Редактировать</h2>
        <input name="id" type="hidden" value={venue.id} />
        <div className="form-row">
          <label className="field">
            <span className="field__label">Название</span>
            <input className="input" defaultValue={venue.name} name="name" required />
          </label>
          <label className="field">
            <span className="field__label">Город</span>
            <input className="input" defaultValue={venue.city} name="city" required />
          </label>
        </div>
        <label className="field">
          <span className="field__label">Адрес</span>
          <input className="input" defaultValue={venue.address} name="address" required />
        </label>
        <div className="form-row">
          <label className="field">
            <span className="field__label">Открытие</span>
            <input className="input" defaultValue={venue.opens_at} name="opens_at" required type="time" />
          </label>
          <label className="field">
            <span className="field__label">Закрытие</span>
            <input className="input" defaultValue={venue.closes_at} name="closes_at" required type="time" />
          </label>
        </div>
        <button className="btn" type="submit">Сохранить</button>
      </form>
    </>
  );
}
