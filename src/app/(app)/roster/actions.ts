"use server";

import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { revalidatePath } from "next/cache";

const SHIFT_STATUSES = new Set(["scheduled", "done", "missed", "sick"]);
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function isISODate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime()) &&
    date.getFullYear() === Number(value.slice(0, 4)) &&
    date.getMonth() + 1 === Number(value.slice(5, 7)) &&
    date.getDate() === Number(value.slice(8, 10));
}

function positiveId(formData: FormData, name: string): number {
  const value = Number(formData.get(name));
  if (!Number.isInteger(value) || value <= 0) throw new Error(`Некорректное поле ${name}`);
  return value;
}

export async function createShift(formData: FormData) {
  const user = await requireUser();
  void user;

  const employeeId = positiveId(formData, "employeeId");
  const venueId = positiveId(formData, "venueId");
  const date = formData.get("date");
  const startTime = formData.get("startTime");
  const endTime = formData.get("endTime");

  if (!isISODate(date)) {
    throw new Error("Некорректная дата смены");
  }
  if (typeof startTime !== "string" || !TIME_PATTERN.test(startTime)) {
    throw new Error("Некорректное время начала");
  }
  if (typeof endTime !== "string" || !TIME_PATTERN.test(endTime) || endTime === startTime) {
    throw new Error("Некорректное время окончания");
  }

  const db = getDb();
  const employee = db
    .prepare("SELECT id FROM employees WHERE id = ? AND venue_id = ? AND status = 'active'")
    .get(employeeId, venueId);
  if (!employee) throw new Error("Активный сотрудник этой точки не найден");

  const existing = db
    .prepare("SELECT id FROM shifts WHERE employee_id = ? AND date = ?")
    .get(employeeId, date);
  if (existing) throw new Error("На эту дату у сотрудника уже есть смена");

  db.prepare(
    `INSERT INTO shifts (venue_id, employee_id, date, start_time, end_time, status)
     VALUES (?, ?, ?, ?, ?, 'scheduled')`,
  ).run(venueId, employeeId, date, startTime, endTime);

  revalidatePath("/roster");
  revalidatePath(`/staff/${employeeId}`);
}

export async function updateShiftStatus(formData: FormData) {
  const user = await requireUser();
  void user;

  const shiftId = positiveId(formData, "shiftId");
  const status = formData.get("status");
  if (typeof status !== "string" || !SHIFT_STATUSES.has(status)) {
    throw new Error("Некорректный статус смены");
  }

  const db = getDb();
  const shift = db
    .prepare("SELECT employee_id FROM shifts WHERE id = ?")
    .get(shiftId) as { employee_id: number } | undefined;
  if (!shift) throw new Error("Смена не найдена");

  db.prepare("UPDATE shifts SET status = ? WHERE id = ?").run(status, shiftId);
  revalidatePath("/roster");
  revalidatePath(`/staff/${shift.employee_id}`);
}

export async function deleteShift(formData: FormData) {
  const user = await requireUser();
  void user;

  const shiftId = positiveId(formData, "shiftId");
  const db = getDb();
  const shift = db
    .prepare("SELECT employee_id FROM shifts WHERE id = ?")
    .get(shiftId) as { employee_id: number } | undefined;
  if (!shift) throw new Error("Смена не найдена");

  db.prepare("DELETE FROM shifts WHERE id = ?").run(shiftId);
  revalidatePath("/roster");
  revalidatePath(`/staff/${shift.employee_id}`);
}
