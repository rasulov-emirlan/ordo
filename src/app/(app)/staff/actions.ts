"use server";

import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { revalidatePath } from "next/cache";

const SALARY_TYPES = new Set(["monthly", "per_shift", "hourly"]);

function requiredText(formData: FormData, name: string): string {
  const value = formData.get(name);
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Поле ${name} обязательно`);
  }
  return value.trim();
}

function positiveId(formData: FormData, name: string): number {
  const value = Number(formData.get(name));
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Некорректное поле ${name}`);
  }
  return value;
}

export async function createEmployee(formData: FormData) {
  const user = await requireUser();
  void user;

  const name = requiredText(formData, "name");
  const phone = requiredText(formData, "phone");
  const position = requiredText(formData, "position");
  const venueId = positiveId(formData, "venueId");
  const salaryType = requiredText(formData, "salaryType");
  const salaryRate = Number(formData.get("salaryRate"));

  if (!SALARY_TYPES.has(salaryType)) {
    throw new Error("Некорректный тип оплаты");
  }
  if (!Number.isInteger(salaryRate) || salaryRate < 0) {
    throw new Error("Ставка должна быть целым неотрицательным числом");
  }

  const db = getDb();
  const venue = db.prepare("SELECT id FROM venues WHERE id = ?").get(venueId);
  if (!venue) throw new Error("Заведение не найдено");

  db.prepare(
    `INSERT INTO employees (venue_id, name, phone, position, salary_type, salary_rate)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(venueId, name, phone, position, salaryType, salaryRate);

  revalidatePath("/staff");
  revalidatePath("/roster");
}

export async function toggleEmployeeStatus(formData: FormData) {
  const user = await requireUser();
  void user;

  const employeeId = positiveId(formData, "employeeId");
  const result = getDb()
    .prepare(
      `UPDATE employees
       SET status = CASE status WHEN 'active' THEN 'inactive' ELSE 'active' END
       WHERE id = ?`,
    )
    .run(employeeId);

  if (result.changes === 0) throw new Error("Сотрудник не найден");

  revalidatePath("/staff");
  revalidatePath(`/staff/${employeeId}`);
  revalidatePath("/roster");
}
