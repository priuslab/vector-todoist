# Вектор Full Product Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task. Use `superpowers:test-driven-development` for every behavior change and `superpowers:verification-before-completion` before every release gate.

**Goal:** Побудувати повний mobile-first AI-планер «Вектор», не скорочуючи цільовий scope, але спочатку довести до production-ready стану конкурсний сценарій `Brain Dump → AI → задачі → план на сьогодні`, а потім додавати Google Calendar, Telegram, Oracle, Stripe та інші функції у строгому порядку.

**Architecture:** Наявний React/Vite frontend у `prototype/` деплоїться на Vercel. Fastify/TypeScript Gateway оркеструє AI, scheduler та інтеграції. PocketBase на VPS забезпечує Google auth і базу. Gateway і PocketBase працюють у Docker за Caddy. AI лише структурує та пояснює; чистий детермінований scheduler розміщує задачі. Усі зовнішні зміни оформлюються idempotent Change Sets із Undo.

**Tech Stack:** React 19, Vite 6, Vitest, Testing Library, Fastify, TypeScript, Zod, PocketBase, Google Gemini API, Google Calendar API, Telegram Bot API, Stripe Test Mode, Docker Compose, Caddy, Vercel, Playwright.

## Global Constraints

- Увесь UI, AI copy, Telegram copy, помилки та empty states — українською.
- Підтримувана ширина — 360–430 px; desktop показує центрований mobile shell.
- Зберегти затверджений дизайн і fixed bottom action-footer.
- Одна головна дія на екрані; touch target не менше 44×44 px.
- AI не пише в базу і Calendar напряму.
- Scheduler не викликає AI та не залежить від мережі.
- Voice draft зберігається до успішної транскрипції; аудіо видаляється після завершення/timeout.
- User-owned PocketBase collections завжди мають collection rules.
- Будь-який webhook і background job idempotent.
- Незавершені модулі приховані feature flags; вони не можуть ламати P0.
- Не починати наступний gate, доки попередній не пройшов production mobile smoke test.
- Не комітити `.env`, PocketBase `pb_data`, аудіофайли, `node_modules`, `dist` або screenshots поза QA evidence.

## Release Gates And Stop Rules

| Gate | Що має працювати | Чи можна показувати в демо |
|---|---|---|
| P0-A | Text/voice Brain Dump → AI → tasks → scheduler → Today → edit/Undo | Так, це обов'язкове конкурсне ядро |
| P0-B | Google login, busy slots, Calendar-aware plan, app-owned blocks | Так, після production smoke |
| P1 | Auto-reschedule, Telegram, two-way Calendar, daily rituals | Тільки завершені вертикальні зрізи |
| P2 | Goals/Ideas/Projects, Oracle, Balanced/Goal Focus | Тільки якщо граф і Undo стабільні на mobile |
| P3 | Stripe, Pomodoro, adaptation, analytics, polish | Тільки після повного webhook/E2E тесту |

Якщо часу бракує, зупинити роботу на останньому завершеному gate. Функції не видаляються з roadmap; їхні flags залишаються `false`.

---

## Phase 0 — Baseline And Guardrails

### Task 1: Зафіксувати baseline, repo hygiene і спільні команди

**Files:**

- Modify: `.gitignore`
- Create: `.env.example`
- Modify: `prototype/package.json`
- Create: `prototype/src/config/featureFlags.js`
- Test: `prototype/src/config/featureFlags.test.js`

**Step 1: Запустити baseline до змін**

Run:

```bash
npm --prefix prototype test
npm --prefix prototype run build
```

Expected: усі наявні тести проходять; Vite build завершується з exit 0. Якщо ні — зупинити план і застосувати `superpowers:systematic-debugging`.

**Step 2: Написати failing test для flags**

Перевірити, що невідомий або відсутній env flag повертає `false`, а значення `true` — `true`.

```js
expect(isFeatureEnabled('VITE_FEATURE_TELEGRAM', {})).toBe(false)
expect(isFeatureEnabled('VITE_FEATURE_TELEGRAM', { VITE_FEATURE_TELEGRAM: 'true' })).toBe(true)
```

Run: `npm --prefix prototype test -- featureFlags.test.js`  
Expected: FAIL — module does not exist.

**Step 3: Реалізувати мінімальний parser**

Експортувати `isFeatureEnabled(name, env = import.meta.env)` і frozen `FEATURES` для `calendar`, `telegram`, `oracle`, `stripe`, `goalFocus`, `pomodoro`, `adaptation`.

**Step 4: Додати hygiene**

Ігнорувати `.env*` із винятком `!.env.example`, `node_modules/`, `dist/`, `pb_data/`, тимчасове аудіо, Playwright artifacts. Додати `test:e2e` script, який пізніше викликатиме Playwright.

**Step 5: Verify і commit**

Run:

```bash
npm --prefix prototype test
npm --prefix prototype run build
git diff --check
```

Expected: PASS, PASS, no whitespace errors.

Commit:

```bash
git add .gitignore .env.example prototype/package.json prototype/src/config/featureFlags.js prototype/src/config/featureFlags.test.js
git commit -m "chore: establish product implementation guardrails"
```

### Task 2: Створити Fastify Gateway skeleton

**Files:**

- Create: `gateway/package.json`
- Create: `gateway/package-lock.json`
- Create: `gateway/tsconfig.json`
- Create: `gateway/vitest.config.ts`
- Create: `gateway/.env.example`
- Create: `gateway/src/config.ts`
- Create: `gateway/src/app.ts`
- Create: `gateway/src/server.ts`
- Create: `gateway/src/plugins/requestContext.ts`
- Test: `gateway/test/health.test.ts`
- Test: `gateway/test/config.test.ts`

**Step 1: Написати failing health test**

За допомогою `app.inject()` очікувати `GET /health` → `200` і:

```json
{"status":"ok","service":"vector-gateway"}
```

Відповідь не має містити env values.

Run: `npm --prefix gateway test -- health.test.ts`  
Expected: FAIL — package/app missing.

**Step 2: Додати залежності**

Runtime: `fastify`, `@fastify/cors`, `@fastify/rate-limit`, `zod`, `pino`. Dev: `typescript`, `tsx`, `vitest`, `@types/node`.

Scripts: `dev`, `build`, `start`, `test`, `typecheck`.

**Step 3: Реалізувати config і app factory**

`loadConfig()` має fail-fast перевіряти `NODE_ENV`, `HOST`, `PORT`, `PUBLIC_WEB_ORIGIN`, `POCKETBASE_URL`; optional integration secrets не повинні блокувати P0, доки відповідний flag вимкнений.

