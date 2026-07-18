// Демо-данные: 3 заведения, персонал, смены, продажи, посетители, инциденты.
// Детерминированный PRNG — сид воспроизводим.
import type DatabaseT from "better-sqlite3";
import { getDb } from "./db";
import { hashPassword } from "./auth";
import { createIncident, approveIncident } from "./incidents";
import { addDays, localDateISO } from "./format";

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rnd = mulberry32(20260718);
const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];
const randInt = (min: number, max: number) => min + Math.floor(rnd() * (max - min + 1));

export function isSeeded(): boolean {
  const db = getDb();
  const r = db.prepare("SELECT COUNT(*) AS c FROM venues").get() as { c: number };
  return r.c > 0;
}

export function seed(): void {
  const db = getDb();
  if (isSeeded()) return;
  const tx = db.transaction(() => seedInner(db));
  tx();
}

function seedInner(db: DatabaseT.Database) {
  // --- владелец и менеджеры ---
  const owner = db
    .prepare("INSERT INTO users (login, password_hash, name, role) VALUES (?, ?, ?, 'owner')")
    .run("demo", hashPassword("demo2026"), "Азамат Эркинбеков");
  const ownerId = Number(owner.lastInsertRowid);

  // --- заведения ---
  const venues = [
    { name: "Ordo Coffee — Центр", address: "ул. Киевская 95", city: "Бишкек", opens_at: "08:00", closes_at: "22:00" },
    { name: "Ordo Coffee — Азия Молл", address: "пр. Чуй 158, ТРЦ Азия Молл", city: "Бишкек", opens_at: "10:00", closes_at: "22:00" },
    { name: "Ordo Coffee — Ош", address: "ул. Ленина 312", city: "Ош", opens_at: "08:00", closes_at: "21:00" },
  ].map((v) => {
    const r = db
      .prepare("INSERT INTO venues (name, address, city, opens_at, closes_at) VALUES (?, ?, ?, ?, ?)")
      .run(v.name, v.address, v.city, v.opens_at, v.closes_at);
    return { id: Number(r.lastInsertRowid), ...v };
  });

  db.prepare(
    "INSERT INTO users (login, password_hash, name, role, venue_id) VALUES (?, ?, ?, 'manager', ?)"
  ).run("aigerim", hashPassword("manager2026"), "Айгерим Садырова", venues[0].id);

  // --- персонал ---
  const names = [
    "Бакыт Асанов", "Айгуль Токтогулова", "Нурлан Жумабеков", "Чолпон Иманалиева",
    "Тимур Абдыкадыров", "Гульмира Осмонова", "Эрлан Мамытов", "Жылдыз Бекова",
    "Данияр Кулов", "Мээрим Айтматова", "Улан Сыдыков", "Назгуль Керимбаева",
    "Азиз Ташиев", "Салтанат Ниязова", "Кубан Алымкулов",
  ];
  const positions: Array<{ position: string; salary_type: "monthly" | "per_shift" | "hourly"; rate: [number, number] }> = [
    { position: "Бариста", salary_type: "per_shift", rate: [1200, 1600] },
    { position: "Бариста", salary_type: "per_shift", rate: [1200, 1600] },
    { position: "Официант", salary_type: "per_shift", rate: [1000, 1300] },
    { position: "Повар", salary_type: "monthly", rate: [35000, 45000] },
    { position: "Администратор", salary_type: "monthly", rate: [40000, 50000] },
  ];

  const employees: { id: number; venue_id: number; name: string }[] = [];
  let nameIdx = 0;
  for (const venue of venues) {
    for (const p of positions) {
      const name = names[nameIdx++ % names.length];
      const r = db
        .prepare(
          `INSERT INTO employees (venue_id, name, phone, position, salary_type, salary_rate, hired_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          venue.id,
          name,
          `+996 ${randInt(500, 779)} ${randInt(100000, 999999)}`,
          p.position,
          p.salary_type,
          randInt(p.rate[0], p.rate[1]),
          addDays(localDateISO(new Date()), -randInt(90, 700))
        );
      employees.push({ id: Number(r.lastInsertRowid), venue_id: venue.id, name });
    }
  }

  // --- камеры ---
  const DEMO_HLS = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";
  const cameraByVenue = new Map<number, number[]>();
  for (const venue of venues) {
    const cams = [
      { name: "Вход", zone: "вход", is_entrance: 1 },
      { name: "Касса", zone: "касса", is_entrance: 0 },
      { name: "Зал", zone: "зал", is_entrance: 0 },
      { name: "Кухня", zone: "кухня", is_entrance: 0 },
    ].map((c) => {
      const r = db
        .prepare(
          `INSERT INTO cameras (venue_id, name, stream_url, zone, is_entrance, detector_enabled)
           VALUES (?, ?, ?, ?, ?, 1)`
        )
        .run(venue.id, c.name, DEMO_HLS, c.zone, c.is_entrance);
      return Number(r.lastInsertRowid);
    });
    cameraByVenue.set(venue.id, cams);
  }

  // --- меню ---
  const menu: Array<[string, string, number, number]> = [
    ["Эспрессо", "Кофе", 120, 35], ["Американо", "Кофе", 150, 40],
    ["Капучино", "Кофе", 200, 60], ["Латте", "Кофе", 220, 65],
    ["Раф", "Кофе", 250, 80], ["Флэт уайт", "Кофе", 230, 70],
    ["Какао", "Напитки", 180, 55], ["Чай (чайник)", "Напитки", 150, 30],
    ["Лимонад", "Напитки", 190, 50], ["Круассан", "Выпечка", 140, 55],
    ["Сырник", "Выпечка", 160, 60], ["Чизкейк", "Десерты", 280, 110],
    ["Медовик", "Десерты", 250, 95], ["Сэндвич с курицей", "Еда", 320, 140],
    ["Боул с киноа", "Еда", 380, 170], ["Каша овсяная", "Еда", 180, 60],
  ];
  const products = menu.map(([name, category, price, cost]) => {
    const r = db
      .prepare("INSERT INTO products (name, category, price, cost) VALUES (?, ?, ?, ?)")
      .run(name, category, price, cost);
    return { id: Number(r.lastInsertRowid), name, price };
  });

  // --- 60 дней истории: смены, посетители, продажи ---
  const today = localDateISO(new Date());
  const start = addDays(today, -59);
  const salesIns = db.prepare(
    "INSERT INTO sales (venue_id, employee_id, ts, total, payment_method) VALUES (?, ?, ?, ?, ?)"
  );
  const itemIns = db.prepare(
    "INSERT INTO sale_items (sale_id, product_id, qty, price) VALUES (?, ?, ?, ?)"
  );
  const visitIns = db.prepare(
    "INSERT INTO visits (venue_id, ts, count, source) VALUES (?, ?, ?, 'camera')"
  );
  const shiftIns = db.prepare(
    "INSERT INTO shifts (venue_id, employee_id, date, start_time, end_time, status) VALUES (?, ?, ?, ?, ?, ?)"
  );

  for (let day = 0; day < 67; day++) {
    const date = addDays(start, day);
    const isFuture = date > today;
    const dow = new Date(date + "T00:00:00").getDay(); // 0=вс
    const weekend = dow === 0 || dow === 6;

    for (const venue of venues) {
      const staff = employees.filter((e) => e.venue_id === venue.id);
      // смены: 2 бариста-смены + повар + админ через день
      for (let i = 0; i < staff.length; i++) {
        const works = (day + i) % 2 === 0 || i >= 3;
        if (!works) continue;
        const status = isFuture
          ? "scheduled"
          : rnd() < 0.04 ? "missed" : rnd() < 0.02 ? "sick" : "done";
        shiftIns.run(venue.id, staff[i].id, date, venue.opens_at, venue.closes_at, status);
      }
      if (isFuture) continue;

      // посетители: будни ~120-200, выходные ~180-300, молл больше
      const mallBoost = venue.name.includes("Молл") ? 1.4 : 1;
      const base = (weekend ? randInt(180, 300) : randInt(120, 200)) * mallBoost;
      const openH = parseInt(venue.opens_at);
      const closeH = parseInt(venue.closes_at);
      for (let h = openH; h < closeH; h++) {
        // пики: утро 8-10 и обед 12-14 и вечер 18-20
        const peak = (h >= 8 && h <= 10) || (h >= 12 && h <= 14) || (h >= 18 && h <= 20) ? 1.7 : 0.7;
        const visitors = Math.max(0, Math.round((base / (closeH - openH)) * peak * (0.7 + rnd() * 0.6)));
        if (visitors > 0) visitIns.run(venue.id, `${date}T${String(h).padStart(2, "0")}:${String(randInt(0, 59)).padStart(2, "0")}:00`, visitors);

        // ~45% посетителей делают покупку
        const checks = Math.round(visitors * (0.35 + rnd() * 0.2));
        for (let c = 0; c < checks; c++) {
          const itemCount = rnd() < 0.55 ? 1 : rnd() < 0.8 ? 2 : 3;
          let total = 0;
          const items: { product: (typeof products)[number]; qty: number }[] = [];
          for (let k = 0; k < itemCount; k++) {
            const product = pick(products);
            const qty = rnd() < 0.9 ? 1 : 2;
            items.push({ product, qty });
            total += product.price * qty;
          }
          const method = rnd() < 0.35 ? "cash" : rnd() < 0.55 ? "card" : "qr";
          const barista = pick(staff.slice(0, 3));
          const ts = `${date}T${String(h).padStart(2, "0")}:${String(randInt(0, 59)).padStart(2, "0")}:${String(randInt(0, 59)).padStart(2, "0")}`;
          const saleId = Number(salesIns.run(venue.id, barista.id, ts, total, method).lastInsertRowid);
          for (const it of items) itemIns.run(saleId, it.product.id, it.qty, it.product.price);
        }
      }
    }
  }

  // --- инциденты: часть рассмотрена, часть в очереди ---
  const detectable = ["sleeping", "phone", "absence", "late", "no_receipt", "smoking"];
  const manual = ["rudeness", "dress_code", "sanitation", "cash_shortage"];
  for (let i = 0; i < 28; i++) {
    const venue = pick(venues);
    const staff = employees.filter((e) => e.venue_id === venue.id);
    const emp = pick(staff);
    const fromCamera = rnd() < 0.65;
    const code = fromCamera ? pick(detectable) : pick(manual);
    const daysAgo = randInt(0, 20);
    const date = addDays(today, -daysAgo);
    const hour = randInt(9, 21);
    const id = createIncident({
      venue_id: venue.id,
      employee_id: rnd() < 0.85 ? emp.id : null,
      type_code: code,
      source: fromCamera ? "camera" : "manual",
      camera_id: fromCamera ? pick(cameraByVenue.get(venue.id)!) : null,
      occurred_at: `${date}T${String(hour).padStart(2, "0")}:${String(randInt(0, 59)).padStart(2, "0")}:00`,
      note: fromCamera ? "Автодетекция: событие в кадре" : "Зафиксировано менеджером",
      confidence: fromCamera ? Math.round((0.62 + rnd() * 0.35) * 100) / 100 : null,
    });
    // старые — рассмотрены, свежие (до 5 дней) частично висят в очереди
    if (daysAgo > 5 || rnd() < 0.3) {
      if (rnd() < 0.7) approveIncident({ incidentId: id, userId: ownerId });
      else {
        db.prepare(
          "UPDATE incidents SET status='dismissed', decided_by=?, decided_at=datetime('now','localtime') WHERE id=?"
        ).run(ownerId, id);
      }
    }
  }

  // --- премии для реализма ---
  for (let i = 0; i < 6; i++) {
    const emp = pick(employees);
    db.prepare(
      `INSERT INTO adjustments (employee_id, venue_id, kind, amount, reason, date, created_by)
       VALUES (?, ?, 'bonus', ?, ?, ?, ?)`
    ).run(
      emp.id,
      emp.venue_id,
      randInt(500, 3000),
      pick(["Лучший сотрудник месяца", "Переработка", "Помощь на другой точке"]),
      addDays(today, -randInt(1, 25)),
      ownerId
    );
  }

  // --- API-ключ для интеграций (демо) ---
  db.prepare("INSERT INTO api_keys (name, token) VALUES (?, ?)").run(
    "Демо-ключ видеоаналитики",
    "ordo_demo_" + Math.floor(rnd() * 1e12).toString(36)
  );
}
