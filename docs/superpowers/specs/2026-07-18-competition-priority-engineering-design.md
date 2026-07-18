# Вектор — competition-first інженерна стратегія

**Дата:** 18 липня 2026 року  
**Статус:** погоджено для планування  
**Пов'язана продуктова специфікація:** `docs/superpowers/specs/2026-07-18-ai-planner-design.md`  
**Технічна база:** `STACK-PLAYBOOK.md`

## 1. Рішення про обсяг

Цільовий обсяг продукту не скорочується. Google Calendar, Telegram, Oracle, Stripe, Goal Focus, Pomodoro та адаптація залишаються у roadmap.

Змінюється не scope, а порядок реалізації: спочатку команда доводить до production-ready стану конкурсний наскрізний сценарій, потім послідовно додає інтеграції та диференціатори. Якщо три дні закінчуються раніше, незавершені модулі не декларуються в демо й ховаються feature flags, але вже готове ядро залишається стабільним.

## 2. Головний критерій готовності

Перший release gate відтворює без ручних підстановок повний сценарій:

`Brain dump → AI-аналіз → задачі з пріоритетом, тривалістю і дедлайном → детермінований розклад → Today → редагування або Undo`.

Цей сценарій має працювати:

- українською мовою;
- з текстового та голосового вводу;
- на мобільному екрані 360–430 px;
- після перезавантаження сторінки;
- на публічному production URL;
- з реальним AI API;
- з передбачуваним fallback, якщо AI або мережа тимчасово недоступні.

## 3. Черга release gates

### Gate P0-A — конкурсне ядро

- production mobile shell і стабільна навігація;
- текстовий та голосовий Brain Dump;
- збереження чернетки до AI-виклику;
- реальна транскрипція;
- структурований AI-результат: task/idea/context, назва, пріоритет, тривалість, дедлайн, energy, confidence;
- максимум 1–2 уточнення лише за низької впевненості;
- детермінований scheduler;
- екрани AI Result, Inbox, Today і Task Detail на реальних даних;
- редагування, завершення та Undo;
- PocketBase persistence;
- production smoke test основного сценарію.

### Gate P0-B — Google і календарний контекст

- Google sign-in через PocketBase;
- окремий onboarding-крок Calendar permission з offline access;
- читання busy slots;
- планування навколо зайнятого часу;
- створення app-owned Calendar blocks;
- retry/sync status без втрати задач;
- повторний вхід і відновлення сесії.

### Gate P1 — повний щоденний цикл

- двостороння синхронізація app-owned Calendar blocks;
- автоматичне перепланування лише майбутніх flexible-задач;
- Change Set і Undo для перепланування;
- Telegram deep-link pairing;
- Telegram text/voice capture через той самий AI pipeline;
- ранковий план, нагадування, конфлікти, вечірній підсумок;
- quiet hours і контроль дубльованих webhook;
- Calendar Day/Week та контроль перевантаження.

### Gate P2 — конкурсна відмінність

- Goal, Project, Idea і Graph Edge як реальні сутності;
- одна безкоштовна головна мета;
- alignment score;
- Oracle force-directed graph;
- фільтри й підсвічення шляху;
- перетворення ідеї на проєкт/задачі;
- Balanced і Goal Focus з Undo;
- пояснення рекомендованого маршруту.

### Gate P3 — комерційність і полірування

- Stripe Test Checkout для $100 Lifetime Pro;
- idempotent webhook і entitlement unlimited goals;
- paywall на другу мету;
- Pomodoro/Focus Mode;
- адаптація оцінок за виконаними й перенесеними задачами;
- аналітика виконання;
- AI goal test після додавання версійованого протоколу;
- фінальні анімації, accessibility та performance polish.

## 4. Архітектура

### Клієнт

Наявний React/Vite застосунок у `prototype/` стає production frontend без перейменування під час інтенсиву. Він деплоїться на Vercel. Назва папки історична й не впливає на продукт.

Клієнт відповідає за UI, локальні optimistic states, запис аудіо та виклики Gateway. Він не містить секретів, не викликає Gemini, Stripe або Google Calendar напряму і не приймає рішень про планування.

### Gateway

Новий `gateway/` — Node.js + Fastify + TypeScript. Він:

- перевіряє PocketBase auth token через `auth-refresh`;
- валідує request/response через Zod;
- оркеструє транскрипцію та Gemini structured output;
- запускає детермінований scheduler;
- застосовує AI Change Sets;
- працює з Google Calendar, Telegram і Stripe;
- виконує idempotent webhook та фонові jobs;
- зберігає зовнішні secrets лише на сервері.

### PocketBase

Новий `pocketbase/` з raw JavaScript migrations та volume для `pb_data`. PocketBase використовується як auth і основна база даних. JSON store з playbook не використовується: продукт має зв'язки, синхронізацію, Undo та граф, для яких потрібні колекції й індекси.

Усі user-owned колекції мають PocketBase rules виду `user = @request.auth.id`. Server-only колекції для OAuth refresh tokens, webhook events і jobs закриті від browser API.

