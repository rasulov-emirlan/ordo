"use server";

import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { revalidatePath } from "next/cache";

function venueFields(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    address: String(formData.get("address") ?? "").trim(),
    city: String(formData.get("city") ?? "").trim(),
    opensAt: String(formData.get("opens_at") ?? "").trim(),
    closesAt: String(formData.get("closes_at") ?? "").trim(),
  };
}

function validTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export async function createVenue(formData: FormData) {
  const user = await requireUser();
  const fields = venueFields(formData);
  if (!fields.name || !fields.address || !fields.city) return;
  if (!validTime(fields.opensAt) || !validTime(fields.closesAt)) return;

  getDb()
    .prepare(
      `INSERT INTO venues (name, address, city, opens_at, closes_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(fields.name, fields.address, fields.city, fields.opensAt, fields.closesAt);

  revalidatePath("/venues");
  revalidatePath("/sales");
  revalidatePath("/stats");
  void user;
}

export async function updateVenue(formData: FormData) {
  const user = await requireUser();
  const id = Number(formData.get("id"));
  const fields = venueFields(formData);
  if (!Number.isInteger(id) || id <= 0) return;
  if (!fields.name || !fields.address || !fields.city) return;
  if (!validTime(fields.opensAt) || !validTime(fields.closesAt)) return;

  getDb()
    .prepare(
      `UPDATE venues SET name = ?, address = ?, city = ?, opens_at = ?, closes_at = ?
       WHERE id = ?`
    )
    .run(fields.name, fields.address, fields.city, fields.opensAt, fields.closesAt, id);

  revalidatePath("/venues");
  revalidatePath(`/venues/${id}`);
  revalidatePath("/sales");
  revalidatePath("/stats");
  void user;
}
