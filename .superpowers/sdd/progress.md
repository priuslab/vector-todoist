# Vector Phase 0 SDD Progress

Branch: `feature/phase-0-foundations`
Plan: `docs/superpowers/plans/2026-07-18-vector-full-product-priority-roadmap.md`
Baseline: `6bb0526`; 33/33 frontend tests passing; frontend build passing.

Task 1: complete (`6bb0526..13c0a81`, review clean). Frontend: 39/39 tests and build pass; Playwright pinned to non-vulnerable 1.55.1; audit restored to baseline 2 findings.
Task 2: complete (`13c0a81..d217ec8`, review clean). Gateway: 47/47 tests, typecheck, build and audit (0 vulnerabilities) pass.
Task 3: complete (`d217ec8..baac047`, review clean). PocketBase schema/ownership validator + isolated Docker/Caddy config: 51/51 Gateway tests, typecheck/build, validator and Compose config pass. Runtime Docker migration smoke deferred because local daemon is unavailable; no Docker resources were changed.

Task 4: complete (`baac047..e6d0e7e`, review clean). Frontend auth/API foundations: 56/56 tests, production build and Playwright CLI smoke pass; OAuth callback is single-run, PKCE/state cleanup is covered, API auth retry is bounded, and production navigation respects feature flags.

Phase 0 complete and final whole-phase review READY (`6bb0526..6d7978c`). Frontend: 62/62 tests, build, Playwright CLI smoke, offline audit 0 vulnerabilities. Gateway: 52/52 tests, typecheck, build, offline audit 0 vulnerabilities. PocketBase ownership validator, Compose config and diff checks pass. Docker runtime migration smoke remains a manual deployment check because the local daemon is unavailable.

Task 5: complete (`6d7978c..889c91c`, review clean). Gateway auth verifier and ownership-scoped repositories: 61/61 tests, typecheck/build and audit pass. Includes fail-closed PocketBase auth, hashed bounded cache, request timeouts, runtime response validation, typed repository interfaces and server-side ownership enforcement.

Task 6: complete (`889c91c..4cab781`, review clean). Text Brain Dump draft API and UI wiring: Gateway 69/69 tests, frontend 64/64 tests, builds/typecheck/audit pass. Includes authenticated production server wiring, validated Ukrainian text drafts, durable user-scoped idempotency with reversible follow-up migration, safe errors, retry/preservation UX, and request-scoped PocketBase token propagation.

Task 7: complete (`4cab781..92dbb0c`, review clean). Structured AI analysis: Gateway 78/78 tests, frontend 69/69 tests, typecheck/build pass. Includes strict schema/fixtures, server-only Gemini adapter with timeout and thinking budget 0, one repair attempt, low-confidence clarification, persisted result routes, live CaptureFlow integration, no task/idea writes, and Ukrainian retry/error states.

Task 8: complete (`92dbb0c..6a3f5da`, review clean). Deterministic scheduler: 90/90 full Gateway tests, 12/12 scheduler tests, typecheck/build/audit pass. Includes locked/busy invariants, deadline/priority/goal/energy ordering, focus splitting, mandatory breaks, daily caps/unscheduled warnings, timezone/DST duration safety, stable deterministic output, now-clamping, overlap validation and per-task reasons.

Task 9: complete (`6a3f5da..9406621`, review clean). P0-A Brain Dump → Today vertical slice: Gateway 93/93 tests, frontend 70/70 tests, typecheck/build pass, E2E discoverable. Includes plan preview/apply, atomic-safe Change Set flow, durable idempotency, before/after snapshots, scoped repeat responses, strict response schemas, production no-demo states and local timezone Today date. Authenticated E2E fixture remains a deployment prerequisite.

Task 10: complete (`9406621..75d6712`, review clean). Ukrainian voice capture/transcription: Gateway 101/101 tests, frontend 73/73 tests, typecheck/build pass. Includes server-configured byte/duration/timeouts, Fastify body limit, MIME/auth checks, random temp storage/finally cleanup, provider timeout safety, cancel suppression, real elapsed timer, editable transcript/retry flow and MediaRecorder fallback.

Task 11: complete (`75d6712..d5832ce`, review clean). Task mutation/completion/Undo: Gateway 105/105 tests, frontend 74/74 tests, typecheck/build pass. Includes strict editable fields, numeric persisted versions, durable unique mutation reservations, cross-instance-safe conflicts, exactly-once Undo reservations, idempotent completion, ownership 404 and optimistic UI rollback.

