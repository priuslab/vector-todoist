# Security, failure and accessibility audit

This checklist is the release gate for the mobile web MVP. It records what is
verified in code and what still needs a real provider/production fixture. It is
deliberately a checklist, not a promise that an unavailable external service
has been tested.

## Fixture-gated browser audit

The browser matrix lives in `prototype/e2e/security-accessibility.spec.js` and
is skipped unless `AUDIT_BASE_URL` points at a deployed/non-local URL. A real
authenticated fixture is required for authenticated scenarios:

```bash
AUDIT_BASE_URL=https://<deployment> \
AUDIT_AUTH_STATE=/absolute/path/auth-state.json \
npm --prefix prototype run test:e2e -- security-accessibility.spec.js
```

The fixture must be a dedicated demo user. Do not put cookies, bearer tokens,
provider credentials or audio files in the repository or Playwright output.

The matrix covers 360×800, 390×844 and 430×932; keyboard focus and accessible
names; reduced motion; 200% page zoom; safe-area footer; and the Oracle list
alternative. It also probes failure fixtures only when `AUDIT_FAILURE_FIXTURE=1`
is explicitly supplied. Local QA and unauthenticated landing pages must not be
reported as production passes.

## Security checklist

- [x] Every gateway route that reads or mutates user data uses the PocketBase
  bearer and ownership rules. Server workers use a separate server token.
- [x] CORS is restricted to the canonical `PUBLIC_WEB_ORIGIN`; credentials are
  not accepted from arbitrary origins. Rate limiting is enabled in the app.
- [x] Provider secrets and refresh tokens stay server-side. Google refresh
  tokens are encrypted; pairing/watch/Stripe secrets are stored as hashes or
  secrets, never returned to the client or written to logs.
- [x] Google OAuth uses state + PKCE and rejects invalid/expired state. Calendar
  webhooks validate channel tokens and origin before enqueuing work.
- [x] Telegram webhooks require the configured secret header and use an
  idempotency key for update delivery. Pairing tokens are single-use and
  expiring.
- [x] Stripe webhooks verify the raw-body signature and treat duplicate and
  out-of-order events idempotently. Entitlements activate only after a verified
  paid Test Mode event.
- [x] PocketBase migration rules are checked with
  `node scripts/check-pocketbase-rules.mjs`; no collection is world-readable.
- [ ] Before production launch, run `npm audit --omit=dev` in `gateway` and
  `prototype`, review only actionable advisories, and record the decision. Do
  not upgrade dependencies as part of this audit without a failing proof.

## Failure matrix

| Case | Expected user-visible behavior | Verification |
| --- | --- | --- |
| Offline / slow network | Keep draft, show pending/error state, offer retry; never duplicate a mutation | API client + browser fixture |
| Gemini timeout / invalid JSON | Ukrainian retryable message; no partial write | AI service tests |
| Calendar expiry / quota | Refresh once, then preserve plan and show reconnect/retry | Google integration tests |
| Telegram retry / duplicate update | Idempotent response; transient processing can retry | Telegram webhook tests |
| Stripe duplicate / out-of-order | One entitlement, safe ignored event, retryable provider error | Stripe webhook tests |
| No available slot | Leave item in Inbox/next day and explain why | scheduler tests |
| DST / timezone boundary | Schedule and quiet hours by the user timezone/local date | scheduler + notification policy tests |
| Long Ukrainian input | Enforce configured limit before AI/upload; keep the draft | capture/transcription tests |
| Microphone denied | Explain permission and offer text input; no stuck recording state | capture UI fixture |

## Mobile and assistive technology matrix

- [x] Primary actions and icon-only controls expose Ukrainian accessible names;
  decorative icons are hidden from the accessibility tree.
- [x] Visible focus uses the semantic focus token and all primary touch targets
  are at least 44×44 px (buttons are 52–56 px where applicable).
- [x] Reduced-motion CSS disables decorative transitions/loops; carousel logic
  must also receive an explicit reduced-motion signal in production.
- [x] Fixed action footers include `env(safe-area-inset-bottom)` and content
  scrolls independently so buttons do not cover content or the keyboard.
- [x] Oracle exposes a labelled list mode for screen readers and users who
  cannot operate a force-directed graph.
- [ ] Verify contrast and 200% zoom on a deployed build with browser/OS
  accessibility tooling; the fixture-gated spec only catches regressions such
  as clipping, overflow and missing names.

## Release evidence

Record the exact commit, test commands, fixture URL (without credentials), and
any skipped prerequisite in the Task 30 demo report. A skipped fixture is not a
pass; it is an explicit follow-up item.
