import { NextRequest, NextResponse } from "next/server";
import { verifyApiKey } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ensureSeeded } from "@/lib/bootstrap";

/**
 * Вебхук счётчика посетителей (камера входа / ИК-датчик / турникет).
 *
 * POST /api/integrations/visits
 * Authorization: Bearer <api-key>
 * { "venue_id": 1, "count": 3, "ts": "2026-07-18T14:32:00" }  // count и ts опциональны
 */
export async function POST(req: NextRequest) {
  ensureSeeded();
  const key = verifyApiKey(req.headers.get("authorization"));
  if (!key) return NextResponse.json({ error: "Недействительный API-ключ" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const venueId = Number(body.venue_id);
  if (!venueId) return NextResponse.json({ error: "venue_id обязателен" }, { status: 400 });
  if (key.venue_id != null && key.venue_id !== venueId) {
    return NextResponse.json({ error: "Ключ не имеет доступа к этому заведению" }, { status: 403 });
  }
  const venue = getDb().prepare("SELECT id FROM venues WHERE id = ?").get(venueId);
  if (!venue) return NextResponse.json({ error: "Заведение не найдено" }, { status: 404 });

  const count = Math.max(1, Number(body.count ?? 1));
  const ts = String(body.ts ?? new Date().toISOString().slice(0, 19));
  getDb()
    .prepare("INSERT INTO visits (venue_id, ts, count, source) VALUES (?, ?, ?, 'api')")
    .run(venueId, ts, count);
  return NextResponse.json({ ok: true });
}
