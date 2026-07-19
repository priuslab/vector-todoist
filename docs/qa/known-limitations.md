# Known limitations and external prerequisites

Опис нижче навмисно конкретний. Ці пункти не можна подавати як виконані
функції, доки відповідний production smoke не записаний у
`final-release-report.md`.

## Не перевіряється в локальному середовищі

- Google OAuth consent, refresh token rotation і реальний Calendar webhook
  потребують Google Cloud project, HTTPS origin і test account.
- Telegram pairing, voice download, webhook retries та нагадування потребують
  bot token, webhook secret, HTTPS endpoint і окремий test chat.
- Stripe Checkout і Lifetime Pro потребують Stripe Test Mode keys, price ID та
  verified webhook; UI paywall без webhook не є entitlement.
- Vercel/Gateway public smoke потребує домени, DNS/TLS, environment variables,
  PocketBase volume/migrations і server-side Gemini key.
- Реальний mobile microphone, safe-area, screen reader і 200% zoom потребують
  фізичний телефон або browser accessibility tooling.

## Свідомі обмеження MVP

- Фронтенд mobile-first; desktop experience не є окремим продуктом.
- Текст і голос приймають українську; multilingual UI не входить у MVP.
- Автоматична адаптація лише пропонує зміну та чекає згоди користувача.
- Goal Focus відкладає гнучкі нерелевантні елементи, не видаляє їх.
- Oracle має list alternative для assistive technology, але force-directed
  graph може бути складнішим на маленьких екранах.
- Voice audio видаляється після транскрипції за замовчуванням; transcript може
  зберігатися як текст.

## Demo safety

- Використовуйте тільки dedicated demo user і тестові provider accounts.
- Не вставляйте tokens, cookies, auth state, raw audio або webhook secrets у
  issues, screenshots, logs чи цей репозиторій.
- Якщо integration flag вимкнений або smoke skipped, демонструйте core flow і
  чесно називайте інтеграцію зовнішнім prerequisite.
- При регресії застосуйте Vercel/Gateway rollback, вказаний у runbooks; не
  редагуйте production DB вручну для «підготовки» демонстрації.
