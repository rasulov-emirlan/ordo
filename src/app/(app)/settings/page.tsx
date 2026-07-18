import { logoutAction } from "@/app/login/actions";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { fmtDate, som } from "@/lib/format";
import { listIncidentTypes, listVenues } from "@/lib/queries";
import {
  createApiKey,
  createUser,
  revokeApiKey,
  updateIncidentFine,
} from "./actions";

type UserRow = {
  id: number;
  name: string;
  login: string;
  role: "owner" | "manager";
  venue_name: string | null;
};

type ApiKeyRow = {
  id: number;
  name: string;
  token: string;
  venue_name: string | null;
  created_at: string;
};

const ROLE_LABELS = {
  owner: "владелец",
  manager: "менеджер",
} as const;

const SEVERITY_LABELS = {
  info: "информация",
  warn: "предупреждение",
  critical: "критично",
} as const;

export default async function SettingsPage() {
  const user = await requireUser();
  const venues = listVenues();
  const incidentTypes = listIncidentTypes();
  const users = getDb()
    .prepare(
      `SELECT u.id, u.name, u.login, u.role, v.name AS venue_name
       FROM users u LEFT JOIN venues v ON v.id = u.venue_id
       ORDER BY CASE u.role WHEN 'owner' THEN 0 ELSE 1 END, u.name`
    )
    .all() as UserRow[];
  const apiKeys = getDb()
    .prepare(
      `SELECT k.id, k.name, k.token, k.created_at, v.name AS venue_name
       FROM api_keys k LEFT JOIN venues v ON v.id = k.venue_id
       ORDER BY k.created_at DESC, k.id DESC`
    )
    .all() as ApiKeyRow[];

  return (
    <>
      <div className="page-head">
        <div className="kicker kicker--red">// Система</div>
        <h1>Настройки</h1>
      </div>

      <div className="card card--framed">
        <div className="page-head__row">
          <div>
            <div className="kicker">Профиль</div>
            <h2>{user.name}</h2>
            <div className="small">
              <span className="mono">{user.login}</span> · {ROLE_LABELS[user.role]}
            </div>
          </div>
          <form action={logoutAction}>
            <button className="btn btn--ghost" type="submit">Выйти</button>
          </form>
        </div>
      </div>

      <div className="card mt-1">
        <div className="kicker mb-1">Пользователи</div>
        <div className="table-wrap mb-1">
          <table className="table">
            <thead>
              <tr>
                <th>Имя</th>
                <th>Логин</th>
                <th>Роль</th>
                <th>Точка</th>
              </tr>
            </thead>
            <tbody>
              {users.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td className="mono">{row.login}</td>
                  <td>{ROLE_LABELS[row.role]}</td>
                  <td>{row.venue_name ?? "все"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <form action={createUser}>
          <h3>Добавить пользователя</h3>
          <div className="form-row">
            <label className="field">
              <span className="field__label">Имя</span>
              <input className="input" name="name" required />
            </label>
            <label className="field">
              <span className="field__label">Логин</span>
              <input autoComplete="off" className="input" name="login" required />
            </label>
            <label className="field">
              <span className="field__label">Пароль</span>
              <input autoComplete="new-password" className="input" minLength={6} name="password" required type="password" />
            </label>
          </div>
          <div className="form-row">
            <label className="field">
              <span className="field__label">Роль</span>
              <select className="select" defaultValue="manager" name="role">
                <option value="manager">Менеджер</option>
                <option value="owner">Владелец</option>
              </select>
            </label>
            <label className="field">
              <span className="field__label">Точка менеджера</span>
              <select className="select" defaultValue="" name="venue_id">
                <option value="">Все точки</option>
                {venues.map((venue) => (
                  <option key={venue.id} value={venue.id}>{venue.name}</option>
                ))}
              </select>
            </label>
          </div>
          <button className="btn" type="submit">Добавить</button>
        </form>
      </div>

      <div className="card mt-1">
        <div className="kicker mb-1">Типы нарушений</div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Название</th>
                <th>Код</th>
                <th>Удержание по умолчанию</th>
                <th>Важность</th>
                <th className="num">Детектируется</th>
              </tr>
            </thead>
            <tbody>
              {incidentTypes.map((type) => (
                <tr key={type.id}>
                  <td>{type.title}</td>
                  <td className="mono">{type.code}</td>
                  <td>
                    <form action={updateIncidentFine} className="actions">
                      <input name="id" type="hidden" value={type.id} />
                      <input
                        aria-label={`Удержание: ${type.title}`}
                        className="input"
                        defaultValue={type.default_fine}
                        min={0}
                        name="default_fine"
                        required
                        step={1}
                        type="number"
                      />
                      <button className="btn btn--sm" type="submit">Сохранить</button>
                    </form>
                  </td>
                  <td>
                    <span className={`badge${type.severity === "critical" ? " badge--red" : type.severity === "warn" ? " badge--ink" : ""}`}>
                      {SEVERITY_LABELS[type.severity]}
                    </span>
                  </td>
                  <td className="num">{type.detectable ? "●" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card mt-1">
        <div className="kicker mb-1">API-ключи</div>
        {apiKeys.length === 0 ? (
          <p className="muted small">API-ключей нет — создайте ключ для интеграции.</p>
        ) : (
          <div className="table-wrap mb-1">
            <table className="table">
              <thead>
                <tr>
                  <th>Название</th>
                  <th>Токен</th>
                  <th>Точка</th>
                  <th>Дата</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {apiKeys.map((key) => (
                  <tr key={key.id}>
                    <td>{key.name}</td>
                    <td className="mono small">{key.token}</td>
                    <td>{key.venue_name ?? "все"}</td>
                    <td>{fmtDate(key.created_at)}</td>
                    <td className="num">
                      <form action={revokeApiKey}>
                        <input name="id" type="hidden" value={key.id} />
                        <button className="btn btn--danger btn--sm" type="submit">Отозвать</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <form action={createApiKey}>
          <h3>Создать ключ</h3>
          <div className="form-row">
            <label className="field">
              <span className="field__label">Название</span>
              <input className="input" name="name" required />
            </label>
            <label className="field">
              <span className="field__label">Точка</span>
              <select className="select" defaultValue="" name="venue_id">
                <option value="">Все точки</option>
                {venues.map((venue) => (
                  <option key={venue.id} value={venue.id}>{venue.name}</option>
                ))}
              </select>
            </label>
          </div>
          <button className="btn" type="submit">Создать API-ключ</button>
        </form>
      </div>

      <div className="card mt-1">
        <div className="kicker kicker--red">Интеграции</div>
        <h2>Подключения</h2>
        <p>
          <strong>Вебхуки Ordo.</strong>{" "}
          <span className="mono">POST /api/integrations/detections</span> принимает события
          видеоаналитики, <span className="mono">POST /api/integrations/visits</span> — данные
          счётчика посетителей. Авторизация: Bearer API-ключ.
        </p>
        <p>
          <strong>POS.</strong> Импорт продаж из Poster по API — в разработке; iiko Cloud API — в плане.
        </p>
        <p>
          <strong>Камеры.</strong> RTSP-потоки Hikvision/Dahua переводятся в HLS через
          go2rtc/MediaMTX; Hikvision ISAPI people counting отправляет посещения в вебхук visits.
        </p>
        <p>
          <strong>Фискализация.</strong> Ordo не является ККМ; чеки оформляются в О!Касса,
          eKassa или через POS.
        </p>
      </div>

      <div className="card mt-1">
        <div className="kicker kicker--red">Правовая справка · КР</div>
        <h2>Удержания и ответственность</h2>
        <p>
          Денежные штрафы не являются дисциплинарным взысканием по ТК КР в редакции 2025 года.
          Ordo оформляет удержания как депремирование: нужен локальный акт о премировании, приказ
          по каждому случаю и ознакомление сотрудника.
        </p>
        <p className="mb-1">
          Материальная ответственность, включая недостачу, оформляется отдельно и требует
          документированного ущерба.
        </p>
        <div className="small muted">Справка носит информационный характер и не заменяет консультацию юриста.</div>
      </div>
    </>
  );
}
