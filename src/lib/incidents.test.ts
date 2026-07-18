import { beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Изолированная временная БД: DB_PATH задаётся до первого импорта db.ts.
process.env.DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "ordo-test-")), "test.db");

const { getDb } = await import("./db");
const { createIncident, approveIncident, dismissIncident, listIncidents } = await import("./incidents");

let venueId: number;
let employeeId: number;
let userId: number;

beforeAll(() => {
  const db = getDb();
  venueId = Number(db.prepare("INSERT INTO venues (name) VALUES ('Тест')").run().lastInsertRowid);
  employeeId = Number(
    db
      .prepare("INSERT INTO employees (venue_id, name, salary_rate) VALUES (?, 'Бакыт', 1500)")
      .run(venueId).lastInsertRowid
  );
  userId = Number(
    db
      .prepare("INSERT INTO users (login, password_hash, name, role) VALUES ('t', 'x', 'Тест', 'owner')")
      .run().lastInsertRowid
  );
});

describe("incidents", () => {
  it("createIncident берёт дефолтный штраф из типа", () => {
    const id = createIncident({
      venue_id: venueId,
      employee_id: employeeId,
      type_code: "sleeping",
      occurred_at: "2026-07-10T14:00:00",
    });
    const rows = listIncidents({ status: "pending" });
    const inc = rows.find((r) => r.id === id)!;
    expect(inc.suggested_fine).toBe(1000);
    expect(inc.type_title).toContain("Сон");
    expect(inc.employee_name).toBe("Бакыт");
  });

  it("approveIncident фиксирует сумму и создаёт удержание в журнале", () => {
    const id = createIncident({
      venue_id: venueId,
      employee_id: employeeId,
      type_code: "phone",
      occurred_at: "2026-07-11T10:00:00",
    });
    approveIncident({ incidentId: id, userId, fineAmount: 450 });

    const inc = getDb().prepare("SELECT * FROM incidents WHERE id = ?").get(id) as {
      status: string;
      fine_amount: number;
    };
    expect(inc.status).toBe("approved");
    expect(inc.fine_amount).toBe(450);

    const adj = getDb()
      .prepare("SELECT * FROM adjustments WHERE incident_id = ?")
      .get(id) as { kind: string; amount: number; employee_id: number; date: string };
    expect(adj.kind).toBe("fine");
    expect(adj.amount).toBe(450);
    expect(adj.employee_id).toBe(employeeId);
    expect(adj.date).toBe("2026-07-11");
  });

  it("approve без сотрудника не создаёт удержание", () => {
    const id = createIncident({
      venue_id: venueId,
      type_code: "sanitation",
      occurred_at: "2026-07-11T12:00:00",
    });
    approveIncident({ incidentId: id, userId });
    const adj = getDb().prepare("SELECT COUNT(*) AS c FROM adjustments WHERE incident_id = ?").get(id) as { c: number };
    expect(adj.c).toBe(0);
  });

  it("сотрудника можно назначить при утверждении", () => {
    const id = createIncident({
      venue_id: venueId,
      type_code: "absence",
      occurred_at: "2026-07-12T16:00:00",
    });
    approveIncident({ incidentId: id, userId, employeeId });
    const adj = getDb().prepare("SELECT employee_id FROM adjustments WHERE incident_id = ?").get(id) as { employee_id: number };
    expect(adj.employee_id).toBe(employeeId);
  });

  it("повторное решение по инциденту — ошибка", () => {
    const id = createIncident({
      venue_id: venueId,
      employee_id: employeeId,
      type_code: "late",
      occurred_at: "2026-07-13T09:00:00",
    });
    dismissIncident(id, userId);
    expect(() => approveIncident({ incidentId: id, userId })).toThrow();
    expect(() => dismissIncident(id, userId)).toThrow();
  });

  it("неизвестный тип — ошибка", () => {
    expect(() =>
      createIncident({ venue_id: venueId, type_code: "nope", occurred_at: "2026-07-13T09:00:00" })
    ).toThrow();
  });
});