### Деплой

- `prototype/` → Vercel;
- `gateway/` і `pocketbase/` → VPS через Docker Compose;
- контейнери слухають лише loopback-порти;
- системний Caddy завершує TLS і проксіює API/webhook;
- staging/production env перевіряються при старті;
- `GET /health` не розкриває secrets.

## 5. Потік основного сценарію

1. Клієнт створює `brain_dump` як draft до зовнішнього AI-виклику.
2. Для voice input Gateway транскрибує аудіо; аудіофайл видаляється після успіху або контрольованого timeout.
3. Gateway надсилає текст у Gemini з JSON Schema.
4. Zod відхиляє невірний або неповний результат. Дозволена одна повторна спроба repair.
5. Якщо confidence нижче порогу й без відповіді неможливо безпечно визначити дедлайн/сенс, AI повертає максимум два питання.
6. Після відповіді або одразу для впевненого результату Gateway створює preview Change Set.
7. Детермінований scheduler розміщує задачі за явними правилами, а не за довільною відповіддю LLM.
8. Change Set атомарно створює сутності та snapshot для Undo.
9. Клієнт показує AI Result і Today із коротким поясненням рішень.
10. Undo відновлює попередній snapshot; зовнішні calendar changes компенсуються idempotent job.

## 6. Дані

Колекції створюються не всі одразу, а разом із release gate:

- P0-A: `users`, `work_profiles`, `brain_dumps`, `tasks`, `ideas`, `ai_sessions`, `change_sets`;
- P0-B: `calendar_connections`, `calendar_busy_slots`, `calendar_event_links`, `jobs`;
- P1: `telegram_connections`, `notification_preferences`, `webhook_events`;
- P2: `goals`, `projects`, `graph_edges`;
- P3: `entitlements`, `stripe_customers`, `ai_adaptation_metrics`, `focus_sessions`.

Міграції додаються вперед-назад із collection rules, required indexes і rollback. Час зберігається в UTC, timezone користувача — окремим IANA identifier.

## 7. AI і scheduler

AI відповідає за транскрипцію, семантичну класифікацію, оцінку атрибутів, пропозицію зв'язків і людське пояснення. Модель та prompt version задаються env/config і записуються в `ai_sessions`.

Scheduler є чистою функцією з фіксованим clock у тестах. Вхід: tasks, busy slots, profile, timezone, current time. Вихід: planned blocks, unscheduled tasks, warnings і machine-readable reasons. Locked events ніколи не рухаються; flexible tasks можна переносити; неможливий день повертає overload замість прихованого ущільнення.

AI не пише в PocketBase напряму і не створює Calendar events без перевіреного Change Set.

## 8. Інтеграції

### Google

PocketBase OAuth використовується для входу. Calendar consent виконується окремим серверним OAuth flow одразу після входу, щоб надійно отримати offline refresh token. Токен шифрується на Gateway і зберігається в server-only collection. Спочатку інтеграція читає busy slots; потім додаються app-owned events і two-way sync.

### Telegram

Telegram-акаунт прив'язується одноразовим expiring deep link. Webhook перевіряє secret header, dedupe виконується за update ID. Текст і voice використовують той самий capture service, що й веб.

### Stripe

Checkout Session створює лише Gateway. Lifetime Pro активується тільки після перевіреного webhook. Event ID має unique index, а повторна доставка не змінює entitlement вдруге.

## 9. Надійність і demo safety

- Кожен gate окремо деплоїться і проходить E2E.
- Незавершені функції вимкнені через server-controlled feature flags.
- Demo account і контрольований brain dump готуються заздалегідь, але не підміняють реальні інтеграції.
- Draft не губиться при reload, AI timeout або offline.
- Request ID проходить через frontend, Gateway, AI session і job logs.
- Вебхуки та jobs idempotent.
- Основний flow має fixture-based fallback тільки для локальних тестів; production не видає mock за реальний AI.
- У демо називаються лише функції, що пройшли production smoke test.

## 10. Стратегія трьох днів

### День 1

P0-A до першого production deploy: Gateway/PocketBase skeleton, text Brain Dump, structured AI, scheduler, Today, persistence. Після цього — voice.

### День 2

Завершення P0-A: edit/complete/Undo, mobile E2E, помилки. Потім P0-B: Google sign-in, busy slots і Calendar-aware scheduling.

### День 3

Спочатку production hardening і репетиція демо. Далі функції беруться строго по вертикальних зрізах: auto-reschedule → Telegram capture/notification → Oracle path → Stripe. Жодна функція не залишається напіввидимою.

## 11. Gate rule

Наступний gate починається лише коли попередній:

1. проходить unit/integration/E2E тести;
2. працює на production URL у mobile viewport;
3. не має blocker/critical дефектів;
4. має зрозумілий loading/error/empty/Undo UX;
5. може бути продемонстрований без відкриття devtools або ручного редагування бази.

Це правило не видаляє функції з roadmap. Воно захищає оцінюваний core від ризику, що велика кількість паралельних інтеграцій зробить продукт нестабільним.
