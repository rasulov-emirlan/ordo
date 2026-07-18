import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { som } from "@/lib/format";
import { listEmployees, listVenues } from "@/lib/queries";
import { createEmployee } from "./actions";

const SALARY_LABELS = {
  monthly: "оклад",
  per_shift: "за смену",
  hourly: "почасовая",
} as const;

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ venue?: string }>;
}) {
  await requireUser();
  const { venue } = await searchParams;
  const venues = listVenues();
  const requestedVenueId = Number(venue);
  const venueId = venues.some((item) => item.id === requestedVenueId)
    ? requestedVenueId
    : undefined;
  const venueNames = new Map(venues.map((item) => [item.id, item.name]));
  const employees = listEmployees(venueId, true).sort(
    (a, b) => Number(a.status === "inactive") - Number(b.status === "inactive"),
  );

  return (
    <>
      <div className="page-head">
        <div className="kicker kicker--red">// Команда</div>
        <h1>Персонал</h1>
      </div>

      <div className="actions mb-1">
        <Link
          href="/staff"
          className={`btn btn--sm${venueId == null ? "" : " btn--ghost"}`}
        >
          Все точки
        </Link>
        {venues.map((item) => (
          <Link
            key={item.id}
            href={`/staff?venue=${item.id}`}
            className={`btn btn--sm${venueId === item.id ? "" : " btn--ghost"}`}
          >
            {item.name}
          </Link>
        ))}
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Имя</th>
              <th>Должность</th>
              <th>Точка</th>
              <th>Тип оплаты</th>
              <th className="num">Ставка</th>
              <th>Телефон</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((employee) => (
              <tr key={employee.id}>
                <td>
                  <Link href={`/staff/${employee.id}`}>{employee.name}</Link>
                </td>
                <td>{employee.position}</td>
                <td>{venueNames.get(employee.venue_id) ?? "—"}</td>
                <td>{SALARY_LABELS[employee.salary_type]}</td>
                <td className="num">{som(employee.salary_rate)}</td>
                <td className="mono small">{employee.phone || "—"}</td>
                <td>
                  {employee.status === "active" ? (
                    <span className="badge badge--ink">в штате</span>
                  ) : (
                    <span className="badge muted">неактивен</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {employees.length === 0 && (
        <p className="muted small mt-1">
          В этой точке пока нет сотрудников — добавьте первого ниже.
        </p>
      )}

      <div className="card mt-2">
        <div className="kicker mb-1">Добавить сотрудника</div>
        {venues.length === 0 ? (
          <p className="muted small">Сначала добавьте заведение.</p>
        ) : (
          <form action={createEmployee}>
            <div className="form-row">
              <label className="field">
                <span className="field__label">Имя</span>
                <input className="input" name="name" required />
              </label>
              <label className="field">
                <span className="field__label">Телефон</span>
                <input className="input" name="phone" type="tel" required />
              </label>
              <label className="field">
                <span className="field__label">Заведение</span>
                <select
                  className="select"
                  name="venueId"
                  defaultValue={venueId ?? venues[0].id}
                  required
                >
                  {venues.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="form-row">
              <label className="field">
                <span className="field__label">Должность</span>
                <input className="input" name="position" defaultValue="Бариста" required />
              </label>
              <label className="field">
                <span className="field__label">Тип оплаты</span>
                <select className="select" name="salaryType" defaultValue="per_shift" required>
                  <option value="monthly">Оклад</option>
                  <option value="per_shift">За смену</option>
                  <option value="hourly">Почасовая</option>
                </select>
              </label>
              <label className="field">
                <span className="field__label">Ставка, сом</span>
                <input
                  className="input"
                  name="salaryRate"
                  type="number"
                  min="0"
                  step="1"
                  required
                />
              </label>
            </div>
            <button className="btn" type="submit">
              Добавить сотрудника
            </button>
          </form>
        )}
      </div>
    </>
  );
}
