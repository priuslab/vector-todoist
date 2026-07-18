# Стек-плейбук: auth + paywall + AI + деплой

Довідник по бекенд-стеку, який вивели в цьому проєкті (Chrome-розширення
Youtube to Transcript). Більшість шматків — **не extension-специфічні**: це
звичайний Node/Fastify-гейтвей + self-hosted auth/DB + Stripe + Gemini, тож
для сайту переноситься майже без змін. Позначено окремо, що саме extension-only
і буде замінюватись.

## Зміст
1. [Загальна архітектура](#1-загальна-архітектура)
2. [Auth — PocketBase + Google OAuth](#2-auth--pocketbase--google-oauth)
3. [Paywall — Stripe (Checkout + Portal + Webhook)](#3-paywall--stripe-checkout--portal--webhook)
4. [Сховище даних — JSON-стор "поки не потрібна справжня БД"](#4-сховище-даних--json-стор-поки-не-потрібна-справжня-бд)
5. [AI-інтеграції — Gemini Flash-Lite](#5-ai-інтеграції--gemini-flash-lite)
6. [Rate limiting та захист від зловживань](#6-rate-limiting-та-захист-від-зловживань)
7. [Деплой — docker-compose + існуючий системний Caddy](#7-деплой--docker-compose--існуючий-системний-caddy)
8. [i18n — легка власна система локалізації](#8-i18n--легка-власна-система-локалізації)
9. [Міграція зі старого продукту — lazy claim при вході](#9-міграція-зі-старого-продукту--lazy-claim-при-вході)
10. [Сповіщення для адміна — Telegram](#10-сповіщення-для-адміна--telegram)
11. [Чекліст безпеки](#11-чекліст-безпеки)
12. [Карта файлів цього репо](#12-карта-файлів-цього-репо)

---

## 1. Загальна архітектура

```
Клієнт (extension side panel  АБО  сайт/SPA)
        │  fetch (CORS, без host_permissions/cookies)
        ▼
Gateway (Node + Fastify) ── тримає ВСІ секрети, клієнт їх не бачить
        │
        ├── PocketBase (self-hosted, auth + БД)      :8090, лише 127.0.0.1
        ├── Stripe (paywall)                          зовнішній API
        ├── Google Gemini Flash-Lite (AI)             зовнішній API
        └── (проєкт-специфічно) стара система міграції

Перед гейтвеєм — системний Caddy (уже стоїть на сервері під інший сайт):
TLS + reverse_proxy на 127.0.0.1:8787 (gateway) і 127.0.0.1:8090 (pocketbase).
Контейнери НЕ публікуються на 0.0.0.0 — лише через Caddy.
```

**Чому так, а не Supabase/Firebase/Auth0:** self-hosted PocketBase дає auth +
реальну БД (SQLite) в одному невеликому Docker-контейнері, безкоштовно, з
власною admin UI та Google OAuth "з коробки". Для MVP/соло-проєкту це суттєво
дешевше й простіше за збірку з окремих сервісів.

**Що переноситься на сайт без змін:** Gateway, PocketBase, Stripe, Gemini,
rate limiting, деплой-патерн, i18n-підхід, Telegram-сповіщення.
**Що extension-specific і треба замінити:** OAuth-флоу через
`chrome.identity.launchWebAuthFlow` (на сайті — звичайний redirect-based OAuth,
код нижче), CORS allowlist (`chrome-extension://…` → домен сайту).

---

## 2. Auth — PocketBase + Google OAuth

### 2.1 Піднімаємо PocketBase (Docker, офіційний бінарник)

`pocketbase/Dockerfile`:
```dockerfile
FROM alpine:3.20
ARG PB_VERSION=0.39.5
RUN apk add --no-cache unzip ca-certificates curl && \
    curl -L -o /tmp/pb.zip "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip" && \
    mkdir -p /pb && unzip /tmp/pb.zip -d /pb && rm /tmp/pb.zip && apk del unzip curl
WORKDIR /pb
COPY pb_migrations ./pb_migrations
EXPOSE 8090
VOLUME ["/pb/pb_data"]
CMD ["./pocketbase", "serve", "--http=0.0.0.0:8090"]
```

Схема БД — це **raw JS-міграції**, що самі накатуються при старті PocketBase
(файли в `pb_migrations/`, ім'я = timestamp). Патерн створення колекції:

```js
// pb_migrations/1752000000_saved_transcripts.js
migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  const collection = new Collection({
    type: "base",
    name: "saved_transcripts",
    listRule: "@request.auth.id != '' && user = @request.auth.id",
    viewRule: "@request.auth.id != '' && user = @request.auth.id",
    createRule: "@request.auth.id != '' && @request.body.user = @request.auth.id",
    updateRule: "@request.auth.id != '' && user = @request.auth.id",
    deleteRule: "@request.auth.id != '' && user = @request.auth.id",
    fields: [
      { type: "relation", name: "user", required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true },
      { type: "text", name: "video_id", required: true },
      { type: "json", name: "lines", required: true },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_x ON saved_transcripts (user, video_id)"],
  });
  app.save(collection);
}, (app) => {
  app.delete(app.findCollectionByNameOrId("saved_transcripts"));
});
```

Патерн додавання поля в наявну колекцію:
```js
migrate((app) => {
  const collection = app.findCollectionByNameOrId("saved_transcripts");
  collection.fields.add(new Field({ id: "text_summary", type: "text", name: "summary", required: false }));
  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("saved_transcripts");
  collection.fields.removeById("text_summary");
  app.save(collection);
});
```

**Ключова ідея per-user безпеки:** `listRule`/`createRule`/... — це САМІ правила
PocketBase, не код застосунку. `user = @request.auth.id` означає "юзер бачить
тільки свої рядки" — без жодного `WHERE user_id = ?` в бекенді.

### 2.2 Google OAuth (PKCE) — extension-версія

```js
// extension: chrome.identity.launchWebAuthFlow
const codeVerifier = base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)));
const codeChallenge = base64UrlEncode(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier)));
const redirectUrl = chrome.identity.getRedirectURL(); // https://<ext-id>.chromiumapp.org/

const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('redirect_uri', redirectUrl);
authUrl.searchParams.set('scope', 'openid email profile');
authUrl.searchParams.set('code_challenge', codeChallenge);
authUrl.searchParams.set('code_challenge_method', 'S256');

const resultUrl = await chrome.identity.launchWebAuthFlow({ url: authUrl.toString(), interactive: true });
const code = new URL(resultUrl).searchParams.get('code');

// PocketBase сам обмінює code на токен у Google (client secret живе ТІЛЬКИ в PocketBase admin UI)
const res = await fetch(`${POCKETBASE_URL}/api/collections/users/auth-with-oauth2`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ provider: 'google', code, codeVerifier, redirectUrl }),
});
const { token, record } = await res.json(); // token = PocketBase auth token, record = user
```

### 2.3 Google OAuth — версія для САЙТУ (без chrome.identity)

На сайті немає `chrome.identity`, зате є звичайний `window.location.href`
redirect — той самий `code`+`codeVerifier` протокол, просто редірект замість
`launchWebAuthFlow`:

```js
// 1. Старт входу — редіректимо на Google, зберігши code_verifier в sessionStorage
const codeVerifier = base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)));
sessionStorage.setItem('pkce_verifier', codeVerifier);
const codeChallenge = base64UrlEncode(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier)));
const redirectUrl = `${location.origin}/auth/callback`; // сторінка на вашому сайті

const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('redirect_uri', redirectUrl);
authUrl.searchParams.set('scope', 'openid email profile');
authUrl.searchParams.set('code_challenge', codeChallenge);
authUrl.searchParams.set('code_challenge_method', 'S256');
location.href = authUrl.toString();

// 2. На /auth/callback — те саме, тільки code_verifier береться з sessionStorage
const code = new URLSearchParams(location.search).get('code');
const codeVerifier = sessionStorage.getItem('pkce_verifier');
const res = await fetch(`${POCKETBASE_URL}/api/collections/users/auth-with-oauth2`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ provider: 'google', code, codeVerifier, redirectUrl }),
});
```

**У Google Cloud Console:** Authorized redirect URI = `https://ваш-сайт.com/auth/callback`
(для extension це натомість `https://<ext-id>.chromiumapp.org/`).
**У PocketBase admin UI:** Settings → Auth providers → Google — вмикаєш,
вставляєш Client ID + Client Secret (secret живе тільки тут, ніколи на клієнті).

### 2.4 Серверна верифікація токена (ОБОВ'ЯЗКОВО)

Ніколи не довіряй `userId`, який клієнт сам присилає в заголовку — тільки
токен, звірений проти PocketBase:

```js
// gateway/src/pocketbaseAuth.js
const cache = new Map(); // token -> {user, expiresAt}, коротке кешування (60с)

export async function verifyUser(token) {
  if (!token) return null;
  const cached = cache.get(token);
  if (cached && cached.expiresAt > Date.now()) return cached.user;

  const res = await fetch(`${POCKETBASE_URL}/api/collections/users/auth-refresh`, {
    method: 'POST',
    headers: { Authorization: token },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const user = { userId: data.record.id, email: data.record.email };
  cache.set(token, { user, expiresAt: Date.now() + 60_000 });
  return user; // PocketBase недоступний -> null (fail closed до anonymous, НЕ довіряти caller'у)
}
```

### 2.5 Superuser-клієнт для адмінських записів (обхід per-user правил)

Потрібен, коли гейтвей мусить писати запис ЗА юзера (імпорт/міграція), а
власного токена цього юзера в гейтвея нема:

```js
// auth-with-password на _superusers (PocketBase 0.23+)
const res = await fetch(`${POCKETBASE_URL}/api/collections/_superusers/auth-with-password`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ identity: SUPERUSER_EMAIL, password: SUPERUSER_PASSWORD }),
});
const { token } = await res.json(); // цей токен обходить collection rules
```

---

## 3. Paywall — Stripe (Checkout + Portal + Webhook)

### 3.1 Конфіг тарифів

```js
const PLAN_CONFIG = {
  monthly:  { priceId: STRIPE_PRICE_MONTHLY,  mode: 'subscription' },
  yearly:   { priceId: STRIPE_PRICE_YEARLY,   mode: 'subscription' },
  lifetime: { priceId: STRIPE_PRICE_LIFETIME, mode: 'payment' }, // one-time
};
```

### 3.2 Checkout — з idempotency key і metadata на двох рівнях

```js
const session = await stripe.checkout.sessions.create(
  {
    mode: plan.mode,
    line_items: [{ price: plan.priceId, quantity: 1 }],
    customer: user.stripeCustomerId || undefined,
    customer_email: user.stripeCustomerId ? undefined : email, // не можна обидва разом
    client_reference_id: userId,
    metadata: { pocketbaseUserId: userId, planId },
    // ВАЖЛИВО: у customer.subscription.* webhook-подіях НЕ видно metadata
    // самого Checkout Session — тільки subscription_data.metadata тут:
    subscription_data: plan.mode === 'subscription'
      ? { metadata: { pocketbaseUserId: userId, planId } }
      : undefined,
    success_url: `${WEB_APP_URL}/checkout-success/`,
    cancel_url: `${WEB_APP_URL}/?checkout=cancelled`,
  },
  // Дедуп подвійного кліку/ретраю мережі в ту саму хвилину:
  { idempotencyKey: `checkout:${userId}:${planId}:${Math.floor(Date.now() / 60000)}` }
);
```

### 3.3 Customer Portal (самообслуговування — скасування, зміна картки)

```js
const session = await stripe.billingPortal.sessions.create({
  customer: user.stripeCustomerId,
  return_url: WEB_APP_URL,
});
// -> session.url, редіректиш юзера туди. Готовий UI від Stripe, свій не пишеш.
```

### 3.4 Webhook — сирий body для підпису + де-дуп + fallback-резолюція юзера

```js
// content-type parser МУСИТЬ повернути Buffer (не розпарсений JSON) —
// інакше stripe.webhooks.constructEvent не звірить підпис
fastify.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_req, body, done) => done(null, body));

const processedEventIds = new Set(); // де-дуп ретраїв Stripe (retry на все, крім 2xx)

fastify.post('/api/billing/webhook', { config: { rateLimit: false } }, async (request, reply) => {
  let event;
  try {
    event = stripe.webhooks.constructEvent(request.body, request.headers['stripe-signature'], WEBHOOK_SECRET);
  } catch { return reply.code(400).send({ error: 'Invalid signature.' }); }

  if (processedEventIds.has(event.id)) return reply.send({ received: true });
  processedEventIds.add(event.id);

  switch (event.type) {
    case 'checkout.session.completed': {
      const s = event.data.object;
      await setBilling(s.metadata.pocketbaseUserId, {
        stripeCustomerId: s.customer,
        stripeSubscriptionId: s.subscription,
        plan: s.metadata.planId,
        subscriptionStatus: s.mode === 'payment' ? 'lifetime' : 'active',
      });
      break;
    }
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      // Fallback: якщо metadata нема (напр. мігрований юзер до backfill'у) —
      // шукаємо юзера по stripeCustomerId, який ми зберегли раніше.
      const userId = sub.metadata?.pocketbaseUserId || (await findUserByStripeCustomerId(sub.customer));
      if (userId) await setBilling(userId, {
        stripeSubscriptionId: sub.id,
        subscriptionStatus: event.type.endsWith('deleted') ? 'canceled' : sub.status,
        currentPeriodEnd: sub.current_period_end * 1000,
      });
      break;
    }
  }
  return reply.send({ received: true }); // 200 завжди, навіть якщо handler впав — інакше Stripe retry-штормить
});
```

### 3.5 Модель entitlement (3 рівні: anon / free / pro)

```js
// gateway/src/entitlement.js — чиста політика поверх стору, без прив'язки до конкретної БД
export async function getEntitlement({ userId, isPro, installId }) {
  if (isPro) return {
    plan: 'pro',
    subtitles: { allowed: true, remaining: null, blockedReason: null },
    ai:        { allowed: true, remaining: null, blockedReason: null },
  };
  if (userId) {
    const u = await store.getUser(userId);
    const remaining = Math.max(0, FREE_DAILY_LIMIT - (u.day === today() ? u.transcriptsToday : 0));
    return { plan: 'free', subtitles: { allowed: remaining > 0, remaining, blockedReason: remaining > 0 ? null : 'paywall' } };
  }
  const inst = await store.getInstall(installId);
  const remaining = Math.max(0, ANON_LIMIT - inst.transcripts);
  return { plan: 'anonymous', subtitles: { allowed: remaining > 0, remaining, blockedReason: remaining > 0 ? null : 'register' } };
}
```

`isActivePro()` — важлива деталь: Stripe Portal скасовує "в кінці періоду", а
не миттєво, тож довіряти треба `currentPeriodEnd`, не самому факту скасування:
```js
export async function isActivePro(userId) {
  const u = await getUser(userId);
  if (u.subscriptionStatus === 'lifetime') return true;
  if (['active', 'trialing'].includes(u.subscriptionStatus)) {
    return !u.currentPeriodEnd || Date.now() < u.currentPeriodEnd;
  }
  return false;
}
```

---

## 4. Сховище даних — JSON-стор "поки не потрібна справжня БД"

Для MVP з низьким write-volume (квоти, білінг-стан) — не Postgres/Redis, а
дебаунсений JSON-файл на диску. Простий, переживає рестарт, і API спроєктовано
так, щоб пізніше замінити файл на реальну БД **без зміни викликів у роутах**.

```js
let cache = null;
let writeTimer = null;
let writing = Promise.resolve(); // серіалізація записів — щоб останній завжди виграв

async function load() {
  if (cache) return cache;
  try { cache = JSON.parse(await readFile(dataFile, 'utf8')); }
  catch { cache = { installs: {}, users: {} }; }
  return cache;
}

function scheduleWrite() {
  clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    writing = writing.then(async () => {
      await mkdir(dataDir, { recursive: true });
      await writeFile(dataFile, JSON.stringify(cache, null, 2));
    });
  }, 200); // дебаунс: багато bump-викликів підряд -> один запис на диск
}

export async function bumpUserTranscript(userId, day) {
  const s = await load();
  const u = s.users[userId] || { day, transcriptsToday: 0 };
  if (u.day !== day) { u.day = day; u.transcriptsToday = 0; } // денний лічильник скидається сам
  u.transcriptsToday += 1;
  s.users[userId] = u;
  scheduleWrite();
}
```

**Коли переростати це:** кілька інстансів гейтвея одночасно (файл — не
distributed lock), або серйозний write-volume. До того — цього достатньо.

---

## 5. AI-інтеграції — Gemini Flash-Lite

**Чому Flash-Lite, а не GPT/Claude API:** найдешевший при цьому об'ємі,
щедрий безкоштовний тір, якості достатньо для перекладу/сумаризації коротких
фрагментів.

### 5.1 КРИТИЧНИЙ готча: thinking budget з'їдає output

Gemini 2.5-моделі можуть витрачати частину `maxOutputTokens` на невидиме
"обдумування" ще ДО видимої відповіді. Якщо бюджет малий — відповідь виходить
пустою/обрізаною (`finishReason: MAX_TOKENS`, `parts[0].text` порожній або
JSON.parse ламається). Для задач з детермінованою формою виводу (переклад,
структурований JSON) reasoning не потрібен — вимикай його явно:

```js
generationConfig: {
  responseMimeType: 'application/json',
  temperature: 0.1,
  maxOutputTokens: 8192,           // з запасом, не економити тут
  thinkingConfig: { thinkingBudget: 0 }, // ← ось цей рядок ловив два реальні продакшн-баги
}
```

### 5.2 Чанкування + примусовий JSON-вивід (для довгих інпутів)

```js
const CHUNK_SIZE = 40; // рядків за раз — тримає відповідь комфортно під output cap
async function translateChunkOnce(texts, language, temperature) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${KEY}`, {
    method: 'POST',
    body: JSON.stringify({
      contents: [{ parts: [{ text:
        `Translate every string in this JSON array into ${language}. ` +
        `The array has exactly ${texts.length} items; output exactly ${texts.length} items too, same order. ` +
        `Never merge, split, drop, or reorder items.\n\n${JSON.stringify(texts)}`
      }] }],
      generationConfig: { responseMimeType: 'application/json', temperature, maxOutputTokens: 8192, thinkingConfig: { thinkingBudget: 0 } },
    }),
  });
  const data = await res.json();
  const translated = JSON.parse(data.candidates[0].content.parts[0].text);
  if (translated.length !== texts.length) throw new Error(`wrong length: ${translated.length} vs ${texts.length}`);
  return translated;
}
```

### 5.3 Ретрай з РОСТОМ температури (не той самий temp) + bisection-фолбек

Реальний баг: на `temperature: 0.1` модель ІНОДІ детерміновано зливає два
короткі фрагменти ("um"+"yeah") в один рядок — масив виходить на 1 коротший.
Ретрай на ТІЙ САМІЙ низькій температурі просто повторює ту саму помилку.
Рішення — два шари захисту:

```js
// 1) Ретраї з температурою, що росте (0.1 -> 0.3 -> 0.5) — дає шанс на інший результат
async function translateChunkAttempts(texts, language) {
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try { return await translateChunkOnce(texts, language, (attempt - 1) * 0.2 + 0.1); }
    catch (err) { lastErr = err; await sleep(800 * attempt); }
  }
  throw lastErr;
}

// 2) Якщо і це не допомогло — ділимо навпіл і перекладаємо кожну половину
//    окремо. У half-розмірі помилці "злити A з B" вже нема місця. Рекурсія
//    впирається в шматки по 1 рядку (там зливати нема з чим), тож завжди
//    зрештою вдається — замість надії на удачу ретраю.
async function translateChunk(texts, language) {
  try { return await translateChunkAttempts(texts, language); }
  catch (err) {
    if (texts.length <= 1) throw err;
    const mid = Math.ceil(texts.length / 2);
    const [first, second] = await Promise.all([
      translateChunk(texts.slice(0, mid), language),
      translateChunk(texts.slice(mid), language),
    ]);
    return [...first, ...second];
  }
}
```

### 5.4 Окремі API-ключі на фічу

Один Google-проєкт = одна безкоштовна денна квота (RPD). Переклад чанкує і
з'їдає RPD швидко; summary — 1 запит/відео. Окремий ключ під кожну AI-фічу
(`GEMINI_API_KEY` / `GEMINI_SUMMARY_API_KEY`, з fallback одне на одне якщо
другого нема) — безкоштовно подвоює стелю без нової залежності.

---

## 6. Rate limiting та захист від зловживань

```js
// server.js
const fastify = Fastify({ trustProxy: true }); // ОБОВ'ЯЗКОВО за проксі (Caddy/nginx) —
// інакше request.ip = адреса проксі, а не реального клієнта, і rate-limit/
// анонімна ідентифікація по IP схлопується в одне спільне відро на всіх.

await fastify.register(rateLimit, { max: 120, timeWindow: '1 minute' }); // загальний ліміт

// Тугіший ліміт на конкретних роутах, що коштують реальних грошей:
fastify.post('/api/expensive-thing', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, handler);

// Виключення для health-check і Stripe-вебхука (вони не від кінцевого юзера):
fastify.get('/health', { config: { rateLimit: false } }, async () => ({ ok: true }));
```

CORS — allowlist з fallback для дев-режиму:
```js
await fastify.register(cors, {
  origin(origin, cb) {
    if (!origin) return cb(null, true); // curl / non-browser
    if (ALLOWED_ORIGINS.length) return cb(null, ALLOWED_ORIGINS.includes(origin));
    cb(null, origin.startsWith('chrome-extension://') || origin.startsWith('http://localhost')); // dev-режим
  },
});
// Перед публікацією: ALLOWED_ORIGINS=https://ваш-сайт.com (для extension: chrome-extension://<id>)
```

---

## 7. Деплой — docker-compose + існуючий системний Caddy

**Ключова ідея, якщо на сервері вже є Caddy під інший сайт:** не піднімай
СВІЙ Caddy (конфлікт портів 80/443). Прив'яжи нові контейнери ТІЛЬКИ до
`127.0.0.1`, і додай 2 блоки в ІСНУЮЧИЙ системний Caddyfile.

```yaml
# docker-compose.yml
services:
  gateway:
    build: ../gateway
    restart: unless-stopped
    environment: { PORT: 8787, ... }   # усі секрети через .env
    ports: ["127.0.0.1:8787:8787"]     # НЕ 0.0.0.0 — недоступний напряму з інтернету
    volumes: [gateway_data:/data]

  pocketbase:
    build: ../pocketbase
    restart: unless-stopped
    ports: ["127.0.0.1:8090:8090"]
    volumes: [pocketbase_data:/pb/pb_data]

volumes: { gateway_data: {}, pocketbase_data: {} }
```

```
# додати в /etc/caddy/Caddyfile (НЕ перезаписувати весь файл):
api.your-site.com { reverse_proxy 127.0.0.1:8787 }
pb.your-site.com  { reverse_proxy 127.0.0.1:8090 }
```
```bash
caddy validate --config /etc/caddy/Caddyfile   # sanity check
systemctl reload caddy                          # reload, НЕ restart — не рвемо інший сайт
```

Config-модуль зі списком усіх env-змінних і жорсткою вимогою для критичних:
```js
function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var ${name}.`);
  return v;
}
export const config = {
  someRequiredSecret: required('SOME_KEY'),
  optionalThing: process.env.OPTIONAL || '', // фіча відповідає 503, поки не задано
};
```

Кожен `env.sample` рядок з коментарем ЧОМУ і ЩО ламається, якщо не задати —
рятує майбутнього себе під час деплою нового проєкту.

---

## 8. i18n — легка власна система локалізації

Коли `chrome.i18n`/`next-i18next` не підходить (потрібне миттєве перемикання
мови в рантаймі без релоаду) — один файл, один об'єкт, просто:

```js
const M = {
  en: { hello: 'Hello', greet: 'Hi, {name}!' },
  uk: { hello: 'Привіт', greet: 'Привіт, {name}!' },
};
let current = localStorage.getItem('uiLang') || (navigator.language.slice(0,2) in M ? navigator.language.slice(0,2) : 'en');

function t(key, vars) {
  let str = M[current]?.[key] ?? M.en[key] ?? key; // fallback на англійську, а не сирий ключ
  for (const [k, v] of Object.entries(vars || {})) str = str.replaceAll(`{${k}}`, v);
  return str;
}

function applyI18n() {
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of document.querySelectorAll('[data-i18n-placeholder]')) el.placeholder = t(el.dataset.i18nPlaceholder);
}

function setLang(code) {
  if (!M[code]) return;
  current = code;
  localStorage.setItem('uiLang', code);
  applyI18n();
}
```
Дисципліна, яка рятує: усі локалі мають ОДНАКОВУ кількість ключів (перевірка
скриптом при кожній зміні) — інакше десинхронізація непомітно накопичується.

---

## 9. Міграція зі старого продукту — lazy claim при вході

Реюзабельний патерн для переходу зі старої системи (Bubble/будь-що) БЕЗ
примусового bulk-експорту і без повторного оформлення підписки:

- **Join key — email**, не id (новий auth майже завжди інший, ніж старий).
- Готуєш заздалегідь мапу `payers.json` (`{ email: {stripeCustomerId, plan, status} }`)
  зі старого експорту — маленький файл, лежить поза git (PII).
- При ПЕРШОМУ вході юзера — одноразовий "claim": звіряєш білінг-стан
  ЖИВИМ запитом у Stripe (не довіряєш застарілому знімку — юзер міг
  скасувати підписку ще на старій системі), і якщо активний — переносиш
  Pro-статус на новий `userId`, і **бекфіляєш** `pocketbaseUserId` у
  Stripe-підписку (щоб МАЙБУТНІ webhook-події вже знаходили юзера напряму).
- Важкі дані (наприклад збережені записи користувача) — НЕ в тому самому
  запиті: fire-and-forget у фоні, щоб логін лишався миттєвим незалежно
  від об'єму даних; окремий прапорець `synced` (не той самий, що
  `billingClaimed`!) з retriable-семантикою — перерваний фоновий імпорт
  повторюється при наступному вході, а не губиться назавжди.
- Одноразовість — прапорці в сторі (`migrationClaimed`, `transcriptsSynced`),
  не перевіряються повторно щоразу.
- **Ранбук на розбіжність email:** юзер, чий email на новому auth не
  збігається зі старим — лишається free; підтримка вручну додає правильний
  email у payers.json.

---

## 10. Сповіщення для адміна — Telegram

Мінімальний канал для подій, що потребують уваги людини (немає SMTP/email-акаунта):

```js
export async function notify(message) {
  console.warn('[notify]', message); // завжди лог, навіть якщо Telegram не налаштований
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message }),
  });
}
```
Бот — через @BotFather, chat id власного акаунта — через @userinfobot.

---

## 11. Чекліст безпеки

- [ ] Ніколи не довіряти `userId`/`X-User-Id` з клієнтського заголовка —
      тільки токен, звірений проти auth-сервера (`verifyUser`), з коротким кешем.
- [ ] `trustProxy: true` за будь-яким реверс-проксі — інакше rate-limit і
      per-IP анонімна ідентифікація схлопуються в одне відро.
- [ ] Тугіший rate-limit на роутах, що коштують реальних грошей (AI/proxy),
      ніж на дешевих read-роутах.
- [ ] Idempotency key на кожен виклик, що створює платіж/підписку
      (подвійний клік / retry мережі не мають плодити дублі).
- [ ] CORS: широкий allowlist під час розробки → жорсткий allowlist одразу
      після публікації.
- [ ] Контейнери прив'язані до `127.0.0.1`, не `0.0.0.0`, коли є reverse proxy.
- [ ] PII (email-експорти, `payers.json`, `.env`) — у `.gitignore`, ніколи в git;
      передавати на сервер тільки через SSH, не через чат/репо.
- [ ] Секрети (Stripe secret, superuser-пароль, API-ключі) — лише в env
      гейтвея, ніколи в клієнтському коді (`grep` перед публікацією — легка
      перевірка, що жоден секретний ключ не потрапив у клієнтський бандл).
- [ ] Регулярний бекап volume з даними БД (SQLite-файл PocketBase тримає
      усі акаунти й записи користувачів).

---

## 12. Карта файлів цього репо

Для швидкого copy-paste в новий проєкт:

| Що | Файл |
|---|---|
| Fastify-сервер, CORS, rate-limit, реєстрація роутів | `gateway/src/server.js` |
| Центральний конфіг + `required()` | `gateway/src/config.js` |
| Верифікація PocketBase-токена | `gateway/src/pocketbaseAuth.js` |
| Superuser-клієнт (адмінські записи) | `gateway/src/pocketbaseAdmin.js` |
| Checkout + Portal | `gateway/src/routes/billing.js` |
| Stripe webhook | `gateway/src/routes/webhook.js` |
| Політика доступу (3 рівні тарифу) | `gateway/src/entitlement.js` |
| JSON-стор (дебаунсені записи) | `gateway/src/store.js` |
| Gemini-переклад (чанки, ретраї, bisection) | `gateway/src/translateClient.js` |
| Gemini-сумаризація | `gateway/src/summaryClient.js` |
| Telegram-сповіщення | `gateway/src/notify.js` |
| Lazy-міграція зі старої системи | `gateway/src/migration.js` |
| PocketBase Dockerfile | `pocketbase/Dockerfile` |
| Схема БД (міграції) | `pocketbase/pb_migrations/*.js` |
| docker-compose + інструкція деплою | `deploy/docker-compose.yml`, `deploy/README.md` |
| Усі env-змінні з поясненнями | `deploy/env.sample` |
| Auth-клієнт (extension, PKCE) | `coded-extension/pocketbase-client.js` |
| i18n-система (10 мов) | `coded-extension/i18n.js` |

---

*Створено з розмови в цьому проєкті. Копіюй розділи 2-8, 10-11 у новий
проєкт майже без змін; розділ 9 — тільки якщо є що мігрувати зі старого
продукту.*
