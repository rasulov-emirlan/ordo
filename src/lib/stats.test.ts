import { beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "ordo-stats-")), "test.db");

const { getDb } = await import("./db");
const { periodSummary, revenueByDay, visitorsByHour, topProducts } = await import("./stats");

let venueId: number;

beforeAll(() => {
  const db = getDb();
  venueId = Number(db.prepare("INSERT INTO venues (name) VALUES ('Тест')").run().lastInsertRowid);
  const p1 = Number(db.prepare("INSERT INTO products (name, category, price) VALUES ('Латте','Кофе',220)").run().lastInsertRowid);
  const p2 = Number(db.prepare("INSERT INTO products (name, category, price) VALUES ('Круассан','Выпечка',140)").run().lastInsertRowid);

  const sale = db.prepare("INSERT INTO sales (venue_id, ts, total, payment_method) VALUES (?, ?, ?, ?)");
  const item = db.prepare("INSERT INTO sale_items (sale_id, product_id, qty, price) VALUES (?, ?, ?, ?)");
  const s1 = Number(sale.run(venueId, "2026-07-10T09:15:00", 440, "qr").lastInsertRowid);
  item.run(s1, p1, 2, 220);
  const s2 = Number(sale.run(venueId, "2026-07-10T14:30:00", 360, "cash").lastInsertRowid);
  item.run(s2, p1, 1, 220);
  item.run(s2, p2, 1, 140);
  const s3 = Number(sale.run(venueId, "2026-07-11T18:05:00", 140, "card").lastInsertRowid);
  item.run(s3, p2, 1, 140);

  const visit = db.prepare("INSERT INTO visits (venue_id, ts, count) VALUES (?, ?, ?)");
  visit.run(venueId, "2026-07-10T09:00:00", 5);
  visit.run(venueId, "2026-07-10T14:00:00", 3);
  visit.run(venueId, "2026-07-11T18:00:00", 2);
});

describe("periodSummary", () => {
  it("агрегирует выручку, чеки, средний чек, конверсию", () => {
    const s = periodSummary(venueId, "2026-07-10", "2026-07-11");
    expect(s.revenue).toBe(940);
    expect(s.salesCount).toBe(3);
    expect(s.avgCheck).toBe(313);
    expect(s.visitors).toBe(10);
    expect(s.conversion).toBeCloseTo(0.3);
  });

  it("границы периода включительны и фильтруют", () => {
    const s = periodSummary(venueId, "2026-07-11", "2026-07-11");
    expect(s.revenue).toBe(140);
    expect(s.visitors).toBe(2);
  });

  it("пустой период: нули и null-конверсия", () => {
    const s = periodSummary(venueId, "2026-01-01", "2026-01-02");
    expect(s.revenue).toBe(0);
    expect(s.conversion).toBeNull();
  });
});

describe("revenueByDay", () => {
  it("заполняет пропущенные дни нулями", () => {
    const days = revenueByDay(venueId, "2026-07-09", "2026-07-12");
    expect(days.map((d) => d.value)).toEqual([0, 800, 140, 0]);
  });
});

describe("visitorsByHour", () => {
  it("раскладывает по часам суток", () => {
    const hours = visitorsByHour(venueId, "2026-07-10", "2026-07-11");
    expect(hours[9].value).toBe(5);
    expect(hours[14].value).toBe(3);
    expect(hours[18].value).toBe(2);
    expect(hours[0].value).toBe(0);
  });
});

describe("topProducts", () => {
  it("сортирует по выручке", () => {
    const top = topProducts(venueId, "2026-07-01", "2026-07-31");
    expect(top[0].name).toBe("Латте");
    expect(top[0].qty).toBe(3);
    expect(top[0].revenue).toBe(660);
    expect(top[1].name).toBe("Круассан");
  });
});
