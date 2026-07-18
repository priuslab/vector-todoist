# Production deployment — Вектор P0-A

Цей runbook описує безпечне розгортання backend на окремому Vector VPS. Не запускайте команди з цього документа на production без перевірки каталогу та backup. Frontend деплоїться у Vercel з root directory `prototype`; цей VPS не запускає другий Caddy.

## Передумови

- Docker Engine і Compose v2 встановлені на VPS.
- Домен frontend у Vercel і API-домен у Caddy вже створені.
- DNS для API-домену вказує на VPS.
- Доступ до репозиторію та заздалегідь підготовлений `deploy/.env` через host secret store або захищений файл з правами `0600`.

## Vercel

1. Імпортуйте репозиторій у Vercel.
2. Встановіть Root Directory: `prototype`.
3. Build Command: `npm run build`; Output Directory: `dist`.
4. Додайте лише public `VITE_*` змінні, описані у `prototype/.env.example` (PocketBase URL, Gateway URL, feature flags). Gemini, PocketBase admin і webhook secrets у Vercel не додаються.
5. Deploy і перевірте landing URL. Google OAuth callback має точно збігатися з production origin. Для production smoke fixture створіть окремий короткоживучий auth test account; не використовуйте персональний token.

## VPS Compose

```bash
git clone <repo-url> /opt/vector/app
cd /opt/vector/app
cp deploy/.env.example deploy/.env
chmod 600 deploy/.env
# Відредагуйте deploy/.env локально на сервері; додайте GEMINI_API_KEY; не вставляйте secrets у git.
docker compose -f deploy/docker-compose.yml config
docker compose -f deploy/docker-compose.yml up -d --build
```

Compose публікує Gateway і PocketBase лише на loopback (`127.0.0.1`). Системний Caddy проксить `/api/*`, `/webhooks/*` та `/pb/*` за [Caddyfile.fragment](../../deploy/Caddyfile.fragment). PocketBase admin (`/_/`) навмисно повертає 404.

## PocketBase one-time setup

1. Відкрийте тільки через SSH tunnel або локальну адмінську сесію, не публікуйте `/_/` у Caddy.
2. Створіть першого superuser у PocketBase admin (`/api/collections/_superusers/auth-with-password`) і збережіть credentials у password manager.
3. Застосуйте міграції з `pocketbase/pb_migrations` через контрольований restart/запуск контейнера.
4. Запустіть `node scripts/check-pocketbase-rules.mjs` у checkout перед promotion.

## Health check і Caddy

Перевірте до reload Caddy:

```bash
curl --fail --silent https://api.example.com/health
curl --fail --silent https://app.example.com/
```

Health response має містити тільки `{"status":"ok","service":"vector-gateway"}` — без token, env, database або stack trace. У production Gateway без GEMINI_API_KEY не стартує навмисно (fail-closed). Після зміни Caddy-конфігурації використайте штатний `caddy validate` та reload вашого system service.

## Rollback і backup

- Перед migration/deploy зафіксуйте image tag/commit і зробіть snapshot VPS або backup `vector_pocketbase_data` volume.
- Для rollback поверніть попередній commit/image tag, запустіть `docker compose ... up -d` і перевірте `/health`.
- Не використовуйте `down -v`, `docker volume rm`, `rm -rf` або будь-які destructive commands під час rollback.
- Для відновлення PocketBase зупиніть тільки Vector services, відновіть backup у новий перевірений volume, потім запустіть Compose і перевірте auth/data ownership.
