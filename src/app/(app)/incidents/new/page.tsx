import { requireUser } from "@/lib/auth";
import { nowISO } from "@/lib/format";
import { listEmployees, listIncidentTypes, listVenues } from "@/lib/queries";
import { IncidentForm } from "./IncidentForm";

export default async function NewIncidentPage() {
  await requireUser();
  const now = nowISO();

  return (
    <>
      <div className="page-head">
        <div className="kicker kicker--red">// Дисциплина</div>
        <h1>Зафиксировать нарушение</h1>
      </div>

      <div className="card card--framed">
        <IncidentForm
          venues={listVenues()}
          employees={listEmployees()}
          incidentTypes={listIncidentTypes()}
          initialDate={now.slice(0, 10)}
          initialTime={now.slice(11, 16)}
        />
      </div>
    </>
  );
}