Task 12: complete (`d5832ce..74638ac`, review clean). P0-A deployment/acceptance artifacts: Vercel SPA configs, fixture-gated production smoke, deploy/core-demo runbooks, acceptance checklist, server-only Gemini Compose wiring and fail-fast production config. Local suites/builds/Compose/rules checks pass; external production URL/auth/VPS smoke remains a documented prerequisite.

Task 13: complete (`74638ac..e83c46a`, review clean). Google Calendar OAuth connection: Gateway 111/111 tests, frontend 78/78 tests, typecheck/build pass. Includes AES-256-GCM encrypted refresh tokens, PKCE, bounded expiring single-use state, minimal `calendar.freebusy` scope, ownership routes, reversible connection migration, and Ukrainian onboarding/settings status/skip UX.

Task 14: complete (`e83c46a..bf8fa70`, review clean). Calendar busy slots and calendar-aware scheduling: Gateway 118/118 tests, frontend 80/80 tests, typecheck/build pass. Includes multi-calendar merge, declined/all-day/timezone handling, one-refresh retry, stale metadata/empty-sync preservation, strict responses, sync-before-day UI, and explicit confirmation for unsynced/stale calendars.

Task 15: complete (`bf8fa70..c60dd31`, review clean). App-owned Calendar blocks/outbox: Gateway 125/125 tests, frontend 80/80 tests, typecheck/build pass. Includes deterministic Google event IDs with 409 recovery, durable link/job reservations, single active job claims with expiring orphan reclaim, provider wiring, retry route/UI and task ownership rules.

Task 16: complete (`0b59ccf..9d63b55`, review clean). Auto-reschedule with Undo: Gateway 131/131 tests, frontend 81/81 tests, typecheck/build pass. Includes flexible-future-only moves, active/locked/completed/Google immutability, exact preview/apply diffs, strict schemas, durable pending guard, real Today refresh and authenticated Undo with batch preflight/compensation.

Task 17: complete (`9d63b55..181647f`, review clean). Two-way Calendar sync: Gateway 142/142 tests, typecheck/build pass. Includes secure watch/webhook validation, operational worker entry, resource-based paginated reconcile, moved/deleted event Change Sets, app-origin echo suppression, server-token worker repos, hash-only channel tokens and reversible migration.

Task 5: implementation complete pending review (`6d7978c..HEAD`). Gateway auth verification and ownership-scoped repositories: 58/58 tests, typecheck, build, and diff checks pass. Live PocketBase auth remains injectable/manual deployment coverage.

Task 6: implementation complete pending review (`889c91c..HEAD`). Text Brain Dump draft capture: authenticated validated API, normalization, server-side source/owner, per-user idempotency, safe storage errors, and mobile text capture wiring. Gateway 66/66 tests, typecheck/build; frontend 64/64 tests and build; diff check pass.

Task 7: implementation complete pending review (`4cab781..67d2bf5`). Structured AI analysis foundation: strict Zod contract, server-only Gemini adapter with JSON mode/thinking budget 0, bounded repair attempt, confidence/clarification orchestration, idempotent concurrent attempts, ownership-safe analyze/answers/result routes, AI session persistence without task/idea writes, and Ukrainian preview states. Gateway 77/77 tests, typecheck/build and diff check pass; frontend 67/67 tests and build pass. Network audit could not run offline.

Task 8: complete (`ae1fd10`). Pure deterministic daily scheduler with explicit task/profile/busy-slot types, stable priority/deadline/alignment ordering, timezone-aware local work windows, DST-safe absolute durations, task splitting, breaks, busy/locked obstacles, daily cap and unscheduled warnings, reasons, validation errors, no mutation, and deterministic output. Scheduler: 10/10 tests; Gateway: 88/88 tests, typecheck/build and diff checks pass.

Task 9: implementation complete pending review (`6a3f5da..HEAD`). P0-A Brain Dump → Today vertical slice: validated scheduler preview, pending Change Set snapshots, atomic/idempotent apply with rollback, authenticated Today/Inbox/task endpoints, and production mobile API wiring for AI result/apply and persisted plan reads. Gateway: 92/92 tests, typecheck/build; frontend: 70/70 tests and build. Playwright core flow is discoverable and skips unless `E2E_BASE_URL` plus `E2E_AUTH_TOKEN` point at a deterministic authenticated fixture.