`buildApp({ config, services })` повертає Fastify instance без автоматичного `listen()`. `server.ts` лише викликає `listen()`.

**Step 4: Додати request ID, CORS і rate limit**

Дозволити тільки `PUBLIC_WEB_ORIGIN`; використовувати `request.id`; `trustProxy` увімкнути лише через явний env.

**Step 5: Verify і commit**

Run:

```bash
npm --prefix gateway test
npm --prefix gateway run typecheck
npm --prefix gateway run build
```

Expected: PASS for all commands.

Commit: `feat: scaffold secure Fastify gateway`

### Task 3: Підняти PocketBase і core schema

**Files:**

- Create: `pocketbase/Dockerfile`
- Create: `pocketbase/pb_migrations/1784332800_core_collections.js`
- Create: `pocketbase/pb_migrations/1784332860_core_indexes.js`
- Create: `deploy/docker-compose.yml`
- Create: `deploy/Caddyfile.fragment`
- Create: `deploy/.env.example`
- Create: `scripts/check-pocketbase-rules.mjs`
- Test: `gateway/test/pocketbaseSchema.test.ts`

**Step 1: Написати schema contract test**

Тест читає migration source і перевіряє наявність колекцій `work_profiles`, `brain_dumps`, `tasks`, `ideas`, `ai_sessions`, `change_sets` та чотирьох правил доступу з `@request.auth.id` для кожної user-owned collection.

Run: `npm --prefix gateway test -- pocketbaseSchema.test.ts`  
Expected: FAIL — migration missing.

**Step 2: Створити core collections**

Мінімальні required fields:

- `work_profiles`: user, timezone, workDays, workStart, workEnd, quietStart, quietEnd, energyPeak, focusBlockMinutes, dailyLimitMinutes;
- `brain_dumps`: user, source, kind, rawText, transcript, status, errorCode;
- `tasks`: user, title, description, status, priority, deadline, plannedStart, plannedEnd, estimatedMinutes, actualMinutes, energy, flexible, locked, sourceDump, rescheduleCount;
- `ideas`: user, text, summary, status, sourceDump;
- `ai_sessions`: user, brainDump, model, promptVersion, confidence, resultJson, questionsJson, errorCode;
- `change_sets`: user, kind, status, beforeJson, afterJson, idempotencyKey, undoneAt.

Додати indexes для `user`, `status`, `deadline`, `plannedStart`, `idempotencyKey`.

**Step 3: Додати Docker і Caddy**

PocketBase та Gateway bind тільки до `127.0.0.1`. `pb_data` — named volume. Caddy routes `/api/*` і webhook paths до Gateway; PocketBase auth endpoint має окремий upstream path.

**Step 4: Запустити migration smoke**

Run: `docker compose -f deploy/docker-compose.yml config`  
Expected: valid configuration, no secret values printed.

Run: `node scripts/check-pocketbase-rules.mjs`  
Expected: `All user-owned collections have auth rules`.

**Step 5: Commit**

Commit: `feat: add PocketBase core schema and deployment skeleton`

### Task 4: Додати frontend API, auth state і production feature routing

**Files:**

- Create: `prototype/src/lib/apiClient.js`
- Create: `prototype/src/lib/apiError.js`
- Create: `prototype/src/auth/authStore.jsx`
- Create: `prototype/src/auth/pocketBaseOAuth.js`
- Create: `prototype/src/auth/AuthCallback.jsx`
- Modify: `prototype/src/App.jsx`
- Modify: `prototype/src/navigation/routes.js`
- Modify: `prototype/src/screens/ScreenRouter.jsx`
- Test: `prototype/src/lib/apiClient.test.js`
- Test: `prototype/src/auth/authStore.test.jsx`

**Step 1: Написати failing API tests**

Перевірити, що client:

- додає `Authorization` і `X-Request-Id`;
- не додає caller-controlled user ID;
- перетворює non-2xx на typed `ApiError`;
- виконує лише один refresh/retry на 401.

**Step 2: Реалізувати auth store**

Стани: `loading`, `anonymous`, `authenticated`, `expired`. Token зберігати через PocketBase auth store; UI не читає Google refresh token.

**Step 3: Реалізувати redirect PKCE**

`startGoogleLogin()` створює verifier/challenge, зберігає verifier у `sessionStorage` і переходить на Google URL. Callback обмінює code через PocketBase та очищує verifier навіть при помилці.

**Step 4: Перевести navigation з catalog-only на app mode**

Зберегти query `?screen=` для QA catalog, але production route визначати з auth/onboarding state. Feature-flagged screens не мають бути доступні прямим deep link.

**Step 5: Verify і commit**

Run: `npm --prefix prototype test && npm --prefix prototype run build`  
Expected: PASS.

Commit: `feat: connect frontend auth and API foundations`

---

## Phase P0-A — Competition Core

### Task 5: Реалізувати auth verification і repositories

**Files:**

- Create: `gateway/src/auth/verifyPocketBaseToken.ts`
- Create: `gateway/src/auth/requireUser.ts`
- Create: `gateway/src/pocketbase/client.ts`
- Create: `gateway/src/repositories/brainDumpRepository.ts`
- Create: `gateway/src/repositories/taskRepository.ts`
- Create: `gateway/src/repositories/ideaRepository.ts`
- Create: `gateway/src/repositories/changeSetRepository.ts`
- Test: `gateway/test/auth.test.ts`
- Test: `gateway/test/repositories.test.ts`

**Step 1: Написати failing auth tests**

Cases: missing token → 401; invalid/expired → 401; PocketBase unavailable → 401 fail-closed; valid → `request.user` із `userId` та email; cache TTL ≤60 seconds.

**Step 2: Реалізувати verifier**

Викликати PocketBase `/api/collections/users/auth-refresh`, ніколи не довіряти `userId` з body/query/header. Кеш ключується hash токена, а не raw token у logs.

**Step 3: Реалізувати repositories через interface**

Кожен repository приймає verified `userId`. `createTask` і `createIdea` завжди встановлюють user server-side. Методи list/update додатково перевіряють ownership.

**Step 4: Verify і commit**

Run: `npm --prefix gateway test -- auth.test.ts repositories.test.ts`  
Expected: PASS.

Commit: `feat: enforce PocketBase ownership in gateway`

### Task 6: Text Brain Dump draft і capture API

**Files:**

