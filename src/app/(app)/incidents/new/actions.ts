"use server";

import { requireUser } from "@/lib/auth";
import { createIncident } from "@/lib/incidents";
import { getEmployee, getVenue, listIncidentTypes } from "@/lib/queries";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function positiveInteger(value: FormDataEntryValue | null, field: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Некорректное значение поля «${field}»`);
  }
  return parsed;
}

export async function createManualIncidentAction(formData: FormData) {
  const user = await requireUser();
  const venueId = positiveInteger(formData.get("venue_id"), "заведение");
  const employeeValue = String(formData.get("employee_id") ?? "").trim();
  const employeeId = employeeValue
    ? positiveInteger(formData.get("employee_id"), "сотрудник")
    : null;
  const typeCode = String(formData.get("type_code") ?? "").trim();
  const date = String(formData.get("date") ?? "").trim();
  const time = String(formData.get("time") ?? "").trim();
  const amountValue = String(formData.get("suggested_fine") ?? "").trim();
  const suggestedFine = amountValue === "" ? undefined : Number(amountValue);

  if (!getVenue(venueId)) throw new Error("Заведение не найдено");
  if (employeeId !== null) {
    const employee = getEmployee(employeeId);
    if (!employee || employee.venue_id !== venueId || employee.status !== "active") {
      throw new Error("Выбранный сотрудник не работает в этой точке");
    }
  }
  if (!listIncidentTypes().some((type) => type.code === typeCode)) {
    throw new Error("Тип нарушения не найден");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    throw new Error("Укажите корректные дату и время");
  }
  if (suggestedFine !== undefined && (!Number.isInteger(suggestedFine) || suggestedFine < 0)) {
    throw new Error("Сумма удержания должна быть целым неотрицательным числом");
  }

  createIncident({
    venue_id: venueId,
    employee_id: employeeId,
    type_code: typeCode,
    source: "manual",
    occurred_at: `${date}T${time}:00`,
    note: String(formData.get("note") ?? "").trim(),
    suggested_fine: suggestedFine,
  });

  void user;
  revalidatePath("/incidents");
  redirect("/incidents");
}
