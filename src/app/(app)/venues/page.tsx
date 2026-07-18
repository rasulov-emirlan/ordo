import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { som, todayISO } from "@/lib/format";
import { listVenues } from "@/lib/queries";
import { periodSummary } from "@/lib/stats";
import { createVenue } from "./actions";

export default async function VenuesPage() {
  await requireUser();
  const venues = listVenues();
  const today = todayISO();

  return (
    <>
      <div className="page-head">
        <div className="kicker kicker--red">// Сеть</div>
        <h1>Заведения</h1>
      </div>

      <div className="grid-3">
        {venues.map((venue) => {
          const summary = periodSummary(venue.id, today, today);
          return (
            <div className="card" key={venue.id}>
              <h2><Link href={`/venues/${venue.id}`}>{venue.name}</Link></h2>
              <p>
                {venue.address}
                <br />
                <span className="muted small">{venue.city}</span>
              </p>
              <p className="mono small">{venue.opens_at}–{venue.closes_at}</p>
              <div className="flex-between">
                <div>
                  <div className="kicker">Сегодня</div>
                  <div className="mono">{som(summary.revenue)}</div>
                </div>
                <div>
                  <div className="kicker">Гости</div>
                  <div className="mono">{summary.visitors}</div>
                </div>
              </div>
              <Link className="btn btn--ghost btn--sm mt-1" href={`/venues/${venue.id}`}>
                Открыть точку →
              </Link>
            </div>
          );
        })}

        <form action={createVenue} className="card card--framed">
          <div className="kicker kicker--red">Новая точка</div>
          <h2>Добавить заведение</h2>
          <label className="field">
            <span className="field__label">Название</span>
            <input className="input" name="name" required />
          </label>
          <label className="field">
            <span className="field__label">Адрес</span>
            <input className="input" name="address" required />
          </label>
          <label className="field">
            <span className="field__label">Город</span>
            <input className="input" defaultValue="Бишкек" name="city" required />
          </label>
          <div className="form-row">
            <label className="field">
              <span className="field__label">Открытие</span>
              <input className="input" defaultValue="08:00" name="opens_at" required type="time" />
            </label>
            <label className="field">
              <span className="field__label">Закрытие</span>
              <input className="input" defaultValue="22:00" name="closes_at" required type="time" />
            </label>
          </div>
          <button className="btn" type="submit">Добавить заведение</button>
        </form>
      </div>
    </>
  );
}
