import { notFound } from "next/navigation";
import { HlsPlayer } from "@/components/HlsPlayer";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { fmtDateTime, som } from "@/lib/format";
import { getCamera, getVenue } from "@/lib/queries";
import { createTestEventAction, toggleDetectorAction } from "./actions";

type CameraIncident = {
  id: number;
  occurred_at: string;
  type_title: string;
  employee_name: string | null;
  status: "pending" | "approved" | "dismissed";
  suggested_fine: number;
  fine_amount: number | null;
};

const STATUS_LABELS: Record<CameraIncident["status"], string> = {
  pending: "В очереди",
  approved: "Утверждён",
  dismissed: "Отклонён",
};

function incidentAmount(incident: CameraIncident): string {
  if (incident.status === "dismissed") return "—";
  if (incident.status === "approved") return som(incident.fine_amount ?? 0);
  return som(incident.suggested_fine);
}

export default async function CameraPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const cameraId = Number(id);
  if (!Number.isInteger(cameraId) || cameraId <= 0) notFound();

  const camera = getCamera(cameraId);
  if (!camera) notFound();
  const venue = getVenue(camera.venue_id);
  if (!venue) notFound();

  const incidents = getDb()
    .prepare(
      `SELECT i.id, i.occurred_at, t.title AS type_title, e.name AS employee_name,
              i.status, i.suggested_fine, i.fine_amount
       FROM incidents i
       JOIN incident_types t ON t.id = i.type_id
       LEFT JOIN employees e ON e.id = i.employee_id
       WHERE i.camera_id = ?
       ORDER BY i.occurred_at DESC
       LIMIT 100`
    )
    .all(camera.id) as CameraIncident[];

  return (
    <>
      <div className="page-head">
        <div className="kicker kicker--red">// Видеонаблюдение</div>
        <h1>{camera.name}</h1>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="cam-tile">
            <HlsPlayer src={camera.stream_url} />
            <span className="cam-tile__label">
              {camera.name} · {camera.zone}
              {camera.detector_enabled ? <span className="cam-tile__live"> ● AI</span> : null}
            </span>
          </div>
        </div>

        <div className="card">
          <div className="kicker mb-1">Свойства камеры</div>
          <p>
            <strong>Заведение:</strong> {venue.name}
          </p>
          <p>
            <strong>Зона:</strong> {camera.zone}
          </p>
          <p>
            <strong>Поток:</strong>{" "}
            <span className="mono small" style={{ overflowWrap: "anywhere" }}>
              {camera.stream_url || "не настроен"}
            </span>
          </p>
          <div className="actions mb-1">
            <span className={`badge${camera.is_entrance ? " badge--ink" : ""}`}>
              Счётчик входа: {camera.is_entrance ? "да" : "нет"}
            </span>
            <span className={`badge${camera.detector_enabled ? " badge--red" : ""}`}>
              AI: {camera.detector_enabled ? "включён" : "выключен"}
            </span>
          </div>
          <form action={toggleDetectorAction}>
            <input type="hidden" name="camera_id" value={camera.id} />
            <button className="btn btn--ghost" type="submit">
              Детекция: {camera.detector_enabled ? "вкл" : "выкл"}
            </button>
          </form>
        </div>
      </div>

      <div className="card mt-2">
        <div className="flex-between mb-1">
          <div className="kicker">Последние события</div>
          <form action={createTestEventAction}>
            <input type="hidden" name="camera_id" value={camera.id} />
            <button className="btn btn--sm" type="submit">
              ▶ Тестовое событие
            </button>
          </form>
        </div>
        <p className="muted small">эмуляция события видеоаналитики для демо</p>

        {incidents.length === 0 ? (
          <p className="muted small mt-1">
            Событий пока нет — создайте тестовое событие для проверки.
          </p>
        ) : (
          <div className="table-wrap mt-1">
            <table className="table">
              <thead>
                <tr>
                  <th>Время</th>
                  <th>Тип</th>
                  <th>Сотрудник</th>
                  <th>Статус</th>
                  <th className="num">Сумма</th>
                </tr>
              </thead>
              <tbody>
                {incidents.map((incident) => (
                  <tr key={incident.id}>
                    <td>{fmtDateTime(incident.occurred_at)}</td>
                    <td>{incident.type_title}</td>
                    <td>{incident.employee_name ?? "—"}</td>
                    <td>
                      <span
                        className={`badge${
                          incident.status === "pending" ? " badge--red" : ""
                        }`}
                      >
                        {STATUS_LABELS[incident.status]}
                      </span>
                    </td>
                    <td className="num">{incidentAmount(incident)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card mt-2">
        <h3>Как подключить свою аналитику</h3>
        <p className="small">
          Отправляйте события вебхуком <span className="mono">POST /api/integrations/detections</span>.
        </p>
        <p className="small">
          Передавайте API-ключ из Настроек в заголовке <span className="mono">Authorization: Bearer</span>.
        </p>
        <p className="small">
          RTSP-потоки камер конвертируются в HLS через go2rtc или MediaMTX на площадке.
        </p>
      </div>
    </>
  );
}
