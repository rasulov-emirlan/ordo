"use server";

import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { nowISO } from "@/lib/format";
import { createIncident } from "@/lib/incidents";
import { getCamera } from "@/lib/queries";
import { revalidatePath } from "next/cache";

function cameraIdFrom(formData: FormData): number {
  const cameraId = Number(formData.get("camera_id"));
  if (!Number.isInteger(cameraId) || cameraId <= 0) {
    throw new Error("Некорректный идентификатор камеры");
  }
  return cameraId;
}

export async function toggleDetectorAction(formData: FormData) {
  const user = await requireUser();
  const cameraId = cameraIdFrom(formData);
  const result = getDb()
    .prepare(
      `UPDATE cameras
       SET detector_enabled = CASE detector_enabled WHEN 1 THEN 0 ELSE 1 END
       WHERE id = ?`
    )
    .run(cameraId);

  if (result.changes === 0) throw new Error("Камера не найдена");
  void user;
  revalidatePath("/cameras");
  revalidatePath(`/cameras/${cameraId}`);
}

export async function createTestEventAction(formData: FormData) {
  const user = await requireUser();
  const cameraId = cameraIdFrom(formData);
  const camera = getCamera(cameraId);
  if (!camera) throw new Error("Камера не найдена");

  const typeCodes = ["phone", "sleeping", "absence"] as const;
  const typeCode = typeCodes[Math.floor(Math.random() * typeCodes.length)];
  const confidence = Math.round((0.7 + Math.random() * 0.25) * 100) / 100;

  createIncident({
    venue_id: camera.venue_id,
    camera_id: camera.id,
    type_code: typeCode,
    source: "camera",
    occurred_at: nowISO(),
    confidence,
    note: "Тестовая детекция",
  });

  void user;
  revalidatePath("/incidents");
  revalidatePath(`/cameras/${cameraId}`);
}
