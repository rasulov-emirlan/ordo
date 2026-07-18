import { getDb } from "./db";

export type Venue = {
  id: number;
  name: string;
  address: string;
  city: string;
  opens_at: string;
  closes_at: string;
};

export type Employee = {
  id: number;
  venue_id: number;
  name: string;
  phone: string;
  position: string;
  salary_type: "monthly" | "per_shift" | "hourly";
  salary_rate: number;
  hired_at: string;
  status: "active" | "inactive";
  notes: string;
};

export type Camera = {
  id: number;
  venue_id: number;
  name: string;
  stream_url: string;
  zone: string;
  is_entrance: number;
  detector_enabled: number;
};

export function listVenues(): Venue[] {
  return getDb().prepare("SELECT * FROM venues ORDER BY id").all() as Venue[];
}

export function getVenue(id: number): Venue | undefined {
  return getDb().prepare("SELECT * FROM venues WHERE id = ?").get(id) as Venue | undefined;
}

export function listEmployees(venueId?: number, includeInactive = false): Employee[] {
  const where: string[] = [];
  const params: unknown[] = [];
  if (venueId) {
    where.push("venue_id = ?");
    params.push(venueId);
  }
  if (!includeInactive) where.push("status = 'active'");
  return getDb()
    .prepare(
      `SELECT * FROM employees ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY position, name`
    )
    .all(...params) as Employee[];
}

export function getEmployee(id: number): Employee | undefined {
  return getDb().prepare("SELECT * FROM employees WHERE id = ?").get(id) as Employee | undefined;
}

export function listCameras(venueId?: number): Camera[] {
  if (venueId) {
    return getDb().prepare("SELECT * FROM cameras WHERE venue_id = ? ORDER BY id").all(venueId) as Camera[];
  }
  return getDb().prepare("SELECT * FROM cameras ORDER BY venue_id, id").all() as Camera[];
}

export function getCamera(id: number): Camera | undefined {
  return getDb().prepare("SELECT * FROM cameras WHERE id = ?").get(id) as Camera | undefined;
}

export type IncidentType = {
  id: number;
  code: string;
  title: string;
  default_fine: number;
  severity: "info" | "warn" | "critical";
  detectable: number;
  description: string;
};

export function listIncidentTypes(): IncidentType[] {
  return getDb().prepare("SELECT * FROM incident_types ORDER BY default_fine DESC").all() as IncidentType[];
}

export type Product = {
  id: number;
  name: string;
  category: string;
  price: number;
  cost: number;
  active: number;
};

export function listProducts(activeOnly = true): Product[] {
  return getDb()
    .prepare(`SELECT * FROM products ${activeOnly ? "WHERE active = 1" : ""} ORDER BY category, name`)
    .all() as Product[];
}
