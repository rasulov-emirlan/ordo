import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { addDays, fmtDate, todayISO, weekStart, WEEKDAYS_RU } from "@/lib/format";
import { listEmployees, listVenues, type Employee } from "@/lib/queries";
import { createShift, deleteShift, updateShiftStatus } from "./actions";

type ShiftStatus = "scheduled" | "done" | "missed" | "sick";
type Shift = {
  id: number;
  venue_id: number;
  employee_id: number;
  date: string;
  start_time: string;
  end_time: string;
  status: ShiftStatus;
};

const STATUS_LABELS: Record<ShiftStatus, string> = {
  scheduled: "запланирована",
  done: "отработана",
  missed: "прогул",
  sick: "больничный",
};

function rosterHref({
  venueId,
  week,
  add,
  edit,
}: {
  venueId: number;
  week: string;
  add?: string;
  edit?: number;
}) {
  const query = new URLSearchParams({ venue: String(venueId), week });
  if (add) query.set("add", add);
  if (edit) query.set("edit", String(edit));
  return `/roster?${query.toString()}`;
}

function ShiftMarker({ status }: { status: ShiftStatus }) {
  if (status === "missed") return <span className="badge badge--red">прогул</span>;
  if (status === "sick") return <span className="muted small">болел</span>;
  if (status === "done") return <span className="badge badge--ink">готово</span>;
  return <span className="badge">план</span>;
}

function isISODate(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime()) &&
    date.getFullYear() === Number(value.slice(0, 4)) &&
    date.getMonth() + 1 === Number(value.slice(5, 7)) &&
    date.getDate() === Number(value.slice(8, 10));
}