- Create: `gateway/src/modules/capture/captureSchemas.ts`
- Create: `gateway/src/modules/capture/captureService.ts`
- Create: `gateway/src/modules/capture/captureRoutes.ts`
- Modify: `gateway/src/app.ts`
- Create: `prototype/src/features/capture/captureApi.js`
- Modify: `prototype/src/features/capture/CaptureFlow.jsx`
- Modify: `prototype/src/features/capture/Transcript.jsx`
- Test: `gateway/test/captureRoutes.test.ts`
- Test: `prototype/src/features/capture/capture-live.test.jsx`

**Step 1: Написати failing route test**

Contract:

```http
POST /api/v1/brain-dumps
Authorization: <PocketBase token>
Content-Type: application/json

{"kind":"text","text":"Завтра подати заявку...","timezone":"Europe/Warsaw"}
```

Expected `201`:

```json
{"id":"...","status":"draft","rawText":"Завтра подати заявку..."}
```

Empty/over-limit text → 400; duplicated `Idempotency-Key` → same record.

**Step 2: Реалізувати draft-first service**

Ліміт тексту задати config, нормалізувати whitespace без втрати змісту, записати source `web`. AI ще не викликати.

**Step 3: Підключити UI**

Replace demo submit у `CaptureFlow` реальним create call. Показати `Збережено як чернетку`, offline retry і non-blocking error. Не очищати введення до `201`.

**Step 4: Verify і commit**

Run: `npm --prefix gateway test -- captureRoutes.test.ts && npm --prefix prototype test -- capture-live.test.jsx`  
Expected: PASS.

Commit: `feat: persist text brain dump drafts`

### Task 7: Structured AI analysis з confidence і clarification

**Files:**

- Create: `gateway/src/modules/ai/analysisSchema.ts`
- Create: `gateway/src/modules/ai/prompts/analyzeBrainDump.v1.ts`
- Create: `gateway/src/modules/ai/geminiClient.ts`
- Create: `gateway/src/modules/ai/analyzeBrainDump.ts`
- Create: `gateway/src/modules/ai/analysisRoutes.ts`
- Create: `gateway/test/fixtures/ai/clear-result.json`
- Create: `gateway/test/fixtures/ai/low-confidence-result.json`
- Create: `gateway/test/fixtures/ai/invalid-result.json`
- Test: `gateway/test/analyzeBrainDump.test.ts`
- Modify: `prototype/src/features/capture/AIProcessing.jsx`
- Modify: `prototype/src/features/capture/Clarification.jsx`
- Modify: `prototype/src/features/capture/AIResult.jsx`
- Test: `prototype/src/features/capture/ai-result-live.test.jsx`

**Step 1: Зафіксувати schema тестом**

Top-level result:

```ts
type BrainDumpAnalysis = {
  summary: string
  confidence: number
  questions: Array<{ id: string; text: string; field: string }>
  tasks: Array<{
    title: string
    description: string
    priority: 'low' | 'medium' | 'high' | 'urgent'
    estimatedMinutes: number
    deadline: string | null
    energy: 'low' | 'medium' | 'high'
    confidence: number
  }>
  ideas: Array<{ text: string; summary: string; confidence: number }>
  context: string[]
}
```

Reject unknown enum, negative duration, more than 2 questions, invalid ISO deadline, confidence outside 0..1.

**Step 2: Написати failing orchestration tests**

- clear fixture → no questions;
- low confidence → 1–2 critical questions;
- invalid result → one repair attempt;
- second invalid result → dump status `needs_attention`, raw text retained;
- model timeout → retryable error, no tasks created.

**Step 3: Реалізувати Gemini structured output**

Model name, temperature, timeout і prompt version — config. Передати JSON schema; thinking budget — 0 відповідно до playbook. Log only request ID, latency, model, token usage and outcome, never raw secret/token.

**Step 4: Реалізувати routes**

- `POST /api/v1/brain-dumps/:id/analyze`
- `POST /api/v1/brain-dumps/:id/answers`
- `GET /api/v1/brain-dumps/:id/result`

Analysis створює `ai_session`, але ще не записує tasks до apply.

**Step 5: Підключити UI**

AIProcessing poll/status → Clarification лише якщо questions існують → AIResult preview. Показати не більше трьох insights.

**Step 6: Verify і commit**

Run:

```bash
npm --prefix gateway test -- analyzeBrainDump.test.ts
npm --prefix gateway run typecheck
npm --prefix prototype test -- ai-result-live.test.jsx
```

Expected: PASS.

Commit: `feat: analyze brain dumps with structured Gemini output`

### Task 8: Детермінований scheduling engine

**Files:**

- Create: `gateway/src/modules/scheduler/types.ts`
- Create: `gateway/src/modules/scheduler/splitTask.ts`
- Create: `gateway/src/modules/scheduler/scoreTask.ts`
- Create: `gateway/src/modules/scheduler/buildDailyPlan.ts`
- Create: `gateway/src/modules/scheduler/explainPlan.ts`
- Test: `gateway/test/scheduler/splitTask.test.ts`
- Test: `gateway/test/scheduler/scoreTask.test.ts`
- Test: `gateway/test/scheduler/buildDailyPlan.test.ts`
- Test: `gateway/test/scheduler/timezone.test.ts`

**Step 1: Написати failing pure-function tests**

Покрити:

- locked busy slots не змінюються;
- deadline/urgent task планується першою;
- high-energy task потрапляє в energy peak;
- великі задачі розбиваються за focus block;
- додаються breaks;
- daily limit не перевищується мовчки;
- те, що не вмістилося, повертається в `unscheduled`;
- DST і timezone не змінюють абсолютну тривалість;
- однаковий input + clock дає byte-equivalent output.

Run: `npm --prefix gateway test -- scheduler`  
Expected: FAIL — modules missing.

**Step 2: Реалізувати API чистої функції**

```ts
buildDailyPlan({ tasks, busySlots, profile, now }): {
  blocks: PlannedBlock[]
  unscheduledTaskIds: string[]
  warnings: PlanWarning[]
  reasons: Record<string, ScheduleReason[]>
}
```

Не використовувати `Date.now()` усередині; `now` обов'язковий. Сортування має мати stable tie-breaker за task ID.

**Step 3: Реалізувати rule order**

Locked/busy → hard deadline → priority → goal alignment → energy fit → shortest viable slot. Breaks і daily cap застосовуються після split, до placement.

**Step 4: Verify і commit**

Run: `npm --prefix gateway test -- scheduler && npm --prefix gateway run typecheck`  
Expected: PASS.

Commit: `feat: add deterministic daily scheduling engine`

### Task 9: Apply Change Set і повний Brain Dump → Today flow

**Files:**

