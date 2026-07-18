# Hostinger VPS: безпечний доступ і окремий Vector Docker stack

Ця інструкція налаштовує окремий SSH-доступ для Codex і готує ізольоване місце для backend «Вектор», не змінюючи наявні Docker-проєкти.

## 1. Створений локальний ключ

- Private key: `/Users/vitaliidoroshenko/.ssh/vector_vps_ed25519`
- Public key: `/Users/vitaliidoroshenko/.ssh/vector_vps_ed25519.pub`
- Fingerprint: `SHA256:8jYCucuLjAMYBAtcUqJ6iY53gDRwGbr+tGIOl5Dh3TU`

Public key, який дозволено додати на сервер:

```text
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJlaJQn4xlya6cEREJO8GXRr3/I0CsW9xSKAS2CmrsLY codex-vector-vps
```

Ніколи не копіювати private key у Hostinger, GitHub, Vercel, `.env`, чат або репозиторій.

## 2. Відкрити Hostinger terminal

У Hostinger hPanel відкрити VPS → Manage → Browser terminal. Увійти як `root` або користувач із `sudo`.

Записати окремо:

- public IP VPS;
- SSH port, зазвичай `22`;
- ОС і версію;
- бажаний API subdomain, наприклад `api.vector.example.com`.

## 3. Спочатку провести read-only інвентаризацію

Виконувати команди окремо:

```bash
whoami
hostnamectl
cat /etc/os-release
docker --version
docker compose version
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}\t{{.Status}}'
docker compose ls
docker network ls
docker volume ls
ss -lntup
df -h
free -h
systemctl status caddy --no-pager
```

Якщо Docker або Caddy відсутні, зупинитися й повідомити Codex. Не встановлювати й не оновлювати їх навмання на сервері з чинними проєктами.

## 4. Створити окремого користувача

```bash
adduser --disabled-password --gecos "" vector-deploy
install -d -m 700 -o vector-deploy -g vector-deploy /home/vector-deploy/.ssh
nano /home/vector-deploy/.ssh/authorized_keys
```

У `nano` вставити рівно public key із секції 1, зберегти файл і виконати:

```bash
chown vector-deploy:vector-deploy /home/vector-deploy/.ssh/authorized_keys
chmod 600 /home/vector-deploy/.ssh/authorized_keys
```

Для швидкого MVP, якщо Docker уже встановлений:

```bash
usermod -aG docker vector-deploy
```

Членство в групі `docker` фактично дає root-рівень контролю над Docker host. На VPS із критичними сторонніми контейнерами безпечніше використати окремий VPS або rootless Docker. Незалежно від вибору Codex не запускає destructive Docker commands.

Створити окремий робочий каталог:

```bash
install -d -m 750 -o vector-deploy -g vector-deploy /opt/vector
```

## 5. Перевірити пряме SSH-підключення з Mac

Підставити фактичні `SERVER_IP` і `SSH_PORT`:

```bash
ssh -i /Users/vitaliidoroshenko/.ssh/vector_vps_ed25519 -p SSH_PORT vector-deploy@SERVER_IP
```

При першому підключенні уважно звірити host fingerprint із Hostinger і лише потім підтвердити його.

У новій SSH-сесії перевірити:

```bash
whoami
pwd
docker ps
docker compose version
```

Очікується `vector-deploy`, домашня папка користувача та доступ на читання до Docker.

## 6. Додати локальний SSH alias

У `/Users/vitaliidoroshenko/.ssh/config` додати:

```sshconfig
Host vector-vps
  HostName SERVER_IP
  User vector-deploy
  Port SSH_PORT
  IdentityFile /Users/vitaliidoroshenko/.ssh/vector_vps_ed25519
  IdentitiesOnly yes
  ServerAliveInterval 30
  ServerAliveCountMax 3
```

Захистити config і перевірити alias:

```bash
chmod 600 /Users/vitaliidoroshenko/.ssh/config
ssh vector-vps
```

Після успішної перевірки Codex зможе використовувати `ssh vector-vps` без отримання пароля або private key у чаті.

## 7. Правила ізоляції Docker

Backend розміщується лише в `/opt/vector` і запускається так:

```bash
cd /opt/vector
docker compose --project-name vector config
docker compose --project-name vector up -d
```

Compose stack використовує:

- project name `vector`;
- services `gateway` і `pocketbase`;
- internal network `vector_internal`;
- named volume `vector_pb_data`;
- gateway port лише на `127.0.0.1`;
- PocketBase без public port;
- `.env` тільки в `/opt/vector/.env`, права `600`;
- health checks і restart policy;
- окремі backup-файли в `/opt/vector/backups`.

Точний host port вибирається лише після `ss -lntup` і `docker ps`. Не припускати, що `8787` або `8090` вільні.

Заборонені команди:

```text
docker system prune
docker volume prune
docker network prune
docker stop $(docker ps -q)
docker rm -f із чужими container IDs
docker compose down поза /opt/vector або без --project-name vector
```

## 8. Caddy і домен

Створити DNS `A` record для API subdomain → public IP VPS. Frontend залишається на Vercel.

Після вибору вільного loopback port Codex підготує окремий site block приблизно такого виду:

```caddyfile
api.vector.example.com {
    reverse_proxy 127.0.0.1:VECTOR_GATEWAY_PORT
}
```

Не редагувати активний Caddyfile до перевірки його структури, includes і чинних site blocks. Перед reload обов'язково:

```bash
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy
systemctl status caddy --no-pager
```

PocketBase admin UI не публікується. Для адміністрування використовувати SSH tunnel після розгортання.

## 9. Secrets

Backend secrets зберігаються лише у `/opt/vector/.env`:

- PocketBase superuser credentials;
- Gemini API key;
- Google OAuth secret і token encryption key;
- Telegram Bot token/webhook secret;
- Stripe Test secret/webhook secret/price ID.

Створити файл без виведення значень у чат або shell history:

```bash
install -m 600 -o vector-deploy -g vector-deploy /dev/null /opt/vector/.env
nano /opt/vector/.env
```

Frontend Vercel отримує тільки public variables, наприклад `VITE_API_BASE_URL`. Server secrets у Vercel frontend не копіюються.

## 10. Що передати Codex після налаштування

Не передавати secrets. Достатньо повідомити:

1. public IP або hostname;
2. SSH port;
3. що команда `ssh vector-vps` працює;
4. API subdomain;
5. чи Caddy активний;
6. чи `docker ps` працює від `vector-deploy`;
7. чи сервер містить важливі production-контейнери.

Після цього Codex повторить read-only аудит, зафіксує наявні container/network/volume/port names і лише тоді створить окремий Vector Compose stack.
