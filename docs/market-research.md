# Market research: cafe/coffeeshop management SaaS for Kyrgyzstan & Central Asia

**Date:** 2026-07-18. Researched in Russian and English. Target user: multi-venue cafe/coffeeshop
owners in KG (secondarily KZ/UZ). Product concept under evaluation: roster + salaries + fines,
camera monitoring with AI flags → approved fines, visitor counting, sales stats — *on top of*
(not replacing) the venue's POS and fiscal stack.

---

## 1. POS / cafe-automation landscape

### Who is actually installed in KG/KZ/UZ

| System | Origin | Presence in region | Pricing (public) | Public API |
|---|---|---|---|---|
| **Poster POS** | Ukraine (cloud) | Strong in KG (poster.kg, local dealers pos-service.kg, abi.kg), KZ (posterpos.kz, poster24.kz) | KG: StartUp $14/mo → Mini $24 → Business $34 → Pro $54; extra terminal $19/mo; extra location = base tariff, 5th+ $25/mo ([poster.kg/pricing](https://poster.kg/pricing/)) | **Yes, best in class** — [dev.joinposter.com](https://dev.joinposter.com/en), REST Web API + app marketplace (Poster keeps 30% of app revenue), [GitHub org](https://github.com/joinposter) with SDKs/boilerplates. 23k locations / 100 countries on the platform |
| **iiko** | Russia | Dominant in mid/upper segment KZ (pos-systems.kz, openservice.kz, idsoft.kz), official partner in Bishkek ([iikosoft.kg](https://iikosoft.kg/)) | KZ from ~21 600 ₸/mo, volume discounts 25–50% for multi-terminal chains; KG partner quotes updates from 1 500 сом/точка ([iiko.splus.kz/prices](https://iiko.splus.kz/prices/)) | **Yes** — iikoCloud/Transport API ([api.iiko.ru](https://api.iiko.ru/), [docs](https://ru.iiko.help/articles/#!iikoweb/iikocloudapi)), iikoFront plugin API ([iiko.github.io/front.api.doc](https://iiko.github.io/front.api.doc/)) |
| **r_keeper** | Russia | Established in KG via [rkeeper.kg](https://www.rkeeper.kg/) (also hotels/fitness), active in UZ ([rkeeper.uz](https://rkeeper.uz/)) | License + integrator model, priciest tier; installed in 46 countries | Partner/integrator API, less open than Poster/iiko |
| **Paloma365** | Kazakhstan | KZ home market, offices/resellers in UZ ([paloma365.uz](https://paloma365.uz/reshenie/avtomatizatsiya-restorany-i-kafe/)), sold in KG; RU/KZ/EN UI ([paloma365.net](https://paloma365.net/)) | Cheap cloud subscription, positioned against Poster | Limited public API |
| **Jowi** | Uzbekistan | Was the default in Tashkent; **declining** — competitors run "решения на Jowi не работают" campaigns, complaints: slow, no updates, support unresponsive ([rkeeper.uz on Jowi](https://rkeeper.uz/stati/post/x1f525-rynok-menyaetsya-resheniya-na-jowi-ne-rabotayut-chto-delat-restoratoram-v-2025-godu), [amastart review](https://amastart.com/software/jowi/)) | Cloud + local client | Had an API; ecosystem stale |
| **Syrve** | intl. rebrand of iiko | Marketed in UA/MENA; in CA the iiko brand itself is what's sold | — | Same Cloud API family as iiko |
| **Quick Resto** | Russia | KZ team, implementations in Almaty/Shymkent ([quickresto.kz](https://quickresto.kz/)); no visible KG presence | KZ subscription tiers | API exists (RU market) |
| **Local KG** | — | cafe.el.kg (Bishkek integrator, site barely alive), hardware/KKM shops ([kkm.kg](https://kkm.kg/), [abi.kg](https://abi.kg/catalog/avtomatizatsiya_po/poster_pos_/)) selling Poster/iiko bundles | — | — |

**Read:** in Bishkek the practical split is **Poster for coffeeshops/small cafes** (cheap, cloud,
tablet), **iiko/r_keeper for restaurants and chains** (heavier, integrator-installed). KZ adds
Paloma365 and Quick Resto; UZ is churning off Jowi toward r_keeper/Poster/Paloma.

### What owners complain about (reviews/forums)

Poster ([a2is reviews](https://a2is.ru/catalog/programmy-dlya-kafe-i-restoranov/poster/reviews-poster),
[otzyvua](https://www.otzyvua.net/poster-pos?sort=popular), [hf.ru](https://hf.ru/services/poster_pos)):

- server sync failures, stats/finance numbers that don't add up ("сырая система, полная багов");
- multi-warehouse write-offs bleed between locations — a product sold at point A gets written off at point B;
- cost-price glitches (себестоимость завышена в 100 раз), stale prices pulled into reports;
- support slow on hard bugs (2+ months);
- repeated verdict: **"если вы сетевик — Poster не подойдёт"** — weak for chains. That's our wedge audience.

iiko ([crmindex](https://crmindex.ru/products/iiko/reviews), [otzyvmarketing](https://otzyvmarketing.ru/iiko/),
["Крик души пользователей iiko"](https://it-hm.ru/19-news/newsrestoran/116-krik-dushi-polzovatelej-iiko)):

- expensive, "платно практически всё", needs an integrator for everything;
- slow back office (managers waiting 35s per click), two modules showing different cost/stock numbers;
- reports unstable ("сегодня одна цифра, завтра другая");
- powerful for chains but heavy — овеrkill for a 3-coffeeshop owner.

### Integration verdict

- **Poster is the #1 integration target**: real public REST API, webhooks, an app marketplace we can list in, sample code on GitHub. We can pull transactions/receipts per spot for sales stats without touching fiscal hardware.
- **iiko Cloud (Transport) API** second: covers the bigger chains; token-based, well documented, big third-party connector ecosystem ([apimonster](https://apimonster.ru/connector/bundle/iiko/syrve/), [apimenu](https://apimenu.ru/)).
- r_keeper/Paloma/Jowi: partner-gated or stale — support later via CSV import / fiscal-data fallback, not v1.

---

## 2. Fiscal / legal context (KG): онлайн-ККМ and ГНС

- Cash-register law: all consumer settlements for goods/services require a **ККМ with online fiscal data transmission** and a paper и/или electronic receipt (Постановление ПКР №356 от 24.06.2020; порядок — [ПКР №691 от 17.12.2019](http://cbd.minjust.gov.kg/act/view/ru-ru/157413); ГНС overview: [sti.gov.kg ККМ section](https://sti.gov.kg/section/0/%D0%BA%D0%BA%D0%BC_%D0%BE%D0%BD%D0%BB%D0%B0%D0%B9%D0%BD), [who must apply ККМ/ЭТТН/ЭСФ](https://sti.gov.kg/news/details/c0c25ce5-13df-4ab6-b3a2-3e497e64ddde)).
- Data flows ККМ → **ОФД (оператор фискальных данных)** → ГНС. ОФД/cloud-KKM providers: [OFD1](https://ofd1.kg/), [eKassa/Telemedia](https://tmg.kg/ekassa/), [YaKassa](https://yakassa.kg/), [О!Касса](https://o.kg/ru/novosti/predprinimatelyam-podklyuchayte-virtualnuyu-kkm-prilozhenie-o-kassa/) (virtual KKM app from O!), [Beeline ККМ](https://kkm.beeline.kg/), plus ГНС's own free Android app ["Онлайн ККМ"](https://play.google.com/store/apps/details?id=kg.gns.kktmobile). Virtual/software KKM on a phone or the POS PC itself is fully legal — no fiscal iron required.
- Cafes specifically: ГНС publicly warned that **пречеки / order screenshots are not fiscal receipts** — only the ККМ чек counts ([akchabar](https://www.akchabar.kg/news/gns-obyasnila-kakie-cheki-dolzhni-vidavat-v-kafe-i-restoranakh-bzlmocyahbprqvxt)). Receipts are verifiable online by QR ([ekonomika.media](https://ekonomika.media/gns-prizyivaet-grazhdan-proveryat-podlinnost-chekov-v-onlayn-rezhime/)).
- Exemptions: patent-based entrepreneurs and special trade-zone taxpayers may skip ККМ ([economist.kg](https://economist.kg/biznes/2025/10/28/gns-napomnila-kto-obiazan-primieniat-kkm-ettn-i-esf/)) — but sit-down cafes normally don't qualify.
- Penalties exist for broken/absent ККМ (e.g. 3 000 сом физлицо / 13 000 сом юрлицо+ИП for using a faulty ККМ, [economist.kg 2022](https://economist.kg/novosti/2022/08/30/predprinimatelej-budut-shtrafovat-na-summy-do-13-tysyach-somov-za-neispravnye-kkm/)); Bishkek runs a "Гражданский контроль" snitch program on non-issued receipts.
- Precedent for POS↔KKM integration: Poster in KG fiscalizes via **NewCAS** (software KKM, 400 сом/мес + $1/мес for the Poster bridge; receipt auto-generated on "Pay", offline buffer included) ([poster.pos-service.kg/kkm-onlajn](https://poster.pos-service.kg/kkm-onlajn/), [joinposter NewCAS app](https://joinposter.com/en/applications/newcas)).

**What this means for us:** we should **not** be a ККМ and don't need to be. Sales data can come
from (a) the POS API (Poster/iiko), or (b) the KKM/ОФД side (NewCAS, eKassa, О!Касса expose
per-receipt data to the merchant's cabinet). If we ever register payments ourselves we'd have to
trigger fiscalization through a partner software-KKM (NewCAS/eKassa model) — an integration, not
a certification burden. Keep an eye on ЭТТН/ЭСФ (e-waybills/e-invoices) for the inventory side.

---

## 3. Payments landscape (KG)

- **ELQR — the national interoperable QR standard**, operated by Межбанковский процессинговый центр (МПЦ, Elcard's processing arm): 20 banks + 21 payment orgs, 100+ apps read one merchant QR; built on KMS 1348:2019 + EMV QRCPS merchant-presented mode ([ipc.kg/ELQR](https://ipc.kg/digital-services/elqr/), [НБКР rules](https://www.nbkr.kg/contout.jsp?item=106&lang=RUS&material=115144), [kaktus.media 6-year retrospective](https://kaktus.media/doc/541373_kak_elqr_za_6_let_perestroila_platejnyy_rynok_kyrgyzstana.html)). QR payments grew ~100x in a year ([ipc.kg](https://ipc.kg/news/za-poslednij-god-kyrgyzstanczy-stali-v-100-raz-chashhe-oplachivat-s-pomoshhyu-qr-kodov/)); 42.7M payments / 48.8 bn сом by Nov 2024. Outbound Alipay+ integration live 2026 ([economist.kg](https://economist.kg/ekonomika/2026/05/25/elkart-integrirovali-s-alipay-kyrgyzstantsy-smogut-platit-po-qr-za-rubezhom/)).
- **Wallet/bank apps a cafe actually sees**: MBank (dominant consumer app), **O!Деньги** (900+ services, cafe bills, [o.kg](https://o.kg/ru/novosti/popolnyayte-mbank-online-cherez-o-dengi-bez-komissii/)), Optima24 (+ its own [Optima QR](https://optimabank.kg/ru/for-individuals/more/optima-qr.html)), Bakai, Demir; card rails = Элкарт (national) + Visa/MC.
- **MKassa (MBank)** is the aggressive merchant play: free POS terminal **and free ККМ**, QR + card acceptance, automatic fiscalization, 0% promo commission for ИП/ОсОО, multi-point reporting from a phone ([mbank.kg/mkassa](https://mbank.kg/mkassa)). No public API documented — data access likely via cabinet/exports.
- **API-friendly aggregators**: [xPay](https://xpay.kg/en/) (ELQR payments, fast onboarding, API + webhooks, settles via any KG bank); [pay.payqr.kg](https://pay.payqr.kg/) (СБП-style fast payments).

**Modeling implication:** a sale in KG cafe reality is: cash / card terminal / **QR (ELQR or
wallet-specific)** — and tips ("чай") often flow to a personal MBank QR, invisible to the POS.
Our sales model must tag payment method per receipt (cash/card/QR/wallet), reconcile POS totals
vs acquiring/wallet settlements per venue, and treat tips as off-books by default.

---

## 4. Cameras & video analytics

### Installed base

- Commodity CCTV in Bishkek is **Hikvision/Dahua IP cameras + NVR**, sold and installed by dozens of local firms ([control.kg](https://control.kg/), [lalafo listings](https://lalafo.kg/kyrgyzstan/foto-i-video-tekhnika/videonabludenie/q-%D1%83%D1%81%D1%82%D0%B0%D0%BD%D0%BE%D0%B2%D0%BA%D0%B0-%D0%B2%D0%B8%D0%B4%D0%B5%D0%BE%D0%BD%D0%B0%D0%B1%D0%BB%D1%8E%D0%B4%D0%B5%D0%BD%D0%B8%D1%8F-%D0%B2-%D0%B1%D0%B8%D1%88%D0%BA%D0%B5%D0%BA%D0%B5-%D1%86%D0%B5%D0%BD%D1%8B)). Everything speaks **RTSP/ONVIF**.
- **Trassir (DSSL, RU)** — pro VMS + analytics, native Hikvision integration, cafe/restaurant case studies (cash-zone control, People Counter with conversion module) ([dssl.ru People Counter](https://www.dssl.ru/products/trassir-people-counter/), [Trassir for cafes](https://y-ss.ru/blog_pro/videonablyudenie/trassir-dlya-kafe-i-restoranov-zony-kontrolya-i-keysy/), [trassircloud.com](https://trassircloud.com/)).
- **Ivideon (RU cloud)** — cloud VMS + analytics: 3D visitor counters (~95% accuracy stereo heads-counting), queue detection, **cash-register control** (receipt overlay on video), 7 report types, and — key — **open API/SDK for embedding into business systems** ([ru.ivideon.com/counter-3d](https://ru.ivideon.com/counter-3d/), [get.ivideon.com/analytics](https://get.ivideon.com/analytics/), [API/SDK deck](https://www.slideshare.net/Ivideon/apisdk-73778805)). Already marketed alongside iiko by RU integrators ([standartmaster](https://standartmaster.ru/posts/13-ivideon.html)).
- Hikvision cameras themselves do edge **people counting + event push**: enable via ISAPI (`PUT /ISAPI/System/Video/inputs/channels/<id>/counting`), consume `PeopleCounting` events from the persistent alert stream `GET /ISAPI/Event/notification/alertStream` or HTTP listening-mode push to our endpoint ([Hikvision doc](http://enpinfo.hikvision.com/unzip/20210507165058_24612_doc/GUID-31A1ECDD-53B2-4023-BA85-3AF8243A649F.html), [ISAPI PDF](https://raw.githubusercontent.com/loozhengyuan/hikvision-sdk/master/resources/isapi.pdf)).

### Realistic integration surface

1. **RTSP pull** from any camera/NVR — universal, works with the no-name installs; we run our own inference (person detection, zone dwell, staff-absent-from-station, phone-at-register flags) on box or GPU cloud; restream as HLS/WebRTC for the owner's phone.
2. **Hikvision ISAPI** — free edge people-counting + event webhooks where the hardware supports it (no ML cost for footfall).
3. **Ivideon API** — partner path if the venue already pays for Ivideon cloud.
4. **Trassir** — treat as competitor-adjacent (they sell analytics themselves), integrate last.

Sanctions note: Hikvision/Dahua and RU vendors (Trassir, Ivideon) are unaffected and standard in
KG — no procurement friction, but don't build the product assuming Western cloud VMS (Verkada/Rhombus
etc., absent here).

---

## 5. Labor: staff fines (штрафы), rosters, salaries

### Legal reality — fines are NOT legal, but everyone uses them

- New **Трудовой кодекс КР № 23 от 23.01.2025** (6 разделов, 265 статей; in force 2025) ([official text](https://cbd.minjust.gov.kg/3-45/edition/25298/ru), [zakon.kz consolidated](https://online.zakon.kz/Document/?doc_id=39188508), [mlsp.gov.kg](https://mlsp.gov.kg/ru/2025/01/27/sadyr-zhaparov-podpisal-novyj-trudovoj-kodeks/)).
- Closed list of disciplinary measures: **замечание, выговор, строгий выговор, увольнение**. Monetary fines are not on the list ⇒ **штраф как дисциплинарка = нарушение**; applying non-listed sanctions is prohibited (same doctrine as RU/KZ: [moedelo.org](https://www.moedelo.org/club/kadrovyy-uchet/shtrafy-na-rabote), [uatbekova.kz](https://uatbekova.kz/publikatsii/29-shtrafy-na-rabote-naskolko-oni-zakonny)).
- Legal money levers that exist instead:
  - **Материальная ответственность** — recover actual documented damage (breakage, shortage/недостача) with written procedure; deduction caps per paycheck apply (regional norm ~20%, up to 50% in statutory cases — mirror of RU ТК ст.138 / KZ practice; verify exact КР articles before shipping legal copy);
  - **депремирование** — salary structured as оклад + премия, with the premium conditional on KPI/discipline in a локальный акт. This is the standard lawful "fine" workaround across CIS;
  - court-ordered deductions, training-cost recovery, unreturned advances.
- Enforcement is real but shallow: labor inspectors fined KG employers ~5M сом in a recent period ([economist.kg](https://economist.kg/society/2025/06/05/rabotodatieli-oshtrafovany-za-narushieniie-trudovykh-prav-pochti-na-5-mln-somov/)); new code also added 0.25%/day penalty on late salary payment ([24.kg on the new code](https://24.kg/obschestvo/356276_sudya_vskronovshestvah_trudovogo_prava_iotom_kak_eto_otrazitsya_nalyudyah_/)).
- **Practice:** much of KG horeca employment is informal/undocumented (no трудовой договор, cash per-shift pay), and ad-hoc fines for lateness/breakage/phone-use are ubiquitous and rarely contested. So the *feature* has demand; the *framing* must be lawful.

### Staffing & pay structures (from live vacancies)

Per [headhunter.kg](https://bishkek.headhunter.kg/vacancies/oficiant) / [lalafo.kg](https://lalafo.kg/kyrgyzstan/rabota/q-%D0%B8%D1%89%D1%83-%D1%80%D0%B0%D0%B1%D0%BE%D1%82%D1%83-%D0%B1%D0%B0%D1%80%D0%BC%D0%B5%D0%BD%D0%B0) / [newjob.kg](https://newjob.kg/vacancies/povara-oficianty-barmeny-pischevoe-proizvodstvo) (2025–26):

- **Pay is per-shift (за смену), not monthly**, for most line staff: bartenders 2 800–3 500 сом/смена; cooks 1 800–2 500 сом/смена (senior) or ~38 000 сом/мес fixed; waiters 1 000–1 500+ сом/смена **plus чай (tips)** and sometimes % of sales (≈7%).
- Graphs: 6/1, 2/2, evening shifts (18:00–02:00) are typical; payout monthly or twice-monthly, often cash.
- Implication: the payroll model must be **shift-first**: rate-per-shift × shifts worked ± премия/удержания ± tips share ± advances (авансы are a constant reality), monthly totals as a report, not the primitive.

---

## 6. Gaps — where multi-venue owners are underserved

What no incumbent gives a 2–10-venue KG owner in one place:

1. **Chain-grade oversight at Poster price.** Poster is weak for chains (their own users say so); iiko does chains but is expensive, integrator-bound, and its back office is a desktop-era analyst tool, not an owner's phone app.
2. **Video tied to operations.** CCTV exists in ~every cafe but is dumb storage; Trassir/Ivideon analytics are sold as *security* products, priced per-camera, never linked to rosters, salaries, or the POS. Meanwhile shrinkage is the #1 owner fear — up to ~40% of horeca losses are internal abuse; classic schemes are dead checks, чек open/not closed, corrections abuse, cashier–bartender collusion; video reduces theft risk ~70% ([finoko](https://www.finoko.ru/vorovstvo-v-restorane/), [rkeeper blog](https://rkeeper.ru/blog/kak-kontrolirovat-personal-v-restorane/), [multi-bit](https://multi-bit.com/avt_iiko/vorovstvo)).
3. **Discipline/fines workflow.** Every owner "fines" informally in a notebook or WhatsApp; no tool models it, because RU-origin vendors avoid the legally grey feature. A lawful депремирование/материальная-ответственность workflow with evidence attached (video clip!) is unoccupied ground.
4. **Shift-based payroll.** Poster/iiko track hours for access control, not per-shift pay + advances + tips + premium/deduction math that KG cafes actually run in Excel/WhatsApp.
5. **Cross-venue comparability.** Footfall→conversion per venue (visitors counted by camera vs receipts from POS) — Trassir sells conversion counting to retail, nobody wires it to cafe POS data in CA.

Overlap risk: sales stats *alone* duplicate Poster's dashboards — don't compete there; ingest and
enrich (per-shift, per-employee, vs-footfall) instead.

---

## 7. Product implications

**Positioning.** "The owner's control tower over N venues" — not a POS. Works *with* Poster/iiko,
replaces the notebook of fines, the Excel payroll, and the never-watched DVR. Sell to owners of
2–10 points (coffeeshop chains, самса/fastfood chains) at Poster-like pricing (~$20–40/venue/mo);
list in Poster's app marketplace for distribution (they take 30% rev share on marketplace billing —
consider direct billing).

**Integration priorities (in order):**
1. **Poster Web API** — transactions, receipts, employees, spots → sales stats + per-shift revenue attribution. Cheapest path to live data for the exact segment.
2. **RTSP ingest + own CV** — universal camera support (Hikvision/Dahua/no-name); flags: register unattended, no-receipt handover, after-hours presence, queue length; clip-on-event to the owner's phone.
3. **Hikvision ISAPI people counting** — free footfall where hardware allows; else our own head-counting on the entrance camera.
4. **iiko Cloud API** — unlocks the bigger chains later.
5. Payments: don't process payments in v1. Model payment methods on the receipt: **cash / card / ELQR QR / wallet (MBank, O!Деньги, Optima)**; reconcile against MKassa/acquiring statements (CSV) since MKassa has no public API. If we ever accept payments, use **xPay (ELQR, API+webhooks)**.
6. Fiscal: no ККМ ambitions. If we later register sales, bridge to a software KKM (NewCAS/eKassa pattern: 400 сом/мес class of cost).

**Fines feature — legal design (critical):**
- Never call it "штраф" in documents the system generates. Model as **премиальная часть + депремирование** (premium withheld per documented violation under a локальный акт) and **материальная ответственность** (actual damage, with акт + employee acknowledgment).
- Ship template documents: положение о премировании, договор о материальной ответственности, акт о нарушении — generated per incident, with the video clip as attached evidence and an employee-acknowledgment step (sign on the manager's phone).
- Enforce deduction caps per payout in the engine (configurable, default ≤20% of the monthly premium fund per incident class) and a full audit trail — this converts a legal liability into a compliance selling point ("штрафуйте законно").
- AI flags must be **suggestions requiring owner/manager approval**, never auto-deductions — both for law and for trust.

**Payroll model:** shift-first (ставка за смену per role per venue), % of sales option for waiters,
advances ledger, tips outside payroll by default, monthly/bi-monthly payout runs, cash-payout marking.

**Risks / cautions:**
- Employee video surveillance + fines is reputationally spicy; include employee-visible policy notices, retention limits.
- Poster could ban an app that positions against them — keep marketplace listing framing as "analytics & HR add-on".
- KG market is small (~7M people, Bishkek-centric) — design for KZ/UZ expansion (Paloma/iiko integrations, KZ ОФД differences) from day one.
- Verify exact КР Labor Code article numbers for deduction caps with a local lawyer before publishing legal templates (this report confirms the doctrine, not the article numbers).

## Sources (primary)

POS: [poster.kg/pricing](https://poster.kg/pricing/) · [dev.joinposter.com](https://dev.joinposter.com/en) · [iikosoft.kg](https://iikosoft.kg/) · [iiko.splus.kz/prices](https://iiko.splus.kz/prices/) · [rkeeper.kg](https://www.rkeeper.kg/) · [paloma365.net](https://paloma365.net/) · [quickresto.kz](https://quickresto.kz/) · reviews: [a2is](https://a2is.ru/catalog/programmy-dlya-kafe-i-restoranov/poster/reviews-poster), [otzyvua](https://www.otzyvua.net/poster-pos?sort=popular), [crmindex](https://crmindex.ru/products/iiko/reviews), [it-hm](https://it-hm.ru/19-news/newsrestoran/116-krik-dushi-polzovatelej-iiko)
Fiscal: [sti.gov.kg](https://sti.gov.kg/section/0/%D0%BA%D0%BA%D0%BC_%D0%BE%D0%BD%D0%BB%D0%B0%D0%B9%D0%BD) · [cbd.minjust.gov.kg №691](http://cbd.minjust.gov.kg/act/view/ru-ru/157413) · [akchabar](https://www.akchabar.kg/news/gns-obyasnila-kakie-cheki-dolzhni-vidavat-v-kafe-i-restoranakh-bzlmocyahbprqvxt) · [poster.pos-service.kg/kkm-onlajn](https://poster.pos-service.kg/kkm-onlajn/) · [ofd1.kg](https://ofd1.kg/) · [yakassa.kg](https://yakassa.kg/) · [tmg.kg/ekassa](https://tmg.kg/ekassa/) · [ГНС Онлайн ККМ app](https://play.google.com/store/apps/details?id=kg.gns.kktmobile)
Payments: [ipc.kg/ELQR](https://ipc.kg/digital-services/elqr/) · [nbkr.kg QR rules](https://www.nbkr.kg/contout.jsp?item=106&lang=RUS&material=115144) · [mbank.kg/mkassa](https://mbank.kg/mkassa) · [xpay.kg](https://xpay.kg/en/) · [kaktus.media ELQR](https://kaktus.media/doc/541373_kak_elqr_za_6_let_perestroila_platejnyy_rynok_kyrgyzstana.html)
Video: [dssl.ru People Counter](https://www.dssl.ru/products/trassir-people-counter/) · [ru.ivideon.com/counter-3d](https://ru.ivideon.com/counter-3d/) · [get.ivideon.com/analytics](https://get.ivideon.com/analytics/) · [Hikvision ISAPI counting](http://enpinfo.hikvision.com/unzip/20210507165058_24612_doc/GUID-31A1ECDD-53B2-4023-BA85-3AF8243A649F.html)
Labor: [ТК КР №23 (cbd.minjust)](https://cbd.minjust.gov.kg/3-45/edition/25298/ru) · [24.kg new-code analysis](https://24.kg/obschestvo/356276_sudya_vskronovshestvah_trudovogo_prava_iotom_kak_eto_otrazitsya_nalyudyah_/) · [economist.kg labor fines](https://economist.kg/society/2025/06/05/rabotodatieli-oshtrafovany-za-narushieniie-trudovykh-prav-pochti-na-5-mln-somov/) · vacancies: [headhunter.kg](https://headhunter.kg/vacancies/barmen), [lalafo.kg](https://lalafo.kg/kyrgyzstan/rabota/q-%D0%B8%D1%89%D1%83-%D1%80%D0%B0%D0%B1%D0%BE%D1%82%D1%83-%D0%B1%D0%B0%D1%80%D0%BC%D0%B5%D0%BD%D0%B0)
Theft/control: [finoko](https://www.finoko.ru/vorovstvo-v-restorane/) · [rkeeper blog](https://rkeeper.ru/blog/kak-kontrolirovat-personal-v-restorane/) · [multi-bit](https://multi-bit.com/avt_iiko/vorovstvo)