- Create: `gateway/src/modules/planning/planSchemas.ts`
- Create: `gateway/src/modules/planning/planService.ts`
- Create: `gateway/src/modules/planning/planRoutes.ts`
- Modify: `gateway/src/app.ts`
- Create: `prototype/src/features/today/todayApi.js`
- Modify: `prototype/src/features/capture/AIResult.jsx`
- Modify: `prototype/src/features/today/TodayScreens.jsx`
- Modify: `prototype/src/features/inbox/InboxScreens.jsx`
- Modify: `prototype/src/features/task/TaskScreens.jsx`
- Test: `gateway/test/planFlow.test.ts`
- Test: `prototype/src/features/today/today-live.test.jsx`
- Create: `prototype/e2e/core-flow.spec.js`

**Step 1: Написати failing integration test**

Flow: create dump → analyze fixture → apply → list today. Assert tasks мають priority/duration/deadline, scheduled blocks не перетинаються, ideas лишаються в Inbox, Change Set має before/after snapshot.

**Step 2: Реалізувати preview/apply contracts**

- `POST /api/v1/brain-dumps/:id/plan-preview`
- `POST /api/v1/change-sets/:id/apply`
- `GET /api/v1/today?date=YYYY-MM-DD&timezone=...`
- `GET /api/v1/inbox`
- `GET /api/v1/tasks/:id`

Apply має бути idempotent. Частково застосований Change Set заборонений.

**Step 3: Замінити demoData на API data для core screens**

Залишити `demoData.js` лише для Screen Catalog fixtures. Production app path не імпортує його.

**Step 4: Додати E2E**

У 390×844: ввести контрольований brain dump, пройти preview, застосувати, побачити задачі в Today. Mock Gemini дозволено лише через test dependency injection у Gateway, не через production flag.

**Step 5: Verify і commit**

Run:

```bash
npm --prefix gateway test -- planFlow.test.ts
npm --prefix prototype test -- today-live.test.jsx
npm --prefix prototype run test:e2e -- core-flow.spec.js
```

Expected: PASS.

Commit: `feat: complete brain dump to today vertical slice`

### Task 10: Реальний voice capture і транскрипція

**Files:**

- Create: `gateway/src/modules/transcription/transcriptionSchema.ts`
- Create: `gateway/src/modules/transcription/transcriptionService.ts`
- Create: `gateway/src/modules/transcription/audioStorage.ts`
- Create: `gateway/src/modules/transcription/transcriptionRoutes.ts`
- Modify: `gateway/src/app.ts`
- Modify: `prototype/src/features/capture/VoiceRecorder.jsx`
- Modify: `prototype/src/features/capture/CaptureFlow.jsx`
- Create: `prototype/src/hooks/useVoiceRecorder.js`
- Test: `gateway/test/transcription.test.ts`
- Test: `prototype/src/features/capture/voice-live.test.jsx`

**Step 1: Написати failing safety tests**

- supported audio → Ukrainian transcript;
- file over limit/unsupported MIME → 400;
- failure retains draft and marks retryable;
- success deletes temporary file;
- timeout cleanup deletes abandoned audio;
- auth and ownership required.

**Step 2: Реалізувати bounded temp storage**

Use random server filename, never client filename; allowlist MIME; max bytes and duration; cleanup in `finally`. Для production prefer memory/temporary volume; raw audio не пишеться в PocketBase.

**Step 3: Реалізувати transcription provider adapter**

Інтерфейс `transcribe({ bytes, mimeType, locale: 'uk-UA' })`. Gemini adapter конфігується окремим model env. Результат проходить text limit/normalization.

**Step 4: Підключити MediaRecorder UI**

Стани: permission request, recording, paused, uploading, transcribing, editable transcript, retry, unsupported browser. Завжди показати текстовий fallback.

**Step 5: Verify і commit**

Run:

```bash
npm --prefix gateway test -- transcription.test.ts
npm --prefix prototype test -- voice-live.test.jsx
```

Expected: PASS.

Commit: `feat: add Ukrainian voice brain dump transcription`

### Task 11: Task editing, completion і Undo

**Files:**

- Create: `gateway/src/modules/tasks/taskSchemas.ts`
- Create: `gateway/src/modules/tasks/taskService.ts`
- Create: `gateway/src/modules/tasks/taskRoutes.ts`
- Create: `gateway/src/modules/changeSets/undoService.ts`
- Create: `gateway/src/modules/changeSets/changeSetRoutes.ts`
- Modify: `prototype/src/features/task/TaskScreens.jsx`
- Modify: `prototype/src/features/today/TodayScreens.jsx`
- Modify: `prototype/src/components/UndoSnackbar.jsx`
- Test: `gateway/test/taskMutationUndo.test.ts`
- Test: `prototype/src/features/task/task-live.test.jsx`
- Modify: `prototype/e2e/core-flow.spec.js`

**Step 1: Написати failing mutation tests**

Edit allowed fields; reject invalid deadline/duration; complete task; double submit idempotent; other user's task → 404; Undo applied once; second Undo returns current state without duplicate changes.

**Step 2: Реалізувати patch/complete/undo**

- `PATCH /api/v1/tasks/:id`
- `POST /api/v1/tasks/:id/complete`
- `POST /api/v1/change-sets/:id/undo`

Кожна meaningful mutation створює Change Set. Undo ніколи не видаляє task history безповоротно.

**Step 3: Підключити UI**

Optimistic update лише з rollback. Snackbar розташований над fixed footer/bottom nav. Copy: `Зміни скасовано` / `План змінився — я знайшов новий час.`

**Step 4: Розширити E2E**

Після core flow відредагувати тривалість, завершити task, натиснути Undo, перевірити відновлення після reload.

**Step 5: Verify і commit**

Run all Gateway/frontend tests, build, E2E at 360×800 and 390×844.  
Expected: zero overlap, no horizontal scroll, state persists.

Commit: `feat: support task editing completion and undo`

### Task 12: P0-A production deploy і acceptance gate

**Files:**

- Create: `vercel.json`
- Create: `prototype/e2e/production-core.spec.js`
- Create: `docs/runbooks/deploy.md`
- Create: `docs/runbooks/core-demo.md`
- Create: `docs/qa/p0-a-acceptance.md`
- Modify: `deploy/docker-compose.yml`

**Step 1: Написати production smoke spec до deploy**

Spec приймає `PRODUCTION_BASE_URL`, не використовує localhost/mock, перевіряє landing, login test account, text capture, voice permission fallback, AI Result, Today, edit, Undo, reload.

**Step 2: Deploy Gateway/PocketBase**

Використати Docker Compose/Caddy; створити PocketBase superuser окремою one-time operation; налаштувати secrets поза repo; перевірити `/health`.

