# Спека B — Инциденты и камеры

Сначала прочитай `docs/CODEX-GUIDE.md` (правила, библиотеки, CSS-классы) и
референс `src/app/(app)/page.tsx`. Работай ТОЛЬКО в:

- `src/app/(app)/incidents/**`
- `src/app/(app)/cameras/**`

## 1. `/incidents` — очередь нарушений

- Вкладки через `?status=pending|approved|dismissed` (default pending) —
  ряд btn--sm ссылок с количеством. Данные: `listIncidents({status, limit: 100})`.
- Шапка: кнопка «Зафиксировать нарушение» → `/incidents/new`.
- **Pending**: каждая запись — `card` с:
  - бейджи: источник («камера»/«вручную»/«API»; камера/API — badge--ink),
    severity (critical → badge--red), уверенность детектора если есть
    (`mono small`, напр. «87%»);
  - заголовок: тип (`type_title`), точка, сотрудник (или «сотрудник не
    определён»), время (`fmtDateTime`), заметка muted; имя камеры если есть;
  - **форма решения** (одна на карточку, server action):
    select сотрудника (все активные точки инцидента; преселект текущего),
    input суммы (default `suggested_fine`), кнопки «Утвердить удержание»
    (btn btn--danger, вызывает `approveIncident({incidentId, userId: user.id, fineAmount, employeeId})`)
    и «Отклонить» (btn--ghost → `dismissIncident`).
  - Если сумма 0 — кнопка называется «Подтвердить без удержания».
- **Approved/dismissed**: таблица (дата, тип, точка, сотрудник, источник,
  сумма/«—»). 
- Внизу строка `small muted`: «Удержания оформляются как депремирование
  (ТК КР 2025 не допускает денежные штрафы как взыскание). Шаблон приказа — в
  Настройках.»

## 2. `/incidents/new` — ручная фиксация

Форма: заведение (select), сотрудник (select, опционально — «не определён»),
тип нарушения (select из `listIncidentTypes()`, в option сразу дефолтная сумма),
дата+время (два поля, default сейчас — `nowISO()`), сумма удержания (пусто =
дефолт типа), заметка (textarea). Server action → `createIncident(...)`
(source: 'manual', suggested_fine если задана) → redirect `/incidents`.

## 3. `/cameras` — все камеры

- Группировка по заведениям (заголовок h3 + адрес muted).
- `cam-grid` из `cam-tile`: `<HlsPlayer src={c.stream_url} />` +
  `cam-tile__label`: имя камеры · зона; если `is_entrance` — добавить
  « · счётчик», если `detector_enabled` — `<span className="cam-tile__live"> ● AI</span>`.
- Тайл кликабелен → `/cameras/[id]` (обернуть в `<Link>` со стилем без подчёркивания).

## 4. `/cameras/[id]` — камера

- Большой плеер (cam-tile на всю ширину карточки), рядом карточка свойств:
  заведение, зона, поток (stream_url, mono small, word-break), флаги.
- Кнопка-тумблер «Детекция: вкл/выкл» (server action UPDATE detector_enabled).
- **Последние события с этой камеры**: `SELECT` инцидентов по camera_id
  (JOIN типы/сотрудники), таблица: время, тип, сотрудник, статус по-русски,
  сумма.
- Кнопка «▶ Тестовое событие» (server action): создаёт pending-инцидент через
  `createIncident({venue_id, camera_id, type_code: 'phone'|'sleeping'|'absence' случайно,
  source: 'camera', occurred_at: nowISO(), confidence: 0.7..0.95, note: 'Тестовая детекция'})`
  → revalidate. Подпись muted: «эмуляция события видеоаналитики для демо».
- Внизу `card` «Как подключить свою аналитику»: 3 строки о вебхуке
  `POST /api/integrations/detections` (Bearer API-ключ из Настроек) + что RTSP
  камеры конвертируются в HLS через go2rtc/MediaMTX на площадке.

## Критерии готовности

`pnpm typecheck` проходит. НЕ запускай `pnpm build`/`dev`/`install`. Русский UI,
существующие CSS-классы, server actions с `requireUser()`.
