"use server";

import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  approveIncident as approveIncidentRecord,
  dismissIncident as dismissIncidentRecord,
} from "@/lib/incidents";
import { revalidatePath } from "next/cache";

function positiveInteger(value: FormDataEntryValue | null, field: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Некорректное значение поля «${field}»`);
  }
  return parsed;
}

export async function approveIncidentAction(formData: FormData) {
  const user = await requireUser();
  const incidentId = positiveInteger(formData.get("incident_id"), "инцидент");
  const employeeValue = String(formData.get("employee_id") ?? "").trim();
  const amountValue = String(formData.get("fine_amount") ?? "").trim();
  const employeeId = employeeValue
    ? positiveInteger(formData.get("employee_id"), "сотрудник")
    : undefined;
  const fineAmount = amountValue === "" ? undefined : Number(amountValue);

  if (fineAmount !== undefined && (!Number.isInteger(fineAmount) || fineAmount < 0)) {
    throw new Error("Сумма удержания должна быть целым неотрицательным числом");
  }

  if (employeeId !== undefined) {
    const employee = getDb()
      .prepare(
        `SELECT e.id
         FROM employees e
         JOIN incidents i ON i.venue_id = e.venue_id
         WHERE e.id = ? AND i.id = ? AND e.status = 'active'`
      )
      .get(employeeId, incidentId);
    if (!employee) throw new Error("Выбранный сотрудник не работает в этой точке");
  }

  approveIncidentRecord({
    incidentId,
    userId: user.id,
    fineAmount,
    employeeId,
  });
  revalidatePath("/incidents");
}

export async function dismissIncidentAction(formData: FormData) {
  const user = await requireUser();
  const incidentId = positiveInteger(formData.get("incident_id"), "инцидент");

  dismissIncidentRecord(incidentId, user.id);
  revalidatePath("/incidents");
}