**Step 3: Deploy frontend to Vercel**

Root directory `prototype`; build `npm run build`; output `dist`; SPA rewrite to `/index.html`; production API URL у Vercel env.

**Step 4: Run acceptance**

Run:

```bash
npm --prefix prototype run test:e2e -- production-core.spec.js
curl -fsS https://API_DOMAIN/health
```

Expected: E2E PASS; health JSON status ok.

**Step 5: Gate review**

Не починати P0-B, доки немає:

- 0 blocker/critical defects;
- стабільного контрольованого brain dump;
- реального AI виклику;
- video/screenshot evidence на mobile;
- rollback note у deploy runbook.

Commit: `ops: document and verify P0 core deployment`

---

## Phase P0-B — Google Calendar Context

### Task 13: Google Calendar OAuth connection

**Files:**

- Create: `pocketbase/pb_migrations/1784332920_calendar_connections.js`
- Create: `gateway/src/crypto/encryptedSecret.ts`
- Create: `gateway/src/integrations/google/googleOAuth.ts`
- Create: `gateway/src/integrations/google/googleRoutes.ts`
- Create: `gateway/src/repositories/calendarConnectionRepository.ts`
- Modify: `gateway/src/config.ts`
- Modify: `prototype/src/features/onboarding/OnboardingFlow.jsx`
- Modify: `prototype/src/features/settings/IntegrationRows.jsx`
- Test: `gateway/test/googleOAuth.test.ts`
- Test: `prototype/src/features/settings/calendar-connection.test.jsx`

**Step 1: Написати OAuth state/encryption tests**

State single-use + expires; callback rejects mismatch; refresh token encrypted with AES-GCM; decryption fails closed with wrong key; browser response never includes refresh token.

**Step 2: Реалізувати routes**

- `POST /api/v1/integrations/google-calendar/start`
- `GET /api/v1/integrations/google-calendar/callback`
- `GET /api/v1/integrations/google-calendar/status`
- `DELETE /api/v1/integrations/google-calendar`

Scopes — мінімальні Calendar scopes. Offline access і consent prompt застосовуються лише коли connection відсутній.

**Step 3: Підключити onboarding/settings**

Після Google sign-in одразу показати Calendar permission. Skip дозволений, але пояснює, що planner не бачитиме зайняті слоти. Status має `Підключено`, `Потребує уваги`, `Вимкнено`.

**Step 4: Verify і commit**

Commit: `feat: connect Google Calendar with encrypted offline access`

### Task 14: Busy slots і Calendar-aware scheduling

**Files:**

- Create: `gateway/src/integrations/google/calendarClient.ts`
- Create: `gateway/src/modules/calendar/busySlotService.ts`
- Create: `gateway/src/modules/calendar/calendarRoutes.ts`
- Create: `gateway/src/repositories/calendarBusySlotRepository.ts`
- Modify: `gateway/src/modules/planning/planService.ts`
- Modify: `prototype/src/features/calendar/CalendarScreens.jsx`
- Test: `gateway/test/calendarBusySlots.test.ts`
- Test: `gateway/test/calendarAwarePlan.test.ts`
- Test: `prototype/src/features/calendar/calendar-live.test.jsx`

**Step 1: Написати failing busy-slot tests**

Multiple calendars merge overlapping intervals; all-day events block configured workday; declined events ignored; timezone normalized; expired token refreshes once; API failure keeps last sync and marks stale.

**Step 2: Реалізувати sync**

- `POST /api/v1/calendar/sync`
- `GET /api/v1/calendar/day?date=...`

Cache only normalized busy slots, not private Google descriptions. Planner receives busy intervals plus `stale` warning.

**Step 3: Inject busy slots into scheduler**

Calendar unavailable must not erase plan. If no fresh slots, show explicit warning and require user confirmation before applying potentially conflicting blocks.

**Step 4: Verify і commit**

Commit: `feat: schedule around Google Calendar busy time`

### Task 15: App-owned Calendar blocks і sync status

**Files:**

- Create: `pocketbase/pb_migrations/1784332980_calendar_event_links_jobs.js`
- Create: `gateway/src/modules/calendar/calendarEventService.ts`
- Create: `gateway/src/modules/jobs/jobRepository.ts`
- Create: `gateway/src/modules/jobs/jobRunner.ts`
- Modify: `gateway/src/modules/planning/planService.ts`
- Modify: `prototype/src/features/calendar/EventSheet.jsx`
- Modify: `prototype/src/features/task/TaskScreens.jsx`
- Test: `gateway/test/calendarEventSync.test.ts`
- Test: `gateway/test/jobRunner.test.ts`

**Step 1: Написати idempotency tests**

Apply creates one event per planned block; retry reuses event link; Calendar failure stores retry job; task remains valid with `sync_pending`; delete app event makes task unscheduled, not deleted.

**Step 2: Реалізувати outbox-style jobs**

DB state і pending job записуються до зовнішнього API call. Job має unique idempotency key, attempts, nextRunAt, lastError. Один VPS instance використовує DB lease; Redis не потрібен для MVP.

**Step 3: Показати status у UI**

`Синхронізовано`, `Очікує синхронізації`, `Потрібне повторне підключення`. Retry action не дублює event.

**Step 4: Production smoke і commit**

Commit: `feat: create reliable app-owned calendar blocks`

---

## Phase P1 — Daily Assistant And Telegram

### Task 16: Auto-reschedule future flexible work with Undo

**Files:**

- Create: `gateway/src/modules/rescheduling/rescheduleService.ts`
- Create: `gateway/src/modules/rescheduling/rescheduleRoutes.ts`
- Modify: `gateway/src/modules/scheduler/buildDailyPlan.ts`
- Modify: `prototype/src/features/today/TodayScreens.jsx`
- Modify: `prototype/src/components/UndoSnackbar.jsx`
- Test: `gateway/test/autoReschedule.test.ts`
- Test: `prototype/src/features/today/reschedule.test.jsx`

**Step 1: Написати invariants tests**

Past blocks, completed, locked і Google events не рухаються; future flexible blocks can move; exact diff returned; overload leaves tasks unscheduled; Undo restores task times and queues compensating Calendar sync.

**Step 2: Реалізувати preview/apply**

- `POST /api/v1/plans/reschedule-preview`
- `POST /api/v1/plans/reschedule`

UI показує `що змінилося` до apply і Undo після apply.

**Step 3: Verify і commit**

Commit: `feat: reschedule flexible tasks with undo`

### Task 17: Two-way Calendar sync

**Files:**