Task 10: implementation complete pending review. Real Ukrainian voice capture foundation: authenticated raw/multipart audio upload, server-owned ephemeral storage with finally cleanup, MIME/size/duration limits, injected transcription adapter with server-side Gemini fallback, safe retryable errors, and mobile MediaRecorder permission/recording/paused/uploading/editable-transcript states. Gateway: 99/99 tests, typecheck/build; frontend: focused voice/capture tests and build pass; diff check pass.

Task 11: implementation complete pending review. Task edit/complete mutations with strict ownership, editable-field validation, optimistic version conflicts, durable user-owned manual Change Sets, idempotent completion, exactly-once Undo snapshot restore, and Ukrainian optimistic Today/task-detail UI with rollback, conflict/error and Undo states. Gateway: 104/104 tests, typecheck/build; frontend: 74/74 tests and build; E2E core flow extended for completion/Undo; diff check pass.

Task 13: implementation complete pending review. Google Calendar OAuth foundation: AES-256-GCM encrypted refresh tokens, expiring single-use PKCE state, minimal free/busy scope, injected provider exchange/revoke, authenticated user-owned status/start/delete routes, reversible PocketBase calendar connection migration, production secret validation, and Ukrainian onboarding/settings permission states. Gateway: 111/111 tests, typecheck/build; frontend: 78/78 tests and build; migration/rules/Compose/diff checks pass. Live Google credentials and Docker runtime smoke remain deployment prerequisites.

Task 15: implementation complete pending review. App-owned Calendar event links and outbox job foundations: idempotent event creation, durable sync-pending task state, missing-event unscheduling without deletion, bounded leased job runner/backoff, reversible PocketBase event-link/jobs migration, and Ukrainian sync statuses in Calendar/task detail. Gateway: 123/123 tests, build/typecheck; frontend: 80/80 tests and build. Live Google event provider and Docker runtime lease smoke remain deployment prerequisites.

Task 16: implementation complete pending review. Automatic future-flexible rescheduling with deterministic preview/apply, exact before/after diffs, immutable past/active/completed/locked/Google blocks, overload warnings, strict response schemas, durable idempotent reschedule Change Sets, atomic batch Undo with calendar compensation jobs, and explicit Ukrainian Today preview/apply/refresh/Undo UI. Gateway: 131/131 tests, typecheck/build; frontend: 81/81 tests and build pass.

Task 17: implementation complete pending review. Two-way Google Calendar sync foundation: random owned watch channels with renewal jobs, strict token/resource webhook validation and idempotent reconciliation queue, resource-list reconciliation with moved/deleted handling, app-origin echo suppression, owned Change Set snapshots, provider-version metadata, server-token worker repositories, explicit gateway webhook config, and VPS worker entry. Gateway: 141/141 tests, typecheck/build and diff checks pass; live Google watch/webhook and Docker runtime smoke remain deployment prerequisites.

Task 18: implementation complete pending review. Telegram pairing and shared capture: expiring hashed single-use deep links, ownership-scoped status/delete routes, constant-time webhook secret validation, atomic duplicate update claims, safe unpaired replies, text/voice adaptation into the existing capture/transcription services, bounded Telegram audio download, Ukrainian replies with non-executing inline actions, PocketBase migration (including unique pairing claims), and onboarding/settings wiring. Gateway: 150/150 tests, typecheck/build; frontend: 81/81 tests and build; PocketBase rules, Compose config and diff checks pass. Live Telegram Bot API and server runtime smoke remain deployment prerequisites.

Task 18: complete (`181647f..9d2905e`, review r4 PASS). Atomic pairing/dedupe and retry-safe Telegram webhook verified.

Task 19: complete (`9d2905e..50223e0`, review r2 PASS). Calm Telegram reminders/rituals with timezone quiet-hours policy, durable idempotent claims, worker dispatch, retry-safe Telegram client, and authenticated settings persistence. Gateway 159/159; frontend 81/81; typecheck/build pass.

Task 20: complete (`50223e0..7d4e724`, review r5 PASS). Mobile Calendar Day/Week with live timezone-safe data, locked-vs-flexible task affordances, EventSheet keyboard alternative, optimistic sync/Undo, overload/offline states, and empty-live-state safeguards. Prototype 87 tests; build PASS.

