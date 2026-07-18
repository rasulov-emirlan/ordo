import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), "data", "ordo.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}

function migrate(db: Database.Database) {
  db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    login TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('owner','manager')),
    venue_id INTEGER REFERENCES venues(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS venues (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT NOT NULL DEFAULT '',
    city TEXT NOT NULL DEFAULT 'Бишкек',
    opens_at TEXT NOT NULL DEFAULT '08:00',
    closes_at TEXT NOT NULL DEFAULT '22:00',
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY,
    venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    position TEXT NOT NULL DEFAULT 'Бариста',
    salary_type TEXT NOT NULL DEFAULT 'per_shift'
      CHECK (salary_type IN ('monthly','per_shift','hourly')),
    salary_rate INTEGER NOT NULL DEFAULT 0, -- сом: в месяц / за смену / в час
    hired_at TEXT NOT NULL DEFAULT (date('now','localtime')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
    notes TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS shifts (
    id INTEGER PRIMARY KEY,
    venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    date TEXT NOT NULL,          -- YYYY-MM-DD
    start_time TEXT NOT NULL,    -- HH:MM
    end_time TEXT NOT NULL,      -- HH:MM
    status TEXT NOT NULL DEFAULT 'scheduled'
      CHECK (status IN ('scheduled','done','missed','sick'))
  );
  CREATE INDEX IF NOT EXISTS idx_shifts_venue_date ON shifts(venue_id, date);
  CREATE INDEX IF NOT EXISTS idx_shifts_employee ON shifts(employee_id, date);

  CREATE TABLE IF NOT EXISTS incident_types (
    id INTEGER PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    default_fine INTEGER NOT NULL DEFAULT 0, -- сом
    severity TEXT NOT NULL DEFAULT 'warn' CHECK (severity IN ('info','warn','critical')),
    detectable INTEGER NOT NULL DEFAULT 0,   -- может ли прилетать из видеоаналитики
    description TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS cameras (
    id INTEGER PRIMARY KEY,
    venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    stream_url TEXT NOT NULL DEFAULT '',  -- HLS (.m3u8); RTSP конвертируется на месте (go2rtc/MediaMTX)
    zone TEXT NOT NULL DEFAULT 'зал' CHECK (zone IN ('вход','касса','зал','кухня','склад')),
    is_entrance INTEGER NOT NULL DEFAULT 0, -- участвует в подсчёте посетителей
    detector_enabled INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS incidents (
    id INTEGER PRIMARY KEY,
    venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
    type_id INTEGER NOT NULL REFERENCES incident_types(id),
    source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','camera','api')),
    camera_id INTEGER REFERENCES cameras(id) ON DELETE SET NULL,
    occurred_at TEXT NOT NULL,   -- ISO local
    note TEXT NOT NULL DEFAULT '',
    confidence REAL,             -- 0..1 для camera/api
    suggested_fine INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','dismissed')),
    fine_amount INTEGER,         -- итоговая сумма при approve
    decided_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    decided_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
  CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status, venue_id);

  -- Единый журнал начислений/удержаний: штрафы, премии, авансы.
  CREATE TABLE IF NOT EXISTS adjustments (
    id INTEGER PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('fine','bonus','advance')),
    amount INTEGER NOT NULL,     -- сом, всегда положительное; знак определяет kind
    reason TEXT NOT NULL DEFAULT '',
    incident_id INTEGER REFERENCES incidents(id) ON DELETE SET NULL,
    date TEXT NOT NULL,          -- YYYY-MM-DD
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
  CREATE INDEX IF NOT EXISTS idx_adjustments_employee ON adjustments(employee_id, date);

  CREATE TABLE IF NOT EXISTS visits (
    id INTEGER PRIMARY KEY,
    venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    ts TEXT NOT NULL,            -- ISO local
    count INTEGER NOT NULL DEFAULT 1,
    source TEXT NOT NULL DEFAULT 'camera' CHECK (source IN ('camera','manual','api'))
  );
  CREATE INDEX IF NOT EXISTS idx_visits_venue_ts ON visits(venue_id, ts);

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Кофе',
    price INTEGER NOT NULL,      -- сом
    cost INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY,
    venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
    ts TEXT NOT NULL,            -- ISO local
    total INTEGER NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'cash'
      CHECK (payment_method IN ('cash','card','qr'))
  );
  CREATE INDEX IF NOT EXISTS idx_sales_venue_ts ON sales(venue_id, ts);

  CREATE TABLE IF NOT EXISTS sale_items (
    id INTEGER PRIMARY KEY,
    sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    qty INTEGER NOT NULL DEFAULT 1,
    price INTEGER NOT NULL       -- цена на момент продажи
  );

  -- Ключи для внешних интеграций (видеоаналитика, счётчики, POS-вебхуки).
  CREATE TABLE IF NOT EXISTS api_keys (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    venue_id INTEGER REFERENCES venues(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
  `);

  seedIncidentTypes(db);
}

function seedIncidentTypes(db: Database.Database) {
  const count = db.prepare("SELECT COUNT(*) AS c FROM incident_types").get() as { c: number };
  if (count.c > 0) return;
  const ins = db.prepare(
    `INSERT INTO incident_types (code, title, default_fine, severity, detectable, description)
     VALUES (@code, @title, @fine, @severity, @detectable, @description)`
  );
  const types = [
    { code: "sleeping", title: "Сон на рабочем месте", fine: 1000, severity: "critical", detectable: 1, description: "Сотрудник спит в рабочее время" },
    { code: "phone", title: "Телефон за стойкой", fine: 300, severity: "warn", detectable: 1, description: "Личный телефон в рабочей зоне при гостях" },
    { code: "absence", title: "Отсутствие на рабочем месте", fine: 500, severity: "warn", detectable: 1, description: "Рабочая зона пустует более 10 минут в часы работы" },
    { code: "rudeness", title: "Грубость / мат при госте", fine: 1500, severity: "critical", detectable: 0, description: "Нецензурная лексика или грубое обращение с гостем" },
    { code: "late", title: "Опоздание на смену", fine: 300, severity: "warn", detectable: 1, description: "Приход позже начала смены более чем на 15 минут" },
    { code: "no_receipt", title: "Продажа мимо кассы", fine: 2000, severity: "critical", detectable: 1, description: "Приём оплаты без пробития чека" },
    { code: "smoking", title: "Курение в неположенном месте", fine: 500, severity: "warn", detectable: 1, description: "Курение в зоне видимости гостей или на кухне" },
    { code: "dress_code", title: "Нарушение формы", fine: 200, severity: "info", detectable: 0, description: "Отсутствие формы/фартука/бейджа" },
    { code: "sanitation", title: "Нарушение санитарии", fine: 500, severity: "warn", detectable: 0, description: "Грязная рабочая зона, нарушение норм хранения" },
    { code: "cash_shortage", title: "Недостача в кассе", fine: 0, severity: "critical", detectable: 0, description: "Расхождение кассы при пересменке (сумма = размер недостачи)" },
  ];
  const tx = db.transaction(() => {
    for (const t of types) ins.run(t);
  });
  tx();
}
