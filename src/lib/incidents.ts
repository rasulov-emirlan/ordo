import { getDb } from "./db";
import { todayISO } from "./format";

export type IncidentRow = {
  id: number;
  venue_id: number;
  venue_name: string;
  employee_id: number | null;
  employee_name: string | null;
  type_id: number;
  type_code: string;
  type_title: string;
  severity: "info" | "warn" | "critical";
  source: "manual" | "camera" | "api";
  camera_name: string | null;
  occurred_at: string;
  note: string;
  confidence: number | null;
  suggested_fine: number;
  status: "pending" | "approved" | "dismissed";
  fine_amount: number | null;
};

const BASE_SELECT = `
  SELECT i.id, i.venue_id, v.name AS venue_name, i.employee_id, e.name AS employee_name,
         i.type_id, t.code AS type_code, t.title AS type_title, t.severity,
         i.source, c.name AS camera_name, i.occurred_at, i.note, i.confidence,
         i.suggested_fine, i.status, i.fine_amount
  FROM incidents i
  JOIN venues v ON v.id = i.venue_id
  JOIN incident_types t ON t.id = i.type_id
  LEFT JOIN employees e ON e.id = i.employee_id
  LEFT JOIN cameras c ON c.id = i.camera_id`;

export function listIncidents(opts: {
  status?: "pending" | "approved" | "dismissed";
  venueId?: number;
  limit?: number;
}): IncidentRow[] {
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.status) {
    where.push("i.status = ?");
    params.push(opts.status);
  }
  if (opts.venueId) {
    where.push("i.venue_id = ?");
    params.push(opts.venueId);
  }
  const sql = `${BASE_SELECT}
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY i.occurred_at DESC LIMIT ?`;
  params.push(opts.limit ?? 100);
  return getDb().prepare(sql).all(...params) as IncidentRow[];
}

export function createIncident(input: {
  venue_id: number;
  employee_id?: number | null;
  type_code: string;
  source?: "manual" | "camera" | "api";
  camera_id?: number | null;
  occurred_at: string;
  note?: string;
  confidence?: number | null;
  suggested_fine?: number; // если не задан — default_fine типа
}): number {
  const db = getDb();
  const type = db
    .prepare("SELECT id, default_fine FROM incident_types WHERE code = ?")
    .get(input.type_code) as { id: number; default_fine: number } | undefined;
  if (!type) throw new Error(`Неизвестный тип инцидента: ${input.type_code}`);
  const res = db
    .prepare(
      `INSERT INTO incidents (venue_id, employee_id, type_id, source, camera_id, occurred_at, note, confidence, suggested_fine)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.venue_id,
      input.employee_id ?? null,
      type.id,
      input.source ?? "manual",
      input.camera_id ?? null,
      input.occurred_at,
      input.note ?? "",
      input.confidence ?? null,
      input.suggested_fine ?? type.default_fine
    );
  return Number(res.lastInsertRowid);
}

/**
 * Утвердить инцидент: фиксирует сумму и (если есть виновник и сумма > 0)
 * создаёт запись штрафа в журнале начислений. Одна транзакция.
 */
export function approveIncident(opts: {
  incidentId: number;
  userId: number;
  fineAmount?: number; // переопределение suggested_fine
  employeeId?: number; // можно назначить виновника при утверждении
}): void {
  const db = getDb();
  const tx = db.transaction(() => {
    const inc = db
      .prepare("SELECT * FROM incidents WHERE id = ?")
      .get(opts.incidentId) as
      | { id: number; venue_id: number; employee_id: number | null; type_id: number; suggested_fine: number; status: string; occurred_at: string }
      | undefined;
    if (!inc) throw new Error("Инцидент не найден");
    if (inc.status !== "pending") throw new Error("Инцидент уже рассмотрен");

    const employeeId = opts.employeeId ?? inc.employee_id;
    const amount = opts.fineAmount ?? inc.suggested_fine;

    db.prepare(
      `UPDATE incidents SET status = 'approved', fine_amount = ?, employee_id = ?,
        decided_by = ?, decided_at = datetime('now','localtime') WHERE id = ?`
    ).run(amount, employeeId, opts.userId, opts.incidentId);

    if (employeeId && amount > 0) {
      const title = db
        .prepare("SELECT title FROM incident_types WHERE id = ?")
        .get(inc.type_id) as { title: string };
      db.prepare(
        `INSERT INTO adjustments (employee_id, venue_id, kind, amount, reason, incident_id, date, created_by)
         VALUES (?, ?, 'fine', ?, ?, ?, ?, ?)`
      ).run(
        employeeId,
        inc.venue_id,
        amount,
        title.title,
        inc.id,
        inc.occurred_at.slice(0, 10) || todayISO(),
        opts.userId
      );
    }
  });
  tx();
}

export function dismissIncident(incidentId: number, userId: number): void {
  const res = getDb()
    .prepare(
      `UPDATE incidents SET status = 'dismissed', decided_by = ?,
        decided_at = datetime('now','localtime') WHERE id = ? AND status = 'pending'`
    )
    .run(userId, incidentId);
  if (res.changes === 0) throw new Error("Инцидент не найден или уже рассмотрен");
}
