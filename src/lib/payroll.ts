// Расчёт зарплаты за период. Чистые функции — покрыты тестами.

export type SalaryType = "monthly" | "per_shift" | "hourly";

export type PayrollShift = {
  date: string; // YYYY-MM-DD
  start_time: string; // HH:MM
  end_time: string; // HH:MM
  status: "scheduled" | "done" | "missed" | "sick";
};

export type PayrollAdjustment = {
  kind: "fine" | "bonus" | "advance";
  amount: number;
};

export type PayrollResult = {
  base: number; // начислено по ставке
  fines: number;
  bonuses: number;
  advances: number;
  total: number; // base + bonuses - fines - advances
  shiftsDone: number;
  hoursDone: number;
};

export function shiftHours(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let minutes = eh * 60 + em - (sh * 60 + sm);
  if (minutes < 0) minutes += 24 * 60; // ночная смена через полночь
  return minutes / 60;
}

/**
 * base для monthly — оклад пропорционально доле месяца, покрытой периодом,
 * начиная с даты найма (грубое приближение: по календарным дням).
 */
export function computePayroll(opts: {
  salaryType: SalaryType;
  salaryRate: number;
  shifts: PayrollShift[];
  adjustments: PayrollAdjustment[];
  periodStart: string; // YYYY-MM-DD inclusive
  periodEnd: string; // YYYY-MM-DD inclusive
  hiredAt?: string;
}): PayrollResult {
  const done = opts.shifts.filter((s) => s.status === "done");
  const shiftsDone = done.length;
  const hoursDone = done.reduce((acc, s) => acc + shiftHours(s.start_time, s.end_time), 0);

  let base = 0;
  if (opts.salaryType === "per_shift") {
    base = shiftsDone * opts.salaryRate;
  } else if (opts.salaryType === "hourly") {
    base = Math.round(hoursDone * opts.salaryRate);
  } else {
    base = Math.round(opts.salaryRate * monthlyFraction(opts.periodStart, opts.periodEnd, opts.hiredAt));
  }

  const sum = (kind: PayrollAdjustment["kind"]) =>
    opts.adjustments.filter((a) => a.kind === kind).reduce((acc, a) => acc + a.amount, 0);

  const fines = sum("fine");
  const bonuses = sum("bonus");
  const advances = sum("advance");

  return {
    base,
    fines,
    bonuses,
    advances,
    total: base + bonuses - fines - advances,
    shiftsDone,
    hoursDone: Math.round(hoursDone * 10) / 10,
  };
}

/** Доля месячного оклада за период [start..end], с учётом даты найма. */
export function monthlyFraction(start: string, end: string, hiredAt?: string): number {
  let from = new Date(start + "T00:00:00");
  const to = new Date(end + "T00:00:00");
  if (hiredAt) {
    const hired = new Date(hiredAt + "T00:00:00");
    if (hired > from) from = hired;
  }
  if (from > to) return 0;

  // Сумма по месяцам: покрытые дни / дней в месяце.
  let fraction = 0;
  let cursor = new Date(from);
  while (cursor <= to) {
    const y = cursor.getFullYear();
    const m = cursor.getMonth();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const monthEnd = new Date(y, m, daysInMonth);
    const spanEnd = monthEnd < to ? monthEnd : to;
    const coveredDays = Math.round((spanEnd.getTime() - cursor.getTime()) / 86400000) + 1;
    fraction += coveredDays / daysInMonth;
    cursor = new Date(y, m + 1, 1);
  }
  return fraction;
}
