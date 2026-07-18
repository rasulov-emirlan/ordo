"use client";

import { useState } from "react";
import type { Employee, IncidentType, Venue } from "@/lib/queries";
import { createManualIncidentAction } from "./actions";

export function IncidentForm({
  venues,
  employees,
  incidentTypes,
  initialDate,
  initialTime,
}: {
  venues: Venue[];
  employees: Employee[];
  incidentTypes: IncidentType[];
  initialDate: string;
  initialTime: string;
}) {
  const [venueId, setVenueId] = useState(venues[0]?.id ?? 0);
  const venueEmployees = employees.filter((employee) => employee.venue_id === venueId);

  return (
    <form action={createManualIncidentAction}>
      <div className="form-row">
        <label className="field">
          <span className="field__label">Заведение</span>
          <select
            className="select"
            name="venue_id"
            value={venueId || ""}
            onChange={(event) => setVenueId(Number(event.target.value))}
            required
          >
            {venues.length === 0 && <option value="">Нет доступных заведений</option>}
            {venues.map((venue) => (
              <option key={venue.id} value={venue.id}>
                {venue.name} · {venue.city}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field__label">Сотрудник</span>
          <select className="select" name="employee_id" defaultValue="">
            <option value="">Не определён</option>
            {venueEmployees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name} · {employee.position}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="field">
        <span className="field__label">Тип нарушения</span>
        <select className="select" name="type_code" required defaultValue={incidentTypes[0]?.code}>
          {incidentTypes.map((type) => (
            <option key={type.code} value={type.code}>
              {type.title} · {type.default_fine.toLocaleString("ru-RU")} сом
            </option>
          ))}
        </select>
      </label>

      <div className="form-row">
        <label className="field">
          <span className="field__label">Дата</span>
          <input className="input" name="date" type="date" defaultValue={initialDate} required />
        </label>
        <label className="field">
          <span className="field__label">Время</span>
          <input className="input" name="time" type="time" defaultValue={initialTime} required />
        </label>
        <label className="field">
          <span className="field__label">Сумма удержания, сом</span>
          <input
            className="input"
            name="suggested_fine"
            type="number"
            min="0"
            step="1"
            placeholder="По умолчанию для типа"
          />
        </label>
      </div>

      <label className="field">
        <span className="field__label">Заметка</span>
        <textarea className="textarea" name="note" rows={4} />
      </label>

      <div className="actions">
        <button className="btn btn--danger" type="submit" disabled={!venues.length || !incidentTypes.length}>
          Зафиксировать нарушение
        </button>
        <a className="btn btn--ghost" href="/incidents">
          Отмена
        </a>
      </div>
    </form>
  );
}