- Create: `gateway/src/integrations/google/calendarWatch.ts`
- Create: `gateway/src/modules/calendar/calendarWebhookRoutes.ts`
- Create: `gateway/src/modules/calendar/calendarReconcileService.ts`
- Modify: `gateway/src/modules/jobs/jobRunner.ts`
- Test: `gateway/test/calendarWebhook.test.ts`
- Test: `gateway/test/calendarReconcile.test.ts`

**Step 1: Написати webhook/reconcile tests**

Validate channel/resource; duplicate notification ignored; moved event updates task; deleted event unschedules task; app-originated echo does not loop; expired watch renewed by job.

**Step 2: Реалізувати watch + reconcile**

Webhook only queues reconciliation and responds quickly. Reconcile reads current event version and applies idempotent Change Set.

**Step 3: Production smoke і commit**

Commit: `feat: synchronize app calendar blocks both ways`

### Task 18: Telegram pairing і shared text/voice capture

**Files:**

- Create: `pocketbase/pb_migrations/1784333040_telegram_notifications.js`
- Create: `gateway/src/integrations/telegram/telegramClient.ts`
- Create: `gateway/src/integrations/telegram/pairingService.ts`
- Create: `gateway/src/integrations/telegram/telegramWebhookRoutes.ts`
- Create: `gateway/src/integrations/telegram/telegramCaptureHandler.ts`
- Modify: `prototype/src/features/onboarding/TelegramSetup.jsx`
- Modify: `prototype/src/features/settings/IntegrationRows.jsx`
- Test: `gateway/test/telegramPairing.test.ts`
- Test: `gateway/test/telegramCapture.test.ts`

**Step 1: Написати security tests**

Pair token single-use/expiring; webhook secret required; duplicate update ID ignored; unpaired chat gets safe instruction; voice file limits enforced; Telegram text and web text produce same analysis schema.

**Step 2: Реалізувати pairing**

- `POST /api/v1/integrations/telegram/pair-link`
- `GET /api/v1/integrations/telegram/status`
- `DELETE /api/v1/integrations/telegram`
- `POST /webhooks/telegram`

**Step 3: Reuse capture service**

Telegram handler лише адаптує update → `captureService`; не дублює AI prompt/scheduler. Reply містить summary та inline buttons `Відкрити план`, `Залишити як ідею`, `Undo`.

**Step 4: Production smoke і commit**

Commit: `feat: capture text and voice through Telegram`

### Task 19: Telegram reminders, rituals і quiet hours

**Files:**

- Create: `gateway/src/modules/notifications/notificationPolicy.ts`
- Create: `gateway/src/modules/notifications/notificationJobs.ts`
- Create: `gateway/src/modules/notifications/telegramTemplates.uk.ts`
- Modify: `gateway/src/modules/jobs/jobRunner.ts`
- Modify: `prototype/src/features/settings/SettingsScreens.jsx`
- Test: `gateway/test/notificationPolicy.test.ts`
- Test: `gateway/test/notificationJobs.test.ts`

**Step 1: Написати policy tests**

Quiet hours suppress non-critical messages; timezone correct; one reminder per task/version; morning/evening exactly once per local date; overdue copy is supportive; reschedule summary contains Undo link.

**Step 2: Реалізувати templates**

Не використовувати shame language. Приклад: `План змінився — я знайшов новий час.` і `5 задач потребують нового місця в плані.`

**Step 3: Verify і commit**

Commit: `feat: add calm Telegram reminders and daily rituals`

### Task 20: Mobile Calendar Day/Week і overload states

**Files:**

- Modify: `prototype/src/features/calendar/CalendarScreens.jsx`
- Modify: `prototype/src/features/calendar/CalendarTimeline.jsx`
- Modify: `prototype/src/features/calendar/EventSheet.jsx`
- Modify: `prototype/src/styles/calendar.css`
- Test: `prototype/src/features/calendar/calendar-interactions.test.jsx`
- Create: `prototype/e2e/calendar-mobile.spec.js`

**Step 1: Написати interaction tests**

Horizontal date strip, day/week segment, task vs locked event affordance, drag only flexible app tasks, keyboard-accessible alternative through EventSheet, overload warning.

**Step 2: Підключити live endpoints**

Day/week reads actual tasks/busy slots. Drag calls task mutation, shows pending sync and Undo.

**Step 3: Verify mobile і commit**

360×800 та 430×932, no horizontal page overflow; timeline may pan only inside owned container.

Commit: `feat: complete mobile calendar planning experience`

---

## Phase P2 — Goals, Ideas And Oracle

### Task 21: Goal, Project, Idea і Graph Edge domain

**Files:**

- Create: `pocketbase/pb_migrations/1784333100_goal_graph_domain.js`
- Create: `gateway/src/modules/goals/goalSchemas.ts`
- Create: `gateway/src/modules/goals/goalService.ts`
- Create: `gateway/src/modules/goals/goalRoutes.ts`
- Create: `gateway/src/modules/graph/graphService.ts`
- Create: `gateway/src/modules/graph/graphRoutes.ts`
- Create: `gateway/src/repositories/goalGraphRepository.ts`
- Modify: `prototype/src/features/goals/GoalScreens.jsx`
- Modify: `prototype/src/features/inbox/IdeaProjectScreens.jsx`
- Test: `gateway/test/goalGraphDomain.test.ts`
- Test: `prototype/src/features/goals/goals-live.test.jsx`

**Step 1: Написати domain tests**

Free user can create one active goal; idea remains idea until explicit conversion; graph edge can be user/AI and proposed/confirmed/rejected; deleting edge never deletes nodes; cycles/many-to-many allowed.

**Step 2: Реалізувати CRUD і conversion**

- `/api/v1/goals`
- `/api/v1/ideas/:id/convert-preview`
- `/api/v1/ideas/:id/convert`
- `/api/v1/projects`
- `/api/v1/graph`

Conversion uses Change Set and Undo. AI-suggested edges remain recommendations.

**Step 3: Extend AI schema safely**

AI may propose goal/project/link fields, but missing optional fields must not break P0 fixture compatibility. Version prompt to v2.

**Step 4: Verify і commit**

Commit: `feat: add goals projects ideas and graph relations`

### Task 22: Alignment score і Oracle path API

**Files:**

- Create: `gateway/src/modules/oracle/alignmentScore.ts`
- Create: `gateway/src/modules/oracle/pathFinder.ts`
- Create: `gateway/src/modules/oracle/oracleService.ts`
- Create: `gateway/src/modules/oracle/oracleRoutes.ts`
- Test: `gateway/test/oracleAlignment.test.ts`
- Test: `gateway/test/oraclePath.test.ts`

**Step 1: Написати deterministic score/path tests**

