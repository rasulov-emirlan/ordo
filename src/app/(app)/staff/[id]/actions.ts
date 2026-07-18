"use server";

import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { revalidatePath } from "next/cache";

const ADJUSTMENT_KINDS = new Set(["fine", "bonus", "advance"]);

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
  if (!Number.isInteger(value) || value <= 0) throw new Error("Некорректный сотрудник");
  return value;
}

export async function addAdjustment(formData: FormData) {
  const user = await requireUser();

  const employeeId = positiveId(formData, "employeeId");
  const kind = formData.get("kind");
  const amount = Number(formData.get("amount"));
  const reasonValue = formData.get("reason");
  const date = formData.get("date");

  if (typeof kind !== "string" || !ADJUSTMENT_KINDS.has(kind)) {
    throw new Error("Некорректный тип записи");
  }
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("Сумма должна быть целым положительным числом");
  }
  if (typeof reasonValue !== "string" || !reasonValue.trim()) {
    throw new Error("Укажите причину");
  }
  if (!isISODate(date)) {
    throw new Error("Некорректная дата");
  }

  const db = getDb();
  const employee = db
    .prepare("SELECT venue_id FROM employees WHERE id = ?")
    .get(employeeId) as { venue_id: number } | undefined;
  if (!employee) throw new Error("Сотрудник не найден");

  db.prepare(
    `INSERT INTO adjustments (employee_id, venue_id, kind, amount, reason, date, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(employeeId, employee.venue_id, kind, amount, reasonValue.trim(), date, user.id);

  revalidatePath(`/staff/${employeeId}`);
}