Task 21: complete (`7d4e724..e2a44be`, review r4 PASS). Goals/projects/ideas/graph domain with ownership-safe CRUD, one-goal entitlement gate, transactional idempotent idea conversion + Change Set/Undo, graph endpoint validation, AI proposed/confirmed audit, and backward-compatible AI schema v2. Gateway 163 tests; prototype 87 + goals-live; typecheck/build pass.

Task 22: complete (`e2a44be..0abe418`, review PASS). Deterministic Oracle alignment scores and shortest useful paths with confirmed/proposed weighting, completed-node muting, deadline-neutral logic, cycle/missing-path explanations, ownership-safe strict graph/path/insight APIs, and bounded AI fallback. Gateway 168 tests; typecheck/build pass.

Task 23: complete (`0abe418..972c31d`, review PASS). Live mobile SVG Oracle graph with filters/path dimming, semantic edges, node drag, one-hand viewport pan/zoom/reset, reduced-motion/list accessibility, per-user viewport persistence, router API wiring, and fixture-gated flow. Prototype Oracle 5/5; full 91/91; build PASS.

Task 24: complete (`972c31d..36811fd`, review r2 PASS). Balanced/Goal Focus scheduler mode with safe flexible-only deferrals, strict preview/apply, durable Change Set versions, generic authenticated Undo, Ukrainian mobile controls and UndoSnackbar. Gateway 171 tests; typecheck/build; prototype tests/build pass.

Task 25: complete (`36811fd..35aa26e`, review r3 PASS). Stripe Test Mode Lifetime Pro entitlement with server-only client, exact raw-body HMAC, webhook-first idempotent grants/retries, stable checkout idempotency, ownership/status/paywall polling, config/Compose wiring and paywall tests. Gateway 180 tests; prototype 94; typecheck/build pass.

Task 26: complete (`35aa26e..bf4c7159`, review r4 PASS). Persistent Pomodoro focus sessions with ownership-safe server lifecycle, active-session rehydration, per-run idempotency, paused-time-correct timer, durable version-scoped mutation claims for mixed races, optional notifications and no implicit task completion. Gateway 187 tests; frontend 97; typecheck/build pass.

Task 27: complete (`bf4c7159..70f5055`, review r5 PASS). Consent-controlled behavioral adaptation with bounded valid-session metrics, reschedule/window/category insights, accept/reject/reset, production server and planner wiring, live settings controls, and supportive max-three Evening Review. Gateway 190 tests; prototype 98; typecheck/build pass.

Task 28: complete (`70f5055..f69ad5a`, review r3 PASS). Versioned fail-closed AI goal discovery protocol with owned resumable sessions, bounded/safe structured suggestions, complete `{answers}` support, persistent editable suggestion PATCH, Ukrainian onboarding, and production dist/Docker protocol packaging. Gateway 193 tests; prototype 99; typecheck/build pass.

Task 29: complete (`f69ad5a..7bccd0e`, review final PASS). Security/failure/accessibility audit matrix, named checklists, fixture-gated mobile/Oracle/keyboard/reduced-motion/failure E2E specs with file-based auth fixture loading, and proven reduced-motion CSS hardening. Gateway 193 tests; prototype 99; builds/diff-check/rules pass; E2E collection clean with expected fixture skips.

Task 30: complete (`7bccd0e..7ed673b`, review PASS). Full verification/demo package: core/full demo runbooks, final release report, known limitations, production full-flow fixture-gated spec, and honest external prerequisite tracking. Gateway 193/193; prototype 99/99; typecheck/build, E2E collection (17 expected skips), rules and diff-check pass.

Task 1 (voice-and-brain-dump-save-fixes plan): complete (4cd71c1..2289f5f, review clean). CaptureFlow.jsx saveDraft now reports a real error instead of a false "Чернетку збережено" when the draft POST itself fails; dead retry button fixed. Frontend 156/156 tests pass.

Task 2 (voice-and-brain-dump-save-fixes plan): complete (ad7ca32..7ebf205, review clean). Gemini fallback in transcriptionService.ts and geminiClient.ts now retries the Flash-Lite model on HTTP 404 (model not found) in addition to 503; 429 still throws immediately. Gateway 233/233 tests pass.

Task 3 (voice-and-brain-dump-save-fixes plan): complete (7ebf205..af0ac6e, review clean, one Minor note: verification report used a JSON-parse check instead of the brief's literal `tsx watch --env-file` reproduction command — low risk, tsx 4.19.3 already supports Node flag pass-through). gateway/package.json "dev" script now loads .env via --env-file; "start"/"worker"/"build" untouched.
