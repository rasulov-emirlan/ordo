import { describe, expect, it } from "vitest";
import { computePayroll, monthlyFraction, shiftHours } from "./payroll";

describe("shiftHours", () => {
  it("считает обычную смену", () => {
    expect(shiftHours("08:00", "22:00")).toBe(14);
    expect(shiftHours("09:30", "18:00")).toBe(8.5);
  });
  it("считает ночную смену через полночь", () => {
    expect(shiftHours("22:00", "06:00")).toBe(8);
  });
});

describe("monthlyFraction", () => {
  it("полный месяц = 1", () => {
    expect(monthlyFraction("2026-06-01", "2026-06-30")).toBeCloseTo(1);
  });
  it("половина месяца", () => {
    expect(monthlyFraction("2026-06-01", "2026-06-15")).toBeCloseTo(0.5);
  });
  it("учитывает дату найма внутри периода", () => {
    expect(monthlyFraction("2026-06-01", "2026-06-30", "2026-06-16")).toBeCloseTo(0.5);
  });
  it("найм после периода = 0", () => {
    expect(monthlyFraction("2026-06-01", "2026-06-30", "2026-07-02")).toBe(0);
  });
  it("период через два месяца", () => {
    expect(monthlyFraction("2026-06-16", "2026-07-15")).toBeCloseTo(0.5 + 15 / 31);
  });
});

describe("computePayroll", () => {
  const doneShift = (date: string) => ({
    date,
    start_time: "08:00",
    end_time: "20:00",
    status: "done" as const,
  });

  it("за смену: только отработанные смены × ставка", () => {
    const r = computePayroll({
      salaryType: "per_shift",
      salaryRate: 1500,
      shifts: [
        doneShift("2026-07-01"),
        doneShift("2026-07-03"),
        { ...doneShift("2026-07-05"), status: "missed" },
        { ...doneShift("2026-07-07"), status: "scheduled" },
      ],
      adjustments: [],
      periodStart: "2026-07-01",
      periodEnd: "2026-07-31",
    });
    expect(r.base).toBe(3000);
    expect(r.shiftsDone).toBe(2);
    expect(r.total).toBe(3000);
  });

  it("почасовая: часы × ставка", () => {
    const r = computePayroll({
      salaryType: "hourly",
      salaryRate: 200,
      shifts: [doneShift("2026-07-01")], // 12 часов
      adjustments: [],
      periodStart: "2026-07-01",
      periodEnd: "2026-07-31",
    });
    expect(r.base).toBe(2400);
    expect(r.hoursDone).toBe(12);
  });

  it("оклад пропорционален покрытию периода", () => {
    const r = computePayroll({
      salaryType: "monthly",
      salaryRate: 40000,
      shifts: [],
      adjustments: [],
      periodStart: "2026-06-01",
      periodEnd: "2026-06-15",
    });
    expect(r.base).toBe(20000);
  });

  it("итог = база + премии − удержания − авансы", () => {
    const r = computePayroll({
      salaryType: "per_shift",
      salaryRate: 1000,
      shifts: [doneShift("2026-07-01"), doneShift("2026-07-02")],
      adjustments: [
        { kind: "bonus", amount: 500 },
        { kind: "fine", amount: 300 },
        { kind: "fine", amount: 200 },
        { kind: "advance", amount: 1000 },
      ],
      periodStart: "2026-07-01",
      periodEnd: "2026-07-31",
    });
    expect(r.base).toBe(2000);
    expect(r.bonuses).toBe(500);
    expect(r.fines).toBe(500);
    expect(r.advances).toBe(1000);
    expect(r.total).toBe(1000);
  });
});
