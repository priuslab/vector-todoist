# Повне production демо «Вектор»

Цей runbook описує перевірку всіх заявлених вертикальних зрізів. Він не
замінює core demo: якщо час обмежений, спочатку показуйте
`docs/runbooks/core-demo.md`.

## Підготовка

Потрібні окремі тестові ресурси, які не можна комітити:

- Vercel URL фронтенду: `https://<vector-project>.vercel.app`;
- Gateway API URL: `https://<vector-api.example.com>`;
- PocketBase з міграціями та окремим demo-користувачем Оленою;
- server-side Gemini key, Google OAuth/Calendar credentials;
- тестовий Telegram bot і chat, Stripe Test Mode price/card;
- Calendar із подією «Командний синк» 11:00–11:45;
- короткоживучий Playwright auth state і bearer token у захищеному локальному
  або CI-середовищі.

Ніколи не записуйте auth state, токени, provider secrets, голосові файли або
повні webhook payloads у git, screenshots чи Playwright artifacts.

## Автоматична перевірка

Запустіть із кореня репозиторію:

```bash
npm --prefix gateway test
npm --prefix gateway run typecheck
npm --prefix gateway run build
npm --prefix prototype test
npm --prefix prototype run build
npm --prefix prototype run test:e2e
git diff --check
```

Production fixture smoke запускається окремо й навмисно пропускається без
зовнішніх prerequisites:

```bash
FULL_DEMO_BASE_URL=https://<vector-project>.vercel.app \
FULL_DEMO_AUTH_STATE=/secure/vector-auth-state.json \
FULL_DEMO_AUTH_TOKEN=<short-lived-token> \
FULL_DEMO_RUN=1 \
npm --prefix prototype run test:e2e -- production-full-flow.spec.js
```

Telegram додається тільки після перевірки test chat:

```bash
FULL_DEMO_TELEGRAM=1 ... npm --prefix prototype run test:e2e -- production-full-flow.spec.js
```

Stripe додається тільки у Test Mode:

```bash
FULL_DEMO_STRIPE=1 ... npm --prefix prototype run test:e2e -- production-full-flow.spec.js
```

Skipped тест — не pass. Його причина має потрапити у final release report.

## Послідовність на телефоні

1. Google login і Calendar permission.
2. Voice Brain Dump; у разі відмови мікрофона показати text fallback.
3. AI analysis, за потреби не більше 1–2 уточнень.
4. Preview → apply: tasks, priority, duration, deadline, Today і Calendar block.
5. Edit task → automatic reschedule → Undo.
6. Telegram text/voice capture, morning plan, reminder і rescheduling summary.
7. Oracle: idea → path → Goal Focus; перевірити list alternative.
8. Pomodoro: start, pause, finish; задача не завершується автоматично.
9. Stripe Test Mode: webhook підтверджує Lifetime Pro і відкриває другу мету.

Перевірте ширини 360×800, 390×844 і 430×932, safe-area footer, keyboard,
reduced motion та відсутність горизонтального overflow. Зафіксуйте URL,
commit, viewport screenshots і timestamp без приватних даних.

## Failure and rollback

- Gemini timeout/invalid JSON: залишити draft, показати український retry,
  не застосовувати частковий план.
- Calendar token/quota: зберегти план, показати reconnect; Google event не
  можна перетягувати або видаляти з Вектора.
- Telegram retry/duplicate: webhook має бути idempotent; transient failure
  повинен повторитися, duplicate update — без дубльованого capture.
- Stripe duplicate/out-of-order: одна entitlement, активація лише після
  перевіреного webhook.
- Після помилкового deploy: Vercel rollback на попередній green deployment,
  Gateway image/tag rollback за deploy runbook, потім повторити core smoke.

## Evidence placeholders

- Public web URL: `https://<vector-project>.vercel.app`
- Gateway URL: `https://<vector-api.example.com>`
- Release commit: `<git-sha>`
- Verification date/time (Europe/Warsaw): `<YYYY-MM-DD HH:mm>`
- Screenshots folder (без секретів): `<secure-artifacts-path>`
- Skipped prerequisites: `<list or “none”>`