export default async function RosterPage({
  searchParams,
}: {
  searchParams: Promise<{ venue?: string; week?: string; add?: string; edit?: string }>;
}) {
  await requireUser();
  const query = await searchParams;
  const venues = listVenues();
  const requestedVenueId = Number(query.venue);
  const selectedVenue =
    venues.find((venue) => venue.id === requestedVenueId) ?? venues[0];
  const currentWeek = weekStart(todayISO());
  const requestedWeek = query.week;
  const week = isISODate(requestedWeek) ? weekStart(requestedWeek) : currentWeek;
  const dates = Array.from({ length: 7 }, (_, index) => addDays(week, index));

  let employees: Employee[] = [];
  let shifts: Shift[] = [];
  if (selectedVenue) {
    employees = listEmployees(selectedVenue.id);
    shifts = getDb()
      .prepare(
        `SELECT sh.id, sh.venue_id, sh.employee_id, sh.date, sh.start_time, sh.end_time, sh.status
         FROM shifts sh
         JOIN employees e ON e.id = sh.employee_id
         WHERE sh.venue_id = ? AND sh.date BETWEEN ? AND ? AND e.status = 'active'
         ORDER BY sh.date, sh.start_time, sh.id`,
      )
      .all(selectedVenue.id, dates[0], dates[6]) as Shift[];
  }

  const shiftsByCell = new Map(
    shifts.map((shift) => [`${shift.employee_id}:${shift.date}`, shift]),
  );
  const employeesById = new Map(employees.map((employee) => [employee.id, employee]));
  const addMatch = query.add?.match(/^(\d+):(\d{4}-\d{2}-\d{2})$/);
  const addEmployee = addMatch ? employeesById.get(Number(addMatch[1])) : undefined;
  const addDate = addMatch && dates.includes(addMatch[2]) ? addMatch[2] : undefined;
  const editId = Number(query.edit);
  const editShift = Number.isInteger(editId)
    ? shifts.find((shift) => shift.id === editId)
    : undefined;
  const editEmployee = editShift ? employeesById.get(editShift.employee_id) : undefined;
  const doneCount = shifts.filter((shift) => shift.status === "done").length;

  return (
    <>
      <div className="page-head">
        <div className="page-head__row">
          <div>
            <div className="kicker kicker--red">// Планирование</div>
            <h1>График смен</h1>
            <div className="muted small">
              {fmtDate(dates[0])} — {fmtDate(dates[6])}
            </div>
          </div>
          <div className="mono small">
            {shifts.length} смен · {doneCount} отработано
          </div>
        </div>
      </div>

      {selectedVenue ? (
        <>
          <div className="actions mb-1">
            {venues.map((venue) => (
              <Link
                key={venue.id}
                href={rosterHref({ venueId: venue.id, week })}
                className={`btn btn--sm${
                  selectedVenue.id === venue.id ? "" : " btn--ghost"
                }`}
              >
                {venue.name}
              </Link>
            ))}
          </div>

          <div className="flex-between mb-1">
            <div className="actions">
              <Link
                className="btn btn--sm btn--ghost"
                href={rosterHref({ venueId: selectedVenue.id, week: addDays(week, -7) })}
              >
                ← Пред
              </Link>
              <Link
                className={`btn btn--sm${week === currentWeek ? "" : " btn--ghost"}`}
                href={rosterHref({ venueId: selectedVenue.id, week: currentWeek })}
              >
                Текущая
              </Link>
              <Link
                className="btn btn--sm btn--ghost"
                href={rosterHref({ venueId: selectedVenue.id, week: addDays(week, 7) })}
              >
                След →
              </Link>
            </div>
            <span className="small muted">{selectedVenue.name}</span>
          </div>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Сотрудник</th>
                  {dates.map((date, index) => (
                    <th key={date}>
                      {WEEKDAYS_RU[index]} {Number(date.slice(-2))}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employees.map((employee) => (
                  <tr key={employee.id}>
                    <td>
                      <Link href={`/staff/${employee.id}`}>{employee.name}</Link>
                      <div className="muted small">{employee.position}</div>
                    </td>
                    {dates.map((date) => {
                      const shift = shiftsByCell.get(`${employee.id}:${date}`);
                      return (
                        <td key={date}>
                          {shift ? (
                            <Link
                              href={rosterHref({
                                venueId: selectedVenue.id,
                                week,
                                edit: shift.id,
                              })}
                            >
                              <span className="mono small">
                                {shift.start_time}–{shift.end_time}
                              </span>
                              <br />
                              <ShiftMarker status={shift.status} />
                            </Link>
                          ) : (
                            <Link
                              className="btn btn--sm btn--ghost"
                              href={rosterHref({
                                venueId: selectedVenue.id,
                                week,
                                add: `${employee.id}:${date}`,
                              })}
                              aria-label={`Добавить смену: ${employee.name}, ${fmtDate(date)}`}
                            >
                              +
                            </Link>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {employees.length === 0 && (
            <p className="muted small mt-1">
              В этой точке нет активных сотрудников — верните сотрудника в штат или добавьте нового.
            </p>
          )}

          {addEmployee && addDate && !shiftsByCell.has(`${addEmployee.id}:${addDate}`) && (
            <div className="card card--framed mt-2">
              <div className="kicker">Новая смена</div>
              <h2>{addEmployee.name}</h2>
              <p className="muted small">{fmtDate(addDate)} · {selectedVenue.name}</p>
              <form action={createShift}>
                <input type="hidden" name="employeeId" value={addEmployee.id} />
                <input type="hidden" name="venueId" value={selectedVenue.id} />
                <input type="hidden" name="date" value={addDate} />
                <div className="form-row">
                  <label className="field">
                    <span className="field__label">С</span>
                    <input
                      className="input"
                      name="startTime"
                      type="time"
                      defaultValue={selectedVenue.opens_at}
                      required
                    />
                  </label>
                  <label className="field">
                    <span className="field__label">До</span>
                    <input
                      className="input"
                      name="endTime"
                      type="time"
                      defaultValue={selectedVenue.closes_at}
                      required
                    />
                  </label>
                </div>
                <div className="actions">
                  <button className="btn" type="submit">Добавить смену</button>
                  <Link
                    className="btn btn--ghost"
                    href={rosterHref({ venueId: selectedVenue.id, week })}
                  >
                    Отмена
                  </Link>
                </div>
              </form>
            </div>
          )}

          {editShift && editEmployee && (
            <div className="card card--framed mt-2">
              <div className="kicker">Редактировать смену</div>
              <h2>{editEmployee.name}</h2>
              <p className="muted small">
                {fmtDate(editShift.date)} · {editShift.start_time}–{editShift.end_time} ·{" "}
                {STATUS_LABELS[editShift.status]}
              </p>
              <form action={updateShiftStatus}>
                <input type="hidden" name="shiftId" value={editShift.id} />
                <div className="actions">
                  {(Object.entries(STATUS_LABELS) as [ShiftStatus, string][]).map(
                    ([status, label]) => (
                      <button
                        key={status}
                        className={`btn btn--sm${
                          editShift.status === status
                            ? status === "missed"
                              ? " btn--danger"
                              : ""
                            : " btn--ghost"
                        }`}
                        type="submit"
                        name="status"
                        value={status}
                      >
                        {label}
                      </button>
                    ),
                  )}
                </div>
              </form>
              <div className="flex-between mt-1">
                <Link
                  className="btn btn--sm btn--ghost"
                  href={rosterHref({ venueId: selectedVenue.id, week })}
                >
                  Закрыть
                </Link>
                <form action={deleteShift}>
                  <input type="hidden" name="shiftId" value={editShift.id} />
                  <button className="btn btn--sm btn--danger" type="submit">
                    Удалить смену
                  </button>
                </form>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="card">
          <p className="muted small">Нет заведений — сначала добавьте точку.</p>
        </div>
      )}
    </>
  );
}
