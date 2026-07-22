# P0-A acceptance gate

## Automated local gates

- [ ] `npm --prefix prototype test`
- [ ] `npm --prefix prototype run build`
- [ ] `npm --prefix prototype run test:e2e -- production-core.spec.js --list`
- [ ] `npm --prefix gateway test`
- [ ] `npm --prefix gateway run typecheck`
- [ ] `npm --prefix gateway run build`
- [ ] `docker compose -f deploy/docker-compose.yml config`
- [ ] `node scripts/check-pocketbase-rules.mjs`
- [ ] `git diff --check`
- [ ] `GET /health` returns only status/service and no secrets

## Manual mobile smoke

Run the core demo at all three viewport widths: **360 × 800**, **390 × 844**, and **430 × 932**.

- [ ] Landing/Google CTA remains reachable with one hand.
- [ ] Brain Dump text input does not overflow or hide behind footer/keyboard.
- [ ] Voice permission denial exposes the Ukrainian text fallback.
- [ ] AI loading, low-confidence clarification, result and error states are understandable.
- [ ] Preview → Apply shows tasks/ideas and does not move locked Calendar event.
- [ ] Today loads persisted data after reload.
- [ ] Task edit saves and displays the changed title.
- [ ] Automatic completion/reschedule exposes Undo; Undo restores state.
- [ ] Touch targets are at least 44 px and no text overlaps.

## External prerequisites (not locally provable)

- [ ] Public Vercel URL with root directory `prototype` and build `npm run build`.
- [ ] Public API domain reverse-proxied by Caddy to the Vector Gateway.
- [ ] PocketBase volume initialized, migrations applied, and dedicated auth test account created.
- [ ] Gemini API key configured server-side (never committed or exposed to Vercel client variables).
- [ ] Google OAuth redirect and Calendar consent configured for production origin.
- [ ] A non-local `PRODUCTION_BASE_URL`, `PRODUCTION_AUTH_TOKEN`, and `PRODUCTION_AUTH_STATE` are set only in a protected CI/local environment for `production-core.spec.js`; the latter is a short-lived PocketBase `pocketbase_auth` JSON fixture with `onboardingCompleted: true`, never committed. Localhost values are rejected.
- [ ] Real Telegram/Stripe/Calendar P0-B integrations are not acceptance blockers for this P0-A gate.

## Evidence

Record command output, deployment URL, viewport screenshots, and any skipped prerequisite with date/commit. A skipped production fixture test is **not** a pass; it is an explicit external prerequisite.
