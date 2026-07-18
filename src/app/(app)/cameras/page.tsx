import Link from "next/link";
import { HlsPlayer } from "@/components/HlsPlayer";
import { requireUser } from "@/lib/auth";
import { listCameras, listVenues } from "@/lib/queries";

export default async function CamerasPage() {
  await requireUser();
  const venues = listVenues();
  const cameras = listCameras();
  const venuesWithCameras = venues.filter((venue) =>
    cameras.some((camera) => camera.venue_id === venue.id)
  );

  return (
    <>
      <div className="page-head">
        <div className="kicker kicker--red">// Видеонаблюдение</div>
        <h1>Камеры</h1>
      </div>

      {cameras.length === 0 && (
        <div className="card">
          <p className="muted small">
            Камеры пока не подключены — добавьте поток в настройках площадки.
          </p>
        </div>
      )}

      {venuesWithCameras.map((venue, index) => (
        <section className={index === 0 ? "" : "mt-2"} key={venue.id}>
          <h3>{venue.name}</h3>
          <p className="muted small mb-1">
            {venue.address || venue.city}
            {venue.address && venue.city ? ` · ${venue.city}` : ""}
          </p>
          <div className="cam-grid">
            {cameras
              .filter((camera) => camera.venue_id === venue.id)
              .map((camera) => (
                <Link
                  href={`/cameras/${camera.id}`}
                  key={camera.id}
                  style={{ textDecoration: "none" }}
                >
                  <div className="cam-tile">
                    <HlsPlayer src={camera.stream_url} />
                    <span className="cam-tile__label">
                      {camera.name} · {camera.zone}
                      {camera.is_entrance ? " · счётчик" : ""}
                      {camera.detector_enabled ? (
                        <span className="cam-tile__live"> ● AI</span>
                      ) : null}
                    </span>
                  </div>
                </Link>
              ))}
          </div>
        </section>
      ))}
    </>
  );
}
