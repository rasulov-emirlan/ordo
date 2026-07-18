import { NextRequest, NextResponse } from "next/server";
import { verifyApiKey } from "@/lib/auth";
import { createIncident } from "@/lib/incidents";
import { getDb } from "@/lib/db";
import { ensureSeeded } from "@/lib/bootstrap";

/**
 * Вебхук видеоаналитики: внешний детектор (edge-бокс, Ivideon, Trassir и т.п.)
 * присылает событие — оно попадает в очередь инцидентов на рассмотрение.
 *
 * POST /api/integrations/detections
 * Authorization: Bearer <api-key>
 * {
 *   "camera_id": 3,            // ID камеры в Ordo
 *   "type": "sleeping",        // код типа инцидента (см. /settings)
 *   "occurred_at": "2026-07-18T14:32:00",  // локальное время, опционально
 *   "confidence": 0.87,        // 0..1, опционально
 *   "employee_id": 5,          // опционально, если детектор распознал сотрудника
 *   "note": "..."              // опционально
 * }
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

  const cameraId = Number(body.camera_id);
  const type = String(body.type ?? "");
  if (!cameraId || !type) {
    return NextResponse.json({ error: "camera_id и type обязательны" }, { status: 400 });
  }

  const camera = getDb()
    .prepare("SELECT id, venue_id, detector_enabled FROM cameras WHERE id = ?")
    .get(cameraId) as { id: number; venue_id: number; detector_enabled: number } | undefined;
  if (!camera) return NextResponse.json({ error: "Камера не найдена" }, { status: 404 });
  if (key.venue_id != null && key.venue_id !== camera.venue_id) {
    return NextResponse.json({ error: "Ключ не имеет доступа к этому заведению" }, { status: 403 });
  }
  if (!camera.detector_enabled) {
    return NextResponse.json({ ok: false, skipped: "Детекция для камеры выключена" });
  }

  try {
    const id = createIncident({
      venue_id: camera.venue_id,
      camera_id: camera.id,
      employee_id: body.employee_id ? Number(body.employee_id) : null,
      type_code: type,
      source: "api",
      occurred_at: String(body.occurred_at ?? new Date().toISOString().slice(0, 19)),
      confidence: body.confidence != null ? Number(body.confidence) : null,
      note: String(body.note ?? "Событие от внешней видеоаналитики"),
    });
    return NextResponse.json({ ok: true, incident_id: id });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
