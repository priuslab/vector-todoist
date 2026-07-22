# Final release report — Task 30

Цей документ є evidence sheet, а не декларацією готовності. Заповнюйте його
на конкретному commit перед демо. Невиконаний або skipped пункт залишається
таким у звіті.

## Build evidence

| Перевірка | Команда | Результат | Evidence |
| --- | --- | --- | --- |
| Gateway tests | `npm --prefix gateway test` | `[x] pass — 193 tests` | local run 2026-07-19 |
| Gateway typecheck | `npm --prefix gateway run typecheck` | `[x] pass` | local run 2026-07-19 |
| Gateway build | `npm --prefix gateway run build` | `[x] pass` | local run 2026-07-19 |
| Frontend tests | `npm --prefix prototype test` | `[x] pass — 99 tests` | local run 2026-07-19 |
| Frontend build | `npm --prefix prototype run build` | `[x] pass` | local run 2026-07-19 |
| Playwright collection/E2E | `npm --prefix prototype run test:e2e` | `[x] collected 17; 17 skipped` | no production fixture/browser run 2026-07-19 |
| Diff check | `git diff --check` | `[x] pass` | local run 2026-07-19 |
| PocketBase rules | `node scripts/check-pocketbase-rules.mjs` | `[x] pass` | local run 2026-07-19 |

## Production fixture

- Public web URL: `<non-local URL or “not available”>`
- Gateway URL: `<API URL or “not available”>`
- Commit: `<fill after Task 30 commit>`
- Run date/time: `<Europe/Warsaw timestamp>`
- Dedicated demo account: `[ ] created  [ ] not available`
- Auth state/token kept outside repository: `[ ] yes  [ ] no`
- Mobile screenshots: `<secure path or “not captured”>`

The fixture-gated spec is `prototype/e2e/production-full-flow.spec.js`.
Localhost, mock APIs, landing-only access and skipped tests are not production
passes. Required variables are documented in `docs/runbooks/full-demo.md`.

## Scenario checklist

- [ ] Google login and Calendar permission
- [ ] Voice Brain Dump (and Ukrainian text fallback after denied permission)
- [ ] Structured AI analysis / low-confidence clarification
- [ ] Task priority, duration, deadline and deterministic Today placement
- [ ] Google busy event remains locked; app block syncs
- [ ] Task edit and automatic future reschedule with visible Undo
- [ ] Telegram text + voice capture and notification policy
- [ ] Oracle graph, filters, path and accessible list
- [ ] Balanced default and Goal Focus with Undo
- [ ] Pomodoro start/pause/finish
- [ ] Stripe Test Mode webhook and second goal after Lifetime Pro

For each unchecked row, record a reason and owner in known limitations. Do not
show an unchecked capability as working in a judging demo.

## Failure-state evidence

| Failure | Expected result | Evidence |
| --- | --- | --- |
| Offline/slow API | Draft retained, Ukrainian retry/error, no duplicate mutation | `<test/log/screenshot>` |
| Gemini timeout/invalid JSON | No partial writes; retry | `<evidence>` |
| Calendar token/quota | Reconnect/retry; plan preserved | `<evidence>` |
| Telegram duplicate/transient retry | Idempotent duplicate; retryable transient error | `<evidence>` |
| Stripe duplicate/out-of-order | One entitlement; no premature activation | `<evidence>` |
| No realistic slot/DST | Inbox/next day explanation; local timezone | `<evidence>` |
| Microphone denied | Text fallback, no stuck recording | `<evidence>` |

## Rollback decision

- Frontend: rollback to previous green Vercel deployment.
- Gateway: rollback to previous image/tag with
  `docs/runbooks/deploy.md`; do not delete PocketBase data or migrations.
- After rollback: rerun `/health`, landing, core Brain Dump → Today → Undo
  smoke; record the new commit/deployment and incident reason here.

## Final decision

- Release status: `[ ] demo-ready  [x] core-only demo  [ ] blocked`
- Release owner: `<name>`
- Reviewer: `<name>`
- Blocking items: `External production fixture, public deployment smoke, Telegram/Stripe test accounts, and Playwright browser installation are not available in this local run.`