Confirmed links weigh more than AI suggestions; completed nodes stay visible but muted; shortest useful path has stable tie-breaker; missing path returns explanation, not fabricated edge; deadline work is not scored as morally bad.

**Step 2: Реалізувати API**

- `GET /api/v1/oracle/graph`
- `GET /api/v1/oracle/path?fromType=idea&fromId=...&goalId=...`
- `GET /api/v1/oracle/insight`

AI може сформувати коротке explanation лише на основі machine-readable path result.

**Step 3: Verify і commit**

Commit: `feat: calculate goal alignment and oracle paths`

### Task 23: Mobile Obsidian-style Oracle graph

**Files:**

- Modify: `prototype/src/features/oracle/OracleGraph.jsx`
- Modify: `prototype/src/features/oracle/OracleFilters.jsx`
- Modify: `prototype/src/features/oracle/OracleScreens.jsx`
- Create: `prototype/src/features/oracle/useGraphViewport.js`
- Modify: `prototype/src/styles/oracle.css`
- Test: `prototype/src/features/oracle/oracle-live.test.jsx`
- Create: `prototype/e2e/oracle-mobile.spec.js`

**Step 1: Написати UI behavior tests**

Load graph, filter node types, select idea, show path, dim unrelated nodes, open bottom sheet, reset viewport. Reduced motion disables animated stabilization. Controls remain one-hand reachable.

**Step 2: Підключити live graph**

Use Canvas/SVG library only after measuring bundle cost. Node positions may persist per user. Graph viewport consumes gestures, but page shell must not create unintended zoom/scroll conflict.

**Step 3: Visual QA**

At 360×800, labels readable after selection, filters accessible, active route obvious without color alone, goal/project/idea/task/completed visually distinct.

**Step 4: Commit**

Commit: `feat: render interactive mobile oracle graph`

### Task 24: Balanced і Goal Focus modes

**Files:**

- Create: `gateway/src/modules/focus/focusModeService.ts`
- Create: `gateway/src/modules/focus/focusModeRoutes.ts`
- Modify: `gateway/src/modules/scheduler/scoreTask.ts`
- Modify: `prototype/src/features/focus/FocusScreens.jsx`
- Modify: `prototype/src/features/today/TodayScreens.jsx`
- Test: `gateway/test/focusModes.test.ts`
- Test: `prototype/src/features/focus/focus-live.test.jsx`

**Step 1: Написати safety tests**

Balanced default; Goal Focus defers unrelated flexible work; hard deadlines remain visible; nothing deleted; preview lists deferred tasks; apply creates Change Set; Undo restores prior mode/plan.

**Step 2: Реалізувати preview/apply**

- `POST /api/v1/focus/preview`
- `POST /api/v1/focus/apply`

**Step 3: Verify і commit**

Commit: `feat: add balanced and goal focus planning modes`

---

## Phase P3 — Monetization, Focus And Adaptation

### Task 25: Stripe Lifetime Pro entitlement

**Files:**

- Create: `pocketbase/pb_migrations/1784333160_stripe_entitlements.js`
- Create: `gateway/src/integrations/stripe/stripeClient.ts`
- Create: `gateway/src/integrations/stripe/checkoutRoutes.ts`
- Create: `gateway/src/integrations/stripe/stripeWebhookRoutes.ts`
- Create: `gateway/src/repositories/entitlementRepository.ts`
- Modify: `prototype/src/features/goals/PaywallScreens.jsx`
- Modify: `prototype/src/features/goals/GoalScreens.jsx`
- Test: `gateway/test/stripeCheckout.test.ts`
- Test: `gateway/test/stripeWebhook.test.ts`
- Test: `prototype/src/features/goals/paywall-live.test.jsx`

**Step 1: Написати webhook-first tests**

Client success URL does not grant Pro; signed `checkout.session.completed` does; wrong price/mode rejected; repeated event ID ignored; event out of order safe; entitlement lookup gates second goal.

**Step 2: Реалізувати checkout**

- `POST /api/v1/billing/checkout`
- `GET /api/v1/billing/status`
- `POST /webhooks/stripe`

Allowed price ID read from server config only. Checkout metadata includes verified PocketBase user ID. Use Stripe idempotency key.

**Step 3: Підключити paywall**

Second goal → paywall. $100 Lifetime Pro. Test Mode clearly marked only in internal/demo copy where appropriate. Return from Checkout polls status until verified webhook.

**Step 4: Production Test Mode smoke і commit**

Commit: `feat: unlock unlimited goals with lifetime pro`

### Task 26: Pomodoro/Focus Mode

**Files:**

- Create: `pocketbase/pb_migrations/1784333220_focus_sessions.js`
- Create: `gateway/src/modules/focusSessions/focusSessionRoutes.ts`
- Modify: `prototype/src/features/focus/FocusScreens.jsx`
- Create: `prototype/src/hooks/usePersistentTimer.js`
- Test: `gateway/test/focusSessions.test.ts`
- Test: `prototype/src/features/focus/pomodoro.test.jsx`

**Step 1: Написати timer persistence tests**

Reload/background uses absolute end timestamp; pause/resume accurate; session linked to task; notification permission optional; completing focus session does not auto-complete task without confirmation.

**Step 2: Реалізувати minimal Focus Mode**

One task, timer, pause, finish, low-noise UI. Persist server session start/end and actual minutes.

**Step 3: Verify і commit**

Commit: `feat: add persistent pomodoro focus sessions`

### Task 27: Behavioral adaptation і execution analytics

**Files:**

- Create: `pocketbase/pb_migrations/1784333280_adaptation_metrics.js`
- Create: `gateway/src/modules/adaptation/adaptationService.ts`
- Create: `gateway/src/modules/adaptation/adaptationRoutes.ts`
- Modify: `gateway/src/modules/scheduler/buildDailyPlan.ts`
- Modify: `prototype/src/features/settings/SettingsScreens.jsx`
- Modify: `prototype/src/features/today/EveningReview.jsx`
- Test: `gateway/test/adaptation.test.ts`
- Test: `prototype/src/features/settings/adaptation.test.jsx`

**Step 1: Написати consent/control tests**

Insufficient data → no change; suggestions are explicit; user can accept/reject/reset; raw profile values never silently overwritten; actual vs estimated metrics ignore incomplete/cancelled sessions.

**Step 2: Реалізувати suggestions**

Calculate duration multiplier by task category/energy, preferred completion windows, reschedule patterns. Scheduler consumes only accepted adjustments.

**Step 3: Додати evening review**

Короткий підсумок без shame, максимум три insights, action to accept/update profile.

