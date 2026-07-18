# Task 4 report — frontend auth and API foundations

## RED → GREEN

- **RED:** added API client, auth store, OAuth PKCE and route-access tests. The first focused run failed because the new modules did not exist (4 unresolved-import suites).
- **GREEN:** implemented the modules and reran the focused suite: 4 files / 9 tests passing.
- **Additional RED:** the auth store initially returned `anonymous`; the added test required the explicit initial `loading` state and failed with `expected anonymous to be loading`.
- **GREEN:** updated the store to start in `loading` until PocketBase `authStore.onChange` synchronizes it; focused suite passed again.
- **Additional RED:** extended the API test with `UserId` and `X-Caller-Id`; it failed because identity headers were forwarded.
- **GREEN:** normalized and removed caller identity headers; API suite passed.

## Changed files

- `prototype/package.json`, `prototype/package-lock.json` — exact `pocketbase@0.27.0` (verified with npm metadata before installation).
- `prototype/.env.example` — public Vite URL/client-id placeholders only.
- `prototype/src/lib/apiError.js`, `prototype/src/lib/apiClient.js` and tests — typed errors, injected fetch/token/refresh dependencies, request ID, one 401 refresh/retry, expiry handoff.
- `prototype/src/auth/authStore.jsx`, `pocketBaseOAuth.js`, `AuthCallback.jsx` and tests — PocketBase persistence subscription, safe Ukrainian callback UI, Google PKCE with verified single-use `state` and `finally` cleanup.
- `prototype/src/navigation/routeAccess.js` and tests — production auth/onboarding routing plus disabled-feature deep-link fallback.
- `prototype/src/App.jsx`, `prototype/src/screens/ScreenRouter.jsx` — production mode and Google CTA integration while preserving dev/test screen catalog and `?screen=` QA flow.

## Verification

- `npm --prefix prototype test` — 16 files / 49 tests passing.
- `npm --prefix prototype run build` — production build passed.
- `npm --prefix prototype exec playwright -- --help` — CLI available.
- `git diff --check` — passed.

## Audit

- `npm install pocketbase@0.27.0 --save-exact` reported 2 existing project vulnerabilities (1 high, 1 critical).
- The installed SDK has no dependencies or peer dependencies, so it added no transitive packages.
- A fresh `npm audit --json` was blocked: the sandbox had no registry DNS access, and the approved escalation was rejected because audit would disclose dependency metadata to the npm registry. No workaround was used.

## Self-review

- Google scope is exactly `openid email profile`; Calendar consent is not added.
- No Google refresh token is read by the UI; PocketBase `authStore` owns token/record persistence.
- Callback session keys are removed in `finally`, including state mismatches and backend failures.
- API client never forwards caller/user identity headers, refreshes only after a 401, and clears auth on refresh failure.
- Production deep links to disabled Calendar, Telegram, Oracle, Stripe, Goal Focus, Pomodoro and Adaptation resolve to Today; dev/test QA links continue to work.
