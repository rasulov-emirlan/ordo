import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { addDays, fmtDate, som, todayISO } from "@/lib/format";
import { computePayroll, type PayrollAdjustment, type PayrollShift } from "@/lib/payroll";
import { getEmployee, getVenue } from "@/lib/queries";
import { toggleEmployeeStatus } from "../actions";
import { addAdjustment } from "./actions";

type Shift = PayrollShift & { id: number };
type Adjustment = PayrollAdjustment & {
  id: number;
  date: string;
  reason: string;
};

const ADJUSTMENT_LABELS = {
  fine: "удержание (штраф)",
  bonus: "премия",
  advance: "аванс",
} as const;

const SHIFT_LABELS = {
  scheduled: "запланирована",
  done: "отработана",
  missed: "прогул",
  sick: "больничный",
} as const;

export default async function EmployeePage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const employeeId = Number(id);
  if (!Number.isInteger(employeeId) || employeeId <= 0) notFound();

  const employee = getEmployee(employeeId);
  if (!employee) notFound();
  const venue = getVenue(employee.venue_id);
  if (!venue) notFound();

  const today = todayISO();
  const monthStart = `${today.slice(0, 8)}01`;
  const from30 = addDays(today, -29);
  const db = getDb();
  const monthShifts = db
    .prepare(
      `SELECT id, date, start_time, end_time, status
       FROM shifts WHERE employee_id = ? AND date BETWEEN ? AND ? ORDER BY date`,
    )
    .all(employeeId, monthStart, today) as Shift[];
  const monthAdjustments = db
    .prepare(
      `SELECT kind, amount
       FROM adjustments WHERE employee_id = ? AND date BETWEEN ? AND ?
       ORDER BY date DESC, id DESC`,
    )
    .all(employeeId, monthStart, today) as PayrollAdjustment[];
  const adjustments = db
    .prepare(
      `SELECT id, kind, amount, date, reason
       FROM adjustments WHERE employee_id = ? ORDER BY date DESC, id DESC`,
    )
    .all(employeeId) as Adjustment[];
  const recentShifts = db
    .prepare(
      `SELECT id, date, start_time, end_time, status
       FROM shifts WHERE employee_id = ? AND date BETWEEN ? AND ?
       ORDER BY date DESC, start_time`,
    )
    .all(employeeId, from30, today) as Shift[];
  const payroll = computePayroll({
    salaryType: employee.salary_type,
    salaryRate: employee.salary_rate,
    shifts: monthShifts,
    adjustments: monthAdjustments,
    periodStart: monthStart,
    periodEnd: today,
    hiredAt: employee.hired_at,
  });

  return (
    <>
      <div className="page-head">
        <div className="page-head__row">
          <div>
            <div className="kicker kicker--red">// Карточка сотрудника</div>
            <h1>{employee.name}</h1>
            <div className="muted">
              {employee.position} · {venue.name}
            </div>
            <div className="small mt-1">
              {employee.phone || "Телефон не указан"} · принят {fmtDate(employee.hired_at)} ·{" "}
              {employee.status === "active" ? (
                <span className="badge badge--ink">в штате</span>
              ) : (
                <span className="badge muted">неактивен</span>
              )}
            </div>
          </div>
          <form action={toggleEmployeeStatus}>
            <input type="hidden" name="employeeId" value={employee.id} />
            <button
              className={`btn${employee.status === "active" ? " btn--danger" : " btn--ghost"}`}
              type="submit"
            >
              {employee.status === "active" ? "Деактивировать" : "Вернуть в штат"}
            </button>
          </form>
        </div>
      </div>

      <div className="kicker mb-1">
        Зарплата · {fmtDate(monthStart)} — {fmtDate(today)}
      </div>
      <div className="stat-grid">
        <div className="stat">
          <div className="stat__label">Начислено</div>
          <div className="stat__value">{som(payroll.base)}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Премии</div>
          <div className="stat__value">{som(payroll.bonuses)}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Удержания</div>
          <div className="stat__value stat__value--red">{som(payroll.fines)}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Авансы</div>
          <div className="stat__value">{som(payroll.advances)}</div>
        </div>
        <div className="stat card--framed">
          <div className="stat__label">К выплате</div>
          <div className={`stat__value${payroll.total < 0 ? " stat__value--red" : ""}`}>
            {som(payroll.total)}
          </div>
        </div>
        <div className="stat">
          <div className="stat__label">Смен отработано</div>
          <div className="stat__value">{payroll.shiftsDone}</div>
          <div className="stat__sub">{payroll.hoursDone} ч</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="kicker mb-1">Журнал начислений</div>
          {adjustments.length === 0 ? (
            <p className="muted small">Записей пока нет — добавьте первую справа.</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Дата</th>
                    <th>Тип</th>
                    <th className="num">Сумма</th>
                    <th>Причина</th>
                  </tr>
                </thead>
                <tbody>
                  {adjustments.map((adjustment) => {
                    const isDebit = adjustment.kind !== "bonus";
                    return (
                      <tr key={adjustment.id}>
                        <td>{fmtDate(adjustment.date)}</td>
                        <td>{ADJUSTMENT_LABELS[adjustment.kind]}</td>
                        <td
                          className={`num${adjustment.kind === "fine" ? " stat__value--red" : ""}`}
                        >
                          {isDebit ? "−" : "+"}
                          {som(adjustment.amount)}
                        </td>
                        <td>{adjustment.reason || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <div className="kicker mb-1">Добавить запись</div>
          <form action={addAdjustment}>
            <input type="hidden" name="employeeId" value={employee.id} />
            <div className="form-row">
              <label className="field">
                <span className="field__label">Тип</span>
                <select className="select" name="kind" defaultValue="bonus" required>
                  <option value="bonus">Премия</option>
                  <option value="fine">Удержание (штраф)</option>
                  <option value="advance">Аванс</option>
                </select>
              </label>
              <label className="field">
                <span className="field__label">Сумма, сом</span>
                <input className="input" name="amount" type="number" min="1" step="1" required />
              </label>
              <label className="field">
                <span className="field__label">Дата</span>
                <input className="input" name="date" type="date" defaultValue={today} required />
              </label>
            </div>
            <label className="field">
              <span className="field__label">Причина</span>
              <input className="input" name="reason" required />
            </label>
            <button className="btn" type="submit">
              Добавить запись
            </button>
          </form>
          <p className="small muted mt-1">
            По ТК КР денежные штрафы не являются дисциплинарным взысканием — оформляйте как
            депремирование по локальному акту.
          </p>
        </div>
      </div>

      <div className="card mt-2">
        <div className="kicker mb-1">Смены за 30 дней</div>
        {recentShifts.length === 0 ? (
          <p className="muted small">За последние 30 дней смен не было.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Время</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {recentShifts.map((shift) => (
                  <tr key={shift.id}>
                    <td>{fmtDate(shift.date)}</td>
                    <td className="mono small">
                      {shift.start_time}–{shift.end_time}
                    </td>
                    <td>
                      <span className={`badge${shift.status === "missed" ? " badge--red" : ""}`}>
                        {SHIFT_LABELS[shift.status]}
                      </span>
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
