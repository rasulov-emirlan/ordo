import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { fmtDateTime, som } from "@/lib/format";
import { listIncidents, type IncidentRow } from "@/lib/incidents";
import { listEmployees, type Employee } from "@/lib/queries";
import { approveIncidentAction, dismissIncidentAction } from "./actions";

type IncidentStatus = "pending" | "approved" | "dismissed";

const STATUS_TABS: Array<{ value: IncidentStatus; label: string }> = [
  { value: "pending", label: "В очереди" },
  { value: "approved", label: "Утверждены" },
  { value: "dismissed", label: "Отклонены" },
];

const SOURCE_LABELS: Record<IncidentRow["source"], string> = {
  manual: "вручную",
  camera: "камера",
  api: "API",
};

const SEVERITY_LABELS: Record<IncidentRow["severity"], string> = {
  info: "информация",
  warn: "предупреждение",
  critical: "критично",
};

function sourceBadgeClass(source: IncidentRow["source"]): string {
  return "badge" + (source === "manual" ? "" : " badge--ink");
}

export default async function IncidentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireUser();
  const query = await searchParams;
  const status: IncidentStatus = STATUS_TABS.some((tab) => tab.value === query.status)
    ? (query.status as IncidentStatus)
    : "pending";
  const incidents = listIncidents({ status, limit: 100 });
  const counts = getDb()
    .prepare("SELECT status, COUNT(*) AS count FROM incidents GROUP BY status")
    .all() as Array<{ status: IncidentStatus; count: number }>;
  const countByStatus = new Map(counts.map((row) => [row.status, row.count]));
  const employeesByVenue = new Map<number, Employee[]>();

  if (status === "pending") {
    for (const incident of incidents) {
      if (!employeesByVenue.has(incident.venue_id)) {
        employeesByVenue.set(incident.venue_id, listEmployees(incident.venue_id));
      }
    }
  }

  return (
    <>
      <div className="page-head">
        <div className="page-head__row">
          <div>
            <div className="kicker kicker--red">// Дисциплина</div>
            <h1>Инциденты</h1>
          </div>
          <Link className="btn" href="/incidents/new">
            Зафиксировать нарушение
          </Link>
        </div>
      </div>

      <div className="actions mb-1">
        {STATUS_TABS.map((tab) => (
          <Link
            key={tab.value}
            className={`btn btn--sm${status === tab.value ? "" : " btn--ghost"}`}
            href={`/incidents?status=${tab.value}`}
          >
            {tab.label} · {countByStatus.get(tab.value) ?? 0}
          </Link>
        ))}
      </div>

      {incidents.length === 0 && (
        <div className="card">
          <p className="muted small">
            {status === "pending"
              ? "Очередь пуста — новые нарушения появятся здесь."
              : "В этом разделе пока нет инцидентов."}
          </p>
        </div>
      )}

      {status === "pending" &&
        incidents.map((incident) => (
          <div className="card" key={incident.id}>
            <div className="actions mb-1">
              <span className={sourceBadgeClass(incident.source)}>
                {SOURCE_LABELS[incident.source]}
              </span>
              <span className={`badge${incident.severity === "critical" ? " badge--red" : ""}`}>
                {SEVERITY_LABELS[incident.severity]}
              </span>
              {incident.confidence != null && (
                <span className="mono small">{Math.round(incident.confidence * 100)}%</span>
              )}
            </div>

            <h3>{incident.type_title}</h3>
            <p className="small">
              <strong>{incident.venue_name}</strong> · {incident.employee_name ?? "сотрудник не определён"} ·{" "}
              {fmtDateTime(incident.occurred_at)}
            </p>
            {incident.camera_name && (
              <p className="small muted">Камера: {incident.camera_name}</p>
            )}
            {incident.note && <p className="muted">{incident.note}</p>}

            <form className="mt-1" action={approveIncidentAction}>
              <input type="hidden" name="incident_id" value={incident.id} />
              <div className="form-row">
                <label className="field">
                  <span className="field__label">Сотрудник</span>
                  <select
                    className="select"
                    name="employee_id"
                    defaultValue={incident.employee_id ?? ""}
                  >
                    <option value="">Не определён</option>
                    {(employeesByVenue.get(incident.venue_id) ?? []).map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name} · {employee.position}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="field__label">Сумма удержания, сом</span>
                  <input
                    className="input"
                    name="fine_amount"
                    type="number"
                    min="0"
                    step="1"
                    defaultValue={incident.suggested_fine}
                  />
                </label>
              </div>
              <div className="actions">
                <button className="btn btn--danger" type="submit">
                  {incident.suggested_fine === 0
                    ? "Подтвердить без удержания"
                    : "Утвердить удержание"}
                </button>
                <button className="btn btn--ghost" formAction={dismissIncidentAction} type="submit">
                  Отклонить
                </button>
              </div>
            </form>
          </div>
        ))}

      {status !== "pending" && incidents.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Тип</th>
                <th>Точка</th>
                <th>Сотрудник</th>
                <th>Источник</th>
                <th className="num">Сумма</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((incident) => (
                <tr key={incident.id}>
                  <td>{fmtDateTime(incident.occurred_at)}</td>
                  <td>{incident.type_title}</td>
                  <td>{incident.venue_name}</td>
                  <td>{incident.employee_name ?? "—"}</td>
                  <td>
                    <span className={sourceBadgeClass(incident.source)}>
                      {SOURCE_LABELS[incident.source]}
                    </span>
                  </td>
                  <td className="num">
                    {incident.fine_amount == null ? "—" : som(incident.fine_amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="small muted mt-1">
        Удержания оформляются как депремирование (ТК КР 2025 не допускает денежные штрафы как
        взыскание). Шаблон приказа — в Настройках.
      </p>
    </>
  );
}
