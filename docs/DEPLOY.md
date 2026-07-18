# 🚀 Деплой ТуваФото на VPS

## Стек
- **Backend**: NestJS (Node 20+) + PostgreSQL + Prisma
- **Frontend**: React + Vite (статические файлы, PWA)
- **База и сервисы**: Docker Compose (postgres) или системный PostgreSQL
- **Веб-сервер / HTTPS**: Nginx или Caddy + Let's Encrypt

> **Про базу.** Проект использует **PostgreSQL**. На сервере её удобнее всего
> поднять тем же `docker compose`, что и локально, либо поставить системный
> `postgresql`. Бэкап — `pg_dump` (см. Часть 10).

> **⚠️ 152-ФЗ.** Сайт собирает персональные данные (имена, email, телефоны,
> согласия). По закону они должны храниться **в России** — берите российский
> VPS (см. раздел «Выбор VPS»).

---

## 📋 Что нужно иметь заранее

1. **IP-адрес** и **root-пароль** сервера — из письма хостинга
2. **SSH-клиент** — [Tabby](https://tabby.sh/) или `ssh` в терминале Windows
3. **SFTP-клиент** — [WinSCP](https://winscp.net/) или [FileZilla](https://filezilla-project.org/)
4. **Домен** (желательно — нужен для HTTPS и для OAuth-входа)
5. Аккаунт **GitHub** с этим проектом (для обновлений одной командой)

---

## 🔌 ЧАСТЬ 1: Подключение к серверу

```bash
ssh root@ВАШ_IP
```

При первом подключении введите `yes`, затем пароль.

---

## ⚙️ ЧАСТЬ 2: Первичная настройка сервера (один раз)

### 2.1 Обновление системы

```bash
apt update && apt upgrade -y
```

### 2.2 Node.js 20+ (обязательно 20+)

> ⚠️ Стандартный `apt install nodejs` ставит старую версию. Ставьте через nodesource:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node --version    # должно быть v20.x.x или новее
```

### 2.3 Docker (для PostgreSQL) и остальные пакеты

```bash
apt install -y docker.io docker-compose-plugin nginx git curl certbot python3-certbot-nginx
systemctl enable --now docker
```

### 2.4 Рабочая директория

```bash
mkdir -p /var/www/tuvafoto
```

---

## 📦 ЧАСТЬ 3: Загрузка кода на сервер

### Вариант А — Git (рекомендуется)

**На сервере** клонируем ваш репозиторий:

```bash
cd /var/www/tuvafoto
git clone https://github.com/ВАШ_ЛОГИН/ВАШ_РЕПОЗИТОРИЙ.git .
```

### Вариант Б — SFTP

Подключитесь по SFTP (хост: IP, пользователь: root) и загрузите папки `apps/`,
`docs/`, `docker-compose.yml`, `package.json` в `/var/www/tuvafoto/`.

> **Не загружайте** `node_modules/`, `dist/`, `.env` — их создаём на сервере.

---

## 🐘 ЧАСТЬ 4: База данных (PostgreSQL)

Поднимаем Postgres тем же compose-файлом, что и локально, но с надёжным паролем.

```bash
cd /var/www/tuvafoto
# зададим пароль БД для этого запуска (подставьте свой)
export POSTGRES_PASSWORD='придумайте_сложный_пароль'
docker compose up -d --wait
docker compose ps          # STATUS должен быть Up (healthy)
```

> Данные Postgres лежат в docker-томе `tuvafoto_postgres-data` и переживают
> перезапуски и обновления кода.

---

## 🔧 ЧАСТЬ 5: Настройка бэкенда

### 5.1 Установка зависимостей

```bash
cd /var/www/tuvafoto
npm install
```

### 5.2 Файл .env (секреты)

`.env` не хранится в git — создаём вручную один раз.

```bash
cp apps/api/.env.example apps/api/.env
nano apps/api/.env
```

> **Управление nano:** печатайте текст; `Ctrl + X` → `Y` → `Enter` — сохранить и выйти.

Заполните боевые значения (подробности по SMTP и OAuth — в разделах ниже):

```env
# Подключение к БД — пароль тот же, что в ЧАСТИ 4
DATABASE_URL="postgresql://tuvafoto:придумайте_сложный_пароль@127.0.0.1:5432/tuvafoto?schema=public"

PORT=3000
NODE_ENV=production
WEB_ORIGIN="https://ВАШ_ДОМЕН"

# Секреты JWT — сгенерируйте (команда ниже). Разные для access и refresh.
JWT_ACCESS_SECRET=СГЕНЕРИРУЙТЕ
JWT_REFRESH_SECRET=СГЕНЕРИРУЙТЕ_ДРУГОЙ

# Владелец сайта. Пароль временный — при первом входе сайт заставит сменить.
OWNER_EMAIL="ваш@email.ru"
OWNER_NAME="Иванов Александр"
OWNER_PASSWORD="временный_пароль"

POLICY_VERSION="2026-07-01"

# Почта (SMTP) — см. ЧАСТЬ 8. Пусто = коды в консоль (только для теста!).
SMTP_HOST=""
SMTP_PORT="587"
SMTP_USER=""
SMTP_PASSWORD=""
SMTP_FROM=""

# Соцвход — см. ЧАСТЬ 9. Пусто = кнопки скрыты.
OAUTH_REDIRECT_BASE="https://ВАШ_ДОМЕН/api"
YANDEX_CLIENT_ID=""
YANDEX_CLIENT_SECRET=""
VK_CLIENT_ID=""
VK_CLIENT_SECRET=""
```

**Генерация секретов JWT (выполните дважды, впишите разные):**

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

### 5.3 Миграции и первичные данные

```bash
cd /var/www/tuvafoto/apps/api
npx prisma migrate deploy     # применяет миграции на боевой БД
npm run seed                  # заводит владельца и справочники
cd /var/www/tuvafoto
```

### 5.4 Сборка и тест запуска

```bash
npm run build --workspace apps/api
node apps/api/dist/main
```

Если видите `API слушает http://localhost:3000/api` — отлично. `Ctrl + C`.

### 5.5 Systemd-сервис (автозапуск бэкенда)

```bash
nano /etc/systemd/system/tuvafoto.service
```

```ini
[Unit]
Description=TuvaFoto API (NestJS)
After=network.target docker.service

[Service]
User=root
WorkingDirectory=/var/www/tuvafoto/apps/api
EnvironmentFile=/var/www/tuvafoto/apps/api/.env
ExecStart=/usr/bin/node dist/main
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable tuvafoto
systemctl start tuvafoto
systemctl status tuvafoto     # Active: active (running)
```

---

## ⚛️ ЧАСТЬ 6: Сборка фронтенда

```bash
cd /var/www/tuvafoto
npm run build --workspace apps/web
ls apps/web/dist/             # должны быть index.html, assets/, sw.js, manifest
```

> Фронт обращается к API по относительному `/api` — отдельный адрес прописывать
> не нужно, Nginx проксирует (см. ниже).

---

## 🌐 ЧАСТЬ 7: Nginx

```bash
nano /etc/nginx/sites-available/tuvafoto
```

```nginx
server {
    listen 80;
    server_name ВАШ_ДОМЕН www.ВАШ_ДОМЕН;

    client_max_body_size 25M;   # запас под загрузку фото альбомов

    # Фронтенд (React SPA)
    root /var/www/tuvafoto/apps/web/dist;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Загруженные фото
    location /uploads/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
    }

    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/tuvafoto /etc/nginx/sites-enabled/
nginx -t                # syntax is ok
systemctl reload nginx
```

> ⚠️ Не запускайте Nginx до сборки фронта (`apps/web/dist` должна существовать).

### HTTPS (Let's Encrypt)

DNS-записи `A` для домена и `www` должны указывать на IP сервера. Затем:

```bash
certbot --nginx -d ВАШ_ДОМЕН -d www.ВАШ_ДОМЕН
certbot renew --dry-run    # проверка автообновления
```

> После включения HTTPS refresh-кука автоматически становится `Secure`
> (в коде это завязано на `NODE_ENV=production`).

---

## 📧 ЧАСТЬ 8: Настройка почты (SMTP)

Приложение шлёт два типа писем: **код для входа** (4 цифры, 10 минут) и
**ссылку восстановления пароля** (1 час). Всё настраивается в `apps/api/.env`.

> **На время разработки** можно оставить `SMTP_HOST` пустым — тогда код и ссылка
> **печатаются в консоль сервера** с пометкой `[DEV-EMAIL]`. Для боевого сайта
> SMTP обязателен: коды в логах = дыра.

После изменения `.env` — перезапуск: `systemctl restart tuvafoto`.

`SMTP_PORT`: `465` = SSL, `587` = STARTTLS. Пароль — это **«пароль приложения»**
(для Yandex/Mail.ru/Gmail) или **API-ключ** (для сервисов рассылок), а не пароль
от ящика.

### Яндекс 360 / Яндекс.Почта (проще всего для РФ)

1. Если есть свой домен — подключите [Яндекс 360 для бизнеса](https://360.yandex.ru/business/)
   и подтвердите домен. Без домена подойдёт обычный `@yandex.ru` (но письма чаще
   попадают в спам, лимит ~150/час).
2. В аккаунте ящика: [«Пароли приложений»](https://id.yandex.ru/security/app-passwords)
   → создайте пароль для «Почты».
3. В `.env`:
   ```env
   SMTP_HOST="smtp.yandex.ru"
   SMTP_PORT="587"
   SMTP_USER="noreply@ваш-домен.ru"
   SMTP_PASSWORD="пароль_приложения"
   SMTP_FROM="noreply@ваш-домен.ru"
   ```

### Mail.ru

1. В ящике `@mail.ru` → «Пароли для внешних приложений» → создайте пароль.
2. В `.env`:
   ```env
   SMTP_HOST="smtp.mail.ru"
   SMTP_PORT="587"
   SMTP_USER="you@mail.ru"
   SMTP_PASSWORD="пароль_приложения"
   SMTP_FROM="you@mail.ru"
   ```

### Сервисы рассылок (больше объём, лучше доставляемость)

- **UniSender Go** — 100 писем/день бесплатно, российский. `SMTP_HOST=smtp.go1.unisender.ru`.
- **SendPulse** — 12 000/мес бесплатно. `SMTP_HOST=smtp-pulse.com`, порт 465.
- Для всех: подтвердите домен (SPF + DKIM записи в DNS), `SMTP_USER`/`SMTP_PASSWORD`
  из их панели, `SMTP_FROM` обязательно на подтверждённом домене.

### Если письма не доходят

- Проверьте папку **Спам** у получателя.
- Смотрите логи: `journalctl -u tuvafoto -n 50` — там будет ошибка SMTP.
- `535 Authentication failed` — неверный логин/пароль (нужен **пароль приложения**).
- `550 Sender address rejected` — `SMTP_FROM` не на подтверждённом домене.
- Письма в спаме → настройте **SPF, DKIM, DMARC** в DNS домена, шлите с адреса
  на своём домене, а не с `@gmail.com`.

---

## 🔑 ЧАСТЬ 9: Вход через Яндекс ID и VK ID

Кнопки соцвхода появляются на сайте автоматически, **только если заданы ключи**.
Пусто — блок «или войти через» скрыт, это нормально. После заполнения ключей —
`systemctl restart tuvafoto`.

`OAUTH_REDIRECT_BASE` в `.env` должен указывать на публичный API:
`https://ВАШ_ДОМЕН/api`. Callback-адреса, которые вписываются у провайдера,
строятся из него.

### Яндекс ID

1. Откройте <https://oauth.yandex.ru> → **«Создать приложение»**.
2. Платформа — **«Веб-сервисы»**. В **Redirect URI** впишите:
   ```
   https://ВАШ_ДОМЕН/api/auth/oauth/yandex/callback
   ```
   (для локальной разработки — `http://localhost:3000/api/auth/oauth/yandex/callback`).
3. Права доступа отметьте: **email** и **имя пользователя**.
4. Скопируйте **ID приложения** и **пароль (Client Secret)** в `.env`:
   ```env
   YANDEX_CLIENT_ID="ваш_id"
   YANDEX_CLIENT_SECRET="ваш_secret"
   ```

### VK ID

1. Откройте <https://vk.com/apps?act=manage> → создайте приложение (тип «Веб-сайт»).
2. В настройках укажите **доверенный redirect URI**:
   ```
   https://ВАШ_ДОМЕН/api/auth/oauth/vk/callback
   ```
3. Возьмите **ID приложения** и **защищённый ключ** → в `.env`:
   ```env
   VK_CLIENT_ID="ваш_id"
   VK_CLIENT_SECRET="ваш_ключ"
   ```

> Пользователи, вошедшие по email, могут дополнительно **привязать** Яндекс/VK
> в профиле → «Подключённые аккаунты», чтобы затем входить в один клик.

---

## ✅ ЧАСТЬ 10: Финальная проверка

```bash
systemctl status tuvafoto
systemctl status nginx
docker compose -f /var/www/tuvafoto/docker-compose.yml ps

# API жив и видит базу
curl http://localhost:3000/api/health
# Ожидается: {"status":"ok","db":"up",...}

# Через Nginx (обязательно curl!)
curl https://ВАШ_ДОМЕН/api/health
```

> ⚠️ Не вводите `http://...` в терминал без `curl` — это не команда bash.

---

## 🔄 ЧАСТЬ 11: Обновление сайта без потери данных

Скрипт обновления (создать один раз):

```bash
nano /var/www/tuvafoto/deploy.sh
```

```bash
#!/bin/bash
set -e
echo "=== Обновление ТуваФото ==="
cd /var/www/tuvafoto

echo "→ Забираем изменения из git..."
git pull origin main

echo "→ Зависимости..."
npm install

echo "→ Миграции БД..."
npx prisma migrate deploy --schema apps/api/prisma/schema.prisma

echo "→ Сборка бэкенда и фронтенда..."
npm run build --workspace apps/api
npm run build --workspace apps/web

echo "→ Перезапуск..."
systemctl restart tuvafoto
systemctl reload nginx

echo "✅ Готово. БД и .env не тронуты."
```

```bash
chmod +x /var/www/tuvafoto/deploy.sh
```

**Процесс обновления:**

```bash
# На вашем компьютере:
git add .
git commit -m "описание изменений"
git push origin main

# На сервере — одна команда:
/var/www/tuvafoto/deploy.sh
```

---

## 💾 ЧАСТЬ 12: Резервное копирование БД

Ручной бэкап (дамп в файл):

```bash
docker exec tuvafoto-db pg_dump -U tuvafoto tuvafoto > /var/www/tuvafoto/backup_$(date +%F_%H%M).sql
```

Автоматически каждый день в 3:00 (`crontab -e`):

```
0 3 * * * docker exec tuvafoto-db pg_dump -U tuvafoto tuvafoto > /var/www/tuvafoto/backup_$(date +\%Y\%m\%d).sql && find /var/www/tuvafoto -name "backup_*.sql" -mtime +7 -delete
```

Восстановление из дампа:

```bash
cat backup_ФАЙЛ.sql | docker exec -i tuvafoto-db psql -U tuvafoto -d tuvafoto
```

---

## 🖥 Выбор VPS

**Главное ограничение — сервер в России** (152-ФЗ, персональные данные).
Кандидаты:

| Хостинг | Плюсы |
|---------|-------|
| **Timeweb Cloud** | дёшево, простая панель, есть управляемый PostgreSQL |
| **Selectel** | S3-хранилище для фото, гибко, бэкапы из коробки |
| **REG.ru** | простой, есть домены в одном месте |
| **Yandex Cloud** | managed Postgres + Object Storage, но дороже |
| **VK Cloud** | аналогично Yandex Cloud |

**Минимум для старта:** 2 vCPU, 2–4 ГБ RAM, 40+ ГБ диска (фотоальбомы тяжёлые —
следите за местом или сразу подключайте S3-хранилище).

**Рекомендация:** начать с Timeweb/Selectel (самый дешёвый вход), фото альбомов
вынести в S3-совместимое хранилище (Selectel), когда объёмы вырастут.

---

## 🔒 Что уже сделано для безопасности (справочно)

- Пароли — только argon2id-хэш; refresh-токены, коды 2FA и токены сброса — sha256.
- Вход по паролю защищён вторым фактором (код на почту).
- Refresh-токен в httpOnly-куке (недоступен скриптам), в проде ещё и `Secure`.
- Refresh ротируется при каждом обновлении; завершение сессии, смена и сброс
  пароля отзывают доступ **немедленно** (сервер проверяет живость сессии).
- Владелец обязан сменить заводские логин и пароль при первом входе.
- Перебор пароля и кода ограничен по частоте (троттлинг).
- Все защищённые ручки закрыты по умолчанию; роль берётся из подписанного токена.
- Отвязать последний способ входа нельзя (защита от самоблокировки).
- Согласия 152-ФЗ фиксируются с версией политики, датой и IP.

> Секреты (`apps/api/.env`), дамп БД и загруженные фото **никогда не попадают
> в git** и не перезаписываются при обновлении кода.

---

## 🆘 Диагностика

```bash
# Логи бэкенда (тут же видны [DEV-EMAIL] коды, если SMTP не настроен)
journalctl -u tuvafoto -n 100 --no-pager
journalctl -u tuvafoto -f            # в реальном времени

# База
docker compose -f /var/www/tuvafoto/docker-compose.yml ps
docker exec tuvafoto-db psql -U tuvafoto -d tuvafoto -c "\dt"

# Nginx
nginx -t
tail -50 /var/log/nginx/error.log

# Перезапуск
systemctl restart tuvafoto
systemctl reload nginx
```
