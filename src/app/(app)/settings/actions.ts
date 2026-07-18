"use server";

import crypto from "node:crypto";
import { hashPassword, requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function createUser(formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const login = String(formData.get("login") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const roleValue = String(formData.get("role") ?? "");
  const role = roleValue === "owner" || roleValue === "manager" ? roleValue : null;
  const venueValue = String(formData.get("venue_id") ?? "");
  const requestedVenueId = venueValue ? Number(venueValue) : null;

  if (!name || !login || password.length < 6 || !role) return;
  if (getDb().prepare("SELECT id FROM users WHERE login = ?").get(login)) return;

  let venueId: number | null = null;
  if (role === "manager" && Number.isInteger(requestedVenueId) && Number(requestedVenueId) > 0) {
    const venue = getDb().prepare("SELECT id FROM venues WHERE id = ?").get(requestedVenueId) as
      | { id: number }
      | undefined;
    venueId = venue?.id ?? null;
  }

  getDb()
    .prepare(
      "INSERT INTO users (name, login, password_hash, role, venue_id) VALUES (?, ?, ?, ?, ?)"
    )
    .run(name, login, hashPassword(password), role, venueId);

  revalidatePath("/settings");
  void user;
}

export async function updateIncidentFine(formData: FormData) {
  const user = await requireUser();
  const id = Number(formData.get("id"));
  const amount = Number(formData.get("default_fine"));
  if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(amount) || amount < 0) return;

  getDb().prepare("UPDATE incident_types SET default_fine = ? WHERE id = ?").run(amount, id);
  revalidatePath("/settings");
  void user;
}

export async function createApiKey(formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const venueValue = String(formData.get("venue_id") ?? "");
  const requestedVenueId = venueValue ? Number(venueValue) : null;
  if (!name) return;

  let venueId: number | null = null;
  if (Number.isInteger(requestedVenueId) && Number(requestedVenueId) > 0) {
    const venue = getDb().prepare("SELECT id FROM venues WHERE id = ?").get(requestedVenueId) as
      | { id: number }
      | undefined;
    venueId = venue?.id ?? null;
  }

  const token = `ordo_${crypto.randomBytes(24).toString("base64url")}`;
  getDb()
    .prepare("INSERT INTO api_keys (name, token, venue_id) VALUES (?, ?, ?)")
    .run(name, token, venueId);

  revalidatePath("/settings");
  void user;
}

export async function revokeApiKey(formData: FormData) {
  const user = await requireUser();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;

  getDb().prepare("DELETE FROM api_keys WHERE id = ?").run(id);
  revalidatePath("/settings");
  void user;
}
