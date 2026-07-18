# Ordo — гайд для реализации страниц

Ordo — управление сетью кофеен (KG/CA): персонал, смены, штрафы, камеры,
продажи, статистика. Next.js 15 (App Router, RSC) + better-sqlite3. Язык UI —
**русский**. Валюта — сом (целые числа, форматтер `som()`).

## Жёсткие правила

- **Не добавлять зависимости** и не менять package.json / configs / globals.css.
- Не менять файлы в `src/lib/*` и `src/components/{Sidebar,Bars,HlsPlayer}.tsx` —
  только использовать. Если чего-то не хватает — минимальный SQL прямо в
  server action через `getDb()`.
- Серверные компоненты по умолчанию; `"use client"` только там, где нужен
  интерактив (формы с локальным состоянием, POS-корзина, видео).
- Мутации — только server actions (`"use server"` файл `actions.ts` рядом со
  страницей) + `revalidatePath()`. Каждый action начинается с
  `const user = await requireUser();`.
- Каждая страница начинается с `await requireUser()` (layout уже защищает, но
  actions обязаны проверять сами).
- Числа денег — целые сомы. Даты в БД: `YYYY-MM-DD`, timestamps
  `YYYY-MM-DDTHH:MM:SS` (локальное время, без Z).
- Дизайн: только готовые CSS-классы из globals.css (ниже). Никаких инлайн-цветов
  кроме `var(--red)` / токенов. Никаких новых цветов, теней, скруглений.

## Библиотеки (`@/lib/...`)

- `db.ts` — `getDb()`: better-sqlite3 со схемой (venues, employees, shifts,
  incident_types, incidents, adjustments, cameras, visits, products, sales,
  sale_items, users, api_keys). Читай файл для точных колонок.
- `auth.ts` — `requireUser()` (redirect на /login), `getSessionUser()`,
  `hashPassword()`; `SessionUser = {id, login, name, role: 'owner'|'manager', venue_id}`.
- `queries.ts` — `listVenues() / getVenue(id)`, `listEmployees(venueId?, includeInactive?)`,
  `getEmployee(id)`, `listCameras(venueId?)`, `getCamera(id)`, `listIncidentTypes()`,
  `listProducts()`. Типы Venue/Employee/Camera/IncidentType/Product экспортированы.
- `incidents.ts` — `listIncidents({status?, venueId?, limit?})` (joined rows),
  `createIncident({venue_id, type_code, ...})`, `approveIncident({incidentId, userId, fineAmount?, employeeId?})`
  (транзакция: фикс суммы + запись штрафа в adjustments), `dismissIncident(id, userId)`.
- `payroll.ts` — `computePayroll({salaryType, salaryRate, shifts, adjustments, periodStart, periodEnd, hiredAt})`
  → `{base, fines, bonuses, advances, total, shiftsDone, hoursDone}`.
- `stats.ts` — `periodSummary(venueId|null, from, to)` → `{revenue, salesCount, avgCheck, visitors, conversion, paymentMix}`;
  `revenueByDay`, `visitorsByDay`, `visitorsByHour`, `topProducts`, `disciplineBoard(from,to)`, `finesTotal`.
- `format.ts` — `som(n)`, `fmtDate(iso)`, `fmtDateTime(iso)`, `todayISO()`, `nowISO()`,
  `addDays(dateISO, n)`, `weekStart(dateISO)`, `WEEKDAYS_RU`, `plural(n, 'чек','чека','чеков')`.

## Компоненты

- `<Bars points={[{label, value}]} formatValue={som} />` — CSS-бар-чарт (server-safe).
- `<HlsPlayer src={camera.stream_url} />` — видео HLS (client). Оборачивай:
  `<div className="cam-tile"><HlsPlayer .../><span className="cam-tile__label">...</span></div>`.
- `Sidebar` уже подключён в layout — страницы рендерят только содержимое `main`.

## CSS-классы (готовая система, см. globals.css)

- Заголовок страницы: `<div className="page-head"><div className="kicker kicker--red">// Раздел</div><h1>Заголовок</h1></div>`;
  строка с кнопкой справа — `page-head__row`.
- Статы: `stat-grid` > `stat` (`stat__label`, `stat__value`, `stat__value--red`, `stat__sub`).
- Карточки: `card`, акцентная `card card--framed`; сетки `grid-2`, `grid-3`.
- Таблицы: `table-wrap` > `table`; числовые ячейки `className="num"`; `<th>` уже стилизованы.
- Кнопки: `btn`, `btn btn--ghost`, `btn btn--danger`, размер `btn--sm`.
- Формы: `field` > `field__label` + `input`/`select`/`textarea`; ряд — `form-row`.
- Бейджи: `badge`, `badge--red` (критично/штраф), `badge--ink`.
- Утилиты: `muted`, `small`, `mono`, `mt-1`, `mt-2`, `mb-1`, `flex-between`, `actions`.

## Паттерн страницы (пример — см. src/app/(app)/page.tsx)

```tsx
import { requireUser } from "@/lib/auth";

export default async function XPage({ searchParams }: { searchParams: Promise<{ venue?: string }> }) {
  await requireUser();
  const { venue } = await searchParams; // фильтры через query-параметры + <Link>
  ...
}
```

Server action:

```ts
"use server";
import { requireUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function createX(formData: FormData) {
  const user = await requireUser();
  // валидация + INSERT через getDb().prepare(...)
  revalidatePath("/x");
}
```

Динамические роуты: `params: Promise<{ id: string }>` (Next 15 — обязательно await).
Несуществующий id → `notFound()` из `next/navigation`.

## Тон интерфейса

Деловой русский, без канцелярита: «Смены», «Штрафы», «Утвердить», «Отклонить»,
«Добавить сотрудника». Пустые состояния — одна строка `muted small` с пояснением
и что сделать. Все суммы через `som()`, все даты через `fmtDate`/`fmtDateTime`.