**Step 4: Verify і commit**

Commit: `feat: adapt plans from execution history with user control`

### Task 28: AI goal test protocol

**Files:**

- Create: `gateway/src/modules/ai/prompts/goalDiscovery.protocol.json`
- Create: `gateway/src/modules/goals/goalDiscoveryService.ts`
- Create: `gateway/src/modules/goals/goalDiscoveryRoutes.ts`
- Modify: `prototype/src/features/onboarding/GoalSetup.jsx`
- Test: `gateway/test/goalDiscovery.test.ts`
- Test: `prototype/src/features/goals/goal-discovery.test.jsx`

**Step 1: Gate on real protocol**

Не вмикати feature, доки користувацький протокол не доданий і не має `version`, questions, completion rule, output schema та safety copy. Missing protocol → flag remains false.

**Step 2: Test conversational bounds**

Session resumable, no diagnostic/medical claims, result remains suggestion, user can edit before creating goal.

**Step 3: Implement, verify, commit**

Commit: `feat: add versioned AI goal discovery flow`

---

## Phase 4 — Final Production Readiness

### Task 29: Security, failure and accessibility audit

**Files:**

- Create: `docs/qa/security-checklist.md`
- Create: `docs/qa/accessibility-checklist.md`
- Create: `prototype/e2e/failure-states.spec.js`
- Create: `prototype/e2e/accessibility.spec.js`
- Modify: affected source files only when a failing test proves the issue

**Step 1: Security checks**

- auth ownership across every route;
- CORS allowlist;
- rate limits for auth, AI, voice, webhooks;
- no secret/token/raw audio in logs or client bundles;
- Stripe/Telegram/Google signature/state validation;
- PocketBase rules verified;
- dependency audit reviewed, not auto-fixed blindly.

**Step 2: Failure matrix**

Test slow/offline network, Gemini timeout/invalid JSON, Calendar token expiry/quota, Telegram retry, Stripe duplicate/out-of-order event, no available slots, DST, long Ukrainian input, denied microphone.

**Step 3: Accessibility/mobile matrix**

360×800, 390×844, 430×932; keyboard; screen reader names; reduced motion; 200% text zoom; contrast; fixed footer with keyboard/safe area; graph alternative list.

**Step 4: Verify і commit**

Commit: `test: harden security failures and accessibility`

### Task 30: Full production verification and demo package

**Files:**

- Create: `prototype/e2e/production-full-flow.spec.js`
- Modify: `docs/runbooks/core-demo.md`
- Create: `docs/runbooks/full-demo.md`
- Create: `docs/qa/final-release-report.md`
- Create: `docs/qa/known-limitations.md`

**Step 1: Run complete automated verification**

```bash
npm --prefix gateway test
npm --prefix gateway run typecheck
npm --prefix gateway run build
npm --prefix prototype test
npm --prefix prototype run build
npm --prefix prototype run test:e2e
git diff --check
```

Expected: every command exits 0.

**Step 2: Run production end-to-end**

На реальному телефоні та Playwright mobile viewport пройти:

1. Google login;
2. Calendar permission;
3. voice Brain Dump;
4. AI analysis/optional clarification;
5. tasks + Today + Calendar block;
6. edit/reschedule/Undo;
7. Telegram capture/reminder;
8. idea → Oracle path → Goal Focus;
9. Stripe Test Mode → second goal.

Кроки 7–9 включати у фінальне демо лише якщо їхні flags увімкнені й smoke test пройшов.

**Step 3: Prepare controlled demo data**

Створити окремий demo account, Calendar із передбачуваними busy slots, один український brain dump тривалістю до 30 секунд, Telegram test chat і Stripe test card. Не редагувати production DB вручну під час демонстрації.

**Step 4: Final review**

Застосувати `superpowers:requesting-code-review`; виправити Critical/Important findings; повторити всю verification suite; зафіксувати known limitations чесно.

**Step 5: Commit**

Commit: `docs: finalize production verification and demo runbook`

---

## Three-Day Execution Board

### День 1 — тільки P0-A vertical slice

1. Tasks 1–4: baseline, Gateway, PocketBase, frontend API/auth.
2. Tasks 5–7: draft, AI analysis, clarification.
3. Tasks 8–9: scheduler і Today.
4. Перший deploy одразу після text core flow.
5. Task 10 voice лише після стабільного text flow.

**End-of-day evidence:** production URL приймає текст, реальний AI повертає структуровані задачі, Today показує план.

### День 2 — завершити P0, потім Google

1. Tasks 10–12: voice, edit/complete/Undo, P0-A acceptance.
2. Tasks 13–15: Google Calendar permission, busy slots, app-owned blocks.
3. Повторний production smoke після кожної інтеграції.

**End-of-day evidence:** voice flow і Calendar-aware plan працюють на телефоні після reload.

### День 3 — hardening спочатку, extras потім

1. Перша година: Task 29 для P0 only, репетиція core demo.
2. Task 16 auto-reschedule — найцінніший P1 differentiator.
3. Tasks 18–19 Telegram, якщо bot credentials готові.
4. Tasks 21–23 Oracle vertical slice, якщо core/Telegram зелені.
5. Task 25 Stripe, якщо webhook domain і Test Price готові.
6. Решта P1–P3 продовжується за roadmap після інтенсиву або якщо паралельні агенти встигають завершити вертикальний зріз без ризику для core.
7. Останні дві години: freeze features, production verification, demo recording.

## Agent Ownership Recommendation

Для Subagent-Driven виконання розділити роботу так, але merge робити строго у порядку залежностей:

- **Core/API agent:** Tasks 2, 5–9, 11.
- **Frontend/mobile agent:** Tasks 4, 6–7 UI, 9–11 UI, E2E.
- **Integrations agent:** Tasks 3, 10, 13–19, 25.
- **Oracle/product agent:** Tasks 21–24, 26–28.
- **QA reviewer:** gate acceptance, security, accessibility, production smoke; не пише feature code до review.

Не запускати паралельно агентів, які редагують `gateway/src/app.ts`, `prototype/src/App.jsx` або одну migration. Перед кожною паралельною хвилею призначити file ownership і integration agent.

## Definition Of Done For Every Task

- failing test був зафіксований до implementation;
- мінімальний implementation зробив test green;
- related regression suite проходить;
- Ukrainian loading/error/empty/success states існують;
- no secrets/raw tokens у diff/logs;
- mobile layout перевірений, якщо змінено UI;
- API contract і collection rules перевірені;
- `git diff --check` чистий;
- commit містить лише файли цієї задачі;
- feature flag вмикається тільки після production smoke.
